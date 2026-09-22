import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle, ArrowDownLeft, ArrowRight, ArrowUpRight, CalendarDays,
  Equal, Eye, EyeOff, Info, Minus, Plus, TrendingDown, TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getCategoryIcon, getCategoryHexColor } from "@/lib/categoryUtils";
import { useCashFlow, periodStart, sumFlow, toDateKey, type CashFlowEntry, type CashFlowPeriod } from "@/hooks/useCashFlow";
import { useFinancialProjection } from "@/hooks/useFinancialProjection";
import { PageHeader, SectionTitle, Surface } from "@/components/shared/MobilePage";
import { currencySymbol, getCurrency } from "@/lib/currency";

type Tool = "atual" | "projecoes";

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const MONTH_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const CASHFLOW_SHORT = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });
const compact = (v: number) => `${v < 0 ? "−" : ""}${currencySymbol()} ${Math.abs(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;

const TOOLS: { key: Tool; label: string; subtitle: string }[] = [
  { key: "atual", label: "Balanço", subtitle: "O balanço do mês e o fluxo de caixa" },
  { key: "projecoes", label: "Projeções", subtitle: "Para onde seu saldo está indo" },
];

/**
 * Uma ferramenta, duas visões: o Atual (balanço do mês + fluxo de caixa, tudo
 * junto) e as Projeções (os meses seguintes).
 */
export default function Financeiro({ initialTab = "atual" }: { initialTab?: Tool }) {
  const [tool, setTool] = useState<Tool>(initialTab);
  const active = TOOLS.find((t) => t.key === tool)!;

  return (
    <div className="mx-auto max-w-lg pb-28">
      <PageHeader title="Financeiro" subtitle={active.subtitle} />

      <div className="mt-5 flex rounded-full border border-white/[0.07] bg-[#141414] p-1">
        {TOOLS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTool(t.key)}
            className={cn(
              "relative flex-1 rounded-full py-2 text-[13px] font-semibold transition-colors",
              tool === t.key ? "text-[#0B0B0B]" : "text-white/55",
            )}
          >
            {tool === t.key && (
              <motion.span
                layoutId="financeiro-tool"
                className="absolute inset-0 z-0 rounded-full bg-white"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative">{t.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tool} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          {tool === "atual" && <AtualPanel />}
          {tool === "projecoes" && <FuturoPanel />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════ Atual — balanço do mês + fluxo de caixa ═══════════════════ */

function AtualPanel() {
  return (
    <div>
      <BalancoMensalSection />
      <SectionTitle>Fluxo de caixa</SectionTitle>
      <RealizadoPanel />
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
            <span className={cn("mt-3 text-[13px] tabular-nums", b.isCurrent ? "font-semibold text-white" : "text-white/45")}>{b.label}</span>
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
        <p className="truncate text-[13px] text-white/45">
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
                subTab === key ? "border-white bg-white text-[#0B0B0B]" : "border-white/[0.1] text-white/60",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setHidden((v) => !v)}
          aria-label={hidden ? "Mostrar valores" : "Ocultar valores"}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-white/60 active:opacity-60"
        >
          {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      <div className="mt-5">
        <p className="text-[14px] text-white/50">{cashFlowTitle(subTab, period)}</p>
        <p className="mt-0.5 truncate text-[34px] font-extrabold leading-tight tracking-tight tabular-nums text-white">
          {loading ? "…" : headlineText}
        </p>
        {subTab === "geral" && (
          <div className="mt-2 space-y-1">
            <p className="flex items-center gap-2 text-[14px] text-white/60 tabular-nums">
              <span className="h-2.5 w-2.5 rounded-full bg-[#C8F36D]" /> Entradas {hidden ? `${currencySymbol()} ••••` : fmt(totals.entradas)}
            </p>
            <p className="flex items-center gap-2 text-[14px] text-white/60 tabular-nums">
              <span className="h-2.5 w-2.5 rounded-full bg-[#EF4444]" /> Saídas {hidden ? `${currencySymbol()} ••••` : fmt(totals.saidas)}
            </p>
          </div>
        )}
        <p className="mt-3 text-[12px] leading-snug text-white/40">
          Considera só o dinheiro que entrou e saiu das contas. Compras no cartão entram quando a fatura é paga.
        </p>
      </div>

      <div className="mt-6">
        <CashFlowChart buckets={buckets} subTab={subTab} period={period} onSelectKind={setSubTab} />
      </div>

      <div className="mt-6 grid grid-cols-4 rounded-full border border-white/[0.07] bg-[#141414] p-1">
        {PERIODS.map((p) => (
          <button key={p.key} onClick={() => setPeriod(p.key)} className="relative h-10 rounded-full text-[13.5px] font-semibold">
            {period === p.key && (
              <motion.span layoutId="cashflow-period" className="absolute inset-0 z-0 rounded-full bg-white" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
            )}
            <span className={cn("relative z-10", period === p.key ? "text-[#0B0B0B]" : "text-white")}>{p.label}</span>
          </button>
        ))}
      </div>

      <SectionTitle>
        {subTab === "geral" ? "Últimos lançamentos" : subTab === "entradas" ? "Últimas entradas" : "Últimas saídas"}
      </SectionTitle>
      {latest.length === 0 ? (
        <p className="py-8 text-center text-[14px] text-white/40">Nada por aqui neste período</p>
      ) : (
        <div>
          {latest.map((e) => (
            <CashFlowEntryRow key={e.id} entry={e} hidden={hidden} />
          ))}
        </div>
      )}
      <button
        onClick={() => navigate("/transacoes")}
        className="mt-4 h-14 w-full rounded-full bg-[#1A1A1A] text-[16px] font-medium text-white active:opacity-70"
      >
        Ver todos os lançamentos
      </button>
    </div>
  );
}

/* ═══════════════════ Balanço do mês — o que está previsto fechar ═══════════════════ */

function BalancoMensalSection() {
  const { projections, loading, selectedMonth, selectedYear } = useFinancialProjection();
  const now = new Date();
  const current = projections[0];

  const income = current?.income ?? 0;
  const expense = current?.expense ?? 0;
  const balance = current?.delta ?? 0;
  const base = Math.max(income, expense, 1);
  const savedShare = income > 0 ? balance / income : 0;

  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const isCurrentMonth = selectedMonth === now.getMonth() && selectedYear === now.getFullYear();
  const isPastMonth = selectedYear < now.getFullYear() || (selectedYear === now.getFullYear() && selectedMonth < now.getMonth());
  const dayOfMonth = isCurrentMonth ? now.getDate() : daysInMonth;
  const statusLabel = isPastMonth ? "Balanço final" : isCurrentMonth ? "Balanço parcial" : "Balanço previsto";

  const verdict = balance < 0
    ? `Você gastou ${fmt(-balance)} a mais do que ganhou neste mês.`
    : savedShare >= 0.2
      ? `Sobraram ${Math.round(savedShare * 100)}% da sua renda. Mês redondo 👏`
      : balance === 0
        ? "Entradas e saídas empataram no mês."
        : `Sobrou ${Math.round(savedShare * 100)}% da renda. Dá pra abrir mais folga segurando os gastos variáveis.`;

  if (loading || !current) {
    return (
      <div className="mt-6 space-y-3">
        <div className="h-56 animate-pulse rounded-[26px] bg-[#141414]" />
        <div className="h-40 animate-pulse rounded-[22px] bg-[#141414]" />
      </div>
    );
  }

  return (
    <div>
      <p className="mt-6 text-[13px] text-white/45">{statusLabel} de {MONTH_NAMES[selectedMonth]}</p>

      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative mt-2 overflow-hidden rounded-[28px] border border-white/[0.08] p-5"
        style={{
          background: `radial-gradient(120% 90% at 100% 0%, ${balance < 0 ? "#F8717120" : "#C8F36D1C"} 0%, rgba(20,20,20,0.96) 55%, #0E0E0E 100%)`,
        }}
      >
        <p className="text-[13px] text-white/55">{balance < 0 ? "Faltou no mês" : "Sobrou no mês"}</p>
        <p className={cn("truncate text-[42px] font-extrabold leading-tight tracking-tight tabular-nums", balance < 0 ? "text-red-400" : "text-white")}>
          {fmt(Math.abs(balance))}
        </p>

        <div className="mt-5 space-y-3.5">
          {[
            { label: "Receitas", value: income, hex: "#C8F36D", Icon: ArrowDownLeft },
            { label: "Despesas", value: expense, hex: "#F87171", Icon: ArrowUpRight },
          ].map(({ label, value, hex, Icon }, i) => (
            <div key={label}>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[13px] text-white/60">
                  <Icon className="h-4 w-4" style={{ color: hex }} strokeWidth={2.5} /> {label}
                </span>
                <span className="text-[16px] font-bold text-white tabular-nums">{fmt(value)}</span>
              </div>
              <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: hex }}
                  initial={{ width: 0 }}
                  animate={{ width: `${(value / base) * 100}%` }}
                  transition={{ delay: 0.15 + i * 0.12, duration: 0.7, ease: "easeOut" }}
                />
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between border-t border-white/[0.08] pt-3">
            <span className="flex items-center gap-1.5 text-[13px] text-white/60">
              <Equal className="h-4 w-4 text-white/50" strokeWidth={2.5} /> Balanço
            </span>
            <span className={cn("text-[18px] font-extrabold tabular-nums", balance < 0 ? "text-red-400" : "text-willo-green")}>
              {balance > 0 ? "+" : ""}{fmt(balance)}
            </span>
          </div>
        </div>

        <p className="mt-4 rounded-[16px] bg-black/25 px-3.5 py-2.5 text-[13px] leading-snug text-white/75">{verdict}</p>
      </motion.section>

      {isCurrentMonth && (
        <Surface className="mt-3 p-5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[13px] text-white/60">
              <CalendarDays className="h-4 w-4 text-white/45" /> Mês em andamento
            </span>
            <span className="text-[12px] text-white/45 tabular-nums">
              {daysInMonth - dayOfMonth} {daysInMonth - dayOfMonth === 1 ? "dia restante" : "dias restantes"}
            </span>
          </div>
          <div className="mt-2.5 flex gap-[2px]">
            {Array.from({ length: daysInMonth }, (_, d) => (
              <span
                key={d}
                className={cn(
                  "h-4 flex-1 rounded-[3px]",
                  d + 1 < dayOfMonth ? "bg-white/55" : d + 1 === dayOfMonth ? "bg-white" : "bg-white/[0.08]",
                )}
              />
            ))}
          </div>
        </Surface>
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

function FuturoPanel() {
  const navigate = useNavigate();
  const { projections, data, loading } = useFinancialProjection();
  const [selectedIdx, setSelectedIdx] = useState(0);

  const rows = useMemo(
    () =>
      projections.map((p, i) => ({
        ...p,
        prevBalance: i > 0 ? projections[i - 1].balance : data.previousMonthEndingBalance,
        short: MONTH_SHORT[p.month],
        yearTag: p.year !== new Date().getFullYear() ? String(p.year).slice(2) : "",
      })),
    [projections, data.previousMonthEndingBalance],
  );

  const insights = useMemo(() => {
    if (rows.length === 0) return null;
    const first = rows[0];
    const last = rows[rows.length - 1];
    const negatives = rows.filter((r) => r.balance < 0);
    const lowest = rows.reduce((a, b) => (b.balance < a.balance ? b : a));
    return { first, last, negatives, lowest, growth: last.balance - first.prevBalance };
  }, [rows]);

  if (loading) {
    return (
      <div className="mt-6 space-y-3">
        <div className="h-44 animate-pulse rounded-[26px] bg-[#141414]" />
        <div className="h-64 animate-pulse rounded-[24px] bg-[#141414]" />
      </div>
    );
  }

  if ((!data.transactions.length && !data.events.length) || !insights) {
    return (
      <div className="mt-10 flex flex-col items-center px-8 text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.05]">
          <CalendarDays className="h-8 w-8 text-white/40" />
        </span>
        <p className="mt-5 text-[18px] font-bold text-white">Ainda sem dados suficientes</p>
        <p className="mt-1 text-[14px] text-white/45">Adicione transações para ver suas projeções.</p>
        <button onClick={() => navigate("/transacoes")} className="mt-5 h-11 rounded-full bg-white px-6 text-[14px] font-semibold text-[#0B0B0B]">
          Ver transações
        </button>
      </div>
    );
  }

  const selected = rows[Math.min(selectedIdx, rows.length - 1)];
  const balances = rows.map((r) => r.balance);
  const maxAbs = Math.max(...balances.map((b) => Math.abs(b)), 1);

  const headline = insights.negatives.length > 0
    ? `Seu saldo fica negativo em ${insights.negatives.length} ${insights.negatives.length === 1 ? "mês" : "meses"}. Dá tempo de mudar isso.`
    : insights.growth >= 0
      ? `Mantendo o ritmo, você termina com ${compact(insights.last.balance)} em ${MONTH_NAMES[insights.last.month].toLowerCase()}.`
      : `Mantendo o ritmo, seu saldo encolhe ${compact(Math.abs(insights.growth))} até ${MONTH_NAMES[insights.last.month].toLowerCase()}.`;

  return (
    <div>
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative mt-6 overflow-hidden rounded-[28px] border border-white/[0.08] p-5"
        style={{
          background: `radial-gradient(120% 90% at 100% 0%, ${insights.growth >= 0 ? "#C8F36D1C" : "#F8717120"} 0%, rgba(20,20,20,0.96) 55%, #0E0E0E 100%)`,
        }}
      >
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] text-white/45">Hoje</p>
            <p className="truncate text-[20px] font-bold text-white tabular-nums">{compact(insights.first.prevBalance)}</p>
          </div>
          <ArrowRight className="mb-1.5 h-5 w-5 shrink-0 text-white/30" />
          <div className="min-w-0 text-right">
            <p className="truncate text-[12px] text-white/45">
              {MONTH_NAMES[insights.last.month]}{insights.last.yearTag ? `/${insights.last.yearTag}` : ""}
            </p>
            <p className={cn("truncate text-[30px] font-extrabold leading-tight tracking-tight tabular-nums", insights.last.balance < 0 ? "text-red-400" : "text-white")}>
              {compact(insights.last.balance)}
            </p>
          </div>
        </div>

        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/[0.08] px-3 py-1.5">
          {insights.growth >= 0 ? <TrendingUp className="h-3.5 w-3.5 text-willo-green" /> : <TrendingDown className="h-3.5 w-3.5 text-red-400" />}
          <span className={cn("text-[13px] font-semibold tabular-nums", insights.growth >= 0 ? "text-willo-green" : "text-red-400")}>
            {insights.growth >= 0 ? "+" : "−"}{compact(Math.abs(insights.growth))}
          </span>
          <span className="text-[12px] text-white/50">em {rows.length} meses</span>
        </div>

        <p className="mt-3 rounded-[16px] bg-black/25 px-3.5 py-2.5 text-[13px] leading-snug text-white/75">{headline}</p>
      </motion.section>

      <SectionTitle>Como seu saldo evolui</SectionTitle>
      <ProjectionHistoryChart rows={rows} selectedIdx={selectedIdx} onSelect={setSelectedIdx} maxAbs={maxAbs} />

      <SectionTitle>{MONTH_NAMES[selected.month]} {selected.year}</SectionTitle>
      <Surface className="p-5">
        <div className="space-y-2.5">
          {[
            { Icon: null, label: "Saldo que vem do mês anterior", value: selected.prevBalance, tone: "text-white" },
            { Icon: Plus, label: "Receitas previstas", value: selected.income, tone: "text-willo-green" },
            { Icon: Minus, label: "Despesas previstas", value: selected.expense, tone: "text-red-400" },
          ].map(({ Icon, label, value, tone }) => (
            <div key={label} className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.06]">
                {Icon && <Icon className="h-3 w-3 text-white/60" />}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13.5px] text-white/60">{label}</span>
              <span className={cn("shrink-0 text-[14px] font-medium tabular-nums", tone)}>{fmt(value)}</span>
            </div>
          ))}
          <div className="flex items-center gap-2.5 rounded-[16px] bg-white/[0.05] px-2.5 py-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[#0B0B0B]">
              <Equal className="h-3 w-3" strokeWidth={3} />
            </span>
            <span className="flex-1 text-[14px] font-semibold text-white">Saldo no fim do mês</span>
            <span className={cn("text-[17px] font-bold tabular-nums", selected.balance < 0 ? "text-red-400" : "text-white")}>{fmt(selected.balance)}</span>
          </div>
        </div>

        <p
          className="mt-3 flex items-start gap-2 rounded-[16px] px-3.5 py-2.5 text-[13px] leading-snug"
          style={{ background: `${riskOf(selected.risk).hex}14`, color: "rgba(255,255,255,0.8)" }}
        >
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: riskOf(selected.risk).hex }} />
          {selected.balance < 0
            ? `Mês fecha negativo em ${fmt(Math.abs(selected.balance))}. Antecipar receitas ou adiar uma compra resolve.`
            : selected.delta < 0
              ? `Neste mês você gasta ${fmt(Math.abs(selected.delta))} a mais do que recebe, mas o saldo acumulado segura.`
              : `Sobram ${fmt(selected.delta)} neste mês. Bom momento para guardar uma parte.`}
        </p>
      </Surface>

      {insights.negatives.length > 0 && (
        <>
          <SectionTitle>Meses de atenção</SectionTitle>
          <Surface className="divide-y divide-white/[0.06] px-4">
            {insights.negatives.map((r) => (
              <button
                key={`neg-${r.year}-${r.month}`}
                onClick={() => setSelectedIdx(rows.findIndex((x) => x.month === r.month && x.year === r.year))}
                className="flex w-full items-center gap-3 py-3.5 text-left"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-400/15">
                  <AlertTriangle className="h-[18px] w-[18px] text-red-400" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] text-white">{MONTH_NAMES[r.month]} {r.year}</span>
                  <span className="block text-[12px] text-white/45">saldo previsto</span>
                </span>
                <span className="shrink-0 text-[15px] font-semibold text-red-400 tabular-nums">{fmt(r.balance)}</span>
              </button>
            ))}
          </Surface>
        </>
      )}

      <p className="mt-5 flex items-start gap-2 px-1 text-[12px] leading-snug text-white/35">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        A projeção usa suas contas fixas, parcelas já lançadas e a média dos seus gastos. Novos lançamentos ajustam o cálculo na hora.
      </p>
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
              <span className={cn("whitespace-nowrap text-[10.5px] font-bold tabular-nums transition-opacity", on ? "text-white" : "text-white/40")}>
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

              <span className={cn("whitespace-nowrap text-[11px] font-semibold transition-colors", on ? "text-white" : "text-white/40")}>
                {r.short}{r.yearTag && <span className="text-white/25">/{r.yearTag}</span>}
              </span>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-center gap-4 border-t border-white/[0.06] pt-3.5 text-[11px] text-white/45">
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
