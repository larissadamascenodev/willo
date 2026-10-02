import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useMonth } from "@/contexts/MonthContext";
import { useFinanceData, buildDashboardData } from "@/hooks/useFinanceData";
import { useAuth } from "@/contexts/AuthContext";
import type { DashboardData } from "@/types/finance";
import {
  getMonthlyProjection,
  getDailyLimit,
  getSimulation,
  getFinancialScore,
  getInsight,
  invalidateProjectionCache,
  type SimulationParams,
} from "@/services/projection";

/**
 * React hook that wires the financial projection engine to live data.
 * Loads real financial data for each future month (recurring/scheduled transactions).
 */
export function useFinancialProjection(anchor?: { month: number; year: number }) {
  const ctx = useMonth();
  // A screen that always speaks about "now" passes its own month instead of following the picker
  const selectedMonth = anchor?.month ?? ctx.selectedMonth;
  const selectedYear = anchor?.year ?? ctx.selectedYear;
  const { user } = useAuth();
  const { data, loading, refetch } = useFinanceData(selectedMonth, selectedYear, { includeHistorical: true });

  const [savingsBoost, setSavingsBoost] = useState(0);
  const [incomeBoost, setIncomeBoost] = useState(0);
  const [savingsGoal, setSavingsGoal] = useState(0);

  // Per-month data for future months — streamed progressively
  const [monthDataMap, setMonthDataMap] = useState<Map<string, DashboardData>>(new Map());
  // True once every future month has answered (or failed), so a screen can stop showing placeholders
  const [futureReady, setFutureReady] = useState(false);
  const loadingRef = useRef(false);
  const batchKeyRef = useRef("");

  // Load real data for future months progressively (no blocking)
  useEffect(() => {
    if (!user || loading) return;
    const batchKey = `${user.id}-${selectedMonth}-${selectedYear}`;
    if (loadingRef.current && batchKeyRef.current === batchKey) return;
    loadingRef.current = true;
    batchKeyRef.current = batchKey;

    // Reset map for new month selection
    setMonthDataMap(new Map());
    setFutureReady(false);

    const months: { m: number; y: number }[] = [];
    for (let i = 1; i < 12; i++) {
      const d = new Date(selectedYear, selectedMonth + i, 1);
      months.push({ m: d.getMonth(), y: d.getFullYear() });
    }

    // One request per month: each result lands in the map as soon as it arrives
    const requests = months.map(({ m, y }) =>
      buildDashboardData(m, y, { includeHistorical: false, userId: user.id })
        .then((result) => {
          if (batchKeyRef.current !== batchKey) return;
          setMonthDataMap((prev) => {
            const next = new Map(prev);
            next.set(`${m}-${y}`, result);
            return next;
          });
        })
        .catch(() => {})
    );

    Promise.allSettled(requests).then(() => {
      if (batchKeyRef.current !== batchKey) return;
      loadingRef.current = false;
      setFutureReady(true);
    });
  }, [user, loading, selectedMonth, selectedYear]);

  const params: SimulationParams = useMemo(
    () => ({ savingsBoost, incomeBoost }),
    [savingsBoost, incomeBoost]
  );

  const projections = useMemo(
    () => getMonthlyProjection(data, selectedMonth, selectedYear, params, monthDataMap),
    [data, selectedMonth, selectedYear, params, monthDataMap]
  );

  const dailyLimit = useMemo(
    () => getDailyLimit(data, selectedMonth, selectedYear, savingsGoal),
    [data, selectedMonth, selectedYear, savingsGoal]
  );

  const simulation = useMemo(
    () => getSimulation(data, selectedMonth, selectedYear, params),
    [data, selectedMonth, selectedYear, params]
  );

  const healthScore = useMemo(
    () => getFinancialScore(data, projections),
    [data, projections]
  );

  const insight = useMemo(
    () => getInsight(data, projections),
    [data, projections]
  );

  const resetSimulation = useCallback(() => {
    setSavingsBoost(0);
    setIncomeBoost(0);
  }, []);

  const refreshAll = useCallback(async () => {
    invalidateProjectionCache();
    loadingRef.current = false;
    await refetch();
  }, [refetch]);

  return {
    data,
    loading,
    monthDataMap,
    futureReady,
    projections,
    dailyLimit,
    simulation,
    healthScore,
    insight,
    savingsBoost,
    setSavingsBoost,
    incomeBoost,
    setIncomeBoost,
    savingsGoal,
    setSavingsGoal,
    resetSimulation,
    refreshAll,
    selectedMonth,
    selectedYear,
  };
}
