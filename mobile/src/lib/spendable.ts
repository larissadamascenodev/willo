import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFinanceData } from "@/hooks/useFinanceData";
import { useCardsOverview, invoiceDueDate } from "@/hooks/useCardsOverview";
import { useRecorrentes } from "@/hooks/useRecorrentes";
import { getAccounts } from "@/services/transactionService";
import { useAuth } from "~/lib/auth";

/**
 * How much can be spent — today, and each day until the month ends.
 *
 * What is free is what the everyday accounts will hold at the end of the month, with every
 * bill and income of the month already counted, less two things that are not free: what is
 * kept in savings, and what has gone on the card and is due next month (spent already,
 * paid later). Shared by the days left, today included.
 *
 * Today's share is fixed at the start of the day: what was spent today comes out of it,
 * so the day's figure goes down as the day goes on, and tomorrow's moves with it.
 */

const PAYMENT = /^(faturas?|pagamento de fatura|cart[aã]o de cr[eé]dito|saldo inicial|meta|investimento)$/i;

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export interface Spendable {
  loading: boolean;
  /** Free until the month ends, after everything the month still owes. */
  free: number;
  daysLeft: number;
  /** Today's share, as it stood when the day began. */
  today: number;
  spentToday: number;
  /** What is left of today's share; below zero, today went over. */
  leftToday: number;
  /** Each day's share from tomorrow, if nothing more is spent today. */
  tomorrow: number;
  /** The month's own figures. */
  saldoAtual: number;
  saldoPrevisto: number;
  savings: number;
  cardNext: number;
  received: number;
  toReceive: number;
  paid: number;
  toPay: number;
  /** Fixed income a month, for what an hour of work is worth. */
  income: number;
  hour: number;
}

export function useSpendable(): Spendable {
  const { user } = useAuth();
  const now = useMemo(() => new Date(), []);
  const { data, loading } = useFinanceData(now.getMonth(), now.getFullYear());
  const cards = useCardsOverview();
  const { receitasFixas } = useRecorrentes();
  const [savings, setSavings] = useState(0);
  const [spentToday, setSpentToday] = useState(0);

  const load = useCallback(async () => {
    if (!user) return;
    const [accs, todays] = await Promise.all([
      getAccounts().catch(() => []),
      supabase.from("transactions").select("amount, type, category, status, payment_method").eq("user_id", user.id).eq("date", isoDay(new Date())),
    ]);
    setSavings((accs as unknown as { type?: string; current_balance?: number }[]).filter((a) => a.type === "savings").reduce((t, a) => t + (Number(a.current_balance) || 0), 0));
    setSpentToday(
      ((todays.data ?? []) as { amount: number; type: string; category: string | null; status: string; payment_method: string | null }[])
        /* Spent today: paid from an account, or put on a card; never an invoice being paid. */
        .filter((t) => t.type === "despesa" && !PAYMENT.test((t.category ?? "").trim()) && (t.payment_method === "cartao" || t.status === "pago"))
        .reduce((t, r) => t + Number(r.amount), 0),
    );
  }, [user]);

  useEffect(() => {
    void load();
    const on = () => void load();
    window.addEventListener("finance-data-changed", on);
    window.addEventListener("transaction-created", on);
    return () => {
      window.removeEventListener("finance-data-changed", on);
      window.removeEventListener("transaction-created", on);
    };
  }, [load]);

  return useMemo(() => {
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59);
    const nextEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59);
    /* On the card, unpaid, and due next month: already spent, paid then. Instalments
       further ahead belong to their own months, not to what is free in this one. */
    const cardNext = cards.invoices
      .filter((i) => !i.isPaid && i.total - i.paid > 0)
      .filter((i) => {
        const card = cards.cards.find((c) => c.id === i.cardId);
        if (!card) return false;
        const due = invoiceDueDate(card, i.year, i.month);
        return due > monthEnd && due <= nextEnd;
      })
      .reduce((t, i) => t + (i.total - i.paid), 0);

    const daysLeft = monthEnd.getDate() - now.getDate() + 1;
    const free = data.saldoPrevisto - savings - cardNext;
    const startOfDay = Math.max(0, free + spentToday);
    const today = startOfDay / daysLeft;
    const leftToday = today - spentToday;
    const tomorrow = daysLeft > 1 ? Math.max(0, free) / (daysLeft - 1) : 0;
    const income = receitasFixas.reduce((t, r) => t + r.amount, 0) || data.receitasRecebidas;

    return {
      loading: loading || cards.loading,
      free,
      daysLeft,
      today,
      spentToday,
      leftToday,
      tomorrow,
      saldoAtual: data.saldoAtual,
      saldoPrevisto: data.saldoPrevisto,
      savings,
      cardNext,
      received: data.receitasRecebidas,
      toReceive: data.receitasPendentes,
      paid: data.despesasPagas,
      toPay: data.despesasPendentes,
      income,
      hour: income > 0 ? income / 220 : 0,
    };
  }, [now, cards.invoices, cards.cards, cards.loading, data, savings, spentToday, loading, receitasFixas]);
}
