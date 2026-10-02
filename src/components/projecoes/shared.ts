import { useMemo } from "react";
import { useHiddenValues } from "@/hooks/useHiddenValues";
import { currencySymbol, getCurrency } from "@/lib/currency";

export const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
export const MONTH_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const formatFull = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });
const formatCompact = (v: number) =>
  `${v < 0 ? "−" : ""}${currencySymbol()} ${Math.abs(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;

/** Money formatters that follow the eye in the home header: hidden values stay hidden here too. */
export function useMoney() {
  const hidden = useHiddenValues();
  return useMemo(
    () => ({
      hidden,
      fmt: (v: number) => (hidden ? `${currencySymbol()} ••••` : formatFull(v)),
      compact: (v: number) => (hidden ? `${currencySymbol()} ••` : formatCompact(v)),
    }),
    [hidden],
  );
}

export const GREEN = "#C8F36D";
export const RED = "#F87171";

export const RISK = {
  positivo: { label: "Tranquilo", hex: "#C8F36D" },
  atencao: { label: "Atenção", hex: "#FCD34D" },
  risco: { label: "Risco", hex: "#F87171" },
} as const;

export const riskOf = (r: string) => RISK[r as keyof typeof RISK] ?? RISK.risco;
