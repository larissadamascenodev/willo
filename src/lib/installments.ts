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

/** The first day of the invoice being imported, for lines that certainly belong to it. */
export const invoiceAnchorDate = (invoicePeriod: number) => firstOfPeriod(invoicePeriod);

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

type PlanItem = {
  description: string;
  amount: number;
  installment_total?: number | null;
  installment_current?: number | null;
};

/** One transaction the import should write, and how the card triggers should bill it. */
export type ImportRow<T> = {
  item: T;
  installments: number | null;
  installmentCurrent: number | null;
  paidInstallments: number;
  /** A continuation resumes the month AFTER this invoice, not on it. */
  startsNextMonth: boolean;
  /**
   * Bill this on the invoice being imported, whatever date the line carries. Beside an
   * instalment the statement prints the day that instalment was billed, and a purchase on
   * the closing day itself falls either side of the boundary, so the printed date puts the
   * charge in the wrong month.
   */
  pinToInvoice: boolean;
};

/**
 * What to write for each line of a statement.
 *
 * "Antecipada - Loja X - Parcela 9/12" names exactly one instalment the bank pulled forward
 * and billed here. It is not a statement that everything from the ninth onwards was settled:
 * on a 12x plan where only the ninth was prepaid, the tenth, eleventh and twelfth are still
 * owed. Ending the plan at the eighth, as this used to, charged the right amount this month
 * and then silently dropped three instalments.
 *
 * So a plan with prepaid lines becomes: this month's instalment and each prepaid one as
 * single charges on this invoice, plus one plan carrying whatever is left, resuming the
 * month after. When the prepaid lines run to the end of the plan there is nothing left and
 * no continuation is written.
 *
 * The amount has to match as well as the merchant and the length: two plans can share a
 * shop, and truncating the wrong one would quietly delete charges that are still owed.
 */
export function planImportRows<T extends PlanItem>(items: T[]): ImportRow<T>[] {
  const prepaidFor = (item: T): number[] => {
    const key = planKeyOf(item.description, item.installment_total);
    return items
      .filter(
        (other) =>
          other !== item &&
          isPrepaidLine(other.description) &&
          planKeyOf(other.description, other.installment_total) === key &&
          Math.abs(other.amount - item.amount) <= 0.01,
      )
      .map((other) => other.installment_current ?? 0)
      .filter((n) => n > 0);
  };

  const rows: ImportRow<T>[] = [];

  for (const item of items) {
    const single: ImportRow<T> = {
      item,
      installments: null,
      installmentCurrent: null,
      paidInstallments: 0,
      startsNextMonth: false,
      pinToInvoice: isPrepaidLine(item.description),
    };

    const total = item.installment_total ?? 0;
    const current = item.installment_current ?? 0;
    const isPlan = item.amount > 0 && total > 1 && current >= 1 && current <= total;

    // A refund, a one-off, or a prepaid line: one charge on this invoice and nothing after.
    if (!isPlan || isPrepaidLine(item.description)) {
      rows.push(single);
      continue;
    }

    const prepaid = prepaidFor(item);
    if (prepaid.length === 0) {
      rows.push({
        item,
        installments: total,
        installmentCurrent: current,
        paidInstallments: current - 1,
        startsNextMonth: false,
        pinToInvoice: false,
      });
      continue;
    }

    // This month's instalment stands on its own, because the instalments the bank pulled
    // forward sit between it and the rest, and a plan can only bill consecutive months.
    rows.push({ ...single, pinToInvoice: true });

    const resumeAt = Math.max(...prepaid) + 1;
    if (resumeAt <= total) {
      rows.push({
        item,
        installments: total,
        installmentCurrent: resumeAt,
        paidInstallments: resumeAt - 1,
        startsNextMonth: true,
        pinToInvoice: false,
      });
    }
  }

  return rows;
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
