import { describe, expect, it } from "vitest";
import { readNotice } from "../../supabase/functions/copilot/notice";

describe("aviso do banco no Copilot", () => {
  it("compra no débito com a loja", () => {
    expect(readNotice("Compra no débito aprovada\nCompra de R$ 21,00 APROVADA em PADARIA DOCE LAR para o cartão com final 1234.", "Nubank")).toEqual({
      amount: 21,
      type: "despesa",
      method: "conta",
      name: "Padaria Doce Lar",
    });
  });

  it("compra no crédito", () => {
    const n = readNotice("Compra aprovada no crédito: R$ 89,40 em CARREFOUR", "Itaú");
    expect(n?.method).toBe("cartao");
    expect(n?.name).toBe("Carrefour");
    expect(n?.amount).toBe(89.4);
  });

  it("Pix recebido é receita, com quem mandou", () => {
    const n = readNotice("Você recebeu um Pix de R$ 150,00 de MARIA SILVA", "Nubank");
    expect(n).toEqual({ amount: 150, type: "receita", method: "conta", name: "Maria Silva" });
  });

  it("Pix enviado", () => {
    const n = readNotice("Pix de R$ 50,00 enviado para JOÃO PEREIRA", "Inter");
    expect(n?.type).toBe("despesa");
    expect(n?.method).toBe("conta");
    expect(n?.name).toBe("João Pereira");
  });

  it("sem loja: um nome que diz o que foi", () => {
    expect(readNotice("Compra no débito aprovada de R$ 12,90", "Nubank")?.name).toBe("Compra no débito · Nubank");
  });

  it("o que não é dinheiro saindo ou entrando fica de fora", () => {
    expect(readNotice("Sua fatura fechou: R$ 413,20. Vence em 7 de dezembro.", "Nubank")).toBeNull();
    expect(readNotice("Seu limite aumentou para R$ 6.000,00!", "Nubank")).toBeNull();
    expect(readNotice("Compra de R$ 30,00 não aprovada em LOJA X", "Nubank")).toBeNull();
    expect(readNotice("Seu dinheiro rendeu R$ 3,20 este mês", "Nubank")).toBeNull();
  });
});
