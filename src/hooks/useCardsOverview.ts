import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface OverviewCard {
  id: string;
  name: string;
  limit: number;
  used: number;
  closingDay: number;
  dueDay: number;
  color: string | null;
  lastFour: string | null;
}

export interface OverviewInvoice {
  id: string;
  cardId: string;
  month: number; // 1-12
  year: number;
  total: number;
  paid: number;
  isPaid: boolean;
}

export interface OverviewInstallment {
  id: string;
  groupId: string;
  name: string;
  category: string;
  cardId: string;
  amount: number;
  number: number;
  total: number;
  month: number; // 1-12 (invoice month)
  year: number;
}

let cache: { userId: string; cards: OverviewCard[]; invoices: OverviewInvoice[]; installments: OverviewInstallment[]; t: number } | null = null;
const CACHE_TTL = 120_000;

/** Credit cards with their invoices and card installments, from 3 months back to 12 months ahead. */
export function useCardsOverview() {
  const { user } = useAuth();
  const fresh = cache && user && cache.userId === user.id ? cache : null;
  const [cards, setCards] = useState<OverviewCard[]>(fresh?.cards ?? []);
  const [invoices, setInvoices] = useState<OverviewInvoice[]>(fresh?.invoices ?? []);
  const [installments, setInstallments] = useState<OverviewInstallment[]>(fresh?.installments ?? []);
  const [loading, setLoading] = useState(!fresh);

  const load = useCallback(async () => {
    if (!user) return;
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const fromYear = from.getFullYear();

    const [{ data: cardRows }, { data: invoiceRows }, { data: itemRows }] = await Promise.all([
      supabase.from("credit_cards").select("*").eq("user_id", user.id).order("created_at"),
      supabase.from("invoices").select("id, credit_card_id, month, year, total_amount, paid_amount, is_paid").eq("user_id", user.id).gte("year", fromYear),
      supabase
        .from("invoice_items")
        .select("id, amount, installment_number, total_installments, transaction_id, invoices!inner(user_id, month, year, credit_card_id), transactions!inner(name, category, parent_transaction_id)")
        .eq("invoices.user_id", user.id)
        .gt("total_installments", 1)
        .gte("invoices.year", fromYear),
    ]);

    const nextCards: OverviewCard[] = (cardRows ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      limit: Number(c.limit ?? 0),
      used: Number(c.used_limit ?? 0),
      closingDay: c.closing_day ?? 1,
      dueDay: c.due_day ?? 10,
      color: c.color,
      lastFour: c.last_four_digits,
    }));
    const nextInvoices: OverviewInvoice[] = (invoiceRows ?? []).map((inv) => ({
      id: inv.id,
      cardId: inv.credit_card_id,
      month: inv.month,
      year: inv.year,
      total: Number(inv.total_amount ?? 0),
      paid: Number(inv.paid_amount ?? 0),
      isPaid: !!inv.is_paid,
    }));
    const nextInstallments: OverviewInstallment[] = ((itemRows ?? []) as Array<{
      id: string; amount: number; installment_number: number | null; total_installments: number | null; transaction_id: string;
      invoices: { month: number; year: number; credit_card_id: string };
      transactions: { name: string; category: string; parent_transaction_id: string | null };
    }>).map((it) => ({
      id: it.id,
      groupId: it.transactions.parent_transaction_id ?? it.transaction_id,
      name: it.transactions.name,
      category: it.transactions.category,
      cardId: it.invoices.credit_card_id,
      amount: Number(it.amount),
      number: it.installment_number ?? 1,
      total: it.total_installments ?? 1,
      month: it.invoices.month,
      year: it.invoices.year,
    }));

    cache = { userId: user.id, cards: nextCards, invoices: nextInvoices, installments: nextInstallments, t: Date.now() };
    setCards(nextCards);
    setInvoices(nextInvoices);
    setInstallments(nextInstallments);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    if (!cache || cache.userId !== user.id || Date.now() - cache.t >= CACHE_TTL) void load();
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

  /** Drops the shared cache and refetches — for after a card is created or removed. */
  const refresh = useCallback(async () => {
    cache = null;
    await load();
  }, [load]);

  return { cards, invoices, installments, loading, refresh };
}

export const CARD_HEX: Record<string, string> = {
  violet: "#8B5CF6", emerald: "#10B981", sky: "#0EA5E9", amber: "#F59E0B", rose: "#F43F5E",
  cyan: "#06B6D4", fuchsia: "#D946EF", lime: "#84CC16", purple: "#8A05BE", orange: "#F97316",
};
export const cardHex = (color: string | null) => CARD_HEX[color ?? ""] ?? "#8B5CF6";

export const monthKey = (year: number, month: number) => year * 12 + (month - 1);

/** Due date of a card's invoice for a given invoice month (1-12). */
export function invoiceDueDate(card: OverviewCard, year: number, month: number) {
  const lastDay = new Date(year, month, 0).getDate();
  return new Date(year, month - 1, Math.min(card.dueDay, lastDay));
}
