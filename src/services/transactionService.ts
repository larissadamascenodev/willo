import { supabase } from "@/integrations/supabase/client";
import { toTitleCase } from "@/lib/textCase";

const ACCOUNTS_CACHE_KEY = "accounts-active";
const ACCOUNTS_WITH_INACTIVE_CACHE_KEY = "accounts-all";
const CREDIT_CARDS_CACHE_KEY = "credit-cards";

const queryCache = new Map<string, { data: any[]; timestamp: number }>();
const QUERY_CACHE_TTL = 300_000; // 5 minutes
const inflightCache = new Map<string, Promise<any[]>>();

export function clearFinanceQueryCache() {
  queryCache.clear();
  inflightCache.clear();
}

export interface CreateTransactionInput {
  name: string;
  type: "receita" | "despesa";
  amount: number;
  category: string;
  date: string;
  time?: string | null;
  status?: "pago" | "pendente";
  account_id?: string | null;
  payment_method?: "conta" | "cartao";
  recurrence_type?: "unica" | "parcelado" | "fixa";
  installments?: number | null;
  installment_current?: number | null;
  observation?: string | null;
  credit_card_id?: string | null;
  parent_transaction_id?: string | null;
}

export interface TransactionFilters {
  month?: number;
  year?: number;
  type?: "receita" | "despesa";
  category?: string;
}

export function notifyFinanceDataChanged() {
  clearFinanceQueryCache();
  // Import dynamically to avoid circular deps
  import("@/services/dashboardData").then(({ clearDashboardCache }) => {
    clearDashboardCache(); // full cache clear — ensures fresh data on next read
  });
  import("@/lib/financeEngine").then(({ clearMaterializedCache }) => {
    clearMaterializedCache();
  }).catch(() => {});
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("finance-data-changed"));
}

function getCachedList<T>(key: string, loader: () => Promise<T[]>): Promise<T[]> {
  const cached = queryCache.get(key);
  if (cached && Date.now() - cached.timestamp < QUERY_CACHE_TTL) return Promise.resolve(cached.data as T[]);

  const inflight = inflightCache.get(key);
  if (inflight) return inflight as Promise<T[]>;

  const request = loader()
    .then((result) => {
      queryCache.set(key, { data: result as any[], timestamp: Date.now() });
      return result;
    })
    .finally(() => {
      inflightCache.delete(key);
    });

  inflightCache.set(key, request as Promise<any[]>);
  return request;
}

async function resolveTransactionAccountId(input: CreateTransactionInput) {
  const paymentMethod = input.payment_method ?? "conta";

  if (paymentMethod === "cartao") return null;
  if (input.account_id) return input.account_id;

  const accounts = await getAccounts();
  const eligibleAccounts = accounts.filter((account: any) => account.type !== "investment" && account.is_active !== false);
  const preferredAccount = eligibleAccounts.find((account: any) => account.is_default) ?? eligibleAccounts[0];

  return preferredAccount?.id ?? null;
}

export async function createTransaction(input: CreateTransactionInput, userId: string) {
  const paymentMethod = input.payment_method ?? "conta";
  const resolvedAccountId = await resolveTransactionAccountId(input);

  // For manual transactions (no time provided), use current time
  const transactionTime = input.time ?? new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false });

  const { data, error } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      name: toTitleCase(input.name),
      type: input.type,
      amount: input.amount,
      category: input.category,
      date: input.date,
      time: transactionTime,
      status: input.status ?? "pago",
      account_id: paymentMethod === "cartao" ? null : resolvedAccountId,
      payment_method: paymentMethod,
      recurrence_type: input.recurrence_type ?? "unica",
      installments: input.installments ?? null,
      installment_current: input.installment_current ?? null,
      observation: input.observation ?? null,
      credit_card_id: paymentMethod === "cartao" ? (input.credit_card_id ?? null) : null,
      parent_transaction_id: input.parent_transaction_id ?? null,
    } as any)
    .select()
    .single();

  if (error) throw error;
  notifyFinanceDataChanged();
  return data;
}

/**
 * Marks an entry as happened, or as still to happen.
 *
 * The balance is worked out by the database from the entries linked to each account, so an
 * entry with no account moves nothing, however it is marked: it gets one here. And money that
 * moves today moves today: an entry of a later month marked as happened comes to today, or it
 * would count in the balance now and again when that month is reached. A fixed entry keeps its
 * date, because its date is what the whole series hangs from.
 */
export async function updateTransactionStatus(id: string, status: "pago" | "pendente") {
  const patch: Record<string, unknown> = { status };
  if (status === "pago") {
    const { data: row } = await supabase
      .from("transactions")
      .select("date, account_id, payment_method, recurrence_type")
      .eq("id", id)
      .maybeSingle();
    if (row && row.payment_method !== "cartao") {
      if (!row.account_id) patch.account_id = await resolveTransactionAccountId({ payment_method: "conta" } as CreateTransactionInput);
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      if (row.recurrence_type !== "fixa" && row.date > today) patch.date = today;
    }
  }
  const { data, error } = await supabase
    .from("transactions")
    .update(patch as never)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  notifyFinanceDataChanged();
  return data;
}

export async function updateTransaction(id: string, updates: {
  name?: string;
  amount?: number;
  category?: string;
  date?: string;
  type?: "receita" | "despesa";
  status?: "pago" | "pendente";
  payment_method?: "conta" | "cartao";
  recurrence_type?: "unica" | "parcelado" | "fixa";
  installments?: number | null;
  installment_current?: number | null;
  observation?: string | null;
  account_id?: string | null;
  credit_card_id?: string | null;
}) {
  // Names are stored in a readable case, no matter how they were typed
  const normalized = { ...updates, ...(updates.name ? { name: toTitleCase(updates.name) } : {}) };
  const { data, error } = await supabase
    .from("transactions")
    .update(normalized)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  const childUpdates: Record<string, any> = {};
  if (normalized.name) childUpdates.name = normalized.name;
  if (updates.category) childUpdates.category = updates.category;
  if (updates.amount !== undefined) childUpdates.amount = updates.amount;

  if (Object.keys(childUpdates).length > 0) {
    await supabase
      .from("transactions")
      .update(childUpdates)
      .eq("parent_transaction_id", id);
  }

  notifyFinanceDataChanged();
  return data;
}

export async function getTransactions(filters: TransactionFilters = {}) {
  let query = supabase
    .from("transactions")
    .select("*")
    .order("date", { ascending: false })
    .order("created_at", { ascending: true });

  if (filters.month !== undefined && filters.year !== undefined) {
    const start = new Date(filters.year, filters.month, 1).toISOString().split("T")[0];
    const end = new Date(filters.year, filters.month + 1, 0).toISOString().split("T")[0];
    query = query.gte("date", start).lte("date", end);
  }

  if (filters.type) query = query.eq("type", filters.type);
  if (filters.category) query = query.eq("category", filters.category);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getRecentTransactions(limit = 10) {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("status", "pago")
    .order("date", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function deleteTransaction(id: string) {
  const { data: children } = await supabase
    .from("transactions")
    .select("id")
    .eq("parent_transaction_id", id);

  if (children && children.length > 0) {
    const childIds = children.map(c => c.id);
    await supabase
      .from("transactions")
      .delete()
      .in("id", childIds);
  }

  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id);

  if (error) throw error;
  notifyFinanceDataChanged();
}

export async function getTransactionById(id: string) {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function getAccounts(includeInactive = false) {
  const cacheKey = includeInactive ? ACCOUNTS_WITH_INACTIVE_CACHE_KEY : ACCOUNTS_CACHE_KEY;

  return getCachedList(cacheKey, async () => {
    let query = supabase
      .from("accounts")
      .select("*")
      .order("is_default", { ascending: false });

    if (!includeInactive) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  });
}

export async function createAccount(
  userId: string,
  input: {
    name: string;
    type?: "checking" | "cash" | "savings" | "investment";
    initial_balance?: number;
    color?: string | null;
  }
) {
  const balance = input.initial_balance ?? 0;
  const { data, error } = await supabase
    .from("accounts")
    .insert({
      user_id: userId,
      name: toTitleCase(input.name),
      type: input.type ?? "checking",
      is_default: false,
      initial_balance: balance,
      current_balance: balance,
      color: input.color ?? null,
    } as any)
    .select()
    .single();

  if (error) throw error;
  notifyFinanceDataChanged();
  return data;
}

export interface CreditCardInput {
  name: string;
  limit: number;
  closing_day: number;
  due_day: number;
  color?: string | null;
  last_four_digits?: string | null;
}

export async function getCreditCards() {
  return getCachedList(CREDIT_CARDS_CACHE_KEY, async () => {
    const { data, error } = await supabase
      .from("credit_cards" as any)
      .select("*")
      .order("created_at", { ascending: true });

    if (error) throw error;
    return data ?? [];
  });
}

export async function createCreditCard(input: CreditCardInput, userId: string) {
  const { data, error } = await supabase
    .from("credit_cards" as any)
    .insert({
      user_id: userId,
      name: toTitleCase(input.name),
      limit: input.limit,
      closing_day: input.closing_day,
      due_day: input.due_day,
      color: input.color ?? null,
      last_four_digits: input.last_four_digits ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  notifyFinanceDataChanged();
  return data;
}

export async function updateAccount(id: string, updates: {
  name?: string;
  type?: string;
  color?: string | null;
  initial_balance?: number;
}) {
  const { data, error } = await supabase
    .from("accounts")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  notifyFinanceDataChanged();
  return data;
}

/**
 * Takes an account's opening balance out, the way any other income or expense is
 * deleted: the line it left in the month goes, and the balance drops by what it had added.
 * The balance is a stored figure that only transactions keep up to date, so the two
 * numbers are moved together instead of leaving the account out of step with its history.
 */
export async function removeInitialBalance(id: string) {
  const { data: account, error: readError } = await supabase
    .from("accounts")
    .select("initial_balance, current_balance")
    .eq("id", id)
    .single();
  if (readError) throw readError;

  const opening = Number(account.initial_balance) || 0;
  const { error } = await supabase
    .from("accounts")
    .update({ initial_balance: 0, current_balance: (Number(account.current_balance) || 0) - opening })
    .eq("id", id);
  if (error) throw error;
  notifyFinanceDataChanged();
}

/**
 * Deleting an account must not cut its history loose. The links to it are cleared by the
 * database, and an entry with no account counts in no balance: every balance would quietly fall
 * to zero while the entries stayed on screen. So what it holds passes to another account first,
 * and with no other account to take it, it is not deleted.
 */
export async function deleteAccount(id: string) {
  const accounts = (await getAccounts()) as any[];
  const heir = accounts.find((a) => a.id !== id && a.type !== "investment" && a.is_active !== false && a.is_default)
    ?? accounts.find((a) => a.id !== id && a.type !== "investment" && a.is_active !== false);
  if (!heir) throw new Error("Crie outra conta antes de excluir esta: os lançamentos dela precisam de um lugar para ficar.");

  const moves = await Promise.all([
    supabase.from("transactions").update({ account_id: heir.id }).eq("account_id", id),
    supabase.from("transactions").update({ to_account_id: heir.id } as never).eq("to_account_id", id),
    (supabase.from("invoice_payments" as any) as any).update({ account_id: heir.id }).eq("account_id", id),
    (supabase.from("goal_transactions" as any) as any).update({ account_id: heir.id }).eq("account_id", id),
  ]);
  const failed = moves.find((m) => m.error);
  if (failed?.error) throw failed.error;

  const { error } = await supabase
    .from("accounts")
    .delete()
    .eq("id", id);
  if (error) throw error;
  notifyFinanceDataChanged();
}

export async function deactivateAccount(id: string) {
  const { data, error } = await supabase
    .from("accounts")
    .update({ is_active: false } as any)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  notifyFinanceDataChanged();
  return data;
}

export async function updateCreditCard(id: string, updates: {
  name?: string;
  limit?: number;
  closing_day?: number;
  due_day?: number;
  color?: string | null;
  last_four_digits?: string | null;
}) {
  const { data, error } = await supabase
    .from("credit_cards" as any)
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  notifyFinanceDataChanged();
  return data;
}

export async function deleteCreditCard(id: string) {
  const { error } = await supabase
    .from("credit_cards" as any)
    .delete()
    .eq("id", id);
  if (error) throw error;
  notifyFinanceDataChanged();
}

export async function suggestCategory(
  description: string,
  type: "receita" | "despesa",
  customCategories?: string[]
): Promise<{ category: string | null; icon?: string; color?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("suggest-category", {
      body: { description, type, customCategories },
    });
    if (error) return { category: null };
    return {
      category: data?.category ?? null,
      icon: data?.icon,
      color: data?.color,
    };
  } catch {
    return { category: null };
  }
}
