import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, CalendarDays, ChevronRight, Info, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFinancialProjection } from "@/hooks/useFinancialProjection";
import { PageHeader, SectionTitle } from "@/components/shared/MobilePage";
import MonthBalanceCard from "@/components/projecoes/MonthBalanceCard";
import FutureMonthCard, { type ProjectionRow } from "@/components/projecoes/FutureMonthCard";
import BalanceTrendChart from "@/components/projecoes/BalanceTrendChart";
import { MONTH_NAMES, MONTH_SHORT, useMoney } from "@/components/projecoes/shared";

const keyOf = (r: { month: number; year: number }) => `${r.month}-${r.year}`;

/**
 * One screen for the money ahead: the month we are in, as a balance, and the months that
 * follow it with what is already fixed, instalments and card statements. It always starts
 * from today — there is no month picker to move it.
 */
export default function Projecoes() {
  const navigate = useNavigate();
  const { compact } = useMoney();
  const today = new Date();
  const { projections, data, loading, monthDataMap, futureReady } = useFinancialProjection({
    month: today.getMonth(),
    year: today.getFullYear(),
  });
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows: ProjectionRow[] = useMemo(
    () =>
      projections.map((p, i) => ({
        month: p.month,
        year: p.year,
        income: p.income,
        expense: p.expense,
        delta: p.delta,
        balance: p.balance,
        prevBalance: i > 0 ? projections[i - 1].balance : data.previousMonthEndingBalance,
        risk: p.risk,
        estimated: !!p.estimated,
        short: MONTH_SHORT[p.month],
        yearTag: p.year !== today.getFullYear() ? String(p.year).slice(2) : "",
      })),
    // today only changes the year tag, which can only flip with the projections themselves
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projections, data.previousMonthEndingBalance],
  );

  const ahead = rows.slice(1);

  const pickMonth = useCallback((i: number) => {
    const target = rows[i];
    if (!target) return;
    const id = i === 0 ? "proj-mes-atual" : `proj-${target.year}-${target.month}`;
    setExpanded(i === 0 ? null : keyOf(target));
    // wait for the card to open so the scroll lands on its final position
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [rows]);

  if (loading) {
    return (
      <div className="mx-auto max-w-lg pb-28">
        <PageHeader title="Projeções" subtitle="Este mês e os próximos" />
        <div className="mt-6 space-y-3">
          <div className="h-72 animate-pulse rounded-[28px] willo-glass" />
          <div className="h-44 animate-pulse rounded-[22px] willo-glass" />
        </div>
      </div>
    );
  }

  if ((!data.transactions.length && !data.events.length) || rows.length === 0) {
    return (
      <div className="mx-auto max-w-lg pb-28">
        <PageHeader title="Projeções" subtitle="Este mês e os próximos" />
        <div className="mt-10 flex flex-col items-center px-8 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.05]">
            <CalendarDays className="h-8 w-8 text-white/56" />
          </span>
          <p className="mt-5 text-[18px] font-bold text-white">Ainda sem dados suficientes</p>
          <p className="mt-1 text-[14px] text-white/62">Adicione transações para ver suas projeções.</p>
          <button onClick={() => navigate("/transacoes")} className="mt-5 h-11 rounded-full bg-white px-6 text-[14px] font-semibold text-[#0B0B0B]">
            Ver transações
          </button>
        </div>
      </div>
    );
  }

  const last = rows[rows.length - 1];
  const growth = last.balance - data.saldoAtual;
  const firstNegative = rows.find((r) => r.balance < 0);
  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.balance)), 1);
  const selectedIdx = expanded ? rows.findIndex((r) => keyOf(r) === expanded) : null;

  const headline = firstNegative
    ? `Seu saldo fica negativo a partir de ${MONTH_NAMES[firstNegative.month].toLowerCase()}. Dá tempo de mudar isso.`
    : growth >= 0
      ? `Mantendo o ritmo, você termina com ${compact(last.balance)} em ${MONTH_NAMES[last.month].toLowerCase()}.`
      : `Mantendo o ritmo, seu saldo encolhe ${compact(Math.abs(growth))} até ${MONTH_NAMES[last.month].toLowerCase()}.`;

  return (
    <div className="mx-auto max-w-lg pb-28">
      <PageHeader title="Projeções" subtitle="Este mês e os próximos" />

      <div id="proj-mes-atual" className="scroll-mt-24">
        <MonthBalanceCard data={data} month={today.getMonth()} year={today.getFullYear()} />
      </div>

      <SectionTitle>Para onde seu saldo vai</SectionTitle>
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[28px] border border-white/[0.12] p-5"
        style={{
          background: `radial-gradient(120% 90% at 100% 0%, ${growth >= 0 && !firstNegative ? "#C8F36D1C" : "#F8717120"} 0%, rgba(20,20,20,0.96) 55%, #0E0E0E 100%)`,
        }}
      >
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] text-white/62">Hoje</p>
            <p className="truncate text-[20px] font-bold text-white tabular-nums">{compact(data.saldoAtual)}</p>
          </div>
          <ArrowRight className="mb-1.5 h-5 w-5 shrink-0 text-white/45" />
          <div className="min-w-0 text-right">
            <p className="truncate text-[12px] text-white/62">
              {MONTH_NAMES[last.month]}{last.yearTag ? `/${last.yearTag}` : ""}
            </p>
            <p className={cn("truncate text-[30px] font-extrabold leading-tight tracking-tight tabular-nums", last.balance < 0 ? "text-red-400" : "text-white")}>
              {compact(last.balance)}
            </p>
          </div>
        </div>

        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/[0.08] px-3 py-1.5">
          {growth >= 0 ? <TrendingUp className="h-3.5 w-3.5 text-willo-green" /> : <TrendingDown className="h-3.5 w-3.5 text-red-400" />}
          <span className={cn("text-[13px] font-semibold tabular-nums", growth >= 0 ? "text-willo-green" : "text-red-400")}>
            {growth >= 0 ? "+" : "−"}{compact(Math.abs(growth))}
          </span>
          <span className="text-[12px] text-white/66">até {MONTH_SHORT[last.month]}</span>
        </div>

        <p className="mt-3 rounded-[16px] bg-black/25 px-3.5 py-2.5 text-[13px] leading-snug text-white/85">{headline}</p>
      </motion.section>

      <div className="mt-3">
        <BalanceTrendChart rows={rows} selectedIdx={selectedIdx} onSelect={pickMonth} maxAbs={maxAbs} />
      </div>

      <SectionTitle>Próximos meses</SectionTitle>
      <div className="space-y-2.5">
        {ahead.map((row) => {
          const key = keyOf(row);
          return (
            <FutureMonthCard
              key={key}
              row={row}
              composition={monthDataMap.get(key)?.composition}
              loading={!futureReady && !monthDataMap.has(key)}
              expanded={expanded === key}
              onToggle={() => setExpanded((cur) => (cur === key ? null : key))}
            />
          );
        })}
      </div>

      <button
        onClick={() => navigate("/fluxo-de-caixa")}
        className="mt-6 flex w-full items-center justify-between rounded-[22px] border border-white/[0.12] willo-glass px-4 py-4 text-left active:opacity-80"
      >
        <span>
          <span className="block text-[15px] font-semibold text-white">Fluxo de caixa</span>
          <span className="block text-[12.5px] text-white/58">O que já entrou e saiu, dia a dia</span>
        </span>
        <ChevronRight className="h-5 w-5 text-white/45" />
      </button>

      <p className="mt-5 flex items-start gap-2 px-1 text-[12px] leading-snug text-white/50">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        A projeção usa suas contas fixas, parcelas e faturas já lançadas. Meses sem lançamentos usam a média dos últimos 3 meses. Novos lançamentos ajustam o cálculo na hora.
      </p>
    </div>
  );
}
