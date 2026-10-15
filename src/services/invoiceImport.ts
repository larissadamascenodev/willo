import { reconcileInvoice } from "@/lib/invoice/engine";
import { toCents } from "@/lib/invoice/money";
import { toImportRows } from "@/lib/invoice/toImportRows";
import type { InvoiceImportResult } from "@/lib/invoice/types";
import { createTransaction } from "@/services/transactionService";
import { applyImportedPayments, type PaymentMatchResult } from "@/services/importedPayments";
import { recordImport } from "@/services/invoiceImports";
import { saveStatementFigures } from "@/services/statementFigures";

/**
 * Importing a statement, in one place.
 *
 * This was written out twice — once in the invoice page, once in the card panel — in
 * two loops that were identical line for line except where they were not, and where
 * they were not was a bug: only one of them applied the payments the statement
 * reported, so importing the same PDF from the other screen left earlier invoices
 * unsettled and the limit they were holding still held.
 *
 * That is the shape of the whole problem in this area. Two copies of a sequence do not
 * stay the same; they drift, and the drift is invisible because both screens look
 * right. So the sequence lives here and the screens only say when to run it.
 *
 * The order matters and is deliberate: the money first, then what it settled, then the
 * record of where it came from, then what the bank printed. The last two are evidence
 * and must never be able to fail the import.
 */

export interface ImportableItem {
  date: string;
  description: string;
  amount: number;
  installment_current?: number | null;
  installment_total?: number | null;
  category?: string | null;
  is_carry?: boolean;
}

export interface StatementFiguresInput {
  cardLimit?: number | null;
  usedLimit?: number | null;
  total?: number | null;
  nextClosing?: number | null;
}

export interface ImportOutcome {
  result: InvoiceImportResult;
  rowCount: number;
  payments: PaymentMatchResult;
}

export async function importStatement(input: {
  userId: string;
  card: { id: string; dueDay: number };
  month: number;
  year: number;
  items: ImportableItem[];
  documentHash?: string | null;
  documentName?: string | null;
  declared?: StatementFiguresInput;
}): Promise<ImportOutcome> {
  const { userId, card, month, year, items } = input;
  const invoicePeriod = year * 12 + (month - 1);

  /* The opening balance arrives as a line of its own that can be unchecked, so when it
     is among the selected lines the summary's own carry figures are left out — or the
     same money is counted twice. */
  const carryIncluded = items.some((i) => i.is_carry);

  const result = reconcileInvoice({
    events: items.map((item, i) => ({
      id: `ev_${i + 1}`,
      date: item.date,
      description: item.description,
      amount: toCents(item.amount),
      installmentNumber: item.installment_current ?? null,
      installmentTotal: item.installment_total ?? null,
      appCategory: item.category ?? undefined,
    })),
    summary: carryIncluded ? {} : { previousInvoice: null, paymentsReceived: null },
    invoicePeriod,
  });

  const rows = toImportRows(result, invoicePeriod);

  for (const row of rows) {
    const isParcelado = !!row.installments && row.installments > 1;
    await createTransaction(
      {
        name: row.description,
        type: "despesa",
        amount: row.amount,
        category: row.category || "Outros",
        date: row.date,
        status: "pago",
        payment_method: "cartao",
        credit_card_id: card.id,
        recurrence_type: isParcelado ? "parcelado" : "unica",
        installments: isParcelado ? row.installments : null,
        installment_current: isParcelado ? row.installmentCurrent : null,
        // The printed date is the instalment's, not the purchase's, so it is not
        // written down as if it were the purchase date.
        observation: row.paidInstallments > 0 ? `paid_installments:${row.paidInstallments}` : null,
      } as never,
      userId,
    );
  }

  /* A payment printed on a statement almost never settles the statement it is printed
     on — it settled the one before. Applied where the app has that invoice, which also
     frees the limit it was holding. */
  const payments = await applyImportedPayments({
    userId,
    cardId: card.id,
    dueDay: card.dueDay,
    invoicePeriod,
    payments: result.payments,
  });

  /* Evidence, after the money. Neither of these may fail the import: a number that
     looks wrong later is better off with an incomplete record behind it than with the
     import having been rolled back for the sake of the record. */
  try {
    await recordImport({
      userId,
      cardId: card.id,
      month,
      year,
      documentHash: input.documentHash ?? null,
      fileName: input.documentName ?? null,
      result,
      rowCount: rows.length,
    } as never);
  } catch {
    /* keep the import */
  }

  try {
    const d = input.declared ?? {};
    await saveStatementFigures(card.id, month, year, {
      totalLimit: d.cardLimit ?? null,
      usedLimit: d.usedLimit ?? null,
      availableLimit:
        d.cardLimit != null && d.usedLimit != null
          ? Math.round((d.cardLimit - d.usedLimit) * 100) / 100
          : null,
      officialTotal: d.total ?? null,
      nextInvoiceClosing: d.nextClosing ?? null,
    });
  } catch {
    /* keep the import */
  }

  window.dispatchEvent(new CustomEvent("transaction-created"));

  return { result, rowCount: rows.length, payments };
}
