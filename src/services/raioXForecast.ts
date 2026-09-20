/**
 * Raio-X forecast engine — turns the user's data into a day-by-day outlook:
 * safe-to-spend, pressure calendar, negative-balance risk, what changed vs the
 * plan, anomalies, a correction plan, purchase simulation and next-month plan.
 * Pure functions; every number carries the reasons behind it ("por quê?").
 */

import type { DashboardData, FinanceEvent } from "@/types/finance";
import type { OverviewCard, OverviewInstallment, OverviewInvoice } from "@/hooks/useCardsOverview";
import { brl, brlCents, isSpend, type GoalRow, type RawTx } from "@/services/raioXAnalytics";

const ESSENTIAL = ["moradia", "aluguel", "condominio", "supermercado", "alimentacao", "mercado", "transporte", "combustivel", "saude", "farmacia", "conta de luz", "conta de agua", "conta de gas", "internet", "educacao"];

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const parseDate = (d: string) => new Date(`${d}T12:00:00`);
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const sameMonth = (d: Date, ref: Date) => d.getMonth() === ref.getMonth() && d.getFullYear() === ref.getFullYear();

export interface Reason {
  label: string;
  amount: number;
}

// ─── Day-by-day forecast ────────────────────────────────────────────

export type Pressure = "tranquilo" | "atencao" | "pressao";

export interface ForecastDay {
  date: string;
  day: number;
  inflow: number;
  outflow: number;
  /** Estimated everyday spending, on top of the scheduled items. */
  estimated: number;
  balance: number;
  items: { name: string; amount: number; type: "receita" | "despesa" }[];
  pressure: Pressure;
  isToday: boolean;
  isPast: boolean;
}

export interface Forecast {
  days: ForecastDay[];
  today: ForecastDay | null;
  /** Balance the month should end with, at the current pace. */
  endBalance: number;
  conservative: number;
  optimistic: number;
  /** Lowest point and when it happens. */
  lowest: { day: number; balance: number } | null;
  negativeDay: number | null;
  committedRest: number;
  estimatedRest: number;
  incomeRest: number;
  safeToSpend: number;
  dailyAllowance: number;
  confidence: { level: "alta" | "media" | "baixa"; known: number; pct: number; estimated: number };
  reasons: Reason[];
  tightWindow: { from: number; to: number } | null;
}

/** Average everyday (non-fixed, non-installment) spending per day. */
function dailyVariable(txs: RawTx[], today: Date, lookbackDays = 60) {
  const since = new Date(today);
  since.setDate(since.getDate() - lookbackDays);
  const spend = txs.filter((t) => isSpend(t) && t.recurrence_type !== "fixa" && !(t.installments && t.installments > 1) && parseDate(t.date) >= since && parseDate(t.date) <= today);
  const days = Math.max(Math.round((today.getTime() - since.getTime()) / 86400000), 1);
  const total = spend.reduce((s, t) => s + t.amount, 0);
  const perDay = total / days;
  // Spread of daily totals, used for the conservative/optimistic range
  const byDay = new Map<string, number>();
  for (const t of spend) byDay.set(t.date, (byDay.get(t.date) ?? 0) + t.amount);
  const values = [...byDay.values()];
  const mean = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const variance = values.length > 1 ? values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1) : 0;
  return { perDay, sd: Math.sqrt(variance) };
}

export function buildForecast(current: DashboardData, txs: RawTx[], today: Date): Forecast {
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const dayOfMonth = today.getDate();
  const daysLeft = daysInMonth - dayOfMonth;
  const { perDay, sd } = dailyVariable(txs, today);

  // Scheduled items still to come (pending transactions, bills, invoices)
  const pending = current.events.filter((e): e is FinanceEvent & { rawDate: string } => !!e.rawDate && e.status !== "pago" && e.status !== "recebido");
  const scheduled = new Map<string, { name: string; amount: number; type: "receita" | "despesa" }[]>();
  for (const e of pending) {
    const list = scheduled.get(e.rawDate) ?? [];
    list.push({ name: e.name, amount: e.amount, type: e.type === "receita" ? "receita" : "despesa" });
    scheduled.set(e.rawDate, list);
  }

  const spentByDay = new Map<string, number>();
  for (const t of txs) {
    if (!sameMonth(parseDate(t.date), today)) continue;
    if (t.type === "receita") spentByDay.set(`in-${t.date}`, (spentByDay.get(`in-${t.date}`) ?? 0) + t.amount);
    else if (isSpend(t)) spentByDay.set(t.date, (spentByDay.get(t.date) ?? 0) + t.amount);
  }

  let balance = current.saldoAtual;
  let committedRest = 0;
  let estimatedRest = 0;
  let incomeRest = 0;
  const days: ForecastDay[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(today.getFullYear(), today.getMonth(), d);
    const key = dayKey(date);
    const isPast = d < dayOfMonth;
    const isToday = d === dayOfMonth;
    const items = scheduled.get(key) ?? [];
    const inflow = items.filter((i) => i.type === "receita").reduce((s, i) => s + i.amount, 0);
    const outflow = items.filter((i) => i.type === "despesa").reduce((s, i) => s + i.amount, 0);
    const estimated = isPast || isToday ? 0 : perDay;

    if (!isPast) {
      committedRest += outflow;
      incomeRest += inflow;
      estimatedRest += estimated;
      balance += inflow - outflow - estimated;
    }

    const load = outflow + estimated;
    const reference = Math.max(current.receitas / daysInMonth, 1);
    const pressure: Pressure = load >= reference * 6 ? "pressao" : load >= reference * 2.5 ? "atencao" : "tranquilo";

    days.push({
      date: key, day: d, inflow, outflow, estimated,
      balance: isPast ? NaN : balance,
      items, pressure, isToday, isPast,
    });
  }

  const future = days.filter((d) => !d.isPast);
  const lowestDay = future.reduce<ForecastDay | null>((min, d) => (!min || d.balance < min.balance ? d : min), null);
  const negative = future.find((d) => d.balance < 0) ?? null;
  const variableSpread = sd * Math.sqrt(Math.max(daysLeft, 1));

  const safeToSpend = Math.max(current.saldoAtual + incomeRest - committedRest - estimatedRest, 0);
  const known = committedRest;
  const pct = known + estimatedRest > 0 ? known / (known + estimatedRest) : 1;

  // Window where the balance stays under one week of everyday spending
  let tightWindow: Forecast["tightWindow"] = null;
  const threshold = perDay * 7;
  for (const d of future) {
    if (d.balance <= threshold) {
      if (!tightWindow) tightWindow = { from: d.day, to: d.day };
      else tightWindow.to = d.day;
    } else if (tightWindow) break;
  }

  const reasons: Reason[] = [
    { label: "Saldo de hoje", amount: current.saldoAtual },
    { label: "Entradas previstas", amount: incomeRest },
    { label: "Contas e faturas agendadas", amount: -committedRest },
    { label: `Gastos do dia a dia (${brl(perDay)}/dia)`, amount: -estimatedRest },
  ];

  return {
    days,
    today: days.find((d) => d.isToday) ?? null,
    endBalance: balance,
    conservative: balance - variableSpread,
    optimistic: balance + variableSpread * 0.7,
    lowest: lowestDay ? { day: lowestDay.day, balance: lowestDay.balance } : null,
    negativeDay: negative?.day ?? null,
    committedRest, estimatedRest, incomeRest,
    safeToSpend,
    dailyAllowance: safeToSpend / Math.max(daysLeft || 1, 1),
    confidence: {
      level: pct >= 0.7 ? "alta" : pct >= 0.4 ? "media" : "baixa",
      known, pct, estimated: estimatedRest,
    },
    reasons,
    tightWindow,
  };
}

// ─── What changed vs. the plan ──────────────────────────────────────

export interface Drift {
  expectedToDate: number;
  actualToDate: number;
  diff: number;
  byCategory: Reason[];
  initialEndBalance: number;
  currentEndBalance: number;
  balanceDiff: number;
  message: string;
}

export function spendingDrift(current: DashboardData, history: DashboardData[], txs: RawTx[], today: Date, forecastEnd: number): Drift {
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const pace = today.getDate() / daysInMonth;
  const past = history.filter((h) => h.transactions.length > 0);
  const avgExpense = past.length ? past.reduce((s, h) => s + h.despesas, 0) / past.length : current.despesas;
  const avgIncome = past.length ? past.reduce((s, h) => s + h.receitas, 0) / past.length : current.receitas;

  const actualToDate = txs.filter((t) => isSpend(t) && sameMonth(parseDate(t.date), today) && parseDate(t.date) <= today).reduce((s, t) => s + t.amount, 0);
  const expectedToDate = avgExpense * pace;
  const diff = actualToDate - expectedToDate;

  const avgCat = new Map<string, number>();
  for (const h of past) for (const c of h.categories) avgCat.set(c.name, (avgCat.get(c.name) ?? 0) + c.amount / past.length);
  const byCategory = current.categories
    .map((c) => ({ label: c.name, amount: c.amount - (avgCat.get(c.name) ?? 0) * pace }))
    .filter((r) => Math.abs(r.amount) >= 25)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 4);

  const initialEndBalance = current.previousMonthEndingBalance + avgIncome - avgExpense;

  const message = Math.abs(diff) < 50
    ? "Você está gastando praticamente o que costuma gastar até esta altura do mês."
    : diff > 0
      ? `Você gastou ${brl(diff)} a mais do que o esperado até hoje.`
      : `Você gastou ${brl(-diff)} a menos do que o esperado até hoje. Mandou bem 👏`;

  return { expectedToDate, actualToDate, diff, byCategory, initialEndBalance, currentEndBalance: forecastEnd, balanceDiff: forecastEnd - initialEndBalance, message };
}

// ─── Anomalies ──────────────────────────────────────────────────────

export interface Anomaly {
  id: string;
  title: string;
  what: string;
  impact: number;
  recurring: boolean;
  action: string;
  category?: string;
}

export function detectAnomalies(current: DashboardData, history: DashboardData[], txs: RawTx[], today: Date): Anomaly[] {
  const out: Anomaly[] = [];
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const pace = Math.max(today.getDate() / daysInMonth, 0.2);
  const past = history.filter((h) => h.transactions.length > 0);
  const avgCat = new Map<string, number>();
  for (const h of past) for (const c of h.categories) avgCat.set(c.name, (avgCat.get(c.name) ?? 0) + c.amount / past.length);

  // Categories running above their usual pace
  for (const c of current.categories) {
    const avg = avgCat.get(c.name) ?? 0;
    if (avg <= 0) continue;
    const expected = avg * pace;
    if (c.amount > expected * 1.25 && c.amount - expected >= 50) {
      out.push({
        id: `cat-${c.name}`,
        title: `${c.name} ${Math.round((c.amount / expected - 1) * 100)}% acima do normal`,
        what: `Você costuma gastar ${brl(expected)} até esta data. Este mês já foram ${brl(c.amount)}.`,
        impact: c.amount - expected,
        recurring: past.filter((h) => (h.categories.find((x) => x.name === c.name)?.amount ?? 0) > avg).length >= 2,
        action: `Segure ${c.name} nos próximos dias ou defina um limite de ${brl(Math.round(avg / 10) * 10)}.`,
        category: c.name,
      });
    }
  }

  // Repeated similar purchases in the last 7 days
  const week = new Date(today);
  week.setDate(week.getDate() - 7);
  const recent = txs.filter((t) => isSpend(t) && parseDate(t.date) >= week);
  const byName = new Map<string, RawTx[]>();
  for (const t of recent) byName.set(norm(t.name), [...(byName.get(norm(t.name)) ?? []), t]);
  byName.forEach((list) => {
    if (list.length >= 3) {
      const total = list.reduce((s, t) => s + t.amount, 0);
      out.push({
        id: `repeat-${norm(list[0].name)}`,
        title: `${list.length} compras em ${list[0].name} nesta semana`,
        what: `Somaram ${brlCents(total)} em 7 dias.`,
        impact: total,
        recurring: true,
        action: "Vale checar se todas eram necessárias ou se virou hábito.",
        category: list[0].category,
      });
    }
  });

  // Subscriptions that got more expensive
  const fixed = txs.filter((t) => t.type === "despesa" && t.recurrence_type === "fixa");
  const byFixed = new Map<string, RawTx[]>();
  for (const t of fixed) byFixed.set(norm(t.name), [...(byFixed.get(norm(t.name)) ?? []), t]);
  byFixed.forEach((list) => {
    if (list.length < 2) return;
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    if (last.amount > first.amount * 1.1 && last.amount - first.amount >= 5) {
      out.push({
        id: `price-${norm(last.name)}`,
        title: `${last.name} ficou mais caro`,
        what: `Subiu de ${brlCents(first.amount)} para ${brlCents(last.amount)}.`,
        impact: (last.amount - first.amount) * 12,
        recurring: true,
        action: "Veja se ainda compensa ou procure um plano melhor.",
        category: last.category,
      });
    }
  });

  return out.sort((a, b) => b.impact - a.impact).slice(0, 6);
}

// ─── Smart invoice ──────────────────────────────────────────────────

export interface InvoiceOutlook {
  current: number;
  projectedClose: number;
  safeForNewPurchases: number;
  futureInstallments: number;
  daysToClose: number;
  incomeShare: number;
  message: string;
}

export function invoiceOutlook(
  cards: OverviewCard[], invoices: OverviewInvoice[], installments: OverviewInstallment[],
  txs: RawTx[], today: Date, income: number, safeToSpend: number,
): InvoiceOutlook | null {
  if (cards.length === 0) return null;
  const month = today.getMonth() + 1;
  const year = today.getFullYear();
  const currentTotal = invoices.filter((i) => i.month === month && i.year === year).reduce((s, i) => s + i.total, 0);

  // Days until the earliest closing date still ahead
  const closingDays = cards.map((c) => {
    const closing = new Date(year, today.getMonth(), Math.min(c.closingDay, new Date(year, month, 0).getDate()));
    if (closing < today) closing.setMonth(closing.getMonth() + 1);
    return Math.round((closing.getTime() - today.getTime()) / 86400000);
  });
  const daysToClose = Math.max(Math.min(...closingDays), 0);

  const since = new Date(today);
  since.setDate(since.getDate() - 30);
  const cardSpend = txs.filter((t) => isSpend(t) && t.payment_method === "cartao" && parseDate(t.date) >= since);
  const perDay = cardSpend.reduce((s, t) => s + t.amount, 0) / 30;
  const projectedClose = currentTotal + perDay * daysToClose;

  const nowKey = year * 12 + today.getMonth();
  const futureInstallments = installments.filter((i) => i.year * 12 + i.month - 1 > nowKey).reduce((s, i) => s + i.amount, 0);
  const incomeShare = income > 0 ? projectedClose / income : 0;
  const safeForNewPurchases = Math.max(safeToSpend - Math.max(projectedClose - currentTotal, 0), 0);

  const message = incomeShare >= 0.5
    ? `A fatura deve fechar em ${brl(projectedClose)}, mais da metade da sua renda. Pé no freio no crédito 🛑`
    : futureInstallments > 0
      ? `${brl(futureInstallments)} das próximas faturas já estão comprometidos com parcelas.`
      : `No ritmo atual, a fatura fecha perto de ${brl(projectedClose)}.`;

  return { current: currentTotal, projectedClose, safeForNewPurchases, futureInstallments, daysToClose, incomeShare, message };
}

// ─── Correction plan ────────────────────────────────────────────────

export interface PlanAction {
  id: string;
  title: string;
  detail: string;
  saving: number;
  category?: string;
  kind: "categoria" | "limite" | "assinatura" | "adiar";
}

export interface CorrectionPlan {
  actions: PlanAction[];
  totalSaving: number;
  doNothing: number;
  withPlan: number;
  best: number;
}

export function correctionPlan(
  forecast: Forecast, current: DashboardData, history: DashboardData[], today: Date,
  recurring: { name: string; amount: number; category: string; type: string }[],
): CorrectionPlan {
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysLeft = Math.max(daysInMonth - today.getDate(), 1);
  const pace = Math.max(today.getDate() / daysInMonth, 0.25);
  const past = history.filter((h) => h.transactions.length > 0);
  const avgCat = new Map<string, number>();
  for (const h of past) for (const c of h.categories) avgCat.set(c.name, (avgCat.get(c.name) ?? 0) + c.amount / past.length);

  const actions: PlanAction[] = [];

  // Trim the categories running hottest
  const over = current.categories
    .map((c) => ({ name: c.name, over: c.amount - (avgCat.get(c.name) ?? 0) * pace }))
    .filter((c) => c.over >= 60)
    .sort((a, b) => b.over - a.over)
    .slice(0, 2);
  for (const c of over) {
    const saving = Math.round(c.over * 0.5);
    actions.push({
      id: `cut-${c.name}`, kind: "categoria", category: c.name,
      title: `Reduzir ${c.name} em ${brl(saving)}`,
      detail: `Está ${brl(c.over)} acima do seu normal para esta altura do mês.`,
      saving,
    });
  }

  // A daily cap for the rest of the month
  const dailyCap = Math.max(forecast.dailyAllowance, 0);
  if (dailyCap > 0) {
    const currentPace = forecast.estimatedRest / daysLeft;
    if (currentPace > dailyCap * 1.05) {
      actions.push({
        id: "cap", kind: "limite",
        title: `Limitar gastos a ${brl(dailyCap)} por dia`,
        detail: `Hoje seu ritmo é de ${brl(currentPace)} por dia nos gastos do dia a dia.`,
        saving: Math.round((currentPace - dailyCap) * daysLeft),
      });
    }
  }

  // Cancel a small subscription
  const small = recurring.filter((r) => r.type === "despesa" && r.amount > 0 && r.amount <= 80).sort((a, b) => b.amount - a.amount)[0];
  if (small) {
    actions.push({
      id: `sub-${small.name}`, kind: "assinatura",
      title: `Cancelar ${small.name}`,
      detail: `${brlCents(small.amount)} por mês, ${brl(small.amount * 12)} por ano.`,
      saving: small.amount,
    });
  }

  const totalSaving = actions.reduce((s, a) => s + a.saving, 0);
  return {
    actions,
    totalSaving,
    doNothing: forecast.endBalance,
    withPlan: forecast.endBalance + totalSaving,
    best: forecast.optimistic + totalSaving,
  };
}

// ─── "Posso comprar?" ───────────────────────────────────────────────

export interface PurchaseScenario {
  times: number;
  monthly: number;
  endBalance: number;
  reserveAfter: number;
  incomeCommitment: number;
  light: "verde" | "amarelo" | "vermelho";
  note: string;
}

export function purchaseScenarios(
  value: number, forecast: Forecast, reserve: number, income: number,
  installmentsMonthly: number, fixedMonthly: number, avgNet: number,
): PurchaseScenario[] {
  if (value <= 0) return [];
  return [1, 3, 6, 12].map((times) => {
    const monthly = value / times;
    const endBalance = forecast.endBalance - monthly;
    const reserveAfter = times === 1 ? reserve - Math.max(monthly - Math.max(forecast.safeToSpend, 0), 0) : reserve;
    const commitment = income > 0 ? (fixedMonthly + installmentsMonthly + monthly) / income : 0;
    const light: PurchaseScenario["light"] =
      endBalance < 0 || commitment > 0.7 ? "vermelho" : endBalance < income * 0.1 || commitment > 0.5 ? "amarelo" : "verde";
    const note = times === 1
      ? forecast.safeToSpend >= value
        ? `Cabe no seu seguro para gastar (${brl(forecast.safeToSpend)}).`
        : `Passa ${brl(value - forecast.safeToSpend)} do seu seguro para gastar; sairia da reserva.`
      : `${brl(monthly)} por mês · ${Math.round(commitment * 100)}% da renda comprometida${avgNet - monthly < 0 ? ", acima do que costuma sobrar" : ""}.`;
    return { times, monthly, endBalance, reserveAfter, incomeCommitment: commitment, light, note };
  });
}

// ─── Emergency reserve ──────────────────────────────────────────────

export interface ReserveOutlook {
  essential: number;
  reserve: number;
  coverage: number;
  target3: number;
  target6: number;
  monthlySaving: number;
  monthsTo3: number | null;
  message: string;
}

export function reserveOutlook(
  reserve: number, history: DashboardData[], current: DashboardData,
  recurring: { amount: number; category: string; type: string }[], installmentsMonthly: number, avgNet: number,
): ReserveOutlook {
  const past = history.filter((h) => h.transactions.length > 0);
  const essentialFromHistory = past.length
    ? past.reduce((s, h) => s + h.categories.filter((c) => ESSENTIAL.some((e) => norm(c.name).includes(e))).reduce((a, c) => a + c.amount, 0), 0) / past.length
    : current.categories.filter((c) => ESSENTIAL.some((e) => norm(c.name).includes(e))).reduce((a, c) => a + c.amount, 0);
  const fixed = recurring.filter((r) => r.type === "despesa").reduce((s, r) => s + r.amount, 0);
  const essential = Math.max(essentialFromHistory + fixed + installmentsMonthly, current.despesas * 0.6);

  const coverage = essential > 0 ? reserve / essential : 0;
  const monthlySaving = Math.max(avgNet, 0);
  const missing = Math.max(essential * 3 - reserve, 0);
  const monthsTo3 = monthlySaving > 0 && missing > 0 ? Math.ceil(missing / monthlySaving) : missing === 0 ? 0 : null;

  const message = coverage >= 6
    ? "Sua reserva cobre mais de seis meses. Blindagem completa 🛡️"
    : coverage >= 3
      ? "Sua reserva já cobre o mínimo recomendado de três meses. Ótimo colchão."
      : monthsTo3 !== null && monthsTo3 > 0
        ? `Nesse ritmo, você alcança três meses de reserva em cerca de ${monthsTo3} ${monthsTo3 === 1 ? "mês" : "meses"}.`
        : "Comece guardando um pouco todo mês: a reserva é o que evita dívida em imprevisto.";

  return { essential, reserve, coverage, target3: essential * 3, target6: essential * 6, monthlySaving, monthsTo3, message };
}

// ─── Next month plan + surplus ──────────────────────────────────────

export interface NextMonthPlan {
  monthLabel: string;
  save: number;
  weeklyLimit: number;
  caps: { category: string; cap: number }[];
  minBalance: number;
  adaptedNote: string | null;
}

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function nextMonthPlan(
  history: DashboardData[], current: DashboardData, today: Date,
  recurring: { name: string; amount: number; category: string; type: string }[],
  installments: OverviewInstallment[], goals: GoalRow[],
): NextMonthPlan {
  const next = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const past = history.filter((h) => h.transactions.length > 0);
  const avgIncome = past.length ? past.reduce((s, h) => s + h.receitas, 0) / past.length : current.receitas;
  const income = Math.max(current.receitas, avgIncome);
  const fixed = recurring.filter((r) => r.type === "despesa").reduce((s, r) => s + r.amount, 0);
  const nextKey = next.getFullYear() * 12 + next.getMonth();
  const inst = installments.filter((i) => i.year * 12 + i.month - 1 === nextKey).reduce((s, i) => s + i.amount, 0);

  const free = Math.max(income - fixed - inst, 0);
  const goalNeed = goals.reduce((s, g) => s + (g.monthlyContribution ?? 0), 0);
  const save = Math.max(Math.round(Math.min(free * 0.2, free - 200) / 10) * 10, 0);
  const weeklyLimit = Math.max(Math.round(((free - save) / 4.3) / 10) * 10, 0);

  const avgCat = new Map<string, number>();
  for (const h of past) for (const c of h.categories) avgCat.set(c.name, (avgCat.get(c.name) ?? 0) + c.amount / past.length);
  const caps = [...avgCat.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category, avg]) => ({ category, cap: Math.round((avg * 0.9) / 10) * 10 }));

  const adaptedNote = goalNeed > save && goalNeed > 0
    ? `Suas metas pedem ${brl(goalNeed)} por mês. Com as contas do próximo mês, o seguro é guardar ${brl(save)} e redistribuir o resto depois.`
    : null;

  return {
    monthLabel: MONTHS[next.getMonth()],
    save,
    weeklyLimit,
    caps,
    minBalance: Math.round((fixed + inst) / 10) * 10,
    adaptedNote,
  };
}

export interface SurplusPlan {
  surplus: number;
  reserve: number;
  goal: number;
  invest: number;
  free: number;
}

export function surplusPlan(endBalance: number, reserveCoverage: number, hasGoals: boolean): SurplusPlan | null {
  if (endBalance <= 100) return null;
  const surplus = endBalance;
  // Fill the emergency reserve first, then goals, then investments
  const reserveShare = reserveCoverage < 3 ? 0.5 : 0.2;
  const goalShare = hasGoals ? 0.25 : 0;
  const investShare = 1 - reserveShare - goalShare - 0.1;
  return {
    surplus,
    reserve: Math.round(surplus * reserveShare),
    goal: Math.round(surplus * goalShare),
    invest: Math.round(surplus * investShare),
    free: Math.round(surplus * 0.1),
  };
}

// ─── Behaviour lessons ──────────────────────────────────────────────

export function monthLessons(txs: RawTx[], current: DashboardData, today: Date): string[] {
  const lessons: string[] = [];
  const spend = txs.filter((t) => isSpend(t) && t.recurrence_type !== "fixa");
  const last90 = new Date(today);
  last90.setDate(last90.getDate() - 90);
  const recent = spend.filter((t) => parseDate(t.date) >= last90);
  if (recent.length < 6) return lessons;

  const total = recent.reduce((s, t) => s + t.amount, 0);
  const weekend = recent.filter((t) => [0, 6].includes(parseDate(t.date).getDay())).reduce((s, t) => s + t.amount, 0);
  if (total > 0) {
    const share = weekend / total;
    if (share >= 0.3) lessons.push(`Seus finais de semana concentram ${Math.round(share * 100)}% dos gastos variáveis.`);
  }

  // Spending right after income lands
  const incomes = txs.filter((t) => t.type === "receita" && parseDate(t.date) >= last90).sort((a, b) => a.date.localeCompare(b.date));
  if (incomes.length >= 2) {
    let afterPay = 0;
    for (const inc of incomes) {
      const start = parseDate(inc.date);
      const end = new Date(start);
      end.setDate(end.getDate() + 5);
      afterPay += recent.filter((t) => parseDate(t.date) >= start && parseDate(t.date) <= end).reduce((s, t) => s + t.amount, 0);
    }
    const share = total > 0 ? afterPay / total : 0;
    if (share >= 0.35) lessons.push(`Você tende a gastar mais nos cinco dias depois de receber: ${Math.round(share * 100)}% do total.`);
  }

  const cats = new Map<string, number>();
  for (const t of recent) cats.set(t.category, (cats.get(t.category) ?? 0) + t.amount);
  const top = [...cats.entries()].sort((a, b) => b[1] - a[1])[0];
  if (top) lessons.push(`${top[0]} é o seu principal gasto fora do planejado: ${brl(top[1])} em 90 dias.`);

  const card = recent.filter((t) => t.payment_method === "cartao").reduce((s, t) => s + t.amount, 0);
  if (card / (total || 1) >= 0.5) lessons.push(`Mais da metade dos seus gastos variáveis passa no cartão, o que empurra o aperto para a fatura seguinte.`);

  return lessons.slice(0, 4);
}
