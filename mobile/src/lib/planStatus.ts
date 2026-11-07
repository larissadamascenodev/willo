import { planVsActual, type Bucket, type MethodPlan, type PlanMonth } from "@/lib/plan/financialPlan";
import { money } from "~/lib/money";

/**
 * How the month is going against the plan the person chose, told the way Willo would
 * tell it: each part of the plan with what is used and what is left, how much can still
 * be spent each day, whether the month is inside the plan, and what deserves a word —
 * a part already passed, one going too fast for the days left, the saving not yet done.
 * The page, the home card and the phone's alerts all read it from here.
 */

export type PlanHealth = "dentro" | "atencao" | "fora";
export type AlertTone = "ok" | "warn" | "over";

export interface PlanRow {
  label: string;
  bucket: Bucket | "livre";
  planned: number;
  spent: number;
  left: number;
  /** Used, 0..1+ */
  share: number;
  over: boolean;
  /** A saving part: being "over" it is good. */
  saving: boolean;
}

export interface PlanAlert {
  tone: AlertTone;
  title: string;
  body: string;
}

export interface PlanStatus {
  rows: PlanRow[];
  /** What can still be spent this month, on everything but saving. */
  free: number;
  /** That, a day, to the end of the month. */
  perDay: number;
  daysLeft: number;
  /** How far into the month we are, 0..1. */
  monthGone: number;
  health: PlanHealth;
  alerts: PlanAlert[];
}

export function planStatus(plan: MethodPlan, month: PlanMonth, today = new Date()): PlanStatus {
  const last = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysLeft = Math.max(1, last - today.getDate() + 1);
  const monthGone = Math.min(1, (today.getDate() - 1 + today.getHours() / 24) / last);

  const rows: PlanRow[] = planVsActual(plan, month).map((r, i) => {
    const bucket = plan.allocations[i]?.bucket ?? "livre";
    return { ...r, bucket, share: r.planned > 0 ? r.spent / r.planned : 0, saving: bucket === "guardar" };
  });

  const free = rows.filter((r) => !r.saving).reduce((s, r) => s + Math.max(0, r.left), 0);
  const perDay = free / daysLeft;

  const alerts: PlanAlert[] = [];
  for (const r of rows) {
    if (r.saving) {
      if (today.getDate() >= 10 && r.planned > 0 && r.spent < r.planned * 0.5)
        alerts.push({ tone: "warn", title: `Falta guardar ${money(Math.max(0, r.planned - r.spent))}`, body: `O plano pede ${money(r.planned)} em "${r.label}" este mês. Guardar cedo deixa o resto do mês mais leve.` });
      continue;
    }
    if (r.over) alerts.push({ tone: "over", title: `${r.label} passou do plano`, body: `Foram ${money(r.spent)} de ${money(r.planned)}: ${money(-r.left)} a mais. Segure essa parte até o mês virar.` });
    else if (r.planned > 0 && r.share >= 0.8)
      alerts.push({ tone: "warn", title: `${r.label} quase no limite`, body: `Já usou ${Math.round(r.share * 100)}% do planejado. Restam ${money(r.left)} para ${daysLeft} ${daysLeft === 1 ? "dia" : "dias"}.` });
    else if (r.planned > 0 && r.share > monthGone + 0.2 && monthGone < 0.8)
      alerts.push({ tone: "warn", title: `${r.label} está indo rápido`, body: `Usou ${Math.round(r.share * 100)}% do planejado e o mês está em ${Math.round(monthGone * 100)}%. Dá para segurar um pouco.` });
  }
  if (!alerts.length) alerts.push({ tone: "ok", title: "Tudo no ritmo do plano", body: `Dá para gastar até ${money(perDay)} por dia até o fim do mês e continuar dentro.` });

  const health: PlanHealth = alerts.some((a) => a.tone === "over") ? "fora" : alerts.some((a) => a.tone === "warn") ? "atencao" : "dentro";
  return { rows, free, perDay, daysLeft, monthGone, health, alerts };
}

export const HEALTH_LABEL: Record<PlanHealth, string> = { dentro: "Dentro do plano", atencao: "Pede atenção", fora: "Fora do plano" };
export const HEALTH_HEX: Record<PlanHealth, string> = { dentro: "#67CD67", atencao: "#F5B83D", fora: "#F87171" };
