import { supabase } from "@/integrations/supabase/client";
import {
  buildActiveInstallmentItems,
  type ActiveInstallmentItem,
  type InstallmentInvoiceRow,
  type InstallmentTransactionRow,
} from "@/lib/installmentProgress";

/**
 * What is still being paid off, and what it costs to be.
 *
 * The four queries and the arithmetic over them answer a question about a person's
 * instalments, not about a card on a screen — how much leaves every month until
 * they are done, how much is left in total, and when the last one clears. So both
 * apps ask it the same way and get the same answer.
 */

/**
 * A purchase's day, read as a day where the person is. "2026-04-01" parsed as is is
 * midnight in UTC — the evening of 31 March in Brazil — which put every plan one month
 * early: the instalment due in November was counted in October.
 */
const purchaseDay = (date: string) => new Date(`${date.slice(0, 10)}T12:00:00`);

export interface InstallmentStats {
  /** What the open instalments take out of a month. */
  totalMensal: number;
  /** Everything still owed across all of them. */
  totalRestante: number;
  /** Months until the last one clears. */
  monthsUntilFree: number;
  lastEndDate: Date;
}

export interface CardBadge {
  name: string;
  color: string | null;
}

export interface ActiveInstallments {
  items: ActiveInstallmentItem[];
  /** Null when nothing is being paid off. */
  stats: InstallmentStats | null;
  /** The card each purchase sits on, for the line under its name. */
  cardsById: Record<string, CardBadge>;
}

export async function loadActiveInstallments(userId: string): Promise<ActiveInstallments> {
  const [transactionsRes, invoiceItemsRes, creditCardsRes] = await Promise.all([
    supabase
      .from("transactions")
      .select(
        "id, name, category, amount, installment_current, installments, payment_method, date, credit_card_id, parent_transaction_id, status, type",
      )
      .eq("user_id", userId)
      .eq("recurrence_type", "parcelado")
      .eq("type", "despesa")
      .not("installments", "is", null),
    supabase
      .from("invoice_items")
      .select(
        "transaction_id, amount, installment_number, total_installments, invoices!inner(is_paid, user_id, month, year), transactions!inner(id, name, category, payment_method, credit_card_id, parent_transaction_id, date, type)",
      )
      .eq("invoices.user_id", userId),
    supabase.from("credit_cards").select("id, due_day, name, color").eq("user_id", userId),
  ]);

  if (transactionsRes.error || invoiceItemsRes.error) {
    return { items: [], stats: null, cardsById: {} };
  }

  const creditCardDueDays = Object.fromEntries(
    (creditCardsRes.data ?? []).map((card) => [card.id, card.due_day]),
  );

  const items = buildActiveInstallmentItems({
    transactions: (transactionsRes.data ?? []) as InstallmentTransactionRow[],
    invoiceItems: (invoiceItemsRes.data ?? []) as InstallmentInvoiceRow[],
    creditCardDueDays,
  });

  const cardsById = Object.fromEntries(
    (creditCardsRes.data ?? []).map((card) => [card.id, { name: card.name, color: card.color }]),
  );

  return { items, stats: statsFor(items), cardsById };
}

/** The arithmetic over a set of instalments. Exported so a caller holding its own
    list does not have to fetch again. */
export function statsFor(items: ActiveInstallmentItem[]): InstallmentStats | null {
  if (items.length === 0) return null;

  let totalMensal = 0;
  let totalRestante = 0;
  let lastEndDate = new Date();

  items.forEach((item) => {
    const baseDate = purchaseDay(item.date);
    const currentInstallment = item.installment_current;
    const unpaidInstallments = item.installments - currentInstallment + 1;

    if (unpaidInstallments > 0) {
      totalMensal += item.amount;
      totalRestante += item.amount * unpaidInstallments;
    }

    const endDate = new Date(baseDate);
    endDate.setMonth(endDate.getMonth() + (item.installments - currentInstallment));
    if (endDate > lastEndDate) lastEndDate = endDate;
  });

  const now = new Date();
  const monthsUntilFree =
    (lastEndDate.getFullYear() - now.getFullYear()) * 12 + (lastEndDate.getMonth() - now.getMonth());

  return {
    totalMensal,
    totalRestante,
    monthsUntilFree: Math.max(monthsUntilFree, 0),
    lastEndDate,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
   The whole picture, for the page that shows nothing but instalments.

   statsFor above answers the one question a dashboard tile asks: what leaves
   every month, and when does it stop. The page asks more — how much of the debt
   is already behind you, how the monthly figure falls as purchases finish, which
   categories it is made of. All of it is arithmetic over the same list, so it
   lives here rather than in either app's copy of the page.
   ──────────────────────────────────────────────────────────────────────────── */

export interface InstallmentTotals extends InstallmentStats {
  /** What has already been paid across every purchase. */
  totalJaPago: number;
  /** What each purchase costs in full, added up. */
  totalGeral: number;
  cardCount: number;
  accountCount: number;
}

export function installmentTotals(items: ActiveInstallmentItem[]): InstallmentTotals | null {
  if (items.length === 0) return null;

  let totalMensal = 0;
  let totalRestante = 0;
  let totalJaPago = 0;
  let totalGeral = 0;
  let lastEndDate = new Date();
  let cardCount = 0;
  let accountCount = 0;

  items.forEach((item) => {
    const paidCount = item.installment_current - 1;
    const unpaidCount = item.installments - paidCount;

    totalGeral += item.amount * item.installments;
    totalJaPago += item.amount * paidCount;

    if (unpaidCount > 0) {
      totalMensal += item.amount;
      totalRestante += item.amount * unpaidCount;
    }

    const baseDate = purchaseDay(item.date);
    const endDate = new Date(baseDate);
    endDate.setMonth(baseDate.getMonth() + (item.installments - 1));
    if (endDate > lastEndDate) lastEndDate = endDate;

    if (item.payment_method === "cartao") cardCount++;
    else accountCount++;
  });

  const now = new Date();
  const monthsUntilFree =
    (lastEndDate.getFullYear() - now.getFullYear()) * 12 + (lastEndDate.getMonth() - now.getMonth());

  return {
    totalMensal,
    totalRestante,
    totalJaPago,
    totalGeral,
    monthsUntilFree: Math.max(monthsUntilFree, 0),
    lastEndDate,
    cardCount,
    accountCount,
  };
}

export interface ProjectionPart {
  id: string;
  name: string;
  category: string;
  amount: number;
  /** Which instalment of the purchase falls in this month. */
  number: number;
  total: number;
}

export interface ProjectionMonth {
  key: string;
  month: number;
  year: number;
  parts: ProjectionPart[];
  value: number;
}

/**
 * What the instalments will take, month by month, until the last one clears.
 *
 * The colour of each part is left to the caller: the browser wants an HSL triplet
 * for a CSS variable and the phone wants a plain hex, and neither belongs in a
 * calculation about money.
 */
export function installmentProjection(
  items: ActiveInstallmentItem[],
  monthsAhead: number,
): ProjectionMonth[] {
  if (items.length === 0) return [];

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const months: ProjectionMonth[] = [];

  for (let offset = 0; offset <= monthsAhead; offset++) {
    let m = currentMonth + offset;
    let y = currentYear;
    while (m > 11) {
      m -= 12;
      y++;
    }

    const parts: ProjectionPart[] = [];
    items.forEach((item) => {
      const baseDate = purchaseDay(item.date);
      const paidCount = item.installment_current - 1;
      /* The month the first unpaid instalment falls in — or this month, for one that is
         running late, so a late instalment is counted now rather than nowhere. */
      const startPeriod = Math.max(
        baseDate.getFullYear() * 12 + baseDate.getMonth() + paidCount,
        currentYear * 12 + currentMonth,
      );
      const monthsDiff = y * 12 + m - startPeriod;
      const remainingInstallments = item.installments - paidCount;
      if (monthsDiff >= 0 && monthsDiff < remainingInstallments) {
        parts.push({
          id: item.id,
          name: item.name,
          category: item.category,
          amount: item.amount,
          number: item.installment_current + monthsDiff,
          total: item.installments,
        });
      }
    });

    months.push({
      key: `${y}-${m}`,
      month: m,
      year: y,
      value: parts.reduce((sum, part) => sum + part.amount, 0),
      parts: parts.sort((pa, pb) => pb.amount - pa.amount),
    });
  }

  return months;
}

/** What the monthly figure is made of, heaviest category first. */
export function installmentByCategory(
  items: ActiveInstallmentItem[],
): { category: string; amount: number }[] {
  const byCategory = new Map<string, number>();
  items.forEach((item) => {
    byCategory.set(item.category, (byCategory.get(item.category) ?? 0) + item.amount);
  });
  return Array.from(byCategory.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}
