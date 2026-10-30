import { supabase } from "@/integrations/supabase/client";

import { currencySymbol } from "@/lib/currency";
import { notifyFinanceDataChanged } from "@/services/transactionService";

/** The emergency reserve is a goal with this reserved name; every other goal is a "cofrinho". */
export const RESERVE_NAME = "Reserva de emergência";
const normalizeGoalName = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
export const isReserveGoal = (goal: { name: string }) => normalizeGoalName(goal.name) === normalizeGoalName(RESERVE_NAME);

export interface Goal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  monthly_contribution: number | null;
  deadline: string | null;
  cover_image: string | null;
  /** Null when the goal does not earn anything; `cdi` earns a share of the CDI. */
  yield_type?: "cdi" | null;
  /** The share of the CDI it earns, in percent: 100, 104, 115… */
  yield_percent?: number | null;
  created_at: string;
  updated_at: string;
}

/** What a yield line is called in a goal's history. */
export const YIELD_SOURCE = "Rendimento estimado";

export interface GoalTransaction {
  id: string;
  goal_id: string;
  user_id: string;
  amount: number;
  date: string;
  source: string | null;
  account_id: string | null;
  created_at: string;
}

export async function fetchGoals(): Promise<Goal[]> {
  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Goal[];
}

export async function fetchGoalById(id: string): Promise<Goal> {
  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as Goal;
}

export async function createGoal(goal: {
  name: string;
  target_amount: number;
  monthly_contribution?: number | null;
  deadline?: string | null;
  cover_image?: string | null;
  yield_type?: "cdi" | null;
  yield_percent?: number | null;
}, userId: string): Promise<Goal> {
  const { data, error } = await supabase
    .from("goals")
    .insert({
      user_id: userId,
      name: goal.name,
      target_amount: goal.target_amount,
      monthly_contribution: goal.monthly_contribution ?? null,
      deadline: goal.deadline ?? null,
      cover_image: goal.cover_image ?? null,
      /* Only sent when there is a yield, so a goal without one is written exactly as before. */
      ...(goal.yield_type ? { yield_type: goal.yield_type, yield_percent: goal.yield_percent ?? 100 } : {}),
    } as any)
    .select()
    .single();
  if (error) throw error;
  return data as Goal;
}

export async function updateGoal(id: string, updates: Partial<{
  name: string;
  target_amount: number;
  monthly_contribution: number | null;
  deadline: string | null;
  cover_image: string | null;
  yield_type: "cdi" | null;
  yield_percent: number | null;
}>): Promise<void> {
  const { error } = await supabase.from("goals").update(updates as any).eq("id", id);
  if (error) throw error;
}

export async function deleteGoal(id: string): Promise<void> {
  const { error } = await supabase.from("goals").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchGoalTransactions(goalId: string): Promise<GoalTransaction[]> {
  const { data, error } = await supabase
    .from("goal_transactions")
    .select("*")
    .eq("goal_id", goalId)
    .order("date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as GoalTransaction[];
}

/**
 * Creates a goal deposit AND a corresponding expense transaction to deduct from the account.
 * This works like investments — money leaves the available balance but stays in patrimony.
 */
export async function createGoalDeposit(deposit: {
  goal_id: string;
  amount: number;
  date: string;
  source?: string | null;
  account_id?: string;
}, userId: string): Promise<GoalTransaction> {
  // 1. Create the goal transaction
  const { data, error } = await supabase
    .from("goal_transactions")
    .insert({
      goal_id: deposit.goal_id,
      user_id: userId,
      amount: deposit.amount,
      date: deposit.date,
      source: deposit.source ?? null,
      account_id: deposit.account_id ?? null,
    } as any)
    .select()
    .single();
  if (error) throw error;

  // 2. Create a debit transaction on the account (like investments)
  if (deposit.account_id) {
    // Fetch goal name for the transaction description
    const { data: goalData } = await supabase
      .from("goals")
      .select("name")
      .eq("id", deposit.goal_id)
      .single();

    const goalName = goalData?.name ?? "Meta";

    const { error: debitError } = await supabase.from("transactions").insert({
      user_id: userId,
      name: `Aporte: ${goalName}`,
      category: "Meta",
      date: deposit.date,
      amount: deposit.amount,
      type: "investimento",
      status: "pago",
      payment_method: "conta",
      recurrence_type: "unica",
      account_id: deposit.account_id,
      observation: `Reserva para meta "${goalName}"`,
    });

    // Without the debit the money would sit in the goal AND in the balance at the
    // same time, so the deposit is rolled back rather than left half-recorded.
    if (debitError) {
      await supabase.from("goal_transactions").delete().eq("id", (data as GoalTransaction).id);
      throw debitError;
    }
  }

  /* The debit above moved an account's balance; the cached list of accounts has to know. */
  notifyFinanceDataChanged();
  return data as GoalTransaction;
}

export async function deleteGoalDeposit(id: string): Promise<void> {
  const { error } = await supabase.from("goal_transactions").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Withdraw from a goal — creates a negative goal_transaction and optionally a revenue transaction on the destination account.
 */
export async function createGoalWithdraw(withdraw: {
  goal_id: string;
  amount: number;
  date: string;
  account_id?: string;
  destination?: string;
}, userId: string): Promise<GoalTransaction> {
  // 1. Create a negative goal transaction
  const { data, error } = await supabase
    .from("goal_transactions")
    .insert({
      goal_id: withdraw.goal_id,
      user_id: userId,
      amount: -withdraw.amount,
      date: withdraw.date,
      source: withdraw.destination ?? null,
      account_id: withdraw.account_id ?? null,
    } as any)
    .select()
    .single();
  if (error) throw error;

  // 2. If returning to a user account, create a revenue transaction
  if (withdraw.account_id) {
    const { data: goalData } = await supabase
      .from("goals")
      .select("name")
      .eq("id", withdraw.goal_id)
      .single();

    const goalName = goalData?.name ?? "Meta";

    await supabase.from("transactions").insert({
      user_id: userId,
      name: `Saque: ${goalName}`,
      category: "Meta",
      date: withdraw.date,
      amount: withdraw.amount,
      type: "receita",
      status: "pago",
      payment_method: "conta",
      recurrence_type: "unica",
      account_id: withdraw.account_id,
      observation: `Saque da meta "${goalName}"`,
    });
  }

  notifyFinanceDataChanged();
  return data as GoalTransaction;
}

/**
 * The account entry a goal movement made when it happened: the "Aporte" debit of a
 * deposit, or the "Saque" credit of a withdrawal. Matched on what they share — account,
 * amount, day and kind — and on the name's prefix, since the goal may have been renamed.
 */
async function findMovementEntry(
  move: GoalTransaction,
  kind: { type: "investimento" | "receita"; prefix: string }
): Promise<string | null> {
  if (!move.account_id) return null;
  const { data } = await supabase
    .from("transactions")
    .select("id")
    .eq("account_id", move.account_id)
    .eq("type", kind.type)
    .eq("category", "Meta")
    .eq("date", move.date)
    .eq("amount", Math.abs(Number(move.amount)))
    .ilike("name", `${kind.prefix}%`)
    .limit(1);
  return (data?.[0] as { id: string } | undefined)?.id ?? null;
}

/**
 * Delete a goal deposit and give the money back to the account it came from.
 *
 * The deposit's own debit is removed, so the account is as it was and nothing new is
 * recorded. Only when that debit cannot be found is a refund written instead — and as a
 * movement between the person's own money, not as income, so the month's receitas are
 * not inflated by money that was always theirs.
 */
export async function deleteGoalDepositWithRefund(
  deposit: GoalTransaction,
  userId: string,
  goalName: string
): Promise<void> {
  const entry = deposit.account_id && Number(deposit.amount) > 0
    ? await findMovementEntry(deposit, { type: "investimento", prefix: "Aporte:" })
    : null;

  const { error } = await supabase.from("goal_transactions").delete().eq("id", deposit.id);
  if (error) throw error;

  if (entry) {
    await supabase.from("transactions").delete().eq("id", entry);
  } else if (deposit.account_id && Number(deposit.amount) > 0) {
    await supabase.from("transactions").insert({
      user_id: userId,
      name: `Estorno: ${goalName}`,
      category: "Meta",
      date: new Date().toISOString().split("T")[0],
      amount: -Math.abs(Number(deposit.amount)),
      type: "investimento",
      status: "pago",
      payment_method: "conta",
      recurrence_type: "unica",
      account_id: deposit.account_id,
      observation: `Estorno de depósito da meta "${goalName}"`,
    });
  }

  notifyFinanceDataChanged();
}

/**
 * Undo a withdrawal: the money goes back into the goal and, if it had gone to a registered
 * account, that account's credit is removed again.
 */
export async function deleteGoalWithdrawWithReversal(
  withdraw: GoalTransaction,
  userId: string,
  goalName: string
): Promise<void> {
  const entry = withdraw.account_id && Number(withdraw.amount) < 0
    ? await findMovementEntry(withdraw, { type: "receita", prefix: "Saque:" })
    : null;

  const { error } = await supabase.from("goal_transactions").delete().eq("id", withdraw.id);
  if (error) throw error;

  if (entry) {
    await supabase.from("transactions").delete().eq("id", entry);
  } else if (withdraw.account_id && Number(withdraw.amount) < 0) {
    await supabase.from("transactions").insert({
      user_id: userId,
      name: `Estorno de saque: ${goalName}`,
      category: "Meta",
      date: new Date().toISOString().split("T")[0],
      amount: Math.abs(Number(withdraw.amount)),
      type: "investimento",
      status: "pago",
      payment_method: "conta",
      recurrence_type: "unica",
      account_id: withdraw.account_id,
      observation: `Saque da meta "${goalName}" desfeito`,
    });
  }

  notifyFinanceDataChanged();
}

export function computeGoalInsights(
  goal: Goal,
  transactions: GoalTransaction[],
  topExpenseCategory?: string
): string[] {
  const insights: string[] = [];
  const remaining = goal.target_amount - goal.current_amount;

  if (remaining <= 0) {
    insights.push("🎉 Parabéns! Você atingiu sua meta!");
    return insights;
  }

  if (goal.monthly_contribution && goal.monthly_contribution > 0) {
    const monthsLeft = Math.ceil(remaining / goal.monthly_contribution);
    insights.push(
      `Se continuar depositando ${currencySymbol()} ${goal.monthly_contribution.toFixed(0)}/mês, você conclui em ${monthsLeft} ${monthsLeft === 1 ? "mês" : "meses"} 👀`
    );
  }

  const now = new Date();
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const recentDeposits = transactions.filter(
    (t) => new Date(t.date) >= threeMonthsAgo
  );
  if (recentDeposits.length > 0) {
    const totalRecent = recentDeposits.reduce((s, t) => s + Number(t.amount), 0);
    const monthsSpan = Math.max(
      1,
      (now.getTime() - threeMonthsAgo.getTime()) / (30 * 24 * 60 * 60 * 1000)
    );
    const avgMonthly = totalRecent / monthsSpan;
    if (avgMonthly > 0 && !goal.monthly_contribution) {
      const monthsLeft = Math.ceil(remaining / avgMonthly);
      insights.push(
        `Com base nos seus depósitos recentes, previsão de conclusão em ~${monthsLeft} ${monthsLeft === 1 ? "mês" : "meses"}`
      );
    }
  }

  if (topExpenseCategory) {
    insights.push(
      `Se reduzir gastos em "${topExpenseCategory}" em ${currencySymbol()} 100/mês, você atinge sua meta mais rápido 😉`
    );
  }

  const progress = goal.current_amount / goal.target_amount;
  if (progress > 0.5) {
    insights.push("Tá mais perto do que parece! 💪");
  } else if (progress > 0.2) {
    insights.push("Bom progresso! Continue assim que vai dar certo ✨");
  } else if (remaining > 1000) {
    insights.push(
      "Falta um bom valor ainda — que tal definir um valor mensal fixo pra acelerar isso?"
    );
  }

  return insights;
}
