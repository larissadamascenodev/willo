import { buildDashboardData } from "@/services/dashboardData";
import type { MonthFlow } from "@/lib/projectionRows";

/**
 * What came in and went out in each of the months before this one.
 *
 * Read with the same builder the projection uses for the months ahead, so a month
 * behind and a month ahead are measured the same way and the line through them is
 * one line.
 */
export async function loadPastMonthFlows({
  userId,
  month,
  year,
  count,
}: {
  userId: string;
  /** The month the chart is centred on — zero-based, as the month context keeps it. */
  month: number;
  year: number;
  /** How many months back. */
  count: number;
}): Promise<MonthFlow[]> {
  const spans = Array.from({ length: count }, (_, i) => new Date(year, month - count + i, 1));
  return Promise.all(
    spans.map(async (d) => {
      const data = await buildDashboardData(d.getMonth(), d.getFullYear(), {
        includeHistorical: false,
        userId,
      });
      return { month: d.getMonth(), year: d.getFullYear(), income: data.receitas, expense: data.despesas };
    }),
  );
}
