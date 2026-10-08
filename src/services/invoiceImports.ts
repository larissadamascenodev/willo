import { supabase } from "@/integrations/supabase/client";
import type { InvoiceImportResult } from "@/lib/invoice/types";
import { toReais } from "@/lib/invoice/money";

/**
 * The record of an import: what document it came from, what it read, what it concluded.
 *
 * Two things rest on this. A number that looks wrong months later can be traced back to the
 * line it came from, including the lines that deliberately became nothing, which is usually
 * where a short total is hiding. And the same statement imported twice is recognisable
 * before it duplicates anything, because the file hashes to the same thing both times.
 */

/** SHA-256 of the uploaded file, which is the only part of a statement that cannot drift. */
export async function hashFile(file: File): Promise<string | null> {
  try {
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    // Not available on an insecure origin. An import without a hash still works; it just
    // cannot be recognised as a repeat.
    return null;
  }
}

export interface PreviousImport {
  id: string;
  month: number;
  year: number;
  createdAt: string;
  rowCount: number;
  fileName: string | null;
}

export async function findPreviousImport(
  cardId: string,
  documentHash: string | null,
): Promise<PreviousImport | null> {
  if (!documentHash) return null;

  const { data } = await supabase
    .from("invoice_imports" as any)
    .select("id, month, year, created_at, row_count, file_name")
    .eq("credit_card_id", cardId)
    .eq("document_hash", documentHash)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  const row = data as any;
  return {
    id: row.id,
    month: row.month,
    year: row.year,
    createdAt: row.created_at,
    rowCount: row.row_count ?? 0,
    fileName: row.file_name ?? null,
  };
}

export async function recordImport(input: {
  userId: string;
  cardId: string;
  month: number;
  year: number;
  documentHash: string | null;
  fileName: string | null;
  result: InvoiceImportResult;
  rowCount: number;
}): Promise<void> {
  const { result } = input;

  const { data: created, error } = await supabase
    .from("invoice_imports" as any)
    .insert({
      user_id: input.userId,
      credit_card_id: input.cardId,
      month: input.month,
      year: input.year,
      document_hash: input.documentHash,
      file_name: input.fileName,
      official_total: result.reconciliation.officialTotal == null ? null : toReais(result.reconciliation.officialTotal),
      calculated_total: toReais(result.reconciliation.calculatedTotal),
      reconciliation_status: result.reconciliation.status,
      official_used_limit:
        result.limitReconciliation.officialUsed == null ? null : toReais(result.limitReconciliation.officialUsed),
      calculated_used_limit: toReais(result.limitReconciliation.calculatedUsed),
      limit_status: result.limitReconciliation.status,
      event_count: result.rawEvents.length,
      row_count: input.rowCount,
      alerts: result.alerts,
    })
    .select("id")
    .single();

  // The audit trail is not worth failing an import over: the money is already written, and
  // losing the record of how is better than telling someone their statement did not import.
  if (error || !created) {
    console.error("Falha ao registrar a importação:", error);
    return;
  }

  const importId = (created as any).id as string;
  const events = result.rawEvents.map((e, i) => ({
    import_id: importId,
    user_id: input.userId,
    seq: i + 1,
    event_date: e.date,
    description: e.description,
    amount: toReais(e.amount),
    category: e.category,
    confidence: e.confidence,
    operation_id: e.operationId,
    installment_number: e.installmentNumber ?? null,
    installment_total: e.installmentTotal ?? null,
  }));

  if (events.length > 0) {
    const { error: eventsError } = await supabase.from("invoice_import_events" as any).insert(events);
    if (eventsError) console.error("Falha ao registrar os eventos da importação:", eventsError);
  }
}
