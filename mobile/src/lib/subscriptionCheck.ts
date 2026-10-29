import { useCallback, useEffect, useState } from "react";
import { supabase } from "~/supabase/client";
import {
  excludeRecurringFromMonthOnward,
  getRecurringSourceId,
  getRecurringTransactionsForMonth,
} from "@/services/recurringService";
import { isSubscription } from "@/lib/subscriptionBrands";

/**
 * A subscription that was not charged.
 *
 * A subscription is expected every month, and the app writes it into the month on its
 * own — so it can never notice by itself that one has stopped. What it can do is look at
 * the month that has just closed and ask whether the charge actually turned up: a line
 * with the same name among that month's real movements (the invoice, the account). When
 * none did, the question goes to the person, who knows: still subscribed, or cancelled.
 *
 * Nothing here adds a movement. "Yes" only remembers, on this phone, that the month was
 * looked at, so it is not asked again; "No" takes the subscription out of that month and
 * every month after it, exactly as removing it from a month onward does anywhere else.
 */

export interface EndedSubscription {
  /** The fixed entry the exclusion is recorded against. */
  sourceId: string;
  name: string;
  amount: number;
  /** The month that closed without it, 0-based. */
  month: number;
  year: number;
}

const ACK_KEY = "subscription-acks";

const pad = (n: number) => String(n).padStart(2, "0");
const ackId = (e: Pick<EndedSubscription, "sourceId" | "month" | "year">) => `${e.sourceId}:${e.year}-${e.month}`;

const readAcks = (): string[] => {
  try {
    const raw = localStorage.getItem(ACK_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
};

const rememberAck = (e: EndedSubscription) => {
  try {
    localStorage.setItem(ACK_KEY, JSON.stringify([...readAcks(), ackId(e)].slice(-200)));
  } catch {
    /* Asked again next time; nothing is lost. */
  }
};

/** Names compared the way a person would: no accents, no punctuation, no case. */
const plain = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const sameThing = (a: string, b: string) => {
  const x = plain(a);
  const y = plain(b);
  return x.length >= 3 && y.length >= 3 && (x.includes(y) || y.includes(x));
};

export async function findEndedSubscriptions(userId: string, today = new Date()): Promise<EndedSubscription[]> {
  const closed = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const month = closed.getMonth();
  const year = closed.getFullYear();

  const start = `${year}-${pad(month + 1)}-01`;
  const end = `${year}-${pad(month + 1)}-${pad(new Date(year, month + 1, 0).getDate())}`;

  const [expected, real] = await Promise.all([
    getRecurringTransactionsForMonth(month, year, userId),
    supabase.from("transactions").select("name").eq("user_id", userId).gte("date", start).lte("date", end),
  ]);
  if (real.error) throw real.error;

  const charged = (real.data ?? []).map((r: { name: string }) => r.name);
  const acks = new Set(readAcks());

  const seen = new Set<string>();
  const out: EndedSubscription[] = [];
  for (const tx of expected) {
    if (tx.type !== "despesa") continue;
    if (!(tx.payment_method === "cartao" || isSubscription(tx.name))) continue;

    const sourceId = getRecurringSourceId(tx);
    if (seen.has(sourceId)) continue;
    seen.add(sourceId);

    /* The line a series is made of counts as its first charge; after that the month
       has to show one of its own. */
    const virtual = (tx as { _isRecurringMaterialized?: boolean })._isRecurringMaterialized;
    if (!virtual) continue;
    if (charged.some((name) => sameThing(name, tx.name))) continue;

    const item = { sourceId, name: tx.name, amount: Number(tx.amount), month, year };
    if (acks.has(ackId(item))) continue;
    out.push(item);
  }
  return out;
}

export function useEndedSubscriptions(userId: string | undefined) {
  const [ended, setEnded] = useState<EndedSubscription[]>([]);

  const load = useCallback(async () => {
    if (!userId) {
      setEnded([]);
      return;
    }
    try {
      setEnded(await findEndedSubscriptions(userId));
    } catch {
      setEnded([]);
    }
  }, [userId]);

  useEffect(() => {
    void load();
    const onChange = () => void load();
    window.addEventListener("finance-data-changed", onChange);
    return () => window.removeEventListener("finance-data-changed", onChange);
  }, [load]);

  /** Still subscribed: remembered, and the question goes away. */
  const keep = useCallback((e: EndedSubscription) => {
    rememberAck(e);
    setEnded((list) => list.filter((x) => ackId(x) !== ackId(e)));
  }, []);

  /** Cancelled: out of the month it missed and every month after. */
  const cancel = useCallback(
    async (e: EndedSubscription) => {
      if (!userId) return;
      await excludeRecurringFromMonthOnward(e.sourceId, e.month, e.year, userId);
      rememberAck(e);
      setEnded((list) => list.filter((x) => ackId(x) !== ackId(e)));
      window.dispatchEvent(new CustomEvent("finance-data-changed"));
    },
    [userId],
  );

  return { ended, keep, cancel };
}
