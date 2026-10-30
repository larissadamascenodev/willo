import { describe, expect, it } from "vitest";
import { parseLocal } from "./parseLocal";

const categories = ["Transporte", "Supermercado", "Restaurante", "Cafeteria", "Farmácia", "Freelance", "Salário", "Energia", "Água", "Delivery"];
const opts = { today: "2026-10-30", categories };

describe("parseLocal", () => {
  it("reads a name and an amount", () => {
    expect(parseLocal("uber 18", opts)).toEqual([
      { name: "Uber", type: "despesa", amount: 18, category: "Transporte", date: "2026-10-30", paymentMethod: null, settled: null },
    ]);
  });

  it("reads the card and cents", () => {
    const [e] = parseLocal("mercado 90,50 no crédito", opts)!;
    expect(e).toMatchObject({ name: "Mercado", amount: 90.5, category: "Supermercado", paymentMethod: "cartao" });
  });

  it("reads income", () => {
    const [e] = parseLocal("recebi 200 de freela", opts)!;
    expect(e).toMatchObject({ name: "Freela", type: "receita", amount: 200, category: "Freelance", paymentMethod: null });
  });

  it("reads several things and a past day", () => {
    const out = parseLocal("café 12 e farmácia 40 ontem", opts)!;
    expect(out.map((e) => [e.name, e.amount, e.category, e.date])).toEqual([
      ["Café", 12, "Cafeteria", "2026-10-29"],
      ["Farmácia", 40, "Farmácia", "2026-10-29"],
    ]);
  });

  it("uses the person's own history first", () => {
    const [e] = parseLocal("larissa 64", { ...opts, history: { Larissa: "Freelance" } })!;
    expect(e.category).toBe("Freelance");
  });

  it("leaves the category open when nothing says it", () => {
    const [e] = parseLocal("gastei 20 na loja", opts)!;
    expect(e.category).toBeNull();
  });

  it("hands anything unclear to the AI reader", () => {
    expect(parseLocal("quanto gastei com uber?", opts)).toBeNull();
    expect(parseLocal("tênis 300 em 3x", opts)).toBeNull();
    expect(parseLocal("2 pizzas 80", opts)).toBeNull();
    expect(parseLocal("netflix 40 todo mês", opts)).toBeNull();
    expect(parseLocal("mercado", opts)).toBeNull();
  });

  it("reads thousands", () => {
    expect(parseLocal("recebi 1.500 de salário", opts)![0]).toMatchObject({ amount: 1500, category: "Salário" });
    expect(parseLocal("recebi 2k de salário", opts)![0]).toMatchObject({ amount: 2000 });
  });
});
