import { invoiceAnchorDate } from "@/lib/installments";
import { resolveReceiptDate } from "@/lib/receiptDate";
import { toReais } from "./money";
import type { InvoiceImportResult } from "./types";

/**
 * From what the engine decided to what the database stores.
 *
 * The card triggers bill a plan from a purchase date plus a count of instalments already
 * charged, consecutively, one a month. The engine works in instalments with a month each
 * and a status, which is richer: it knows an instalment was anticipated, or refunded, or
 * belongs to a stretch that resumes after a gap. This turns the one into the other, and it
 * is the only place that knows about both.
 *
 * Two rules come out of that mismatch. An instalment billed on the invoice being imported
 * is written as a charge of its own, because a plan can only bill consecutive months and
 * the anticipated ones sit in between. And each unbroken run of what is still owed becomes
 * its own plan, anchored so its first instalment lands in the month the engine chose.
 */

export interface ImportRow {
  description: string;
  /** Reais, signed, as the rest of the app stores money. */
  amount: number;
  date: string;
  category: string | null;
  installments: number | null;
  installmentCurrent: number | null;
  paidInstallments: number;
  /** Which operation it came from, so a written row can be traced back. */
  operationId: string;
}

export function toImportRows(result: InvoiceImportResult, invoicePeriod: number): ImportRow[] {
  const rows: ImportRow[] = [];

  for (const op of result.operations) {
    // A balance marker moves nothing. It is kept in the result for the audit trail, and
    // writing it would invent a debt the statement never charged.
    if (op.amountThisInvoice === 0 && !op.installmentCount) continue;

    const mine = result.installments.filter((i) => i.operationId === op.id);

    if (mine.length === 0) {
      const event = result.rawEvents.find((e) => e.id === op.eventIds[0]);
      rows.push({
        description: op.description,
        amount: toReais(op.amountThisInvoice),
        /* The one date here that comes from the page rather than from the invoice's own
           period, so the one that can carry a year the reader invented. A wrong year is
           silent — the row looks ordinary and lands in an invoice years away, reducing
           nothing and refunding no limit — so it is checked here, where every caller
           passes, rather than at each of the three screens that write these rows. */
        date: event?.date ? resolveReceiptDate(event.date) : invoiceAnchorDate(invoicePeriod),
        category: op.appCategory ?? null,
        installments: null,
        installmentCurrent: null,
        paidInstallments: 0,
        operationId: op.id,
      });
      continue;
    }

    /* The instalment of the month, and the run that follows it, written as one plan.
       They used to be split: the current one as a single row with no instalment numbers
       on it, the future ones as a plan of their own. The future months then said
       "7 de 10" while the month you had just imported — the only one you were looking
       at — said "à vista" for every instalment purchase on the statement.
       Written as one plan anchored so instalment n lands in this invoice, the triggers
       bill n through the end of the run across consecutive months, which is what the
       two halves were doing between them, and the line keeps its identity in the month
       it was read from. */
    const future = mine
      .filter((i) => i.status === "FUTURE" && i.periodIndex !== null)
      .sort((a, b) => a.installmentNumber - b.installmentNumber);

    const current = mine.find((i) => i.periodIndex === invoicePeriod && i.status === "CURRENT");
    if (current) {
      // Only while unbroken: an instalment the bank pulled forward leaves a hole, and a
      // plan written across it would bill a month that was already settled.
      let end = current;
      while (true) {
        const next = future.find(
          (f) =>
            f.installmentNumber === end.installmentNumber + 1 &&
            f.periodIndex === (end === current ? invoicePeriod : end.periodIndex!) + 1,
        );
        if (!next) break;
        future.splice(future.indexOf(next), 1);
        end = next;
      }

      const base = invoicePeriod - (current.installmentNumber - 1);
      rows.push({
        description: op.description,
        amount: toReais(current.amount),
        date: invoiceAnchorDate(base),
        category: op.appCategory ?? null,
        installments: end.installmentNumber,
        installmentCurrent: current.installmentNumber,
        paidInstallments: current.installmentNumber - 1,
        operationId: op.id,
      });
    }

    // Anything the bank pulled forward is its own charge on this invoice, pinned to it
    // rather than dated from the line: a statement prints the day an instalment was
    // billed, and the closing day can put that on the wrong side of the boundary.
    const here = mine.filter(
      (i) => i.periodIndex === invoicePeriod && i.status === "ANTICIPATED",
    );
    for (const inst of here) {
      rows.push({
        description:
          inst.status === "ANTICIPATED" && !/^antecipad/i.test(op.description)
            ? `Antecipada - ${op.description}`
            : op.description,
        amount: toReais(inst.amount),
        date: invoiceAnchorDate(invoicePeriod),
        category: op.appCategory ?? null,
        installments: null,
        installmentCurrent: null,
        paidInstallments: 0,
        operationId: op.id,
      });
    }

    // A discount belongs to the operation, not to a purchase of its own.
    if (op.anticipationDiscount) {
      rows.push({
        description: `Desconto antecipação - ${op.description}`,
        amount: -toReais(op.anticipationDiscount),
        date: invoiceAnchorDate(invoicePeriod),
        category: op.appCategory ?? null,
        installments: null,
        installmentCurrent: null,
        paidInstallments: 0,
        operationId: op.id,
      });
    }

    // Whatever the current run did not absorb: one row per unbroken stretch.
    for (let i = 0; i < future.length; ) {
      let j = i;
      while (
        j + 1 < future.length &&
        future[j + 1].installmentNumber === future[j].installmentNumber + 1 &&
        future[j + 1].periodIndex === future[j].periodIndex! + 1
      ) {
        j += 1;
      }
      const start = future[i];
      const end = future[j];
      // The triggers put instalment n at base + (n - 1), so the base is chosen to land the
      // run's first instalment in the month the engine picked for it.
      const base = start.periodIndex! - (start.installmentNumber - 1);
      rows.push({
        description: op.description,
        amount: toReais(start.amount),
        date: invoiceAnchorDate(base),
        category: op.appCategory ?? null,
        installments: end.installmentNumber,
        installmentCurrent: start.installmentNumber,
        paidInstallments: start.installmentNumber - 1,
        operationId: op.id,
      });
      i = j + 1;
    }
  }

  return rows;
}
