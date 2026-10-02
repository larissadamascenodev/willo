/**
 * Monthly projection generator using real per-month financial data.
 */

import type { DashboardData } from "@/types/finance";
import type { MonthProjection, SimulationParams } from "./types";

const projectionCache = new Map<string, MonthProjection[]>();

/**
 * Generate 12-month forward projections using real per-month data.
 * 
 * @param currentData - DashboardData for the current (selected) month
 * @param selectedMonth - 0-indexed current month
 * @param selectedYear - current year
 * @param params - simulation adjustments (savingsBoost, incomeBoost)
 * @param monthDataMap - Map of "month-year" => DashboardData for future months
 */
export function getMonthlyProjection(
  currentData: DashboardData,
  selectedMonth: number,
  selectedYear: number,
  params: SimulationParams = { savingsBoost: 0, incomeBoost: 0 },
  monthDataMap?: Map<string, DashboardData>
): MonthProjection[] {
  const result: MonthProjection[] = [];

  // Month 0 = current month
  // balance = saldoPrevisto (predicted end-of-month balance)
  const month0Income = currentData.receitas;
  const month0Expense = currentData.despesas;
  const month0Delta = month0Income - month0Expense;
  const month0Balance = currentData.saldoPrevisto;

  const month0Risk: MonthProjection["risk"] =
    month0Delta > 0 ? "positivo" : month0Delta > -200 ? "atencao" : "risco";

  result.push({
    month: selectedMonth,
    year: selectedYear,
    balance: month0Balance,
    delta: month0Delta,
    income: month0Income,
    expense: month0Expense,
    risk: month0Risk,
  });

  // Fallback averages (used when no real data exists for a future month)
  const avgIncome = currentData.projection.avgIncome3m || currentData.receitas;
  const avgExpense = currentData.projection.avgExpense3m || currentData.despesas;

  let prevBalance = month0Balance;

  for (let i = 1; i < 12; i++) {
    const d = new Date(selectedYear, selectedMonth + i, 1);
    const m = d.getMonth();
    const y = d.getFullYear();
    const key = `${m}-${y}`;

    let income: number;
    let expense: number;
    let estimated = false;

    const monthData = monthDataMap?.get(key);
    if (monthData && (monthData.receitas > 0 || monthData.despesas > 0)) {
      // Use real data from recurring/scheduled transactions
      income = monthData.receitas + params.incomeBoost;
      expense = monthData.despesas - params.savingsBoost;
    } else {
      // Fallback to historical average
      income = avgIncome + params.incomeBoost;
      expense = avgExpense - params.savingsBoost;
      estimated = true;
    }

    const delta = income - expense;
    const balance = prevBalance + delta;

    const risk: MonthProjection["risk"] =
      delta > 0 ? "positivo" : delta > -200 ? "atencao" : "risco";

    result.push({ month: m, year: y, balance, delta, income, expense, risk, estimated });
    prevBalance = balance;
  }

  return result;
}

/**
 * Invalidate projection cache (call on transaction changes).
 */
export function invalidateProjectionCache() {
  projectionCache.clear();
}
