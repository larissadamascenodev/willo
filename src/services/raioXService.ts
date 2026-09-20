/**
 * Raio-X — the app's financial brain.
 * Turns the month's transactions, limits, cards and recurring bills into a
 * 0–1000 health score, friendly radar insights, savings opportunities and a
 * "keep going vs. save" projection. Pure functions: no fetching here.
 */

import type { DashboardData } from "@/types/finance";
import type { OverviewCard, OverviewInstallment, OverviewInvoice } from "@/hooks/useCardsOverview";

import { currencySymbol, getCurrency } from "@/lib/currency";
// ─── Types ──────────────────────────────────────────────────────────

export interface RaioXInput {
  today: Date;
  current: DashboardData;
  /** Previous months, most recent first (up to 3). */
  history: DashboardData[];
  limits: { category: string; limit: number }[];
  cards: OverviewCard[];
  invoices: OverviewInvoice[];
  installments: OverviewInstallment[];
  recurring: { name: string; amount: number; category: string; type: string }[];
  /** Money set aside: goals saved + investment account balances. */
  reserve: number;
}

export type PillarKey = "contas" | "sobra" | "saldo" | "gastos" | "credito" | "reserva";
export type Tone = "otimo" | "ok" | "atencao" | "critico";

export interface Pillar {
  key: PillarKey;
  label: string;
  points: number;
  max: number;
  tone: Tone;
  detail: string;
}

export type InsightKind = "alerta" | "atencao" | "conquista" | "dica";
export type InsightIcon =
  | "flame" | "limit" | "calendar" | "card" | "repeat" | "coffee" | "trending-down"
  | "trending-up" | "trophy" | "shield" | "wallet" | "piggy" | "income";

export type InsightAction =
  | { type: "limit"; category: string; suggested?: number }
  | { type: "navigate"; to: string; label: string };

export interface Insight {
  id: string;
  /** What to do about it, in one sentence. */
  tip?: string;
  action?: InsightAction;
  kind: InsightKind;
  icon: InsightIcon;
  title: string;
  message: string;
  value?: number;
  category?: string;
  /** Used to order within the same kind. */
  weight: number;
}

export interface Opportunity {
  category: string;
  base: number;
  average: number;
  aboveAverage: number;
}

export interface MonthPulse {
  income: number;
  expense: number;
  paidExpense: number;
  pendingExpense: number;
  free: number;
  perDay: number;
  daysLeft: number;
  dayOfMonth: number;
  daysInMonth: number;
  projectedExpense: number;
  savingsRate: number | null;
}

export interface ScoreLevel {
  key: "excelente" | "bom" | "atencao" | "critico";
  label: string;
  hex: string;
}

export interface RaioXReport {
  score: number;
  level: ScoreLevel;
  headline: string;
  pillars: Pillar[];
  pulse: MonthPulse;
  insights: Insight[];
  opportunities: Opportunity[];
  projection: { avgNet: number; start: number };
  hasData: boolean;
}

export const SCORE_MAX = 1000;

// ─── Helpers ────────────────────────────────────────────────────────

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency(), maximumFractionDigits: 0 });
const brlCents = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** Deterministic pick so messages don't reshuffle on every render. */
function pick<T>(options: T[], seed: string): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return options[h % options.length];
}

const toneOf = (points: number, max: number): Tone => {
  const r = points / max;
  return r >= 0.85 ? "otimo" : r >= 0.6 ? "ok" : r >= 0.35 ? "atencao" : "critico";
};

export function scoreLevel(score: number): ScoreLevel {
  if (score >= 800) return { key: "excelente", label: "Excelente", hex: "#C8F36D" };
  if (score >= 620) return { key: "bom", label: "Bom", hex: "#7DD3FC" };
  if (score >= 420) return { key: "atencao", label: "Atenção", hex: "#FCD34D" };
  return { key: "critico", label: "Crítico", hex: "#F87171" };
}

/** Categories where cutting back is a lifestyle choice, not a bill. */
const DISCRETIONARY = [
  "delivery", "restaurante", "restaurantes", "fast food", "cafeteria", "bebidas", "lazer", "compras",
  "vestuario", "tecnologia", "eletronicos", "assinaturas", "streaming", "beleza", "cosmeticos",
  "jogos", "cinema", "festas", "presentes", "viagem", "alimentacao", "padaria",
];

// Friendly lines per category group — {v} is the amount spent.
const OVERSPEND_LINES: { match: string[]; lines: string[] }[] = [
  { match: ["delivery", "ifood"], lines: [
    "Você já gastou {v} com delivery. Mais um pouco e vira sócio do iFood 🍔",
    "{v} em delivery este mês. O motoboy já sabe seu nome de cor 🛵",
    "Delivery somou {v}. Sua cozinha está com saudade de você 🍳",
  ] },
  { match: ["restaurante", "restaurantes", "fast food", "cafeteria", "padaria", "bebidas"], lines: [
    "{v} comendo fora. Os garçons já guardam sua mesa 🍽️",
    "Já foram {v} em restaurantes e cafés. Tá virando crítico gastronômico? ☕",
  ] },
  { match: ["supermercado", "alimentacao", "mercado"], lines: [
    "O carrinho do mercado pesou: {v} até agora 🛒",
    "{v} no mercado. Tá abastecendo a casa ou o bairro? 🛒",
  ] },
  { match: ["transporte", "combustivel", "estacionamento", "uber"], lines: [
    "{v} em transporte. O Uber já te trata como cliente VIP 🚗",
    "Transporte somou {v}. Quem sabe uma caminhada de vez em quando? 🚶",
  ] },
  { match: ["lazer", "jogos", "cinema", "festas"], lines: [
    "{v} em lazer. A vida é pra curtir, mas o bolso também quer 🎉",
    "Lazer chegou a {v}. Diversão garantida, orçamento nem tanto 🎟️",
  ] },
  { match: ["vestuario", "compras", "cosmeticos", "beleza"], lines: [
    "{v} em compras. O cartão pediu uma pausa no provador 🛍️",
    "Já foram {v} em compras. O guarda-roupa agradece, a conta nem tanto 👗",
  ] },
  { match: ["tecnologia", "eletronicos"], lines: [
    "{v} em tecnologia. Upgrade no setup, downgrade no saldo 💻",
  ] },
  { match: ["assinaturas", "streaming"], lines: [
    "{v} em assinaturas. Você assiste tudo isso mesmo? 📺",
  ] },
  { match: ["pets"], lines: ["{v} com o pet. Ele merece, mas vamos com calma 🐶"] },
  { match: ["viagem"], lines: ["{v} em viagens. A mala tá cheia e o saldo leve ✈️"] },
];

function overspendLine(category: string, value: number, seed: string) {
  const n = normalize(category);
  const group = OVERSPEND_LINES.find((g) => g.match.some((m) => n.includes(m)));
  const line = group
    ? pick(group.lines, seed)
    : pick(["{v} em {c} este mês, bem acima do seu normal 👀", "{c} deu uma acelerada: {v} até agora 📈"], seed);
  return line.replace("{v}", brl(value)).replace("{c}", category);
}

function categoryTotals(data: DashboardData) {
  const map = new Map<string, number>();
  for (const c of data.categories) map.set(c.name, (map.get(c.name) ?? 0) + c.amount);
  return map;
}

function monthKey(date: Date) {
  return date.getFullYear() * 12 + date.getMonth();
}

function invoiceDue(card: OverviewCard, inv: OverviewInvoice) {
  const lastDay = new Date(inv.year, inv.month, 0).getDate();
  return new Date(inv.year, inv.month - 1, Math.min(card.dueDay, lastDay));
}

// ─── Engine ─────────────────────────────────────────────────────────

export function buildRaioX(input: RaioXInput): RaioXReport {
  const { today, current, history, limits, cards, invoices, installments, recurring, reserve } = input;
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const dayOfMonth = today.getDate();
  const daysLeft = Math.max(daysInMonth - dayOfMonth + 1, 1);
  const pace = Math.max(dayOfMonth / daysInMonth, 0.2);
  const seed = `${today.getFullYear()}-${today.getMonth()}`;

  const income = current.receitas;
  const expense = current.despesas;
  const paidExpense = current.despesasPagas;
  const pendingExpense = Math.max(expense - paidExpense, 0);
  const hasData = current.transactions.length > 0 || current.events.length > 0 || history.some((h) => h.transactions.length > 0);

  // Averages from previous months that have data
  const pastMonths = history.filter((h) => h.transactions.length > 0);
  const avgByCategory = new Map<string, number>();
  for (const h of pastMonths) {
    for (const [name, amount] of categoryTotals(h)) avgByCategory.set(name, (avgByCategory.get(name) ?? 0) + amount);
  }
  for (const [name, total] of avgByCategory) avgByCategory.set(name, total / pastMonths.length);
  const avgIncome = pastMonths.length ? pastMonths.reduce((s, h) => s + h.receitas, 0) / pastMonths.length : 0;

  const currentByCategory = categoryTotals(current);
  const insights: Insight[] = [];
  const add = (i: Insight) => insights.push(i);

  // ── Pillar 1: bills on time ─────────────────────────────────────
  const overdueEvents = current.events.filter((e) => {
    if (e.type === "receita" || e.status === "pago" || e.status === "recebido") return false;
    if (e.status === "atrasado") return true;
    return !!e.rawDate && new Date(`${e.rawDate}T12:00:00`) < startOfToday;
  });
  const cardById = new Map(cards.map((c) => [c.id, c]));
  const overdueInvoices = invoices.filter((inv) => {
    const card = cardById.get(inv.cardId);
    return card && !inv.isPaid && inv.total > 0 && invoiceDue(card, inv) < startOfToday;
  });
  const overdueCount = overdueEvents.length + overdueInvoices.length;
  const contasPoints = overdueCount === 0 ? 200 : overdueCount === 1 ? 120 : overdueCount === 2 ? 70 : 30;

  for (const e of overdueEvents.slice(0, 2)) {
    add({
      id: `atraso-${e.id}`, kind: "alerta", icon: "calendar", weight: e.amount,
      title: `${e.name} está atrasada`,
      message: `${brlCents(e.amount)} esperando pagamento. Juros adoram atraso, você não 😬`,
      tip: "Pague hoje para evitar multa e juros.",
      action: { type: "navigate", to: "/transacoes", label: "Ver conta" },
      value: e.amount,
    });
  }
  for (const inv of overdueInvoices) {
    const card = cardById.get(inv.cardId)!;
    add({
      id: `fatura-atrasada-${inv.id}`, kind: "alerta", icon: "card", weight: inv.total,
      title: `Fatura do ${card.name} vencida`,
      message: `${brlCents(inv.total - inv.paid)} em aberto. Paga logo antes que os juros façam a festa 🎈`,
      tip: "Quite a fatura ou pelo menos o valor mínimo hoje.",
      action: { type: "navigate", to: `/fatura/${card.id}`, label: "Abrir fatura" },
      value: inv.total - inv.paid,
    });
  }

  // Invoices due soon
  for (const inv of invoices) {
    const card = cardById.get(inv.cardId);
    if (!card || inv.isPaid || inv.total <= 0) continue;
    const days = Math.round((invoiceDue(card, inv).getTime() - startOfToday.getTime()) / 86400000);
    if (days >= 0 && days <= 5) {
      add({
        id: `fatura-${inv.id}`, kind: "atencao", icon: "card", weight: inv.total,
        title: days === 0 ? `Fatura do ${card.name} vence hoje` : `Fatura do ${card.name} vence em ${days} ${days === 1 ? "dia" : "dias"}`,
        message: `${brlCents(inv.total - inv.paid)} pra pagar. ${current.saldoAtual >= inv.total - inv.paid ? "Seu saldo cobre, é só não esquecer 😉" : "Seu saldo ainda não cobre, bora se organizar 🧮"}`,
        action: { type: "navigate", to: `/fatura/${card.id}`, label: "Ver fatura" },
        value: inv.total - inv.paid,
      });
    }
  }

  // ── Pillar 2: money left at the end of the month ───────────────
  const savingsRate = income > 0 ? (income - expense) / income : null;
  const sobraPoints =
    savingsRate === null ? (expense > 0 ? 30 : 100)
      : savingsRate >= 0.2 ? 200 : savingsRate >= 0.1 ? 160 : savingsRate >= 0.05 ? 120 : savingsRate >= 0 ? 80 : 20;

  // ── Pillar 3: out of the red ────────────────────────────────────
  const saldoPoints = current.saldoAtual < 0 ? 20 : current.saldoPrevisto < 0 ? 80 : 150;
  if (current.saldoAtual < 0) {
    add({
      id: "saldo-negativo", kind: "alerta", icon: "wallet", weight: 10_000,
      title: "Seu saldo está no vermelho",
      message: `${brlCents(current.saldoAtual)} nas contas. Hora de segurar os gastos até entrar dinheiro 🚨`,
      value: current.saldoAtual,
    });
  } else if (current.saldoPrevisto < 0) {
    add({
      id: "saldo-previsto-negativo", kind: "alerta", icon: "wallet", weight: 9_000,
      title: "O mês fecha no negativo",
      message: `Com o que já está agendado, você termina com ${brlCents(current.saldoPrevisto)}. Dá tempo de virar esse jogo 💪`,
      value: current.saldoPrevisto,
    });
  }

  // Spending pace for the rest of the month
  const projectedExpense = dayOfMonth >= 5 ? Math.max(expense, paidExpense / pace) : expense;
  if (income > 0 && dayOfMonth >= 5 && projectedExpense > income && current.saldoPrevisto >= 0) {
    add({
      id: "ritmo", kind: "atencao", icon: "flame", weight: projectedExpense - income,
      title: "Ritmo de gastos acelerado",
      message: `No ritmo atual, você gasta ${brl(projectedExpense - income)} a mais do que ganha até o fim do mês. Hora de tirar o pé 🦶`,
      tip: `Tente ficar abaixo de ${brl(Math.max(income - expense, 0) / daysLeft)} por dia até o fim do mês.`,
      value: projectedExpense - income,
    });
  }

  // ── Pillar 4: spending under control (limits + spikes) ──────────
  let gastosPoints = 150;
  for (const lim of limits) {
    const spent = currentByCategory.get(lim.category) ?? 0;
    if (lim.limit <= 0) continue;
    const ratio = spent / lim.limit;
    if (ratio > 1) {
      gastosPoints -= 40;
      add({
        id: `limite-${lim.category}`, kind: "alerta", icon: "limit", category: lim.category, weight: spent - lim.limit,
        title: `Limite de ${lim.category} estourado`,
        message: `Passou ${brlCents(spent - lim.limit)} do combinado. O limite pediu arrego 😅`,
        tip: `Segure ${lim.category} até o fim do mês ou revise o limite.`,
        action: { type: "limit", category: lim.category },
        value: spent,
      });
    } else if (ratio >= 0.8) {
      gastosPoints -= 10;
      add({
        id: `limite-quase-${lim.category}`, kind: "atencao", icon: "limit", category: lim.category, weight: spent,
        title: `${Math.round(ratio * 100)}% do limite de ${lim.category}`,
        message: `Faltam só ${brlCents(lim.limit - spent)} para ${daysLeft} ${daysLeft === 1 ? "dia" : "dias"}. Vai com calma 🐢`,
        tip: `Dá ${brlCents((lim.limit - spent) / daysLeft)} por dia em ${lim.category}.`,
        value: spent,
      });
    }
  }

  for (const [category, spent] of currentByCategory) {
    const avg = avgByCategory.get(category) ?? 0;
    if (avg <= 0) continue;
    const expectedSoFar = avg * pace;
    if (spent > avg * 1.1 && spent - avg >= 50) {
      gastosPoints -= 25;
      add({
        id: `acima-${category}`, kind: "atencao", icon: "flame", category, weight: spent - avg,
        title: `${category} acima do normal`,
        message: overspendLine(category, spent, `${seed}-${category}`),
        ...(limits.some((l) => l.category === category)
          ? { tip: `Você costuma gastar ${brl(avg)} por mês aqui. Segure até o mês virar.` }
          : { tip: `Coloque um limite de ${brl(Math.round(avg / 10) * 10)} em ${category} e acompanhe.`, action: { type: "limit" as const, category, suggested: Math.round(avg / 10) * 10 } }),
        value: spent,
      });
    } else if (spent > expectedSoFar * 1.4 && spent - expectedSoFar >= 50 && dayOfMonth >= 5) {
      gastosPoints -= 10;
      add({
        id: `ritmo-${category}`, kind: "atencao", icon: "trending-up", category, weight: spent - expectedSoFar,
        title: `${category} acelerando`,
        message: `${overspendLine(category, spent, `${seed}-${category}`)} E ainda faltam ${daysLeft} dias.`,
        tip: `Para ficar na sua média, sobram ${brl(Math.max(avg - spent, 0))} em ${category} este mês.`,
        ...(limits.some((l) => l.category === category) ? {} : { action: { type: "limit" as const, category, suggested: Math.round(avg / 10) * 10 } }),
        value: spent,
      });
    } else if (dayOfMonth >= 10 && avg >= 100 && spent < expectedSoFar * 0.7) {
      const saved = expectedSoFar - spent;
      add({
        id: `abaixo-${category}`, kind: "conquista", icon: "trending-down", category, weight: saved,
        title: `${category} abaixo do normal`,
        message: `Você está ${Math.round((1 - spent / expectedSoFar) * 100)}% abaixo da sua média. Seu bolso agradece 👏`,
        value: saved,
      });
    }
  }
  gastosPoints = Math.max(gastosPoints, 20);

  // Many small purchases
  const small = current.transactions.filter((t) => t.type === "despesa" && !t.isFatura && t.amount < 40);
  if (small.length >= 8) {
    const total = small.reduce((s, t) => s + t.amount, 0);
    add({
      id: "comprinhas", kind: "dica", icon: "coffee", weight: total,
      title: `${small.length} comprinhas abaixo de ${currencySymbol()} 40`,
      message: `Juntas somaram ${brlCents(total)}. O famoso efeito cafezinho ☕`,
      tip: "Junte as comprinhas num valor semanal e veja quanto sobra.",
      value: total,
    });
  }

  // ── Pillar 5: healthy credit ────────────────────────────────────
  let creditoPoints = 150;
  const totalLimit = cards.reduce((s, c) => s + c.limit, 0);
  if (cards.length > 0 && totalLimit > 0) {
    const usage = cards.reduce((s, c) => s + c.used, 0) / totalLimit;
    const thisKey = monthKey(today);
    const monthlyInstallments = installments
      .filter((i) => i.year * 12 + (i.month - 1) === thisKey)
      .reduce((s, i) => s + i.amount, 0);
    const instShare = income > 0 ? monthlyInstallments / income : monthlyInstallments > 0 ? 1 : 0;
    creditoPoints =
      (usage <= 0.3 ? 80 : usage <= 0.5 ? 60 : usage <= 0.8 ? 35 : 15) +
      (instShare <= 0.15 ? 70 : instShare <= 0.3 ? 45 : 20);

    for (const card of cards) {
      if (card.limit > 0 && card.used / card.limit >= 0.8) {
        add({
          id: `cartao-${card.id}`, kind: "atencao", icon: "card", weight: card.used,
          title: `${card.name} com ${Math.round((card.used / card.limit) * 100)}% do limite usado`,
          message: `Sobraram ${brlCents(Math.max(card.limit - card.used, 0))}. O cartão tá respirando por aparelhos 😮‍💨`,
          tip: "Prefira débito ou Pix até a próxima fatura fechar.",
          action: { type: "navigate", to: "/cartoes?aba=limites", label: "Ver limites" },
          value: card.used,
        });
      }
    }
    if (instShare > 0.3) {
      add({
        id: "parcelas", kind: "atencao", icon: "card", weight: monthlyInstallments,
        title: "Parcelas pesando no mês",
        message: `${brlCents(monthlyInstallments)} em parcelas (${Math.round(instShare * 100)}% da renda). Segura a próxima compra parcelada 🙏`,
        tip: "Antes de parcelar de novo, simule no Copiloto de compra.",
        action: { type: "navigate", to: "/cartoes?aba=parcelas", label: "Ver parcelas" },
        value: monthlyInstallments,
      });
    }
  }

  // ── Recurring bills and subscriptions ──────────────────────────
  const recurringExpenses = recurring.filter((r) => r.type === "despesa");
  if (recurringExpenses.length > 0) {
    const total = recurringExpenses.reduce((s, r) => s + r.amount, 0);
    const share = income > 0 ? total / income : 0;
    add({
      id: "recorrentes", kind: share >= 0.5 ? "atencao" : "dica", icon: "repeat", weight: total,
      title: `${recurringExpenses.length} ${recurringExpenses.length === 1 ? "gasto fixo" : "gastos fixos"} todo mês`,
      message: share >= 0.5
        ? `Somam ${brlCents(total)}, ${Math.round(share * 100)}% da sua renda antes de você gastar um centavo 😳`
        : `Somam ${brlCents(total)} por mês. Vale revisar se ainda usa tudo isso 🔍`,
      tip: "Cancele as assinaturas que você não usou no último mês.",
      value: total,
    });
  }

  // ── Income ──────────────────────────────────────────────────────
  if (avgIncome > 0 && dayOfMonth >= 20 && income < avgIncome * 0.8) {
    add({
      id: "renda-menor", kind: "atencao", icon: "income", weight: avgIncome - income,
      title: "Entrou menos dinheiro que o normal",
      message: `${brl(avgIncome - income)} abaixo da sua média. Mês de segurar um pouco mais 🤏`,
      value: income,
    });
  }

  // ── Wins ────────────────────────────────────────────────────────
  if (savingsRate !== null && savingsRate >= 0.2) {
    add({
      id: "guardando", kind: "conquista", icon: "piggy", weight: income - expense,
      title: `Sobrando ${Math.round(savingsRate * 100)}% da renda`,
      message: `${brl(income - expense)} livres este mês. Isso é coisa de quem vai longe 🚀`,
      value: income - expense,
    });
  }
  if (overdueCount === 0 && dayOfMonth >= 5 && hasData) {
    add({
      id: "em-dia", kind: "conquista", icon: "shield", weight: 1,
      title: "Todas as contas em dia",
      message: "Nenhum atraso no seu caminho. Os juros vão ter que procurar outra pessoa ✅",
    });
  }

  // ── Pillar 6: money set aside ───────────────────────────────────
  const avgMonthlyExpense = pastMonths.length
    ? pastMonths.reduce((s, h) => s + h.despesas, 0) / pastMonths.length
    : expense;
  const monthsCovered = avgMonthlyExpense > 0 ? reserve / avgMonthlyExpense : reserve > 0 ? 6 : 0;
  const reservaPoints = monthsCovered >= 6 ? 150 : monthsCovered >= 3 ? 130 : monthsCovered >= 1 ? 100 : reserve > 0 ? 60 : 15;
  if (reserve <= 0 && hasData) {
    add({
      id: "sem-reserva", kind: "dica", icon: "piggy", weight: 50,
      title: "Nenhum dinheiro guardado ainda",
      message: "Uma reserva segura os imprevistos sem virar dívida. Começa pequeno, mas começa 🌱",
      tip: "Crie uma meta de reserva e guarde um pouco todo mês.",
      action: { type: "navigate", to: "/metas", label: "Criar meta" },
    });
  } else if (monthsCovered >= 3) {
    add({
      id: "reserva-boa", kind: "conquista", icon: "piggy", weight: reserve,
      title: `Reserva de ${monthsCovered >= 12 ? "mais de 1 ano" : `${Math.floor(monthsCovered)} meses`}`,
      message: `${brl(reserve)} guardados cobrem seus gastos por um bom tempo. Tranquilidade tem preço, e você pagou 🛡️`,
    });
  }

  // ── Score ───────────────────────────────────────────────────────
  const pillars: Pillar[] = [
    {
      key: "contas", label: "Contas em dia", points: contasPoints, max: 200, tone: toneOf(contasPoints, 200),
      detail: overdueCount === 0 ? "Nenhuma conta ou fatura atrasada" : `${overdueCount} ${overdueCount === 1 ? "pagamento atrasado" : "pagamentos atrasados"}`,
    },
    {
      key: "sobra", label: "Sobra no fim do mês", points: sobraPoints, max: 200, tone: toneOf(sobraPoints, 200),
      detail: savingsRate === null
        ? "Registre suas receitas para medir"
        : savingsRate >= 0 ? `Sobra prevista de ${Math.round(savingsRate * 100)}% da renda` : `Gastos ${Math.round(-savingsRate * 100)}% acima da renda`,
    },
    {
      key: "saldo", label: "Fora do vermelho", points: saldoPoints, max: 150, tone: toneOf(saldoPoints, 150),
      detail: current.saldoAtual < 0 ? "Saldo atual negativo" : current.saldoPrevisto < 0 ? "O saldo previsto fica negativo" : "Saldo positivo o mês todo",
    },
    {
      key: "gastos", label: "Gastos sob controle", points: gastosPoints, max: 150, tone: toneOf(gastosPoints, 150),
      detail: gastosPoints >= 140 ? "Dentro dos limites e do seu normal" : "Algumas categorias fora do padrão",
    },
    {
      key: "credito", label: "Crédito saudável", points: creditoPoints, max: 150, tone: toneOf(creditoPoints, 150),
      detail: cards.length === 0 ? "Sem cartões cadastrados" : `${Math.round((cards.reduce((s, c) => s + c.used, 0) / (totalLimit || 1)) * 100)}% do limite em uso`,
    },
    {
      key: "reserva", label: "Dinheiro guardado", points: reservaPoints, max: 150, tone: toneOf(reservaPoints, 150),
      detail: reserve <= 0
        ? "Nenhuma reserva ainda"
        : `${brl(reserve)} · cobre ${monthsCovered >= 12 ? "mais de 1 ano" : `${monthsCovered.toFixed(1).replace(".", ",")} ${monthsCovered < 2 ? "mês" : "meses"}`} de gastos`,
    },
  ];

  const score = hasData ? pillars.reduce((s, p) => s + p.points, 0) : 0;
  const level = scoreLevel(score);

  const kindOrder: Record<InsightKind, number> = { alerta: 0, atencao: 1, dica: 2, conquista: 3 };
  insights.sort((a, b) => kindOrder[a.kind] - kindOrder[b.kind] || b.weight - a.weight);

  // ── Savings opportunities ───────────────────────────────────────
  const opportunities: Opportunity[] = [...new Set([...currentByCategory.keys(), ...avgByCategory.keys()])]
    .filter((c) => DISCRETIONARY.includes(normalize(c)))
    .map((category) => {
      const spent = currentByCategory.get(category) ?? 0;
      const average = avgByCategory.get(category) ?? 0;
      const projected = dayOfMonth >= 10 ? spent / pace : spent;
      const base = Math.max(projected, average);
      return { category, base, average, aboveAverage: Math.max(projected - average, 0) };
    })
    .filter((o) => o.base >= 30)
    .sort((a, b) => b.base - a.base)
    .slice(0, 5);

  // ── Headline ────────────────────────────────────────────────────
  const top = insights.find((i) => i.kind === "alerta" || i.kind === "atencao");
  const headline = !hasData
    ? "Adicione suas transações e eu começo a analisar tudo por aqui 🔍"
    : level.key === "excelente"
      ? top
        ? `Finanças no modo craque 🏆 Só um detalhe no radar: "${top.title}".`
        : pick(["Seu dinheiro está em ótima forma. Continua assim que tá lindo ✨", "Finanças no modo craque. Nada pra corrigir por enquanto 🏆"], seed)
      : level.key === "bom"
        ? top ? `Tudo caminhando bem, só fica de olho: "${top.title}".` : "Tudo caminhando bem. Um ajuste aqui e ali e você chega no topo 📈"
        : level.key === "atencao"
          ? `Alguns pontos pedem atenção${top ? `, a começar por "${top.title}"` : ""}. Bora ajustar? 🛠️`
          : "Seu orçamento está no limite. Vamos organizar juntos, um passo de cada vez 🧭";

  return {
    score,
    level,
    headline,
    pillars,
    pulse: {
      income, expense, paidExpense, pendingExpense,
      free: income - expense,
      perDay: Math.max(income - expense, 0) / daysLeft,
      daysLeft, dayOfMonth, daysInMonth, projectedExpense, savingsRate,
    },
    insights,
    opportunities,
    projection: {
      avgNet: (current.projection.avgIncome3m || income) - (current.projection.avgExpense3m || expense),
      start: current.saldoPrevisto,
    },
    hasData,
  };
}
