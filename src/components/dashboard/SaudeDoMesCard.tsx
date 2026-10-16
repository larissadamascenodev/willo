import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { getCurrency } from "@/lib/currency";
import { useHiddenValues } from "@/hooks/useHiddenValues";
import { chipInk } from "@/lib/chipColor";
import { cn } from "@/lib/utils";
import type { CategoryExpense } from "@/types/finance";

/**
 * How the month is going, in the only terms that can still change it.
 *
 * A score out of a thousand is a verdict on what already happened. What is still
 * yours to decide is the rest of the month: how many days are left, how much is left
 * for them, and therefore how much a day can hold. The share of income already spent
 * sits under it as the line that says whether that number is comfortable or tight.
 */

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });

interface Props {
  receitas: number;
  despesas: number;
  saldoPrevisto: number;
  categories: CategoryExpense[];
  isCurrentMonth: boolean;
  compact?: boolean;
}

function useReading({ receitas, despesas, saldoPrevisto, categories, isCurrentMonth }: Props) {
  return useMemo(() => {
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    /* A month already over has no days left to spread anything across; a month not
       yet begun has all of them. */
    const daysLeft = isCurrentMonth ? Math.max(daysInMonth - now.getDate() + 1, 1) : daysInMonth;

    const spentShare = receitas > 0 ? Math.min(despesas / receitas, 1.5) : despesas > 0 ? 1.5 : 0;
    const perDay = saldoPrevisto > 0 ? saldoPrevisto / daysLeft : 0;
    const villain = [...categories].sort((a, b) => b.amount - a.amount)[0] ?? null;

    const tone =
      spentShare >= 1 ? { hex: "#F87171", label: "No vermelho" }
        : spentShare >= 0.85 ? { hex: "#FBBF24", label: "Apertado" }
          : spentShare >= 0.6 ? { hex: "#7DD3FC", label: "No caminho" }
            : { hex: "#C8F36D", label: "Folgado" };

    return { daysLeft, spentShare, perDay, villain, tone };
  }, [receitas, despesas, saldoPrevisto, categories, isCurrentMonth]);
}

export default function SaudeDoMesCard(props: Props) {
  const navigate = useNavigate();
  const hidden = useHiddenValues();
  const { daysLeft, spentShare, perDay, villain, tone } = useReading(props);
  const value = (v: number) => (hidden ? "••••" : fmt(v));

  if (props.compact) {
    return (
      <button
        onClick={() => navigate("/bot-finance")}
        className="relative flex min-h-[150px] w-full flex-col justify-between overflow-hidden rounded-[22px] border border-white/[0.08] willo-glass p-4 text-left transition-transform active:scale-[0.98]"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-[14px] font-medium t-soft">Saúde do mês</p>
          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-white/25" />
        </div>
        <div>
          <p className="truncate text-[23px] font-extrabold leading-tight tracking-[-0.035em] text-white tabular-nums">
            {value(perDay)}
          </p>
          <p className="mt-1 line-clamp-2 text-[12px] leading-snug t-softer">
            por dia nos {daysLeft} dias que faltam
          </p>
        </div>
        <span
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px]"
          style={{ background: chipInk(tone.hex), opacity: 0.7 }}
        />
      </button>
    );
  }

  return (
    <button
      onClick={() => navigate("/bot-finance")}
      className="relative block w-full overflow-hidden rounded-[22px] border border-white/[0.08] willo-glass px-4 pb-4 pt-3.5 text-left transition-transform active:scale-[0.99]"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[14px] text-white/66">Saúde do mês</p>
        <span className="flex items-center gap-2">
          <span
            className="rounded-full px-2.5 py-1 text-[11px] font-bold"
            style={{ background: `${tone.hex}1F`, color: tone.hex }}
          >
            {tone.label}
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 t-faint" />
        </span>
      </div>

      <p className="mt-1 truncate text-[30px] font-extrabold leading-none tracking-[-0.03em] text-white tabular-nums">
        {value(perDay)}
      </p>
      <p className="mt-2 truncate text-[13px] t-soft">
        por dia nos {daysLeft} {daysLeft === 1 ? "dia que falta" : "dias que faltam"}
      </p>

      {/* How much of what came in has already gone. */}
      <div className="mt-3.5 h-[7px] overflow-hidden rounded-full bg-white/[0.07]">
        <motion.span
          className="block h-full rounded-full"
          style={{ background: tone.hex, boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.25)" }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(spentShare, 1) * 100}%` }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        />
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-3">
        <span className="truncate text-[12px] t-softer">
          <span className="font-semibold tabular-nums text-white/80">
            {Math.round(spentShare * 100)}%
          </span>{" "}
          do que entrou já saiu
        </span>
        {villain && (
          <span className="shrink-0 truncate text-[12px] t-softer">
            maior gasto: <span className="font-semibold text-white/80">{villain.name}</span>
          </span>
        )}
      </div>

      <div className="mt-3.5 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-3">
        <span className="text-[12.5px] t-soft">Sobra prevista no fim do mês</span>
        <span className={cn(
          "shrink-0 text-[15px] font-bold tabular-nums",
          props.saldoPrevisto < 0 ? "text-red-400" : "text-white",
        )}>
          {value(props.saldoPrevisto)}
        </span>
      </div>
    </button>
  );
}
