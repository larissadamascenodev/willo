import type { PlanoId } from "@/lib/paywallPricing";

/**
 * Where the purchase would start.
 *
 * There is no checkout yet. The database has been ready for a while — profiles carry a
 * stripe_customer_id and a subscription_status, and there is a subscriptions table with
 * a trial_end — but nothing has ever called Stripe: no edge function, no client code.
 *
 * This function is the one place that would, so that when the function exists it is
 * written here and nowhere else. Until then it says so plainly rather than pretending
 * to have charged someone.
 */

export class CheckoutIndisponivelError extends Error {
  constructor() {
    super("O pagamento ainda não está disponível.");
    this.name = "CheckoutIndisponivelError";
  }
}

export async function iniciarCheckout(_plano: PlanoId): Promise<never> {
  /* When the Stripe edge function lands, it goes here:
     const { data, error } = await supabase.functions.invoke("create-checkout", { body: { plano } });
     window.location.href = data.url; */
  throw new CheckoutIndisponivelError();
}
