import { getCurrency } from "@/lib/currency";

/**
 * A figure, written the way the app writes figures.
 *
 * The currency itself comes from the shared module, so a change made on one app is
 * the same change on the other — this only spares every card from repeating the
 * same `toLocaleString` call with the same four options.
 */
export const money = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });

/** The same, without the symbol — for a column that already says what it holds. */
export const amount = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * The same figure with the cents dropped.
 *
 * For a chart label or a column of months, where two decimal places are noise and
 * what matters is the order of magnitude and the sign.
 */
export const compact = (v: number) =>
  `${v < 0 ? "−" : ""}R$ ${Math.abs(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
