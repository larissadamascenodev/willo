/**
 * Willo PRO: the two plans and the free trial.
 *
 * The free week comes with the annual plan only, and is the App Store's own (confirmed
 * with Face ID, nothing charged for seven days, the year starts by itself unless
 * cancelled). Buying goes through RevenueCat (see purchases.ts); in Expo Go it succeeds
 * at once, so the flow can be walked end to end.
 */
import { buy } from "./purchases";

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

export const TRIAL_DAYS = 7;

export const PLANS: Record<PlanId, Plan> = {
  anual: { id: "anual", productId: "willo.pro.anual", label: "Anual", price: 149.9, period: "ano", perMonth: 149.9 / 12, badge: `ECONOMIZE ${Math.round((1 - 149.9 / (19.9 * 12)) * 100)}%` },
  mensal: { id: "mensal", productId: "willo.pro.mensal", label: "Mensal", price: 19.9, period: "mês", perMonth: 19.9 },
};

export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Buys a plan: the annual one starts with the free week, the monthly one is charged at once. */
export async function startTrial(plan: PlanId): Promise<{ ok: boolean; plan: PlanId; cancelled?: boolean; message?: string }> {
  const r = await buy(PLANS[plan].productId);
  return r.ok ? { ok: true, plan } : { ok: false, plan, cancelled: r.cancelled, message: r.message };
}
