import {
  calculateOnboardingScore,
  type ChallengeAnswer,
  type CreditCardAnswer,
  type EmergencyAnswer,
  type EndOfMonthAnswer,
  type OnboardingScoreResult,
} from "@/lib/onboardingScore";

export type GoalAnswer = "dividas" | "juntar" | "organizar" | "investir";
export type WorkAnswer = "clt" | "autonomo" | "empresario" | "estudante" | "aposentado";
export type DebtAnswer = "nao" | "controle" | "dificil";
export type PurposeAnswer = "dividas" | "reserva" | "viagem" | "casa" | "carro" | "estudos" | "futuro" | "outro";

/** Everything the onboarding asks, in the order it's asked. */
export interface OnboardingAnswers {
  name: string;
  goal: GoalAnswer | null;
  age: number;
  work: WorkAnswer | null;
  income: number;
  spending: number;
  endOfMonth: EndOfMonthAnswer | null;
  creditCard: CreditCardAnswer | null;
  debts: DebtAnswer | null;
  emergency: EmergencyAnswer | null;
  /** What the money is for. Skipped (and taken as "dividas") when the goal is getting out of debt. */
  purpose: PurposeAnswer | null;
  target: number;
  months: number;
  spendDays: string[];
}

export const INITIAL_ANSWERS: OnboardingAnswers = {
  name: "",
  goal: null,
  age: 28,
  work: null,
  income: 4500,
  spending: 3600,
  endOfMonth: null,
  creditCard: null,
  debts: null,
  emergency: null,
  purpose: null,
  target: 10000,
  months: 12,
  spendDays: [],
};

export const GOAL_LABEL: Record<GoalAnswer, string> = {
  dividas: "Sair das dívidas",
  juntar: "Juntar dinheiro",
  organizar: "Organizar os gastos",
  investir: "Começar a investir",
};

export const PURPOSE_LABEL: Record<PurposeAnswer, string> = {
  dividas: "Quitar dívidas",
  reserva: "Reserva de emergência",
  viagem: "Uma viagem",
  casa: "Entrada da casa própria",
  carro: "Carro ou moto",
  estudos: "Estudos",
  futuro: "Investir pro futuro",
  outro: "Outro objetivo",
};

/** The purpose that actually drives the analysis. */
export const purposeOf = (a: OnboardingAnswers): PurposeAnswer =>
  a.goal === "dividas" ? "dividas" : a.purpose ?? "outro";

/** Six months of spending, rounded — the usual emergency reserve. */
export const idealReserve = (spending: number) => Math.round((spending * 6) / 100) * 100;

/** A sensible starting value for the target ruler, by purpose. */
export function defaultTarget(purpose: PurposeAnswer, spending: number) {
  switch (purpose) {
    case "reserva": return Math.max(idealReserve(spending), 1000);
    case "viagem": return 8000;
    case "casa": return 50000;
    case "carro": return 30000;
    case "estudos": return 10000;
    case "futuro": return 20000;
    case "dividas": return 5000;
    default: return 10000;
  }
}

/** Heading for the target and months questions. */
export function targetCopy(purpose: PurposeAnswer) {
  const q: Record<PurposeAnswer, [string, string]> = {
    dividas: ["Quanto você deve hoje,", "somando tudo?"],
    reserva: ["Quanto você quer", "ter de reserva?"],
    viagem: ["Quanto vai custar", "essa viagem?"],
    casa: ["Quanto você quer juntar", "pra entrada?"],
    carro: ["Quanto custa", "o carro ou a moto?"],
    estudos: ["Quanto vão custar", "os estudos?"],
    futuro: ["Quanto você quer juntar", "pra investir?"],
    outro: ["Quanto você", "quer juntar?"],
  };
  return {
    light: q[purpose][0],
    bold: q[purpose][1],
    monthsBold: purpose === "dividas" ? "quer quitar tudo?" : "quer chegar lá?",
  };
}

const CHALLENGE_FOR_GOAL: Record<GoalAnswer, ChallengeAnswer> = {
  dividas: "sair-dividas",
  juntar: "guardar-dinheiro",
  organizar: "entender-gastos",
  investir: "guardar-dinheiro",
};

export interface OnboardingPlan {
  surplus: number;
  essentials: number;
  lifestyle: number;
  savings: number;
  monthlySave: number;
  /** How much monthly spending has to drop to hit the goal in time (0 when it already fits). */
  cut: number;
  reserve: number;
  /** Months chosen for the goal. */
  months: number;
  /** Months it takes putting the whole surplus towards the goal (null when nothing is left over). */
  monthsAtSurplus: number | null;
  score: OnboardingScoreResult;
  /** Score on the Raio-X 0–1000 scale. */
  score1000: number;
}

/**
 * The numbers behind the analysis: what's left each month, what the goal
 * asks for, a 50/30/20 split of the income, a six-month reserve and the
 * starting score.
 */
export function buildPlan(a: OnboardingAnswers): OnboardingPlan {
  const income = Math.max(a.income, 0);
  const surplus = income - a.spending;
  const monthlySave = Math.ceil(a.target / Math.max(a.months, 1) / 10) * 10;
  const cut = Math.max(monthlySave - Math.max(surplus, 0), 0);

  const score = calculateOnboardingScore({
    endOfMonth: a.endOfMonth ?? "zero-a-zero",
    creditCard: a.creditCard ?? "pago-nao-acompanho",
    emergency: a.emergency ?? "dinheiro-do-mes",
    challenge: a.goal ? CHALLENGE_FOR_GOAL[a.goal] : "entender-gastos",
  });
  // Debts weigh the starting point down a bit more
  const debtPenalty = a.debts === "dificil" ? 8 : a.debts === "controle" ? 3 : 0;
  const adjusted = Math.max(5, Math.min(100, score.score - debtPenalty));

  return {
    surplus,
    essentials: income * 0.5,
    lifestyle: income * 0.3,
    savings: income * 0.2,
    monthlySave,
    cut,
    reserve: idealReserve(a.spending),
    months: Math.max(a.months, 1),
    monthsAtSurplus: surplus > 0 ? Math.ceil(a.target / surplus) : null,
    score: { ...score, score: adjusted },
    score1000: adjusted * 10,
  };
}

export type Tone = "good" | "warn" | "bad";

export interface Finding {
  title: string;
  detail: string;
  tone: Tone;
}

const LEAK_LABEL: Record<string, string> = {
  delivery: "delivery e restaurantes",
  online: "compras online",
  mercado: "mercado",
  transporte: "Uber e transporte",
  assinaturas: "assinaturas",
  lazer: "lazer e saídas",
};

/** What the answers say about the person's money today, one finding per topic. */
export function buildFindings(a: OnboardingAnswers, plan: OnboardingPlan): Finding[] {
  const income = Math.max(a.income, 1);
  const pct = Math.round((plan.surplus / income) * 100);
  const out: Finding[] = [];

  out.push(
    plan.surplus < 0
      ? { title: `Faltam ${brl0(plan.surplus)} por mês`, detail: "Você gasta mais do que ganha. Esse é o primeiro ponto a resolver.", tone: "bad" }
      : pct >= 20
        ? { title: `Sobram ${brl0(plan.surplus)} por mês`, detail: `${pct}% da sua renda. Uma folga boa pra fazer o dinheiro trabalhar.`, tone: "good" }
        : { title: `Sobram ${brl0(plan.surplus)} por mês`, detail: `${pct}% da sua renda. O ideal é chegar perto de 20%.`, tone: "warn" },
  );

  const card: Record<CreditCardAnswer, Finding> = {
    "pago-acompanho": { title: "Cartão sob controle", detail: "Você paga a fatura inteira e acompanha os gastos.", tone: "good" },
    "pago-nao-acompanho": { title: "Cartão sem acompanhamento", detail: "Você paga em dia, mas não vê pra onde o limite vai.", tone: "warn" },
    "parcelo-as-vezes": { title: "Fatura parcelada às vezes", detail: "Parcelar a fatura tem um dos juros mais altos do mercado.", tone: "bad" },
    dificuldade: { title: "Dificuldade com a fatura", detail: "O cartão está pesando no seu mês. Vale olhar isso primeiro.", tone: "bad" },
  };
  if (a.creditCard) out.push(card[a.creditCard]);

  const debt: Record<DebtAnswer, Finding> = {
    nao: { title: "Sem dívidas", detail: "Todo o dinheiro que sobra pode ir pros seus objetivos.", tone: "good" },
    controle: { title: "Dívidas sob controle", detail: "Mantenha as parcelas em dia enquanto junta pro resto.", tone: "warn" },
    dificil: { title: "Dívidas apertando", detail: "Juros de dívida costumam ser maiores que qualquer rendimento.", tone: "bad" },
  };
  if (a.debts) out.push(debt[a.debts]);

  const emergency: Record<EmergencyAnswer, Finding> = {
    reserva: { title: "Você tem reserva", detail: "Um imprevisto não desmonta o seu mês.", tone: "good" },
    "dinheiro-do-mes": { title: "Reserva ainda pequena", detail: `Um imprevisto sai do dinheiro do mês. O ideal é ter ${brl0(plan.reserve)} guardados.`, tone: "warn" },
    parcelaria: { title: "Sem reserva", detail: "Um imprevisto viraria parcela no cartão.", tone: "bad" },
    "nao-conseguiria": { title: "Sem reserva", detail: "Um imprevisto de R$ 1.000 hoje não teria de onde sair.", tone: "bad" },
  };
  if (a.emergency) out.push(emergency[a.emergency]);

  const leaks = a.spendDays.map((k) => LEAK_LABEL[k]).filter(Boolean);
  if (leaks.length) {
    const list = leaks.length > 1 ? `${leaks.slice(0, -1).join(", ")} e ${leaks[leaks.length - 1]}` : leaks[0];
    out.push({ title: "Onde o dinheiro escapa", detail: `Você apontou ${list}. É por aí que dá pra ajustar sem sofrer.`, tone: "warn" });
  }

  return out;
}

/** A plain-language verdict on whether the goal fits, and what to prioritize. */
export function goalVerdict(a: OnboardingAnswers, plan: OnboardingPlan): { tone: Tone; text: string } {
  const purpose = purposeOf(a);
  if (purpose !== "dividas" && a.debts === "dificil") {
    return { tone: "warn", text: "Antes de juntar pra isso, priorize quitar as dívidas: os juros delas crescem mais rápido do que o dinheiro guardado rende." };
  }
  if (purpose !== "reserva" && purpose !== "dividas" && (a.emergency === "parcelaria" || a.emergency === "nao-conseguiria")) {
    return { tone: "warn", text: `Vale separar uma parte pra uma reserva de emergência junto com esse objetivo. O ideal é ${brl0(plan.reserve)}.` };
  }
  if (plan.cut === 0) {
    return { tone: "good", text: `Cabe na sua sobra. Guardando ${brl0(plan.monthlySave)} por mês, você chega lá em ${plan.months} ${plan.months === 1 ? "mês" : "meses"}.` };
  }
  if (plan.monthsAtSurplus) {
    return { tone: "warn", text: `Com a sobra de hoje, dá em ${plan.monthsAtSurplus} meses. Pra chegar em ${plan.months}, seria preciso cortar ${brl0(plan.cut)} por mês nos gastos.` };
  }
  return { tone: "bad", text: "Hoje não sobra dinheiro pra isso. O primeiro passo é fazer o mês fechar no azul." };
}

export const brl0 = (v: number) =>
  `R$ ${Math.round(Math.abs(v)).toLocaleString("pt-BR")}`;
