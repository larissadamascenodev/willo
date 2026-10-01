import { useRef, useState } from "react";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useFormattedCounter } from "@/hooks/useAnimatedCounter";
import { useHiddenValues } from "@/hooks/useHiddenValues";
import MonthSelector from "./MonthSelector";
import { currencySymbol, getCurrency } from "@/lib/currency";

interface Props {
  saldoAtual: number;
  changeAmount: number;
  changePercent: number;
  receitas: number;
  despesas: number;
  selectedMonth: number;
  selectedYear: number;
  onMonthChange: (month: number, year: number) => void;
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });
}

const MONTH_NAMES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/**
 * The month in four figures, one per page: what you have, what came in, what went
 * out, and what is left. Sits in the card stack rather than in the header, so the
 * top of the home screen stays the greeting.
 */
const MonthFiguresCard = ({
  saldoAtual, changeAmount, changePercent, receitas, despesas,
  selectedMonth, selectedYear, onMonthChange,
}: Props) => {
  const navigate = useNavigate();
  const hidden = useHiddenValues();
  const trackRef = useRef<HTMLDivElement>(null);
  const [slide, setSlide] = useState(0);

  const animatedSaldo = useFormattedCounter(saldoAtual);
  const animatedReceitas = useFormattedCounter(receitas);
  const animatedDespesas = useFormattedCounter(despesas);
  const isPositive = changeAmount >= 0;
  const balanco = receitas - despesas;
  const monthLabel = MONTH_NAMES[selectedMonth];

  const mask = (v: string) => (hidden ? `${currencySymbol()} ••••` : v);

  const slides: { key: string; label: string; value: string; foot: JSX.Element; to: string | null }[] = [
    {
      key: "saldo",
      label: "Saldo disponível",
      value: hidden ? `${currencySymbol()} ••••••` : animatedSaldo,
      foot: (
        <span className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-white/60 tabular-nums">
            {hidden ? "••••" : `${isPositive ? "+" : "-"}${formatCurrency(Math.abs(changeAmount))}`}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
              isPositive ? "bg-willo-green/20 text-willo-green" : "bg-red-500/20 text-red-400"
            }`}
          >
            {isPositive ? "+" : "-"}{Math.abs(changePercent).toFixed(2)}%
          </span>
        </span>
      ),
      to: null,
    },
    {
      key: "receitas",
      label: "Receitas",
      value: mask(animatedReceitas),
      foot: (
        <span className="flex items-center gap-1.5 text-[13px] text-white/50">
          <ArrowDownLeft className="h-3.5 w-3.5 text-willo-green" strokeWidth={2.5} />
          o que entrou em {monthLabel}
        </span>
      ),
      to: "/detalhe/receitas",
    },
    {
      key: "despesas",
      label: "Despesas",
      value: mask(animatedDespesas),
      foot: (
        <span className="flex items-center gap-1.5 text-[13px] text-white/50">
          <ArrowUpRight className="h-3.5 w-3.5 text-red-400" strokeWidth={2.5} />
          o que saiu em {monthLabel}
        </span>
      ),
      to: "/detalhe/despesas",
    },
    {
      key: "balanco",
      label: "Balanço do mês",
      value: hidden
        ? `${currencySymbol()} ••••`
        : `${balanco >= 0 ? "+" : "-"}${formatCurrency(Math.abs(balanco))}`,
      foot: (
        <span className="text-[13px] text-white/50">
          {balanco >= 0 ? "sobrou" : "faltou"} em {monthLabel}
        </span>
      ),
      to: null,
    },
  ];

  const onTrackScroll = () => {
    const el = trackRef.current;
    if (!el || !el.clientWidth) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    setSlide(Math.max(0, Math.min(slides.length - 1, i)));
  };

  const goToSlide = (i: number) => {
    const el = trackRef.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="relative overflow-hidden rounded-[26px] border border-white/[0.12] willo-glass">
      <div className="absolute right-4 top-4 z-10">
        <MonthSelector selectedMonth={selectedMonth} selectedYear={selectedYear} onMonthChange={onMonthChange} />
      </div>

      <div
        ref={trackRef}
        onScroll={onTrackScroll}
        className="flex snap-x snap-mandatory overflow-x-auto scrollbar-none"
      >
        {slides.map((s) => (
          <div
            key={s.key}
            onClick={() => s.to && navigate(s.to)}
            className={`w-full shrink-0 snap-center px-5 pb-4 pt-5 ${s.to ? "cursor-pointer active:opacity-70" : ""}`}
          >
            <span className="block text-[12.5px] text-white/50">{s.label}</span>
            <p className="mt-2 truncate text-[34px] font-extrabold leading-none tracking-tight text-white tabular-nums">
              {s.value}
            </p>
            <div className="mt-2.5">{s.foot}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-1.5 pb-3.5">
        {slides.map((s, i) => (
          <button
            key={s.key}
            onClick={() => goToSlide(i)}
            aria-label={s.label}
            className={`h-1.5 rounded-full transition-all ${
              i === slide ? "w-5 bg-white/85" : "w-1.5 bg-white/25"
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default MonthFiguresCard;
