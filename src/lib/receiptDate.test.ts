import { describe, expect, it } from "vitest";
import { resolveReceiptDate } from "./receiptDate";

/*
 * O caso que motivou isto: três estornos lidos como 2024 foram para uma fatura de
 * novembro de 2024. Não abateram valor, não devolveram limite e não apareceram em
 * tela nenhuma — pareciam lançamentos normais.
 */

const hoje = new Date("2026-10-15T12:00:00");

describe("a data de um comprovante", () => {
  it("um ano errado dois anos atrás vira o mais recente que cabe", () => {
    expect(resolveReceiptDate("2024-10-09", hoje)).toBe("2026-10-09");
  });

  it("e se esse dia ainda não chegou neste ano, usa o ano passado", () => {
    expect(resolveReceiptDate("2024-12-20", hoje)).toBe("2025-12-20");
  });

  it("uma data recente é mantida como o papel imprimiu", () => {
    expect(resolveReceiptDate("2026-09-06", hoje)).toBe("2026-09-06");
  });

  it("treze meses ainda é papel velho de verdade, não erro de leitura", () => {
    expect(resolveReceiptDate("2025-09-30", hoje)).toBe("2025-09-30");
  });

  it("uma data no futuro não tem o que salvar: vira hoje", () => {
    expect(resolveReceiptDate("2027-01-01", hoje)).toBe("2026-10-15");
  });

  it("sem data, hoje", () => {
    expect(resolveReceiptDate(null, hoje)).toBe("2026-10-15");
    expect(resolveReceiptDate("", hoje)).toBe("2026-10-15");
  });

  it("lixo não derruba o lançamento", () => {
    expect(resolveReceiptDate("quarta-feira", hoje)).toBe("2026-10-15");
  });

  it("o dia e o mês do papel são preservados ao corrigir o ano", () => {
    expect(resolveReceiptDate("2023-02-28", hoje)).toBe("2026-02-28");
  });
});
