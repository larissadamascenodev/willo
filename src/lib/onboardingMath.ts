/**
 * The arithmetic behind the onboarding, kept apart from the screens that draw it.
 *
 * Every amount here is an integer number of centavos. Money in floating point drifts,
 * and this is the one place in the flow where a few cents compound into a wrong month
 * count — so nothing in this file divides reais. The screens convert once, at the edge.
 *
 * None of it is advice. The numbers are arithmetic on what the person typed, and the
 * screens label them as estimates, because that is what they are: no interest, no
 * yield, no inflation.
 */

/** Hours in a working month: 44h a week by the CLT, which is what the law calls a month. */
export const HORAS_MES = 220;

export type TipoRenda =
  | "clt"
  | "autonomo"
  | "empresario"
  | "servidor"
  | "aposentado"
  | "estudante"
  | "outro";

/** Someone whose income is their own business carries more risk, so the cushion is bigger. */
const RENDA_INSTAVEL: TipoRenda[] = ["autonomo", "empresario"];

/** What is left of the month. Negative when the month does not close. */
export function sobra(rendaCentavos: number, gastosCentavos: number): number {
  return rendaCentavos - gastosCentavos;
}

/** What one hour of this person's work is worth, in centavos. */
export function horaTrabalho(rendaCentavos: number): number {
  return rendaCentavos / HORAS_MES;
}

/**
 * How many hours of work a price costs. Returned unrounded: the screen decides whether
 * it wants "5,8" or "6", and rounding twice is how 5,8 becomes 6 becomes "about 6".
 */
export function horasDe(valorCentavos: number, rendaCentavos: number): number {
  const hora = horaTrabalho(rendaCentavos);
  if (hora <= 0) return 0;
  return valorCentavos / hora;
}

/**
 * What the goal costs every month to land on time. Rounded up, because the month that
 * would be short is the last one, and arriving one month late is worse than paying one
 * centavo more.
 */
export function mensalNecessario(valorCentavos: number, prazoMeses: number): number {
  if (prazoMeses <= 0) return 0;
  return Math.ceil(valorCentavos / prazoMeses);
}

/**
 * How long the goal really takes at what is left over today. Null when nothing is left,
 * because then there is no honest number to give — the screen says so in words instead.
 */
export function prazoRealista(valorCentavos: number, sobraCentavos: number): number | null {
  if (sobraCentavos <= 0) return null;
  return Math.ceil(valorCentavos / sobraCentavos);
}

export interface Reserva {
  /** The floor: enough months of spending to survive a surprise. */
  minima: number;
  ideal: number;
  mesesMinimo: number;
  mesesIdeal: number;
}

/**
 * The emergency fund, as the usual three-to-six months of spending — six to twelve when
 * the income itself is the thing that can stop.
 */
export function reservaEmergencia(gastosCentavos: number, tipo: TipoRenda): Reserva {
  const instavel = RENDA_INSTAVEL.includes(tipo);
  const mesesMinimo = instavel ? 6 : 3;
  const mesesIdeal = instavel ? 12 : 6;
  return {
    minima: gastosCentavos * mesesMinimo,
    ideal: gastosCentavos * mesesIdeal,
    mesesMinimo,
    mesesIdeal,
  };
}

export interface Plano503020 {
  necessidades: number;
  desejos: number;
  futuro: number;
}

/**
 * Elizabeth Warren's split, in reais rather than percentages, because a percentage is
 * not something you can check against a bank balance.
 *
 * The thirds are floored and the remainder goes to the future, so the three parts add
 * back up to exactly the income instead of losing a centavo to rounding.
 */
export function plano503020(rendaCentavos: number): Plano503020 {
  const necessidades = Math.floor(rendaCentavos * 0.5);
  const desejos = Math.floor(rendaCentavos * 0.3);
  return { necessidades, desejos, futuro: rendaCentavos - necessidades - desejos };
}

/** Whether a goal's monthly payment is more of the month than the 50/30/20 future slice. */
export function passaDoFuturo(mensalCentavos: number, rendaCentavos: number): boolean {
  if (rendaCentavos <= 0) return false;
  return mensalCentavos > plano503020(rendaCentavos).futuro;
}

/** A goal's monthly payment as a share of the month, for saying so out loud. */
export function percentualDaRenda(mensalCentavos: number, rendaCentavos: number): number {
  if (rendaCentavos <= 0) return 0;
  return Math.round((mensalCentavos / rendaCentavos) * 100);
}
