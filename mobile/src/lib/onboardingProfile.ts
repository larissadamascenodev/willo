/**
 * What the first questions say about a person, worked out before they have an account.
 *
 * Nothing here knows their accounts yet, so nothing here says what they can spend: it
 * reads only what they answered — how the month ends, the card, a surprise bill, what
 * weighs on them — and turns it into a financial profile (a type, a few traits, each
 * marked as an estimate), the value of an hour of their work, and a first sketch of
 * the goal they named. The app refines all of it once real entries come in.
 */

export type GoalId = "dividas" | "viagem" | "casa" | "carro" | "guardar" | "controlar" | "investir" | "organizar" | "outro";
export type MonthEnd = "sobra" | "zero" | "falta" | "vermelho";
export type CardHabit = "acompanho" | "nao-acompanho" | "parcelo" | "sem-cartao";
export type Emergency = "reserva" | "mes" | "parcelaria" | "nao-conseguiria";
export type IncomeKind = "fixa" | "varia" | "mista";
export type Tone = "amigavel" | "descontraido" | "direto" | "firme";

export interface OnboardingAnswers {
  name: string;
  source: string | null;
  goal: GoalId | null;
  /** The goal's own detail: what it is, what it costs, in how many months. */
  dream: { label: string; amount: number; months: number } | null;
  debt: { total: number; kinds: string[]; late: boolean | null } | null;
  income: number;
  incomeKind: IncomeKind | null;
  monthEnd: MonthEnd | null;
  card: CardHabit | null;
  emergency: Emergency | null;
  habits: string[];
  tone: Tone;
}

export const EMPTY_ANSWERS: OnboardingAnswers = {
  name: "",
  source: null,
  goal: null,
  dream: null,
  debt: null,
  income: 0,
  incomeKind: null,
  monthEnd: null,
  card: null,
  emergency: null,
  habits: [],
  tone: "amigavel",
};

/** Goals that ask for a value and a date. */
export const GOALS_WITH_DREAM: GoalId[] = ["viagem", "casa", "carro", "guardar", "outro"];

export interface Trait {
  label: string;
  /** 0..1 */
  value: number;
  word: string;
}

export interface FinancialProfile {
  type: string;
  line: string;
  traits: Trait[];
}

const word = (v: number) => (v >= 0.7 ? "Bom" : v >= 0.45 ? "Médio" : "Pede atenção");

/** The habits that are spent on impulse more than on need. */
const IMPULSE = new Set(["delivery", "online", "saidas", "beleza"]);

export function profileOf(a: OnboardingAnswers): FinancialProfile {
  const late = a.debt?.late === true;
  const type =
    a.monthEnd === "vermelho" || late || a.goal === "dividas"
      ? "Recomeço"
      : a.monthEnd === "falta"
        ? "Apagando incêndios"
        : a.monthEnd === "zero"
          ? "Equilíbrio"
          : a.emergency === "reserva" && a.goal === "investir"
            ? "Crescimento"
            : "Construção";

  const lines: Record<string, string> = {
    "Recomeço": "Você está reorganizando a casa. Dá para sair dessa, uma conta de cada vez.",
    "Apagando incêndios": "O mês costuma apertar no fim. O primeiro passo é ver o aperto antes de ele chegar.",
    "Equilíbrio": "O mês fecha no zero a zero. Um pouco de folga já muda tudo.",
    "Construção": "Sobra dinheiro, e agora é fazer ele trabalhar pelos seus planos.",
    "Crescimento": "Você já tem base. Agora é crescer com constância.",
  };

  const slack = { sobra: 0.85, zero: 0.5, falta: 0.3, vermelho: 0.12 }[a.monthEnd ?? "zero"];
  const card = { acompanho: 0.85, "nao-acompanho": 0.55, parcelo: 0.28, "sem-cartao": 0.8 }[a.card ?? "nao-acompanho"];
  const reserve = { reserva: 0.85, mes: 0.45, parcelaria: 0.25, "nao-conseguiria": 0.1 }[a.emergency ?? "mes"];
  const impulsive = a.habits.filter((h) => IMPULSE.has(h)).length;
  const impulse = Math.max(0.15, 0.82 - impulsive * 0.17);

  return {
    type,
    line: lines[type],
    traits: [
      { label: "Folga no fim do mês", value: slack, word: word(slack) },
      { label: "Controle do cartão", value: card, word: word(card) },
      { label: "Reserva para imprevistos", value: reserve, word: word(reserve) },
      { label: "Controle de impulso", value: impulse, word: word(impulse) },
    ],
  };
}

/** What an hour of their work is worth: a month of 220 hours. */
export function hourValue(income: number): number {
  return income > 0 ? income / 220 : 0;
}

/** How long a price takes to earn, said the way a person would say it. */
export function workTime(price: number, income: number): string {
  const h = hourValue(income);
  if (h <= 0) return "";
  const hours = price / h;
  if (hours >= 8) {
    const days = Math.round(hours / 8);
    return `${days} ${days === 1 ? "dia" : "dias"} de trabalho`;
  }
  const whole = Math.floor(hours);
  const mins = Math.round((hours - whole) * 60);
  if (whole === 0) return `${mins} min de trabalho`;
  return `${whole}h${mins > 0 ? String(mins).padStart(2, "0") : ""} de trabalho`;
}

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** The month a number of months from now, by name ("maio", or "maio de 2028" past next year). */
export function monthFromNow(months: number, now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth() + months, 1);
  return d.getFullYear() - now.getFullYear() >= 2 ? `${MONTHS[d.getMonth()]} de ${d.getFullYear()}` : MONTHS[d.getMonth()];
}

/** A dream's first sketch: how much a month, and when it is ready. */
export function dreamPlan(dream: { amount: number; months: number }, now = new Date()) {
  const months = Math.max(1, dream.months);
  return { monthly: dream.amount / months, ready: monthFromNow(months, now), months };
}

/** The order debts are best paid in: the dearest interest first. */
const DEBT_ORDER = ["cheque", "cartao", "emprestimo", "carne", "financiamento", "pessoa"];
export function debtOrder(kinds: string[]): string[] {
  return [...kinds].sort((x, y) => DEBT_ORDER.indexOf(x) - DEBT_ORDER.indexOf(y));
}

/**
 * A debt's first sketch, once the income is known: putting a share of it towards the
 * debt each month (15% by default), how many months until it is gone.
 */
export function debtPlan(total: number, income: number, share = 0.15) {
  const monthly = income * share;
  if (!(monthly > 0) || !(total > 0)) return null;
  const months = Math.ceil(total / monthly);
  return { monthly, months, free: monthFromNow(months) };
}
