/**
 * Money, as whole centavos.
 *
 * Everything inside the engine counts in centavos because reais are binary fractions that
 * do not exist: 0.1 + 0.2 is 0.30000000000000004, and a statement reconciles or it does
 * not. Conversion happens at the edges, once in and once out.
 */
export type Cents = number;

/** A value read as reais (what the extraction returns) becomes centavos. */
export const toCents = (reais: number): Cents => Math.round(reais * 100);

export const toReais = (cents: Cents): number => cents / 100;

export const sumCents = (values: Cents[]): Cents => values.reduce((a, b) => a + b, 0);

export const absCents = (c: Cents): Cents => Math.abs(c);

/**
 * Whether two amounts are the same for reconciliation.
 *
 * A few centavos of slack, because the document itself rounds: the statement this was built
 * against prints a total of R$ 973,44 whose own summary lines add to R$ 973,42. Without the
 * slack every statement reports a discrepancy over rounding and the alert stops meaning
 * anything. The exact difference is always reported either way, so nothing is hidden.
 */
export const TOLERANCE: Cents = 5;

export const reconciles = (a: Cents, b: Cents): boolean => Math.abs(a - b) <= TOLERANCE;

export const fmtCents = (cents: Cents): string =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
