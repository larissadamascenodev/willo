import type { Confidence, EventCategory, ExtractedEvent } from "./types";

/**
 * What a line of a statement is.
 *
 * Deliberately not written for one bank. The vocabulary below is what Brazilian card
 * statements share: pagamento, estorno, antecipada, IOF, juros, multa, encerramento de
 * dívida. A bank-specific reader normalises its own layout into events first; the meaning
 * is decided here, once, for all of them.
 *
 * Order matters. "Estorno de juros da dívida encerrada" is a settlement, not a refund, and
 * "Desconto antecipação" is a discount, not an anticipation, so the narrower patterns are
 * tested before the broader ones.
 */

export const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

type Rule = { category: EventCategory; test: RegExp; confidence?: Confidence };

const RULES: Rule[] = [
  // A payment of the bill. Never an expense, and the single most damaging thing to
  // misfile: as a purchase it doubles the debt instead of clearing it.
  { category: "INVOICE_PAYMENT", test: /^(pagamento|pgto)\b/ },
  { category: "INVOICE_PAYMENT", test: /^pagamentos?\s+(efetuad|recebid|realizad|em\b)/ },

  // Both halves of a settled debt, whichever sign each carries on the day, and the
  // balance markers that go with them. A statement prints a balance and its mirror credit
  // so they cancel; counting them is how one debt becomes two.
  { category: "DEBT_SETTLEMENT", test: /^encerramento\s+de\s+divida/ },
  { category: "DEBT_SETTLEMENT", test: /divida\s+encerrada/ },
  { category: "DEBT_SETTLEMENT", test: /^saldo\s+(em\s+|de\s+)?(atraso|aberto|rotativo|devedor|anterior|financiado)/ },
  { category: "DEBT_SETTLEMENT", test: /^credito\s+de\s+(atraso|rotativo)/ },

  // The discount is read before the anticipation it belongs to, or "Desconto de
  // antecipação" would be filed as an anticipation.
  { category: "ANTICIPATION_DISCOUNT", test: /^desconto\s+(de\s+)?antecipa/ },
  { category: "ANTICIPATION", test: /^antecipad[ao]s?\b/ },

  { category: "REFUND", test: /^(estorno|devolucao|cancelamento)\s+(de|da|do)\b/ },
  { category: "CREDIT", test: /^(credito|reembolso)\s+(de|da|do)\b/ },
  { category: "CREDIT", test: /^respiro\b/ },

  { category: "FINE", test: /^multa\b/ },
  { category: "INTEREST", test: /^juros\b/ },
  { category: "IOF", test: /^iof\b/ },

  // "Pix no crédito" alone is the limits block of a statement, not a transaction. With a
  // counterparty after it, it is money taken against the card and financed.
  { category: "OTHER", test: /^(saque|pix)\s+no\s+credito\s*$/, confidence: "LOW" },
  { category: "PIX_ON_CREDIT", test: /^(pix|transferencia)\s+no\s+credito\b/ },

  { category: "OTHER_CHARGE", test: /^(anuidade|seguro|tarifa|encargos)\b/ },
  { category: "OTHER", test: /^outros?\s+lancamentos/, confidence: "LOW" },
];

export function classify(event: ExtractedEvent): { category: EventCategory; confidence: Confidence } {
  if (event.category) {
    return { category: event.category, confidence: event.confidence ?? "HIGH" };
  }

  const text = normalize(event.description).replace(/^[•·\-*\s]+/, "");

  for (const rule of RULES) {
    if (rule.test.test(text)) {
      return { category: rule.category, confidence: rule.confidence ?? "HIGH" };
    }
  }

  const isPlan = !!(event.installmentTotal && event.installmentTotal > 1);
  if (isPlan) return { category: "INSTALLMENT", confidence: "HIGH" };

  // Nothing matched and nothing says it is a plan. It is a purchase, and how sure we are
  // depends on how much of it the document actually gave us.
  const complete = !!event.date && event.amount !== 0 && event.description.trim().length > 2;
  return { category: "PURCHASE", confidence: complete ? "HIGH" : "LOW" };
}

/** Categories that reduce what is owed rather than adding to it. */
export const CREDIT_CATEGORIES: EventCategory[] = ["CREDIT", "REFUND", "ANTICIPATION_DISCOUNT"];

/** Categories that are charges on the card, as opposed to credits or payments. */
export const CHARGE_CATEGORIES: EventCategory[] = [
  "PURCHASE",
  "INSTALLMENT",
  "PIX_ON_CREDIT",
  "ANTICIPATION",
  "IOF",
  "INTEREST",
  "FINE",
  "OTHER_CHARGE",
];
