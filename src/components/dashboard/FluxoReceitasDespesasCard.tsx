import { memo } from "react";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getCurrency } from "@/lib/currency";
import { useHiddenValues } from "@/hooks/useHiddenValues";
import { cn } from "@/lib/utils";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });

/**
 * The month as the two flows that make it. Both bars share one scale, so their
 * lengths answer the only question that matters here — which side is bigger —
 * before the figures are read, and the balance below is just their difference.
 */
const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const FluxoReceitasDespesasCard = memo(({ receitas, despesas, month, isCurrentMonth = true }: {
  receitas: number;
  despesas: number;
  /** 0–11, so the verdict line can name the month. */
  month: number;
  isCurrentMonth?: boolean;
}) => {
  const navigate = useNavigate();
  const hidden = useHiddenValues();
  const balanco = receitas - despesas;
  const monthLabel = MONTHS[month];
  const pct = receitas > 0 ? Math.round((despesas / receitas) * 100) : 0;

  // The verdict the bars cannot draw: two near-equal lengths look fine until you are
  // told they are 94%.
  const verdict =
    receitas <= 0 && despesas <= 0 ? `Nada entrou nem saiu em ${monthLabel} ainda.`
    : receitas <= 0 ? `Saiu dinheiro em ${monthLabel} sem nenhuma entrada.`
    : balanco < 0 ? `Você gastou mais do que entrou em ${monthLabel}.`
    : `Você gastou ${pct}% do que entrou em ${monthLabel}.`;
  const scale = Math.max(receitas, despesas, 1);
  const value = (v: number) => (hidden ? "••••" : fmt(v));

  const Flow = ({ label, amount, tone, sign, to, delay }: {
    label: string;
    amount: number;
    tone: string;
    sign: string;
    to: string;
    delay: number;
  }) => (
    <button type="button" onClick={() => navigate(to)} className="block w-full text-left active:opacity-70">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[14px] font-medium text-white">{label}</span>
        <span className={cn("shrink-0 text-[14.5px] font-semibold tabular-nums", tone === "receita" ? "text-white" : "text-red-400")}>
          {sign}{value(amount)}
        </span>
      </div>
      <div className="mt-2 h-[6px] overflow-hidden rounded-full bg-white/[0.06]">
        <motion.span
          className={cn("block h-full rounded-full", tone === "receita" ? "bg-willo-green" : "bg-red-400")}
          initial={{ width: 0 }}
          animate={{ width: `${Math.max((amount / scale) * 100, amount > 0 ? 3 : 0)}%` }}
          transition={{ duration: 0.6, delay, ease: "easeOut" }}
        />
      </div>
    </button>
  );

  return (
    <div className="rounded-[22px] border border-white/[0.08] willo-glass px-4 pb-4 pt-3.5">
      <button
        onClick={() => navigate("/fluxo-de-caixa")}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <p className="truncate text-[14px] text-white/66">
          Receitas e despesas <span className="text-white/35">·</span> {isCurrentMonth ? "este mês" : "no mês"}
        </p>
        <ChevronRight className="h-4 w-4 shrink-0 text-white/35" />
      </button>

      <p className="mt-2 text-[13px] leading-snug text-white/55">{verdict}</p>

      <div className="mt-3.5 space-y-3.5">
        <Flow label="Entrada" amount={receitas} tone="receita" sign="" to="/detalhe/receitas" delay={0.05} />
        <Flow label="Saída" amount={despesas} tone="despesa" sign="−" to="/detalhe/despesas" delay={0.12} />
      </div>

      <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-white/[0.09] pt-3.5">
        <span className="text-[14px] font-medium text-white">Fluxo de caixa</span>
        <span className={cn(
          "shrink-0 text-[17px] font-extrabold tracking-[-0.02em] tabular-nums",
          balanco < 0 ? "text-red-400" : "text-white",
        )}>
          {balanco > 0 ? "+" : ""}{value(balanco)}
        </span>
      </div>
    </div>
  );
});

FluxoReceitasDespesasCard.displayName = "FluxoReceitasDespesasCard";
export default FluxoReceitasDespesasCard;
