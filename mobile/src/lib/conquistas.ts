import { supabase } from "@/integrations/supabase/client";
import { achievements, isoDay, streakOf, type Tx } from "~/lib/challenges";
import { medalsOf, type Medal } from "~/lib/medals";
import { FEATURES } from "~/lib/features";

/**
 * Conquistas e sequência, on their own.
 *
 * The sequence is the run of days in a row with something written down in Willo — the
 * same count as the "Constância" medals — kept alive until the end of today: a run
 * that reached yesterday still stands this morning, and today's first entry carries
 * it on. The medals are the ones worked out from the person's own data; the
 * challenges' own medals stay out while the challenges are put away.
 */

export interface StreakDay {
  iso: string;
  /** One letter: D S T Q Q S S. */
  label: string;
  done: boolean;
  today: boolean;
}

export interface Conquistas {
  medals: Medal[];
  streak: {
    /** Days in a row up to today, or up to yesterday while today is still open. */
    current: number;
    best: number;
    /** Something already written down today. */
    todayDone: boolean;
    /** The last seven days, oldest first, ending today. */
    week: StreakDay[];
    /** The next "Constância" medal, while there is one to win. */
    next: Medal | null;
  };
}

const LETTER = ["D", "S", "T", "Q", "Q", "S", "S"];

async function fetchConquistas(userId: string): Promise<Conquistas> {
  const [txRes, invRes, goalRes, accRes, cardRes, catRes, loginRes] = await Promise.all([
    supabase.from("transactions").select("id, name, category, type, status, payment_method, credit_card_id, created_at, date, amount, recurrence_type, observation, installments, installment_current").eq("user_id", userId).order("date", { ascending: false }).limit(5000),
    supabase.from("invoices").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("is_paid", true),
    supabase.from("goals").select("current_amount, target_amount, created_at").eq("user_id", userId),
    supabase.from("accounts").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("credit_cards").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("custom_categories").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("login_days").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ]);
  if (txRes.error) throw txRes.error;
  const txs = (txRes.data ?? []) as Tx[];

  const list = achievements({
    txs,
    paidInvoices: invRes.count ?? 0,
    goals: (goalRes.data ?? []) as { current_amount: number; target_amount: number; created_at?: string }[],
    finished: [],
    checkins: [],
    accounts: accRes.count ?? 0,
    cards: cardRes.count ?? 0,
    customCategories: catRes.count ?? 0,
    loginDays: loginRes.count ?? 0,
  });
  const medals = medalsOf(list).filter((m) => FEATURES.desafios || m.group !== "Desafios");

  /* The days something was written down, on the phone's own clock. */
  const days = txs.map((t) => isoDay(new Date(t.created_at)));
  const written = new Set(days);
  const { streak, best } = streakOf(days);
  const now = new Date();
  const today = isoDay(now);
  const week: StreakDay[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
    const iso = isoDay(d);
    return { iso, label: LETTER[d.getDay()], done: written.has(iso), today: iso === today };
  });
  const next = medals.find((m) => m.family === "streak" && !m.earned) ?? null;

  return { medals, streak: { current: streak, best, todayDone: written.has(today), week, next } };
}

/* The home tile and the page ask within moments of each other: one load serves both. */
let cached: { userId: string; at: number; p: Promise<Conquistas> } | null = null;

export function loadConquistas(userId: string, fresh = false): Promise<Conquistas> {
  if (!fresh && cached && cached.userId === userId && Date.now() - cached.at < 30_000) return cached.p;
  const p = fetchConquistas(userId);
  cached = { userId, at: Date.now(), p };
  p.catch(() => {
    if (cached?.p === p) cached = null;
  });
  return p;
}

/** "5 dias seguidos", "1 dia seguido". */
export const daysInARow = (n: number) => `${n} ${n === 1 ? "dia seguido" : "dias seguidos"}`;
