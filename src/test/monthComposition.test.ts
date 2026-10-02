import { describe, expect, it } from "vitest";
import { buildMonthComposition } from "@/lib/monthComposition";

const tx = (over: Record<string, unknown>) => ({
  type: "despesa",
  amount: 0,
  payment_method: "conta",
  recurrence_type: "unica",
  ...over,
}) as Parameters<typeof buildMonthComposition>[0][number];

describe("buildMonthComposition", () => {
  it("splits fixed bills, instalments and one-offs, and the slices add back to the totals", () => {
    const txs = [
      tx({ type: "receita", amount: 5000, recurrence_type: "fixa" }),
      tx({ type: "receita", amount: 300 }),
      tx({ amount: 1500, recurrence_type: "fixa" }),
      tx({ amount: 400, recurrence_type: "parcelado" }),
      tx({ amount: 250 }),
    ];
    const c = buildMonthComposition(txs, { income: 5300, expense: 2150, cardExpense: 0 });

    expect(c.income).toEqual({ fixas: 5000, outras: 300 });
    expect(c.expense).toEqual({ fixas: 1500, parcelas: 400, cartao: 0, cartaoParcelas: 0, outras: 250 });
    const e = c.expense;
    expect(e.fixas + e.parcelas + e.cartao + e.outras).toBe(2150);
  });

  it("counts a card statement once and reports its instalment share inside it", () => {
    const txs = [
      tx({ amount: 1500, recurrence_type: "fixa" }),
      tx({ amount: 200, payment_method: "cartao", recurrence_type: "parcelado" }),
      tx({ amount: 90, payment_method: "cartao" }),
    ];
    const c = buildMonthComposition(txs, { income: 0, expense: 1500 + 800, cardExpense: 800 });

    expect(c.expense.cartao).toBe(800);
    expect(c.expense.cartaoParcelas).toBe(200);
    // the card's instalments are not also counted as account instalments
    expect(c.expense.parcelas).toBe(0);
    expect(c.expense.outras).toBe(0);
  });

  it("never reports more instalments than the statement holds", () => {
    const txs = [tx({ amount: 500, payment_method: "cartao", recurrence_type: "parcelado" })];
    const c = buildMonthComposition(txs, { income: 0, expense: 300, cardExpense: 300 });
    expect(c.expense.cartaoParcelas).toBe(300);
  });

  it("skips transfers and investments, like the totals do", () => {
    const txs = [
      tx({ type: "transferencia", amount: 900, recurrence_type: "fixa" }),
      tx({ type: "investimento", amount: 700, recurrence_type: "parcelado" }),
    ];
    const c = buildMonthComposition(txs, { income: 0, expense: 0, cardExpense: 0 });
    expect(c.expense).toEqual({ fixas: 0, parcelas: 0, cartao: 0, cartaoParcelas: 0, outras: 0 });
  });

  it("treats the copy of a recurring series as fixed", () => {
    const txs = [tx({ amount: 120, parent_transaction_id: "abc" })];
    const c = buildMonthComposition(txs, { income: 0, expense: 120, cardExpense: 0 });
    expect(c.expense.fixas).toBe(120);
  });

  it("leaves an opening balance in the one-off income so the total still matches", () => {
    const txs = [tx({ type: "receita", amount: 3000, recurrence_type: "fixa" })];
    const c = buildMonthComposition(txs, { income: 3000 + 800, expense: 0, cardExpense: 0 });
    expect(c.income).toEqual({ fixas: 3000, outras: 800 });
  });
});
