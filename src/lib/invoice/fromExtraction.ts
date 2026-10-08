import { toCents } from "./money";
import type { ExtractedEvent, InvoiceSummary } from "./types";
import type { ReconcileInput } from "./engine";

/**
 * The seam between a reader and the engine.
 *
 * Whatever reads a statement, today an AI over the whole document and tomorrow a parser
 * written for one bank, hands over the same two things: lines and the figures the bank
 * printed. Nothing below this point knows which bank it came from, which is what keeps the
 * financial rules in one place instead of one copy per institution.
 */

export interface ReaderOutput {
  raw_events?: Array<{
    id?: string;
    date?: string | null;
    description: string;
    amount: number;
    installment_current?: number | null;
    installment_total?: number | null;
    financing?: {
      principal: number;
      iof: number;
      interest: number;
      financed_total: number;
      installment_count: number;
      installment_amount: number;
    } | null;
  }>;
  summary?: {
    total_a_pagar?: number | null;
    total_compras?: number | null;
    fatura_anterior?: number | null;
    pagamentos?: number | null;
    outros_lancamentos?: number | null;
    fechamento_proxima_fatura?: number | null;
    saldo_aberto_total?: number | null;
    limite_total?: number | null;
    limite_utilizado?: number | null;
  } | null;
}

/** Reais to centavos, keeping null as null rather than turning a missing figure into zero. */
const cents = (v: number | null | undefined) =>
  v === null || v === undefined || !Number.isFinite(v) ? null : toCents(v);

export function toReconcileInput(reader: ReaderOutput, invoicePeriod: number): ReconcileInput {
  const s = reader.summary ?? {};

  const summary: InvoiceSummary = {
    officialTotal: cents(s.total_a_pagar),
    purchases: cents(s.total_compras),
    previousInvoice: cents(s.fatura_anterior),
    paymentsReceived: cents(s.pagamentos),
    otherPostings: cents(s.outros_lancamentos),
    nextInvoiceClosing: cents(s.fechamento_proxima_fatura),
    totalFutureOpenBalance: cents(s.saldo_aberto_total),
    totalCreditLimit: cents(s.limite_total),
    usedCreditLimit: cents(s.limite_utilizado),
    availableCreditLimit:
      s.limite_total != null && s.limite_utilizado != null
        ? toCents(s.limite_total - s.limite_utilizado)
        : null,
  };

  const events: ExtractedEvent[] = (reader.raw_events ?? []).map((e, i) => ({
    id: e.id || `ev_${i + 1}`,
    date: e.date ?? null,
    description: e.description,
    amount: toCents(e.amount),
    installmentNumber: e.installment_current ?? null,
    installmentTotal: e.installment_total ?? null,
    financing: e.financing
      ? {
          principal: toCents(e.financing.principal),
          iof: toCents(e.financing.iof),
          interest: toCents(e.financing.interest),
          financedTotal: toCents(e.financing.financed_total),
          installmentCount: e.financing.installment_count,
          installmentAmount: toCents(e.financing.installment_amount),
        }
      : null,
  }));

  return { events, summary, invoicePeriod };
}
