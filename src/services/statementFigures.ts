import { supabase } from "@/integrations/supabase/client";

/**
 * The figures the bank printed, written down beside the ones the app works out.
 *
 * They are kept apart deliberately. used_limit is derived, recomputed by a trigger whenever
 * anything on the card changes, so a bank figure written there would vanish on the next
 * edit. And the bank's number is not a better version of ours: it is a different
 * measurement, taken on the day the statement closed. Holding both is what lets a screen
 * say "we count this, your statement said that" instead of quietly choosing one.
 *
 * Nothing here is ever used in a calculation.
 */

export interface StatementFigures {
  totalLimit?: number | null;
  usedLimit?: number | null;
  availableLimit?: number | null;
  officialTotal?: number | null;
  nextInvoiceClosing?: number | null;
}

const ref = (month: number, year: number) => `${year}-${String(month).padStart(2, "0")}`;

export async function saveStatementFigures(
  cardId: string,
  month: number,
  year: number,
  figures: StatementFigures,
): Promise<void> {
  const statementRef = ref(month, year);
  const now = new Date().toISOString();

  const hasLimits =
    figures.totalLimit != null || figures.usedLimit != null || figures.availableLimit != null;

  if (hasLimits) {
    // An older statement must not overwrite a newer one. Someone importing last March's
    // PDF after this month's would otherwise roll the card's limit back half a year.
    const { data: card } = await supabase
      .from("credit_cards")
      .select("statement_ref")
      .eq("id", cardId)
      .maybeSingle();

    const previous = (card as any)?.statement_ref as string | null | undefined;
    if (!previous || previous <= statementRef) {
      await supabase
        .from("credit_cards")
        .update({
          statement_total_limit: figures.totalLimit ?? null,
          statement_used_limit: figures.usedLimit ?? null,
          statement_available_limit: figures.availableLimit ?? null,
          statement_ref: statementRef,
          statement_read_at: now,
        } as any)
        .eq("id", cardId);
    }
  }

  if (figures.officialTotal == null && figures.nextInvoiceClosing == null) return;

  // The invoice exists by now: the card triggers create it while the rows are written.
  const { data: invoice } = await supabase
    .from("invoices")
    .select("id")
    .eq("credit_card_id", cardId)
    .eq("month", month)
    .eq("year", year)
    .maybeSingle();

  if (!invoice) return;

  await supabase
    .from("invoices")
    .update({
      official_total: figures.officialTotal ?? null,
      official_next_closing: figures.nextInvoiceClosing ?? null,
      official_read_at: now,
    } as any)
    .eq("id", invoice.id);
}
