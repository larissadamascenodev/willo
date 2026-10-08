import { supabase } from "@/integrations/supabase/client";
import { parseDateOnly } from "@/lib/dateOnly";
import { toReais } from "@/lib/invoice/money";
import type { InvoicePayment } from "@/lib/invoice/types";

/**
 * Payments read off a statement, applied to the invoice each one actually settled.
 *
 * A statement's payments almost never belong to the statement they are printed on: the
 * R$ 1.557,53 paid in September cleared September's bill, and October's document merely
 * reports it. So each payment is matched to the invoice whose due date it falls after, and
 * only when the app has that invoice. When it does not, the payment is reported and left
 * alone: writing it against an invoice that does not exist would be bookkeeping theatre,
 * and its effect is already carried by the opening balance line.
 *
 * Three things this will not do. It will not touch an invoice already marked paid, it will
 * not write the same payment twice, and it never guesses which account the money came from,
 * because an account_id would move a real balance on the strength of an inference.
 */

export interface MatchedPayment {
  amount: number;
  date: string;
  invoiceId: string;
  month: number;
  year: number;
}

export interface PaymentMatchResult {
  matched: MatchedPayment[];
  /** Read from the statement, but belonging to an invoice the app does not have. */
  unmatched: { amount: number; date: string | null }[];
}

const asDays = (iso: string) => {
  const { year, month, day } = parseDateOnly(iso);
  return Date.UTC(year, month, day) / 86_400_000;
};

export async function applyImportedPayments(input: {
  userId: string;
  cardId: string;
  dueDay: number;
  /** The invoice being imported, as a month index. Payments belong to earlier ones. */
  invoicePeriod: number;
  payments: InvoicePayment[];
}): Promise<PaymentMatchResult> {
  const result: PaymentMatchResult = { matched: [], unmatched: [] };
  const dated = input.payments.filter((p) => !!p.date);

  for (const p of input.payments) {
    if (!p.date) result.unmatched.push({ amount: toReais(p.amount), date: null });
  }
  if (dated.length === 0) return result;

  const { data: invoiceRows } = await supabase
    .from("invoices")
    .select("id, month, year, total_amount, paid_amount, is_paid")
    .eq("credit_card_id", input.cardId);

  // Only invoices that closed before the one being imported, and that still owe something.
  const candidates = (invoiceRows ?? [])
    .map((i: any) => ({
      id: i.id as string,
      month: i.month as number,
      year: i.year as number,
      total: Number(i.total_amount ?? 0),
      paid: Number(i.paid_amount ?? 0),
      isPaid: !!i.is_paid,
      period: (i.year as number) * 12 + ((i.month as number) - 1),
      dueDays: Date.UTC(i.year, i.month - 1, input.dueDay) / 86_400_000,
    }))
    .filter((i) => i.period < input.invoicePeriod && !i.isPaid)
    .sort((a, b) => b.period - a.period);

  const { data: existing } = await supabase
    .from("invoice_payments" as any)
    .select("invoice_id, amount, paid_at")
    .in("invoice_id", candidates.map((c) => c.id).concat("00000000-0000-0000-0000-000000000000"));

  const alreadyThere = new Set(
    ((existing ?? []) as any[]).map(
      (r) => `${r.invoice_id}|${Number(r.amount).toFixed(2)}|${String(r.paid_at).slice(0, 10)}`,
    ),
  );

  const taken = new Set<string>();

  for (const payment of dated) {
    const amount = toReais(payment.amount);
    const paidOn = asDays(payment.date!);

    // The nearest invoice whose due date the payment falls on or after. A payment made on
    // the 16th settles the bill that fell due on the 13th, not the one a month later.
    //
    // isPaid is re-read each time, not just filtered once at the start: an invoice settled
    // by an earlier payment in this same run must not go on absorbing the rest. Paying more
    // than a bill is a real thing, but the excess is a credit on the card, which the opening
    // balance already carries, and piling it on here would leave paid_amount above the total
    // for every screen that reads it.
    const invoice = candidates.find(
      (c) => !c.isPaid && paidOn >= c.dueDays && !taken.has(`${c.id}|${amount}`),
    );

    if (!invoice) {
      result.unmatched.push({ amount, date: payment.date });
      continue;
    }

    const key = `${invoice.id}|${amount.toFixed(2)}|${payment.date!.slice(0, 10)}`;
    if (alreadyThere.has(key)) {
      result.unmatched.push({ amount, date: payment.date });
      continue;
    }

    const { error } = await supabase.from("invoice_payments" as any).insert({
      user_id: input.userId,
      invoice_id: invoice.id,
      amount,
      paid_at: payment.date,
      // Left null on purpose: a guessed account would move a real balance.
      account_id: null,
    });
    if (error) {
      result.unmatched.push({ amount, date: payment.date });
      continue;
    }

    const newPaid = Math.round((invoice.paid + amount) * 100) / 100;
    await supabase
      .from("invoices")
      .update({
        paid_amount: newPaid,
        is_paid: newPaid >= invoice.total - 0.05,
        paid_at: payment.date,
      } as any)
      .eq("id", invoice.id);

    invoice.paid = newPaid;
    invoice.isPaid = newPaid >= invoice.total - 0.05;
    taken.add(`${invoice.id}|${amount}`);
    alreadyThere.add(key);

    result.matched.push({
      amount,
      date: payment.date!,
      invoiceId: invoice.id,
      month: invoice.month,
      year: invoice.year,
    });
  }

  // Nothing recalculates the card's used limit when an invoice is marked paid: the figure
  // is derived from the items of unpaid invoices, and only a transaction change triggers a
  // refresh. Without this the invoice reads settled while the limit it was holding stays
  // held, which is the opposite of what paying a bill does.
  if (result.matched.length > 0) {
    await supabase.rpc("recalc_credit_card_used_limit" as any, { p_credit_card_id: input.cardId });
  }

  return result;
}
