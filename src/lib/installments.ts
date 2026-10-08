import { parseDateOnly } from "@/lib/dateOnly";

/** Marker written when a plan is taken over mid-way ("4/10" read off a statement). */
export function paidInstallmentsOf(observation?: string | null): number {
  const match = /^paid_installments:(\d+)/.exec(observation ?? "");
  return match ? Number(match[1]) : 0;
}

/** Which invoice a purchase lands in, as a month index — mirrors get_invoice_period in the database. */
export function invoicePeriodIndex(dateStr: string, closingDay: number): number {
  const { year, month, day } = parseDateOnly(dateStr);
  return year * 12 + month + (day > closingDay ? 1 : 0);
}

const firstOfPeriod = (index: number) =>
  `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}-01`;

/**
 * When a purchase was made.
 *
 * For a plan already under way this must be worked out, never taken from the line. A
 * statement prints, beside "Parcela 4/6", the date on which THAT instalment was billed,
 * not the date of the purchase six months ago. Keeping it and then telling the triggers
 * to skip three instalments moves the whole plan three months into the future: the
 * instalment due on the invoice being imported lands in a month that has not happened,
 * and the invoice it belongs to comes out short.
 *
 * So the anchor is derived: step back from the invoice being imported by the number of
 * instalments already charged, and instalment #1 lands where it must for #4 to fall
 * here. The printed date is kept as a note on the transaction instead.
 */
export function anchorPurchaseDate(
  item: { date?: string | null; installment_current?: number | null },
  invoicePeriod: number,
  paidInstallments: number,
  _closingDay: number,
): string {
  if (paidInstallments > 0) return firstOfPeriod(invoicePeriod - paidInstallments);
  if (item.date && /^\d{4}-\d{2}-\d{2}$/.test(item.date)) return item.date;
  return firstOfPeriod(invoicePeriod);
}

/** "Antecipada - Shopee" and the like: an instalment the bank pulled forward and billed now. */
const PREPAID_PREFIX = /^antecipad[ao]s?\s*[-–:]?\s*/i;

export const isPrepaidLine = (description: string) => PREPAID_PREFIX.test(description.trim());

export const planKeyOf = (description: string, total: number | null | undefined) =>
  `${description.trim().replace(PREPAID_PREFIX, "").toLowerCase()}|${total ?? 0}`;

/**
 * How many instalments a plan still has ahead of it, once the statement's own "Antecipada"
 * lines are taken into account.
 *
 * Those lines are instalments the bank pulled forward and charged on THIS invoice. Read on
 * their own they look like fresh plans, so the plan they came from keeps generating the very
 * instalments that were just prepaid, and each one gets billed twice. Capping the plan at the
 * instalment below the earliest prepaid one ends it where it actually ended.
 *
 * The amount has to match too: two plans can share a merchant and a length, and truncating
 * the wrong one would quietly delete charges that are still owed.
 */
export function effectivePlanLength<T extends {
  description: string;
  amount: number;
  installment_total?: number | null;
  installment_current?: number | null;
}>(item: T, all: T[]): number | null {
  const total = item.installment_total ?? null;
  if (!total || total < 2 || isPrepaidLine(item.description)) return total;

  const key = planKeyOf(item.description, total);
  let earliestPrepaid: number | null = null;
  for (const other of all) {
    if (other === item || !isPrepaidLine(other.description)) continue;
    if (planKeyOf(other.description, other.installment_total) !== key) continue;
    if (Math.abs(other.amount - item.amount) > 0.01) continue;
    const n = other.installment_current ?? 0;
    if (n > 0 && (earliestPrepaid === null || n < earliestPrepaid)) earliestPrepaid = n;
  }

  if (earliestPrepaid === null) return total;
  return Math.max(earliestPrepaid - 1, item.installment_current ?? 1);
}

/**
 * An in-progress plan is anchored back at instalment #1 so the card triggers bill the
 * remaining ones in the right invoices. The instalments paid before the user started
 * tracking were never charged here, so the purchase must stay out of those months.
 */
export function chargeStartsAfterMonth(
  tx: { date: string; observation?: string | null },
  month: number,
  year: number,
): boolean {
  const paid = paidInstallmentsOf(tx.observation);
  if (paid === 0) return false;
  const anchor = parseDateOnly(tx.date);
  return year * 12 + month < anchor.year * 12 + anchor.month + paid;
}
