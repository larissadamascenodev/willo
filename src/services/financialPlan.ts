import { supabase } from "@/integrations/supabase/client";
import type { PlanInputs, PlanMonth } from "@/lib/plan/financialPlan";

/**
 * What the plan is built from: the last three whole months, as the person recorded
 * them, and what is already put aside. Read straight from the rows, so the plan and the
 * assistant see the same thing.
 */

const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export async function loadPlanInputs(today = new Date(), monthsBack = 3): Promise<PlanInputs & { current: PlanMonth }> {
  const start = new Date(today.getFullYear(), today.getMonth() - monthsBack, 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const iso = (d: Date) => `${key(d)}-${String(d.getDate()).padStart(2, "0")}`;

  const [{ data: txs }, { data: goals }] = await Promise.all([
    supabase
      .from("transactions")
      .select("type,amount,category,date,recurrence_type")
      .gte("date", iso(start))
      .lte("date", iso(end))
      .in("type", ["receita", "despesa"]),
    supabase.from("goals" as any).select("current_amount"),
  ]);

  const months = new Map<string, PlanMonth>();
  for (let i = 0; i <= monthsBack; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - monthsBack + i, 1);
    months.set(key(d), { month: key(d), income: 0, spending: {}, fixed: 0, installments: 0 });
  }
  for (const t of (txs ?? []) as { type: string; amount: number; category: string; date: string; recurrence_type: string | null }[]) {
    const m = months.get(String(t.date).slice(0, 7));
    if (!m) continue;
    const v = Number(t.amount) || 0;
    if (t.type === "receita") {
      m.income += v;
      continue;
    }
    const cat = t.category || "Outros";
    /* Paying an invoice is not spending: the card's purchases are already counted one by one. */
    if (/^(faturas?|pagamento de fatura|cart[aã]o de cr[eé]dito)$/i.test(cat.trim())) continue;
    /* A refund comes in as a negative and takes back what it refunds. */
    m.spending[cat] = (m.spending[cat] ?? 0) + v;
    if (t.recurrence_type === "fixa") m.fixed += v;
    if (t.recurrence_type === "parcelado") m.installments += v;
  }

  const all = [...months.values()];
  const current = all.pop()!;
  const saved = ((goals ?? []) as unknown as { current_amount: number | null }[]).reduce((s, g) => s + (Number(g.current_amount) || 0), 0);
  return { months: all, saved, current };
}
