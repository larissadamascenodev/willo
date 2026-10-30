import { useCallback, useEffect, useState } from "react";
import { buildProfile, planMethods, type MethodPlan, type PlanMonth, type Profile } from "@/lib/plan/financialPlan";
import { loadPlanInputs } from "@/services/financialPlan";

/** The plan page's data: the profile, every method over it, and this month so far. */
export function usePlan() {
  const [state, setState] = useState<{ loading: boolean; profile: Profile | null; methods: MethodPlan[]; current: PlanMonth | null }>({
    loading: true,
    profile: null,
    methods: [],
    current: null,
  });

  const load = useCallback(async () => {
    try {
      const inputs = await loadPlanInputs();
      /* Whole past months first; someone who started this month has only this month to go on. */
      const past = buildProfile(inputs);
      const profile = past && past.incomeAvg > 0 ? past : buildProfile({ months: [...inputs.months, inputs.current].filter((m) => m.income > 0), saved: inputs.saved });
      setState({ loading: false, profile, methods: profile ? planMethods(profile) : [], current: inputs.current });
    } catch {
      setState({ loading: false, profile: null, methods: [], current: null });
    }
  }, []);

  useEffect(() => {
    void load();
    const again = () => void load();
    window.addEventListener("finance-data-changed", again);
    window.addEventListener("transaction-created", again);
    return () => {
      window.removeEventListener("finance-data-changed", again);
      window.removeEventListener("transaction-created", again);
    };
  }, [load]);

  return state;
}
