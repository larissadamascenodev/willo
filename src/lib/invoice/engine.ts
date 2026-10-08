import { CHARGE_CATEGORIES, classify, normalize } from "./classify";
import { reconciles, sumCents, type Cents } from "./money";
import type {
  ExtractedEvent,
  FinancialOperation,
  FutureInvoiceProjection,
  ImportAlert,
  Installment,
  InvoiceImportResult,
  InvoicePayment,
  InvoiceRawEvent,
  InvoiceSummary,
} from "./types";

/**
 * The reconciliation engine.
 *
 * It takes what a reader found and works out what actually happened: which lines belong to
 * the same operation, which instalments are behind us and which are still owed, what was
 * paid as opposed to spent, and whether the result agrees with the figures the bank
 * printed. It never edits a number to make something balance. A difference is reported.
 *
 * Pure: no database, no network, no clock. That is what makes it testable, and every rule
 * here was learned from a statement that broke the previous one.
 */

export interface ReconcileInput {
  events: ExtractedEvent[];
  summary: InvoiceSummary;
  /** The invoice being imported, as a month index (year * 12 + month, zero-based month). */
  invoicePeriod: number;
}

const PREFIXES = [
  /^antecipad[ao]s?\s*[-–:]?\s*/i,
  /^(estorno|credito|crédito|devolucao|devolução|cancelamento)\s+(de|da|do)\s+/i,
  /^desconto\s+(de\s+)?antecipa(cao|ção)\s*(de\s+pagamento\s+de\s+pix)?\s*/i,
];

/** The merchant behind a line, with whatever the statement put in front of it removed. */
export function merchantKey(description: string): string {
  let text = description.trim();
  for (const p of PREFIXES) text = text.replace(p, "");
  return normalize(text).replace(/["']/g, "").replace(/\s+/g, " ");
}

const sameMoney = (a: Cents, b: Cents) => Math.abs(Math.abs(a) - Math.abs(b)) <= 2;

export function reconcileInvoice(input: ReconcileInput): InvoiceImportResult {
  const { summary, invoicePeriod } = input;
  const alerts: ImportAlert[] = [];

  // ── Layer 1: every line, classified, nothing thrown away ──
  const rawEvents: InvoiceRawEvent[] = input.events.map((e, i) => {
    const { category, confidence } = classify(e);
    return { ...e, id: e.id || `ev_${i + 1}`, category, confidence, operationId: null };
  });

  // ── Payments are not operations and never expenses ──
  const payments: InvoicePayment[] = rawEvents
    .filter((e) => e.category === "INVOICE_PAYMENT")
    .map((e) => ({ id: `pay_${e.id}`, date: e.date, amount: Math.abs(e.amount), eventIds: [e.id] }));

  // ── Layer 2: group the lines that describe one operation ──
  const operations: FinancialOperation[] = [];
  const installments: Installment[] = [];
  const claimed = new Set<string>(payments.flatMap((p) => p.eventIds));

  const plans = rawEvents.filter(
    (e) =>
      !claimed.has(e.id) &&
      e.amount > 0 &&
      !!e.installmentTotal &&
      e.installmentTotal > 1 &&
      !!e.installmentNumber &&
      e.category !== "ANTICIPATION",
  );

  for (const plan of plans) {
    const key = merchantKey(plan.description);
    const total = plan.installmentTotal!;
    const current = plan.installmentNumber!;
    const operationId = `op_${operations.length + 1}`;

    const sameMerchant = rawEvents.filter(
      (e) => e.id !== plan.id && !claimed.has(e.id) && merchantKey(e.description) === key,
    );

    // The amount has to match for these two: a shop can have several plans running, and
    // attaching an anticipation to the wrong one would cancel instalments still owed.
    const anticipated = sameMerchant
      .filter(
        (e) =>
          e.category === "ANTICIPATION" &&
          e.installmentTotal === total &&
          sameMoney(e.amount, plan.amount),
      )
      .map((e) => ({ event: e, n: e.installmentNumber ?? 0 }))
      .filter((a) => a.n > 0);

    // A reversal of the same size on a plan's FIRST instalment undoes the purchase. Later
    // on, a credit of one instalment's size is a refund of that instalment, not the lot.
    const reversal =
      current === 1
        ? sameMerchant.find((e) => e.category === "REFUND" && e.amount < 0 && sameMoney(e.amount, plan.amount))
        : undefined;

    // A discount is deliberately NOT matched on amount: it is a few reais off an
    // instalment, so it never looks like one.
    const discounts = sameMerchant.filter((e) => e.category === "ANTICIPATION_DISCOUNT");
    const discountTotal = sumCents(discounts.map((d) => Math.abs(d.amount)));

    const eventIds = [plan.id, ...anticipated.map((a) => a.event.id)];
    if (reversal) eventIds.push(reversal.id);
    for (const id of eventIds) claimed.add(id);

    const anticipatedNumbers = new Set(anticipated.map((a) => a.n));
    const cancelled = !!reversal;

    // Behind us: never recreated, never charged again, but recorded so the plan is whole.
    for (let n = 1; n < current; n++) {
      installments.push({
        operationId,
        installmentNumber: n,
        totalInstallments: total,
        amount: plan.amount,
        periodIndex: null,
        status: "HISTORICAL",
      });
    }

    installments.push({
      operationId,
      installmentNumber: current,
      totalInstallments: total,
      amount: plan.amount,
      periodIndex: invoicePeriod,
      status: cancelled ? "REFUNDED" : "CURRENT",
    });

    for (const a of anticipated) {
      installments.push({
        operationId,
        installmentNumber: a.n,
        totalInstallments: total,
        amount: plan.amount,
        periodIndex: invoicePeriod,
        status: "ANTICIPATED",
        discount: discountTotal || undefined,
      });
    }

    // What is left, billed in consecutive months from the next invoice. An anticipated
    // instalment is gone from the future: it was charged here.
    let offset = 1;
    if (!cancelled) {
      for (let n = current + 1; n <= total; n++) {
        if (anticipatedNumbers.has(n)) continue;
        installments.push({
          operationId,
          installmentNumber: n,
          totalInstallments: total,
          amount: plan.amount,
          periodIndex: invoicePeriod + offset,
          status: "FUTURE",
        });
        offset += 1;
      }
    } else {
      for (let n = current + 1; n <= total; n++) {
        installments.push({
          operationId,
          installmentNumber: n,
          totalInstallments: total,
          amount: plan.amount,
          periodIndex: null,
          status: "CANCELLED",
        });
      }
    }

    const remaining = installments.filter(
      (i) => i.operationId === operationId && i.status === "FUTURE",
    ).length;

    const chargedNow = cancelled
      ? 0
      : plan.amount * (1 + anticipated.length) - discountTotal;

    operations.push({
      id: operationId,
      kind: plan.category === "PIX_ON_CREDIT" ? "PIX_ON_CREDIT" : "PURCHASE",
      description: plan.description,
      eventIds: [...eventIds, ...discounts.map((d) => d.id)],
      amountThisInvoice: chargedNow,
      financing: plan.financing ?? null,
      installmentCount: total,
      currentInstallment: current,
      remainingInstallments: remaining,
      anticipationDiscount: discountTotal || null,
      status: cancelled ? "REFUNDED" : remaining === 0 ? "COMPLETED" : anticipated.length ? "ACTIVE" : "ACTIVE",
      confidence: plan.confidence,
    });

    for (const d of discounts) claimed.add(d.id);
  }

  // ── Everything that was not part of a plan: single purchases, charges, credits ──
  for (const e of rawEvents) {
    if (claimed.has(e.id)) continue;
    claimed.add(e.id);

    const kind: FinancialOperation["kind"] =
      e.category === "PIX_ON_CREDIT"
        ? "PIX_ON_CREDIT"
        : e.amount < 0
          ? "CREDIT"
          : CHARGE_CATEGORIES.includes(e.category) && e.category !== "PURCHASE"
            ? "CHARGE"
            : "PURCHASE";

    // A balance marker is kept, with its text and its amount, but it moves nothing: the
    // statement prints it alongside the credit that cancels it, and the pair is not a
    // charge. Counting it turns one debt into two, and counting only the half that was
    // read turns it into a phantom.
    const movesMoney = e.category !== "DEBT_SETTLEMENT";

    operations.push({
      id: `op_${operations.length + 1}`,
      kind,
      description: e.description,
      eventIds: [e.id],
      amountThisInvoice: movesMoney ? e.amount : 0,
      financing: e.financing ?? null,
      installmentCount: null,
      currentInstallment: null,
      remainingInstallments: 0,
      anticipationDiscount: null,
      status: "COMPLETED",
      confidence: e.confidence,
    });
  }

  for (const op of operations) for (const id of op.eventIds) {
    const ev = rawEvents.find((e) => e.id === id);
    if (ev) ev.operationId = op.id;
  }

  // ── Layer 3: what the card is worth ──
  const movementThisInvoice = sumCents(operations.map((o) => o.amountThisInvoice));

  // An invoice is not just the period. It opens with what was left of the last one and
  // what was paid against it, and only then adds the month. Leaving that out is why an
  // overpaid statement reads as though the reading had counted things twice.
  const carry = (summary.previousInvoice ?? 0) + (summary.paymentsReceived ?? 0);
  const calculatedTotal = movementThisInvoice + carry;

  const officialTotal = summary.officialTotal ?? null;
  const difference = officialTotal === null ? null : officialTotal - calculatedTotal;
  const reconciliation = {
    officialTotal,
    calculatedTotal,
    difference,
    status:
      officialTotal === null
        ? ("UNKNOWN" as const)
        : reconciles(calculatedTotal, officialTotal)
          ? ("RECONCILED" as const)
          : ("DISCREPANCY" as const),
  };

  // ── What the limit is carrying: this invoice plus everything still ahead ──
  const futureInstallments = installments.filter((i) => i.status === "FUTURE");
  const calculatedUsed = calculatedTotal + sumCents(futureInstallments.map((i) => i.amount));
  const officialUsed = summary.usedCreditLimit ?? null;
  const limitDifference = officialUsed === null ? null : officialUsed - calculatedUsed;

  const limitReconciliation = {
    officialUsed,
    calculatedUsed,
    officialAvailable: summary.availableCreditLimit ?? null,
    calculatedAvailable:
      summary.totalCreditLimit == null ? null : summary.totalCreditLimit - calculatedUsed,
    difference: limitDifference,
    status:
      officialUsed === null
        ? ("UNKNOWN" as const)
        : reconciles(calculatedUsed, officialUsed)
          ? ("RECONCILED" as const)
          : ("DISCREPANCY" as const),
  };

  // ── Projection ──
  const byPeriod = new Map<number, Installment[]>();
  for (const i of futureInstallments) {
    const list = byPeriod.get(i.periodIndex!) ?? [];
    list.push(i);
    byPeriod.set(i.periodIndex!, list);
  }
  const projection: FutureInvoiceProjection[] = [...byPeriod.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([periodIndex, list]) => ({
      periodIndex,
      total: sumCents(list.map((i) => i.amount)),
      installments: list,
    }));

  // ── Alerts: say what did not fit, never paper over it ──
  if (officialTotal === null) {
    alerts.push({ code: "MISSING_OFFICIAL_TOTAL", message: "A fatura não trouxe o total a pagar impresso." });
  } else if (reconciliation.status === "DISCREPANCY") {
    alerts.push({
      code: "OFFICIAL_TOTAL_MISMATCH",
      message: "O total calculado não bate com o impresso na fatura.",
      amount: difference,
    });
  }

  if (limitReconciliation.status === "DISCREPANCY") {
    alerts.push({
      code: "LIMIT_MISMATCH",
      message: "O limite utilizado calculado não bate com o informado pelo banco.",
      amount: limitDifference,
    });
  }

  for (const e of rawEvents) {
    if (e.category !== "ANTICIPATION") continue;
    const op = operations.find((o) => o.eventIds.includes(e.id) && o.installmentCount);
    if (!op) {
      alerts.push({
        code: "UNMATCHED_ANTICIPATION",
        message: `Antecipação sem parcelamento correspondente: ${e.description}`,
        eventIds: [e.id],
        amount: e.amount,
      });
    }
  }

  const lowConfidence = rawEvents.filter((e) => e.confidence === "LOW");
  if (lowConfidence.length > 0) {
    alerts.push({
      code: "LOW_CONFIDENCE_EXTRACTION",
      message: `${lowConfidence.length} linha${lowConfidence.length > 1 ? "s" : ""} com leitura incerta.`,
      eventIds: lowConfidence.map((e) => e.id),
    });
  }

  const seen = new Map<string, string[]>();
  for (const e of rawEvents) {
    const k = [merchantKey(e.description), e.amount, e.date, e.installmentNumber, e.installmentTotal].join("|");
    seen.set(k, [...(seen.get(k) ?? []), e.id]);
  }
  for (const [, ids] of seen) {
    if (ids.length > 1) {
      alerts.push({
        code: "DUPLICATE_TRANSACTION",
        message: "Linhas idênticas: confirme se são duas cobranças de verdade.",
        eventIds: ids,
      });
    }
  }

  return {
    summary,
    rawEvents,
    operations,
    installments,
    payments,
    projection,
    reconciliation,
    limitReconciliation,
    alerts,
  };
}
