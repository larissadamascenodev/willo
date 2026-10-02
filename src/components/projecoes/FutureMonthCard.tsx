import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Equal, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MonthComposition } from "@/lib/monthComposition";
import { MONTH_NAMES, riskOf, useMoney } from "./shared";

export interface ProjectionRow {
  month: number;
  year: number;
  income: number;
  expense: number;
  delta: number;
  balance: number;
  prevBalance: number;
  risk: string;
  /** Nothing is launched for this month yet, so the figures are the recent average. */
  estimated: boolean;
  short: string;
  yearTag: string;
}

interface Props {
  row: ProjectionRow;
  composition?: MonthComposition;
  /** Month data is still on its way. */
  loading: boolean;
  expanded: boolean;
  onToggle: () => void;
}

const visible = (v: number) => Math.abs(v) >= 0.5;

function Line({ label, hint, value, tone }: { label: string; hint?: string; value: number; tone?: string }) {
  const { fmt } = useMoney();
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="min-w-0">
        <span className="block text-[13.5px] text-white/80">{label}</span>
        {hint && <span className="block text-[11.5px] text-white/50">{hint}</span>}
      </span>
      <span className={cn("shrink-0 text-[14px] font-medium tabular-nums", tone ?? "text-white")}>{fmt(value)}</span>
    </div>
  );
}

/** One of the months ahead: the headline up front, what it is made of when opened. */
export default function FutureMonthCard({ row, composition, loading, expanded, onToggle }: Props) {
  const { fmt } = useMoney();
  const risk = riskOf(row.risk);
  const title = `${MONTH_NAMES[row.month]}${row.yearTag ? ` ${row.year}` : ""}`;

  if (loading) {
    return <div id={`proj-${row.year}-${row.month}`} className="h-[84px] animate-pulse rounded-[22px] border border-white/[0.08] willo-glass" />;
  }

  const e = composition?.expense;
  const i = composition?.income;

  return (
    <div id={`proj-${row.year}-${row.month}`} className="scroll-mt-24 rounded-[22px] border border-white/[0.12] willo-glass">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 p-4 text-left active:opacity-80"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[16px] font-semibold text-white">{title}</span>
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
              style={{ background: `${risk.hex}1F`, color: risk.hex }}
            >
              {row.balance < 0 ? "Negativo" : risk.label}
            </span>
            {row.estimated && (
              <span className="shrink-0 rounded-full bg-white/[0.08] px-2 py-0.5 text-[10.5px] font-semibold text-white/66">Estimado</span>
            )}
          </span>
          <span className="mt-1 block truncate text-[12.5px] text-white/58 tabular-nums">
            Entra {fmt(row.income)} · Sai {fmt(row.expense)}
          </span>
        </span>

        <span className="shrink-0 text-right">
          <span className="block text-[11px] text-white/50">{row.delta < 0 ? "Falta" : "Sobra"}</span>
          <span className={cn("block text-[17px] font-bold tabular-nums", row.delta < 0 ? "text-red-400" : "text-willo-green")}>
            {fmt(Math.abs(row.delta))}
          </span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-white/45 transition-transform", expanded && "rotate-180")} />
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/[0.08] px-4 pb-4 pt-3">
              {row.estimated || !composition ? (
                <p className="flex items-start gap-2 rounded-[14px] bg-white/[0.05] px-3 py-2.5 text-[12.5px] leading-snug text-white/72">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Ainda não há lançamentos neste mês. Os valores são a média dos seus últimos 3 meses e passam a ser os reais conforme você lança contas fixas e parcelas.
                </p>
              ) : (
                <>
                  <p className="text-[11.5px] font-semibold uppercase tracking-wider text-white/50">Entradas previstas</p>
                  <div className="mt-1">
                    {i && visible(i.fixas) && <Line label="Receitas fixas" value={i.fixas} tone="text-willo-green" />}
                    {i && visible(i.outras) && <Line label="Outras entradas" value={i.outras} tone="text-willo-green" />}
                    {i && !visible(i.fixas) && !visible(i.outras) && <Line label="Nenhuma entrada lançada" value={0} />}
                  </div>

                  <p className="mt-3 text-[11.5px] font-semibold uppercase tracking-wider text-white/50">Saídas previstas</p>
                  <div className="mt-1">
                    {e && visible(e.fixas) && <Line label="Contas fixas" hint="Aluguel, assinaturas, mensalidades" value={e.fixas} tone="text-red-400" />}
                    {e && visible(e.parcelas) && <Line label="Parcelas" hint="Compras parceladas fora do cartão" value={e.parcelas} tone="text-red-400" />}
                    {e && visible(e.cartao) && (
                      <Line
                        label="Faturas de cartão"
                        hint={visible(e.cartaoParcelas) ? `Inclui ${fmt(e.cartaoParcelas)} em parcelas` : undefined}
                        value={e.cartao}
                        tone="text-red-400"
                      />
                    )}
                    {e && visible(e.outras) && <Line label="Outros lançamentos" value={e.outras} tone="text-red-400" />}
                  </div>
                </>
              )}

              <div className="mt-3 flex items-center gap-2.5 rounded-[16px] bg-white/[0.05] px-3 py-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[#0B0B0B]">
                  <Equal className="h-3 w-3" strokeWidth={3} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold text-white">Saldo no fim do mês</span>
                  <span className="block text-[11.5px] text-white/50">Parte de {fmt(row.prevBalance)} do mês anterior</span>
                </span>
                <span className={cn("shrink-0 text-[17px] font-bold tabular-nums", row.balance < 0 ? "text-red-400" : "text-white")}>
                  {fmt(row.balance)}
                </span>
              </div>

              {!row.estimated && composition && (
                <p className="mt-3 flex items-start gap-2 text-[12px] leading-snug text-white/50">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Conta o que já está lançado. Gastos do dia a dia que você ainda não registrou não entram.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
