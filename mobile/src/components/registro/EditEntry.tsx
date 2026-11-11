import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { getAccounts, getCreditCards, getTransactionById, updateTransaction } from "@/services/transactionService";
import { editInSeries } from "@/services/seriesActions";
import CategoryPicker from "~/components/CategoryPicker";
import EntryForm, { isoOf, type EntryValues, type Repeat } from "~/components/registro/EntryForm";
import { Chip, Primary, type Account, type Card } from "~/components/registro/entryParts";
import { showToast } from "~/lib/toast";
import { useAuth } from "~/lib/auth";
import { INK, RED } from "~/theme/tokens";

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
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [picking, setPicking] = useState(false);
  const [asking, setAsking] = useState(false);
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
        setV({
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
        });
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
  const child = !!tx.parent_transaction_id || parcel;
  const recurring = tx.recurrence_type === "fixa" || parcel;

  const save = async (scope?: "month" | "all") => {
    if (!user || !v.name.trim() || v.cents <= 0 || !v.whereId) return;
    if (recurring && !scope) return setAsking(true);
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
        date: v.date,
        status: credit ? ("pendente" as const) : v.status,
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

      if (recurring && scope) await editInSeries(tx.id, scope, fields, { month, year, userId: user.id });
      else await updateTransaction(tx.id, fields);
      window.dispatchEvent(new CustomEvent("transaction-created"));
      showToast("Lançamento atualizado");
      onDone();
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

        {/* A recurring one: where the change goes */}
        {asking ? (
          <Animated.View entering={FadeIn.duration(200)} style={{ marginTop: 16 }}>
            <Text style={{ fontSize: 15.5, fontWeight: "600", color: th("#fff") }}>Aplicar a mudança em:</Text>
            <Text style={{ marginTop: 2, fontSize: 12.5, color: th(INK.soft) }}>
              {parcel ? `É a parcela ${tx.installment_current ?? 1} de ${tx.installments}.` : "Ele se repete todo mês."}
            </Text>
            <View style={{ marginTop: 12, flexDirection: "row", gap: 8 }}>
              <Chip label={parcel ? "Só esta parcela" : "Só este mês"} on={false} onPress={() => void save("month")} />
              <Chip label={parcel ? "Esta e as próximas" : "Este e os próximos"} on={false} onPress={() => void save("all")} />
            </View>
            {saving && <ActivityIndicator style={{ marginTop: 12 }} color={th("#fff")} />}
          </Animated.View>
        ) : (
          <Primary label={saving ? "Salvando…" : "Salvar alterações"} busy={saving} disabled={saving || v.cents <= 0 || !v.name.trim() || !v.whereId || (v.repeat === "parcelado" && !v.parts)} onPress={() => void save()} />
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
