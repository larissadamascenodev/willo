import { useEffect, useState } from "react";
import {
  buildDashboardCacheKey,
  getCachedDashboardData,
  setCachedDashboardData,
} from "@/services/dashboardData";
import {
  buildCategorySummaries,
  loadCategoryAnalytics,
  type CategoryAnalytics,
} from "@/services/categoryAnalytics";
import type { CategoryExpense, DashboardData } from "@/types/finance";

/**
 * What the screens showed last time, kept on the phone.
 *
 * Opening the app used to wait on the network before any figure appeared: the
 * balance came first and the other cards sat dim until their own reads returned,
 * and the categories page was an empty ring for a moment every time. Now the last
 * figures are drawn at once and the fresh ones replace them when they arrive — the
 * same thing every banking app does, so nothing on the screen is ever blank.
 *
 * Kept in the app's own key/value store (the `localStorage` the shims give the
 * phone), under the signed-in user's id, and forgotten on sign-out.
 */

const DASH = "warm:dash:";
const CATS = "warm:cats:";

const store = () => (globalThis as { localStorage?: Storage }).localStorage;

function read<T>(key: string): T | null {
  try {
    const raw = store()?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    store()?.setItem(key, JSON.stringify(value));
  } catch {
    /* a full store only costs the head start */
  }
}

const monthKey = (userId: string, month: number, year: number) => `${userId}:${year}-${month}`;

/* ── The home's month ── */

/**
 * Puts the month kept on the phone into the dashboard's cache, so the first draw
 * already has it. Returns true when it did, so the caller asks for fresh figures
 * (the cache thinks a seeded month is fresh).
 */
export function seedDashboard(userId: string | undefined, month: number, year: number): boolean {
  if (!userId) return false;
  const key = buildDashboardCacheKey(userId, month, year);
  if (getCachedDashboardData(key)) return false;
  const kept = read<DashboardData>(DASH + monthKey(userId, month, year));
  if (!kept) return false;
  setCachedDashboardData(key, kept);
  return true;
}

export function keepDashboard(userId: string | undefined, month: number, year: number, data: DashboardData) {
  if (!userId) return;
  write(DASH + monthKey(userId, month, year), data);
}

/* ── The categories of a month: one source for the home card and the page ── */

const memory = new Map<string, CategoryAnalytics>();
const inflight = new Map<string, Promise<CategoryAnalytics>>();

function revive(a: CategoryAnalytics): CategoryAnalytics {
  return { ...a, userStartDate: a.userStartDate ? new Date(a.userStartDate as unknown as string) : null };
}

export function cachedCategories(userId: string | undefined, month: number, year: number): CategoryAnalytics | null {
  if (!userId) return null;
  const k = monthKey(userId, month, year);
  const hit = memory.get(k);
  if (hit) return hit;
  const kept = read<CategoryAnalytics>(CATS + k);
  if (!kept) return null;
  const revived = revive(kept);
  memory.set(k, revived);
  return revived;
}

export function fetchCategories(userId: string, month: number, year: number, force = false): Promise<CategoryAnalytics> {
  const k = monthKey(userId, month, year);
  const running = inflight.get(k);
  /* After a write, a read already on its way may predate it: start another. */
  if (running && !force) return running;
  const p = loadCategoryAnalytics({ userId, month, year })
    .then((fresh) => {
      memory.set(k, fresh);
      write(CATS + k, fresh);
      return fresh;
    })
    .finally(() => inflight.delete(k));
  inflight.set(k, p);
  return p;
}

/**
 * A month's categories: what was kept at once, then the fresh read. Read again
 * whenever anything is written, like every other figure in the app.
 */
export function useCategoryAnalytics(userId: string | undefined, month: number, year: number) {
  const [data, setData] = useState<CategoryAnalytics | null>(() => cachedCategories(userId, month, year));

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    setData(cachedCategories(userId, month, year));
    const load = (force: boolean) =>
      fetchCategories(userId, month, year, force)
        .then((fresh) => alive && setData(fresh))
        .catch(() => undefined);
    const onChange = () => void load(true);
    void load(false);
    window.addEventListener("finance-data-changed", onChange);
    return () => {
      alive = false;
      window.removeEventListener("finance-data-changed", onChange);
    };
  }, [userId, month, year]);

  return data;
}

/** The categories as the home's cards read them, from the same arithmetic as the page. */
export function asCategoryExpenses(data: CategoryAnalytics | null): CategoryExpense[] | null {
  if (!data) return null;
  return buildCategorySummaries(data.transactions).map((c) => ({ name: c.name, amount: c.amount, color: "", icon: "" }));
}

/* ── Any other card's last reading ── */

const OTHER = "warm:card:";

/** What a card showed last time for this user, or null. */
export function keptValue<T>(name: string, userId: string | null | undefined): T | null {
  return userId ? read<T>(`${OTHER}${name}:${userId}`) : null;
}

export function keepValue(name: string, userId: string | null | undefined, value: unknown) {
  if (userId) write(`${OTHER}${name}:${userId}`, value);
}

/** Signing out leaves nothing of the account's figures on the phone. */
export function forgetWarmStart() {
  memory.clear();
  const s = store();
  if (!s) return;
  const keys: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i);
    if (k && (k.startsWith(DASH) || k.startsWith(CATS) || k.startsWith(OTHER))) keys.push(k);
  }
  keys.forEach((k) => s.removeItem(k));
}
