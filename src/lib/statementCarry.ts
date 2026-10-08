import type { ExtractedItem } from "@/components/fatura/InvoiceUploadReviewModal";

/**
 * The balance a statement brings in from the month before.
 *
 * An invoice is not just the month's purchases. It starts from what was left of the last
 * one and subtracts what was paid against it, and only then adds the period. Importing the
 * purchases alone leaves that opening balance out, so the invoice reads as the full period
 * while the statement asks for less, and the card's used limit climbs past the limit itself.
 *
 * On the statement that showed this up: purchases of R$ 2.137,81, a previous bill of
 * R$ 1.557,53 paid with R$ 2.701,23. The R$ 1.164,39 overpaid is why the bank asked for
 * R$ 973,44 and not R$ 2.137,81, and the app had no idea it existed.
 *
 * It comes in as a visible line rather than a silent adjustment: it shows up in the review
 * like any other, and can be unchecked, which is what you want when the previous statement
 * was imported too and its balance is already on the books.
 */
export function statementCarryLine(
  carriedOver: number | null | undefined,
  invoiceDate: string,
): ExtractedItem | null {
  const value = Number(carriedOver);
  if (!Number.isFinite(value) || Math.abs(value) < 0.5) return null;

  const isCredit = value < 0;
  return {
    description: isCredit ? "Crédito da fatura anterior" : "Saldo da fatura anterior",
    amount: Math.round(value * 100) / 100,
    is_refund: isCredit,
    date: invoiceDate,
    installment_current: null,
    installment_total: null,
    category: "Outros",
    type: "despesa",
    confidence: 1,
    selected: true,
    is_carry: true,
  };
}
