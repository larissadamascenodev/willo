import { describe, expect, it } from "vitest";
import { getMonthlyProjection } from "@/services/projection/getProjection";
import { SAMPLE_DATA, type DashboardData } from "@/types/finance";

// Current month: 6000 in, 5000 out, ending the month on 4000. The 3-month average is 5500 / 4500.
const current: DashboardData = {
  ...SAMPLE_DATA,
  receitas: 6000,
  despesas: 5000,
  saldoPrevisto: 4000,
  projection: { nextMonthBalance: 1000, avgIncome3m: 5500, avgExpense3m: 4500 },
};

const month = (receitas: number, despesas: number): DashboardData => ({ ...SAMPLE_DATA, receitas, despesas });

// January 2030 as the current month: the next ones are Feb, Mar, Apr...
const map = new Map<string, DashboardData>([
  ["1-2030", month(6000, 5200)], // Feb: registered
  // Mar (2-2030) has nothing registered
  ["3-2030", month(6000, 4800)], // Apr: registered
]);

describe("getMonthlyProjection", () => {
  it("leaves a month with nothing registered at zero and carries the balance through it", () => {
    const rows = getMonthlyProjection(current, 0, 2030, { savingsBoost: 0, incomeBoost: 0 }, map, { averageForEmptyMonths: false });

    const feb = rows[1];
    const mar = rows[2];
    const apr = rows[3];

    expect([feb.income, feb.expense, feb.balance]).toEqual([6000, 5200, 4000 + 800]);
    expect([mar.income, mar.expense, mar.delta]).toEqual([0, 0, 0]);
    expect(mar.balance).toBe(feb.balance);
    expect(apr.balance).toBe(mar.balance + 1200);
  });

  it("keeps filling empty months with the average unless told not to", () => {
    const rows = getMonthlyProjection(current, 0, 2030, { savingsBoost: 0, incomeBoost: 0 }, map);
    expect([rows[2].income, rows[2].expense]).toEqual([5500, 4500]);
  });

  it("never invents figures for a month that has no data at all", () => {
    const rows = getMonthlyProjection(current, 0, 2030, { savingsBoost: 0, incomeBoost: 0 }, undefined, { averageForEmptyMonths: false });
    for (const r of rows.slice(1)) expect([r.income, r.expense, r.delta]).toEqual([0, 0, 0]);
    expect(rows[11].balance).toBe(4000);
  });
});
