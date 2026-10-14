import { describe, expect, it } from "vitest";
import { applyDefaults, answer, isReady, missingFrom, nextQuestion } from "./resolve";
import type { QuickDraft, QuickSetup } from "./types";

/*
 * The rule being protected: the app asks about what it cannot know, and never about
 * what it already knows. Someone with one account answering "qual conta?" is the bug.
 */

const draft = (over: Partial<QuickDraft> = {}): QuickDraft => ({
  id: "d1",
  name: "Mercado",
  type: "despesa",
  amount: 30,
  category: "Supermercado",
  date: "2026-10-14",
  paymentMethod: null,
  accountId: null,
  creditCardId: null,
  ...over,
});

const setup = (accounts: number, cards: number): QuickSetup => ({
  accounts: Array.from({ length: accounts }, (_, i) => ({ id: `a${i}`, name: `Conta ${i}` })),
  cards: Array.from({ length: cards }, (_, i) => ({ id: `c${i}`, name: `Cartão ${i}` })),
});

const resolved = (d: QuickDraft, s: QuickSetup) => applyDefaults(d, s);

describe("o que não vale perguntar", () => {
  it("sem cartão nenhum, não pergunta débito ou crédito", () => {
    const s = setup(1, 0);
    expect(missingFrom(resolved(draft(), s), s)).toBeNull();
  });

  it("com uma conta só, não pergunta qual conta", () => {
    const s = setup(1, 0);
    expect(resolved(draft(), s).accountId).toBe("a0");
  });

  it("com um cartão só, não pergunta qual cartão", () => {
    const s = setup(1, 1);
    expect(resolved(draft({ paymentMethod: "cartao" }), s).creditCardId).toBe("c0");
  });

  it("receita não pergunta débito ou crédito, mesmo com cartão", () => {
    const s = setup(1, 2);
    const d = resolved(draft({ type: "receita", category: "Salário" }), s);
    expect(d.paymentMethod).toBe("conta");
    expect(missingFrom(d, s)).toBeNull();
  });

  it("sem conta e sem cartão, salva do jeito que está", () => {
    const s = setup(0, 0);
    expect(missingFrom(resolved(draft(), s), s)).toBeNull();
  });
});

describe("o que vale perguntar", () => {
  it("com cartão cadastrado, pergunta débito ou crédito", () => {
    const s = setup(1, 1);
    expect(missingFrom(resolved(draft(), s), s)).toMatchObject({ kind: "paymentMethod" });
  });

  it("com duas contas, pergunta qual conta", () => {
    const s = setup(2, 0);
    expect(missingFrom(resolved(draft(), s), s)).toMatchObject({ kind: "account" });
  });

  it("com dois cartões, pergunta qual cartão", () => {
    const s = setup(1, 2);
    const d = resolved(draft({ paymentMethod: "cartao" }), s);
    expect(missingFrom(d, s)).toMatchObject({ kind: "card" });
  });

  it("sem categoria, pergunta em que foi gasto — nunca arquiva como Outros", () => {
    const s = setup(1, 0);
    const q = missingFrom(resolved(draft({ category: null }), s), s);
    expect(q).toMatchObject({ kind: "category" });
    // Intl separa "R$" do número com espaço não-separável; o que importa é o valor.
    expect(q?.prompt).toMatch(/R\$\s30,00/);
  });

  it("a pergunta da categoria muda de lado quando é receita", () => {
    const s = setup(1, 0);
    const q = missingFrom(resolved(draft({ type: "receita", category: null }), s), s);
    expect(q?.prompt).toContain("De onde");
  });
});

describe("a ordem das perguntas", () => {
  it("a categoria vem antes da forma de pagamento", () => {
    const s = setup(2, 2);
    expect(missingFrom(resolved(draft({ category: null }), s), s)).toMatchObject({ kind: "category" });
  });

  it("termina uma entrada antes de começar a próxima", () => {
    const s = setup(2, 0);
    const a = resolved(draft({ id: "d1" }), s);
    const b = resolved(draft({ id: "d2", name: "Uber" }), s);
    expect(nextQuestion([a, b], s)).toMatchObject({ draftId: "d1" });
  });

  it("respondida uma, passa para a seguinte", () => {
    const s = setup(2, 0);
    const a = answer(resolved(draft({ id: "d1" }), s), { kind: "account", draftId: "d1", prompt: "", options: [] }, "a1");
    const b = resolved(draft({ id: "d2" }), s);
    expect(nextQuestion([a, b], s)).toMatchObject({ draftId: "d2" });
  });
});

describe("quando está pronto para salvar", () => {
  it("nada a perguntar, nada a responder", () => {
    const s = setup(1, 0);
    expect(isReady([resolved(draft(), s)], s)).toBe(true);
  });

  it("uma lista vazia não está pronta", () => {
    expect(isReady([], setup(1, 0))).toBe(false);
  });

  it("uma pendência em qualquer entrada segura o lote", () => {
    const s = setup(1, 0);
    expect(isReady([resolved(draft(), s), resolved(draft({ id: "d2", category: null }), s)], s)).toBe(false);
  });

  it("trocar para crédito larga a conta que já estava escolhida", () => {
    const s = setup(2, 2);
    const d = answer(resolved(draft({ accountId: "a1" }), s), { kind: "paymentMethod", draftId: "d1", prompt: "", options: [] }, "cartao");
    expect(applyDefaults(d, s).accountId).toBeNull();
  });
});
