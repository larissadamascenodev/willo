import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowUpRight, ArrowDownRight,
  CalendarDays, ChevronDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMonth } from "@/contexts/MonthContext";

import { getRecurringForMonth } from "@/services/recurringService";
import { getCustomCategories, type CustomCategory } from "@/services/categoryService";
import { getCategoryIcon, getCategoryColor } from "@/lib/categoryUtils";
import { dayOfMonth } from "@/lib/dateOnly";

import { getCurrency } from "@/lib/currency";
const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });


const WEEKDAYS_SHORT = ["D", "S", "T", "Q", "Q", "S", "S"];


interface TransactionRow {
  id: string; name: string; category: string; date: string;
  amount: number; type: string; status: string;
  account_id: string | null;
}

const GlassCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div
    className={`rounded-2xl border border-border/20 bg-card/60 backdrop-blur-xl p-4 ${className}`}
    style={{ boxShadow: "0 4px 24px -4px rgba(0,0,0,0.3)" }}
  >
    {children}
  </div>
);

const DailyBarGroup = ({ despesas, receitas, maxVal, height = 32 }: { despesas: number; receitas: number; maxVal: number; height?: number }) => (
  <div className={`w-full flex items-end justify-center gap-[2px]`} style={{ height: `${height}px` }}>
    {despesas > 0 && (
      <div className="w-[40%] rounded-full bg-destructive/50" style={{ height: `${Math.max((despesas / maxVal) * height, 3)}px` }} />
    )}
    {receitas > 0 && (
      <div className="w-[40%] rounded-full bg-primary/50" style={{ height: `${Math.max((receitas / maxVal) * height, 3)}px` }} />
    )}
    {despesas === 0 && receitas === 0 && (
      <div className="w-full rounded-full bg-muted/30" style={{ height: "3px" }} />
    )}
  </div>
);

const TransacoesAnalytics = () => {
  const { user } = useAuth();
  const { selectedMonth, selectedYear } = useMonth();
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [customCats, setCustomCats] = useState<CustomCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [dailyExpanded, setDailyExpanded] = useState(false);

  useEffect(() => { getCustomCategories().then(setCustomCats).catch(() => {}); }, []);

  useEffect(() => {
    if (!user) return;
    const fetchTxs = async () => {
      setLoading(true);
      const start = new Date(selectedYear, selectedMonth, 1).toISOString().split("T")[0];
      const end = new Date(selectedYear, selectedMonth + 1, 0).toISOString().split("T")[0];

      const [txRes, recurringTxs] = await Promise.all([
        supabase.from("transactions").select("*").eq("user_id", user.id).gte("date", start).lte("date", end).order("date", { ascending: false }),
        getRecurringForMonth(selectedMonth, selectedYear),
      ]);

      const baseTxs = (txRes.data ?? []) as TransactionRow[];
      const materializedRecurring = recurringTxs.map((t: any) => ({
        ...t,
        date: `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(dayOfMonth(t.date)).padStart(2, "0")}`,
      })) as TransactionRow[];

      setTransactions([...baseTxs, ...materializedRecurring]);
      setLoading(false);
    };
    fetchTxs();
  }, [user, selectedMonth, selectedYear]);


  const totals = useMemo(() => {
    const receitas = transactions.filter(t => t.type === "receita").reduce((s, t) => s + t.amount, 0);
    const despesas = transactions.filter(t => t.type === "despesa").reduce((s, t) => s + t.amount, 0);
    const receitasRecebidas = transactions.filter(t => t.type === "receita" && t.status === "pago").reduce((s, t) => s + t.amount, 0);
    const despesasPagas = transactions.filter(t => t.type === "despesa" && t.status === "pago").reduce((s, t) => s + t.amount, 0);
    return {
      receitas, despesas, receitasRecebidas, despesasPagas,
      receitasPendentes: receitas - receitasRecebidas,
      despesasPendentes: despesas - despesasPagas,
    };
  }, [transactions]);

  const categoryData = useMemo(() => {
    const map = new Map<string, number>();
    transactions.filter(t => t.type === "despesa").forEach(t => map.set(t.category, (map.get(t.category) ?? 0) + t.amount));
    const total = Array.from(map.values()).reduce((s, v) => s + v, 0);
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, amount]) => ({
        name, amount, color: `hsl(${getCategoryColor(name, customCats)})`,
        icon: getCategoryIcon(name, customCats),
        percentage: total > 0 ? ((amount / total) * 100).toFixed(0) : "0",
      }));
  }, [transactions, customCats]);

  const dailyData = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const result: { day: number; despesas: number; receitas: number }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayTxs = transactions.filter(t => t.date === dateStr);
      result.push({
        day: d,
        despesas: dayTxs.filter(t => t.type === "despesa").reduce((s, t) => s + t.amount, 0),
        receitas: dayTxs.filter(t => t.type === "receita").reduce((s, t) => s + t.amount, 0),
      });
    }
    return result;
  }, [transactions, selectedMonth, selectedYear]);

  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const firstDay = new Date(selectedYear, selectedMonth, 1).getDay();
    const dayMap = new Map<number, number>();
    const receiptDays = new Set<number>();
    transactions.forEach(t => {
      const d = parseInt(t.date.split("-")[2]);
      if (t.type === "despesa") dayMap.set(d, (dayMap.get(d) ?? 0) + t.amount);
      if (t.type === "receita") receiptDays.add(d);
    });
    const maxExpense = Math.max(...Array.from(dayMap.values()), 1);
    const cells: { day: number; expense: number; intensity: number; hasReceipt: boolean; isEmpty: boolean }[] = [];
    for (let i = 0; i < firstDay; i++) cells.push({ day: 0, expense: 0, intensity: 0, hasReceipt: false, isEmpty: true });
    for (let d = 1; d <= daysInMonth; d++) {
      const exp = dayMap.get(d) ?? 0;
      cells.push({ day: d, expense: exp, intensity: exp / maxExpense, hasReceipt: receiptDays.has(d), isEmpty: false });
    }
    return cells;
  }, [transactions, selectedMonth, selectedYear]);


  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-pulse text-primary text-sm">Carregando...</div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
      {/* Resumo Receitas & Despesas */}
      <div className="grid grid-cols-2 gap-2">
        {/* Receitas */}
        <GlassCard className="!p-3 border-primary/15 bg-primary/[0.04]">
          <div className="flex items-center gap-1.5 mb-2">
            <ArrowUpRight className="w-3.5 h-3.5 text-primary" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Receitas</span>
          </div>
          <p className="text-base font-bold text-willo-green tabular-nums leading-none mb-2">{fmt(totals.receitas)}</p>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-muted-foreground/60">Recebido</span>
              <span className="text-[10px] font-semibold text-willo-green/80 tabular-nums">{fmt(totals.receitasRecebidas)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-muted-foreground/60">Pendente</span>
              <span className="text-[10px] font-semibold text-muted-foreground tabular-nums">{fmt(totals.receitasPendentes)}</span>
            </div>
          </div>
        </GlassCard>

        {/* Despesas */}
        <GlassCard className="!p-3 border-destructive/15 bg-destructive/[0.04]">
          <div className="flex items-center gap-1.5 mb-2">
            <ArrowDownRight className="w-3.5 h-3.5 text-destructive" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Despesas</span>
          </div>
          <p className="text-base font-bold text-destructive tabular-nums leading-none mb-2">{fmt(totals.despesas)}</p>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-muted-foreground/60">Pago</span>
              <span className="text-[10px] font-semibold text-destructive/80 tabular-nums">{fmt(totals.despesasPagas)}</span>
            </div>
            {totals.despesasPendentes > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-muted-foreground/60">Pendente</span>
                <span className="text-[10px] font-semibold text-muted-foreground tabular-nums">{fmt(totals.despesasPendentes)}</span>
              </div>
            )}
          </div>
        </GlassCard>
      </div>

      {/* Gastos por Categoria */}
      {categoryData.length > 0 && (
        <GlassCard>
          <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Gastos por Categoria</h3>
          <div className="space-y-2.5">
            {categoryData.slice(0, 6).map((cat) => {
              const CatIcon = cat.icon;
              return (
              <div key={cat.name} className="flex items-center gap-3">
                <div className="w-5 h-5 flex items-center justify-center shrink-0">
                  <CatIcon className="w-4 h-4" style={{ color: cat.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{cat.name}</p>
                  <div className="w-full h-1 bg-border/20 rounded-full mt-1 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${cat.percentage}%`, background: cat.color }} />
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-foreground tabular-nums">{fmt(cat.amount)}</p>
                  <p className="text-[9px] text-muted-foreground/50">{cat.percentage}%</p>
                </div>
              </div>
              );
            })}
          </div>
        </GlassCard>
      )}

      {/* Gastos Diários - Collapsible */}
      <GlassCard className="!p-0 overflow-hidden">
        <button
          onClick={() => setDailyExpanded(!dailyExpanded)}
          className="w-full flex items-center justify-between p-4"
        >
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Gastos Diários</h3>
          </div>
          <motion.div
            animate={{ rotate: dailyExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </motion.div>
        </button>

        {/* Collapsed: last 7 days */}
        {!dailyExpanded && (
          <div className="px-4 pb-3">
            <div className="flex gap-1">
              {(() => {
                const today = new Date();
                const days: { day: number; label: string; despesas: number; receitas: number; isToday: boolean }[] = [];
                for (let i = 6; i >= 0; i--) {
                  const d = new Date(today);
                  d.setDate(today.getDate() - i);
                  const inMonth = d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
                  const dayNum = d.getDate();
                  const dayData = dailyData.find(dd => dd.day === dayNum);
                  days.push({
                    day: dayNum, label: WEEKDAYS_SHORT[d.getDay()],
                    despesas: inMonth && dayData ? dayData.despesas : 0,
                    receitas: inMonth && dayData ? dayData.receitas : 0,
                    isToday: i === 0,
                  });
                }
                const maxVal = Math.max(...days.map(d => Math.max(d.despesas, d.receitas)), 1);
                return days.map((wd, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <DailyBarGroup despesas={wd.despesas} receitas={wd.receitas} maxVal={maxVal} height={28} />
                    <span className={`text-[8px] font-medium ${wd.isToday ? "text-primary font-bold" : "text-muted-foreground/50"}`}>
                      {wd.label}
                    </span>
                  </div>
                ));
              })()}
            </div>
          </div>
        )}

        {/* Expanded: full month bars + compact heatmap */}
        <AnimatePresence>
          {dailyExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-3">
                {/* Full month bars */}
                <div className="overflow-x-auto -mx-1 px-1">
                  <div className="flex gap-[2px]" style={{ minWidth: `${dailyData.length * 12}px` }}>
                    {(() => {
                      const maxVal = Math.max(...dailyData.map(d => Math.max(d.despesas, d.receitas)), 1);
                      const today = new Date();
                      return dailyData.map((dd, i) => {
                        const isToday = dd.day === today.getDate() && selectedMonth === today.getMonth() && selectedYear === today.getFullYear();
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-0.5" style={{ minWidth: "10px" }}>
                            <DailyBarGroup despesas={dd.despesas} receitas={dd.receitas} maxVal={maxVal} height={32} />
                            <span className={`text-[6px] font-medium ${isToday ? "text-primary font-bold" : "text-muted-foreground/40"}`}>
                              {dd.day}
                            </span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* Compact Heatmap */}
                <div>
                  <h4 className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">Mapa de Gastos</h4>
                  <div className="grid grid-cols-7 gap-[3px] mb-[3px]">
                    {WEEKDAYS_SHORT.map((d, i) => (
                      <div key={i} className="text-center text-[7px] text-muted-foreground/40 font-semibold">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-[3px]">
                    {calendarDays.map((cell, i) => {
                      if (cell.isEmpty) return <div key={`e-${i}`} className="aspect-square" />;
                      const today = new Date();
                      const isToday = cell.day === today.getDate() && selectedMonth === today.getMonth() && selectedYear === today.getFullYear();
                      return (
                        <div
                          key={cell.day}
                          className={`aspect-square rounded-[3px] flex items-center justify-center relative text-[7px] font-medium ${isToday ? "ring-1 ring-primary" : ""}`}
                          style={{
                            background: cell.intensity > 0
                              ? `hsl(var(--destructive) / ${0.15 + cell.intensity * 0.45})`
                              : "hsl(var(--muted) / 0.3)",
                            color: cell.intensity > 0.5 ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground) / 0.6)",
                          }}
                        >
                          {cell.day}
                          {cell.hasReceipt && (
                            <span className="absolute top-0 right-0 w-[3px] h-[3px] rounded-full bg-primary" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-center gap-2.5 mt-1.5">
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-sm bg-destructive/30" />
                      <span className="text-[7px] text-muted-foreground/50">Pouco</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-sm bg-destructive/70" />
                      <span className="text-[7px] text-muted-foreground/50">Muito</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <span className="text-[7px] text-muted-foreground/50">Receita</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>

    </motion.div>
  );
};

export default TransacoesAnalytics;
