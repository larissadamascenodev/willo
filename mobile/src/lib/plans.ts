/**
 * Willo PRO: the two plans and the free trial.
 *
 * The trial is the App Store's own (confirmed with Face ID, nothing charged for three
 * days, the subscription starts by itself unless cancelled). Buying goes through the
 * App Store once the app is built and listed; until then `startTrial` only carries the
 * person on to making their account, so the flow can be walked end to end.
 */

export type PlanId = "anual" | "mensal";

export interface Plan {
  id: PlanId;
  /** The App Store product it will be sold as. */
  productId: string;
  label: string;
  /** What is charged, each period. */
  price: number;
  period: "ano" | "mês";
  /** What it comes to a month. */
  perMonth: number;
  badge?: string;
}

export const TRIAL_DAYS = 3;

export const PLANS: Record<PlanId, Plan> = {
  anual: { id: "anual", productId: "willo.pro.anual", label: "Anual", price: 197, period: "ano", perMonth: 197 / 12, badge: `ECONOMIZE R$ ${Math.floor(19.9 * 12 - 197)}` },
  mensal: { id: "mensal", productId: "willo.pro.mensal", label: "Mensal", price: 19.9, period: "mês", perMonth: 19.9 },
};

export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Starts the free trial of a plan. Until the App Store purchase is wired, it succeeds at once. */
export async function startTrial(plan: PlanId): Promise<{ ok: boolean; plan: PlanId }> {
  return { ok: true, plan };
}
