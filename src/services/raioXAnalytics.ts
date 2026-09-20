/**
 * Raio-X analytics — deeper readings built on raw transactions:
 * daily traffic light, month close, income commitment, per-category scores,
 * card purchases, installments, weekday pattern, cash flow, leaks, impulse
 * buys, duplicates, goals countdown, weekly summary and the monthly wrap.
 * Pure functions only.
 */

import type { DashboardData } from "@/types/finance";
import type { OverviewCard, OverviewInstallment, OverviewInvoice } from "@/hooks/useCardsOverview";

import { getCurrency } from "@/lib/currency";
export interface RawTx {
  id: string;
  name: string;
  amount: number;
  type: string;
  category: string;
  date: string; // YYYY-MM-DD
  time: string | null;
  status: string | null;
  payment_method: string | null;
  credit_card_id: string | null;
  recurrence_type: string | null;
  installments: number | null;
  installment_current: number | null;
}

export interface GoalRow {
  id: string;
  name: string;
  target: number;
  current: number;
  deadline: string | null;
  monthlyContribution: number | null;
  createdAt: string;
}

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WEEKDAYS_FULL = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency(), maximumFractionDigits: 0 });
export const brlCents = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const parseDate = (d: string) => new Date(`${d}T12:00:00`);
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const sameMonth = (d: Date, ref: Date) => d.getMonth() === ref.getMonth() && d.getFullYear() === ref.getFullYear();

/** Real spending (not transfers or invoice payments, which would double count card purchases). */
export const isSpend = (t: RawTx) =>
  t.type === "despesa" && !/^fatura\b|pagamento de fatura|transfer/i.test(norm(t.name)) && norm(t.category) !== "transferencia";

// ─── Traffic light of the day ───────────────────────────────────────

export type Light = "verde" | "amarelo" | "vermelho";

export interface DailyLight {
  light: Light;
  allowance: number;
  spentToday: number;
  leftToday: number;
  message: string;
}

export function dailyLight(txs: RawTx[], today: Date, free: number, daysLeft: number): DailyLight {
  const key = dayKey(today);
  const spentToday = txs.filter((t) => isSpend(t) && t.date === key).reduce((s, t) => s + t.amount, 0);
  const allowance = Math.max(free + spentToday, 0) / Math.max(daysLeft, 1);
  const leftToday = allowance - spentToday;

  if (allowance <= 0) {
    return { light: "vermelho", allowance: 0, spentToday, leftToday: 0, message: "O orçamento do mês já acabou. Hoje é dia de gasto zero 🔒" };
  }
  const ratio = spentToday / allowance;
  if (ratio <= 0.7) {
    return {
      light: "verde", allowance, spentToday, leftToday,
      message: spentToday === 0 ? `Você pode gastar até ${brl(allowance)} hoje sem comprometer o mês.` : `Ainda dá pra gastar ${brl(leftToday)} hoje numa boa.`,
    };
  }
  if (ratio <= 1) {
    return { light: "amarelo", allowance, spentToday, leftToday, message: `Quase no limite do dia: sobram ${brl(leftToday)}. Vai com calma.` };
  }
  return { light: "vermelho", allowance, spentToday, leftToday, message: `Você passou ${brl(-leftToday)} do ideal de hoje. Amanhã a gente compensa 💪` };
}

// ─── Month close + predictive alert ─────────────────────────────────

export interface MonthClose {
  projectedBalance: number;
  projectedExpense: number;
  expectedExtra: number;
  runOutDay: number | null;
  daysUntilRunOut: number | null;
  message: string;
}

export function monthClose(current: DashboardData, txs: RawTx[], today: Date): MonthClose {
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const day = today.getDate();
  const daysLeft = daysInMonth - day;
  // Daily pace of everyday spending (not fixed bills or installments already scheduled)
  const variable = txs.filter((t) => isSpend(t) && sameMonth(parseDate(t.date), today) && parseDate(t.date) <= today && t.recurrence_type !== "fixa" && !(t.installments && t.installments > 1));
  const pace = day > 0 ? variable.reduce((s, t) => s + t.amount, 0) / day : 0;
  const expectedExtra = pace * daysLeft;
  const projectedBalance = current.saldoPrevisto - expectedExtra;
  const projectedExpense = current.despesas + expectedExtra;
  const free = current.receitas - current.despesas;

  let runOutDay: number | null = null;
  let daysUntilRunOut: number | null = null;
  if (free > 0 && pace > 0 && free / pace < daysLeft) {
    daysUntilRunOut = Math.max(Math.floor(free / pace), 0);
    runOutDay = day + daysUntilRunOut;
  }

  const message = runOutDay !== null
    ? daysUntilRunOut === 0
      ? "No ritmo atual, seu orçamento do mês acaba hoje ⚠️"
      : `No ritmo atual, seu orçamento acaba em ${daysUntilRunOut} ${daysUntilRunOut === 1 ? "dia" : "dias"}, lá pelo dia ${runOutDay} ⚠️`
    : projectedBalance < 0
      ? "Mesmo com cuidado, o mês tende a fechar no vermelho. Bora rever os gastos 🧭"
      : free - expectedExtra >= current.receitas * 0.2
        ? "No ritmo atual, sobra dinheiro no fim do mês. Tá voando 🚀"
        : "No ritmo atual, você fecha o mês no azul, mas sem muita folga.";

  return { projectedBalance, projectedExpense, expectedExtra, runOutDay, daysUntilRunOut, message };
}

// ─── Income commitment ──────────────────────────────────────────────

export interface Commitment {
  income: number;
  fixed: number;
  installments: number;
  card: number;
  variable: number;
  free: number;
  committedPct: number;
  message: string;
}

export function incomeCommitment(
  current: DashboardData,
  txs: RawTx[],
  today: Date,
  recurring: { amount: number; type: string }[],
  installments: OverviewInstallment[],
): Commitment {
  const income = current.receitas;
  const monthTx = txs.filter((t) => isSpend(t) && sameMonth(parseDate(t.date), today));
  const fixed = recurring.filter((r) => r.type === "despesa").reduce((s, r) => s + r.amount, 0);
  const inst = installments.filter((i) => i.year === today.getFullYear() && i.month === today.getMonth() + 1).reduce((s, i) => s + i.amount, 0);
  const card = Math.max(monthTx.filter((t) => t.payment_method === "cartao" && !(t.installments && t.installments > 1)).reduce((s, t) => s + t.amount, 0), 0);
  const total = Math.max(current.despesas, fixed + inst + card);
  const variable = Math.max(total - fixed - inst - card, 0);
  const committedPct = income > 0 ? (fixed + inst) / income : 0;
  const free = income - total;

  const message = income <= 0
    ? "Registre suas receitas para medir quanto da renda já está comprometida."
    : committedPct >= 0.6
      ? `${Math.round(committedPct * 100)}% da renda já sai em contas fixas e parcelas. Pouca margem para imprevistos 😬`
      : committedPct >= 0.4
        ? `${Math.round(committedPct * 100)}% da renda está presa em fixos e parcelas. Dá pra viver, mas fica de olho.`
        : `Só ${Math.round(committedPct * 100)}% da renda está comprometida com fixos e parcelas. Ótima margem 👌`;

  return { income, fixed, installments: inst, card, variable, free, committedPct, message };
}

// ─── Categories: mini score, villain, variation ranking ──────────────

export interface CategoryReading {
  name: string;
  spent: number;
  average: number;
  limit: number | null;
  variation: number | null; // vs average, e.g. 0.35 = +35%
  score: number; // 0-100
  tone: "otimo" | "ok" | "atencao" | "critico";
  diagnosis: string;
}

export function categoryReadings(
  current: DashboardData,
  history: DashboardData[],
  limits: { category: string; limit: number }[],
  today: Date,
): CategoryReading[] {
  const past = history.filter((h) => h.transactions.length > 0);
  const avg = new Map<string, number>();
  for (const h of past) for (const c of h.categories) avg.set(c.name, (avg.get(c.name) ?? 0) + c.amount / past.length);
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const pace = Math.max(today.getDate() / daysInMonth, 0.25);

  return current.categories
    .filter((c) => c.amount > 0)
    .map((c) => {
      const average = avg.get(c.name) ?? 0;
      const limit = limits.find((l) => l.category === c.name)?.limit ?? null;
      const reference = limit ?? (average > 0 ? average : null);
      const projected = c.amount / pace;
      const ratio = reference ? (limit ? c.amount : projected) / reference : null;
      const score = ratio === null ? 75 : ratio <= 0.8 ? 95 : ratio <= 1 ? 80 : ratio <= 1.2 ? 60 : ratio <= 1.5 ? 40 : 20;
      const tone: CategoryReading["tone"] = score >= 85 ? "otimo" : score >= 60 ? "ok" : score >= 40 ? "atencao" : "critico";
      const variation = average > 0 ? c.amount / average - 1 : null;

      const diagnosis = ratio === null
        ? "Primeiro mês com dados aqui. Ainda estou aprendendo seu padrão."
        : limit
          ? c.amount > limit
            ? `Passou ${brl(c.amount - limit)} do limite de ${brl(limit)}.`
            : `Usou ${Math.round((c.amount / limit) * 100)}% do limite. Sobram ${brl(limit - c.amount)}.`
          : ratio > 1.2
            ? `No ritmo atual fecha o mês em ${brl(projected)}, ${Math.round((ratio - 1) * 100)}% acima da sua média.`
            : ratio < 0.8
              ? `Abaixo da sua média de ${brl(average)}. Bom controle 👏`
              : `Dentro da sua média de ${brl(average)}.`;

      return { name: c.name, spent: c.amount, average, limit, variation, score, tone, diagnosis };
    })
    .sort((a, b) => b.spent - a.spent);
}

/** Essentials (rent, bills, health...) never get to be the villain of the month. */
const ESSENTIAL_CATEGORIES = [
  "moradia", "aluguel", "condominio", "conta de luz", "conta de agua", "conta de gas", "energia", "agua", "gas",
  "internet", "telefonia", "saude", "farmacia", "educacao", "material escolar", "impostos", "seguros", "transporte",
  "combustivel", "manutencao", "pets",
];

/** Food counts as excess only when it runs clearly above the usual. */
const SEMI_ESSENTIAL = ["alimentacao", "supermercado", "mercado", "padaria"];

export function villain(readings: CategoryReading[]) {
  const candidates = readings.filter((r) => {
    const n = norm(r.name);
    if (ESSENTIAL_CATEGORIES.some((e) => n.includes(e))) return false;
    if (SEMI_ESSENTIAL.some((e) => n.includes(e))) return r.average > 0 && r.spent > r.average * 1.15;
    return true;
  });
  const pool = candidates.length ? candidates : readings;
  const overSpent = pool.filter((r) => r.average > 0 && r.spent > r.average);
  if (overSpent.length) return overSpent.sort((a, b) => b.spent - b.average - (a.spent - a.average))[0];
  return pool.sort((a, b) => b.spent - a.spent)[0] ?? null;
}

// ─── This month vs. last month ──────────────────────────────────────

export interface MonthComparison {
  income: { now: number; before: number };
  expense: { now: number; before: number };
  saved: { now: number; before: number };
  categories: { name: string; now: number; before: number; diff: number }[];
  message: string;
  hasBefore: boolean;
}

export function monthComparison(current: DashboardData, previous: DashboardData | null, today: Date): MonthComparison {
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const pace = Math.min(today.getDate() / daysInMonth, 1);
  const before = previous ?? null;
  // Compare like with like: last month is read up to the same point of the month
  const beforeExpense = (before?.despesas ?? 0) * pace;
  const beforeIncome = before?.receitas ?? 0;

  const beforeCats = new Map((before?.categories ?? []).map((c) => [c.name, c.amount * pace]));
  const categories = [...new Set([...current.categories.map((c) => c.name), ...beforeCats.keys()])]
    .map((name) => {
      const now = current.categories.find((c) => c.name === name)?.amount ?? 0;
      const was = beforeCats.get(name) ?? 0;
      return { name, now, before: was, diff: now - was };
    })
    .filter((c) => Math.abs(c.diff) >= 30)
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
    .slice(0, 5);

  const diff = current.despesas - beforeExpense;
  const message = !before || before.transactions.length === 0
    ? "Ainda não tenho o mês anterior completo para comparar. No próximo mês essa comparação fica mais rica."
    : Math.abs(diff) < 50
      ? "Você está gastando praticamente o mesmo do mês passado nesta altura."
      : diff > 0
        ? `Você gastou ${brl(diff)} a mais que no mesmo período do mês passado.`
        : `Você gastou ${brl(-diff)} a menos que no mesmo período do mês passado. Ritmo melhor 👏`;

  return {
    income: { now: current.receitas, before: beforeIncome },
    expense: { now: current.despesas, before: beforeExpense },
    saved: { now: current.receitas - current.despesas, before: beforeIncome - beforeExpense },
    categories,
    message,
    hasBefore: !!before && before.transactions.length > 0,
  };
}

// ─── Card purchases ─────────────────────────────────────────────────

export interface CardReading {
  total: number;
  count: number;
  avgTicket: number;
  shareOfSpend: number;
  topCategories: { name: string; amount: number }[];
  biggest: RawTx | null;
  byCard: { card: OverviewCard; amount: number }[];
  invoiceTotal: number;
  message: string;
}

export function cardReading(txs: RawTx[], today: Date, cards: OverviewCard[], invoices: OverviewInvoice[], income: number): CardReading | null {
  if (cards.length === 0) return null;
  const monthSpend = txs.filter((t) => isSpend(t) && sameMonth(parseDate(t.date), today));
  const onCard = monthSpend.filter((t) => t.payment_method === "cartao");
  const total = onCard.reduce((s, t) => s + t.amount, 0);
  const allSpend = monthSpend.reduce((s, t) => s + t.amount, 0);
  const cats = new Map<string, number>();
  for (const t of onCard) cats.set(t.category, (cats.get(t.category) ?? 0) + t.amount);
  const byCard = cards
    .map((card) => ({ card, amount: onCard.filter((t) => t.credit_card_id === card.id).reduce((s, t) => s + t.amount, 0) }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const invoiceTotal = invoices
    .filter((i) => i.month === today.getMonth() + 1 && i.year === today.getFullYear())
    .reduce((s, i) => s + i.total, 0);
  const shareOfSpend = allSpend > 0 ? total / allSpend : 0;
  const invoiceShare = income > 0 ? invoiceTotal / income : 0;

  const message = onCard.length === 0
    ? "Nenhuma compra no cartão este mês. Controle raiz 🌱"
    : invoiceShare >= 0.5
      ? `A fatura já come ${Math.round(invoiceShare * 100)}% da sua renda. O cartão virou a segunda renda ao contrário 😅`
      : shareOfSpend >= 0.6
        ? `${Math.round(shareOfSpend * 100)}% dos seus gastos passam pelo cartão. Cuidado com a fatura do mês que vem.`
        : `${onCard.length} ${onCard.length === 1 ? "compra" : "compras"} no cartão, ticket médio de ${brl(total / onCard.length)}.`;

  return {
    total, count: onCard.length, avgTicket: onCard.length ? total / onCard.length : 0, shareOfSpend,
    topCategories: [...cats.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount).slice(0, 3),
    biggest: onCard.sort((a, b) => b.amount - a.amount)[0] ?? null,
    byCard, invoiceTotal, message,
  };
}

// ─── Installments ───────────────────────────────────────────────────

export interface InstallmentsReading {
  purchases: { name: string; category: string; amount: number; current: number; total: number; remaining: number }[];
  monthly: number;
  remainingTotal: number;
  freeFrom: string | null;
  incomeShare: number;
  message: string;
}

export function installmentsReading(installments: OverviewInstallment[], today: Date, income: number): InstallmentsReading {
  const nowKey = today.getFullYear() * 12 + today.getMonth();
  const groups = new Map<string, OverviewInstallment[]>();
  for (const i of installments) groups.set(i.groupId, [...(groups.get(i.groupId) ?? []), i]);

  const purchases: InstallmentsReading["purchases"] = [];
  let lastKey = -1;
  groups.forEach((items) => {
    const upcoming = items.filter((i) => i.year * 12 + i.month - 1 >= nowKey);
    if (upcoming.length === 0) return;
    const first = items[0];
    const thisMonth = items.find((i) => i.year * 12 + i.month - 1 === nowKey) ?? upcoming.sort((a, b) => a.number - b.number)[0];
    const remaining = first.total - thisMonth.number + 1;
    lastKey = Math.max(lastKey, ...items.map((i) => i.year * 12 + i.month - 1));
    purchases.push({ name: first.name, category: first.category, amount: thisMonth.amount, current: thisMonth.number, total: first.total, remaining });
  });
  purchases.sort((a, b) => b.amount * b.remaining - a.amount * a.remaining);

  const monthly = purchases.reduce((s, p) => s + p.amount, 0);
  const remainingTotal = purchases.reduce((s, p) => s + p.amount * p.remaining, 0);
  const freeKey = lastKey >= 0 ? lastKey + 1 : null;
  const freeFrom = freeKey !== null ? `${MONTHS[freeKey % 12]} de ${Math.floor(freeKey / 12)}` : null;
  const incomeShare = income > 0 ? monthly / income : 0;

  const message = purchases.length === 0
    ? "Nenhuma parcela rolando. Seu eu do futuro agradece 🙌"
    : incomeShare >= 0.3
      ? `As parcelas levam ${Math.round(incomeShare * 100)}% da sua renda todo mês. Nada de parcelar mais nada por enquanto 🙏`
      : `${purchases.length} ${purchases.length === 1 ? "compra parcelada" : "compras parceladas"}. Você fica livre delas em ${freeFrom}.`;

  return { purchases, monthly, remainingTotal, freeFrom, incomeShare, message };
}

// ─── Weekday pattern ────────────────────────────────────────────────

export interface WeekdayReading {
  days: { label: string; avg: number }[];
  peak: number;
  weekendLift: number | null;
  message: string;
}

export function weekdayPattern(txs: RawTx[], today: Date): WeekdayReading {
  const since = new Date(today);
  since.setDate(since.getDate() - 90);
  const spend = txs.filter((t) => isSpend(t) && t.recurrence_type !== "fixa" && !(t.installments && t.installments > 1) && parseDate(t.date) >= since && parseDate(t.date) <= today);

  const totals = Array(7).fill(0);
  for (const t of spend) totals[parseDate(t.date).getDay()] += t.amount;
  // Occurrences of each weekday in the window, to get an average per day
  const occurrences = Array(7).fill(0);
  for (let d = new Date(since); d <= today; d.setDate(d.getDate() + 1)) occurrences[d.getDay()]++;
  const avgs = totals.map((t, i) => (occurrences[i] ? t / occurrences[i] : 0));

  const weekend = (avgs[0] + avgs[6]) / 2;
  const weekdays = (avgs[1] + avgs[2] + avgs[3] + avgs[4] + avgs[5]) / 5;
  const weekendLift = weekdays > 0 ? weekend / weekdays - 1 : null;
  const peak = avgs.indexOf(Math.max(...avgs));

  const message = spend.length < 5
    ? "Ainda preciso de mais alguns dias de gastos para achar seu padrão."
    : weekendLift !== null && weekendLift >= 0.3
      ? `Seus gastos disparam nos fins de semana: ${Math.round(weekendLift * 100)}% a mais por dia. Sábado é o seu Black Friday 🛍️`
      : weekendLift !== null && weekendLift <= -0.3
        ? `Você gasta mais durante a semana. ${WEEKDAYS_FULL[peak][0].toUpperCase()}${WEEKDAYS_FULL[peak].slice(1)} é o dia mais caro.`
        : `Seu dia mais caro é ${WEEKDAYS_FULL[peak]}, com média de ${brl(avgs[peak])}.`;

  return { days: avgs.map((avg, i) => ({ label: WEEKDAYS[i], avg })), peak, weekendLift, message };
}

// ─── Cash flow in the accounts ──────────────────────────────────────

export interface CashFlowReading {
  weeks: { label: string; income: number; expense: number }[];
  income: number;
  expense: number;
  net: number;
  biggestIn: RawTx | null;
  biggestOut: RawTx | null;
  message: string;
}

export function cashFlowReading(txs: RawTx[], today: Date): CashFlowReading {
  const month = txs.filter((t) => sameMonth(parseDate(t.date), today) && t.payment_method !== "cartao" && t.status === "pago");
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const ranges = [[1, 7], [8, 14], [15, 21], [22, daysInMonth]];
  const weeks = ranges.map(([a, b]) => {
    const inRange = month.filter((t) => { const d = parseDate(t.date).getDate(); return d >= a && d <= b; });
    return {
      label: `${a}–${b}`,
      income: inRange.filter((t) => t.type === "receita").reduce((s, t) => s + t.amount, 0),
      expense: inRange.filter((t) => t.type === "despesa").reduce((s, t) => s + t.amount, 0),
    };
  });
  const income = weeks.reduce((s, w) => s + w.income, 0);
  const expense = weeks.reduce((s, w) => s + w.expense, 0);
  const net = income - expense;
  const inflows = month.filter((t) => t.type === "receita").sort((a, b) => b.amount - a.amount);
  const outflows = month.filter((t) => t.type === "despesa").sort((a, b) => b.amount - a.amount);
  const heaviest = weeks.reduce((m, w, i) => (w.expense > weeks[m].expense ? i : m), 0);

  const message = income === 0 && expense === 0
    ? "Nenhuma movimentação paga nas contas este mês ainda."
    : net >= 0
      ? `Entrou mais do que saiu: ${brl(net)} a favor. A semana ${weeks[heaviest].label} foi a que mais pesou.`
      : `Saiu ${brl(-net)} a mais do que entrou nas contas. A semana ${weeks[heaviest].label} foi a mais pesada.`;

  return { weeks, income, expense, net, biggestIn: inflows[0] ?? null, biggestOut: outflows[0] ?? null, message };
}

// ─── Smart detection: leaks, duplicates, impulse ────────────────────

export interface Leak {
  id: string;
  kind: "assinatura" | "taxa" | "streaming";
  title: string;
  detail: string;
  monthly: number;
}

const FEE_WORDS = ["tarifa", "taxa", "iof", "juros", "anuidade", "multa", "encargo", "mensalidade conta", "cesta de servicos"];
const STREAMING = ["netflix", "spotify", "disney", "prime video", "amazon prime", "hbo", "max", "globoplay", "deezer", "youtube premium", "apple tv", "paramount", "crunchyroll", "star+"];

export function detectLeaks(txs: RawTx[], recurring: { name: string; amount: number; category: string; type: string }[], today: Date): { leaks: Leak[]; yearly: number } {
  const leaks: Leak[] = [];
  const since = new Date(today);
  since.setDate(since.getDate() - 90);

  // Small recurring charges that are easy to forget
  const smallRecurring = recurring.filter((r) => r.type === "despesa" && r.amount > 0 && r.amount <= 60);
  for (const r of smallRecurring) {
    leaks.push({ id: `rec-${r.name}`, kind: "assinatura", title: r.name, detail: `${brlCents(r.amount)} todo mês · ${brl(r.amount * 12)} por ano`, monthly: r.amount });
  }

  // Several streaming services at once
  const streams = recurring.filter((r) => r.type === "despesa" && STREAMING.some((s) => norm(r.name).includes(s)));
  if (streams.length >= 2) {
    const monthly = streams.reduce((s, r) => s + r.amount, 0);
    leaks.push({
      id: "streaming", kind: "streaming",
      title: `${streams.length} streamings ao mesmo tempo`,
      detail: `${streams.map((s) => s.name).join(", ")} · ${brlCents(monthly)} por mês`,
      monthly,
    });
  }

  // Bank fees, interest, IOF
  const fees = txs.filter((t) => t.type === "despesa" && parseDate(t.date) >= since && FEE_WORDS.some((w) => norm(t.name).includes(w) || norm(t.category).includes(w)));
  if (fees.length > 0) {
    const total = fees.reduce((s, t) => s + t.amount, 0);
    leaks.push({ id: "taxas", kind: "taxa", title: "Taxas, juros e tarifas", detail: `${fees.length} ${fees.length === 1 ? "cobrança" : "cobranças"} em 90 dias · ${brlCents(total)}`, monthly: total / 3 });
  }

  const unique = leaks.filter((l, i) => leaks.findIndex((o) => o.id === l.id) === i);
  return { leaks: unique, yearly: unique.reduce((s, l) => s + l.monthly * 12, 0) };
}

export interface DuplicateCharge {
  name: string;
  amount: number;
  dates: string[];
}

export function detectDuplicates(txs: RawTx[], today: Date): DuplicateCharge[] {
  const since = new Date(today);
  since.setDate(since.getDate() - 45);
  const spend = txs
    .filter((t) => t.type === "despesa" && parseDate(t.date) >= since && t.recurrence_type !== "fixa" && !(t.installments && t.installments > 1))
    .sort((a, b) => a.date.localeCompare(b.date));
  const found: DuplicateCharge[] = [];
  const used = new Set<string>();
  for (let i = 0; i < spend.length; i++) {
    for (let j = i + 1; j < spend.length; j++) {
      const a = spend[i], b = spend[j];
      if (used.has(a.id) || used.has(b.id)) continue;
      const days = (parseDate(b.date).getTime() - parseDate(a.date).getTime()) / 86400000;
      if (days > 2) break;
      if (Math.abs(a.amount - b.amount) < 0.01 && norm(a.name) === norm(b.name)) {
        found.push({ name: a.name, amount: a.amount, dates: [a.date, b.date] });
        used.add(a.id);
        used.add(b.id);
      }
    }
  }
  return found;
}

export interface ImpulseReading {
  count: number;
  total: number;
  share: number;
  message: string;
}

export function impulseReading(txs: RawTx[], today: Date): ImpulseReading | null {
  const since = new Date(today);
  since.setDate(since.getDate() - 60);
  const timed = txs.filter((t) => isSpend(t) && t.time && parseDate(t.date) >= since && t.recurrence_type !== "fixa");
  if (timed.length < 5) return null;
  const late = timed.filter((t) => {
    const hour = Number(t.time!.slice(0, 2));
    return hour >= 22 || hour < 6;
  });
  if (late.length === 0) return null;
  const total = late.reduce((s, t) => s + t.amount, 0);
  const share = total / timed.reduce((s, t) => s + t.amount, 0);
  return {
    count: late.length, total, share,
    message: late.length >= 3
      ? `${late.length} compras depois das 22h nos últimos 60 dias, somando ${brl(total)}. Compra de madrugada costuma ser impulso 🌙`
      : `${late.length} ${late.length === 1 ? "compra" : "compras"} tarde da noite (${brl(total)}). Fica de olho no carrinho da madrugada 🌙`,
  };
}

// ─── Goals countdown ────────────────────────────────────────────────

export interface GoalReading {
  goal: GoalRow;
  progress: number;
  monthly: number;
  monthsLeft: number | null;
  onTrack: boolean | null;
  neededMonthly: number | null;
  message: string;
}

export function goalReadings(goals: GoalRow[], today: Date): GoalReading[] {
  return goals
    .filter((g) => g.target > 0 && g.current < g.target)
    .map((goal) => {
      const remaining = goal.target - goal.current;
      const monthsSinceStart = Math.max((today.getTime() - new Date(goal.createdAt).getTime()) / (30.4 * 86400000), 1);
      const monthly = goal.monthlyContribution && goal.monthlyContribution > 0 ? goal.monthlyContribution : goal.current / monthsSinceStart;
      const monthsLeft = monthly > 0 ? Math.ceil(remaining / monthly) : null;
      const deadline = goal.deadline ? new Date(`${goal.deadline}T12:00:00`) : null;
      const monthsToDeadline = deadline ? Math.max((deadline.getFullYear() - today.getFullYear()) * 12 + deadline.getMonth() - today.getMonth(), 0) : null;
      const onTrack = monthsToDeadline === null || monthsLeft === null ? null : monthsLeft <= monthsToDeadline;
      const neededMonthly = monthsToDeadline ? remaining / Math.max(monthsToDeadline, 1) : null;

      const message = monthsLeft === null
        ? `Faltam ${brl(remaining)}. Faça o primeiro depósito para eu calcular o prazo.`
        : onTrack === false && neededMonthly
          ? `Nesse ritmo você não bate a meta no prazo. Guarde ${brl(neededMonthly)} por mês para chegar lá.`
          : `No ritmo atual, faltam ${monthsLeft} ${monthsLeft === 1 ? "mês" : "meses"} para bater a meta 🎯`;

      return { goal, progress: goal.current / goal.target, monthly, monthsLeft, onTrack, neededMonthly, message };
    });
}

// ─── Weekly summary ─────────────────────────────────────────────────

export interface WeeklySummary {
  /** One bar per day, oldest first. */
  days: { label: string; amount: number; today: boolean }[];
  spent: number;
  previous: number;
  change: number | null;
  topCategory: { name: string; amount: number } | null;
  biggest: RawTx | null;
  count: number;
  message: string;
}

export function weeklySummary(txs: RawTx[], today: Date): WeeklySummary {
  const start = new Date(today);
  start.setDate(start.getDate() - 6);
  const prevStart = new Date(start);
  prevStart.setDate(prevStart.getDate() - 7);
  const spend = txs.filter((t) => isSpend(t) && t.recurrence_type !== "fixa");
  const week = spend.filter((t) => { const d = parseDate(t.date); return d >= start && d <= today; });
  const prev = spend.filter((t) => { const d = parseDate(t.date); return d >= prevStart && d < start; });
  const spent = week.reduce((s, t) => s + t.amount, 0);
  const previous = prev.reduce((s, t) => s + t.amount, 0);
  const change = previous > 0 ? spent / previous - 1 : null;
  const cats = new Map<string, number>();
  for (const t of week) cats.set(t.category, (cats.get(t.category) ?? 0) + t.amount);
  const topCategory = [...cats.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount)[0] ?? null;

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = dayKey(d);
    return {
      label: WEEKDAYS[d.getDay()][0],
      amount: week.filter((t) => t.date === key).reduce((s, t) => s + t.amount, 0),
      today: key === dayKey(today),
    };
  });

  const message = week.length === 0
    ? "Semana sem gastos registrados. Esqueceu de lançar ou foi monge? 🧘"
    : change === null
      ? `${week.length} ${week.length === 1 ? "gasto" : "gastos"} nos últimos 7 dias.`
      : change <= -0.15
        ? `Você gastou ${Math.round(-change * 100)}% menos que na semana anterior. Semana campeã 🏆`
        : change >= 0.15
          ? `Você gastou ${Math.round(change * 100)}% a mais que na semana anterior. Semana animada, hein? 🎢`
          : "Semana parecida com a anterior. Constância é tudo.";

  return { days, spent, previous, change, topCategory, biggest: week.sort((a, b) => b.amount - a.amount)[0] ?? null, count: week.length, message };
}

// ─── Monthly wrap (stories) ─────────────────────────────────────────

export interface MonthWrap {
  monthLabel: string;
  income: number;
  expense: number;
  saved: number;
  savedPct: number | null;
  count: number;
  villain: { name: string; amount: number; share: number } | null;
  priciestDay: { date: string; amount: number; weekday: string } | null;
  biggest: RawTx | null;
  win: string;
  score: number | null;
  scoreDelta: number | null;
}

export function monthWrap(month: DashboardData, previousMonth: DashboardData | null, txs: RawTx[], ref: Date, score: number | null, previousScore: number | null): MonthWrap | null {
  const spend = txs.filter((t) => isSpend(t) && sameMonth(parseDate(t.date), ref));
  if (month.transactions.length === 0 && spend.length === 0) return null;
  const expense = month.despesas;
  const income = month.receitas;

  const cats = [...month.categories].sort((a, b) => b.amount - a.amount);
  const villainCat = cats[0] ? { name: cats[0].name, amount: cats[0].amount, share: expense > 0 ? cats[0].amount / expense : 0 } : null;

  const byDay = new Map<string, number>();
  for (const t of spend) byDay.set(t.date, (byDay.get(t.date) ?? 0) + t.amount);
  const [dayDate, dayAmount] = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
  const priciestDay = dayDate ? { date: dayDate, amount: dayAmount, weekday: WEEKDAYS_FULL[parseDate(dayDate).getDay()] } : null;

  // Best win: category that dropped the most vs the month before, or savings
  let win = income - expense > 0 ? `Sobraram ${brl(income - expense)} no fim do mês 💰` : "Você registrou tudo e encarou os números. Isso já é meio caminho 💪";
  if (previousMonth) {
    const prev = new Map(previousMonth.categories.map((c) => [c.name, c.amount]));
    const drops = month.categories
      .map((c) => ({ name: c.name, drop: (prev.get(c.name) ?? 0) - c.amount, prev: prev.get(c.name) ?? 0 }))
      .filter((d) => d.prev >= 100 && d.drop > 0)
      .sort((a, b) => b.drop - a.drop);
    if (drops[0] && drops[0].drop / drops[0].prev >= 0.15) {
      win = `Você cortou ${Math.round((drops[0].drop / drops[0].prev) * 100)}% em ${drops[0].name}, ${brl(drops[0].drop)} a menos 🏆`;
    }
  }

  return {
    monthLabel: MONTHS[ref.getMonth()],
    income, expense,
    saved: income - expense,
    savedPct: income > 0 ? (income - expense) / income : null,
    count: month.transactions.length,
    villain: villainCat,
    priciestDay,
    biggest: [...spend].sort((a, b) => b.amount - a.amount)[0] ?? null,
    win,
    score,
    scoreDelta: score !== null && previousScore !== null ? score - previousScore : null,
  };
}
