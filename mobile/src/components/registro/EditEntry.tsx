import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { getAccounts, getCreditCards, getTransactionById, updateTransaction } from "@/services/transactionService";
import { deleteInSeries, editInSeries } from "@/services/seriesActions";
import CategoryPicker from "~/components/CategoryPicker";
import EntryForm, { isoOf, type EntryValues, type Repeat } from "~/components/registro/EntryForm";
import { Primary, type Account, type Card } from "~/components/registro/entryParts";
import { Repeat as RepeatIcon, Trash2 } from "~/components/icons";
import { showToast } from "~/lib/toast";
import { behind, showNow } from "~/lib/optimistic";
import { useAuth } from "~/lib/auth";
import { AMBER, RED } from "~/theme/tokens";

import { th } from "~/theme/theme";
/**
 * An entry already written, opened to change: the same page as the check before saving,
 * everything on it changeable — out or in, amount, words, category, how it was paid,
 * repetition and instalments, when, whether it is settled, a note.
 *
 * A fixed entry or an instalment asks where the change goes: only the one being looked
 * at — nothing else moves — or this one and the ones after — all of them alike, the ones
 * before as they were. An instalment is shown as itself and keeps the purchase's plan.
 */

interface Tx {
  id: string;
  name: string;
  type: "despesa" | "receita";
  amount: number;
  category: string;
  date: string;
  status: "pago" | "pendente";
  payment_method: "conta" | "cartao" | null;
  account_id: string | null;
  credit_card_id: string | null;
  recurrence_type: Repeat | null;
  installments: number | null;
  installment_current: number | null;
  parent_transaction_id: string | null;
  observation: string | null;
}

type Scope = "month" | "all" | "next";

const PLAN_NOTE = /^paid_installments:\d+\s*(\|\s*)?/;

/** The day a recurring entry falls on in a given month. */
function inMonth(iso: string, month: number, year: number) {
  const day = Number(iso.slice(8, 10));
  return isoOf(new Date(year, month, Math.min(day, new Date(year, month + 1, 0).getDate())));
}

export default function EditEntry({ id, month, year, onDone }: { id: string; month: number; year: number; onDone: () => void }) {
  const { user } = useAuth();
  const [tx, setTx] = useState<Tx | null>(null);
  const [v, setV] = useState<EntryValues | null>(null);
  /* As it opened: nothing changed, nothing to save. */
  const [opened, setOpened] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [picking, setPicking] = useState(false);
  /* Where a change or a removal goes, asked once the person has said which. */
  const [asking, setAsking] = useState<false | "edit" | "delete">(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<EntryValues>) => setV((p) => (p ? { ...p, ...patch } : p));

  useEffect(() => {
    /* Read once the session is in: before it, the row is not ours to see. */
    if (!user) return;
    let alive = true;
    void Promise.all([getTransactionById(id), getAccounts(), getCreditCards()])
      .then(([row, accs, cs]) => {
        if (!alive) return;
        const t = row as unknown as Tx;
        const parcel = t.recurrence_type === "parcelado" && (t.installments ?? 0) > 1;
        setTx(t);
        setAccounts((accs as unknown as Account[]).filter((a) => a.type !== "investment"));
        setCards(cs as unknown as Card[]);
        const first: EntryValues = {
          type: t.type,
          /* An instalment, the first included, is shown as itself. */
          cents: Math.round(Number(t.amount) * 100),
          name: t.name,
          category: t.category || null,
          method: t.type === "receita" ? "conta" : (t.payment_method ?? "conta"),
          whereId: t.credit_card_id ?? t.account_id,
          repeat: t.recurrence_type === "parcelado" || t.recurrence_type === "fixa" ? t.recurrence_type : "unica",
          parts: parcel ? t.installments : null,
          date: t.recurrence_type === "fixa" ? inMonth(t.date, month, year) : t.date,
          /* A fixed entry opened in another month: that month has not happened because the
             month it came from has. */
          status: t.recurrence_type === "fixa" && t.date.slice(0, 7) !== `${year}-${String(month + 1).padStart(2, "0")}` ? "pendente" : t.status,
          note: (t.observation ?? "").replace(PLAN_NOTE, ""),
        };
        setV(first);
        setOpened(JSON.stringify(first));
      })
      .catch((e) => {
        console.warn("[EditEntry] could not read", id, e);
        if (alive) setError("Não consegui abrir esse lançamento.");
      });
    return () => {
      alive = false;
    };
  }, [id, month, year, user]);

  if (!v || !tx) {
    return (
      <View style={{ paddingVertical: 60, alignItems: "center" }}>
        {error ? <Text style={{ fontSize: 14, color: th(RED) }}>{error}</Text> : <ActivityIndicator color={th("#fff")} />}
      </View>
    );
  }

  const parcel = tx.recurrence_type === "parcelado" && (tx.installments ?? 0) > 1;
  /* On a card, every invoice repeats the purchase as written on its first row: one
     instalment cannot be changed or removed on its own — only the whole purchase. */
  const wholeOnly = parcel && tx.payment_method === "cartao" && !!tx.credit_card_id;
  const child = !!tx.parent_transaction_id || parcel;
  const recurring = tx.recurrence_type === "fixa" || parcel;

  /* A fixed entry's change can also begin with the month after the one on screen —
     a new salary from next month, say — leaving this month as it is. */
  const next = month === 11 ? { month: 0, year: year + 1 } : { month: month + 1, year };
  const fixed = tx.recurrence_type === "fixa";

  const remove = async (scope?: Scope) => {
    if (!user) return;
    if (!scope) return setAsking("delete");
    const userId = user.id;
    const at = scope === "next" ? next : { month, year };
    if (scope !== "next") showNow({ id: tx.id, removed: true });
    showToast(scope === "next" ? "Excluído a partir do mês seguinte" : `“${tx.name}” excluído`);
    onDone();
    void behind(
      tx.id,
      () => deleteInSeries(tx.id, scope === "next" ? "all" : scope, { ...at, userId }),
      () => showToast("Não consegui excluir agora. Tente de novo."),
    );
  };

  const save = async (scope?: Scope) => {
    if (!user || !v.name.trim() || v.cents <= 0 || !v.whereId) return;
    if (recurring && !scope) return setAsking("edit");
    setSaving(true);
    setError(null);
    try {
      const credit = v.type === "despesa" && v.method === "cartao";
      const parts = !child && v.repeat === "parcelado" && v.parts && v.parts > 1 ? v.parts : null;
      const planNote = (tx.observation ?? "").match(PLAN_NOTE)?.[0]?.replace(/\s*\|\s*$/, "") ?? "";
      const note = [planNote, v.note.trim()].filter(Boolean).join(" | ") || null;
      const fields = {
        name: v.name.trim(),
        type: v.type,
        amount: parts ? Math.round(v.cents / parts) / 100 : v.cents / 100,
        category: v.category ?? "Outros",
        /* From next month: the same day, in that month. */
        date: scope === "next" ? inMonth(v.date, next.month, next.year) : v.date,
        status: scope === "next" ? ("pendente" as const) : credit ? ("pendente" as const) : v.status,
        payment_method: v.type === "receita" ? ("conta" as const) : (v.method ?? "conta"),
        account_id: credit ? null : v.whereId,
        credit_card_id: credit ? v.whereId : null,
        observation: note,
        ...(child
          ? {}
          : {
              recurrence_type: (parts ? "parcelado" : v.repeat === "fixa" ? "fixa" : "unica") as Repeat,
              installments: parts,
              installment_current: parts ? (tx.installment_current ?? 1) : null,
            }),
      };

      /* The list shows the change at once; the database catches up behind. */
      const userId = user.id;
      if (scope !== "next") showNow({ id: tx.id, row: { ...tx, ...fields, id: tx.id, date: fields.date } });
      showToast(scope === "next" ? "Alterado a partir do mês seguinte" : "Lançamento atualizado");
      onDone();
      void behind(
        tx.id,
        () =>
          recurring && scope
            ? editInSeries(tx.id, scope === "next" ? "all" : scope, fields, { ...(scope === "next" ? next : { month, year }), userId })
            : updateTransaction(tx.id, fields as never),
        () => showToast("Não consegui salvar agora. Tente de novo."),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não consegui salvar agora. Tente de novo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <View style={{ paddingHorizontal: 20, paddingTop: 2, paddingBottom: 8 }}>
        <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 1.4, color: th("rgba(255,255,255,0.72)") }}>EDITAR LANÇAMENTO</Text>
        <Text style={{ marginTop: 10, fontSize: 22, fontWeight: "800", letterSpacing: -0.5, color: th("#fff") }}>{tx.name}</Text>

        <EntryForm
          values={v}
          onChange={(patch) => {
            set(patch);
            setAsking(false);
          }}
          accounts={accounts}
          cards={cards}
          partOf={child ? `Parcela ${tx.installment_current ?? 1} de ${tx.installments ?? 1}` : null}
          onPickCategory={() => setPicking(true)}
        />

        {error && <Text style={{ marginTop: 14, fontSize: 13.5, color: th(RED) }}>{error}</Text>}

        {/* A recurring one: where the change, or the removal, goes */}
        {asking ? (
          <Animated.View entering={FadeInDown.duration(220)} style={{ marginTop: 18, gap: 10 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 10,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: th(asking === "delete" ? "rgba(248,113,113,0.24)" : "rgba(249,206,78,0.24)", "line"),
                backgroundColor: th(asking === "delete" ? "rgba(248,113,113,0.08)" : "rgba(249,206,78,0.08)", "bg"),
                paddingHorizontal: 14,
                paddingVertical: 12,
              }}
            >
              {asking === "delete" ? <Trash2 size={16} color={th(RED)} /> : <RepeatIcon size={16} color={th(AMBER)} />}
              <Text style={{ flex: 1, fontSize: 13, lineHeight: 18, color: th("rgba(255,255,255,0.82)") }}>
                {!recurring
                  ? "Excluir este lançamento? Isso não pode ser desfeito."
                  : wholeOnly
                    ? asking === "delete"
                      ? `São ${tx.installments} parcelas de uma compra no cartão. Excluir remove a compra inteira, de todas as faturas.`
                      : `São ${tx.installments} parcelas de uma compra no cartão. A mudança vale para todas.`
                  : parcel
                    ? `É a parcela ${tx.installment_current ?? 1} de ${tx.installments}. Quer ${asking === "delete" ? "excluir" : "mudar"} só esta ou esta e as próximas?`
                    : asking === "delete"
                      ? "Essa transação se repete todo mês. Excluir a partir de quando?"
                      : "Essa transação se repete todo mês. A mudança vale a partir de quando?"}
              </Text>
            </View>
            {!recurring ? (
              <AskButton label="Excluir" danger onPress={() => void remove("all")} disabled={saving} />
            ) : (
              <>
                {!wholeOnly && <AskButton label={parcel ? "Só esta parcela" : "Só deste mês"} onPress={() => void (asking === "delete" ? remove("month") : save("month"))} disabled={saving} />}
                {fixed && <AskButton label="A partir do mês seguinte" onPress={() => void (asking === "delete" ? remove("next") : save("next"))} disabled={saving} />}
                <AskButton
                  label={wholeOnly ? (asking === "delete" ? "Excluir a compra" : "Todas as parcelas") : parcel ? "Esta e as próximas" : "Deste mês em diante"}
                  strong={asking !== "delete"}
                  danger={asking === "delete"}
                  onPress={() => void (asking === "delete" ? remove("all") : save("all"))}
                  disabled={saving}
                  loading={saving}
                />
              </>
            )}
            <Pressable onPress={() => setAsking(false)} disabled={saving} style={{ height: 44, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 14, color: th("rgba(255,255,255,0.7)") }}>Cancelar</Text>
            </Pressable>
          </Animated.View>
        ) : (
          <>
            {JSON.stringify(v) !== opened && <Primary label={saving ? "Salvando…" : "Salvar alterações"} busy={saving} disabled={saving || v.cents <= 0 || !v.name.trim() || !v.whereId || (v.repeat === "parcelado" && !v.parts)} onPress={() => void save()} />}
            <Pressable onPress={() => void remove()} disabled={saving} accessibilityRole="button" style={({ pressed }) => ({ marginTop: 12, height: 46, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}>
              <Trash2 size={16} color={th(RED)} />
              <Text style={{ fontSize: 14.5, fontWeight: "600", color: th(RED) }}>Excluir lançamento</Text>
            </Pressable>
          </>
        )}
      </View>

      <CategoryPicker
        open={picking}
        type={v.type}
        value={v.category ?? ""}
        onPick={(c: string) => {
          setPicking(false);
          set({ category: c });
        }}
        onClose={() => setPicking(false)}
      />
    </>
  );
}

/** One answer to "where does the change go", full width so its words are never cut. */
function AskButton({ label, strong, danger, onPress, disabled, loading }: { label: string; strong?: boolean; danger?: boolean; onPress: () => void; disabled?: boolean; loading?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        height: 50,
        borderRadius: 999,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: strong ? 0 : 1,
        borderColor: th("rgba(255,255,255,0.08)", "line"),
        backgroundColor: danger ? "rgba(248,113,113,0.16)" : strong ? th("#fff", "bg") : th("rgba(255,255,255,0.04)", "bg"),
        opacity: disabled && !loading ? 0.5 : pressed ? 0.8 : 1,
      })}
    >
      {loading ? (
        <ActivityIndicator color={th(strong ? "#0B0B0B" : "#fff")} />
      ) : (
        <Text style={{ fontSize: 14.5, fontWeight: strong || danger ? "700" : "600", color: danger ? RED : th(strong ? "#0B0B0B" : "#fff") }}>{label}</Text>
      )}
    </Pressable>
  );
}
