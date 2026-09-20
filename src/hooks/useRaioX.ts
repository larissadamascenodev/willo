import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFinanceData } from "@/hooks/useFinanceData";
import { useCardsOverview } from "@/hooks/useCardsOverview";
import { prefetchDashboardData } from "@/services/dashboardData";
import { getRecurringTransactionsForMonth } from "@/services/recurringService";
import { buildRaioX, type RaioXInput } from "@/services/raioXService";
import {
  cardReading, cashFlowReading, categoryReadings, dailyLight, detectDuplicates, detectLeaks, goalReadings,
  impulseReading, incomeCommitment, installmentsReading, monthClose, monthComparison, monthWrap, villain, weekdayPattern,
  weeklySummary, type GoalRow, type RawTx,
} from "@/services/raioXAnalytics";
import {
  buildForecast, correctionPlan, detectAnomalies, invoiceOutlook, monthLessons, nextMonthPlan,
  reserveOutlook, spendingDrift, surplusPlan,
} from "@/services/raioXForecast";
import type { DashboardData } from "@/types/finance";

const HISTORY_MONTHS = 4;

/**
 * Loads everything the Raio-X needs for the real current month (independent of
 * the dashboard month selector) and builds the score, radar and all analyses.
 */
export function useRaioX() {
  const { user } = useAuth();
  const today = useMemo(() => new Date(), []);
  const month = today.getMonth();
  const year = today.getFullYear();

  const { data: current, loading: loadingCurrent } = useFinanceData(month, year);
  const { cards, invoices, installments, loading: loadingCards } = useCardsOverview();

  const [history, setHistory] = useState<DashboardData[] | null>(null);
  const [limits, setLimits] = useState<RaioXInput["limits"]>([]);
  const [recurring, setRecurring] = useState<RaioXInput["recurring"]>([]);
  const [txs, setTxs] = useState<RawTx[]>([]);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [investments, setInvestments] = useState(0);
  const [extrasLoading, setExtrasLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const load = async () => {
      const months = Array.from({ length: HISTORY_MONTHS }, (_, i) => new Date(year, month - (i + 1), 1));
      const since = new Date(year, month - HISTORY_MONTHS, 1).toISOString().slice(0, 10);
      const until = new Date(year, month + 1, 0).toISOString().slice(0, 10);

      const [historyData, limitRows, recurringRows, txRows, goalRows, accountRows] = await Promise.all([
        Promise.all(
          months.map((d) =>
            prefetchDashboardData(d.getMonth(), d.getFullYear(), { includeHistorical: false, userId: user.id }).catch(() => null),
          ),
        ),
        supabase.from("category_limits").select("category, limit_amount").eq("user_id", user.id),
        getRecurringTransactionsForMonth(month, year, user.id).catch(() => []),
        supabase
          .from("transactions")
          .select("id, name, amount, type, category, date, time, status, payment_method, credit_card_id, recurrence_type, installments, installment_current")
          .eq("user_id", user.id)
          .gte("date", since)
          .lte("date", until)
          .limit(5000),
        supabase.from("goals").select("id, name, target_amount, current_amount, deadline, monthly_contribution, created_at").eq("user_id", user.id),
        supabase.from("accounts").select("type, current_balance, is_active").eq("user_id", user.id).eq("type", "investment"),
      ]);
      if (cancelled) return;

      setHistory(historyData.filter((d): d is DashboardData => !!d));
      setLimits((limitRows.data ?? []).map((l) => ({ category: l.category, limit: Number(l.limit_amount) })));
      const seen = new Set<string>();
      setRecurring(
        recurringRows
          .filter((r) => {
            const key = `${r.type}-${r.name}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .map((r) => ({ name: r.name, amount: Number(r.amount), category: r.category, type: r.type })),
      );
      setTxs((txRows.data ?? []).map((t) => ({ ...t, amount: Number(t.amount) })) as RawTx[]);
      setGoals(
        (goalRows.data ?? []).map((g) => ({
          id: g.id, name: g.name, target: Number(g.target_amount), current: Number(g.current_amount ?? 0),
          deadline: g.deadline, monthlyContribution: g.monthly_contribution ? Number(g.monthly_contribution) : null, createdAt: g.created_at,
        })),
      );
      setInvestments((accountRows.data ?? []).filter((a) => a.is_active !== false).reduce((s, a) => s + Math.max(Number(a.current_balance ?? 0), 0), 0));
      setExtrasLoading(false);
    };

    void load();
    const onChange = () => void load();
    window.addEventListener("finance-data-changed", onChange);
    window.addEventListener("transaction-created", onChange);
    return () => {
      cancelled = true;
      window.removeEventListener("finance-data-changed", onChange);
      window.removeEventListener("transaction-created", onChange);
    };
  }, [user, month, year]);

  const loading = loadingCurrent || loadingCards || extrasLoading || history === null;
  const reserve = investments + goals.reduce((s, g) => s + g.current, 0);

  return useMemo(() => {
    if (loading || !history) return { loading: true as const };

    const report = buildRaioX({ today, current, history, limits, cards, invoices, installments, recurring, reserve });

    // Score of each previous month, measured on its last day (oldest first)
    const trend: { month: number; score: number }[] = [];
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].transactions.length === 0) continue;
      const lastDay = new Date(year, month - i, 0);
      trend.push({
        month: lastDay.getMonth(),
        score: buildRaioX({
          today: lastDay, current: history[i], history: history.slice(i + 1), limits, cards,
          invoices: invoices.filter((inv) => inv.year * 12 + inv.month <= lastDay.getFullYear() * 12 + lastDay.getMonth() + 1),
          installments, recurring: [], reserve,
        }).score,
      });
    }
    trend.push({ month, score: report.score });

    const categories = categoryReadings(current, history, limits, today);
    const inst = installmentsReading(installments, today, current.receitas);
    const fixedMonthly = recurring.filter((r) => r.type === "despesa").reduce((s, r) => s + r.amount, 0);
    const avgNet = report.projection.avgNet;

    // Forward-looking layer: day-by-day forecast and everything built on it
    const forecast = buildForecast(current, txs, today);
    const reserveInfo = reserveOutlook(reserve, history, current, recurring, inst.monthly, avgNet);
    const lastMonthRef = new Date(year, month - 1, 15);
    const previousScore = trend.length >= 2 ? trend[trend.length - 2].score : null;

    return {
      loading: false as const,
      today,
      report,
      trend,
      previousScore,
      reserve,
      light: dailyLight(txs, today, current.receitas - current.despesas, report.pulse.daysLeft),
      close: monthClose(current, txs, today),
      commitment: incomeCommitment(current, txs, today, recurring, installments),
      categories,
      villain: villain(categories),
      card: cardReading(txs, today, cards, invoices, current.receitas),
      installments: inst,
      forecast,
      drift: spendingDrift(current, history, txs, today, forecast.endBalance),
      comparison: monthComparison(current, history[0] ?? null, today),
      anomalies: detectAnomalies(current, history, txs, today),
      invoice: invoiceOutlook(cards, invoices, installments, txs, today, current.receitas, forecast.safeToSpend),
      plan: correctionPlan(forecast, current, history, today, recurring),
      reserveInfo,
      nextPlan: nextMonthPlan(history, current, today, recurring, installments, goals),
      surplus: surplusPlan(forecast.endBalance, reserveInfo.coverage, goals.length > 0),
      lessons: monthLessons(txs, current, today),
      fixedMonthly,
      avgNet,
      weekday: weekdayPattern(txs, today),
      cashFlow: cashFlowReading(txs, today),
      leaks: detectLeaks(txs, recurring, today),
      duplicates: detectDuplicates(txs, today),
      impulse: impulseReading(txs, today),
      goals: goalReadings(goals, today),
      weekly: weeklySummary(txs, today),
      wrap: history[0]
        ? monthWrap(history[0], history[1] ?? null, txs, lastMonthRef, previousScore, trend.length >= 3 ? trend[trend.length - 3].score : null)
        : null,
      limits,
      current,
    };
  }, [loading, history, today, current, limits, cards, invoices, installments, recurring, reserve, txs, goals, month, year]);
}

export type RaioXData = Exclude<ReturnType<typeof useRaioX>, { loading: true }>;
