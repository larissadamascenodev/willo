import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useMonth } from "@/contexts/MonthContext";
import { getRecurringSourceId, getRecurringTransactionsForMonth } from "@/services/recurringService";
import { isSubscription } from "@/lib/subscriptionBrands";

/**
 * Everything that repeats every month, read once and split three ways.
 *
 * Two cards on the home ask the same question of the database — what recurs this
 * month — and used to ask it twice. They ask it here instead, and each takes the
 * slice it is about: the subscriptions, the fixed costs that are not subscriptions,
 * and the income that arrives on a schedule.
 *
 * A source is counted once even when it has several rows in the month, because a
 * salary paid on the 6th and the 15th is two commitments and a single commitment
 * split across two invoice rows is still one.
 */

export type RecurringType = "despesa" | "receita";

export interface RecurringItem {
  id: string;
  sourceId: string;
  name: string;
  amount: number;
  dueDay: number;
  category: string;
  source: "conta" | "cartao";
  txType: RecurringType;
  isPaidThisMonth: boolean;
}

/** Days from today until the next time this falls due. */
export function daysUntil(dueDay: number, now = new Date()): number {
  const today = now.getDate();
  const next = dueDay >= today
    ? new Date(now.getFullYear(), now.getMonth(), dueDay)
    : new Date(now.getFullYear(), now.getMonth() + 1, dueDay);
  return Math.max(0, Math.ceil((next.getTime() - now.getTime()) / 86_400_000));
}

export function useRecorrentes() {
  const { user } = useAuth();
  const { selectedMonth, selectedYear } = useMonth();
  const [items, setItems] = useState<RecurringItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const txs = await getRecurringTransactionsForMonth(selectedMonth, selectedYear, user.id);

      const seen = new Map<string, typeof txs[number]>();
      for (const tx of txs) {
        const key = `${tx.type}-${getRecurringSourceId(tx)}`;
        if (!seen.has(key)) seen.set(key, tx);
      }

      const mapped: RecurringItem[] = Array.from(seen.values()).map((tx) => ({
        id: tx.id,
        sourceId: getRecurringSourceId(tx),
        name: tx.name,
        amount: Number(tx.amount),
        dueDay: new Date(tx.date + "T12:00:00").getDate(),
        category: tx.category,
        source: tx.payment_method === "cartao" ? ("cartao" as const) : ("conta" as const),
        txType: tx.type as RecurringType,
        isPaidThisMonth: tx.status === "pago",
      }));

      // What is still owed comes first, then by how soon it falls due.
      mapped.sort((a, b) => {
        if (a.isPaidThisMonth !== b.isPaidThisMonth) return a.isPaidThisMonth ? 1 : -1;
        return daysUntil(a.dueDay) - daysUntil(b.dueDay);
      });

      setItems(mapped);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [user, selectedMonth, selectedYear]);

  useEffect(() => { refetch(); }, [refetch]);

  useEffect(() => {
    const handler = () => refetch();
    window.addEventListener("finance-data-changed", handler);
    window.addEventListener("transaction-created", handler);
    return () => {
      window.removeEventListener("finance-data-changed", handler);
      window.removeEventListener("transaction-created", handler);
    };
  }, [refetch]);

  const split = useMemo(() => {
    /* What repeats on a card is a subscription whatever it is called: a card is where
       a service bills you every month, and the form itself calls that option
       "Assinatura" there. */
    const isSub = (i: RecurringItem) => i.txType === "despesa" && (i.source === "cartao" || isSubscription(i.name));
    const assinaturas = items.filter(isSub);
    const gastosFixos = items.filter((i) => i.txType === "despesa" && !isSub(i));
    const receitasFixas = items.filter((i) => i.txType === "receita");
    const sum = (list: RecurringItem[]) => list.reduce((t, i) => t + i.amount, 0);
    return {
      assinaturas,
      gastosFixos,
      receitasFixas,
      totalAssinaturas: sum(assinaturas),
      totalGastosFixos: sum(gastosFixos),
      totalReceitasFixas: sum(receitasFixas),
    };
  }, [items]);

  return { items, loading, refetch, ...split };
}
