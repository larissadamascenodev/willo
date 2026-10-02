import { deleteTransaction, updateTransaction } from "@/services/transactionService";
import { excludeRecurringForMonth, excludeRecurringFromMonthOnward } from "@/services/recurringService";

/** O que se precisa de uma conta fixa para removê-la de um mês. */
export interface RecurringTarget {
  id: string;
  /** A data do lançamento original ("2026-03-05"). */
  date: string;
}

/**
 * Remove uma conta fixa só do mês que está sendo visto. Se for o mês do próprio lançamento
 * original, ele é empurrado para o mês seguinte (assim o gatilho de saldo desfaz o efeito);
 * nos demais, o mês entra na lista de exclusões.
 */
export async function removeRecurringThisMonth(target: RecurringTarget, month: number, year: number, userId: string) {
  const [origY, origM] = target.date.split("-").map(Number);
  const isOriginalMonth = origM - 1 === month && origY === year;

  if (isOriginalMonth) {
    const orig = new Date(target.date + "T12:00:00");
    const next = new Date(orig.getFullYear(), orig.getMonth() + 1, Math.min(orig.getDate(), 28));
    const nextKey = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
    await updateTransaction(target.id, { date: nextKey, status: "pendente" });
  } else {
    await excludeRecurringForMonth(target.id, month, year, userId);
  }
}

/** Remove uma conta fixa do mês visto e de todos os seguintes. */
export async function removeRecurringFromMonthOnward(target: RecurringTarget, month: number, year: number, userId: string) {
  const [origY, origM] = target.date.split("-").map(Number);
  const originalIndex = origY * 12 + (origM - 1);
  const viewedIndex = year * 12 + month;

  if (originalIndex >= viewedIndex) {
    // o original está neste mês ou depois: some por inteiro
    await deleteTransaction(target.id);
  } else {
    await excludeRecurringFromMonthOnward(target.id, month, year, userId);
  }
}
