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
export function useFinancialProjection() {
  const { selectedMonth, selectedYear } = useMonth();
  const { user } = useAuth();
  const { data, loading, refetch } = useFinanceData(selectedMonth, selectedYear, { includeHistorical: true });

  const [savingsBoost, setSavingsBoost] = useState(0);
  const [incomeBoost, setIncomeBoost] = useState(0);
  const [savingsGoal, setSavingsGoal] = useState(0);

  // Per-month data for future months — streamed progressively
  const [monthDataMap, setMonthDataMap] = useState<Map<string, DashboardData>>(new Map());
  /* Until every future month has arrived, the projection fills the gaps with the
     three-month average and swaps each one for the real figure as it lands — so a
     screen that draws straight away shows its numbers jumping several times. This
     says when the jumping is over, for a screen that would rather wait. */
  const [futureReady, setFutureReady] = useState(false);
  const loadingRef = useRef(false);
  const batchKeyRef = useRef("");

  // Load real data for future months progressively (no blocking)
  useEffect(() => {
    /* Without a session there is nothing ahead to wait for. */
    if (!user) {
      setFutureReady(true);
      return;
    }
    if (loading) return;
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

    // Stream results as they arrive — each month updates the map immediately.
    // Each month is fetched once; the same requests are what "all settled" waits
    // on, rather than asking the database for every month a second time.
    const requests = months.map(({ m, y }) =>
      buildDashboardData(m, y, { includeHistorical: false, userId: user.id }).then((result) => {
        if (batchKeyRef.current !== batchKey) return;
        setMonthDataMap((prev) => {
          const next = new Map(prev);
          next.set(`${m}-${y}`, result);
          return next;
        });
      }),
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
    /** A whole month's data, keyed "month-year", for the months ahead. Already
        fetched to build the projection, so reading it costs nothing more. */
    monthData: monthDataMap,
    /** Every month ahead has arrived, so the projection is real figures and no
        longer the average standing in for them. */
    futureReady,
  };
}
