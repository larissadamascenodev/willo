import { sumFlow, toDateKey, type CashFlowEntry, type CashFlowPeriod } from "@/hooks/useCashFlow";

/**
 * The money that moved, gathered into the columns a chart can draw.
 *
 * "Este mês" means one column per day up to today — the month so far, not a month
 * padded out with days that have not happened. Every other period means one column
 * per month, ending on the current one. Which it is changes what a column means, so
 * the two live together here rather than being re-derived either side.
 *
 * The label is left to each app: the browser writes "JAN" and the phone may want
 * something shorter, and neither belongs in a sum.
 */

export interface CashFlowBucket {
  key: string;
  /** Day of the month, for the day-by-day view. Null on the monthly views. */
  day: number | null;
  /** Month index, for the monthly views. Null on the day-by-day view. */
  month: number | null;
  entradas: number;
  saidas: number;
  /** Today, or the month we are in. */
  isCurrent: boolean;
}

export function buildCashFlowBuckets(
  entries: CashFlowEntry[],
  period: CashFlowPeriod,
  now = new Date(),
): CashFlowBucket[] {
  if (period === "mes") {
    const days = now.getDate();
    return Array.from({ length: days }, (_, i) => {
      const key = toDateKey(new Date(now.getFullYear(), now.getMonth(), i + 1));
      const { entradas, saidas } = sumFlow(entries.filter((e) => e.date === key));
      return { key, day: i + 1, month: null, entradas, saidas, isCurrent: i + 1 === days };
    });
  }

  const months = period === "3m" ? 3 : period === "6m" ? 6 : 12;
  return Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1) + i, 1);
    const prefix = toDateKey(d).slice(0, 7);
    const { entradas, saidas } = sumFlow(entries.filter((e) => e.date.startsWith(prefix)));
    return {
      key: prefix,
      day: null,
      month: d.getMonth(),
      entradas,
      saidas,
      isCurrent: i === months - 1,
    };
  });
}

export const CASH_FLOW_PERIODS: { key: CashFlowPeriod; label: string }[] = [
  { key: "mes", label: "Este mês" },
  { key: "3m", label: "3m" },
  { key: "6m", label: "6m" },
  { key: "1a", label: "1a" },
];
