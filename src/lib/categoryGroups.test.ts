import { describe, expect, it } from "vitest";
import { CATEGORY_GROUP_DEFS, groupCategoryAmounts } from "./categoryGroups";

/*
 * O nível em que um mês tem forma.
 *
 * A tabela de grupos é a mesma no navegador e no celular — por isso ela mora aqui, e
 * por isso o que importa testar é que nada escorregue para fora dela: uma categoria
 * que ninguém previu precisa continuar contando no total.
 */

const cat = (name: string, amount: number) => ({ name, amount });

describe("em que grupo cada categoria cai", () => {
  it("cada categoria conhecida vai para o seu grupo", () => {
    const grupos = groupCategoryAmounts([cat("Supermercado", 400), cat("Combustível", 100)]);
    expect(grupos.map((g) => g.def.name)).toEqual(["Alimentação", "Transporte"]);
  });

  it("as categorias de um mesmo grupo somam juntas", () => {
    const [alimentacao] = groupCategoryAmounts([cat("Supermercado", 300), cat("Delivery", 200)]);
    expect(alimentacao.def.name).toBe("Alimentação");
    expect(alimentacao.amount).toBe(500);
    expect(alimentacao.categories).toHaveLength(2);
  });

  it("o que não se encaixa em nenhum vai para Outros, em vez de sumir do total", () => {
    const grupos = groupCategoryAmounts([cat("Alimentação", 700), cat("Coisa inventada", 300)]);
    const outros = grupos.find((g) => g.def.name === "Outros");
    expect(outros?.amount).toBe(300);
    expect(grupos.reduce((s, g) => s + g.amount, 0)).toBe(1000);
  });

  it("o nome da categoria casa sem depender de maiúsculas", () => {
    const [grupo] = groupCategoryAmounts([cat("supermercado", 100)]);
    expect(grupo.def.name).toBe("Alimentação");
  });

  it("vêm do maior para o menor, com a fatia de cada um", () => {
    const grupos = groupCategoryAmounts([cat("Transporte", 250), cat("Alimentação", 750)]);
    expect(grupos.map((g) => [g.def.name, g.percentage])).toEqual([
      ["Alimentação", 75],
      ["Transporte", 25],
    ]);
  });

  it("um mês sem gasto nenhum não divide por zero", () => {
    expect(groupCategoryAmounts([])).toEqual([]);
    const [grupo] = groupCategoryAmounts([cat("Alimentação", 0)]);
    expect(grupo.percentage).toBe(0);
  });
});

describe("a tabela em si", () => {
  it("nenhuma categoria está em dois grupos ao mesmo tempo", () => {
    const vistas = new Set<string>();
    for (const grupo of CATEGORY_GROUP_DEFS) {
      for (const categoria of grupo.categories) {
        const chave = categoria.toLowerCase();
        expect(vistas.has(chave), `${categoria} aparece em mais de um grupo`).toBe(false);
        vistas.add(chave);
      }
    }
  });
});
