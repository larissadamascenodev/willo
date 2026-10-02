import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCategoryIcon, getCategoryHexColor } from "@/lib/categoryUtils";
import { useCashFlow, periodStart, sumFlow, toDateKey, type CashFlowEntry, type CashFlowPeriod } from "@/hooks/useCashFlow";
import { PageHeader, SectionTitle } from "@/components/shared/MobilePage";
import { currencySymbol, getCurrency } from "@/lib/currency";

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const CASHFLOW_SHORT = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });

/** O que já entrou e saiu, dia a dia e mês a mês. As projeções vivem em /bot-finance/projecoes. */
export default function Financeiro() {
  return (
    <div className="mx-auto max-w-lg pb-28">
      <PageHeader title="Fluxo de caixa" subtitle="O que já entrou e saiu" />
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

      <div className="mt-6 grid grid-cols-4 isolate rounded-full border border-white/[0.12] willo-glass p-1">
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
