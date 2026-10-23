import { describe, expect, it } from "vitest";
import {
  horaTrabalho,
  horasDe,
  mensalNecessario,
  passaDoFuturo,
  percentualDaRenda,
  plano503020,
  prazoRealista,
  reservaEmergencia,
  sobra,
} from "./onboardingMath";

/*
 * As contas que o onboarding mostra.
 *
 * Tudo aqui é em centavos inteiros, de propósito: o caso que importa é o da dívida de
 * R$ 12.000 em 6 meses, em que meio centavo de erro por mês vira um mês a mais no
 * prazo — e o prazo é a única coisa que a pessoa leva da tela.
 */

const reais = (v: number) => Math.round(v * 100);

describe("o que sobra do mês", () => {
  it("renda de 1.700 com 900 de gastos deixa 800", () => {
    expect(sobra(reais(1700), reais(900))).toBe(reais(800));
  });

  it("gastar mais do que entra dá sobra negativa, não zero", () => {
    expect(sobra(reais(2000), reais(2300))).toBe(reais(-300));
  });
});

describe("quanto vale uma hora do seu trabalho", () => {
  it("1.700 por mês dá cerca de R$ 7,73 a hora", () => {
    expect(horaTrabalho(reais(1700)) / 100).toBeCloseTo(7.73, 2);
  });

  it("um delivery de R$ 45 custa quase 6 horas de trabalho", () => {
    expect(horasDe(reais(45), reais(1700))).toBeCloseTo(5.8, 1);
  });

  it("um tênis de R$ 300 custa quase 39 horas", () => {
    expect(horasDe(reais(300), reais(1700))).toBeCloseTo(38.8, 1);
  });

  it("sem renda informada não divide por zero", () => {
    expect(horasDe(reais(45), 0)).toBe(0);
  });
});

describe("quanto a meta custa por mês", () => {
  it("5.000 em 10 meses são 500 por mês", () => {
    expect(mensalNecessario(reais(5000), 10)).toBe(reais(500));
  });

  it("12.000 em 6 meses são 2.000 por mês", () => {
    expect(mensalNecessario(reais(12000), 6)).toBe(reais(2000));
  });

  it("arredonda para cima, para o último mês não ficar faltando", () => {
    expect(mensalNecessario(reais(1000), 3)).toBe(33334);
  });
});

describe("o prazo que cabe no que sobra", () => {
  it("2.000 por mês não cabe em 800 de sobra: o caminho real é de 15 meses", () => {
    const valor = reais(12000);
    expect(mensalNecessario(valor, 6)).toBeGreaterThan(reais(800));
    expect(prazoRealista(valor, reais(800))).toBe(15);
  });

  it("500 por mês cabe em 800 de sobra, e o prazo pedido continua de pé", () => {
    const valor = reais(5000);
    expect(mensalNecessario(valor, 10)).toBeLessThanOrEqual(reais(800));
    expect(prazoRealista(valor, reais(800))).toBeLessThanOrEqual(10);
  });

  it("sem sobra não há prazo honesto a dar", () => {
    expect(prazoRealista(reais(5000), 0)).toBeNull();
    expect(prazoRealista(reais(5000), reais(-200))).toBeNull();
  });
});

describe("a reserva de emergência", () => {
  it("com renda estável, de 3 a 6 meses de gastos", () => {
    const r = reservaEmergencia(reais(900), "clt");
    expect(r.minima).toBe(reais(2700));
    expect(r.ideal).toBe(reais(5400));
    expect([r.mesesMinimo, r.mesesIdeal]).toEqual([3, 6]);
  });

  it("quem vive de renda que pode parar guarda de 6 a 12", () => {
    const r = reservaEmergencia(reais(900), "autonomo");
    expect(r.minima).toBe(reais(5400));
    expect(r.ideal).toBe(reais(10800));
    expect([r.mesesMinimo, r.mesesIdeal]).toEqual([6, 12]);
  });

  it("empresária conta como renda que pode parar", () => {
    expect(reservaEmergencia(reais(1000), "empresario").mesesMinimo).toBe(6);
  });

  it("aposentada conta como renda estável", () => {
    expect(reservaEmergencia(reais(1000), "aposentado").mesesMinimo).toBe(3);
  });
});

describe("a divisão 50/30/20 em reais", () => {
  it("1.700 viram 850, 510 e 340", () => {
    expect(plano503020(reais(1700))).toEqual({
      necessidades: reais(850),
      desejos: reais(510),
      futuro: reais(340),
    });
  });

  it("as três partes somam exatamente a renda, sem perder centavo", () => {
    for (const renda of [reais(1700), reais(3333.33), reais(1), 7]) {
      const p = plano503020(renda);
      expect(p.necessidades + p.desejos + p.futuro).toBe(renda);
    }
  });
});

describe("quando a meta pesa demais no mês", () => {
  it("500 por mês em uma renda de 1.700 passa dos 20% do futuro", () => {
    expect(passaDoFuturo(reais(500), reais(1700))).toBe(true);
    expect(percentualDaRenda(reais(500), reais(1700))).toBe(29);
  });

  it("300 por mês cabe dentro do futuro", () => {
    expect(passaDoFuturo(reais(300), reais(1700))).toBe(false);
  });
});
