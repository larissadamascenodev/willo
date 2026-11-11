import { supabase } from "@/integrations/supabase/client";
import { toTitleCase } from "@/lib/textCase";
import { createTransaction, notifyFinanceDataChanged } from "@/services/transactionService";
import { excludeRecurringForMonth, excludeRecurringFromMonthOnward } from "@/services/recurringService";
import { isFixed, isParcel, planDelete, planEdit, type Scope, type SeriesOp, type SeriesRow } from "@/lib/seriesPlan";

/**
 * Deleting or changing an entry that repeats — only this one, or this one and the
 * ones after — carried out on the database. What to do is decided in seriesPlan; this
 * reads the rows it needs and does it, one step at a time, in order.
 *
 * The row is always read again from the database first: what a list shows for a fixed
 * entry in a later month carries that month's date, not the date the series began on,
 * and planning from it would treat the whole series as starting there.
 */

async function context(id: string): Promise<{ row: SeriesRow; all: SeriesRow[] }> {
  const { data: row, error } = await supabase.from("transactions").select("*").eq("id", id).single();
  if (error || !row) throw error ?? new Error("Lançamento não encontrado.");
  const r = row as unknown as SeriesRow;
  if (isFixed(r)) {
    const { data } = await supabase.from("transactions").select("*").eq("recurrence_type", "fixa").eq("name", r.name);
    return { row: r, all: (data ?? []) as unknown as SeriesRow[] };
  }
  if (isParcel(r)) {
    const head = r.parent_transaction_id ?? r.id;
    const { data } = await supabase.from("transactions").select("*").or(`id.eq.${head},parent_transaction_id.eq.${head}`);
    return { row: r, all: (data ?? []) as unknown as SeriesRow[] };
  }
  return { row: r, all: [r] };
}

async function run(ops: SeriesOp[], userId: string) {
  for (const o of ops) {
    if (o.op === "exclude") await excludeRecurringForMonth(o.id, o.month, o.year, userId);
    else if (o.op === "excludeOnward") await excludeRecurringFromMonthOnward(o.id, o.month, o.year, userId);
    else if (o.op === "update") {
      const patch = typeof o.patch.name === "string" ? { ...o.patch, name: toTitleCase(o.patch.name) } : o.patch;
      const { error } = await supabase.from("transactions").update(patch as never).eq("id", o.id);
      if (error) throw error;
    } else if (o.op === "delete") {
      const { error } = await supabase.from("transactions").delete().eq("id", o.id);
      if (error) throw error;
    } else await createTransaction(o.fields as never, userId);
  }
  notifyFinanceDataChanged();
}

export async function deleteInSeries(id: string, scope: Scope, where: { month: number; year: number; userId: string }) {
  const { row, all } = await context(id);
  await run(planDelete(row, scope, { month: where.month, year: where.year, all }), where.userId);
}

export async function editInSeries(
  id: string,
  scope: Scope,
  fields: Record<string, unknown>,
  where: { month: number; year: number; userId: string },
) {
  const { row, all } = await context(id);
  await run(planEdit(row, scope, fields, { month: where.month, year: where.year, all }), where.userId);
}
