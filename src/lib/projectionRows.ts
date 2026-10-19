import type { MonthProjection } from "@/services/projection/types";

/**
 * The months ahead, as a column that adds up.
 *
 * Two things here are easy to get subtly wrong in each app separately, which is why
 * they are settled once. Every figure is rounded a single time and everything else
 * derived from the rounded parts — four independently rounded numbers do not add up
 * to the fifth, and a ledger that does not sum is worse than no ledger. And each
 * month chains off the close shown for the one before it, so reading down the column
 * is reading one continuous balance rather than a set of unrelated months.
 */

export const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export const MONTH_SHORT = [
  "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez",
];

/** How a month reads at a glance, and the colour that says so. */
export const PROJECTION_RISK = {
  positivo: { label: "Tranquilo", hex: "#C8F36D" },
  atencao: { label: "Atenção", hex: "#FCD34D" },
  risco: { label: "Risco", hex: "#F87171" },
} as const;

export const riskOf = (risk: string) =>
  PROJECTION_RISK[risk as keyof typeof PROJECTION_RISK] ?? PROJECTION_RISK.risco;

export interface ProjectionRowView {
  month: number;
  year: number;
  risk: "positivo" | "atencao" | "risco";
  /** What comes in, rounded once. */
  income: number;
  expense: number;
  /** The month on its own: in less out. */
  sobra: number;
  /** What the month before closed with. */
  prevBalance: number;
  /** What this month closes with. */
  fecha: number;
  short: string;
  name: string;
  /** Set only when the month is not in this year. */
  yearTag: string;
}

export function buildProjectionRows(
  projections: MonthProjection[],
  previousMonthEndingBalance: number,
): ProjectionRowView[] {
  const thisYear = new Date().getFullYear();

  return projections.reduce<ProjectionRowView[]>((acc, p, i) => {
    const income = Math.round(p.income);
    const expense = Math.round(p.expense);
    const sobra = income - expense;
    const prevBalance = i > 0 ? acc[i - 1].fecha : Math.round(previousMonthEndingBalance);
    acc.push({
      ...p,
      income,
      expense,
      sobra,
      prevBalance,
      fecha: prevBalance + sobra,
      short: MONTH_SHORT[p.month],
      name: MONTH_NAMES[p.month],
      yearTag: p.year !== thisYear ? String(p.year).slice(2) : "",
    });
    return acc;
  }, []);
}
