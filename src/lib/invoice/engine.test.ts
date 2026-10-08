import { describe, expect, it } from "vitest";
import { reconcileInvoice } from "./engine";
import { toCents } from "./money";
import type { ExtractedEvent, InvoiceSummary } from "./types";

/*
 * The cases listed in the import specification, plus the statement they were found on.
 * Each one is a rule that a real invoice broke at some point.
 */

const PERIOD = 2026 * 12 + 9; // outubro de 2026

let seq = 0;
const ev = (
  description: string,
  reais: number,
  extra: Partial<ExtractedEvent> = {},
): ExtractedEvent => ({
  id: `e${++seq}`,
  date: "2026-10-01",
  description,
  amount: toCents(reais),
  ...extra,
});

const run = (events: ExtractedEvent[], summary: InvoiceSummary = {}) =>
  reconcileInvoice({ events, summary, invoicePeriod: PERIOD });

const plan = (n: number, total: number) => ({ installmentNumber: n, installmentTotal: total });

describe("1. compra simples", () => {
  it("vira uma operação de compra, cobrada nesta fatura", () => {
    const r = run([ev("Padaria do Zé", 23.9)]);
    expect(r.operations).toHaveLength(1);
    expect(r.operations[0].kind).toBe("PURCHASE");
    expect(r.reconciliation.calculatedTotal).toBe(toCents(23.9));
    expect(r.installments).toHaveLength(0);
  });
});

describe("2. compra parcelada", () => {
  it("cobra uma parcela agora e deixa o resto no futuro", () => {
    const r = run([ev("Loja X", 100, plan(1, 3))]);
    expect(r.reconciliation.calculatedTotal).toBe(toCents(100));
    expect(r.installments.filter((i) => i.status === "FUTURE")).toHaveLength(2);
    expect(r.operations[0].remainingInstallments).toBe(2);
  });
});

describe("3. parcela 5/10", () => {
  const r = run([ev("Compra X", 100, plan(5, 10))]);

  it("não recria as parcelas que ficaram para trás", () => {
    const historical = r.installments.filter((i) => i.status === "HISTORICAL");
    expect(historical.map((i) => i.installmentNumber)).toEqual([1, 2, 3, 4]);
    expect(historical.every((i) => i.periodIndex === null)).toBe(true);
  });

  it("cobra a quinta nesta fatura e projeta da sexta à décima", () => {
    expect(r.installments.find((i) => i.status === "CURRENT")?.installmentNumber).toBe(5);
    expect(r.installments.filter((i) => i.status === "FUTURE").map((i) => i.installmentNumber))
      .toEqual([6, 7, 8, 9, 10]);
  });

  it("não cria dez despesas", () => {
    expect(r.operations).toHaveLength(1);
    expect(r.reconciliation.calculatedTotal).toBe(toCents(100));
  });
});

describe("4. Pix no crédito", () => {
  it("preserva principal, IOF, juros e total financiado", () => {
    const r = run([
      ev("Pix no Crédito - Larissa Dias Damasceno", 64.15, {
        ...plan(1, 6),
        financing: {
          principal: toCents(300),
          iof: toCents(2.01),
          interest: toCents(82.88),
          financedTotal: toCents(384.89),
          installmentCount: 6,
          installmentAmount: toCents(64.15),
        },
      }),
    ]);
    const op = r.operations[0];
    expect(op.kind).toBe("PIX_ON_CREDIT");
    expect(op.financing?.principal).toBe(toCents(300));
    expect(op.financing?.iof).toBe(toCents(2.01));
    expect(op.financing?.interest).toBe(toCents(82.88));
    expect(op.financing?.financedTotal).toBe(toCents(384.89));
    expect(op.financing?.installmentCount).toBe(6);
    expect(op.financing?.installmentAmount).toBe(toCents(64.15));
  });
});

describe("5. Pix no crédito mais pagamento da fatura", () => {
  const r = run([
    ev("Pix no Crédito - Fulano", 64.15, plan(1, 6)),
    ev("Pagamento em 16 SET", -300),
  ]);

  it("não trata os dois como a mesma operação", () => {
    expect(r.payments).toHaveLength(1);
    expect(r.payments[0].amount).toBe(toCents(300));
    expect(r.operations.some((o) => o.eventIds.includes(r.payments[0].eventIds[0]))).toBe(false);
  });

  it("o pagamento não cancela o Pix", () => {
    const pix = r.operations.find((o) => o.kind === "PIX_ON_CREDIT")!;
    expect(pix.status).toBe("ACTIVE");
    expect(pix.remainingInstallments).toBe(5);
  });
});

describe("6. pagamento da fatura", () => {
  it("não vira despesa e não entra no total", () => {
    const r = run([ev("Pagamento em 14 AGO", -1000)]);
    expect(r.payments[0].amount).toBe(toCents(1000));
    expect(r.operations).toHaveLength(0);
    expect(r.reconciliation.calculatedTotal).toBe(0);
  });
});

describe("7. antecipação", () => {
  const r = run([
    ev("Larissa Dias Damasceno", 88.15, plan(4, 6)),
    ev("Antecipada - Larissa Dias Damasceno", 88.15, plan(5, 6)),
    ev("Antecipada - Larissa Dias Damasceno", 88.15, plan(6, 6)),
  ]);

  it("marca as antecipadas e tira elas do futuro", () => {
    const anticipated = r.installments.filter((i) => i.status === "ANTICIPATED");
    expect(anticipated.map((i) => i.installmentNumber).sort()).toEqual([5, 6]);
    expect(r.installments.filter((i) => i.status === "FUTURE")).toHaveLength(0);
    expect(r.projection).toHaveLength(0);
  });

  it("cobra as três nesta fatura, uma vez cada", () => {
    expect(r.reconciliation.calculatedTotal).toBe(toCents(88.15 * 3));
  });
});

describe("7b. antecipação no meio do parcelamento", () => {
  it("só remove a parcela antecipada, o resto continua", () => {
    const r = run([
      ev("TerabyteShop", 104.82, plan(8, 12)),
      ev("Antecipada - TerabyteShop", 104.82, plan(9, 12)),
    ]);
    expect(r.installments.filter((i) => i.status === "FUTURE").map((i) => i.installmentNumber))
      .toEqual([10, 11, 12]);
    expect(r.reconciliation.calculatedTotal).toBe(toCents(104.82 * 2));
  });
});

describe("8. desconto de antecipação", () => {
  it("relaciona o desconto à operação em vez de criar uma compra", () => {
    const r = run([
      ev("TerabyteShop", 104.82, plan(8, 12)),
      ev("Antecipada - TerabyteShop", 104.82, plan(9, 12)),
      ev("Desconto Antecipação TerabyteShop", -3.46),
    ]);
    expect(r.operations).toHaveLength(1);
    expect(r.operations[0].anticipationDiscount).toBe(toCents(3.46));
    expect(r.reconciliation.calculatedTotal).toBe(toCents(104.82 * 2 - 3.46));
  });
});

describe("9. estorno", () => {
  it("compra e estorno se anulam e os dois continuam no histórico", () => {
    const r = run([ev("Loja Y", 500), ev("Estorno de Loja Y", -500)]);
    expect(r.reconciliation.calculatedTotal).toBe(0);
    expect(r.rawEvents).toHaveLength(2);
    expect(r.rawEvents.map((e) => e.category)).toContain("REFUND");
  });

  it("uma compra parcelada estornada na primeira parcela não deixa futuro", () => {
    const r = run([
      ev("Shein", 22.84, plan(1, 9)),
      ev("Estorno de Shein", -22.84),
    ]);
    expect(r.installments.filter((i) => i.status === "FUTURE")).toHaveLength(0);
    expect(r.reconciliation.calculatedTotal).toBe(0);
  });
});

describe("10. crédito", () => {
  it("entra como crédito, não como despesa negativa inventada", () => {
    const r = run([ev("Crédito de Shein", -46.85)]);
    expect(r.rawEvents[0].category).toBe("CREDIT");
    expect(r.operations[0].kind).toBe("CREDIT");
    expect(r.reconciliation.calculatedTotal).toBe(toCents(-46.85));
  });
});

describe("11, 12, 13. IOF, juros e multa", () => {
  it("são encargos separados, não escondidos numa compra", () => {
    const r = run([
      ev("IOF de Anthropic", 4.02),
      ev("Juros de atraso", 1.85),
      ev("Multa de atraso", 18.65),
    ]);
    expect(r.rawEvents.map((e) => e.category)).toEqual(["IOF", "INTEREST", "FINE"]);
    expect(r.operations.every((o) => o.kind === "CHARGE")).toBe(true);
    expect(r.reconciliation.calculatedTotal).toBe(toCents(4.02 + 1.85 + 18.65));
  });
});

describe("14. dívida em atraso", () => {
  it("não vira compra, e a dívida não dobra por aparecer duas vezes", () => {
    const r = run([
      ev("Saldo em atraso", 928.76),
      ev("Crédito de atraso", -928.76),
      ev("Encerramento de dívida", 16.5),
      ev("Estorno de juros da dívida encerrada", -16.5),
    ]);
    expect(r.rawEvents.every((e) => e.category === "DEBT_SETTLEMENT")).toBe(true);
    expect(r.reconciliation.calculatedTotal).toBe(0);
    expect(r.rawEvents).toHaveLength(4);
  });

  it("uma metade lida sozinha também não move dinheiro", () => {
    const r = run([ev("Estorno de juros da dívida encerrada", -16.5)]);
    expect(r.reconciliation.calculatedTotal).toBe(0);
  });
});

describe("15. limite oficial", () => {
  it("preserva os valores informados pelo banco", () => {
    const r = run([ev("Compra", 100)], {
      totalCreditLimit: toCents(6350),
      usedCreditLimit: toCents(5980.21),
      availableCreditLimit: toCents(369.77),
    });
    expect(r.limitReconciliation.officialUsed).toBe(toCents(5980.21));
    expect(r.limitReconciliation.officialAvailable).toBe(toCents(369.77));
  });
});

describe("16. divergência de limite", () => {
  it("registra a diferença em vez de sobrescrever o oficial", () => {
    const r = run([ev("Compra", 100, plan(1, 2))], {
      totalCreditLimit: toCents(6350),
      usedCreditLimit: toCents(5980.21),
    });
    expect(r.limitReconciliation.calculatedUsed).toBe(toCents(200));
    expect(r.limitReconciliation.officialUsed).toBe(toCents(5980.21));
    expect(r.limitReconciliation.status).toBe("DISCREPANCY");
    expect(r.alerts.map((a) => a.code)).toContain("LIMIT_MISMATCH");
  });
});

describe("17. divergência de fatura", () => {
  it("reporta a diferença e não cria lançamento fictício", () => {
    const r = run([ev("Compra", 960)], { officialTotal: toCents(973.44) });
    expect(r.reconciliation.officialTotal).toBe(toCents(973.44));
    expect(r.reconciliation.calculatedTotal).toBe(toCents(960));
    expect(r.reconciliation.difference).toBe(toCents(13.44));
    expect(r.reconciliation.status).toBe("DISCREPANCY");
    expect(r.rawEvents).toHaveLength(1);
    expect(r.alerts.map((a) => a.code)).toContain("OFFICIAL_TOTAL_MISMATCH");
  });

  it("fecha quando bate", () => {
    const r = run([ev("Compra", 973.44)], { officialTotal: toCents(973.44) });
    expect(r.reconciliation.difference).toBe(0);
    expect(r.reconciliation.status).toBe("RECONCILED");
    expect(r.alerts.map((a) => a.code)).not.toContain("OFFICIAL_TOTAL_MISMATCH");
  });
});

describe("18. reimportação da mesma fatura", () => {
  it("o mesmo documento produz exatamente o mesmo resultado", () => {
    const events = [
      ev("Loja", 100, plan(2, 4)),
      ev("Pagamento em 10 SET", -50),
      ev("IOF", 1.5),
    ];
    const a = reconcileInvoice({ events, summary: {}, invoicePeriod: PERIOD });
    const b = reconcileInvoice({ events, summary: {}, invoicePeriod: PERIOD });
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });
});

describe("19. múltiplas operações com o mesmo valor", () => {
  it("não agrupa lojas diferentes só porque o valor é igual", () => {
    const r = run([
      ev("Pix no Crédito - Fulano", 300),
      ev("Pagamento em 01 OUT", -300),
      ev("Loja Z", 300),
      ev("Estorno de Outra Loja", -300),
    ]);
    expect(r.payments).toHaveLength(1);
    expect(r.operations).toHaveLength(3);
    expect(new Set(r.operations.map((o) => o.id)).size).toBe(3);
  });

  it("dois parcelamentos iguais na mesma loja seguem separados", () => {
    const r = run([
      ev("Larissa Dias", 67.67, plan(1, 5)),
      ev("Larissa Dias", 67.67, plan(1, 5)),
    ]);
    expect(r.operations).toHaveLength(2);
    expect(r.installments.filter((i) => i.status === "FUTURE")).toHaveLength(8);
    expect(r.alerts.map((a) => a.code)).toContain("DUPLICATE_TRANSACTION");
  });
});

describe("20. múltiplas parcelas da mesma operação", () => {
  it("todas as parcelas apontam para a mesma operação", () => {
    const r = run([ev("KaBuM!", 337.66, plan(7, 10))]);
    const op = r.operations[0];
    expect(r.installments).toHaveLength(10);
    expect(r.installments.every((i) => i.operationId === op.id)).toBe(true);
    expect(r.projection.map((p) => p.periodIndex)).toEqual([PERIOD + 1, PERIOD + 2, PERIOD + 3]);
  });
});

describe("auditoria", () => {
  it("todo evento aponta para a operação ou pagamento que o consumiu", () => {
    const r = run([
      ev("TerabyteShop", 104.82, plan(8, 12)),
      ev("Antecipada - TerabyteShop", 104.82, plan(9, 12)),
      ev("Desconto Antecipação TerabyteShop", -3.46),
      ev("Pagamento em 01 OUT", -500),
    ]);
    const consumed = new Set([
      ...r.operations.flatMap((o) => o.eventIds),
      ...r.payments.flatMap((p) => p.eventIds),
    ]);
    expect(r.rawEvents.every((e) => consumed.has(e.id))).toBe(true);
  });
});
