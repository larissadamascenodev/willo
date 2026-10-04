import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle, ArrowDownLeft, ArrowRight, ArrowUpRight, CalendarDays,
  ChevronRight, Equal, Eye, EyeOff, Info, Minus, Plus, TrendingDown, TrendingUp, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getCategoryIcon, getCategoryHexColor } from "@/lib/categoryUtils";
import { useCashFlow, periodStart, sumFlow, toDateKey, type CashFlowEntry, type CashFlowPeriod } from "@/hooks/useCashFlow";
import { useFinancialProjection } from "@/hooks/useFinancialProjection";
import type { MonthProjection } from "@/services/projection/types";
import { PageHeader, SectionTitle, Surface } from "@/components/shared/MobilePage";
import { currencySymbol, getCurrency } from "@/lib/currency";

type Tool = "fluxo" | "balanco" | "projecoes";

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const MONTH_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const CASHFLOW_SHORT = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });
const compact = (v: number) => `${v < 0 ? "−" : ""}${currencySymbol()} ${Math.abs(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;

const TOOLS: { key: Tool; label: string; subtitle: string }[] = [
  { key: "fluxo", label: "Fluxo de caixa", subtitle: "O que entrou e saiu, dia a dia" },
  { key: "balanco", label: "Balanço", subtitle: "Como o mês está fechando" },
  { key: "projecoes", label: "Projeções", subtitle: "Para onde seu saldo está indo" },
];

/**
 * Three views, one per question: what moved (fluxo), where the month lands
 * (balanço), and where the months after it land (projeções).
 */
export default function Financeiro({ initialTab = "fluxo" }: { initialTab?: Tool }) {
  const [tool, setTool] = useState<Tool>(initialTab);
  const active = TOOLS.find((t) => t.key === tool)!;

  return (
    <div className="mx-auto max-w-lg pb-28">
      <PageHeader title="Financeiro" subtitle={active.subtitle} />

      <div className="mt-5 flex isolate rounded-full border border-white/[0.08] willo-glass p-1">
        {TOOLS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTool(t.key)}
            className={cn(
              "relative min-w-0 flex-1 rounded-full px-1 py-2 text-[12.5px] font-semibold tracking-tight transition-colors",
              tool === t.key ? "text-[#0B0B0B]" : "text-white/70",
            )}
          >
            {tool === t.key && (
              <motion.span
                layoutId="financeiro-tool"
                className="pointer-events-none absolute inset-0 z-0 rounded-full bg-white"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative block truncate">{t.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tool} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          {tool === "fluxo" && <RealizadoPanel />}
          {tool === "balanco" && <BalancoMensalSection onOpenProjecoes={() => setTool("projecoes")} />}
          {tool === "projecoes" && <FuturoPanel />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════ Realizado — o que já aconteceu ═══════════════════ */

interface Bucket {
  key: string;
  label: string;
  entradas: number;
  saidas: number;
  isCurrent: boolean;
}

function buildBuckets(entries: CashFlowEntry[], period: CashFlowPeriod): Bucket[] {
  const now = new Date();
  if (period === "mes") {
    const days = now.getDate();
    return Array.from({ length: days }, (_, i) => {
      const key = toDateKey(new Date(now.getFullYear(), now.getMonth(), i + 1));
      const dayEntries = entries.filter((e) => e.date === key);
      const { entradas, saidas } = sumFlow(dayEntries);
      return { key, label: String(i + 1).padStart(2, "0"), entradas, saidas, isCurrent: i + 1 === days };
    });
  }
  const months = period === "3m" ? 3 : period === "6m" ? 6 : 12;
  return Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1) + i, 1);
    const prefix = toDateKey(d).slice(0, 7);
    const { entradas, saidas } = sumFlow(entries.filter((e) => e.date.startsWith(prefix)));
    return { key: prefix, label: CASHFLOW_SHORT[d.getMonth()], entradas, saidas, isCurrent: i === months - 1 };
  });
}

const PERIODS: { key: CashFlowPeriod; label: string }[] = [
  { key: "mes", label: "Este mês" },
  { key: "3m", label: "3m" },
  { key: "6m", label: "6m" },
  { key: "1a", label: "1a" },
];

const GREEN = "linear-gradient(180deg, #D9FF72 0%, #A8E63A 100%)";
const RED = "linear-gradient(180deg, #FF8080 0%, #EF4444 100%)";

const EmptyDot = () => <span className="block h-6 w-6 rounded-full border border-dashed border-white/25" />;

function CashFlowChart({
  buckets, subTab, period, onSelectKind,
}: {
  buckets: Bucket[];
  subTab: "geral" | "entradas" | "saidas";
  period: CashFlowPeriod;
  onSelectKind: (kind: "entradas" | "saidas") => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const HEIGHT = 200;
  const max = Math.max(
    ...buckets.map((b) => (subTab === "entradas" ? b.entradas : subTab === "saidas" ? b.saidas : Math.max(b.entradas, b.saidas))),
    1,
  );
  const scrollable = period === "mes" || period === "1a";
  const single = subTab !== "geral";

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [buckets, subTab, period]);

  const bar = (value: number, bg: string, width: number, delay: number, kind: "entradas" | "saidas") =>
    value > 0 ? (
      <motion.button
        type="button"
        onClick={(e) => { e.stopPropagation(); onSelectKind(kind); }}
        aria-label={kind === "entradas" ? "Ver só entradas" : "Ver só saídas"}
        className="block rounded-full"
        style={{ width, background: bg }}
        initial={{ height: 0 }}
        animate={{ height: Math.max((value / max) * HEIGHT, width) }}
        transition={{ delay, duration: 0.5, ease: "easeOut" }}
      />
    ) : period === "mes" ? (
      <EmptyDot />
    ) : (
      <span className="block h-[2px] rounded-full" style={{ width, background: bg, opacity: 0.6 }} />
    );

  return (
    <div ref={scrollRef} className={cn("-mx-4 px-4", scrollable ? "overflow-x-auto scrollbar-hide" : "overflow-hidden")}>
      <div
        className={cn("flex items-end", scrollable ? "gap-3" : "justify-center gap-6")}
        style={{ minWidth: scrollable ? buckets.length * (single ? 58 : 64) : undefined }}
      >
        {buckets.map((b, i) => (
          <div key={b.key} className="flex flex-col items-center" style={{ width: single ? 52 : 58 }}>
            <div className="flex items-end justify-center gap-1.5" style={{ height: HEIGHT }}>
              {subTab !== "saidas" && bar(b.entradas, GREEN, single ? 44 : 20, i * 0.02, "entradas")}
              {subTab !== "entradas" && bar(b.saidas, RED, single ? 44 : 20, i * 0.02 + 0.03, "saidas")}
            </div>
            <span className={cn("mt-3 text-[13px] tabular-nums", b.isCurrent ? "font-semibold text-white" : "text-white/62")}>{b.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CashFlowEntryRow({ entry, hidden }: { entry: CashFlowEntry; hidden: boolean }) {
  const Icon = getCategoryIcon(entry.category);
  const hex = getCategoryHexColor(entry.category);
  const date = new Date(`${entry.date}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
  const isIn = entry.kind === "entrada";

  return (
    <div className="flex items-center gap-3.5 py-3">
      <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#1C1C1C]">
        <Icon className="h-5 w-5" style={{ color: hex }} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[16px] font-semibold text-white">{entry.name}</p>
        <p className="truncate text-[13px] text-white/62">
          {date} · {entry.category}
          {entry.accountName ? ` · ${entry.accountName}` : ""}
        </p>
      </div>
      <p className={cn("shrink-0 text-[15px] font-semibold tabular-nums", isIn ? "text-willo-green" : "text-[#F87171]")}>
        {hidden ? `${currencySymbol()} ••••` : `${isIn ? "+" : "-"}${fmt(entry.amount)}`}
      </p>
    </div>
  );
}

function cashFlowTitle(subTab: "geral" | "entradas" | "saidas", period: CashFlowPeriod) {
  const subject = subTab === "geral" ? "Fluxo geral" : subTab === "entradas" ? "Entradas" : "Saídas";
  if (period === "mes") return `${subject} em ${MONTH_NAMES[new Date().getMonth()]}`;
  if (period === "1a") return `${subject} no último ano`;
  return `${subject} nos últimos ${period === "3m" ? 3 : 6} meses`;
}

function RealizadoPanel() {
  const navigate = useNavigate();
  const { entries, loading } = useCashFlow();
  const [subTab, setSubTab] = useState<"geral" | "entradas" | "saidas">("geral");
  const [period, setPeriod] = useState<CashFlowPeriod>("mes");
  const [hidden, setHidden] = useState(false);

  const inPeriod = useMemo(() => {
    const from = toDateKey(periodStart(period));
    return entries.filter((e) => e.date >= from);
  }, [entries, period]);

  const totals = useMemo(() => sumFlow(inPeriod), [inPeriod]);
  const buckets = useMemo(() => buildBuckets(inPeriod, period), [inPeriod, period]);
  const latest = useMemo(
    () => inPeriod.filter((e) => subTab === "geral" || (subTab === "entradas" ? e.kind === "entrada" : e.kind === "saida")).slice(0, 6),
    [inPeriod, subTab],
  );

  const headline = subTab === "geral" ? totals.net : subTab === "entradas" ? totals.entradas : totals.saidas;
  const headlineText = hidden ? `${currencySymbol()} ••••` : `${subTab === "geral" && headline < 0 ? "-" : ""}${fmt(Math.abs(headline))}`;

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-2">
          {([["geral", "Geral"], ["entradas", "Entradas"], ["saidas", "Saídas"]] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSubTab(key)}
              className={cn(
                "h-9 rounded-full border px-3.5 text-[13.5px] font-medium transition-colors",
                subTab === key ? "border-white bg-white text-[#0B0B0B]" : "border-white/[0.1] text-white/74",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setHidden((v) => !v)}
          aria-label={hidden ? "Mostrar valores" : "Ocultar valores"}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-white/74 active:opacity-60"
        >
          {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      <div className="mt-5">
        <p className="text-[14px] text-white/66">{cashFlowTitle(subTab, period)}</p>
        <p className="mt-0.5 truncate text-[34px] font-extrabold leading-tight tracking-tight tabular-nums text-white">
          {loading ? "…" : headlineText}
        </p>
        {subTab === "geral" && (
          <div className="mt-2 space-y-1">
            <p className="flex items-center gap-2 text-[14px] text-white/74 tabular-nums">
              <span className="h-2.5 w-2.5 rounded-full bg-[#C8F36D]" /> Entradas {hidden ? `${currencySymbol()} ••••` : fmt(totals.entradas)}
            </p>
            <p className="flex items-center gap-2 text-[14px] text-white/74 tabular-nums">
              <span className="h-2.5 w-2.5 rounded-full bg-[#EF4444]" /> Saídas {hidden ? `${currencySymbol()} ••••` : fmt(totals.saidas)}
            </p>
          </div>
        )}
        <p className="mt-3 text-[12px] leading-snug text-white/56">
          Considera só o dinheiro que entrou e saiu das contas. Compras no cartão entram quando a fatura é paga.
        </p>
      </div>

      <div className="mt-6">
        <CashFlowChart buckets={buckets} subTab={subTab} period={period} onSelectKind={setSubTab} />
      </div>

      <div className="mt-6 grid grid-cols-4 isolate rounded-full border border-white/[0.08] willo-glass p-1">
        {PERIODS.map((p) => (
          <button key={p.key} onClick={() => setPeriod(p.key)} className="relative h-10 rounded-full text-[13.5px] font-semibold">
            {period === p.key && (
              <motion.span layoutId="cashflow-period" className="pointer-events-none absolute inset-0 z-0 rounded-full bg-white" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
            )}
            <span className={cn("relative z-10 transform-gpu transform-gpu", period === p.key ? "text-[#0B0B0B]" : "text-white")}>{p.label}</span>
          </button>
        ))}
      </div>

      <SectionTitle>
        {subTab === "geral" ? "Últimos lançamentos" : subTab === "entradas" ? "Últimas entradas" : "Últimas saídas"}
      </SectionTitle>
      {latest.length === 0 ? (
        <p className="py-8 text-center text-[14px] text-white/56">Nada por aqui neste período</p>
      ) : (
        <div>
          {latest.map((e) => (
            <CashFlowEntryRow key={e.id} entry={e} hidden={hidden} />
          ))}
        </div>
      )}
      <button
        onClick={() => navigate("/transacoes")}
        className="mt-4 h-14 w-full rounded-full willo-glass-inset text-[16px] font-medium text-white active:opacity-70"
      >
        Ver todos os lançamentos
      </button>
    </div>
  );
}

/* ═══════════════════ Balanço do mês — o que está previsto fechar ═══════════════════ */

/**
 * The month taken apart. The dashboard card already states the verdict in a sentence,
 * so repeating it here would waste the screen: this one shows how the month is built,
 * how far through it you are, and where the months after it land.
 */
function BalancoMensalSection({ onOpenProjecoes }: { onOpenProjecoes: () => void }) {
  const { projections, data, loading, selectedMonth, selectedYear } = useFinancialProjection();
  const rows = useMemo(
    () => buildRows(projections, data.previousMonthEndingBalance),
    [projections, data.previousMonthEndingBalance],
  );

  if (loading || rows.length === 0) {
    return (
      <div className="mt-6 space-y-3">
        <div className="h-64 animate-pulse rounded-[26px] willo-glass" />
        <div className="h-32 animate-pulse rounded-[22px] willo-glass" />
      </div>
    );
  }

  const [current, ...ahead] = rows;
  const now = new Date();
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const isCurrentMonth = selectedMonth === now.getMonth() && selectedYear === now.getFullYear();
  const isPast = selectedYear < now.getFullYear() || (selectedYear === now.getFullYear() && selectedMonth < now.getMonth());
  const dayOfMonth = isCurrentMonth ? now.getDate() : daysInMonth;
  const daysLeft = daysInMonth - dayOfMonth;
  const spent = current.income > 0 ? Math.min((current.expense / current.income) * 100, 100) : current.expense > 0 ? 100 : 0;
  // The month on its own: what came in less what went out. What last month left over
  // belongs to the running balance, which is what Projeções is for.
  const perDay = daysLeft > 0 ? current.sobra / daysLeft : 0;

  return (
    <div className="mt-5">
      <section className="rounded-[26px] border border-white/[0.08] willo-glass px-5 pb-5 pt-[18px]">
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.13em] text-white/50">
          {isPast ? "Balanço final" : isCurrentMonth ? "Balanço parcial" : "Balanço previsto"} · {current.name}
        </p>

        <p className={cn(
          "mt-3.5 truncate text-[42px] font-extrabold leading-none tracking-[-0.035em] tabular-nums",
          current.sobra < 0 ? "text-red-400" : "text-willo-green",
        )}>
          {current.sobra > 0 ? "+" : ""}{compact(current.sobra)}
        </p>
        <p className="mt-2 text-[12.5px] text-white/50">
          {current.sobra < 0 ? "faltando no mês" : "sobrando no mês"}
          {isCurrentMonth && daysLeft > 0 ? ` · ${compact(perDay)} por dia até o fim` : ""}
        </p>

        <div className="mt-4 h-[5px] overflow-hidden rounded-full bg-willo-green/25">
          <motion.div
            className="h-full rounded-full bg-red-400/80"
            initial={{ width: 0 }}
            animate={{ width: `${spent}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>

        <MonthBreakdown row={current} prevName={MONTH_NAMES[(current.month + 11) % 12]} carry={false} />
      </section>

      {isCurrentMonth && (
        <section className="mt-2.5 rounded-[22px] border border-white/[0.08] willo-glass px-5 pb-4 pt-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11.5px] font-semibold uppercase tracking-[0.13em] text-white/50">Mês em andamento</span>
            <span className="text-[12px] tabular-nums text-white/50">
              {daysLeft} {daysLeft === 1 ? "dia restante" : "dias restantes"}
            </span>
          </div>
          <div className="mt-3 flex gap-[2px]">
            {Array.from({ length: daysInMonth }, (_, d) => (
              <span
                key={d}
                className={cn(
                  "h-[14px] flex-1 rounded-[2px]",
                  d + 1 < dayOfMonth ? "bg-white/45" : d + 1 === dayOfMonth ? "bg-white" : "bg-white/[0.07]",
                )}
              />
            ))}
          </div>
        </section>
      )}

      {ahead.length > 0 && (
        <>
          <div className="mt-6 flex items-baseline justify-between gap-3 px-1">
            <h2 className="text-[15px] font-bold tracking-tight text-white">Balanço dos próximos meses</h2>
            <button onClick={onOpenProjecoes} className="shrink-0 text-[12.5px] font-semibold text-white/55 active:opacity-70">
              Ver tudo
            </button>
          </div>

          {/* A strip rather than a stack: the question here is the direction, and the
              month-by-month arithmetic has its own section. */}
          <div className="mt-3 -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 scrollbar-none">
            {ahead.slice(0, 6).map((r) => {
              const s = r.income > 0 ? Math.min((r.expense / r.income) * 100, 100) : r.expense > 0 ? 100 : 0;
              return (
                <button
                  key={`${r.year}-${r.month}`}
                  onClick={onOpenProjecoes}
                  className="w-[132px] shrink-0 rounded-[18px] border border-white/[0.08] willo-glass px-3.5 pb-3.5 pt-3 text-left active:opacity-80"
                >
                  <span className="flex items-center gap-1.5">
                    <span className={cn(
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      r.sobra < 0 ? "bg-red-400" : "bg-willo-green",
                    )} />
                    <span className="truncate text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white/50">
                      {r.short}{r.yearTag ? `/${r.yearTag}` : ""}
                    </span>
                  </span>
                  <span className={cn(
                    "mt-2.5 block truncate text-[19px] font-extrabold leading-none tracking-[-0.03em] tabular-nums",
                    r.sobra < 0 ? "text-red-400" : "text-white",
                  )}>
                    {r.sobra > 0 ? "+" : ""}{compact(r.sobra)}
                  </span>
                  <span className="mt-3 block h-[4px] overflow-hidden rounded-full bg-willo-green/25">
                    <span className="block h-full rounded-full bg-red-400/80" style={{ width: `${s}%` }} />
                  </span>
                </button>
              );
            })}
          </div>

          <p className="mt-4 flex items-start gap-2 px-1 text-[12px] leading-snug text-white/45">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Cada mês conta só o que entra e sai nele, sem o que sobrou do anterior. Só o que já está previsto entra na conta.
          </p>
        </>
      )}
    </div>
  );
}


/* ═══════════════════ Futuro — pra onde o saldo vai ═══════════════════ */

const RISK = {
  positivo: { label: "Tranquilo", hex: "#C8F36D" },
  atencao: { label: "Atenção", hex: "#FCD34D" },
  risco: { label: "Risco", hex: "#F87171" },
} as const;
const riskOf = (r: string) => RISK[r as keyof typeof RISK] ?? RISK.risco;

/**
 * Every figure rounded once, and the rest derived from those rounded parts — four
 * independently rounded numbers do not add up to the fifth. Each month chains off the
 * close shown for the one before it, so a column of them always sums.
 */
function buildRows(projections: MonthProjection[], previousMonthEndingBalance: number): ProjectionRowView[] {
  return projections.reduce<ProjectionRowView[]>((acc, p, i) => {
    const income = Math.round(p.income);
    const expense = Math.round(p.expense);
    const sobra = income - expense;
    const prevBalance = i > 0 ? acc[i - 1].fecha : Math.round(previousMonthEndingBalance);
    acc.push({
      ...p,
      income,
      expense,
      sobra,
      prevBalance,
      fecha: prevBalance + sobra,
      short: MONTH_SHORT[p.month],
      name: MONTH_NAMES[p.month],
      yearTag: p.year !== new Date().getFullYear() ? String(p.year).slice(2) : "",
    });
    return acc;
  }, []);
}

interface ProjectionRowView {
  month: number;
  year: number;
  risk: "positivo" | "atencao" | "risco";
  income: number;
  expense: number;
  sobra: number;
  prevBalance: number;
  fecha: number;
  short: string;
  name: string;
  yearTag: string;
}

function FuturoPanel() {
  const navigate = useNavigate();
  const { projections, data, loading } = useFinancialProjection();
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [openMonth, setOpenMonth] = useState<ProjectionRowView | null>(null);

  const rows = useMemo(
    () => buildRows(projections, data.previousMonthEndingBalance),
    [projections, data.previousMonthEndingBalance],
  );

  if (loading) {
    return (
      <div className="mt-6 space-y-3">
        <div className="h-40 animate-pulse rounded-[26px] willo-glass" />
        <div className="h-64 animate-pulse rounded-[24px] willo-glass" />
      </div>
    );
  }

  if ((!data.transactions.length && !data.events.length) || rows.length === 0) {
    return (
      <div className="mt-10 flex flex-col items-center px-8 text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.05]">
          <CalendarDays className="h-8 w-8 text-white/56" />
        </span>
        <p className="mt-5 text-[18px] font-bold text-white">Ainda sem dados suficientes</p>
        <p className="mt-1 text-[14px] text-white/62">Adicione transações para ver suas projeções.</p>
        <button onClick={() => navigate("/transacoes")} className="mt-5 h-11 rounded-full bg-white px-6 text-[14px] font-semibold text-[#0B0B0B]">
          Ver transações
        </button>
      </div>
    );
  }

  const [current, ...ahead] = rows;
  const negatives = rows.filter((r) => r.fecha < 0);
  const today = new Date();
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysLeft = lastDay - today.getDate();

  return (
    <div className="mt-5">
      {/* This month, closed out */}
      <section className="rounded-[24px] border border-white/[0.08] willo-glass px-[14px] pb-[14px] pt-4">
        <p className="text-[12px] text-white/50">{current.name} fecha com</p>
        <p className={cn(
          "mt-1.5 truncate text-[40px] font-extrabold leading-none tracking-[-0.035em] tabular-nums",
          current.fecha < 0 ? "text-red-400" : "text-willo-green",
        )}>
          {current.fecha > 0 ? "+" : ""}{compact(current.fecha)}
        </p>
        <p className="mt-2 text-[12.5px] text-white/55">
          previsto · {daysLeft === 0 ? "último dia do mês" : `faltam ${daysLeft} dias`}
        </p>

        <MonthBreakdown row={current} prevName={MONTH_NAMES[(current.month + 11) % 12]} />
      </section>

      {negatives.length > 0 && (
        <div className="mt-3 flex items-center gap-3 rounded-[16px] border border-red-400/20 bg-red-400/[0.07] px-3.5 py-3">
          <AlertTriangle className="h-[18px] w-[18px] shrink-0 text-red-400" strokeWidth={2.2} />
          <p className="min-w-0 text-[13px] leading-snug text-red-200">
            {negatives.length === 1
              ? `Seu saldo fecha negativo em ${negatives[0].name.toLowerCase()}.`
              : `Seu saldo fecha negativo em ${negatives.length} meses.`}{" "}
            <span className="text-red-300/70">Dá tempo de mudar.</span>
          </p>
        </div>
      )}

      <SectionTitle>Como seu saldo evolui</SectionTitle>
      <ProjectionBars rows={rows} selectedIdx={Math.min(selectedIdx, rows.length - 1)} onSelect={setSelectedIdx} />

      <SectionTitle>Mês a mês</SectionTitle>
      <div className="space-y-2.5">
        {ahead.map((r) => {
          // The track is what comes in, the fill what goes out — the same device the
          // balance card uses, so the shape of a month reads the same everywhere.
          const spent = r.income > 0 ? Math.min((r.expense / r.income) * 100, 100) : r.expense > 0 ? 100 : 0;
          return (
            <button
              key={`${r.year}-${r.month}`}
              onClick={() => setOpenMonth(r)}
              className="w-full rounded-[22px] border border-white/[0.08] willo-glass px-5 pb-5 pt-[18px] text-left active:opacity-80"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2">
                  <span className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full",
                    r.fecha < 0 ? "bg-red-400" : r.risk === "atencao" ? "bg-amber-300" : "bg-willo-green",
                  )} />
                  <span className="truncate text-[11.5px] font-semibold uppercase tracking-[0.13em] text-white/50">
                    {r.name}{r.yearTag ? `/${r.yearTag}` : ""}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-white/25" />
              </div>

              <p className={cn(
                "mt-3.5 truncate text-[30px] font-extrabold leading-none tracking-[-0.035em] tabular-nums",
                r.fecha < 0 ? "text-red-400" : "text-white",
              )}>
                {r.fecha > 0 ? "+" : ""}{compact(r.fecha)}
              </p>
              <p className="mt-1.5 text-[12px] text-white/45">fecha o mês com</p>

              <div className="mt-4 h-[5px] overflow-hidden rounded-full bg-willo-green/25">
                <motion.div
                  className="h-full rounded-full bg-red-400/80"
                  initial={{ width: 0 }}
                  animate={{ width: `${spent}%` }}
                  transition={{ duration: 0.55, ease: "easeOut" }}
                />
              </div>

              {/* Colour is spent on the one figure that carries a verdict; the two
                  inputs stay white, or the card reads as three warnings. */}
              <div className="mt-3.5 flex gap-5">
                {[
                  { k: "Entra", v: r.income, cls: "text-white" },
                  { k: "Sai", v: -r.expense, cls: "text-white" },
                  { k: "Sobra", v: r.sobra, cls: r.sobra < 0 ? "text-red-400" : "text-willo-green" },
                ].map(({ k, v, cls }) => (
                  <span key={k} className="min-w-0 flex-1">
                    <span className="block text-[10px] font-semibold uppercase tracking-[0.11em] text-white/35">{k}</span>
                    <span className={cn("mt-1.5 block truncate text-[14.5px] font-bold tabular-nums", cls)}>
                      {v > 0 ? "+" : ""}{compact(v)}
                    </span>
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      <p className="mt-5 flex items-start gap-2 px-1 text-[12px] leading-snug text-white/50">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Conta só o que já está previsto: contas fixas, parcelas lançadas e recorrências.
        Conforme novos gastos entrarem, estes valores se ajustam sozinhos.
      </p>

      <AnimatePresence>
        {openMonth && (
          <div className="fixed inset-0 z-[75] flex items-center justify-center px-5">
            <motion.div
              className="absolute inset-0 bg-black/75 backdrop-blur-[3px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpenMonth(null)}
            />
            <motion.div
              role="dialog"
              aria-modal
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: "spring", stiffness: 340, damping: 26 }}
              /* Sheet glass, not card glass: this sits over a dimmed page, and at a
                 card's 4.6% white it barely separated from the backdrop. */
              className="relative max-h-[86vh] w-full max-w-[340px] overflow-y-auto rounded-[28px] border border-white/[0.10] willo-glass-strong px-6 pb-6 pt-5 shadow-[0_40px_90px_-24px_rgba(0,0,0,0.95)]"
            >
              {/* The title owns its own line so the figure below gets the room */}
              <div className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2">
                  <span className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full",
                    openMonth.fecha < 0 ? "bg-red-400" : openMonth.risk === "atencao" ? "bg-amber-300" : "bg-willo-green",
                  )} />
                  <span className="truncate text-[12px] font-semibold uppercase tracking-[0.12em] text-white/55">
                    {openMonth.name}{openMonth.yearTag ? `/${openMonth.yearTag}` : ""}
                  </span>
                </span>
                <button
                  onClick={() => setOpenMonth(null)}
                  aria-label="Fechar"
                  className="-mr-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-white/70 active:opacity-60"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="mt-5 text-[12.5px] text-white/50">Previsão de fechar com</p>
              <p className={cn(
                "mt-2 truncate text-[40px] font-extrabold leading-none tracking-[-0.035em] tabular-nums",
                openMonth.fecha < 0 ? "text-red-400" : "text-willo-green",
              )}>
                {openMonth.fecha > 0 ? "+" : ""}{compact(openMonth.fecha)}
              </p>

              <MonthBreakdown row={openMonth} prevName={MONTH_NAMES[(openMonth.month + 11) % 12]} />

              <p className="mt-5 flex items-start gap-2 border-t border-white/[0.07] pt-4 text-[12px] leading-snug text-white/45">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Só o que já está previsto entra nessa conta. Novos gastos ajustam o valor.
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * The month as the two sums it actually is: what moved this month gives the leftover,
 * and that plus what was left of last month gives the close. Rules sit where an equals
 * sign would, which is what makes it read as a ledger rather than a list of five rows.
 */
function MonthBreakdown({ row, prevName, carry = true }: {
  row: { income: number; expense: number; sobra: number; prevBalance: number; fecha: number; name: string };
  prevName: string;
  /** Off in Balanço, which reports a month on its own; Projeções chains them. */
  carry?: boolean;
}) {
  const Line = ({ k, v, strong = false, tone = "plain" }: {
    k: string;
    v: number;
    strong?: boolean;
    tone?: "plain" | "result";
  }) => (
    <div className="flex items-baseline justify-between gap-4 py-[9px]">
      <span className={cn("text-[13px]", strong ? "font-semibold text-white" : "text-white/55")}>{k}</span>
      <span
        className={cn(
          "shrink-0 text-right text-[14px] tabular-nums",
          strong ? "font-bold" : "font-semibold",
          tone === "result" ? (v < 0 ? "text-red-400" : "text-willo-green") : "text-white",
        )}
      >
        {v > 0 && tone === "result" ? "+" : ""}{compact(v)}
      </span>
    </div>
  );

  const total = carry ? row.fecha : row.sobra;
  const totalLabel = carry ? `Fecha ${row.name.toLowerCase()} com` : `Balanço de ${row.name.toLowerCase()}`;

  return (
    <div className="mt-5">
      <Line k="Entra" v={row.income} />
      <Line k="Sai" v={-row.expense} />

      {carry && (
        <>
          <div className="border-t border-white/[0.09] pt-0.5">
            <Line k="Sobra do mês" v={row.sobra} strong tone="result" />
          </div>
          <div className="mt-2.5">
            <Line k={`Sobra de ${prevName.toLowerCase()}`} v={row.prevBalance} />
          </div>
        </>
      )}

      <div className="mt-0.5 flex items-baseline justify-between gap-4 border-t border-white/[0.16] pt-3.5">
        <span className="text-[13.5px] font-semibold text-white">{totalLabel}</span>
        <span className={cn(
          "shrink-0 text-[19px] font-extrabold tracking-[-0.02em] tabular-nums",
          total < 0 ? "text-red-400" : "text-willo-green",
        )}>
          {total > 0 ? "+" : ""}{compact(total)}
        </span>
      </div>
    </div>
  );
}

/** The chart the statements use, pointed at months: scrollable bars, the selected one
    lit and the rest dimmed, a dot under the live label. */
function ProjectionBars({ rows, selectedIdx, onSelect }: {
  rows: ProjectionRowView[];
  selectedIdx: number;
  onSelect: (i: number) => void;
}) {
  const max = Math.max(...rows.map((r) => Math.abs(r.fecha)), 1);
  const selected = rows[selectedIdx];

  return (
    <div className="rounded-[22px] border border-white/[0.08] willo-glass p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-white/50">Saldo no fim de cada mês</p>
        {selected && (
          <span className={cn(
            "inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11.5px] font-semibold tabular-nums",
            selected.fecha < 0 ? "bg-red-400/15 text-red-300" : "bg-willo-green/12 text-willo-green",
          )}>
            {selected.short} · {compact(selected.fecha)}
          </span>
        )}
      </div>

      <div className="mt-4 flex select-none items-end gap-2 overflow-x-auto pb-1 scrollbar-none">
        {rows.map((r, i) => {
          const height = Math.max(14, (Math.abs(r.fecha) / max) * 92);
          const isSel = i === selectedIdx;
          return (
            <button
              key={`${r.year}-${r.month}`}
              onClick={() => onSelect(i)}
              className="flex w-[38px] shrink-0 flex-col items-center gap-2"
            >
              <span className="flex h-[92px] w-full items-end">
                <motion.span
                  initial={{ height: 0 }}
                  animate={{ height }}
                  transition={{ duration: 0.45, ease: "easeOut" }}
                  className={cn(
                    "w-full rounded-[8px] transition-all duration-200",
                    r.fecha < 0
                      ? "bg-gradient-to-t from-red-400/55 to-red-400"
                      : r.risk === "atencao"
                        ? "bg-gradient-to-t from-amber-300/55 to-amber-300"
                        : "bg-gradient-to-t from-willo-green/55 to-willo-green",
                    !isSel && "opacity-40",
                  )}
                />
              </span>
              <span className="flex flex-col items-center gap-1">
                <span className={cn("text-[11px] tabular-nums transition-colors", isSel ? "font-bold text-white" : "text-white/50")}>
                  {r.short}
                </span>
                <span className={cn("h-1 w-1 rounded-full transition-colors", isSel ? "bg-white" : "bg-transparent")} />
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-center gap-4 border-t border-white/[0.06] pt-3 text-[11px] text-white/56">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px] bg-willo-green/70" /> Tranquilo</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px] bg-amber-300/70" /> Atenção</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px] bg-red-400/70" /> Negativo</span>
      </div>
    </div>
  );
}

/* ═══════════════════ Balance history chart — same visual language as the invoice chart ═══════════════════ */

interface ProjectionRow {
  month: number;
  year: number;
  balance: number;
  risk: string;
  short: string;
  yearTag: string;
}

function ProjectionHistoryChart({
  rows, selectedIdx, onSelect, maxAbs,
}: {
  rows: ProjectionRow[];
  selectedIdx: number;
  onSelect: (i: number) => void;
  maxAbs: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragState = useRef({ startX: 0, scrollLeft: 0 });

  useEffect(() => {
    const el = scrollRef.current;
    const active = el?.querySelector("[data-active='true']");
    active?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [selectedIdx]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    setIsDragging(true);
    dragState.current = { startX: e.pageX - el.offsetLeft, scrollLeft: el.scrollLeft };
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const el = scrollRef.current;
    const x = e.pageX - el.offsetLeft;
    el.scrollLeft = dragState.current.scrollLeft - (x - dragState.current.startX);
  }, [isDragging]);

  const onMouseUp = useCallback(() => setIsDragging(false), []);

  return (
    <Surface className="p-5">
      <div
        ref={scrollRef}
        className="-mx-1 flex select-none items-end gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide"
        style={{ minHeight: 130, cursor: isDragging ? "grabbing" : "grab" }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        {rows.map((r, i) => {
          const risk = riskOf(r.risk);
          const on = i === selectedIdx;
          const isNeg = r.balance < 0;
          const barColor = isNeg ? "#F87171" : risk.hex;
          const barHeight = Math.max((Math.abs(r.balance) / maxAbs) * 84, 18);

          return (
            <button
              key={`${r.year}-${r.month}`}
              data-active={on}
              onClick={() => { if (!isDragging) onSelect(i); }}
              className="group flex min-w-[52px] flex-1 shrink-0 flex-col items-center gap-1.5"
            >
              <span className={cn("whitespace-nowrap text-[10.5px] font-bold tabular-nums transition-opacity", on ? "text-white" : "text-white/56")}>
                {compact(r.balance)}
              </span>

              <div className="relative w-full">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: barHeight }}
                  transition={{ delay: i * 0.02, duration: 0.5, ease: "easeOut" }}
                  className={cn("w-full rounded-[9px] transition-all", on ? "ring-2 ring-white" : "ring-1 ring-white/[0.06]")}
                  style={{ background: on ? barColor : `${barColor}33` }}
                />
              </div>

              <span className={cn("whitespace-nowrap text-[11px] font-semibold transition-colors", on ? "text-white" : "text-white/56")}>
                {r.short}{r.yearTag && <span className="text-white/38">/{r.yearTag}</span>}
              </span>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-center gap-4 border-t border-white/[0.06] pt-3.5 text-[11px] text-white/62">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: RISK.positivo.hex }} />
          <span>Tranquilo</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: RISK.atencao.hex }} />
          <span>Atenção</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-[#F87171]" />
          <span>Negativo</span>
        </div>
      </div>
    </Surface>
  );
}
