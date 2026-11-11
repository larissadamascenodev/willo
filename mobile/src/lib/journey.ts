import { supabase } from "@/integrations/supabase/client";
import { readOnboardingAnswers } from "~/lib/onboarding";
import { profileOf, hourValue, type OnboardingAnswers } from "~/lib/onboardingProfile";

/**
 * Sua Jornada: where the person's money stands, worked out from their own records,
 * again every time it is opened.
 *
 * Five stages, in order. A stage is read from closed months (so one bad Tuesday does
 * not knock anyone down) and from what is overdue today (which does). It goes up and
 * it goes down; the last one seen is kept on the phone so a change can be told.
 *
 * Under the stage: what is missing to reach the next one, each with its numbers; the
 * mini-metas of the moment, chosen by the app from the records and never skipped,
 * because each is simply something the records will show done or not; and points,
 * counted from everything already done in the past months (bills paid on time,
 * invoices paid, months closed above zero, months with something put away).
 *
 * Until there is a month of records, the stage is the one the first questions gave,
 * marked as an estimate.
 */

export const STAGES = ["Recomeço", "Apagando incêndios", "Equilíbrio", "Construção", "Crescimento"] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LINE: Record<Stage, string> = {
  "Recomeço": "Você está reorganizando a casa. Uma conta de cada vez, e a gente sai dessa.",
  "Apagando incêndios": "O mês aperta antes de acabar. O próximo passo é ver o aperto antes de ele chegar.",
  "Equilíbrio": "O mês fecha no azul. Agora é transformar a sobra em folga.",
  "Construção": "Você guarda todo mês. Agora é fazer a reserva crescer.",
  "Crescimento": "Você tem base e constância. Agora é crescer com calma.",
};

export interface Requirement {
  label: string;
  done: boolean;
  /** 0..1 */
  progress: number;
  /** What is left, in words: "faltam R$ 180", "hoje 52%". */
  detail: string;
}

export interface MiniGoal {
  id: string;
  title: string;
  detail: string;
  points: number;
  /** 0..1 */
  progress: number;
  done: boolean;
  /** Where tapping it leads. */
  href: string;
  tone: "urgente" | "normal";
}

export interface Trait {
  label: string;
  value: number;
  word: string;
}

export interface Journey {
  stage: Stage;
  index: number;
  estimated: boolean;
  /** Days of records still needed before the stage stops being an estimate. */
  daysToReal: number;
  line: string;
  next: Stage | null;
  /** 0..1, how far towards the next stage. */
  toNext: number;
  requirements: Requirement[];
  goals: MiniGoal[];
  points: number;
  /** Points from the mini-metas done this month. */
  pointsThisMonth: number;
  traits: Trait[];
  strong: Trait;
  weak: Trait;
  hour: number;
  watching: string[];
  /** Set when the stage is not the one seen last time. */
  change: { from: Stage; to: Stage; up: boolean } | null;
  numbers: { income: number; spend: number; net: number; cardShare: number; reserveMonths: number; overdue: number; savedThisMonth: number };
}

type Tx = { id: string; name: string; type: string; status: string; amount: number; date: string; category: string; payment_method: string; credit_card_id: string | null; created_at: string; updated_at: string };

const money = (v: number) => `R$ ${Math.round(Math.abs(v)).toLocaleString("pt-BR")}`;
const pct = (v: number) => `${Math.round(v * 100)}%`;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const word = (v: number) => (v >= 0.7 ? "Bom" : v >= 0.45 ? "Médio" : "Pede atenção");
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const whenSaid = (dueIso: string, now: Date) => {
  const due = new Date(`${dueIso}T00:00:00`);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - start.getTime()) / 86_400_000);
  if (days < 0) return days === -1 ? "venceu ontem" : `venceu há ${-days} dias`;
  if (days === 0) return "vence hoje";
  if (days === 1) return "vence amanhã";
  if (days < 7) return `vence ${WEEKDAYS[due.getDay()]}`;
  return `vence dia ${due.getDate()}`;
};

/** Spending kinds the person said weigh on them (onboarding habits), by category word. */
const HABIT_CATEGORY: Record<string, { label: string; match: RegExp }> = {
  delivery: { label: "Delivery", match: /delivery/i },
  online: { label: "Compras online", match: /compras online/i },
  saidas: { label: "Bares e restaurantes", match: /restaurantes|bares/i },
  beleza: { label: "Beleza", match: /beleza|bem-estar/i },
  mercado: { label: "Mercado", match: /supermercado|alimentos/i },
  transporte: { label: "Transporte", match: /táxi|transporte/i },
  assinaturas: { label: "Assinaturas", match: /assinaturas|streaming/i },
};

const SEEN_KEY = "willo:journey:stage";

function seenStage(userId: string): Stage | null {
  try {
    const v = localStorage.getItem(`${SEEN_KEY}:${userId}`);
    return v && (STAGES as readonly string[]).includes(v) ? (v as Stage) : null;
  } catch {
    return null;
  }
}
function keepStage(userId: string, s: Stage) {
  try {
    localStorage.setItem(`${SEEN_KEY}:${userId}`, s);
  } catch {
    /* Only this session. */
  }
}

export async function loadJourney(userId: string): Promise<Journey> {
  const now = new Date();
  const today = iso(now);
  const from = iso(new Date(now.getFullYear(), now.getMonth() - 3, 1));
  const monthEnd = iso(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  const [txRes, invRes, cardRes, accRes, goalRes, gtRes, answers] = await Promise.all([
    supabase
      .from("transactions")
      .select("id, name, type, status, amount, date, category, payment_method, credit_card_id, created_at, updated_at")
      .eq("user_id", userId)
      .gte("date", from)
      .lte("date", monthEnd)
      .limit(5000),
    supabase.from("invoices").select("id, credit_card_id, month, year, total_amount, paid_amount, is_paid, paid_at").eq("user_id", userId).gte("year", now.getFullYear() - 1),
    supabase.from("credit_cards").select("id, name, due_day").eq("user_id", userId),
    supabase.from("accounts").select("current_balance, type, is_active").eq("user_id", userId),
    supabase.from("goals").select("id, name, current_amount, target_amount").eq("user_id", userId),
    supabase.from("goal_transactions").select("amount, date").eq("user_id", userId).gte("date", from),
    readOnboardingAnswers<OnboardingAnswers>(),
  ]);

  const txs = ((txRes.data ?? []) as Tx[]).filter((t) => t.type !== "transferencia");
  const cards = new Map(((cardRes.data ?? []) as { id: string; name: string; due_day: number }[]).map((c) => [c.id, c]));
  const invoices = (invRes.data ?? []) as { id: string; credit_card_id: string; month: number; year: number; total_amount: number; paid_amount: number; is_paid: boolean; paid_at: string | null }[];
  const accounts = (accRes.data ?? []) as { current_balance: number; type: string; is_active: boolean }[];
  const goals = (goalRes.data ?? []) as { id: string; name: string; current_amount: number; target_amount: number }[];
  const deposits = (gtRes.data ?? []) as { amount: number; date: string }[];

  /* ── Months: the three closed ones and this one ── */
  const monthKey = (d: string) => d.slice(0, 7);
  const keys = [3, 2, 1, 0].map((back) => iso(new Date(now.getFullYear(), now.getMonth() - back, 1)).slice(0, 7));
  const thisKey = keys[3];
  const sum = (list: Tx[]) => list.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const months = keys.map((k) => {
    const inMonth = txs.filter((t) => monthKey(t.date) === k);
    const income = sum(inMonth.filter((t) => t.type === "receita" && t.status === "pago"));
    const spend = sum(inMonth.filter((t) => t.type === "despesa"));
    const saved = deposits.filter((g) => monthKey(g.date) === k && g.amount > 0).reduce((s, g) => s + Number(g.amount), 0);
    const recorded = inMonth.length;
    return { key: k, income, spend, net: income - spend, saved, recorded };
  });
  const closed = months.slice(0, 3).filter((m) => m.recorded > 0);
  const last = closed[closed.length - 1] ?? null;
  const current = months[3];
  const declaredIncome = answers?.income ?? 0;
  const income = Math.max(last?.income ?? 0, current.income, declaredIncome);
  const avgSpend = closed.length ? closed.reduce((s, m) => s + m.spend, 0) / closed.length : current.spend || income;

  /* ── Today ── */
  const overdueBills = txs.filter((t) => t.type === "despesa" && t.status === "pendente" && !t.credit_card_id && t.payment_method !== "cartao" && t.date < today);
  const invoiceDue = (inv: (typeof invoices)[number]) => {
    const card = cards.get(inv.credit_card_id);
    return card ? iso(new Date(inv.year, inv.month - 1, card.due_day)) : null;
  };
  const overdueInvoices = invoices.filter((inv) => !inv.is_paid && Number(inv.total_amount) > 0 && (invoiceDue(inv) ?? "9999") < today);
  const overdue = overdueBills.length + overdueInvoices.length;
  const openInvoices = invoices.filter((inv) => !inv.is_paid && Number(inv.total_amount) > 0 && (invoiceDue(inv) ?? "") >= today);
  const nextInvoiceTotal = openInvoices.sort((a, b) => (invoiceDue(a) ?? "").localeCompare(invoiceDue(b) ?? ""))[0]?.total_amount ?? 0;
  const cardShare = income > 0 ? Number(nextInvoiceTotal) / income : 0;
  const reserve =
    goals.reduce((s, g) => s + Math.max(0, Number(g.current_amount) || 0), 0) +
    accounts.filter((a) => a.is_active !== false && a.type === "investment").reduce((s, a) => s + Math.max(0, Number(a.current_balance) || 0), 0);
  const reserveMonths = avgSpend > 0 ? reserve / avgSpend : 0;
  const netShare = last && last.income > 0 ? last.net / last.income : current.income > 0 ? current.net / current.income : 0;
  const savingMonths = months.slice(0, 3).filter((m) => m.saved > 0).length;

  /* ── Enough records to judge? A month of entries. ── */
  const firstRecord = txs.reduce<string | null>((min, t) => (!min || t.created_at < min ? t.created_at : min), null);
  const daysOfRecords = firstRecord ? Math.floor((now.getTime() - new Date(firstRecord).getTime()) / 86_400_000) : 0;
  const estimated = daysOfRecords < 30 || closed.length === 0;

  /* ── The stage ── */
  let index: number;
  if (estimated) {
    const t = answers ? profileOf(answers).type : "Equilíbrio";
    index = Math.max(0, (STAGES as readonly string[]).indexOf(t));
    if (overdue > 0) index = Math.min(index, 0);
  } else if (overdue > 0 || netShare < -0.1 || cardShare >= 0.8) index = 0;
  else if (netShare < 0 || cardShare >= 0.5 || (reserveMonths < 0.5 && netShare < 0.05)) index = 1;
  else if (netShare >= 0.1 && savingMonths >= 3 && reserveMonths >= 3 && cardShare <= 0.3) index = 4;
  else if (netShare >= 0.1 && savingMonths >= 2 && reserveMonths >= 1) index = 3;
  else index = 2;
  const stage = STAGES[index];
  const next = index < STAGES.length - 1 ? STAGES[index + 1] : null;

  /* ── What the next stage asks ── */
  const short = (need: number, have: number) => (have >= need ? "feito" : `faltam ${money(need - have)}`);
  const reqs: Requirement[] = [];
  const addNoOverdue = () => reqs.push({ label: "Nenhuma conta atrasada", done: overdue === 0, progress: overdue === 0 ? 1 : 0, detail: overdue === 0 ? "feito" : `${overdue} ${overdue === 1 ? "atrasada" : "atrasadas"}` });
  const monthNet = current.income - current.spend;
  const needSurplus = (share: number) => {
    const need = Math.max(0, income * share);
    reqs.push({
      label: share > 0 ? `Fechar o mês sobrando ${pct(share)} da renda` : "Fechar o mês no positivo",
      done: monthNet >= need && current.income > 0,
      progress: clamp(income > 0 ? (monthNet + income * 0.2) / (need + income * 0.2) : 0),
      detail: short(need, monthNet),
    });
  };
  const needCard = (limit: number) =>
    reqs.push({ label: `Fatura abaixo de ${pct(limit)} da renda`, done: cardShare <= limit, progress: clamp(cardShare > 0 ? limit / cardShare : 1), detail: cardShare <= limit ? "feito" : `hoje ${pct(cardShare)}` });
  const needReserve = (months: number) =>
    reqs.push({ label: `Reserva de ${months} ${months === 1 ? "mês" : "meses"} de gastos`, done: reserveMonths >= months, progress: clamp(reserveMonths / months), detail: short(avgSpend * months, reserve) });
  const needSaving = (n: number) =>
    reqs.push({ label: `Guardar algo em ${n} meses seguidos`, done: savingMonths >= n, progress: clamp(savingMonths / n), detail: savingMonths >= n ? "feito" : `${savingMonths} de ${n}` });

  if (next === "Apagando incêndios") {
    addNoOverdue();
    const floor = -income * 0.1;
    reqs.push({ label: "Fechar o mês faltando menos de 10% da renda", done: monthNet >= floor, progress: clamp(monthNet >= floor ? 1 : 1 - (floor - monthNet) / Math.max(1, income)), detail: monthNet >= floor ? "feito" : `faltam ${money(floor - monthNet)}` });
    needCard(0.8);
  } else if (next === "Equilíbrio") {
    addNoOverdue();
    needSurplus(0);
    needCard(0.5);
  } else if (next === "Construção") {
    needSurplus(0.1);
    needSaving(2);
    needReserve(1);
  } else if (next === "Crescimento") {
    needSaving(3);
    needReserve(3);
    needCard(0.3);
  }
  const toNext = reqs.length ? reqs.reduce((s, r) => s + (r.done ? 1 : r.progress), 0) / reqs.length : 1;

  /* ── Mini-metas: three at a time, from the records ── */
  const goalsOut: MiniGoal[] = [];
  for (const t of overdueBills.slice(0, 2)) {
    goalsOut.push({ id: `atrasada-${t.id}`, title: `Quitar ${t.name}`, detail: `${money(Number(t.amount))} · ${whenSaid(t.date, now)}`, points: 40, progress: 0, done: false, href: "/transacoes", tone: "urgente" });
  }
  for (const inv of overdueInvoices.slice(0, 1)) {
    const card = cards.get(inv.credit_card_id);
    goalsOut.push({ id: `fatura-atrasada-${inv.id}`, title: `Pagar a fatura ${card?.name ?? ""}`.trim(), detail: `${money(Number(inv.total_amount) - Number(inv.paid_amount || 0))} · ${whenSaid(invoiceDue(inv)!, now)}`, points: 50, progress: clamp(Number(inv.paid_amount || 0) / Number(inv.total_amount)), done: false, href: `/fatura/${inv.credit_card_id}`, tone: "urgente" });
  }
  const soon = iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 10));
  const upcoming = txs
    .filter((t) => t.type === "despesa" && t.status === "pendente" && !t.credit_card_id && t.payment_method !== "cartao" && t.date >= today && t.date <= soon)
    .sort((a, b) => a.date.localeCompare(b.date));
  for (const t of upcoming.slice(0, 2)) {
    goalsOut.push({ id: `conta-${t.id}`, title: `Pagar ${t.name} em dia`, detail: `${money(Number(t.amount))} · ${whenSaid(t.date, now)}`, points: 30, progress: 0, done: false, href: "/transacoes", tone: "normal" });
  }
  const nextInv = openInvoices[0];
  if (nextInv && invoiceDue(nextInv)! <= soon) {
    const card = cards.get(nextInv.credit_card_id);
    goalsOut.push({ id: `fatura-${nextInv.id}`, title: `Pagar a fatura ${card?.name ?? ""} em dia`.trim(), detail: `${money(Number(nextInv.total_amount))} · ${whenSaid(invoiceDue(nextInv)!, now)}`, points: 40, progress: clamp(Number(nextInv.paid_amount || 0) / Number(nextInv.total_amount)), done: false, href: `/fatura/${nextInv.credit_card_id}`, tone: "normal" });
  }
  /* A week's cap on what weighs most, from the habits they named or the top category. */
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const weekFrom = iso(weekStart);
  const habit = (answers?.habits ?? []).map((h) => HABIT_CATEGORY[h]).find(Boolean);
  if (habit) {
    const history = txs.filter((t) => t.type === "despesa" && habit.match.test(t.category) && t.date < weekFrom);
    const weeks = Math.max(1, Math.round((weekStart.getTime() - new Date(from).getTime()) / (7 * 86_400_000)));
    const perWeek = sum(history) / weeks;
    const cap = Math.max(30, Math.round((perWeek * 0.8) / 10) * 10);
    const spent = sum(txs.filter((t) => t.type === "despesa" && habit.match.test(t.category) && t.date >= weekFrom && t.date <= today));
    goalsOut.push({ id: `teto-${habit.label}`, title: `${habit.label} até ${money(cap)} na semana`, detail: `${money(spent)} de ${money(cap)}`, points: 40, progress: clamp(spent / cap), done: false, href: "/categorias", tone: spent > cap ? "urgente" : "normal" });
  }
  const saveShare = index <= 1 ? 0.03 : index === 2 ? 0.05 : 0.1;
  const saveTarget = Math.max(20, Math.round((income * saveShare) / 10) * 10);
  goalsOut.push({ id: "guardar", title: `Guardar ${money(saveTarget)} este mês`, detail: `${money(current.saved)} de ${money(saveTarget)} guardados`, points: 50, progress: clamp(current.saved / saveTarget), done: current.saved >= saveTarget, href: "/gestao", tone: "normal" });
  goalsOut.push({ id: "positivo", title: "Fechar o mês no positivo", detail: monthNet >= 0 ? `sobrando ${money(monthNet)} até agora` : `faltam ${money(-monthNet)}`, points: 60, progress: clamp(current.income > 0 ? current.income / Math.max(1, current.spend) : 0), done: false, href: "/fluxo-de-caixa", tone: monthNet < 0 ? "urgente" : "normal" });
  const goals3 = goalsOut.slice(0, 3);

  /* ── Points: what the records already show done ── */
  const paidOnTime = txs.filter((t) => t.type === "despesa" && t.status === "pago" && !t.credit_card_id && t.payment_method !== "cartao" && t.updated_at.slice(0, 10) <= t.date).length;
  const invoicesPaid = invoices.filter((i) => i.is_paid).length;
  const positiveMonths = months.slice(0, 3).filter((m) => m.recorded > 0 && m.net >= 0).length;
  const points = paidOnTime * 10 + invoicesPaid * 20 + positiveMonths * 60 + savingMonths * 50;
  const pointsThisMonth =
    txs.filter((t) => monthKey(t.date) === thisKey && t.type === "despesa" && t.status === "pago" && !t.credit_card_id && t.payment_method !== "cartao" && t.updated_at.slice(0, 10) <= t.date).length * 10 +
    invoices.filter((i) => i.is_paid && i.paid_at?.slice(0, 7) === thisKey).length * 20 +
    (current.saved > 0 ? 50 : 0);

  /* ── The profile, from the records (or the answers while estimated) ── */
  const traits: Trait[] = estimated && answers
    ? profileOf(answers).traits
    : (() => {
        const slack = clamp(0.5 + netShare * 2.5);
        const card = clamp(1 - cardShare * 1.4);
        const res = clamp(reserveMonths / 3);
        const habitsSpend = sum(txs.filter((t) => t.type === "despesa" && monthKey(t.date) !== thisKey && /delivery|compras online|restaurantes|bares|beleza/i.test(t.category)));
        const impulse = clamp(1 - (closed.length ? habitsSpend / closed.length / Math.max(1, income) : 0) * 4);
        return [
          { label: "Folga no fim do mês", value: slack, word: word(slack) },
          { label: "Controle do cartão", value: card, word: word(card) },
          { label: "Reserva para imprevistos", value: res, word: word(res) },
          { label: "Controle de impulso", value: impulse, word: word(impulse) },
        ];
      })();
  const sorted = [...traits].sort((a, b) => b.value - a.value);
  const watching = (answers?.habits ?? []).map((h) => HABIT_CATEGORY[h]?.label).filter(Boolean) as string[];
  if (!watching.includes("Fatura do cartão") && invoices.length) watching.unshift("Fatura do cartão");

  /* ── Did it change since last time? ── */
  const seen = seenStage(userId);
  const change = seen && seen !== stage ? { from: seen, to: stage, up: STAGES.indexOf(stage) > STAGES.indexOf(seen) } : null;
  keepStage(userId, stage);

  return {
    stage,
    index,
    estimated,
    daysToReal: Math.max(0, 30 - daysOfRecords),
    line: STAGE_LINE[stage],
    next,
    toNext,
    requirements: reqs,
    goals: goals3,
    points,
    pointsThisMonth,
    traits,
    strong: sorted[0],
    weak: sorted[sorted.length - 1],
    hour: hourValue(income),
    watching: watching.slice(0, 4),
    change,
    numbers: { income, spend: avgSpend, net: monthNet, cardShare, reserveMonths, overdue, savedThisMonth: current.saved },
  };
}

/* ── Kept on the phone, so the home card opens filled in ── */

const CACHE_KEY = "willo:journey:last";

export function cachedJourney(userId: string | null | undefined): Journey | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(`${CACHE_KEY}:${userId}`);
    return raw ? ({ ...(JSON.parse(raw) as Journey), change: null }) : null;
  } catch {
    return null;
  }
}

export function rememberJourney(userId: string, j: Journey) {
  try {
    localStorage.setItem(`${CACHE_KEY}:${userId}`, JSON.stringify(j));
  } catch {
    /* Only this session. */
  }
}
