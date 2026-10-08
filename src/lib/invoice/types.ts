import type { Cents } from "./money";

/**
 * The shapes the invoice engine works in.
 *
 * Three layers, kept apart on purpose. A raw event is what the document said. An operation
 * is what happened financially, which may take several events to describe. The invoice
 * state is what the card is worth afterwards. Collapsing them is how a line gets counted
 * twice, or a payment gets filed as a purchase.
 */

export type Confidence = "HIGH" | "MEDIUM" | "LOW";

export type EventCategory =
  | "PURCHASE"
  | "INSTALLMENT"
  | "PIX_ON_CREDIT"
  | "INVOICE_PAYMENT"
  | "CREDIT"
  | "REFUND"
  | "ANTICIPATION"
  | "ANTICIPATION_DISCOUNT"
  | "IOF"
  | "INTEREST"
  | "FINE"
  | "DEBT_SETTLEMENT"
  | "OTHER_CHARGE"
  | "OTHER";

/** How a financed operation breaks down, when the statement spells it out. */
export interface Financing {
  principal: Cents;
  iof: Cents;
  interest: Cents;
  financedTotal: Cents;
  installmentCount: number;
  installmentAmount: Cents;
}

/** Layer 1. Exactly what the document said, kept whole so a number can be traced back. */
export interface InvoiceRawEvent {
  id: string;
  date: string | null;
  /** Untouched, as printed. */
  description: string;
  /** Signed: a credit is negative. */
  amount: Cents;
  page?: number | null;
  rawText?: string | null;
  installmentNumber?: number | null;
  installmentTotal?: number | null;
  /** Only when the statement itself breaks the financing down. Never inferred. */
  financing?: Financing | null;
  category: EventCategory;
  confidence: Confidence;
  /** Filled by the aggregator, linking events that describe one operation. */
  operationId?: string | null;
}

/** What the caller hands in, before classification. */
export type ExtractedEvent = Omit<InvoiceRawEvent, "category" | "confidence" | "operationId"> &
  Partial<Pick<InvoiceRawEvent, "category" | "confidence">>;

export type InstallmentStatus =
  | "HISTORICAL"
  | "CURRENT"
  | "FUTURE"
  | "ANTICIPATED"
  | "REFUNDED"
  | "CANCELLED";

export interface Installment {
  operationId: string;
  installmentNumber: number;
  totalInstallments: number;
  amount: Cents;
  /** Which invoice it falls in, as a month index. Null for instalments already behind us. */
  periodIndex: number | null;
  status: InstallmentStatus;
  discount?: Cents;
}

export type OperationKind = "PURCHASE" | "PIX_ON_CREDIT" | "CHARGE" | "CREDIT" | "PAYMENT";

export type OperationStatus = "ACTIVE" | "COMPLETED" | "ANTICIPATED" | "REFUNDED";

/** Layer 2. One financial fact, however many lines the statement used to print it. */
export interface FinancialOperation {
  id: string;
  kind: OperationKind;
  description: string;
  /** Every raw event that belongs to this operation, for the audit trail. */
  eventIds: string[];
  /** What lands on the invoice being imported. */
  amountThisInvoice: Cents;
  financing?: Financing | null;
  installmentCount?: number | null;
  currentInstallment?: number | null;
  remainingInstallments?: number | null;
  anticipationDiscount?: Cents | null;
  status: OperationStatus;
  confidence: Confidence;
}

export interface InvoicePayment {
  id: string;
  date: string | null;
  /** Positive. A payment reduces debt; it is not an expense. */
  amount: Cents;
  eventIds: string[];
}

/** The figures the institution printed. Read, never recomputed. */
export interface InvoiceSummary {
  bank?: string | null;
  referenceMonth?: string | null;
  dueDate?: string | null;
  officialTotal?: Cents | null;
  previousInvoice?: Cents | null;
  paymentsReceived?: Cents | null;
  purchases?: Cents | null;
  internationalIOF?: Cents | null;
  otherPostings?: Cents | null;
  nextInvoiceClosing?: Cents | null;
  totalFutureOpenBalance?: Cents | null;
  totalCreditLimit?: Cents | null;
  usedCreditLimit?: Cents | null;
  availableCreditLimit?: Cents | null;
}

export type ReconciliationStatus = "RECONCILED" | "DISCREPANCY" | "UNKNOWN";

export interface ReconciliationResult {
  officialTotal: Cents | null;
  calculatedTotal: Cents;
  difference: Cents | null;
  status: ReconciliationStatus;
}

export interface LimitReconciliation {
  officialUsed: Cents | null;
  calculatedUsed: Cents;
  officialAvailable: Cents | null;
  calculatedAvailable: Cents | null;
  difference: Cents | null;
  status: ReconciliationStatus;
}

export interface FutureInvoiceProjection {
  periodIndex: number;
  total: Cents;
  installments: Installment[];
}

export type AlertCode =
  | "OFFICIAL_TOTAL_MISMATCH"
  | "LIMIT_MISMATCH"
  | "UNMATCHED_REFUND"
  | "UNMATCHED_ANTICIPATION"
  | "UNMATCHED_PAYMENT"
  | "DUPLICATE_TRANSACTION"
  | "UNRESOLVED_INSTALLMENT"
  | "LOW_CONFIDENCE_EXTRACTION"
  | "UNSUPPORTED_BANK_FORMAT"
  | "MISSING_OFFICIAL_TOTAL";

export interface ImportAlert {
  code: AlertCode;
  message: string;
  /** What it is about, so the person can be taken to it. */
  eventIds?: string[];
  amount?: Cents | null;
}

/** Layer 3, plus everything needed to audit how it was reached. */
export interface InvoiceImportResult {
  summary: InvoiceSummary;
  rawEvents: InvoiceRawEvent[];
  operations: FinancialOperation[];
  installments: Installment[];
  payments: InvoicePayment[];
  projection: FutureInvoiceProjection[];
  reconciliation: ReconciliationResult;
  limitReconciliation: LimitReconciliation;
  alerts: ImportAlert[];
}
