import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useFormattedCounter } from "@/hooks/useAnimatedCounter";
import { useHiddenValues } from "@/hooks/useHiddenValues";
import MonthSelector from "./MonthSelector";
import { currencySymbol } from "@/lib/currency";

interface Props {
  receitas: number;
  despesas: number;
  selectedMonth: number;
  selectedYear: number;
  onMonthChange: (month: number, year: number) => void;
}

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/**
 * What came in and what went out, side by side with equal weight. Each half opens
 * its own list. The balance between them is the headline of the Financeiro card,
 * so it is not repeated here.
 */
const MonthFiguresCard = ({ receitas, despesas, selectedMonth, selectedYear, onMonthChange }: Props) => {
  const navigate = useNavigate();
  const hidden = useHiddenValues();
  const animatedReceitas = useFormattedCounter(receitas);
  const animatedDespesas = useFormattedCounter(despesas);

  const mask = (v: string) => (hidden ? `${currencySymbol()} ••••` : v);

  const sides = [
    {
      key: "receitas",
      label: "Receitas",
      value: mask(animatedReceitas),
      to: "/detalhe/receitas",
      Icon: ArrowDownLeft,
      iconCls: "text-willo-green",
    },
    {
      key: "despesas",
      label: "Despesas",
      value: mask(animatedDespesas),
      to: "/detalhe/despesas",
      Icon: ArrowUpRight,
      iconCls: "text-red-400",
    },
  ];

  return (
    <div className="rounded-[26px] border border-white/[0.12] willo-glass px-[18px] pb-[18px] pt-4">
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <span className="text-[12.5px] text-white/50">{MONTH_NAMES[selectedMonth]}</span>
        <MonthSelector selectedMonth={selectedMonth} selectedYear={selectedYear} onMonthChange={onMonthChange} />
      </div>

      <div className="flex items-stretch">
        {sides.map(({ key, label, value, to, Icon, iconCls }, i) => (
          <button
            key={key}
            onClick={() => navigate(to)}
            className={`min-w-0 flex-1 text-left active:opacity-70 ${
              i === 0 ? "pr-4" : "border-l border-white/[0.10] pl-4"
            }`}
          >
            <span className="flex items-center gap-1.5 text-[12.5px] text-white/55">
              <Icon className={`h-3.5 w-3.5 ${iconCls}`} strokeWidth={2.6} />
              {label}
            </span>
            <span className="mt-1.5 block truncate text-[21px] font-extrabold leading-none tracking-tight text-white tabular-nums">
              {value}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default MonthFiguresCard;
