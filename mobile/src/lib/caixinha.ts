import { isReserveGoal } from "@/services/goalService";

/**
 * A cofrinho and a goal are the same thing.
 *
 * Money moved into one leaves the account's balance but stays the person's own, which
 * is exactly what a goal's deposit already does — so there is one table, and this is
 * only how the two screens read it: how long is left, and what that asks of each month.
 */

interface Saving {
  name: string;
  target_amount: number;
  current_amount: number;
  monthly_contribution: number | null;
  deadline: string | null;
}

const iso = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/** The day, `months` from now — what "em 12 meses" is stored as. */
export function deadlineIn(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + Math.max(1, Math.round(months)));
  return iso(d);
}

/** Whole months from today to a stored date; at least one while it is still ahead. */
export function monthsUntil(deadline: string): number {
  const end = new Date(`${deadline}T12:00:00`);
  const now = new Date();
  const apart = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
  const months = apart + (end.getDate() > now.getDate() ? 1 : 0);
  if (months > 0) return months;
  return end.getTime() > now.getTime() ? 1 : 0;
}

/** "jul 2027". */
export function monthYear(deadline: string): string {
  return new Date(`${deadline}T12:00:00`)
    .toLocaleDateString("pt-BR", { month: "short", year: "numeric" })
    .replace(".", "");
}

/** What it takes each month to arrive: the rest, over the months left. */
export function monthlyNeeded(remaining: number, months: number): number {
  if (remaining <= 0 || months <= 0) return 0;
  return Math.ceil((remaining / months) * 100) / 100;
}

export interface Pace {
  /** The reserve has no date; it is filled as you go. */
  open: boolean;
  /** Months to the deadline, when there is one. */
  months: number;
  /** What to put in each month to arrive on the date. */
  monthly: number;
  late: boolean;
}

export function paceOf(goal: Saving): Pace {
  const open = isReserveGoal(goal) || !goal.deadline;
  const remaining = Math.max(goal.target_amount - goal.current_amount, 0);
  if (open || remaining <= 0) return { open, months: 0, monthly: 0, late: false };
  const months = monthsUntil(goal.deadline as string);
  return {
    open,
    months,
    monthly: months > 0 ? monthlyNeeded(remaining, months) : remaining,
    late: months === 0,
  };
}
