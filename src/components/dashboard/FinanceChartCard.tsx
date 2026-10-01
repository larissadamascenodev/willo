import { memo, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceDot } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

import { getCurrency } from "@/lib/currency";
const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });
const toDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const GREEN = "#C8F36D";
const WEEK_DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

type View = "gastos" | "saldo";
type Period = "semana" | "mes";

interface Point {
  label: string;
  value: number;
}

interface ChartData {
  week: Point[];
  monthCumulative: Point[];
  balance: Point[];
  prevWeekTotal: number;
}

let cache: { userId: string; data: ChartData; timestamp: number } | null = null;
const CACHE_TTL = 300_000;

/** Paid money movement per local day (despesas negative, receitas positive), excluding card purchases. */
async function fetchChartData(userId: string): Promise<ChartData> {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const dow = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() + (dow === 0 ? -6 : 1 - dow));
  const prevMonday = new Date(monday);
  prevMonday.setDate(monday.getDate() - 7);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const balanceStart = new Date(now);
  balanceStart.setDate(now.getDate() - 29);

  const rangeStart = [prevMonday, monthStart, balanceStart].reduce((a, b) => (a < b ? a : b));

  const [{ data: txs }, { data: payments }, { data: accounts }] = await Promise.all([
    supabase
      .from("transactions")
      .select("date, amount, type")
      .eq("user_id", userId)
      .eq("status", "pago")
      .neq("payment_method", "cartao")
      .gte("date", toDateStr(rangeStart)),
    supabase
      .from("invoice_payments")
      .select("paid_at, amount")
      .eq("user_id", userId)
      .gte("paid_at", rangeStart.toISOString()),
    supabase
      .from("accounts")
      .select("current_balance, type")
      .eq("user_id", userId)
      .eq("is_active", true)
      .neq("type", "investimento"),
  ]);

  const spentByDay = new Map<string, number>();
  const netByDay = new Map<string, number>();
  const add = (map: Map<string, number>, key: string, v: number) => map.set(key, (map.get(key) ?? 0) + v);

  for (const tx of txs ?? []) {
    const amount = Number(tx.amount);
    if (tx.type === "despesa") {
      add(spentByDay, tx.date, amount);
      add(netByDay, tx.date, -amount);
    } else if (tx.type === "receita") {
      add(netByDay, tx.date, amount);
    }
  }
  for (const p of payments ?? []) {
    const key = toDateStr(new Date(p.paid_at));
    add(spentByDay, key, Number(p.amount));
    add(netByDay, key, -Number(p.amount));
  }

  const week: Point[] = WEEK_DAYS.map((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { label, value: spentByDay.get(toDateStr(d)) ?? 0 };
  });

  let prevWeekTotal = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(prevMonday);
    d.setDate(prevMonday.getDate() + i);
    prevWeekTotal += spentByDay.get(toDateStr(d)) ?? 0;
  }

  const monthCumulative: Point[] = [];
  let running = 0;
  for (let d = new Date(monthStart); d <= now; d.setDate(d.getDate() + 1)) {
    running += spentByDay.get(toDateStr(d)) ?? 0;
    monthCumulative.push({ label: String(d.getDate()), value: running });
  }

  // Walk backwards from today's real balance, undoing each day's net movement.
  const currentBalance = (accounts ?? []).reduce((s, a) => s + Number(a.current_balance), 0);
  const balance: Point[] = [];
  let endOfDay = currentBalance;
  for (let i = 0; i < 30; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = toDateStr(d);
    balance.unshift({ label: `${d.getDate()}/${d.getMonth() + 1}`, value: endOfDay });
    endOfDay -= netByDay.get(key) ?? 0;
  }

  return { week, monthCumulative, balance, prevWeekTotal };
}

function Segmented<T extends string>({
  id,
  value,
  options,
  onChange,
  size = "md",
}: {
  id: string;
  value: T;
  options: { key: T; label: string }[];
  onChange: (v: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className="flex rounded-full bg-white/[0.07] p-0.5">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={cn("relative rounded-full font-semibold", size === "sm" ? "h-6 px-2.5 text-[10px]" : "h-7 px-3 text-[11px]")}
        >
          {value === o.key && (
            <motion.span
              layoutId={`seg-${id}`}
              className="pointer-events-none absolute inset-0 z-0 rounded-full bg-white"
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
            />
          )}
          <span className={cn("relative z-10 transform-gpu transition-colors", value === o.key ? "text-[#0B0B0B]" : "text-white/50")}>
            {o.label}
          </span>
        </button>
      ))}
    </div>
  );
}

function LineChart({ data, id }: { data: Point[]; id: string }) {
  const last = data[data.length - 1];
  const values = data.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.15 || Math.abs(max) * 0.1 || 10;

  return (
    <div className="h-[84px] -mx-1">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id={`fill-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={GREEN} stopOpacity={0.32} />
              <stop offset="100%" stopColor={GREEN} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="label" hide />
          <YAxis hide domain={[min - pad, max + pad]} />
          <Tooltip
            cursor={{ stroke: "rgba(255,255,255,0.18)", strokeWidth: 1 }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <div className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-[#0B0B0B] shadow-lg">
                  {payload[0].payload.label} · {fmt(Number(payload[0].value))}
                </div>
              ) : null
            }
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={GREEN}
            strokeWidth={2.5}
            fill={`url(#fill-${id})`}
            animationDuration={700}
            activeDot={{ r: 5, fill: GREEN, stroke: "#0B0B0B", strokeWidth: 2 }}
          />
          {last && <ReferenceDot x={last.label} y={last.value} r={5} fill={GREEN} stroke="none" />}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function WeekBars({ data }: { data: Point[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const todayIdx = (new Date().getDay() + 6) % 7;

  return (
    <div className="pt-1">
      <div className="flex h-[64px] items-end justify-between gap-2">
        {data.map((d, i) => {
          const h = d.value > 0 ? Math.max((d.value / max) * 64, 5) : 5;
          return (
            <div key={d.label} className="flex flex-1 flex-col items-center justify-end" title={`${d.label}: ${fmt(d.value)}`}>
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: h }}
                transition={{ delay: i * 0.05, duration: 0.45, ease: "easeOut" }}
                className={cn(
                  "w-full max-w-[18px] rounded-full",
                  d.value === 0 ? "bg-white/[0.08]" : i === todayIdx ? "bg-[#C8F36D]" : "bg-white/80"
                )}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between gap-2">
        {data.map((d, i) => (
          <span key={d.label} className={cn("flex-1 text-center text-[10px]", i === todayIdx ? "font-semibold text-white" : "text-white/40")}>
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * One card, two lenses: spending (this week as daily bars, or this month as a
 * cumulative line) and balance evolution over the last 30 days as a line.
 */
const FinanceChartCard = memo(() => {
  const { user } = useAuth();
  const [view, setView] = useState<View>("gastos");
  const [period, setPeriod] = useState<Period>("semana");
  const [data, setData] = useState<ChartData | null>(() =>
    cache && user && cache.userId === user.id ? cache.data : null
  );

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const next = await fetchChartData(user.id);
      cache = { userId: user.id, data: next, timestamp: Date.now() };
      setData(next);
    };
    if (!cache || cache.userId !== user.id || Date.now() - cache.timestamp >= CACHE_TTL) void load();

    const onChange = () => {
      cache = null;
      void load();
    };
    window.addEventListener("finance-data-changed", onChange);
    return () => window.removeEventListener("finance-data-changed", onChange);
  }, [user]);

  const summary = useMemo(() => {
    if (!data) return null;
    if (view === "saldo") {
      const first = data.balance[0]?.value ?? 0;
      const last = data.balance[data.balance.length - 1]?.value ?? 0;
      return { title: "Evolução do saldo", caption: "Últimos 30 dias", value: last, delta: last - first };
    }
    if (period === "semana") {
      const total = data.week.reduce((s, d) => s + d.value, 0);
      const pct = data.prevWeekTotal > 0 ? Math.round(((total - data.prevWeekTotal) / data.prevWeekTotal) * 100) : null;
      return { title: "Gastos da semana", caption: pct === null ? "Esta semana" : `${pct > 0 ? "+" : ""}${pct}% vs. semana passada`, value: total, delta: null };
    }
    const total = data.monthCumulative[data.monthCumulative.length - 1]?.value ?? 0;
    return { title: "Gastos do mês", caption: "Acumulado até hoje", value: total, delta: null };
  }, [data, view, period]);

  if (!data || !summary) {
    return <div className="h-[190px] animate-pulse rounded-[22px] border border-white/[0.12] bg-white/[0.03]" />;
  }

  return (
    <div className="rounded-[22px] border border-white/[0.12] willo-glass px-3.5 py-3">
      <div className="flex items-center justify-between gap-2">
        <Segmented<View>
          id="finance-view"
          value={view}
          onChange={setView}
          options={[
            { key: "gastos", label: "Gastos" },
            { key: "saldo", label: "Saldo" },
          ]}
        />
        {view === "gastos" && (
          <Segmented<Period>
            id="finance-period"
            size="sm"
            value={period}
            onChange={setPeriod}
            options={[
              { key: "semana", label: "Semana" },
              { key: "mes", label: "Mês" },
            ]}
          />
        )}
      </div>

      <div className="mt-2.5">
        <p className="text-[12px] text-white/50">{summary.title}</p>
        <div className="flex items-baseline gap-2">
          <p className="text-[20px] font-extrabold leading-tight tracking-tight tabular-nums text-white">{fmt(summary.value)}</p>
          {summary.delta !== null && (
            <span className={cn("text-[11px] font-bold tabular-nums", summary.delta >= 0 ? "text-willo-green" : "text-red-400")}>
              {summary.delta >= 0 ? "+" : "-"}
              {fmt(Math.abs(summary.delta))}
            </span>
          )}
        </div>
        <p className="text-[11px] text-white/35">{summary.caption}</p>
      </div>

      <div className="mt-2">
        {view === "saldo" ? (
          <LineChart data={data.balance} id="saldo" />
        ) : period === "semana" ? (
          <WeekBars data={data.week} />
        ) : (
          <LineChart data={data.monthCumulative} id="gastos-mes" />
        )}
      </div>
    </div>
  );
});

FinanceChartCard.displayName = "FinanceChartCard";
export default FinanceChartCard;
