import { supabase } from "@/integrations/supabase/client";
import type { InvoicePayment } from "@/services/invoiceService";

/**
 * Changing or removing one payment made to an invoice.
 *
 * The web can only undo every payment of an invoice at once. Here a single one can go,
 * or be corrected: the row itself moves the account's balance (a trigger recounts it),
 * and the invoice's paid figure and the card's used limit are brought in line after.
 */

async function settle(invoiceId: string, delta: number) {
  const { data: inv, error } = await supabase
    .from("invoices" as any)
    .select("total_amount, paid_amount, credit_card_id")
    .eq("id", invoiceId)
    .single();
  if (error || !inv) throw error ?? new Error("Fatura não encontrada");
  const row = inv as any;
  const paid = Math.max(0, Math.round((Number(row.paid_amount ?? 0) + delta) * 100) / 100);
  const { error: upErr } = await supabase
    .from("invoices" as any)
    .update({ paid_amount: paid, is_paid: paid > 0 && Number(row.total_amount) <= paid, ...(paid === 0 ? { paid_at: null, paid_from_account_id: null } : {}) })
    .eq("id", invoiceId);
  if (upErr) throw upErr;
  await supabase.rpc("recalc_credit_card_used_limit" as any, { p_credit_card_id: row.credit_card_id });
}

export async function removePayment(payment: InvoicePayment) {
  const { error } = await supabase.from("invoice_payments" as any).delete().eq("id", payment.id);
  if (error) throw error;
  await settle(payment.invoice_id, -Number(payment.amount));
  window.dispatchEvent(new CustomEvent("finance-data-changed"));
}

export async function changePayment(payment: InvoicePayment, next: { amount: number; accountId: string | null }) {
  const { error } = await supabase
    .from("invoice_payments" as any)
    .update({ amount: next.amount, account_id: next.accountId })
    .eq("id", payment.id);
  if (error) throw error;
  await settle(payment.invoice_id, next.amount - Number(payment.amount));
  window.dispatchEvent(new CustomEvent("finance-data-changed"));
}
