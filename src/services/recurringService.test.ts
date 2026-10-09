import { describe, expect, it } from "vitest";
import { recurringSignature } from "./recurringService";

/*
 * What counts as the same standing commitment, and what does not.
 *
 * The case that mattered: a salary paid in two parts, on the 6th and the 15th. Everything
 * about them matches except the day, and leaving the day out of the signature made the
 * newer one silently replace the older one in every month.
 */

const salario = (date: string, over: Record<string, unknown> = {}) => ({
  name: "Salário",
  type: "receita",
  category: "Salário",
  amount: 850,
  payment_method: "conta",
  account_id: "acc-1",
  credit_card_id: null,
  date,
  ...over,
});

describe("assinatura de uma recorrência", () => {
  it("duas partes do mesmo salário, em dias diferentes, são duas coisas", () => {
    expect(recurringSignature(salario("2026-10-06"))).not.toBe(
      recurringSignature(salario("2026-10-15")),
    );
  });

  it("a mesma recorrência redefinida meses depois continua sendo uma só", () => {
    expect(recurringSignature(salario("2026-06-06"))).toBe(
      recurringSignature(salario("2026-10-06")),
    );
  });

  it("mesmo dia mas valor diferente são duas coisas", () => {
    expect(recurringSignature(salario("2026-10-06"))).not.toBe(
      recurringSignature(salario("2026-10-06", { amount: 1200 })),
    );
  });

  it("mesmo dia mas conta diferente são duas coisas", () => {
    expect(recurringSignature(salario("2026-10-06"))).not.toBe(
      recurringSignature(salario("2026-10-06", { account_id: "acc-2" })),
    );
  });

  it("o valor é comparado como número, não como texto", () => {
    expect(recurringSignature(salario("2026-10-06", { amount: 850 }))).toBe(
      recurringSignature(salario("2026-10-06", { amount: "850.00" })),
    );
  });

  it("o dia é lido da data, não do fuso", () => {
    // parseDateOnly existe para isto: 2026-10-06 é dia 6 em qualquer lugar do mundo.
    expect(recurringSignature(salario("2026-10-06"))).toContain("::6");
  });
});
