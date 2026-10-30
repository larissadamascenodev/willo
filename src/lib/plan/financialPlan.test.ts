import { describe, expect, it } from "vitest";
import { bucketOf, buildProfile, planMethods, planVsActual, type PlanMonth } from "./financialPlan";

const month = (m: string, income: number, spending: Record<string, number>, fixed = 0, installments = 0): PlanMonth => ({
  month: m,
  income,
  spending,
  fixed,
  installments,
});

describe("financial plan", () => {
  it("sorts categories into buckets", () => {
    expect(bucketOf("Supermercado")).toBe("necessidades");
    expect(bucketOf("Conta de Luz")).toBe("necessidades");
    expect(bucketOf("Delivery")).toBe("desejos");
    expect(bucketOf("Investimentos")).toBe("guardar");
    expect(bucketOf("Empréstimos")).toBe("dividas");
  });

  it("builds the profile from the months' averages", () => {
    const p = buildProfile({
      months: [month("2026-08", 4000, { Aluguel: 1500, Delivery: 500 }), month("2026-09", 4000, { Aluguel: 1500, Delivery: 700 })],
      saved: 3000,
    })!;
    expect(p.incomeAvg).toBe(4000);
    expect(p.byBucket.necessidades).toBe(1500);
    expect(p.byBucket.desejos).toBe(600);
    expect(p.leftoverAvg).toBe(1900);
    expect(p.reserveMonths).toBe(2);
  });

  it("recommends the variable-income plan when income swings, built on the weakest month", () => {
    const p = buildProfile({
      months: [month("2026-07", 2000, { Mercado: 800 }), month("2026-08", 6000, { Mercado: 800 }), month("2026-09", 3000, { Mercado: 800 })],
      saved: 0,
    })!;
    const [best] = planMethods(p);
    expect(best.id).toBe("renda-variavel");
    expect(best.base).toBe(2000);
    expect(best.allocations[0].amount).toBe(1100);
  });

  it("recommends reorganizing when instalments weigh too much", () => {
    const p = buildProfile({
      months: [month("2026-09", 3000, { Aluguel: 1000, "Compras online": 1700 }, 0, 1200)],
      saved: 5000,
    })!;
    expect(planMethods(p)[0].id).toBe("reorganizacao");
  });

  it("compares planned and spent", () => {
    const p = buildProfile({ months: [month("2026-09", 4000, { Aluguel: 1500, Delivery: 600 })], saved: 10000 })!;
    const plan = planMethods(p).find((m) => m.id === "50-30-20")!;
    const rows = planVsActual(plan, month("2026-10", 4000, { Aluguel: 2100, Delivery: 1300 }));
    expect(rows[0]).toMatchObject({ label: "Necessidades", planned: 2000, spent: 2100, over: true });
    expect(rows[1]).toMatchObject({ label: "Desejos", planned: 1200, spent: 1300, over: true });
  });

  it("has no profile without data", () => {
    expect(buildProfile({ months: [], saved: 0 })).toBeNull();
  });
});
