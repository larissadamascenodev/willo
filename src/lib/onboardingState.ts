import {
  mensalNecessario,
  percentualDaRenda,
  plano503020,
  prazoRealista,
  reservaEmergencia,
  sobra,
  type Plano503020,
  type Reserva,
  type TipoRenda,
} from "@/lib/onboardingMath";

/**
 * What the onboarding knows, and what it works out from that.
 *
 * Amounts are centavos, as integers, all the way through — the conversion to reais
 * happens once, in the screen that prints it, and once more when a goal is written,
 * because the goals table has always held reais.
 */

export type Objetivo = "dividas" | "juntar" | "investir" | "organizar";

export interface OnboardingAnswers {
  nome: string;
  termosAceitos: boolean;
  iaAceita: boolean;
  objetivo: Objetivo | null;
  tipoRenda: TipoRenda | null;
  rendaCentavos: number | null;
  /** Null when skipped, which is a different thing from zero. */
  gastosCentavos: number | null;
  metaValorCentavos: number | null;
  metaNome: string;
  prazoMeses: number | null;
  /** At most three, and empty when skipped. */
  categorias: string[];
  compromisso: boolean;
  lembretes: boolean | null;
  paywallDismissed: boolean;
  /** Set by finalizeOnboarding so a second call writes nothing. */
  finalized?: boolean;
}

export const INITIAL_ANSWERS: OnboardingAnswers = {
  nome: "",
  termosAceitos: false,
  iaAceita: false,
  objetivo: null,
  tipoRenda: null,
  rendaCentavos: null,
  gastosCentavos: null,
  metaValorCentavos: null,
  metaNome: "",
  prazoMeses: null,
  categorias: [],
  compromisso: false,
  lembretes: null,
  paywallDismissed: false,
};

/* ── Lembrando de onde parou ──────────────────────────────────────────────────── */

/** The same key the first flow used: one onboarding in progress per device. */
const KEY = "willo.onboarding.v1";
/** Bumped when the shape changes, so a half-finished older run is dropped rather than read wrong. */
const SHAPE = 2;

interface Stored {
  v: number;
  answers: OnboardingAnswers;
  screen: string;
  savedAt: string;
}

export function readOnboardingState(): { answers: OnboardingAnswers; screen: string } | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    if (parsed?.v !== SHAPE || !parsed.answers) return null;
    return { answers: { ...INITIAL_ANSWERS, ...parsed.answers }, screen: parsed.screen };
  } catch {
    return null;
  }
}

export function saveOnboardingState(answers: OnboardingAnswers, screen: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: SHAPE, answers, screen, savedAt: new Date().toISOString() } satisfies Stored));
  } catch {
    /* private mode or a full disk: the flow still runs, it just will not be remembered */
  }
}

export function clearOnboardingState() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}

/* ── O que dá para concluir ───────────────────────────────────────────────────── */

export interface DerivedPlan {
  renda: number;
  /** Null when the person skipped the spending question. */
  gastos: number | null;
  /** Null when there is nothing to subtract from. */
  sobra: number | null;
  plano: Plano503020;
  reserva: Reserva | null;
  /** What the chosen goal costs a month, when there is a goal with a number on it. */
  metaMensal: number | null;
  /** The honest month count at today's surplus, when it differs from what was asked. */
  prazoRealista: number | null;
  metaPesaDemais: boolean;
  metaPercentual: number;
  /** True when the month does not close on what was typed. */
  noVermelho: boolean;
}

export function derivePlan(a: OnboardingAnswers): DerivedPlan {
  const renda = a.rendaCentavos ?? 0;
  const gastos = a.gastosCentavos;
  const resto = gastos === null ? null : sobra(renda, gastos);
  const plano = plano503020(renda);

  /* Investing asks nothing, so its target is the emergency fund the numbers imply. */
  const reserva = gastos === null ? null : reservaEmergencia(gastos, a.tipoRenda ?? "clt");
  const alvo =
    a.objetivo === "investir" ? reserva?.minima ?? null : a.metaValorCentavos;
  const prazo = a.objetivo === "investir" ? null : a.prazoMeses;

  const metaMensal =
    alvo && prazo ? mensalNecessario(alvo, prazo) : alvo && resto && resto > 0 ? Math.min(resto, plano.futuro) : null;

  return {
    renda,
    gastos,
    sobra: resto,
    plano,
    reserva,
    metaMensal,
    prazoRealista:
      alvo !== null && resto !== null && metaMensal !== null && metaMensal > resto
        ? prazoRealista(alvo, resto)
        : null,
    metaPesaDemais: metaMensal !== null && metaMensal > plano.futuro,
    metaPercentual: metaMensal !== null ? percentualDaRenda(metaMensal, renda) : 0,
    noVermelho: resto !== null && resto < 0,
  };
}

/** Goals and debts ask for a number; the other two objectives are read off what is there. */
export const pedeValorEPrazo = (objetivo: Objetivo | null) =>
  objetivo === "dividas" || objetivo === "juntar";

/** Hours of work mean nothing to someone whose income is not hours. */
export const mostraHoraTrabalho = (tipo: TipoRenda | null) =>
  tipo !== null && tipo !== "aposentado" && tipo !== "estudante";
