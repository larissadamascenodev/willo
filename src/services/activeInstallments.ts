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

export interface InstallmentStats {
  /** What the open instalments take out of a month. */
  totalMensal: number;
  /** Everything still owed across all of them. */
  totalRestante: number;
  /** Months until the last one clears. */
  monthsUntilFree: number;
  lastEndDate: Date;
}

export interface ActiveInstallments {
  items: ActiveInstallmentItem[];
  /** Null when nothing is being paid off. */
  stats: InstallmentStats | null;
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
    supabase.from("credit_cards").select("id, due_day").eq("user_id", userId),
  ]);

  if (transactionsRes.error || invoiceItemsRes.error) {
    return { items: [], stats: null };
  }

  const creditCardDueDays = Object.fromEntries(
    (creditCardsRes.data ?? []).map((card) => [card.id, card.due_day]),
  );

  const items = buildActiveInstallmentItems({
    transactions: (transactionsRes.data ?? []) as InstallmentTransactionRow[],
    invoiceItems: (invoiceItemsRes.data ?? []) as InstallmentInvoiceRow[],
    creditCardDueDays,
  });

  return { items, stats: statsFor(items) };
}

/** The arithmetic over a set of instalments. Exported so a caller holding its own
    list does not have to fetch again. */
export function statsFor(items: ActiveInstallmentItem[]): InstallmentStats | null {
  if (items.length === 0) return null;

  let totalMensal = 0;
  let totalRestante = 0;
  let lastEndDate = new Date();

  items.forEach((item) => {
    const baseDate = new Date(item.date);
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
