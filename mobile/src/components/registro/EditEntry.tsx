import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { createTransaction, getAccounts, getCreditCards, getTransactionById, updateTransaction } from "@/services/transactionService";
import { excludeRecurringForMonth, excludeRecurringFromMonthOnward } from "@/services/recurringService";
import CategoryPicker from "~/components/CategoryPicker";
import EntryForm, { isoOf, type EntryValues, type Repeat } from "~/components/registro/EntryForm";
import { Chip, Primary, type Account, type Card } from "~/components/registro/entryParts";
import { showToast } from "~/lib/toast";
import { useAuth } from "~/lib/auth";
import { INK, RED } from "~/theme/tokens";

/**
 * An entry already written, opened to change: the same page as the check before saving,
 * everything on it changeable — out or in, amount, words, category, how it was paid,
 * repetition and instalments, when, whether it is settled, a note.
 *
 * A recurring one asks where the change goes: only the month being looked at — that
 * month leaves the series and gets an entry of its own — or this month and the ones
 * after — from here on the series is the changed one. One instalment of a purchase
 * keeps the purchase's plan.
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
        const child = !!t.parent_transaction_id;
        setTx(t);
        setAccounts((accs as unknown as Account[]).filter((a) => a.type !== "investment"));
        setCards(cs as unknown as Card[]);
        setV({
          type: t.type,
          /* A purchase in instalments is shown whole, as it was entered; one instalment on its own, as itself. */
          cents: Math.round(Number(t.amount) * 100) * (parcel && !child ? (t.installments ?? 1) : 1),
          name: t.name,
          category: t.category || null,
          method: t.type === "receita" ? "conta" : (t.payment_method ?? "conta"),
          whereId: t.credit_card_id ?? t.account_id,
          repeat: t.recurrence_type === "parcelado" || t.recurrence_type === "fixa" ? t.recurrence_type : "unica",
          parts: parcel ? t.installments : null,
          date: t.recurrence_type === "fixa" ? inMonth(t.date, month, year) : t.date,
          status: t.status,
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
        {error ? <Text style={{ fontSize: 14, color: RED }}>{error}</Text> : <ActivityIndicator color="#fff" />}
      </View>
    );
  }

  const child = !!tx.parent_transaction_id;
  const recurring = tx.recurrence_type === "fixa";
  const startsHere = Number(tx.date.slice(0, 4)) * 12 + Number(tx.date.slice(5, 7)) - 1 >= year * 12 + month;

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

      if (recurring && scope === "month") {
        /* This month leaves the series and gets an entry of its own. */
        if (startsHere) {
          const next = new Date(year, month + 1, 1);
          await updateTransaction(tx.id, { date: inMonth(tx.date, next.getMonth(), next.getFullYear()) });
        } else await excludeRecurringForMonth(tx.id, month, year, user.id);
        await createTransaction({ ...fields, recurrence_type: "unica", installments: null, installment_current: null } as never, user.id);
      } else if (recurring && scope === "all" && !startsHere) {
        /* From this month on, the series is the changed one. */
        await excludeRecurringFromMonthOnward(tx.id, month, year, user.id);
        await createTransaction(fields as never, user.id);
      } else {
        await updateTransaction(tx.id, fields);
      }
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
        <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 1.4, color: "rgba(255,255,255,0.72)" }}>EDITAR LANÇAMENTO</Text>
        <Text style={{ marginTop: 10, fontSize: 22, fontWeight: "800", letterSpacing: -0.5, color: "#fff" }}>{tx.name}</Text>

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

        {error && <Text style={{ marginTop: 14, fontSize: 13.5, color: RED }}>{error}</Text>}

        {/* A recurring one: where the change goes */}
        {asking ? (
          <Animated.View entering={FadeIn.duration(200)} style={{ marginTop: 16 }}>
            <Text style={{ fontSize: 15.5, fontWeight: "600", color: "#fff" }}>Aplicar a mudança em:</Text>
            <Text style={{ marginTop: 2, fontSize: 12.5, color: INK.soft }}>É um lançamento recorrente.</Text>
            <View style={{ marginTop: 12, flexDirection: "row", gap: 8 }}>
              <Chip label="Só este mês" on={false} onPress={() => void save("month")} />
              <Chip label="Este e os próximos" on={false} onPress={() => void save("all")} />
            </View>
            {saving && <ActivityIndicator style={{ marginTop: 12 }} color="#fff" />}
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
