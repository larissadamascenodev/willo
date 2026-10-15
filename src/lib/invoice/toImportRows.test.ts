import { describe, expect, it } from "vitest";
import { anchorPurchaseDate, invoiceAnchorDate, planImportRows } from "@/lib/installments";
import { parseDateOnly } from "@/lib/dateOnly";
import { reconcileInvoice } from "./engine";
import { toCents } from "./money";
import { toImportRows, type ImportRow } from "./toImportRows";
import type { ExtractedEvent } from "./types";

/*
 * The engine replaces the rules the import used to carry. Before it does, it has to bill
 * the same months as what it replaces, on the cases that were found the hard way: a plan
 * part-way through, one instalment anticipated in the middle, two anticipated at the end,
 * and an ordinary purchase.
 */

const PERIOD = 2026 * 12 + 9; // outubro de 2026
const CLOSING = 6;

type Fixture = {
  description: string;
  amount: number;
  installment_current: number | null;
  installment_total: number | null;
  date: string;
};

/** Which invoice a date falls in, the way the database decides it. */
const periodOf = (dateStr: string) => {
  const { year, month, day } = parseDateOnly(dateStr);
  return year * 12 + month + (day >= CLOSING ? 1 : 0);
};

/** What a set of rows actually bills, month by month, however they were produced. */
const billing = (rows: Array<{ amount: number; date: string; installments: number | null; paidInstallments: number }>) => {
  const months = new Map<number, number>();
  const add = (p: number, v: number) => months.set(p, Math.round(((months.get(p) ?? 0) + v) * 100) / 100);
  for (const r of rows) {
    const base = periodOf(r.date);
    if (r.installments && r.installments > 1) {
      for (let n = r.paidInstallments + 1; n <= r.installments; n++) add(base + n - 1, r.amount);
    } else {
      add(base, r.amount);
    }
  }
  return [...months.entries()].sort((a, b) => a[0] - b[0]);
};

/** The path being replaced. */
const oldPath = (items: Fixture[]) =>
  planImportRows(items).map((row) => ({
    amount: row.item.amount,
    date: row.pinToInvoice
      ? invoiceAnchorDate(PERIOD)
      : anchorPurchaseDate(row.item, PERIOD + row.periodOffset, row.paidInstallments, CLOSING),
    installments: row.installments,
    paidInstallments: row.paidInstallments,
  }));

/** The path taking over. */
const newPath = (items: Fixture[]): ImportRow[] => {
  const events: ExtractedEvent[] = items.map((i, n) => ({
    id: `e${n}`,
    date: i.date,
    description: i.description,
    amount: toCents(i.amount),
    installmentNumber: i.installment_current,
    installmentTotal: i.installment_total,
  }));
  return toImportRows(reconcileInvoice({ events, summary: {}, invoicePeriod: PERIOD }), PERIOD);
};

const CASES: Record<string, Fixture[]> = {
  "parcelamento em andamento, nada antecipado": [
    { description: "Casas Bahia", amount: 33.57, installment_current: 5, installment_total: 10, date: "2026-09-06" },
  ],
  "uma parcela antecipada no meio de 12": [
    { description: "TerabyteShop", amount: 104.82, installment_current: 8, installment_total: 12, date: "2026-09-06" },
    { description: "Antecipada - TerabyteShop", amount: 104.82, installment_current: 9, installment_total: 12, date: "2026-10-01" },
  ],
  "as duas últimas antecipadas, nada sobra": [
    { description: "Larissa Dias", amount: 88.15, installment_current: 4, installment_total: 6, date: "2026-09-06" },
    { description: "Antecipada - Larissa Dias", amount: 88.15, installment_current: 5, installment_total: 6, date: "2026-10-01" },
    { description: "Antecipada - Larissa Dias", amount: 88.15, installment_current: 6, installment_total: 6, date: "2026-10-01" },
  ],
  "as duas últimas antecipadas com um vão no meio": [
    { description: "Larissa Dias", amount: 64.15, installment_current: 1, installment_total: 6, date: "2026-09-22" },
    { description: "Antecipada - Larissa Dias", amount: 64.15, installment_current: 5, installment_total: 6, date: "2026-10-01" },
    { description: "Antecipada - Larissa Dias", amount: 64.15, installment_current: 6, installment_total: 6, date: "2026-10-01" },
  ],
  "compra avulsa": [
    { description: "Uber", amount: 18.95, installment_current: null, installment_total: null, date: "2026-10-02" },
  ],
};

describe("o motor cobra os mesmos meses que o caminho que ele substitui", () => {
  for (const [name, items] of Object.entries(CASES)) {
    it(name, () => {
      expect(billing(newPath(items))).toEqual(billing(oldPath(items)));
    });
  }
});

describe("e cobra o que a fatura mandou", () => {
  it("a parcela do mês mais a antecipada caem nesta fatura, o resto segue", () => {
    const months = billing(newPath(CASES["uma parcela antecipada no meio de 12"]));
    expect(months).toEqual([
      [PERIOD, 209.64],
      [PERIOD + 1, 104.82],
      [PERIOD + 2, 104.82],
      [PERIOD + 3, 104.82],
    ]);
  });

  it("com as duas últimas antecipadas não sobra mês nenhum", () => {
    expect(billing(newPath(CASES["as duas últimas antecipadas, nada sobra"]))).toEqual([[PERIOD, 264.45]]);
  });

  it("o vão entre a parcela do mês e as antecipadas continua sendo cobrado", () => {
    const months = billing(newPath(CASES["as duas últimas antecipadas com um vão no meio"]));
    expect(months).toEqual([
      [PERIOD, 192.45],
      [PERIOD + 1, 64.15],
      [PERIOD + 2, 64.15],
      [PERIOD + 3, 64.15],
    ]);
  });
});

describe("o que o caminho antigo não sabia fazer", () => {
  it("o desconto de antecipação entra como crédito ligado à operação", () => {
    const rows = newPath([
      { description: "TerabyteShop", amount: 104.82, installment_current: 8, installment_total: 12, date: "2026-09-06" },
      { description: "Antecipada - TerabyteShop", amount: 104.82, installment_current: 9, installment_total: 12, date: "2026-10-01" },
      { description: "Desconto Antecipação TerabyteShop", amount: -3.46, installment_current: null, installment_total: null, date: "2026-10-01" },
    ]);
    const desconto = rows.find((r) => r.amount < 0);
    expect(desconto?.amount).toBe(-3.46);
    expect(desconto?.operationId).toBe(rows[0].operationId);
    expect(billing(rows)[0]).toEqual([PERIOD, 206.18]);
  });

  it("um pagamento da fatura não vira lançamento nenhum", () => {
    const rows = newPath([
      { description: "Compra", amount: 50, installment_current: null, installment_total: null, date: "2026-10-01" },
      { description: "Pagamento em 16 SET", amount: -1557.53, installment_current: null, installment_total: null, date: "2026-09-16" },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].description).toBe("Compra");
  });

  it("saldo em atraso e seu crédito não geram lançamento", () => {
    const rows = newPath([
      { description: "Saldo em atraso", amount: 928.76, installment_current: null, installment_total: null, date: "2026-09-16" },
      { description: "Crédito de atraso", amount: -928.76, installment_current: null, installment_total: null, date: "2026-09-16" },
    ]);
    expect(rows).toHaveLength(0);
  });
});

describe("o ano que o leitor inventa", () => {
  it("uma compra avulsa lida com ano errado é trazida para o ano que cabe", () => {
    const rows = newPath([
      { description: "Shein", amount: 56.22, installment_current: null, installment_total: null, date: "2024-10-09" },
    ]);
    // Dois anos atrás não é papel velho, é ano errado: o dia e o mês ficam.
    expect(rows[0].date.slice(5)).toBe("10-09");
    expect(Number(rows[0].date.slice(0, 4))).toBeGreaterThanOrEqual(new Date().getFullYear() - 1);
  });

  it("uma data do próprio período da fatura passa intacta", () => {
    const rows = newPath([
      { description: "Uber", amount: 18.95, installment_current: null, installment_total: null, date: "2026-10-02" },
    ]);
    expect(rows[0].date).toBe("2026-10-02");
  });
});

describe("a parcela do mês importado não perde a identidade", () => {
  it("uma compra 7 de 10 é gravada como parcelamento, não como à vista", () => {
    // O bug: no mês que você acabou de importar — o único que você está olhando —
    // toda compra parcelada aparecia como "à vista", e só os meses futuros diziam
    // "7 de 10".
    const [row] = newPath([
      { description: "Kabum", amount: 337.66, installment_current: 7, installment_total: 10, date: "2026-09-06" },
    ]);
    expect(row.installments).toBe(10);
    expect(row.installmentCurrent).toBe(7);
    expect(row.paidInstallments).toBe(6);
  });

  it("e continua cobrando os mesmos meses: desta até a última", () => {
    const rows = newPath([
      { description: "Kabum", amount: 100, installment_current: 8, installment_total: 10, date: "2026-09-06" },
    ]);
    // 8, 9 e 10: esta fatura e as duas seguintes.
    expect(billing(rows)).toEqual([
      [PERIOD, 100],
      [PERIOD + 1, 100],
      [PERIOD + 2, 100],
    ]);
  });

  it("a última parcela sozinha também se identifica", () => {
    const [row] = newPath([
      { description: "Kabum", amount: 50, installment_current: 10, installment_total: 10, date: "2026-09-06" },
    ]);
    expect(row.installments).toBe(10);
    expect(row.installmentCurrent).toBe(10);
  });

  it("uma antecipação no meio não faz o plano atravessar o buraco", () => {
    // 4 de 6 nesta fatura, com a 6 antecipada: o plano vai de 4 a 5, e a 6 é
    // cobrança própria. Escrever 4..6 cobraria um mês já quitado.
    const rows = newPath([
      { description: "Larissa Dias", amount: 88.15, installment_current: 4, installment_total: 6, date: "2026-09-06" },
      { description: "Antecipada - Larissa Dias", amount: 88.15, installment_current: 6, installment_total: 6, date: "2026-10-01" },
    ]);
    const plano = rows.find((r) => r.installments && !/antecipad/i.test(r.description));
    expect(plano?.installmentCurrent).toBe(4);
    expect(plano?.installments).toBe(5);
  });
});
