/**
 * What is in an invoice, decided once.
 *
 * Seven screens read invoice_items straight from the table today and each decides for
 * itself what a line is, how to order them and what the totals mean. That is why a fix
 * on one screen does not hold: the next screen still has the old rules, and the one
 * after that has a third set. This module is the answer to "what is in this invoice",
 * and it is a pure function so it can be tested — which is the only way the answers
 * stop drifting apart again.
 *
 * It does not query anything. The caller brings the rows; this decides what they mean.
 */

/** What a line is, in the words a cardholder would use. */
export type LineKind =
  /** One purchase, charged once. */
  | "avista"
  /** One instalment of a plan. */
  | "parcelado"
  /** Money coming back: a refund, a credit, a reversal. */
  | "estorno"
  /** An instalment brought forward and charged early. */
  | "antecipacao";

export interface RawInvoiceItem {
  id: string;
  transaction_id: string;
  amount: number;
  installment_number: number | null;
  total_installments: number | null;
  transaction_name: string;
  transaction_category: string;
  transaction_date: string;
  /** Used only to break ties between lines bought on the same day. */
  created_at?: string | null;
}

export interface InvoiceLine {
  id: string;
  transactionId: string;
  name: string;
  category: string;
  /** yyyy-mm-dd. */
  date: string;
  /** Signed, as the card sees it: negative is money coming back. */
  amount: number;
  kind: LineKind;
  /** Present only when the line is part of a plan. */
  installment?: { current: number; total: number };
}

export interface InvoiceRead {
  /** Newest first, which is the order a statement is read in. */
  lines: InvoiceLine[];
  /** What was spent, before anything came back. */
  charges: number;
  /** What came back, as a positive number. */
  refunds: number;
  /** charges − refunds. What the invoice actually asks for. */
  total: number;
  counts: Record<LineKind, number>;
}

/** Matched on the name, which is where a statement says it. */
const ANTICIPATION = /\bantecipa/i;

const round = (v: number) => Math.round(v * 100) / 100;

function classify(item: RawInvoiceItem): LineKind {
  // Money coming back is money coming back, whatever the line is called. This is
  // decided first so a refund of an instalment does not read as an instalment.
  if (item.amount < 0) return "estorno";
  if (ANTICIPATION.test(item.transaction_name)) return "antecipacao";
  if ((item.total_installments ?? 1) > 1) return "parcelado";
  return "avista";
}

/**
 * Newest first. The purchase date is what the person recognises; the write order is an
 * accident of how the rows got here — an import writes a whole statement in one second,
 * so ordering by it sorts a month of spending by nothing at all.
 */
function byNewest(a: InvoiceLine & { seq?: string }, b: InvoiceLine & { seq?: string }) {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return (b.seq ?? "").localeCompare(a.seq ?? "");
}

export function readInvoice(items: RawInvoiceItem[]): InvoiceRead {
  const lines = items
    .map((item) => {
      const kind = classify(item);
      const total = item.total_installments ?? 1;
      const line: InvoiceLine & { seq?: string } = {
        id: item.id,
        transactionId: item.transaction_id,
        name: item.transaction_name,
        category: item.transaction_category,
        date: item.transaction_date,
        amount: round(item.amount),
        kind,
        seq: item.created_at ?? undefined,
      };
      if (total > 1) {
        line.installment = { current: item.installment_number ?? 1, total };
      }
      return line;
    })
    .sort(byNewest)
    .map(({ seq: _seq, ...line }) => line);

  let charges = 0;
  let refunds = 0;
  const counts: Record<LineKind, number> = {
    avista: 0,
    parcelado: 0,
    estorno: 0,
    antecipacao: 0,
  };

  for (const line of lines) {
    counts[line.kind] += 1;
    if (line.amount < 0) refunds += -line.amount;
    else charges += line.amount;
  }

  return {
    lines,
    charges: round(charges),
    refunds: round(refunds),
    total: round(charges - refunds),
    counts,
  };
}
