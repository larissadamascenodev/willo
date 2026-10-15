import { describe, expect, it } from "vitest";
import { readInvoice, type RawInvoiceItem } from "./readModel";

/*
 * O que uma fatura contém, decidido num lugar só.
 *
 * Estes testes existem porque sete telas decidiam isso cada uma do seu jeito, e por
 * isso uma correção numa não valia na outra.
 */

const item = (over: Partial<RawInvoiceItem> & { id: string }): RawInvoiceItem => ({
  transaction_id: `tx-${over.id}`,
  amount: 100,
  installment_number: null,
  total_installments: null,
  transaction_name: "Compra",
  transaction_category: "Outros",
  transaction_date: "2026-10-10",
  created_at: "2026-10-14T12:00:00Z",
  ...over,
});

describe("o que cada linha é", () => {
  it("uma compra simples é à vista", () => {
    expect(readInvoice([item({ id: "a" })]).lines[0].kind).toBe("avista");
  });

  it("uma parcela de um plano é parcelado, e diz qual de quantas", () => {
    const [line] = readInvoice([
      item({ id: "a", installment_number: 3, total_installments: 10 }),
    ]).lines;
    expect(line.kind).toBe("parcelado");
    expect(line.installment).toEqual({ current: 3, total: 10 });
  });

  it("valor negativo é estorno, mesmo sendo de um parcelamento", () => {
    // A direção do dinheiro ganha do formato da compra: um estorno de parcela é
    // dinheiro voltando, não uma parcela.
    const [line] = readInvoice([
      item({ id: "a", amount: -40, installment_number: 2, total_installments: 6 }),
    ]).lines;
    expect(line.kind).toBe("estorno");
  });

  it("antecipação é reconhecida pelo nome, como a fatura escreve", () => {
    expect(
      readInvoice([item({ id: "a", transaction_name: "Antecipada - TerabyteShop" })]).lines[0].kind,
    ).toBe("antecipacao");
  });

  it("uma compra à vista não ganha rótulo de parcela", () => {
    expect(readInvoice([item({ id: "a", total_installments: 1 })]).lines[0].installment)
      .toBeUndefined();
  });
});

describe("a ordem", () => {
  it("do mais recente para o mais antigo, pela data da compra", () => {
    const read = readInvoice([
      item({ id: "velho", transaction_date: "2026-10-02" }),
      item({ id: "novo", transaction_date: "2026-10-28" }),
      item({ id: "meio", transaction_date: "2026-10-15" }),
    ]);
    expect(read.lines.map((l) => l.id)).toEqual(["novo", "meio", "velho"]);
  });

  it("a ordem de escrita não decide nada: uma importação grava o mês inteiro no mesmo segundo", () => {
    const read = readInvoice([
      item({ id: "a", transaction_date: "2026-10-01", created_at: "2026-10-14T12:00:00Z" }),
      item({ id: "b", transaction_date: "2026-10-20", created_at: "2026-10-14T12:00:01Z" }),
    ]);
    expect(read.lines[0].id).toBe("b");
  });

  it("no mesmo dia, a última escrita vem primeiro", () => {
    const read = readInvoice([
      item({ id: "antes", created_at: "2026-10-14T12:00:00Z" }),
      item({ id: "depois", created_at: "2026-10-14T13:00:00Z" }),
    ]);
    expect(read.lines[0].id).toBe("depois");
  });
});

describe("as contas", () => {
  it("o estorno abate o total, não soma", () => {
    const read = readInvoice([
      item({ id: "a", amount: 200 }),
      item({ id: "b", amount: -50 }),
    ]);
    expect(read.charges).toBe(200);
    expect(read.refunds).toBe(50);
    expect(read.total).toBe(150);
  });

  it("um estorno maior que a compra deixa a fatura negativa, e isso é dito", () => {
    const read = readInvoice([
      item({ id: "a", amount: 30 }),
      item({ id: "b", amount: -100 }),
    ]);
    expect(read.total).toBe(-70);
  });

  it("centavos não acumulam erro", () => {
    const read = readInvoice([
      item({ id: "a", amount: 0.1 }),
      item({ id: "b", amount: 0.2 }),
    ]);
    expect(read.total).toBe(0.3);
  });

  it("uma fatura vazia é zero, não NaN", () => {
    const read = readInvoice([]);
    expect(read.total).toBe(0);
    expect(read.lines).toEqual([]);
  });

  it("conta quantas de cada tipo, para a tela poder dizer", () => {
    const read = readInvoice([
      item({ id: "a" }),
      item({ id: "b", installment_number: 1, total_installments: 3 }),
      item({ id: "c", amount: -10 }),
    ]);
    expect(read.counts).toMatchObject({ avista: 1, parcelado: 1, estorno: 1 });
  });
});
