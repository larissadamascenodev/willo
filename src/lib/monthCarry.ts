/**
 * Where a month starts, worked out from the money in the accounts today.
 *
 * The accounts hold one number: everything ever marked as happened. A month's opening
 * is that number walked back (for a month gone by) or forward (for one to come):
 *
 * - this month opens with today's money less what this month has already moved;
 * - a past month opens with today's money less what was paid in every month from it
 *   up to now;
 * - a future month opens with today's money, plus what this month still has to move,
 *   plus everything the months in between are expected to move.
 *
 * One thing has to come off first in every case: money already marked as received or
 * paid for a date after this month (a December salary marked received in November).
 * It is in the accounts, but it belongs to its own month — where it is counted in
 * full — so left in, it was counted twice: once in today's money and again in its month.
 */

export interface MonthFlow {
  /** Everything expected in the month, happened or not. */
  income: number;
  expense: number;
  /** What has already happened. */
  paidIncome: number;
  paidExpense: number;
}

export const paidNet = (f: MonthFlow) => f.paidIncome - f.paidExpense;
export const fullNet = (f: MonthFlow) => f.income - f.expense;
export const pendingNet = (f: MonthFlow) => fullNet(f) - paidNet(f);

export type MonthKind = "past" | "current" | "future";

export function openingBalance(input: {
  kind: MonthKind;
  /** Sum of the accounts now. */
  accountBalance: number;
  /** Already happened, but dated after the current month. */
  paidAhead: number;
  /** The month being opened. */
  target: MonthFlow;
  /** Past: every month after the target, up to and including the current one. */
  after?: MonthFlow[];
  /** Future: the current month. */
  current?: MonthFlow;
  /** Future: the months strictly between the current one and the target. */
  between?: MonthFlow[];
}): number {
  const base = input.accountBalance - input.paidAhead;
  if (input.kind === "current") return base - paidNet(input.target);
  if (input.kind === "past") {
    const later = (input.after ?? []).reduce((s, f) => s + paidNet(f), 0);
    return base - later - paidNet(input.target);
  }
  const still = input.current ? pendingNet(input.current) : 0;
  const ahead = (input.between ?? []).reduce((s, f) => s + fullNet(f), 0);
  return base + still + ahead;
}

/** What is left at the end of a month: what it opened with and all it moved. */
export const closingBalance = (opening: number, f: MonthFlow) => opening + fullNet(f);

/** For a month already over: what was really left, counting only what happened. */
export const closedBalance = (opening: number, f: MonthFlow) => opening + paidNet(f);

/**
 * The money marked as happened for dates after the current month, as the accounts
 * count it: income in, expenses out, card purchases not at all (the invoice carries them).
 */
export function sumPaidAhead(
  rows: { amount: number | string; type: string; payment_method?: string | null; account_id?: string | null }[],
  countedAccounts: Set<string>,
): number {
  let total = 0;
  for (const r of rows) {
    if (!r.account_id || !countedAccounts.has(r.account_id)) continue;
    if (r.payment_method === "cartao") continue;
    if (r.type === "receita") total += Number(r.amount);
    else if (r.type === "despesa") total -= Number(r.amount);
  }
  return total;
}

/**
 * A fixed entry taken out of its own month moves its row to the next month — and it
 * arrives there waiting. It had not happened in that month yet; carried over as
 * received, it went on counting in the accounts with nothing on screen to explain it.
 */
export function shiftSeriesToNextMonth(date: string): { date: string; status: "pendente" } {
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  const next = new Date(y, m, 1);
  const last = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return { date: `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(Math.min(d, last))}`, status: "pendente" };
}
