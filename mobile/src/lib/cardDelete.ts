import { supabase } from "@/integrations/supabase/client";
import { notifyFinanceDataChanged } from "@/services/transactionService";

/**
 * Removing a credit card, keeping what really happened.
 *
 * Its purchases and invoices go with it. What was already paid on its invoices did leave
 * an account, though — and the database would hand that money back if the payments simply
 * went with the invoices. So each payment first becomes an ordinary expense on the account
 * it came from, on the day it was made; then the card goes. The accounts' balances end
 * exactly where they were.
 */
export async function deleteCardKeepingHistory(card: { id: string; name: string }, userId: string): Promise<void> {
  const { data: invoices, error: invError } = await supabase.from("invoices").select("id").eq("credit_card_id", card.id);
  if (invError) throw invError;
  const invoiceIds = ((invoices ?? []) as { id: string }[]).map((i) => i.id);

  if (invoiceIds.length > 0) {
    const { data: payments, error: payError } = await supabase.from("invoice_payments" as never).select("amount, paid_at, account_id").in("invoice_id", invoiceIds);
    if (payError) throw payError;
    const kept = ((payments ?? []) as { amount: number; paid_at: string; account_id: string | null }[])
      .filter((p) => p.account_id && Number(p.amount) > 0)
      .map((p) => ({
        user_id: userId,
        name: `Fatura ${card.name}`,
        type: "despesa",
        amount: Number(p.amount),
        category: "Cartão de Crédito",
        date: new Date(p.paid_at).toISOString().slice(0, 10),
        status: "pago",
        payment_method: "conta",
        recurrence_type: "unica",
        account_id: p.account_id,
        observation: `Pagamento de fatura do cartão ${card.name}, que foi excluído`,
      }));
    if (kept.length > 0) {
      const { error } = await supabase.from("transactions").insert(kept as never);
      if (error) throw error;
    }
  }

  /* The card's purchases, instalments included; then the card, its invoices going with it. */
  const { error: txError } = await supabase.from("transactions").delete().eq("credit_card_id", card.id);
  if (txError) throw txError;
  const { error } = await supabase.from("credit_cards").delete().eq("id", card.id);
  if (error) throw error;
  notifyFinanceDataChanged();
}
