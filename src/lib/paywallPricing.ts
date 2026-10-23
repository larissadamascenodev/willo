/**
 * What the subscription costs, and whether it can be bought at all.
 *
 * The prices come from the environment because they change without the code changing,
 * and a price hardcoded in a component is a price that will one day disagree with the
 * one Stripe charges. The fallbacks are the launch figures, so a missing variable
 * shows the right number rather than R$ 0.
 */

const numero = (bruto: unknown, padrao: number): number => {
  const n = Number(String(bruto ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : padrao;
};

/**
 * Whether the paywall may charge. Off, the screen still shows — the plan is worth
 * presenting — but its button only finishes the onboarding.
 */
export const PAYWALL_ENABLED = import.meta.env.VITE_PAYWALL_ENABLED === "true";

export const PRECO_MENSAL = numero(import.meta.env.VITE_PRICE_MONTHLY, 19.9);
export const PRECO_ANUAL = numero(import.meta.env.VITE_PRICE_ANNUAL, 197.9);

/** The annual plan is sold by the month, because that is the number people compare. */
export const ANUAL_POR_MES = PRECO_ANUAL / 12;

/** How much cheaper a year is than twelve months bought one at a time. */
export const DESCONTO_ANUAL_PCT = Math.max(Math.round((1 - ANUAL_POR_MES / PRECO_MENSAL) * 100), 0);

export const DIAS_DE_TESTE = 3;

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const reais = (v: number) => BRL.format(v);

export type PlanoId = "anual" | "mensal";

/**
 * The line the stores and the consumer code both require: what is free, what is
 * charged afterwards, that it renews, and that it can be cancelled.
 */
export function linhaDeCobranca(plano: PlanoId): string {
  const valor = plano === "anual" ? PRECO_ANUAL : PRECO_MENSAL;
  const periodo = plano === "anual" ? "por ano" : "por mês";
  return `${DIAS_DE_TESTE} dias grátis, depois ${reais(valor)} ${periodo}. Renova automaticamente. Cancele quando quiser.`;
}
