import { supabase } from "@/integrations/supabase/client";

import { currencySymbol } from "@/lib/currency";
export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  category: string;
  is_read: boolean;
  related_id: string | null;
  created_at: string;
}

export interface NotificationSettings {
  id: string;
  user_id: string;
  bill_due_reminder: boolean;
  bill_due_days_before: number;
  invoice_reminder: boolean;
  goal_reminder: boolean;
  low_balance_alert: boolean;
  low_balance_threshold: number;
  weekly_summary: boolean;
  challenge_reminder: boolean;
  category_limit_alert: boolean;
}

const DEFAULT_SETTINGS: Omit<NotificationSettings, "id" | "user_id"> = {
  bill_due_reminder: true,
  bill_due_days_before: 3,
  invoice_reminder: true,
  goal_reminder: true,
  low_balance_alert: true,
  low_balance_threshold: 100,
  weekly_summary: true,
  challenge_reminder: true,
  category_limit_alert: true,
};

// ── Fetch notifications ──
export async function fetchNotifications(userId: string, limit = 30): Promise<AppNotification[]> {
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as AppNotification[] | null) ?? [];
}

export async function countUnread(userId: string): Promise<number> {
  const { count } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);
  return count ?? 0;
}

export async function markAsRead(notificationId: string) {
  await supabase.from("notifications").update({ is_read: true } as any).eq("id", notificationId);
}

export async function deleteNotification(notificationId: string) {
  await supabase.from("notifications").delete().eq("id", notificationId);
}

// Marks a notification and any older copies about the same item as read.
export async function markRelatedAsRead(userId: string, notification: { id: string; category: string; related_id: string | null }) {
  if (!notification.related_id) return markAsRead(notification.id);
  await supabase
    .from("notifications")
    .update({ is_read: true } as any)
    .eq("user_id", userId)
    .eq("category", notification.category)
    .eq("related_id", notification.related_id)
    .eq("is_read", false);
}

export async function markAllAsRead(userId: string) {
  await supabase.from("notifications").update({ is_read: true } as any).eq("user_id", userId).eq("is_read", false);
}

// ── Settings ──
export async function getOrCreateSettings(userId: string): Promise<NotificationSettings> {
  const { data } = await supabase
    .from("notification_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (data) return data as unknown as NotificationSettings;

  const { data: created } = await supabase
    .from("notification_settings")
    .insert({ user_id: userId, ...DEFAULT_SETTINGS } as any)
    .select()
    .single();

  return (created as unknown as NotificationSettings) ?? { id: "", user_id: userId, ...DEFAULT_SETTINGS };
}

export async function updateSettings(id: string, updates: Partial<Omit<NotificationSettings, "id" | "user_id">>) {
  await supabase.from("notification_settings").update(updates as any).eq("id", id);
}

// ── Generate notifications (runs on dashboard load) ──
// Several components mount useNotifications at once, so concurrent calls for the
// same user share one run instead of each inserting its own copies.
const generationRuns = new Map<string, Promise<void>>();

export function generateNotifications(userId: string) {
  const inFlight = generationRuns.get(userId);
  if (inFlight) return inFlight;

  const run = runGenerateNotifications(userId).finally(() => generationRuns.delete(userId));
  generationRuns.set(userId, run);
  return run;
}

// Re-alert about the same item only when the previous alert was read and is older than this.
const RENOTIFY_AFTER_MS = 24 * 60 * 60 * 1000;

async function runGenerateNotifications(userId: string) {
  const settings = await getOrCreateSettings(userId);
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const noDataResult = Promise.resolve({ data: null } as const);

  const billFutureDate = new Date(today);
  billFutureDate.setDate(billFutureDate.getDate() + settings.bill_due_days_before);
  const billFutureDateStr = billFutureDate.toISOString().split("T")[0];

  const goalFutureDate = new Date(today);
  goalFutureDate.setDate(goalFutureDate.getDate() + 7);
  const goalFutureDateStr = goalFutureDate.toISOString().split("T")[0];

  const [pendingBillsResult, invoicesResult, goalsResult, accountsResult] = await Promise.all([
    settings.bill_due_reminder
      ? supabase
          .from("transactions")
          .select("id, name, date, amount")
          .eq("user_id", userId)
          .eq("status", "pendente")
          .eq("type", "despesa")
          .neq("payment_method", "cartao")
          .is("credit_card_id", null)
          .gte("date", todayStr)
          .lte("date", billFutureDateStr)
          .limit(20)
      : noDataResult,
    settings.invoice_reminder
      ? supabase
          .from("invoices")
          .select("id, month, year, total_amount, credit_card_id")
          .eq("user_id", userId)
          .eq("is_paid", false)
          .eq("month", today.getMonth() + 1)
          .eq("year", today.getFullYear())
          .gt("total_amount", 0)
          .limit(10)
      : noDataResult,
    settings.goal_reminder
      ? supabase
          .from("goals")
          .select("id, name, deadline, current_amount, target_amount")
          .eq("user_id", userId)
          .not("deadline", "is", null)
          .gte("deadline", todayStr)
          .lte("deadline", goalFutureDateStr)
          .limit(10)
      : noDataResult,
    settings.low_balance_alert
      ? supabase
          .from("accounts")
          .select("id, name, current_balance")
          .eq("user_id", userId)
          .eq("is_active", true)
          .neq("type", "investimento")
          .lt("current_balance", settings.low_balance_threshold)
      : noDataResult,
  ]);

  const pendingBills = pendingBillsResult.data ?? [];
  const invoices = invoicesResult.data ?? [];
  const goals = goalsResult.data ?? [];
  const accounts = accountsResult.data ?? [];

  const fetchExistingRelatedIds = async (relatedIds: string[], category: string) => {
    if (relatedIds.length === 0) return new Set<string>();

    const renotifyCutoff = new Date(Date.now() - RENOTIFY_AFTER_MS).toISOString();
    const { data } = await supabase
      .from("notifications")
      .select("related_id")
      .eq("user_id", userId)
      .eq("category", category)
      .in("related_id", relatedIds)
      .or(`is_read.eq.false,created_at.gte.${renotifyCutoff}`);

    return new Set((data ?? []).map((item) => item.related_id).filter(Boolean) as string[]);
  };

  const creditCardIds = [...new Set(invoices.map((invoice) => invoice.credit_card_id).filter(Boolean))] as string[];

  const [existingBillIds, existingInvoiceIds, existingGoalIds, existingBalanceIds, creditCardsResult] = await Promise.all([
    fetchExistingRelatedIds(pendingBills.map((bill) => bill.id), "vencimento"),
    fetchExistingRelatedIds(invoices.map((invoice) => invoice.id), "fatura"),
    fetchExistingRelatedIds(goals.map((goal) => goal.id), "meta"),
    fetchExistingRelatedIds(accounts.map((account) => account.id), "saldo"),
    creditCardIds.length
      ? supabase.from("credit_cards").select("id, due_day, name").in("id", creditCardIds)
      : noDataResult,
  ]);

  const cardsById = new Map<string, { id: string; due_day: number; name: string }>(
    ((creditCardsResult.data ?? []) as Array<{ id: string; due_day: number; name: string }>).map((card) => [card.id, card])
  );
  const notifications: Array<{
    user_id: string;
    title: string;
    message: string;
    type: string;
    category: string;
    related_id: string;
  }> = [];

  for (const bill of pendingBills) {
    if (existingBillIds.has(bill.id)) continue;

    const daysUntil = Math.ceil((new Date(bill.date).getTime() - today.getTime()) / 86400000);
    notifications.push({
      user_id: userId,
      title: daysUntil === 0 ? "Conta vence hoje!" : `Conta vence em ${daysUntil} dia${daysUntil > 1 ? "s" : ""}`,
      message: `${bill.name} — ${currencySymbol()} ${Number(bill.amount).toFixed(2).replace(".", ",")}`,
      type: daysUntil === 0 ? "alert" : "warning",
      category: "vencimento",
      related_id: bill.id,
    });
  }

  for (const invoice of invoices) {
    if (existingInvoiceIds.has(invoice.id)) continue;

    const card = cardsById.get(invoice.credit_card_id);
    if (!card) continue;

    const dueDate = new Date(invoice.year, invoice.month - 1, card.due_day);
    const daysUntil = Math.ceil((dueDate.getTime() - today.getTime()) / 86400000);
    if (daysUntil < 0 || daysUntil > settings.bill_due_days_before) continue;

    notifications.push({
      user_id: userId,
      title: daysUntil === 0 ? "Fatura vence hoje!" : `Fatura vence em ${daysUntil} dia${daysUntil > 1 ? "s" : ""}`,
      message: `${card.name} — ${currencySymbol()} ${Number(invoice.total_amount).toFixed(2).replace(".", ",")}`,
      type: daysUntil <= 1 ? "alert" : "warning",
      category: "fatura",
      related_id: invoice.id,
    });
  }

  for (const goal of goals) {
    if (existingGoalIds.has(goal.id) || goal.current_amount >= goal.target_amount || !goal.deadline) continue;

    const daysLeft = Math.ceil((new Date(goal.deadline).getTime() - today.getTime()) / 86400000);
    const pct = Math.round((goal.current_amount / goal.target_amount) * 100);
    notifications.push({
      user_id: userId,
      title: `Meta "${goal.name}" vence em ${daysLeft} dias`,
      message: `Progresso: ${pct}% — faltam ${currencySymbol()} ${(goal.target_amount - goal.current_amount).toFixed(2).replace(".", ",")}`,
      type: "info",
      category: "meta",
      related_id: goal.id,
    });
  }

  for (const account of accounts) {
    if (existingBalanceIds.has(account.id)) continue;

    notifications.push({
      user_id: userId,
      title: "Saldo baixo",
      message: `${account.name} está com ${currencySymbol()} ${Number(account.current_balance).toFixed(2).replace(".", ",")}`,
      type: "warning",
      category: "saldo",
      related_id: account.id,
    });
  }

  if (notifications.length > 0) {
    await supabase.from("notifications").insert(notifications as any);
  }
}
