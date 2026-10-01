import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, ChevronRight, Scale, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { currencySymbol } from "@/lib/currency";

interface Props {
  receitas: number;
  despesas: number;
  saldoPrevisto: number;
  nextMonthBalance: number;
}

const compact = (v: number) =>
  `${v < 0 ? "−" : ""}${currencySymbol()} ${Math.abs(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;

/**
 * One card for the month's balance (in vs out) plus where it's headed next —
 * opens the merged Financeiro tool (Realizado / Este mês / Futuro).
 */
const FinanceOverviewCard = ({ receitas, despesas, saldoPrevisto, nextMonthBalance }: Props) => {
  const navigate = useNavigate();
  const balanco = receitas - despesas;
  const base = Math.max(receitas, despesas, 1);
  const delta = nextMonthBalance - saldoPrevisto;
  const trendUp = delta >= 0;

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={() => navigate("/bot-finance/balanco")}
      className="flex w-full flex-col rounded-[22px] border border-white/[0.12] willo-glass p-4 text-left"
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#60A5FA]/15">
            <Scale className="h-[18px] w-[18px] text-[#60A5FA]" />
          </span>
          <span className="text-[13px] font-medium text-white/60">Financeiro</span>
        </span>
        <ChevronRight className="h-4 w-4 text-white/25" />
      </div>

      <p className={cn("mt-3 truncate text-[26px] font-extrabold leading-tight tracking-tight tabular-nums", balanco < 0 ? "text-red-400" : "text-willo-green")}>
        {balanco > 0 ? "+" : ""}{compact(balanco)}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-3">
        {[
          { label: "Receitas", value: receitas, hex: "#C8F36D", Icon: ArrowDownLeft },
          { label: "Despesas", value: despesas, hex: "#F87171", Icon: ArrowUpRight },
        ].map(({ label, value, hex, Icon }, i) => (
          <div key={label}>
            <div className="flex items-center justify-between gap-1">
              <span className="flex items-center gap-1 text-[11px] text-white/45">
                <Icon className="h-3 w-3" style={{ color: hex }} strokeWidth={2.5} /> {label}
              </span>
              <span className="truncate text-[12px] font-semibold text-white tabular-nums">{compact(value)}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <motion.div
                className="h-full rounded-full"
                style={{ background: hex }}
                initial={{ width: 0 }}
                animate={{ width: `${(value / base) * 100}%` }}
                transition={{ delay: 0.1 + i * 0.1, duration: 0.6, ease: "easeOut" }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Where the balance is heading — its own tap target, into the Futuro tab */}
      <div
        role="button"
        onClick={(e) => {
          e.stopPropagation();
          navigate("/bot-finance/projecoes");
        }}
        className="mt-3.5 flex items-center justify-between gap-2 rounded-[16px] bg-white/[0.05] px-3 py-2.5"
      >
        <span className="flex min-w-0 items-center gap-1.5 truncate text-[12px] text-white/55">
          <TrendingUp className="h-3.5 w-3.5 shrink-0 text-[#C084FC]" /> Fim do mês{" "}
          <span className="truncate font-semibold text-white">{compact(saldoPrevisto)}</span>
        </span>
        <span className={cn("shrink-0 text-[11.5px] font-semibold tabular-nums", trendUp ? "text-willo-green" : "text-red-400")}>
          {trendUp ? "▲" : "▼"} {compact(Math.abs(delta))}
        </span>
      </div>
    </motion.button>
  );
};

export default FinanceOverviewCard;
