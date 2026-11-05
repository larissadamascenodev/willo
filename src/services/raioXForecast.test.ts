import { describe, expect, it } from "vitest";
import { buildForecast } from "./raioXForecast";
import type { DashboardData } from "@/types/finance";
import type { RawTx } from "./raioXAnalytics";

const today = new Date(2026, 10, 10, 12);

const month = (over: Partial<DashboardData>): DashboardData =>
  ({ saldoAtual: 1000, receitas: 3000, events: [], ...over }) as DashboardData;

const tx = (over: Partial<RawTx>): RawTx =>
  ({ id: "t", name: "Mercado", amount: 310, type: "despesa", category: "Mercado", date: "2026-11-05", status: "pago", payment_method: "conta", recurrence_type: "unica", ...over }) as RawTx;

describe("previsão do mês", () => {
  it("uma conta vencida neste mês e não paga continua saindo", () => {
    const f = buildForecast(
      month({ events: [{ id: "e", name: "Luz", category: "Contas", date: "3 nov", rawDate: "2026-11-03", amount: 200, status: "pendente", type: "despesa" }] as never }),
      [],
      today,
    );
    expect(f.committedRest).toBe(200);
    expect(f.endBalance).toBe(800);
  });

  it("compra no cartão não entra no ritmo: ela sai com a fatura", () => {
    const f = buildForecast(month({}), [tx({ payment_method: "cartao" })], today);
    expect(f.estimatedRest).toBe(0);
    expect(f.endBalance).toBe(1000);
  });

  it("gasto pago na conta entra no ritmo, e o pendente não", () => {
    const paid = buildForecast(month({}), [tx({})], today);
    expect(paid.estimatedRest).toBeGreaterThan(0);
    const waiting = buildForecast(month({}), [tx({ status: "pendente" })], today);
    expect(waiting.estimatedRest).toBe(0);
  });

  it("os dias que já passaram não têm saldo para desenhar", () => {
    const f = buildForecast(month({}), [], today);
    expect(Number.isNaN(f.days[0].balance)).toBe(true);
    expect(f.days.find((d) => d.isToday)?.balance).toBe(1000);
  });
});
