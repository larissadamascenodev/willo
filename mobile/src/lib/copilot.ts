import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { createTransaction } from "@/services/transactionService";

/**
 * Willo Copilot's waiting list: purchases caught from the bank — its notices, its e-mails,
 * the iPhone's Wallet shortcut — held until the person confirms them. Confirmed, one becomes
 * a transaction like any other and moves the balance; discarded, it is gone from the list.
 *
 * The list lives in its own table (supabase/migrations/…_copilot_pending.sql). Until that
 * table exists the list is simply empty, and the card says there is nothing to confirm.
 */

export interface CopilotItem {
  id: string;
  name: string;
  amount: number;
  type: "despesa" | "receita";
  category: string | null;
  payment_method: "conta" | "cartao" | null;
  account_id: string | null;
  credit_card_id: string | null;
  occurred_at: string;
  source: string;
  raw: string | null;
}

/* Not in the generated types until the table is created. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = (): any => supabase.from("copilot_pending" as never);

export async function listPending(): Promise<CopilotItem[]> {
  const { data, error } = await table()
    .select("id, name, amount, type, category, payment_method, account_id, credit_card_id, occurred_at, source, raw")
    .eq("status", "pendente")
    .order("occurred_at", { ascending: false });
  /* No table yet: nothing waiting. */
  if (error) return [];
  return ((data ?? []) as CopilotItem[]).map((r) => ({ ...r, amount: Number(r.amount) }));
}

/** Confirmed as it stands, or as it was changed: a transaction now, and off the list. */
export async function confirmPending(item: CopilotItem, userId: string) {
  const credit = item.type === "despesa" && item.payment_method === "cartao" && !!item.credit_card_id;
  const day = item.occurred_at.slice(0, 10);
  const tx = (await createTransaction(
    {
      name: item.name,
      type: item.type,
      amount: item.amount,
      category: item.category || "Outros",
      date: day,
      time: new Date(item.occurred_at).toTimeString().slice(0, 5),
      status: credit ? "pendente" : "pago",
      payment_method: credit ? "cartao" : "conta",
      account_id: credit ? null : item.account_id,
      credit_card_id: credit ? item.credit_card_id : null,
      recurrence_type: "unica",
      observation: item.raw ? `Willo Copilot · ${item.raw}`.slice(0, 280) : "Willo Copilot",
    },
    userId,
  )) as { id?: string } | null;
  await table().update({ status: "confirmado", transaction_id: tx?.id ?? null }).eq("id", item.id);
  window.dispatchEvent(new CustomEvent("transaction-created"));
  window.dispatchEvent(new CustomEvent("copilot-changed"));
}

export async function discardPending(id: string) {
  await table().update({ status: "descartado" }).eq("id", id);
  window.dispatchEvent(new CustomEvent("copilot-changed"));
}

/** The list, kept current while a screen shows it. */
export function useCopilot() {
  const [items, setItems] = useState<CopilotItem[] | null>(null);
  const reload = useCallback(() => {
    void listPending().then(setItems);
  }, []);
  useEffect(() => {
    reload();
    window.addEventListener("copilot-changed", reload);
    window.addEventListener("finance-data-changed", reload);
    return () => {
      window.removeEventListener("copilot-changed", reload);
      window.removeEventListener("finance-data-changed", reload);
    };
  }, [reload]);
  return { items, reload };
}

export interface CopilotPast extends CopilotItem {
  status: "confirmado" | "descartado";
}

/** What came in before and was already answered: confirmed or discarded, newest first. */
export async function listHistory(limit = 40): Promise<CopilotPast[]> {
  const { data, error } = await table()
    .select("id, name, amount, type, category, payment_method, account_id, credit_card_id, occurred_at, source, raw, status")
    .in("status", ["confirmado", "descartado"])
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return ((data ?? []) as CopilotPast[]).map((r) => ({ ...r, amount: Number(r.amount) }));
}
