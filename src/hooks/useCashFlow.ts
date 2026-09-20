import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface CashFlowEntry {
  id: string;
  name: string;
  category: string;
  date: string; // YYYY-MM-DD (local)
  amount: number;
  kind: "entrada" | "saida";
  accountName: string | null;
  isInvoicePayment: boolean;
}

export const toDateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

let cache: { userId: string; entries: CashFlowEntry[]; timestamp: number } | null = null;
const CACHE_TTL = 120_000;

/**
 * Money that actually moved through the accounts over the last 12 months:
 * paid receitas (entradas), paid non-card despesas and card-bill payments (saídas).
 * Card purchases only count once their bill is paid.
 */
export function useCashFlow() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<CashFlowEntry[]>(() =>
    cache && user && cache.userId === user.id ? cache.entries : []
  );
  const [loading, setLoading] = useState(() => !(cache && user && cache.userId === user.id));

  const load = useCallback(async () => {
    if (!user) return;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const [{ data: txs }, { data: payments }, { data: accounts }] = await Promise.all([
      supabase
        .from("transactions")
        .select("id, name, category, date, amount, type, payment_method, account_id")
        .eq("user_id", user.id)
        .eq("status", "pago")
        .neq("payment_method", "cartao")
        .gte("date", toDateKey(start))
        .lte("date", toDateKey(now)),
      supabase
        .from("invoice_payments")
        .select("id, amount, paid_at, account_id, invoices(credit_card_id, credit_cards(name))")
        .eq("user_id", user.id)
        .gte("paid_at", start.toISOString()),
      supabase.from("accounts").select("id, name").eq("user_id", user.id),
    ]);

    const accountName = new Map((accounts ?? []).map((a) => [a.id, a.name]));
    const next: CashFlowEntry[] = [];

    for (const tx of txs ?? []) {
      if (tx.type !== "receita" && tx.type !== "despesa") continue;
      next.push({
        id: tx.id,
        name: tx.name,
        category: tx.category,
        date: tx.date,
        amount: Number(tx.amount),
        kind: tx.type === "receita" ? "entrada" : "saida",
        accountName: tx.account_id ? accountName.get(tx.account_id) ?? null : null,
        isInvoicePayment: false,
      });
    }
    for (const p of (payments ?? []) as Array<{
      id: string; amount: number; paid_at: string; account_id: string | null;
      invoices: { credit_cards: { name: string } | null } | null;
    }>) {
      if (!p.paid_at) continue;
      next.push({
        id: `invoice-payment-${p.id}`,
        name: `Fatura ${p.invoices?.credit_cards?.name ?? "do cartão"}`,
        category: "Cartão de Crédito",
        date: toDateKey(new Date(p.paid_at)),
        amount: Number(p.amount),
        kind: "saida",
        accountName: p.account_id ? accountName.get(p.account_id) ?? null : null,
        isInvoicePayment: true,
      });
    }

    next.sort((a, b) => b.date.localeCompare(a.date));
    cache = { userId: user.id, entries: next, timestamp: Date.now() };
    setEntries(next);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    if (!cache || cache.userId !== user.id || Date.now() - cache.timestamp >= CACHE_TTL) void load();

    const onChange = () => {
      cache = null;
      void load();
    };
    window.addEventListener("finance-data-changed", onChange);
    window.addEventListener("transaction-created", onChange);
    return () => {
      window.removeEventListener("finance-data-changed", onChange);
      window.removeEventListener("transaction-created", onChange);
    };
  }, [user, load]);

  return { entries, loading };
}

export type CashFlowPeriod = "mes" | "3m" | "6m" | "1a";

export function periodStart(period: CashFlowPeriod, now = new Date()) {
  if (period === "mes") return new Date(now.getFullYear(), now.getMonth(), 1);
  const months = period === "3m" ? 3 : period === "6m" ? 6 : 12;
  return new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
}

export function sumFlow(entries: CashFlowEntry[]) {
  let entradas = 0;
  let saidas = 0;
  for (const e of entries) {
    if (e.kind === "entrada") entradas += e.amount;
    else saidas += e.amount;
  }
  return { entradas, saidas, net: entradas - saidas };
}
