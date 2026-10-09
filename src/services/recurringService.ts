import { supabase } from "@/integrations/supabase/client";
import { clearFinanceQueryCache } from "@/services/transactionService";
import { dayOfMonth, parseDateOnly } from "@/lib/dateOnly";

function notifyRecurringChanged() {
  clearFinanceQueryCache();
  import("@/services/dashboardData").then(({ clearDashboardCache }) => {
    clearDashboardCache();
  });
  import("@/lib/financeEngine").then(({ clearMaterializedCache }) => {
    clearMaterializedCache();
  }).catch(() => {});
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("finance-data-changed"));
  }
}
interface RecurringTransactionRow {
  id: string;
  user_id: string;
  name: string;
  type: string;
  category: string;
  amount: number;
  date: string;
  status: string;
  payment_method: string;
  recurrence_type: string;
  account_id: string | null;
  credit_card_id: string | null;
  parent_transaction_id: string | null;
}

export type MonthlyRecurringTransaction = RecurringTransactionRow & {
  _isRecurringMaterialized?: boolean;
};

function getMonthRange(month: number, year: number) {
  const start = new Date(year, month, 1).toISOString().split("T")[0];
  const end = new Date(year, month + 1, 0).toISOString().split("T")[0];
  return { start, end };
}

export function isRecurringSeriesTransaction(transaction: {
  recurrence_type?: string | null;
  parent_transaction_id?: string | null;
}) {
  return transaction.recurrence_type === "fixa"
    || (transaction.recurrence_type === "unica" && !!transaction.parent_transaction_id);
}

export function getRecurringSourceId(transaction: {
  id: string;
  parent_transaction_id?: string | null;
}) {
  return transaction.parent_transaction_id ?? transaction.id;
}

/**
 * What makes two "fixa" rows the same standing commitment.
 *
 * The same commitment gets written down more than once: redefining it later leaves the old
 * row behind, so the newest definition of a signature wins and the rest are ignored.
 *
 * The day of the month is part of it, and leaving it out was a real bug. A salary paid in
 * two parts, on the 6th and the 15th, matches on every other field, so the two collapsed
 * into one and the newer entry silently replaced the older one everywhere. They are two
 * commitments. The full date is deliberately NOT used: the same commitment redefined in a
 * later month still falls on the same day, and must still collapse.
 */
export function recurringSignature(t: {
  name: string;
  type: string;
  category: string;
  amount: number | string;
  payment_method?: string | null;
  account_id?: string | null;
  credit_card_id?: string | null;
  date: string;
}) {
  return [
    t.name,
    t.type,
    t.category,
    Number(t.amount).toFixed(2),
    t.payment_method ?? "",
    t.account_id ?? "",
    t.credit_card_id ?? "",
    dayOfMonth(t.date),
  ].join("::");
}

/**
 * Fetch all "fixa" transactions that should appear in a given month.
 * A fixa transaction appears in every month from its creation date onward,
 * unless there's an exclusion record for that specific month.
 */
export async function getRecurringForMonth(month: number, year: number) {
  const targetDate = new Date(year, month + 1, 0);
  const targetDateStr = targetDate.toISOString().split("T")[0];

  const { data: fixaTxs, error: txError } = await supabase
    .from("transactions")
    .select("*")
    .eq("recurrence_type", "fixa")
    .lte("date", targetDateStr)
    .order("date", { ascending: false });

  if (txError) throw txError;
  if (!fixaTxs || fixaTxs.length === 0) return [];

  const latestBySignature = new Map<string, any>();
  for (const tx of fixaTxs) {
    const key = recurringSignature(tx);
    if (!latestBySignature.has(key)) {
      latestBySignature.set(key, tx);
    }
  }

  const uniqueFixaTxs = Array.from(latestBySignature.values());
  const txIds = uniqueFixaTxs.map((t) => t.id);
  if (txIds.length === 0) return [];

  const { data: exclusions, error: exError } = await supabase
    .from("recurring_exclusions" as any)
    .select("transaction_id")
    .eq("month", month)
    .eq("year", year)
    .in("transaction_id", txIds);

  if (exError) throw exError;

  const excludedIds = new Set((exclusions ?? []).map((e: any) => e.transaction_id));

  return uniqueFixaTxs.filter((t) => {
    if (excludedIds.has(t.id)) return false;
    const origDate = parseDateOnly(t.date);
    if (origDate.month === month && origDate.year === year) return false;
    return true;
  });
}

export async function getRecurringTransactionsForMonth(
  month: number,
  year: number,
  userId: string
): Promise<MonthlyRecurringTransaction[]> {
  const { start, end } = getMonthRange(month, year);
  const dbMonth = month + 1;

  const [txRes, recurringTxs, invoicesRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: false })
      .order("created_at", { ascending: true }),
    getRecurringForMonth(month, year),
    supabase
      .from("invoices")
      .select("credit_card_id, total_amount")
      .eq("user_id", userId)
      .eq("month", dbMonth)
      .eq("year", year),
  ]);

  if (txRes.error) throw txRes.error;
  if (invoicesRes.error) throw invoicesRes.error;

  let baseTxs = ((txRes.data ?? []) as MonthlyRecurringTransaction[])
    .filter((tx) => isRecurringSeriesTransaction(tx));

  const fixaIds = baseTxs
    .filter((tx) => tx.recurrence_type === "fixa")
    .map((tx) => tx.id);

  if (fixaIds.length > 0) {
    const { data: exclusions, error: exclusionsError } = await supabase
      .from("recurring_exclusions")
      .select("transaction_id")
      .eq("month", month)
      .eq("year", year)
      .in("transaction_id", fixaIds);

    if (exclusionsError) throw exclusionsError;

    const excludedIds = new Set((exclusions ?? []).map((item: any) => item.transaction_id));
    baseTxs = baseTxs.filter((tx) => !(tx.recurrence_type === "fixa" && excludedIds.has(tx.id)));
  }

  const cardsWithInvoice = new Set(
    (invoicesRes.data ?? [])
      .filter((invoice: any) => Number(invoice.total_amount) > 0)
      .map((invoice: any) => invoice.credit_card_id)
  );

  const filterCreditCardWithoutInvoice = (tx: MonthlyRecurringTransaction) => {
    if (tx.payment_method === "cartao" && tx.credit_card_id) {
      return cardsWithInvoice.has(tx.credit_card_id);
    }
    return true;
  };

  baseTxs = baseTxs.filter(filterCreditCardWithoutInvoice);

  const materializedRecurring = (recurringTxs as MonthlyRecurringTransaction[])
    .map((tx) => ({
      ...tx,
      date: `${year}-${String(month + 1).padStart(2, "0")}-${String(dayOfMonth(tx.date)).padStart(2, "0")}`,
      status: "pendente",
      _isRecurringMaterialized: true,
    }))
    .filter(filterCreditCardWithoutInvoice);

  const mergedByOccurrence = new Map<string, MonthlyRecurringTransaction>();

  for (const tx of materializedRecurring) {
    mergedByOccurrence.set(`${getRecurringSourceId(tx)}::${tx.date}`, tx);
  }

  for (const tx of baseTxs) {
    mergedByOccurrence.set(`${getRecurringSourceId(tx)}::${tx.date}`, tx);
  }

  return Array.from(mergedByOccurrence.values()).sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Exclude a fixa transaction from a specific month (soft delete).
 */
export async function excludeRecurringForMonth(
  transactionId: string,
  month: number,
  year: number,
  userId: string
) {
  const { error } = await supabase
    .from("recurring_exclusions" as any)
    .upsert({
      transaction_id: transactionId,
      month,
      year,
      user_id: userId,
    }, { onConflict: "transaction_id,month,year" });

  if (error) throw error;
  notifyRecurringChanged();
}

/**
 * Exclude a fixa transaction from a specific month and ALL future months.
 */
export async function excludeRecurringFromMonthOnward(
  transactionId: string,
  fromMonth: number,
  fromYear: number,
  userId: string
) {
  const exclusions: { transaction_id: string; month: number; year: number; user_id: string }[] = [];

  let m = fromMonth;
  let y = fromYear;
  for (let i = 0; i < 60; i++) {
    exclusions.push({
      transaction_id: transactionId,
      month: m,
      year: y,
      user_id: userId,
    });
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }

  const { error } = await supabase
    .from("recurring_exclusions" as any)
    .upsert(exclusions, { onConflict: "transaction_id,month,year" });

  if (error) throw error;
  notifyRecurringChanged();
}
