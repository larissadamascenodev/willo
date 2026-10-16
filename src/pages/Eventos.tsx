import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CalendarClock, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import BackButton from "@/components/shared/BackButton";
import { useFinanceData } from "@/hooks/useFinanceData";
import { getCategoryIcon, getCategoryHexColor } from "@/lib/categoryUtils";
import { chipFill, chipInk } from "@/lib/chipColor";
import { getCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { FinanceEvent } from "@/types/finance";

/**
 * What is coming, on a calendar and in order.
 *
 * The home screen can only show the next two or three; the question underneath them —
 * "is the money there when they land" — needs the whole month at once. So the month is
 * drawn as a month, each day marked with what falls on it, and under it the same days
 * written out, because a dot tells you something is there and a line tells you what.
 */

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });

const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];
const DAY_NAMES = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const isIncome = (e: FinanceEvent) => e.type === "receita" || e.status === "recebido";
const dayOf = (e: FinanceEvent) => Number((e.rawDate ?? "").slice(8, 10)) || 0;

export default function Eventos() {
  const navigate = useNavigate();
  const today = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [picked, setPicked] = useState<number | null>(null);

  const { data, loading } = useFinanceData(month, year);

  const events = useMemo(
    () => [...data.events].sort((a, b) => dayOf(a) - dayOf(b)),
    [data.events],
  );

  const pending = events.filter((e) => e.status !== "pago" && e.status !== "recebido");
  const aReceber = pending.filter(isIncome).reduce((s, e) => s + e.amount, 0);
  const aPagar = pending.filter((e) => !isIncome(e)).reduce((s, e) => s + e.amount, 0);

  /** Every day of the month, with what lands on it. */
  const grid = useMemo(() => {
    const first = new Date(year, month, 1);
    const days = new Date(year, month + 1, 0).getDate();
    const lead = first.getDay();
    const byDay = new Map<number, FinanceEvent[]>();
    for (const e of events) {
      const d = dayOf(e);
      if (!d) continue;
      byDay.set(d, [...(byDay.get(d) ?? []), e]);
    }
    return {
      lead,
      days,
      byDay,
      cells: Array.from({ length: days }, (_, i) => i + 1),
    };
  }, [events, month, year]);

  const shown = picked ? events.filter((e) => dayOf(e) === picked) : events;

  const groups = useMemo(() => {
    const map = new Map<number, FinanceEvent[]>();
    for (const e of shown) {
      const d = dayOf(e);
      map.set(d, [...(map.get(d) ?? []), e]);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [shown]);

  const step = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setMonth(d.getMonth());
    setYear(d.getFullYear());
    setPicked(null);
  };

  const isThisMonth = month === today.getMonth() && year === today.getFullYear();

  return (
    <div className="mx-auto max-w-lg pb-10 pt-4">
      <div className="flex h-11 items-center">
        <BackButton to="/" />
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 px-1">
        <h1 className="text-[28px] font-extrabold tracking-[-0.03em] text-white">Próximos eventos</h1>
        <div className="flex shrink-0 items-center gap-1 rounded-full border border-white/[0.08] willo-glass p-1">
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="Mês anterior"
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 active:bg-white/[0.06]"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="Próximo mês"
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 active:bg-white/[0.06]"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* What the month still owes and still brings. */}
      <div className="mt-5 grid grid-cols-2 gap-4 px-1">
        <div>
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.12em] t-softer">A receber</p>
          <p className="mt-1 truncate text-[24px] font-extrabold leading-none tracking-[-0.03em] text-willo-green-ink tabular-nums">
            {fmt(aReceber)}
          </p>
        </div>
        <div>
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.12em] t-softer">A pagar</p>
          <p className="mt-1 truncate text-[24px] font-extrabold leading-none tracking-[-0.03em] text-red-400 tabular-nums">
            {fmt(aPagar)}
          </p>
        </div>
      </div>
      <p className="mt-2.5 px-1 text-[12.5px] t-soft">
        {MONTHS[month]} de {year}
        <span className="text-white/20"> · </span>
        {pending.length === 0
          ? "nada pendente"
          : `${pending.length} ${pending.length === 1 ? "pendência" : "pendências"}`}
        {aReceber - aPagar !== 0 && (
          <>
            <span className="text-white/20"> · </span>
            saldo {aReceber - aPagar > 0 ? "+" : "−"}
            <span className="tabular-nums">{fmt(Math.abs(aReceber - aPagar))}</span>
          </>
        )}
      </p>

      {/* ══ The month as a month ══ */}
      <div className="mt-5 rounded-[24px] border border-white/[0.08] willo-glass p-4">
        <div className="mb-2 grid grid-cols-7 gap-1">
          {WEEKDAYS.map((d, i) => (
            <span key={i} className="text-center text-[10.5px] font-semibold uppercase t-faint">{d}</span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: grid.lead }, (_, i) => <span key={`lead${i}`} />)}
          {grid.cells.map((d) => {
            const list = grid.byDay.get(d) ?? [];
            const isToday = isThisMonth && d === today.getDate();
            const selected = picked === d;
            const hasIn = list.some(isIncome);
            const hasOut = list.some((e) => !isIncome(e));
            return (
              <button
                key={d}
                type="button"
                onClick={() => setPicked(selected ? null : list.length ? d : null)}
                className={cn(
                  "flex h-10 flex-col items-center justify-center gap-1 rounded-[12px] transition-colors",
                  selected ? "bg-white text-[#0B0B0B]" : list.length ? "bg-white/[0.05] text-white" : "text-white/35",
                  isToday && !selected && "ring-1 ring-white/40",
                )}
              >
                <span className="text-[12.5px] font-semibold tabular-nums leading-none">{d}</span>
                <span className="flex h-1.5 items-center gap-[3px]">
                  {hasIn && <span className={cn("h-1.5 w-1.5 rounded-full", selected ? "bg-[#0B0B0B]" : "bg-willo-green")} />}
                  {hasOut && <span className={cn("h-1.5 w-1.5 rounded-full", selected ? "bg-[#0B0B0B]/60" : "bg-red-400")} />}
                </span>
              </button>
            );
          })}
        </div>

        {picked && (
          <button
            type="button"
            onClick={() => setPicked(null)}
            className="mt-3 w-full rounded-full border border-white/[0.08] py-2 text-[12.5px] font-semibold text-white/75 active:opacity-70"
          >
            Ver o mês inteiro
          </button>
        )}
      </div>

      {/* ══ The same days, written out ══ */}
      <div className="mt-5 space-y-5">
        {loading && events.length === 0 ? (
          <div className="h-40 animate-pulse rounded-[22px] border border-white/[0.08] willo-glass" />
        ) : groups.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-white/[0.09] px-4 py-10 text-center">
            <CalendarClock className="mx-auto mb-2 h-6 w-6 t-faint" />
            <p className="text-[13.5px] t-soft">Nada marcado para {MONTHS[month]}</p>
          </div>
        ) : (
          groups.map(([day, list]) => {
            const date = new Date(year, month, day);
            const isToday = isThisMonth && day === today.getDate();
            const net = list.reduce((s, e) => s + (isIncome(e) ? e.amount : -e.amount), 0);
            return (
              <div key={day}>
                <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
                  <span className={cn(
                    "truncate text-[10.5px] font-semibold uppercase tracking-[0.14em]",
                    isToday ? "text-white" : "t-softer",
                  )}>
                    {isToday ? "Hoje · " : ""}{DAY_NAMES[date.getDay()]}, {day} de {MONTHS[month].slice(0, 3)}
                  </span>
                  <span className={cn(
                    "shrink-0 text-[12px] font-semibold tabular-nums",
                    net >= 0 ? "text-willo-green-ink" : "t-softer",
                  )}>
                    {net >= 0 ? "+" : "−"}{fmt(Math.abs(net))}
                  </span>
                </div>

                <div className="divide-y divide-white/[0.055]">
                  {list.map((e, i) => {
                    const income = isIncome(e);
                    const paid = e.status === "pago" || e.status === "recebido";
                    const hex = getCategoryHexColor(e.category);
                    const Icon = getCategoryIcon(e.category);
                    return (
                      <motion.button
                        key={e.id}
                        type="button"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        onClick={() => navigate("/transacoes")}
                        className="flex w-full items-center gap-3.5 px-1 py-3.5 text-left transition-opacity active:opacity-60"
                      >
                        <span
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                          style={{ background: chipFill(hex) }}
                        >
                          <Icon className="h-[18px] w-[18px]" style={{ color: chipInk(hex) }} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-medium text-white">{e.name}</span>
                          <span className="flex items-center gap-1.5 truncate text-[12px] t-softer">
                            {!paid && <Clock className="h-3 w-3 shrink-0 text-willo-amber" />}
                            {paid ? (income ? "Recebido" : "Pago") : income ? "A receber" : "Pendente"}
                            <span className="text-white/20">·</span>
                            {e.category}
                          </span>
                        </span>
                        <span className={cn(
                          "shrink-0 text-[15px] font-semibold tabular-nums",
                          income ? "text-willo-green-ink" : "text-white",
                        )}>
                          {income ? "+" : "−"}{fmt(e.amount)}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
