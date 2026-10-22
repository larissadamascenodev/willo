import { describe, expect, it } from "vitest";
import {
  buildCategorySummaries,
  buildHabitMap,
  buildScoreMap,
  computeCategoryScore,
  enrichInstallmentImpacts,
  type AnalyticsTransaction,
  type InstallmentImpact,
} from "./categoryAnalytics";

/*
 * O que o mês diz, depois que as linhas chegaram.
 *
 * Esta parte saiu da tela de Analytics para poder ser lida — e conferida — sem montar
 * a página inteira. Os limiares do score e a regra de hábito são os mesmos que o app
 * sempre usou; estes testes existem para que continuem sendo.
 */

let seq = 0;
const tx = (over: Partial<AnalyticsTransaction> & { category: string }): AnalyticsTransaction => ({
  id: `tx-${++seq}`,
  name: "Compra",
  date: "2026-10-10",
  amount: 100,
  type: "despesa",
  ...over,
});

describe("o peso de cada categoria no mês", () => {
  it("receita não é gasto, e não entra na conta", () => {
    const resumo = buildCategorySummaries([
      tx({ category: "Alimentação", amount: 300 }),
      tx({ category: "Salário", amount: 5000, type: "receita" }),
    ]);
    expect(resumo).toHaveLength(1);
    expect(resumo[0]).toMatchObject({ name: "Alimentação", amount: 300, percentage: 100 });
  });

  it("a porcentagem é sobre o total de despesas do mês", () => {
    const resumo = buildCategorySummaries([
      tx({ category: "Alimentação", amount: 750 }),
      tx({ category: "Transporte", amount: 250 }),
    ]);
    expect(resumo.map((c) => [c.name, c.percentage])).toEqual([
      ["Alimentação", 75],
      ["Transporte", 25],
    ]);
  });

  it("vem da maior para a menor, com a média por lançamento", () => {
    const resumo = buildCategorySummaries([
      tx({ category: "Transporte", amount: 40 }),
      tx({ category: "Alimentação", amount: 90 }),
      tx({ category: "Alimentação", amount: 110 }),
    ]);
    expect(resumo.map((c) => c.name)).toEqual(["Alimentação", "Transporte"]);
    expect(resumo[0]).toMatchObject({ txCount: 2, avgPerTx: 100 });
  });

  it("um mês sem nada não divide por zero", () => {
    expect(buildCategorySummaries([])).toEqual([]);
  });
});

describe("quando uma categoria está fora de controle", () => {
  it("passar de 30% do mês já é exagero sozinho", () => {
    expect(computeCategoryScore(31, null, 1)).toBe("exagerado");
  });

  it("crescer mais de 25% é exagero mesmo sendo pouco do mês", () => {
    expect(computeCategoryScore(3, 26, 1)).toBe("exagerado");
  });

  it("dez lançamentos é exagero mesmo sem ter crescido", () => {
    expect(computeCategoryScore(3, -50, 10)).toBe("exagerado");
  });

  it("a faixa do meio é atenção", () => {
    expect(computeCategoryScore(20, null, 1)).toBe("atencao");
    expect(computeCategoryScore(3, 12, 1)).toBe("atencao");
    expect(computeCategoryScore(3, null, 7)).toBe("atencao");
  });

  it("pouco do mês, estável e esparso é saudável", () => {
    expect(computeCategoryScore(5, 2, 3)).toBe("saudavel");
  });
});

describe("a comparação com o mês passado", () => {
  it("sem a categoria no mês passado, não há variação a comparar", () => {
    const mapa = buildScoreMap([{ name: "Pets", amount: 200, percentage: 5, txCount: 2, avgPerTx: 100 }], []);
    expect(mapa["Pets"].variation).toBeNull();
    expect(mapa["Pets"].score).toBe("saudavel");
  });

  it("a variação é contra a mesma categoria no mês anterior", () => {
    const mapa = buildScoreMap(
      [{ name: "Lazer", amount: 150, percentage: 5, txCount: 2, avgPerTx: 75 }],
      [{ name: "Lazer", amount: 100 }],
    );
    expect(mapa["Lazer"].variation).toBe(50);
    expect(mapa["Lazer"].score).toBe("exagerado");
  });
});

describe("o que virou rotina", () => {
  const outubro = new Date(2026, 9, 10);

  it("oito lançamentos no mês é rotina, não decisão", () => {
    const txs = Array.from({ length: 8 }, (_, i) => tx({ category: "Cafeteria", name: `Café ${i}`, amount: 10 }));
    expect(buildHabitMap(txs, 9, 2026, outubro)["Cafeteria"].isHabit).toBe(true);
  });

  it("o mesmo lugar quatro vezes também é", () => {
    const txs = Array.from({ length: 4 }, () => tx({ category: "Alimentação", name: "Padaria da esquina", amount: 20 }));
    const habito = buildHabitMap(txs, 9, 2026, outubro)["Alimentação"];
    expect(habito.isHabit).toBe(true);
    expect(habito.topMerchant).toEqual({ name: "Padaria da esquina", count: 4 });
  });

  it("um lugar que apareceu uma vez só não vira destaque", () => {
    const txs = [tx({ category: "Lazer", name: "Cinema", amount: 50 })];
    const habito = buildHabitMap(txs, 9, 2026, outubro)["Lazer"];
    expect(habito.isHabit).toBe(false);
    expect(habito.topMerchant).toBeNull();
  });

  it("no mês corrente o custo por dia é sobre os dias já vividos", () => {
    const txs = [tx({ category: "Transporte", amount: 200 })];
    expect(buildHabitMap(txs, 9, 2026, outubro)["Transporte"].dailyCost).toBe(20);
  });

  it("num mês fechado é sobre o mês inteiro", () => {
    const txs = [tx({ category: "Transporte", amount: 300 })];
    expect(buildHabitMap(txs, 8, 2026, outubro)["Transporte"].dailyCost).toBe(10);
  });
});

describe("quanto da categoria são parcelas de antes", () => {
  const impacto = (over: Partial<InstallmentImpact>): InstallmentImpact => ({
    category: "Tecnologia",
    monthlyAmount: 250,
    totalRemaining: 1000,
    monthsRemaining: 4,
    impactPct: 0,
    items: [],
    ...over,
  });

  it("é a fatia do mês da categoria que já estava comprometida", () => {
    const [enriquecido] = enrichInstallmentImpacts(
      { Tecnologia: impacto({}) },
      [{ name: "Tecnologia", amount: 1000, percentage: 20, txCount: 3, avgPerTx: 333 }],
    );
    expect(enriquecido.impactPct).toBe(25);
  });

  it("categoria sem gasto neste mês não vira divisão por zero", () => {
    const [enriquecido] = enrichInstallmentImpacts({ Tecnologia: impacto({}) }, []);
    expect(enriquecido.impactPct).toBe(0);
  });
});
