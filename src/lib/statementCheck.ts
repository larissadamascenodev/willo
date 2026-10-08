import { anchorPurchaseDate, invoiceAnchorDate, planImportRows } from "@/lib/installments";
import { parseDateOnly } from "@/lib/dateOnly";

/**
 * What an import is about to do to every month, worked out before anything is written.
 *
 * A reading can land the current invoice and still be wrong about what is owed later: an
 * instalment plan read one month short shows up nowhere until the month arrives. A statement
 * prints enough to catch that on the spot, so the review compares three of its own numbers
 * against what the import would produce, and the person sees the gap before confirming
 * rather than discovering it later on a screen that quietly disagrees with the bank.
 */

export type ImportProjection = {
  /** What lands on the invoice being imported. */
  thisInvoice: number;
  /** What lands on the one after it. */
  nextInvoice: number;
  /** Everything not yet billed, this invoice included. */
  outstanding: number;
};

type Item = {
  description: string;
  amount: number;
  installment_total?: number | null;
  installment_current?: number | null;
  date: string | null;
  selected?: boolean;
};

/**
 * Which invoice a date falls in, as a month index, matching the database's own rule: on
 * the closing day the invoice shuts, so the purchase goes to the next one. parseDateOnly
 * counts months from zero, so there is nothing to subtract here.
 */
const periodOf = (dateStr: string, closingDay: number) => {
  const { year, month, day } = parseDateOnly(dateStr);
  return year * 12 + month + (day >= closingDay ? 1 : 0);
};

export function projectImport(
  items: Item[],
  invoicePeriod: number,
  closingDay: number,
): ImportProjection {
  let thisInvoice = 0;
  let nextInvoice = 0;
  let outstanding = 0;

  const add = (period: number, amount: number) => {
    if (period < invoicePeriod) return; // already billed, not owed
    outstanding += amount;
    if (period === invoicePeriod) thisInvoice += amount;
    if (period === invoicePeriod + 1) nextInvoice += amount;
  };

  for (const row of planImportRows(items)) {
    const { item, installments, paidInstallments } = row;
    const date = row.pinToInvoice
      ? invoiceAnchorDate(invoicePeriod)
      : anchorPurchaseDate(item, invoicePeriod + row.periodOffset, paidInstallments, closingDay);
    const base = periodOf(date, closingDay);

    if (installments && installments > 1) {
      for (let n = paidInstallments + 1; n <= installments; n++) add(base + n - 1, item.amount);
    } else {
      add(base, item.amount);
    }
  }

  const round = (v: number) => Math.round(v * 100) / 100;
  return { thisInvoice: round(thisInvoice), nextInvoice: round(nextInvoice), outstanding: round(outstanding) };
}

export type Checkpoint = {
  label: string;
  mine: number;
  printed: number;
  gap: number;
  ok: boolean;
};

/** A centavo either way is the statement's own rounding, not a reading error. */
const TOLERANCE = 0.5;

export function reconcile(
  projection: ImportProjection,
  declared: {
    total?: number | null;
    nextInvoice?: number | null;
    outstanding?: number | null;
  },
): Checkpoint[] {
  const checks: Checkpoint[] = [];
  const push = (label: string, mine: number, printed: number | null | undefined) => {
    if (printed == null || printed === 0) return;
    const gap = Math.round((mine - printed) * 100) / 100;
    checks.push({ label, mine, printed, gap, ok: Math.abs(gap) <= TOLERANCE });
  };

  push("Esta fatura", projection.thisInvoice, declared.total);
  push("Próxima fatura", projection.nextInvoice, declared.nextInvoice);
  push("Total em aberto", projection.outstanding, declared.outstanding);
  return checks;
}
