import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { invalidateProjectionCache } from "@/services/projection";
import { useAuth } from "@/contexts/AuthContext";
import type { DashboardData } from "@/types/finance";
import {
  EMPTY_DASHBOARD_DATA,
  type FinanceDataOptions,
  buildDashboardCacheKey,
  clearDashboardCache,
  getCachedDashboardData,
  prefetchDashboardData,
} from "@/services/dashboardData";

function offsetMonth(month: number, year: number, offset: number) {
  const d = new Date(year, month + offset, 1);
  return { month: d.getMonth(), year: d.getFullYear() };
}

function prefetchMonth(userId: string, month: number, year: number) {
  void prefetchDashboardData(month, year, { includeHistorical: false, userId }).catch(() => {});
}

export function useFinanceData(selectedMonth: number, selectedYear: number, options?: FinanceDataOptions) {
  const { user, loading: authLoading } = useAuth();
  const includeHistorical = options?.includeHistorical ?? false;
  const cacheKey = buildDashboardCacheKey(user?.id, selectedMonth, selectedYear);
  const activeKeyRef = useRef(cacheKey);
  /* Whose figures are on screen: another account's are never shown while this one's load. */
  const shownUserRef = useRef(user?.id ?? null);
  const [data, setData] = useState<DashboardData>(() => getCachedDashboardData(cacheKey) ?? EMPTY_DASHBOARD_DATA);
  const [loading, setLoading] = useState(() => authLoading || !getCachedDashboardData(cacheKey));

  useEffect(() => {
    activeKeyRef.current = cacheKey;
    let cancelled = false;

    if (authLoading) {
      setLoading(true);
      return () => { cancelled = true; };
    }

    if (!user) {
      setData(EMPTY_DASHBOARD_DATA);
      setLoading(false);
      return () => { cancelled = true; };
    }

    // Stale-while-revalidate: show cached data immediately, refresh in background
    const cached = getCachedDashboardData(cacheKey);
    if (cached) {
      setData(cached);
      setLoading(false);
      // Still refresh in background but don't show loading
    } else {
      if (shownUserRef.current !== user.id) setData(EMPTY_DASHBOARD_DATA);
      setLoading(true);
    }
    shownUserRef.current = user.id;

    // Single prefetch call — the service handles base vs historical splitting internally
    prefetchDashboardData(selectedMonth, selectedYear, {
      includeHistorical,
      userId: user.id,
    })
      .then((newData) => {
        if (!cancelled && activeKeyRef.current === cacheKey) {
          setData(newData);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Finance engine error:", err);
        if (!cancelled && activeKeyRef.current === cacheKey) {
          setLoading(false);
        }
      });

    // Prefetch adjacent months after a short delay
    const timer = setTimeout(() => {
      for (const offset of [-1, 1]) {
        const m = offsetMonth(selectedMonth, selectedYear, offset);
        prefetchMonth(user.id, m.month, m.year);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [authLoading, cacheKey, user, selectedMonth, selectedYear, includeHistorical]);

  const refetch = useCallback(async () => {
    if (!user) return;
    try {
      clearDashboardCache();
      invalidateProjectionCache();

      const newData = await prefetchDashboardData(selectedMonth, selectedYear, {
        includeHistorical,
        userId: user.id,
      });
      const key = buildDashboardCacheKey(user.id, selectedMonth, selectedYear);

      if (activeKeyRef.current === key) {
        setData(newData);
        setLoading(false);
      }
    } catch (err) {
      console.error("Finance engine error:", err);
    }
  }, [user, selectedMonth, selectedYear, includeHistorical]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`finance-realtime`)
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions", filter: `user_id=eq.${user.id}` }, () => refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "finance_events", filter: `user_id=eq.${user.id}` }, () => refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "accounts", filter: `user_id=eq.${user.id}` }, () => refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "invoices", filter: `user_id=eq.${user.id}` }, () => refetch())
      .subscribe();

    const handleFinanceChange = () => refetch();
    window.addEventListener("finance-data-changed", handleFinanceChange);

    return () => {
      window.removeEventListener("finance-data-changed", handleFinanceChange);
      supabase.removeChannel(channel);
    };
  }, [user, refetch]);

  return { data, loading, refetch };
}

export { buildDashboardData } from "@/services/dashboardData";
