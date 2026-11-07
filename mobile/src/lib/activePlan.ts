import { useSyncExternalStore } from "react";
import type { MethodId } from "@/lib/plan/financialPlan";

/**
 * The plan the person chose. Only they change it: recommendations are recalculated as
 * the numbers move, but the active plan stays until they pick another. Kept on the phone
 * until the plan has its own table, with the date it was chosen for the history.
 */

export interface ActivePlan {
  method: MethodId;
  since: string;
}

const KEY = "willo-active-plan";
const listeners = new Set<() => void>();

const read = (): ActivePlan | null => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ActivePlan) : null;
  } catch {
    return null;
  }
};

let current = read();

export function setActivePlan(method: MethodId | null) {
  current = method ? { method, since: new Date().toISOString().slice(0, 10) } : null;
  try {
    if (current) localStorage.setItem(KEY, JSON.stringify(current));
    else localStorage.removeItem(KEY);
  } catch {
    /* Kept for this session only. */
  }
  listeners.forEach((l) => l());
}

export function useActivePlan(): ActivePlan | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => current,
  );
}

/* Whether Willo may warn about the plan on the phone (on unless turned off). */
const ALERTS_KEY = "willo-plan-alerts";
export function planAlertsWanted(): boolean {
  try {
    return localStorage.getItem(ALERTS_KEY) !== "0";
  } catch {
    return true;
  }
}
export function setPlanAlertsWanted(on: boolean) {
  try {
    localStorage.setItem(ALERTS_KEY, on ? "1" : "0");
  } catch {
    /* Kept for this session only. */
  }
}
/** The plan chosen, read once, for code that is not a screen. */
export const readActivePlan = () => current;
