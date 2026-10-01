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
 * When a purchase was made. The statement prints it, so that is what we keep — the database
 * works out which invoice it belongs to from the date itself, and for a plan the purchase
 * date is already instalment #1, which is exactly what the triggers anchor on.
 *
 * Only a line with no date at all needs one invented, and then it is anchored back from the
 * invoice being imported by however many instalments were already paid.
 */
export function anchorPurchaseDate(
  item: { date?: string | null; installment_current?: number | null },
  invoicePeriod: number,
  paidInstallments: number,
  _closingDay: number,
): string {
  if (item.date && /^\d{4}-\d{2}-\d{2}$/.test(item.date)) return item.date;
  return firstOfPeriod(invoicePeriod - paidInstallments);
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
