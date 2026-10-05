import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { currencySymbol } from "@/lib/currency";

interface Props {
  receitas: number;
  despesas: number;
  saldoPrevisto: number;
  nextMonthBalance: number;
  /** Month the figures belong to (0-11), so the card can name it and the one after. */
  month: number;
}

const compact = (v: number) =>
  `${v < 0 ? "−" : ""}${currencySymbol()} ${Math.abs(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;

/**
 * The month in a sentence. Every other card plots something; with R$ 1.592 out of
 * R$ 1.700 any chart here draws two near-identical lengths and says nothing. The fact
 * itself is short enough to simply write down.
 *
 * nextMonthBalance comes from the historical average, so a caller that loads without
 * history has no figure to give — the footer stays off rather than printing a zero
 * as if it were a forecast.
 */
const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const FinanceOverviewCard = ({ receitas, despesas, saldoPrevisto, nextMonthBalance, month }: Props) => {
  const navigate = useNavigate();
  const monthLabel = MONTHS[month];
  const nextLabel = MONTHS[(month + 1) % 12];
  const balanco = receitas - despesas;
  const delta = nextMonthBalance - saldoPrevisto;
  const trendUp = delta >= 0;
  const pct = receitas > 0 ? Math.round((despesas / receitas) * 100) : 0;

  const line =
    receitas <= 0 && despesas <= 0 ? (
      <>Nada entrou nem saiu em {monthLabel} ainda.</>
    ) : receitas <= 0 ? (
      <>Saíram <b>{compact(despesas)}</b> em {monthLabel}, sem nenhuma entrada.</>
    ) : balanco < 0 ? (
      <>Você gastou <b>{compact(Math.abs(balanco))} a mais</b> do que entrou em {monthLabel}.</>
    ) : (
      <>Você gastou <b>{pct}%</b> do que entrou em {monthLabel}.</>
    );

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={() => navigate("/bot-finance/balanco")}
      className="flex w-full flex-col rounded-[22px] border border-white/[0.08] willo-glass px-[14px] pb-[14px] pt-3.5 text-left"
    >
      {/* No label above the sentence: it already says what the card is about. */}
      <div className="flex items-start justify-between gap-3">
        <p className="text-[21px] font-medium leading-[1.3] tracking-[-0.02em] text-white/80 [text-wrap:balance] [&>b]:font-extrabold [&>b]:text-white">
          {line}
        </p>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-white/35" />
      </div>

      {/* The month's income still counts what has not landed yet, so this figure is
          where the month is heading, not what is in hand. */}
      <div className="mt-5 flex items-baseline justify-between gap-3">
        <p
          className={cn(
            "truncate text-[34px] font-extrabold leading-none tracking-[-0.035em] tabular-nums",
            balanco < 0 ? "text-red-400" : "text-willo-green",
          )}
        >
          {balanco > 0 ? "+" : ""}{compact(balanco)}
        </p>
        <p className="shrink-0 text-right text-[11.5px] leading-[1.35] text-white/45">
          previsto entre<br />receitas e despesas
        </p>
      </div>

      {nextMonthBalance !== 0 && (
        <div
          role="button"
          onClick={(e) => {
            e.stopPropagation();
            navigate("/bot-finance/projecoes");
          }}
          className="mt-4 flex items-center justify-between gap-2 border-t border-white/[0.07] pt-3"
        >
          <span className="truncate text-[12.5px] text-white/55">Em {nextLabel}</span>
          <span className={cn("flex shrink-0 items-center gap-1.5 text-[13px] font-semibold tabular-nums", trendUp ? "text-willo-green" : "text-red-400")}>
            <TrendingUp className={cn("h-3.5 w-3.5", !trendUp && "rotate-180")} strokeWidth={2.4} />
            {compact(nextMonthBalance)}
          </span>
        </div>
      )}
    </motion.button>
  );
};

export default FinanceOverviewCard;
