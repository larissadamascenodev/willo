import { supabase } from "@/integrations/supabase/client";
import { getAccounts, getCreditCards } from "@/services/transactionService";
import { getCustomCategories, type CustomCategory } from "@/services/categoryService";
import { getRecurringForMonth } from "@/services/recurringService";
import { dayOfMonth } from "@/lib/dateOnly";
import { chargeStartsAfterMonth } from "@/lib/installments";

/** Uma linha da lista de transações do mês (a que a tela de Transações mostra). */
export type TransactionRow = {
  id: string;
  name: string;
  category: string;
  date: string;
  time?: string | null;
  amount: number;
  type: string;
  status: string;
  payment_method: string;
  recurrence_type: string;
  installment_current: number | null;
  installments: number | null;
  observation: string | null;
  account_id: string | null;
  credit_card_id: string | null;
  created_at?: string;
};

export type AccountRow = {
  id: string;
  name: string;
  type: string;
  is_default: boolean;
  color: string | null;
  created_at?: string;
  initial_balance?: number;
};

export interface MonthTransactions {
  transactions: TransactionRow[];
  accounts: AccountRow[];
  creditCards: any[];
  customCategories: CustomCategory[];
}

/**
 * Tudo o que a lista de Transações mostra num mês: lançamentos do mês, contas fixas
 * materializadas, uma linha por fatura de cartão (no lugar das compras) e o saldo inicial das
 * contas criadas no mês. Usado pelo site e pelo app, para as duas telas contarem a mesma coisa.
 */
export async function loadMonthTransactions(month: number, year: number): Promise<MonthTransactions> {
    const start = new Date(year, month, 1).toISOString().split("T")[0];
    const end = new Date(year, month + 1, 0).toISOString().split("T")[0];

    const [txRes, accRes, recurringTxs, creditCardsRes, invoicesRes, customCats] = await Promise.all([
      supabase
        .from("transactions")
        .select("*")
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: false })
        .order("created_at", { ascending: true }),
      getAccounts(),
      getRecurringForMonth(month, year),
      getCreditCards(),
      supabase
        .from("invoices")
        .select("credit_card_id, total_amount, is_paid, paid_amount")
        .eq("month", month + 1)
        .eq("year", year),
      getCustomCategories(),
    ]);

    if (txRes.error || invoicesRes.error) throw new Error("Erro ao carregar transações");

    let baseTxs = (txRes.data as TransactionRow[]) ?? [];
    const invoices = invoicesRes.data ?? [];
    const validInvoiceMap = new Map(
      invoices
        .filter((invoice) => Number(invoice.total_amount) > 0)
        .map((invoice) => [invoice.credit_card_id, invoice])
    );

    const fixaIds = baseTxs.filter((t) => t.recurrence_type === "fixa").map((t) => t.id);
    if (fixaIds.length > 0) {
      const { data: exclusions } = await supabase
        .from("recurring_exclusions")
        .select("transaction_id")
        .eq("month", month)
        .eq("year", year)
        .in("transaction_id", fixaIds);

      if (exclusions && exclusions.length > 0) {
        const excludedIds = new Set(exclusions.map((e: any) => e.transaction_id));
        baseTxs = baseTxs.filter((t) => !excludedIds.has(t.id));
      }
    }

    baseTxs = baseTxs.filter((t) => {
      if (t.payment_method === "cartao" && t.credit_card_id) {
        return validInvoiceMap.has(t.credit_card_id) && !chargeStartsAfterMonth(t, month, year);
      }
      return true;
    });

    const now = new Date();
    const isFutureMonth = year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth());
    const materializedRecurring = recurringTxs.map((t: any) => ({
      ...t,
      date: `${year}-${String(month + 1).padStart(2, "0")}-${String(dayOfMonth(t.date)).padStart(2, "0")}`,
      status: isFutureMonth ? "pendente" : t.status,
      _isRecurringMaterialized: true,
    })) as TransactionRow[];

    const regularTxs = baseTxs.filter((t) => t.payment_method !== "cartao");
    const ccTxs = baseTxs.filter((t) => t.payment_method === "cartao" && t.credit_card_id);
    const recurringCcTxs = materializedRecurring.filter((t) => t.payment_method === "cartao" && t.credit_card_id);
    const allCcTxs = [...ccTxs, ...recurringCcTxs];

    const cardMap = new Map((creditCardsRes as any[]).map((c: any) => [c.id, c]));
    const faturaGroups = new Map<string, { total: number; count: number; card: any }>();

    for (const t of allCcTxs) {
      const cardId = t.credit_card_id!;
      const existing = faturaGroups.get(cardId) || { total: 0, count: 0, card: cardMap.get(cardId) };
      existing.total += Number(t.amount);
      existing.count += 1;
      faturaGroups.set(cardId, existing);
    }

    const faturaEntries: TransactionRow[] = [];
    for (const [cardId, info] of faturaGroups.entries()) {
      const invoice = validInvoiceMap.get(cardId);
      if (!invoice) continue;

      const cardName = info.card?.name || "Cartão";
      const dueDay = info.card?.due_day || 1;
      const invoiceTotal = Number(invoice.total_amount);
      const invoicePaid = Number((invoice as any).paid_amount ?? 0);
      const outstanding = Math.max(0, invoiceTotal - invoicePaid);

      faturaEntries.push({
        id: `fatura-${cardId}-${month}-${year}`,
        name: `Fatura ${cardName}`,
        category: "Cartão de Crédito",
        date: `${year}-${String(month + 1).padStart(2, "0")}-${String(dueDay).padStart(2, "0")}`,
        amount: outstanding > 0 ? outstanding : invoiceTotal,
        type: "despesa",
        status: invoice.is_paid ? "pago" : "pendente",
        payment_method: "cartao",
        recurrence_type: "unica",
        installment_current: null,
        installments: null,
        observation: null,
        account_id: null,
        credit_card_id: cardId,
      });
    }

    for (const card of creditCardsRes as any[]) {
      if (faturaGroups.has(card.id)) continue;
      const invoice = validInvoiceMap.get(card.id);
      if (!invoice || Number(invoice.total_amount) <= 0) continue;

      faturaEntries.push({
        id: `fatura-${card.id}-${month}-${year}`,
        name: `Fatura ${card.name}`,
        category: "Cartão de Crédito",
        date: `${year}-${String(month + 1).padStart(2, "0")}-${String(card.due_day || 1).padStart(2, "0")}`,
        amount: Math.max(0, Number(invoice.total_amount) - Number((invoice as any).paid_amount ?? 0)) || Number(invoice.total_amount),
        type: "despesa",
        status: invoice.is_paid ? "pago" : "pendente",
        payment_method: "cartao",
        recurrence_type: "unica",
        installment_current: null,
        installments: null,
        observation: null,
        account_id: null,
        credit_card_id: card.id,
      });
    }

    const regularRecurring = materializedRecurring.filter((t) => t.payment_method !== "cartao");

    const initialBalanceEntries: TransactionRow[] = (accRes as any[])
      .filter((account: any) => {
        const initialBalance = Number(account.initial_balance ?? 0);
        return Number.isFinite(initialBalance) && initialBalance !== 0;
      })
      .filter((account: any) => {
        const createdAt = new Date(account.created_at);
        return createdAt.getFullYear() === year && createdAt.getMonth() === month;
      })
      .map((account: any) => ({
        id: `initial-balance-${account.id}`,
        name: `Conta adicionada · ${account.name}`,
        category: "Saldo inicial",
        date: new Date(account.created_at).toISOString().split("T")[0],
        amount: Number(account.initial_balance),
        type: "receita",
        status: "pago",
        payment_method: "conta",
        recurrence_type: "unica",
        installment_current: null,
        installments: null,
        observation: `Saldo inicial da conta ${account.name}`,
        account_id: account.id,
        credit_card_id: null,
      }));

    const transactions = [...initialBalanceEntries, ...regularTxs, ...faturaEntries, ...regularRecurring];

    return {
      transactions,
      accounts: accRes as AccountRow[],
      creditCards: creditCardsRes as any[],
      customCategories: customCats,
    };
}
