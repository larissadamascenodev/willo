import { supabase } from "@/integrations/supabase/client";
import { getRecurringForMonth } from "@/services/recurringService";
import { getCustomCategories, type CustomCategory } from "@/services/categoryService";
import { dayOfMonth } from "@/lib/dateOnly";

/**
 * A month's spending, broken down by category.
 *
 * Almost everything hard about this screen happens before anything is drawn, and
 * it is hard for one reason: a purchase on a card belongs to the month its invoice
 * falls in, not the month it was made. So a card transaction is counted only when
 * an invoice item for this month points at it — and a card transaction dated last
 * month whose invoice lands in this one is pulled in even though its own date says
 * otherwise. Getting that wrong moves real money between months, which is why it is
 * settled here and not twice.
 *
 * Fixed entries are materialised the same way the rest of the app materialises
 * them: they repeat into the month without a row of their own, and the totals have
 * already counted them.
 */

export interface AnalyticsTransaction {
  id: string;
  name: string;
  category: string;
  date: string;
  amount: number;
  type: string;
  status?: string;
  payment_method?: string;
  credit_card_id?: string | null;
  installments?: number | null;
  installment_current?: number | null;
  parent_transaction_id?: string | null;
  recurrence_type?: string;
}

export interface HistoricalEntry {
  month: number;
  year: number;
  amount: number;
}

export type HistoricalMap = Record<string, HistoricalEntry[]>;

export interface InstallmentImpactItem {
  name: string;
  amount: number;
  remaining: number;
  total: number;
  paidInstallments: number;
}

export interface InstallmentImpact {
  category: string;
  /** What the open instalments in this category take every month. */
  monthlyAmount: number;
  totalRemaining: number;
  monthsRemaining: number;
  /** Share of the category's month that is instalments of older purchases. */
  impactPct: number;
  items: InstallmentImpactItem[];
}

export interface CategoryAnalytics {
  transactions: AnalyticsTransaction[];
  prevTransactions: AnalyticsTransaction[];
  /** Six months of each category, oldest first, with empty months filled in. */
  historical: HistoricalMap;
  installmentImpacts: Record<string, InstallmentImpact>;
  customCats: CustomCategory[];
  /** When the account was opened — months before it are not a real zero. */
  userStartDate: Date | null;
}

const dayKey = (d: Date) => d.toISOString().split("T")[0];

export async function loadCategoryAnalytics({
  userId,
  month,
  year,
}: {
  userId: string;
  /** Zero-based, as the month context keeps it. */
  month: number;
  year: number;
}): Promise<CategoryAnalytics> {
  const start = dayKey(new Date(year, month, 1));
  const end = dayKey(new Date(year, month + 1, 0));

  const prevM = month === 0 ? 11 : month - 1;
  const prevY = month === 0 ? year - 1 : year;
  const prevStart = dayKey(new Date(prevY, prevM, 1));
  const prevEnd = dayKey(new Date(prevY, prevM + 1, 0));

  const histStart = dayKey(new Date(year, month - 5, 1));
  const histMonths = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(year, month - 5 + i, 1);
    return { m1: d.getMonth() + 1, y: d.getFullYear() };
  });

  const [
    txRes,
    prevTxRes,
    histRes,
    installmentRes,
    invoiceItemsRes,
    prevInvoiceItemsRes,
    histInvoiceItemsRes,
    profileRes,
    recurring,
    prevRecurring,
    customCats,
  ] = await Promise.all([
    supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: false }),
    supabase.from("transactions").select("*").eq("user_id", userId).gte("date", prevStart).lte("date", prevEnd),
    /* The history of what did not go on a card can be read off the dates. */
    supabase
      .from("transactions")
      .select("id,category,date,amount,type,payment_method,credit_card_id")
      .eq("user_id", userId)
      .eq("type", "despesa")
      .eq("payment_method", "conta")
      .gte("date", histStart)
      .lte("date", end),
    supabase
      .from("transactions")
      .select(
        "id,name,category,amount,date,installments,installment_current,parent_transaction_id,recurrence_type,payment_method,credit_card_id",
      )
      .eq("user_id", userId)
      .eq("recurrence_type", "parcelado")
      .eq("type", "despesa")
      .gte("date", start),
    supabase
      .from("invoice_items")
      .select(
        "*, invoices!inner(month, year, user_id, credit_card_id, is_paid), transactions!inner(name, category, amount, type, payment_method, installments, installment_current, parent_transaction_id, recurrence_type)",
      )
      .eq("invoices.user_id", userId)
      .eq("invoices.month", month + 1)
      .eq("invoices.year", year),
    supabase
      .from("invoice_items")
      .select("*, invoices!inner(month, year, user_id), transactions!inner(name, category, amount, type)")
      .eq("invoices.user_id", userId)
      .eq("invoices.month", prevM + 1)
      .eq("invoices.year", prevY),
    /* Card history has to go by the invoice's month, not the purchase's date. */
    supabase
      .from("invoice_items")
      .select("amount, invoices!inner(month, year, user_id), transactions!inner(category, type)")
      .eq("invoices.user_id", userId)
      .gte("invoices.year", histMonths[0].y)
      .lte("invoices.year", histMonths[histMonths.length - 1].y),
    supabase.from("profiles").select("created_at").eq("id", userId).single(),
    getRecurringForMonth(month, year),
    getRecurringForMonth(prevM, prevY),
    getCustomCategories(),
  ]);

  const userStartDate = profileRes.data?.created_at ? new Date(profileRes.data.created_at) : null;

  const materialise = (rows: any[], m: number, y: number) =>
    rows.map((t) => ({
      ...t,
      date: `${y}-${String(m + 1).padStart(2, "0")}-${String(dayOfMonth(t.date)).padStart(2, "0")}`,
    })) as AnalyticsTransaction[];

  const invoiceItems = (invoiceItemsRes.data ?? []) as any[];
  const invoiceTxIds = new Set(invoiceItems.map((ii) => ii.transaction_id));

  /* A card purchase only counts in the month its invoice falls in. */
  const baseTxs = (txRes.data ?? []) as AnalyticsTransaction[];
  const filteredBase = baseTxs.filter((tx) =>
    tx.payment_method === "cartao" && tx.credit_card_id ? invoiceTxIds.has(tx.id) : true,
  );

  /* And a purchase made earlier whose invoice lands here belongs here. */
  const seen = new Set(filteredBase.map((t) => t.id));
  const missing = [...invoiceTxIds].filter((id) => !seen.has(id as string));
  let extra: AnalyticsTransaction[] = [];
  if (missing.length > 0) {
    const { data } = await supabase.from("transactions").select("*").eq("user_id", userId).in("id", missing);
    extra = (data ?? []) as AnalyticsTransaction[];
  }

  const prevInvoiceTxIds = new Set((prevInvoiceItemsRes.data ?? []).map((ii: any) => ii.transaction_id));
  const prevBase = ((prevTxRes.data ?? []) as AnalyticsTransaction[]).filter((tx) =>
    tx.payment_method === "cartao" && tx.credit_card_id ? prevInvoiceTxIds.has(tx.id) : true,
  );

  return {
    transactions: [...filteredBase, ...extra, ...materialise(recurring as any[], month, year)],
    prevTransactions: [...prevBase, ...materialise(prevRecurring as any[], prevM, prevY)],
    historical: buildHistorical({
      rows: (histRes.data ?? []) as any[],
      invoiceItems: (histInvoiceItemsRes.data ?? []) as any[],
      histMonths,
      month,
      year,
      userStartDate,
    }),
    installmentImpacts: buildInstallmentImpacts({
      invoiceItems,
      installmentRows: (installmentRes.data ?? []) as any[],
      month,
      year,
    }),
    customCats,
    userStartDate,
  };
}

function buildHistorical({
  rows,
  invoiceItems,
  histMonths,
  month,
  year,
  userStartDate,
}: {
  rows: { category: string; date: string; amount: number }[];
  invoiceItems: any[];
  histMonths: { m1: number; y: number }[];
  month: number;
  year: number;
  userStartDate: Date | null;
}): HistoricalMap {
  const map: HistoricalMap = {};

  const add = (category: string, m: number, y: number, amount: number) => {
    if (!map[category]) map[category] = [];
    const existing = map[category].find((e) => e.month === m && e.year === y);
    if (existing) existing.amount += amount;
    else map[category].push({ month: m, year: y, amount });
  };

  rows.forEach((tx) => {
    const d = new Date(`${tx.date}T12:00:00`);
    add(tx.category, d.getMonth(), d.getFullYear(), tx.amount);
  });

  invoiceItems.forEach((ii) => {
    const tx = ii.transactions;
    const inv = ii.invoices;
    if (!tx || tx.type !== "despesa" || !inv) return;
    if (!histMonths.some((hm) => hm.m1 === inv.month && hm.y === inv.year)) return;
    add(tx.category, inv.month - 1, inv.year, ii.amount);
  });

  Object.values(map).forEach((arr) => arr.sort((a, b) => a.year - b.year || a.month - b.month));

  /* Months before the account existed are not a zero — there was simply nothing to
     record — so they are left out rather than drawn as a flat floor. */
  const startMonth = userStartDate ? userStartDate.getMonth() : 0;
  const startYear = userStartDate ? userStartDate.getFullYear() : 2000;

  const slots: { month: number; year: number }[] = [];
  for (let i = -5; i <= 0; i++) {
    const d = new Date(year, month + i, 1);
    const m = d.getMonth();
    const y = d.getFullYear();
    if (userStartDate && (y < startYear || (y === startYear && m < startMonth))) continue;
    slots.push({ month: m, year: y });
  }

  Object.keys(map).forEach((cat) => {
    map[cat] = slots.map(
      (slot) => map[cat].find((e) => e.month === slot.month && e.year === slot.year) ?? { ...slot, amount: 0 },
    );
  });

  return map;
}

function buildInstallmentImpacts({
  invoiceItems,
  installmentRows,
  month,
  year,
}: {
  invoiceItems: any[];
  installmentRows: any[];
  month: number;
  year: number;
}): Record<string, InstallmentImpact> {
  const groups = new Map<
    string,
    { name: string; category: string; amount: number; total: number; paidInstallments: number }
  >();

  /* On a card, an instalment counts as paid only once its invoice is. */
  invoiceItems.forEach((ii) => {
    const tx = ii.transactions;
    if (!tx || tx.type !== "despesa" || ii.total_installments <= 1) return;
    const groupId = tx.parent_transaction_id ?? ii.transaction_id;
    if (groups.has(groupId)) return;

    const paidInstallments = Math.max(
      0,
      Math.min(
        ii.total_installments,
        (ii.invoices?.is_paid ? ii.installment_number : ii.installment_number - 1) ?? 0,
      ),
    );

    groups.set(groupId, {
      name: tx.name,
      category: tx.category,
      amount: ii.amount,
      total: ii.total_installments,
      paidInstallments,
    });
  });

  installmentRows.forEach((tx) => {
    if (!tx.installments || tx.installments <= 1) return;
    if (tx.payment_method === "cartao" && tx.credit_card_id) return;
    const groupId = tx.parent_transaction_id ?? tx.id;
    if (groups.has(groupId)) return;
    const d = new Date(`${tx.date}T12:00:00`);
    if (d.getMonth() !== month || d.getFullYear() !== year) return;
    groups.set(groupId, {
      name: tx.name,
      category: tx.category,
      amount: tx.amount,
      total: tx.installments,
      paidInstallments: Math.max(0, Math.min(tx.installments, tx.installment_current ?? 1)),
    });
  });

  const impacts: Record<string, InstallmentImpact> = {};
  groups.forEach(({ name, category, amount, total, paidInstallments }) => {
    const remaining = Math.max(total - paidInstallments, 0);
    if (remaining <= 0) return;
    if (!impacts[category]) {
      impacts[category] = {
        category,
        monthlyAmount: 0,
        totalRemaining: 0,
        monthsRemaining: 0,
        impactPct: 0,
        items: [],
      };
    }
    impacts[category].monthlyAmount += amount;
    impacts[category].totalRemaining += amount * remaining;
    impacts[category].monthsRemaining = Math.max(impacts[category].monthsRemaining, remaining);
    impacts[category].items.push({ name, amount, remaining, total, paidInstallments });
  });

  return impacts;
}

/* ──────────────────────────────────────────────────────────────────────────────
   What the month says, once the rows are in.
   ────────────────────────────────────────────────────────────────────────────── */

export interface CategorySummary {
  name: string;
  amount: number;
  percentage: number;
  txCount: number;
  avgPerTx: number;
}

export function buildCategorySummaries(transactions: AnalyticsTransaction[]): CategorySummary[] {
  const map = new Map<string, { amount: number; count: number }>();
  transactions
    .filter((t) => t.type === "despesa")
    .forEach((t) => {
      const existing = map.get(t.category) ?? { amount: 0, count: 0 };
      map.set(t.category, { amount: existing.amount + t.amount, count: existing.count + 1 });
    });

  const total = Array.from(map.values()).reduce((s, v) => s + v.amount, 0);

  return Array.from(map.entries())
    .sort((a, b) => b[1].amount - a[1].amount)
    .map(([name, { amount, count }]) => ({
      name,
      amount,
      percentage: total > 0 ? Math.round((amount / total) * 100) : 0,
      txCount: count,
      avgPerTx: count > 0 ? amount / count : 0,
    }));
}

export type CategoryScore = "saudavel" | "atencao" | "exagerado";

export interface CategoryScoreData {
  score: CategoryScore;
  percentage: number;
  /** Against the same category last month. Null when there was nothing to compare. */
  variation: number | null;
  txCount: number;
}

/**
 * Whether a category is out of hand.
 *
 * Three independent signals, any one of which is enough: how much of the month it
 * takes, how much it grew, and how often it was charged. The thresholds are the
 * ones the app has always used.
 */
export function computeCategoryScore(
  pct: number,
  variation: number | null,
  txCount: number,
): CategoryScore {
  if (pct > 30 || (variation !== null && variation > 25) || txCount >= 10) return "exagerado";
  if (
    (pct >= 15 && pct <= 30) ||
    (variation !== null && variation >= 10 && variation <= 25) ||
    (txCount >= 6 && txCount <= 9)
  ) {
    return "atencao";
  }
  return "saudavel";
}

export function buildScoreMap(
  categories: CategorySummary[],
  previous: { name: string; amount: number }[],
): Record<string, CategoryScoreData> {
  const result: Record<string, CategoryScoreData> = {};
  categories.forEach((cat) => {
    const prevAmount = previous.find((p) => p.name === cat.name)?.amount ?? 0;
    const variation = prevAmount > 0 ? Math.round(((cat.amount - prevAmount) / prevAmount) * 100) : null;
    result[cat.name] = {
      score: computeCategoryScore(cat.percentage, variation, cat.txCount),
      percentage: cat.percentage,
      variation,
      txCount: cat.txCount,
    };
  });
  return result;
}

export interface HabitData {
  category: string;
  txCount: number;
  /** What it costs per day so far this month. */
  dailyCost: number;
  isHabit: boolean;
  topMerchant: { name: string; count: number } | null;
  amount: number;
}

export function buildHabitMap(
  transactions: AnalyticsTransaction[],
  month: number,
  year: number,
  now = new Date(),
): Record<string, HabitData> {
  const isCurrentMonth = month === now.getMonth() && year === now.getFullYear();
  const daysElapsed = isCurrentMonth
    ? Math.max(now.getDate(), 1)
    : new Date(year, month + 1, 0).getDate();

  const byCategory = new Map<string, { amount: number; txCount: number; names: Map<string, number> }>();
  transactions
    .filter((t) => t.type === "despesa")
    .forEach((t) => {
      const entry = byCategory.get(t.category) ?? { amount: 0, txCount: 0, names: new Map() };
      entry.amount += t.amount;
      entry.txCount += 1;
      entry.names.set(t.name, (entry.names.get(t.name) ?? 0) + 1);
      byCategory.set(t.category, entry);
    });

  const result: Record<string, HabitData> = {};
  byCategory.forEach((data, category) => {
    let top: { name: string; count: number } | null = null;
    data.names.forEach((count, name) => {
      if (!top || count > top.count) top = { name, count };
    });
    const merchant = top as { name: string; count: number } | null;

    result[category] = {
      category,
      txCount: data.txCount,
      dailyCost: data.amount / daysElapsed,
      /* Eight charges in a month, or the same place four times, is a routine rather
         than a set of decisions. */
      isHabit: data.txCount >= 8 || (merchant !== null && merchant.count >= 4),
      topMerchant: merchant && merchant.count >= 2 ? merchant : null,
      amount: data.amount,
    };
  });
  return result;
}

/** How much of each category's month is instalments of something bought earlier. */
export function enrichInstallmentImpacts(
  impacts: Record<string, InstallmentImpact>,
  categories: CategorySummary[],
): InstallmentImpact[] {
  return Object.values(impacts).map((imp) => {
    const amount = categories.find((c) => c.name === imp.category)?.amount ?? 0;
    return { ...imp, impactPct: amount > 0 ? Math.round((imp.monthlyAmount / amount) * 100) : 0 };
  });
}
