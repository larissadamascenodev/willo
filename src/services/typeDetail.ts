import { supabase } from "@/integrations/supabase/client";
import { getRecurringForMonth } from "@/services/recurringService";
import { dayOfMonth } from "@/lib/dateOnly";

/**
 * Everything that came in, or everything that went out, in one month.
 *
 * Three things have to be gathered and reconciled before the list is true, and all
 * three are about the data rather than about a screen, so both apps ask for them
 * here: the rows actually written for the month, the fixed entries that repeat into
 * it without a row of their own, and — for the outgoing side — the card invoices,
 * which are one expense each no matter how many lines they hold.
 *
 * The card's own purchases are left out of the expense list on purpose. They are
 * already inside the invoice, and counting both would say the money left twice.
 */

export interface TypeDetailTransaction {
  id: string;
  name: string;
  category: string;
  date: string;
  amount: number;
  status: string;
  type: string;
  payment_method: string;
  recurrence_type: string;
  created_at: string;
  updated_at: string;
  credit_card_id: string | null;
}

export interface TypeDetailInvoice {
  id: string;
  credit_card_id: string;
  total_amount: number;
  is_paid: boolean;
  month: number;
  year: number;
  card_name: string;
  card_color: string | null;
}

export interface TypeDetail {
  transactions: TypeDetailTransaction[];
  /** Always empty on the incoming side: an invoice is never money arriving. */
  invoices: TypeDetailInvoice[];
}

const monthBounds = (month: number, year: number) => ({
  start: new Date(year, month, 1).toISOString().split("T")[0],
  end: new Date(year, month + 1, 0).toISOString().split("T")[0],
});

export async function loadTypeDetail({
  userId,
  month,
  year,
  isReceita,
}: {
  userId: string;
  /** Zero-based, as the month context keeps it. */
  month: number;
  year: number;
  isReceita: boolean;
}): Promise<TypeDetail> {
  const typeFilter = isReceita ? "receita" : "despesa";
  const { start, end } = monthBounds(month, year);

  let txQuery = supabase
    .from("transactions")
    .select(
      "id, name, category, date, amount, status, type, payment_method, recurrence_type, created_at, updated_at, credit_card_id",
    )
    .eq("user_id", userId)
    .eq("type", typeFilter)
    .gte("date", start)
    .lte("date", end)
    .order("date", { ascending: false })
    .order("created_at", { ascending: true });

  /* A purchase on a card is not an expense of this month on its own — the invoice
     it sits inside is. */
  if (!isReceita) txQuery = txQuery.is("credit_card_id", null);

  const [{ data: txs }, recurring] = await Promise.all([
    txQuery,
    getRecurringForMonth(month, year),
  ]);

  /* A fixed entry repeats into this month without a row of its own. The totals have
     already counted it, so the list has to show it too or the two disagree. */
  const base = (txs as TypeDetailTransaction[]) ?? [];
  const seen = new Set(base.map((t) => t.id));
  const materialised = (recurring as any[])
    .filter((r) => r.type === typeFilter && !seen.has(r.id))
    .filter((r) => (isReceita ? true : !r.credit_card_id))
    .map((r) => ({
      ...r,
      date: `${year}-${String(month + 1).padStart(2, "0")}-${String(dayOfMonth(r.date)).padStart(2, "0")}`,
      status: "pendente",
    })) as TypeDetailTransaction[];

  const transactions = [...base, ...materialised].sort((a, b) =>
    (b.date ?? "").localeCompare(a.date ?? ""),
  );

  if (isReceita) return { transactions, invoices: [] };

  const { data: invData } = await supabase
    .from("invoices")
    .select("id, credit_card_id, total_amount, is_paid, month, year")
    .eq("user_id", userId)
    .eq("month", month + 1)
    .eq("year", year)
    .gt("total_amount", 0);

  if (!invData || invData.length === 0) return { transactions, invoices: [] };

  const cardIds = [...new Set(invData.map((inv) => inv.credit_card_id))];
  const { data: cards } = await supabase
    .from("credit_cards")
    .select("id, name, color")
    .in("id", cardIds);
  const cardsById = new Map((cards ?? []).map((c) => [c.id, c]));

  const invoices = invData.map((inv) => {
    const card = cardsById.get(inv.credit_card_id);
    return {
      ...inv,
      card_name: card?.name ?? "Cartão",
      card_color: card?.color ?? null,
    };
  });

  return { transactions, invoices };
}

/**
 * The same figure over the last few months, so this month has something to be
 * bigger or smaller than.
 */
export async function loadMonthlyHistory({
  userId,
  isReceita,
  month,
  year,
  months = 6,
}: {
  userId: string;
  isReceita: boolean;
  month: number;
  year: number;
  months?: number;
}): Promise<{ month: number; year: number; value: number }[]> {
  const typeFilter = isReceita ? "receita" : "despesa";

  const spans = Array.from({ length: months }, (_, i) => {
    const d = new Date(year, month - (months - 1 - i), 1);
    return { month: d.getMonth(), year: d.getFullYear() };
  });

  return Promise.all(
    spans.map(async (span) => {
      const { start, end } = monthBounds(span.month, span.year);
      const { data } = await supabase
        .from("transactions")
        .select("amount")
        .eq("user_id", userId)
        .eq("type", typeFilter)
        .gte("date", start)
        .lte("date", end);
      return {
        ...span,
        value: (data ?? []).reduce((sum: number, t: any) => sum + Number(t.amount), 0),
      };
    }),
  );
}

/**
 * Whether a month-on-month comparison is honest.
 *
 * Before the account existed there was no spending to compare against, so the whole
 * month reads as growth from zero. That is an artefact of signing up, not a trend.
 */
export function trendBetween(
  history: { value: number }[],
  accountCreatedAt: string | undefined,
  month: number,
  year: number,
): number {
  if (history.length < 2) return 0;

  if (accountCreatedAt) {
    const created = new Date(accountCreatedAt);
    const previousMonth = new Date(year, month - 1, 1);
    const createdMonth = new Date(created.getFullYear(), created.getMonth(), 1);
    if (previousMonth < createdMonth) return 0;
  }

  const prev = history[history.length - 2]?.value ?? 0;
  const curr = history[history.length - 1]?.value ?? 0;
  if (prev === 0) return 0;
  return Math.round(((curr - prev) / prev) * 100);
}
