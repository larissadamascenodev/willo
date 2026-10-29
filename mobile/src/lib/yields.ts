import { supabase } from "~/supabase/client";
import { YIELD_SOURCE, type Goal } from "@/services/goalService";

/**
 * What a caixinha earns.
 *
 * The yield itself is worked out on the server, never here: the Banco Central's CDI is
 * copied into the database by a function that holds the only key allowed to write it,
 * and a database function adds each business day to the caixinha exactly once. All this
 * does is ask for both to be up to date when the person opens the app — so a week away
 * is caught up in one go — and read the results back to show them.
 *
 * Every figure shown from the rate is an estimate, gross of tax.
 */

/* Business days in a month and in a year, the way the market counts them. */
const DAYS_MONTH = 21;
const DAYS_YEAR = 252;
const CHECK_KEY = "yields-checked";
const CHECK_EVERY_MS = 3 * 60 * 60 * 1000;
const RETRY_MS = 10 * 60 * 1000;

// The rate tables are newer than the generated types.
const db = supabase as unknown as { from: (t: string) => any; rpc: (f: string) => any; functions: { invoke: (n: string) => Promise<{ error: unknown }> } };

export const earns = (g: Pick<Goal, "yield_type" | "yield_percent">) => g.yield_type === "cdi" && Number(g.yield_percent) > 0;

/** The latest daily CDI, in percent per day, or null when none is stored yet. */
export async function latestCdi(): Promise<{ date: string; rate: number } | null> {
  try {
    const { data } = await db.from("cdi_rates").select("date, daily_rate").order("date", { ascending: false }).limit(1);
    const row = data?.[0];
    return row ? { date: row.date as string, rate: Number(row.daily_rate) } : null;
  } catch {
    return null;
  }
}

export interface Estimate {
  day: number;
  month: number;
  year: number;
}

/** What a balance is expected to earn at a share of the CDI, compounding on business days. */
export function estimate(balance: number, dailyRate: number, percent: number): Estimate {
  const f = (dailyRate / 100) * (percent / 100);
  const over = (days: number) => balance * (Math.pow(1 + f, days) - 1);
  return { day: balance * f, month: over(DAYS_MONTH), year: over(DAYS_YEAR) };
}

/** Everything credited as yield so far, for all of the person's caixinhas, or one. */
export async function yieldEarned(userId: string, goalId?: string): Promise<number> {
  try {
    let q = db.from("goal_transactions").select("amount").eq("user_id", userId).eq("source", YIELD_SOURCE);
    if (goalId) q = q.eq("goal_id", goalId);
    const { data } = await q;
    return ((data ?? []) as { amount: number }[]).reduce((s, r) => s + Number(r.amount), 0);
  } catch {
    return 0;
  }
}

const readChecked = (): number => {
  try {
    return Number(localStorage.getItem(CHECK_KEY)) || 0;
  } catch {
    return 0;
  }
};

/**
 * Brings the rates and the caixinhas up to date. Quietly a no-op when nothing earns, when
 * it was done a few hours ago, or when the server cannot be reached — the next opening
 * simply tries again. Resolves true when something was credited.
 */
export async function catchUpYields(goals: Goal[], force = false): Promise<boolean> {
  if (!goals.some(earns)) return false;
  if (!force && Date.now() - readChecked() < CHECK_EVERY_MS) return false;

  /* A failed try is retried in ten minutes rather than on every screen that asks. */
  const mark = (ok: boolean) => {
    try {
      localStorage.setItem(CHECK_KEY, String(ok ? Date.now() : Date.now() - CHECK_EVERY_MS + RETRY_MS));
    } catch {
      /* Checked again next time; nothing is lost. */
    }
  };

  try {
    await db.functions.invoke("sync-cdi");
    const { data, error } = await db.rpc("apply_my_yields");
    mark(!error);
    return !error && Number(data) > 0;
  } catch {
    mark(false);
    return false;
  }
}
