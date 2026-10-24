import { describe, expect, it } from "vitest";
import { buildHistoryRows, buildProjectionRows } from "@/lib/projectionRows";

describe("buildHistoryRows", () => {
  const past = [
    { month: 4, year: 2026, income: 0, expense: 0 },
    { month: 5, year: 2026, income: 0, expense: 0 },
    { month: 6, year: 2026, income: 5000, expense: 4000 },
    { month: 7, year: 2026, income: 5000, expense: 5500 },
    { month: 8, year: 2026, income: 5200, expense: 4700 },
  ];

  it("drops the empty months before the account had anything in it", () => {
    const rows = buildHistoryRows(past, 2000);
    expect(rows.map((r) => r.month)).toEqual([6, 7, 8]);
  });

  it("closes the last month on the balance the projection starts from", () => {
    const rows = buildHistoryRows(past, 2000);
    expect(rows[rows.length - 1].fecha).toBe(2000);
  });

  it("chains back so each month opens on the close of the one before", () => {
    const rows = buildHistoryRows(past, 2000);
    // September closed on 2000 after adding 500, so it opened on 1500 — August's close.
    expect(rows[2].prevBalance).toBe(1500);
    expect(rows[1].fecha).toBe(1500);
    // August lost 500, so it opened on 2000 — July's close.
    expect(rows[0].fecha).toBe(2000);
    rows.forEach((r) => expect(r.fecha - r.prevBalance).toBe(r.sobra));
  });

  it("meets the forward projection with no step at today", () => {
    const history = buildHistoryRows(past, 2000);
    const ahead = buildProjectionRows(
      [{ month: 9, year: 2026, balance: 0, delta: 300, income: 4800, expense: 4500, risk: "positivo" }],
      2000,
    );
    expect(ahead[0].prevBalance).toBe(history[history.length - 1].fecha);
  });

  it("is empty when there is no history at all", () => {
    expect(buildHistoryRows([{ month: 8, year: 2026, income: 0, expense: 0 }], 0)).toEqual([]);
  });
});
