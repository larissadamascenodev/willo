import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { ArrowUpRight, ArrowDownLeft,
  SlidersHorizontal,
  Trash2, RefreshCw, Layers, X, Search, Plus, Pencil, CreditCard, Wallet,
  Sparkles, Calendar as CalendarIcon, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMonth } from "@/contexts/MonthContext";
import { deleteTransaction, getAccounts, updateTransaction, updateTransactionStatus, getCreditCards } from "@/services/transactionService";
import { getCustomCategories, type CustomCategory } from "@/services/categoryService";
import { getCategoryIcon, getCategoryColor } from "@/lib/categoryUtils";
import { useFinanceData } from "@/hooks/useFinanceData";
import { getRecurringForMonth, excludeRecurringForMonth, excludeRecurringFromMonthOnward } from "@/services/recurringService";
import { dayOfMonth } from "@/lib/dateOnly";
import { chargeStartsAfterMonth } from "@/lib/installments";
import MonthSelector from "@/components/dashboard/MonthSelector";
import SaldoCard from "@/components/dashboard/SaldoCard";
import ReceitasDespesasCards from "@/components/dashboard/ReceitasDespesasCards";
import NovaTransacaoModal, { type EditTransactionData } from "@/components/dashboard/NovaTransacaoModal";
import TransactionTypeChooser from "@/components/dashboard/TransactionTypeChooser";
import CardEntryModal from "@/components/fatura/CardEntryModal";
import FaturaDetailModal from "@/components/fatura/FaturaDetailModal";
import { TransactionListItem, TransactionTabs, TransactionsSummaryCard, formatDateHeader, type TabFilter, type TransactionRow } from "@/components/transactions/TransactionParts";
import type { DashboardData } from "@/types/finance";

import { getCurrency } from "@/lib/currency";
// ── Types ──────────────────────────────────────────────
type AccountRow = { id: string; name: string; type: string; is_default: boolean; color: string | null; created_at?: string; initial_balance?: number; };

type TransactionsPageSnapshot = {
  transactions: TransactionRow[];
  accounts: AccountRow[];
  creditCards: any[];
};

const transactionsPageCache = new Map<string, TransactionsPageSnapshot>();

const buildTransactionsCacheKey = (userId: string | undefined, month: number, year: number) =>
  `${userId ?? "anon"}-${month}-${year}`;

const buildSeedDate = (label: string, month: number, year: number) => {
  const day = Math.min(Math.max(Number(label.match(/\d+/)?.[0] ?? 1), 1), 31);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

const buildSeedTransactions = (data: DashboardData, month: number, year: number): TransactionRow[] => {
  const paid = data.transactions.map((tx) => ({
    id: tx.id,
    name: tx.name,
    category: tx.category,
    date: buildSeedDate(tx.date, month, year),
    amount: Number(tx.amount),
    type: tx.type,
    status: tx.status ?? "pago",
    payment_method: tx.isFatura ? "cartao" : "conta",
    recurrence_type: "unica",
    installment_current: null,
    installments: null,
    observation: null,
    account_id: null,
    credit_card_id: tx.creditCardId ?? null,
  }));

  const pending = data.pendingTransactions.map((tx) => ({
    id: tx.id,
    name: tx.name,
    category: tx.category,
    date: buildSeedDate(tx.date, month, year),
    amount: Number(tx.amount),
    type: tx.type,
    status: tx.status ?? "pendente",
    payment_method: tx.isFatura ? "cartao" : "conta",
    recurrence_type: "unica",
    installment_current: null,
    installments: null,
    observation: null,
    account_id: null,
    credit_card_id: tx.creditCardId ?? null,
  }));

  return [...paid, ...pending].sort((a, b) => b.date.localeCompare(a.date));
};

// ── Helpers ────────────────────────────────────────────
const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });


// ── Edit Modal ─────────────────────────────────────────
// EditTransactionModal removed – replaced by TransactionDetailModal
// ── Main Page ──────────────────────────────────────────
const Transacoes = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { selectedMonth, selectedYear, setMonth } = useMonth();
  const { data: financeData } = useFinanceData(selectedMonth, selectedYear);
  const cacheKey = buildTransactionsCacheKey(user?.id, selectedMonth, selectedYear);
  const seedTransactions = useMemo(
    () => buildSeedTransactions(financeData, selectedMonth, selectedYear),
    [financeData, selectedMonth, selectedYear]
  );
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [creditCards, setCreditCards] = useState<any[]>([]);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<TabFilter>("todos");
  
  const [showFilters, setShowFilters] = useState(false);
  const [filterCategory, setFilterCategory] = useState("todos");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterAccount, setFilterAccount] = useState("todos");

  // Modals
  const [showTypeChooser, setShowTypeChooser] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingTx, setEditingTx] = useState<EditTransactionData | null>(null);
  const [newModalType, setNewModalType] = useState<"receita" | "despesa">("despesa");
  const [detailTx, setDetailTx] = useState<TransactionRow | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TransactionRow | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [faturaDetailTx, setFaturaDetailTx] = useState<TransactionRow | null>(null);
  const [showFaturaDetail, setShowFaturaDetail] = useState(false);

  useEffect(() => {
    const cached = transactionsPageCache.get(cacheKey);

    if (cached) {
      setTransactions(cached.transactions);
      setAccounts(cached.accounts);
      setCreditCards(cached.creditCards);
      setLoading(false);
      return;
    }

    if (seedTransactions.length > 0) {
      setTransactions(seedTransactions);
      setLoading(false);
      return;
    }

    setTransactions([]);
    setAccounts([]);
    setCreditCards([]);
    setLoading(true);
  }, [cacheKey, seedTransactions]);

  const accountMap = useMemo(() => {
    const map: Record<string, string> = {};
    accounts.forEach((a) => (map[a.id] = a.name));
    return map;
  }, [accounts]);

  const fetchData = useCallback(async () => {
    if (!user) return;

    const hasWarmData = transactionsPageCache.has(cacheKey) || seedTransactions.length > 0;
    if (!hasWarmData) {
      setLoading(true);
    }

    const start = new Date(selectedYear, selectedMonth, 1).toISOString().split("T")[0];
    const end = new Date(selectedYear, selectedMonth + 1, 0).toISOString().split("T")[0];

    const [txRes, accRes, recurringTxs, creditCardsRes, invoicesRes, customCats] = await Promise.all([
      supabase
        .from("transactions")
        .select("*")
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: false })
        .order("created_at", { ascending: true }),
      getAccounts(),
      getRecurringForMonth(selectedMonth, selectedYear),
      getCreditCards(),
      supabase
        .from("invoices")
        .select("credit_card_id, total_amount, is_paid, paid_amount")
        .eq("month", selectedMonth + 1)
        .eq("year", selectedYear),
      getCustomCategories(),
    ]);

    if (txRes.error || invoicesRes.error) {
      toast.error("Erro ao carregar transações");
      setLoading(false);
      return;
    }

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
        .eq("month", selectedMonth)
        .eq("year", selectedYear)
        .in("transaction_id", fixaIds);

      if (exclusions && exclusions.length > 0) {
        const excludedIds = new Set(exclusions.map((e: any) => e.transaction_id));
        baseTxs = baseTxs.filter((t) => !excludedIds.has(t.id));
      }
    }

    baseTxs = baseTxs.filter((t) => {
      if (t.payment_method === "cartao" && t.credit_card_id) {
        return validInvoiceMap.has(t.credit_card_id) && !chargeStartsAfterMonth(t, selectedMonth, selectedYear);
      }
      return true;
    });

    const now = new Date();
    const isFutureMonth = selectedYear > now.getFullYear() || (selectedYear === now.getFullYear() && selectedMonth > now.getMonth());
    const materializedRecurring = recurringTxs.map((t: any) => ({
      ...t,
      date: `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(dayOfMonth(t.date)).padStart(2, "0")}`,
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
        id: `fatura-${cardId}-${selectedMonth}-${selectedYear}`,
        name: `Fatura ${cardName}`,
        category: "Cartão de Crédito",
        date: `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(dueDay).padStart(2, "0")}`,
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
        id: `fatura-${card.id}-${selectedMonth}-${selectedYear}`,
        name: `Fatura ${card.name}`,
        category: "Cartão de Crédito",
        date: `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(card.due_day || 1).padStart(2, "0")}`,
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
        return createdAt.getFullYear() === selectedYear && createdAt.getMonth() === selectedMonth;
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

    const nextTransactions = [...initialBalanceEntries, ...regularTxs, ...faturaEntries, ...regularRecurring];
    const nextAccounts = accRes as AccountRow[];
    const nextCreditCards = creditCardsRes as any[];

    transactionsPageCache.set(cacheKey, {
      transactions: nextTransactions,
      accounts: nextAccounts,
      creditCards: nextCreditCards,
    });

    setTransactions(nextTransactions);
    setAccounts(nextAccounts);
    setCreditCards(nextCreditCards);
    setCustomCategories(customCats);
    setLoading(false);
  }, [user, selectedMonth, selectedYear, cacheKey, seedTransactions.length]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Refresh when a transaction is created globally
  useEffect(() => {
    const handler = () => fetchData();
    window.addEventListener("transaction-created", handler);
    window.addEventListener("finance-data-changed", handler);
    return () => {
      window.removeEventListener("transaction-created", handler);
      window.removeEventListener("finance-data-changed", handler);
    };
  }, [fetchData]);

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      if (activeTab !== "todos" && tx.type !== activeTab) return false;
      if (filterCategory !== "todos" && tx.category !== filterCategory) return false;
      if (filterStatus !== "todos" && tx.status !== filterStatus) return false;
      if (filterAccount !== "todos" && tx.account_id !== filterAccount) return false;
      if (search && !tx.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [transactions, activeTab, filterCategory, filterStatus, filterAccount, search]);

  const totals = useMemo(() => {
    return {
      receitas: financeData.receitas,
      despesas: financeData.despesas,
      receitasRecebidas: financeData.receitasRecebidas,
      receitasPendentes: financeData.receitasPendentes,
      despesasPagas: financeData.despesasPagas,
      despesasPendentes: financeData.despesasPendentes,
      saldo: financeData.balanco,
    };
  }, [financeData]);

  const grouped = useMemo(() => {
    const groups: Record<string, TransactionRow[]> = {};
    filtered.forEach((tx) => {
      if (!groups[tx.date]) groups[tx.date] = [];
      groups[tx.date].push(tx);
    });

    for (const date in groups) {
      groups[date].sort((a, b) => {
        const timeA = a.time || "00:00";
        const timeB = b.time || "00:00";
        const timeCompare = timeB.localeCompare(timeA);
        if (timeCompare !== 0) return timeCompare;
        return (b.created_at ?? "").localeCompare(a.created_at ?? "");
      });
    }

    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filtered]);

  const categories = useMemo(() => {
    return [...new Set(transactions.map((t) => t.category))].sort();
  }, [transactions]);

  const handleDelete = async (id: string) => {
    if (id.startsWith("initial-balance-")) {
      toast.info("O saldo inicial é apenas um registro visual da criação da conta.");
      return;
    }

    const tx = transactions.find((t) => t.id === id);
    if (tx && tx.recurrence_type === "fixa") {
      setDeleteTarget(tx);
      setShowDeleteDialog(true);
      return;
    }
    try {
      await deleteTransaction(id);
      setTransactions((prev) => prev.filter((t) => t.id !== id));
      toast.success("Transação removida");
    } catch {
      toast.error("Erro ao remover");
    }
  };

  const handleDeleteFixaThisMonth = async () => {
    if (!deleteTarget || !user) return;
    try {
      const [origY, origM] = deleteTarget.date.split("-").map(Number);
      const isOriginalMonth = (origM - 1 === selectedMonth && origY === selectedYear);

      if (isOriginalMonth) {
        // Move the base transaction to next month so the balance trigger reverses impact
        const origDate = new Date(deleteTarget.date + "T12:00:00");
        const nextMonth = new Date(origDate.getFullYear(), origDate.getMonth() + 1, Math.min(origDate.getDate(), 28));
        const newDateStr = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-${String(nextMonth.getDate()).padStart(2, "0")}`;
        await updateTransaction(deleteTarget.id, { date: newDateStr, status: "pendente" });
      } else {
        await excludeRecurringForMonth(deleteTarget.id, selectedMonth, selectedYear, user.id);
      }
      toast.success("Receita fixa removida deste mês");
      setShowDeleteDialog(false);
      setDeleteTarget(null);
      fetchData();
    } catch {
      toast.error("Erro ao remover");
    }
  };

  const handleDeleteFixaAllFuture = async () => {
    if (!deleteTarget || !user) return;
    try {
      const [origY, origM] = deleteTarget.date.split("-").map(Number);
      const origMonthIndex = origY * 12 + (origM - 1);
      const selectedMonthIndex = selectedYear * 12 + selectedMonth;

      if (origMonthIndex >= selectedMonthIndex) {
        // Original transaction is in or after selected month - delete it entirely
        await deleteTransaction(deleteTarget.id);
      } else {
        await excludeRecurringFromMonthOnward(deleteTarget.id, selectedMonth, selectedYear, user.id);
      }
      toast.success("Receita fixa removida deste mês e de todos os futuros");
      setShowDeleteDialog(false);
      setDeleteTarget(null);
      fetchData();
    } catch {
      toast.error("Erro ao remover");
    }
  };

  const handleTypeSelected = (type: "receita" | "despesa") => {
    setNewModalType(type);
    setShowTypeChooser(false);
    setShowNewModal(true);
  };

  const activeFiltersCount = [filterCategory !== "todos", filterStatus !== "todos", filterAccount !== "todos"].filter(Boolean).length;

  const clearFilters = () => {
    setFilterCategory("todos");
    setFilterStatus("todos");
    setFilterAccount("todos");
    setSearch("");
  };

  const getDayTotal = (txs: TransactionRow[]) => {
    const paid = txs.filter((t) => t.status === "pago");
    const rec = paid.filter((t) => t.type === "receita").reduce((s, t) => s + t.amount, 0);
    const desp = paid.filter((t) => t.type === "despesa").reduce((s, t) => s + t.amount, 0);
    return { rec, desp, net: rec - desp };
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <h1 className="text-[28px] font-extrabold tracking-tight text-white">Transações</h1>
        <MonthSelector selectedMonth={selectedMonth} selectedYear={selectedYear} onMonthChange={(m, y) => setMonth(m, y)} />
      </div>

      {/* Summary - desktop */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="hidden md:grid grid-cols-[1.4fr_1fr] gap-3">
        <SaldoCard saldoAtual={financeData.saldoAtual} saldoPrevisto={financeData.saldoPrevisto} isFutureMonth={financeData.isFutureMonth} isPastMonth={financeData.isPastMonth} />
        <ReceitasDespesasCards receitas={totals.receitas} receitasRecebidas={totals.receitasRecebidas} receitasPendentes={totals.receitasPendentes} despesas={totals.despesas} despesasPagas={totals.despesasPagas} despesasPendentes={totals.despesasPendentes} />
      </motion.div>

      {/* Summary - mobile */}
      <TransactionsSummaryCard
        className="md:hidden"
        saldoAtual={financeData.saldoAtual}
        saldoPrevisto={financeData.saldoPrevisto}
        receitas={totals.receitas}
        despesas={totals.despesas}
      />

      {/* Tabs + Search + Filter */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <TransactionTabs value={activeTab} onChange={setActiveTab} />
          <button
            onClick={() => setShowFilters(!showFilters)}
            aria-label="Filtros"
            className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors ${
              activeFiltersCount > 0 || showFilters ? "border-white bg-white text-[#0B0B0B]" : "border-white/[0.07] bg-white/[0.04] text-white/70"
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            {activeFiltersCount > 0 && !showFilters && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-willo-green px-1 text-[9px] font-bold text-[#0B0B0B]">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
          <input
            type="text"
            placeholder="Buscar transação..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 w-full rounded-full border border-white/[0.07] bg-white/[0.04] pl-11 pr-10 text-[14px] text-white transition-colors placeholder:text-white/35 focus:border-white/25 focus:outline-none"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-4 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-white/56" />
            </button>
          )}
        </div>
      </div>

      {/* Filters panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="overflow-hidden"
          >
            <div className="rounded-[22px] border border-white/[0.08] willo-glass p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-semibold text-white">Filtros</span>
                {activeFiltersCount > 0 && (
                  <button onClick={clearFilters} className="text-[13px] text-white/74">Limpar</button>
                )}
              </div>

              {/* Status */}
              <div>
                <p className="text-[12px] text-white/62 mb-2">Status</p>
                <div className="flex gap-1.5">
                  {["todos", "pago", "pendente"].map((s) => (
                    <button key={s} onClick={() => setFilterStatus(s)}
                      className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-all ${
                        filterStatus === s ? "bg-white text-[#0B0B0B] border border-white" : "bg-white/[0.05] text-white/82 border border-white/[0.06]"
                      }`}
                    >
                      {s === "todos" ? "Todos" : s === "pago" ? "Pago" : "Pendente"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Account */}
              {accounts.length > 0 && (
                <div>
                  <p className="text-[12px] text-white/62 mb-2">Conta</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => setFilterAccount("todos")}
                      className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all ${
                        filterAccount === "todos" ? "bg-white text-[#0B0B0B] border border-white" : "bg-white/[0.05] text-white/82 border border-white/[0.06]"
                      }`}
                    >Todas</button>
                    {accounts.map((a) => (
                      <button key={a.id} onClick={() => setFilterAccount(a.id)}
                        className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all ${
                          filterAccount === a.id ? "bg-white text-[#0B0B0B] border border-white" : "bg-white/[0.05] text-white/82 border border-white/[0.06]"
                        }`}
                      >{a.name}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Category */}
              {categories.length > 0 && (
                <div>
                  <p className="text-[12px] text-white/62 mb-2">Categoria</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => setFilterCategory("todos")}
                      className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all ${
                        filterCategory === "todos" ? "bg-white text-[#0B0B0B] border border-white" : "bg-white/[0.05] text-white/82 border border-white/[0.06]"
                      }`}
                    >Todas</button>
                    {categories.map((c) => (
                      <button key={c} onClick={() => setFilterCategory(c)}
                        className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all ${
                          filterCategory === c ? "bg-white text-[#0B0B0B] border border-white" : "bg-white/[0.05] text-white/82 border border-white/[0.06]"
                        }`}
                      >{c}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Timeline list */}
      {loading && filtered.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-pulse text-white/66 text-sm">Carregando...</div>
        </div>
      ) : filtered.length === 0 && !(selectedMonth === new Date().getMonth() && selectedYear === new Date().getFullYear()) ? (
        <div className="rounded-[22px] border border-white/[0.08] willo-glass p-8 text-center">
          <Layers className="w-6 h-6 text-white/38 mx-auto mb-2" />
          <p className="text-[14px] text-white/66">Nenhuma transação encontrada</p>
          {activeFiltersCount > 0 && (
            <button onClick={clearFilters} className="text-[13px] text-white mt-2 underline underline-offset-4">Limpar filtros</button>
          )}
        </div>
      ) : (
        <div>
          {(() => {
            const now = new Date();
            const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
            const isCurrentMonth = selectedMonth === now.getMonth() && selectedYear === now.getFullYear();
            let finalGroups: [string, TransactionRow[]][] = grouped;
            if (isCurrentMonth && !grouped.some(([date]) => date === todayStr)) {
              finalGroups = ([...grouped, [todayStr, []] as [string, TransactionRow[]]] as [string, TransactionRow[]][]).sort(([a], [b]) => b.localeCompare(a));
            }
            return finalGroups;
          })().map(([date, txs], gi) => {
            const { label, isToday } = formatDateHeader(date);
            const dayTotal = getDayTotal(txs);

            return (
              <div key={date} className={gi > 0 ? "mt-5" : ""}>
                {/* Date header */}
                <div className="mb-2.5 flex items-baseline justify-between gap-3 px-1">
                  <span className={`truncate text-[10.5px] font-semibold uppercase tracking-[0.13em] ${isToday ? "text-white" : "text-white/45"}`}>
                    {isToday ? `Hoje · ${label}` : label}
                  </span>
                  {txs.length > 0 && dayTotal.net !== 0 && (
                    <span className={`shrink-0 text-[12px] font-semibold tabular-nums ${dayTotal.net > 0 ? "text-willo-green" : "text-white/45"}`}>
                      {dayTotal.net > 0 ? "+" : "−"}{fmt(Math.abs(dayTotal.net))}
                    </span>
                  )}
                </div>

                {/* Transactions */}
                {txs.length === 0 && (
                  <div className="rounded-[22px] border border-dashed border-white/[0.09] py-5 text-center text-[13px] text-white/40">
                    Nada registrado hoje
                  </div>
                )}
                <div className={txs.length > 0 ? "overflow-hidden rounded-[22px] border border-white/[0.08] divide-y divide-white/[0.055]" : ""}>
                  {txs.map((tx, i) => (
                    <motion.div
                      key={tx.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04, type: "spring", stiffness: 300, damping: 25 }}
                    >
                      <TransactionListItem
                        tx={tx}
                        accountName={tx.account_id ? (accountMap[tx.account_id] || "Conta") : tx.payment_method === "cartao" ? "Cartão" : "Sem conta"}
                        onDelete={handleDelete}
                        customCategories={customCategories}
                        creditCards={creditCards}
                        onEdit={(t) => {
                          if (t.id.startsWith("initial-balance-")) {
                            toast.info("Esse item mostra quando a conta foi criada com saldo inicial.");
                            return;
                          }
                          if (t.id.startsWith("fatura-") && t.credit_card_id) {
                            setFaturaDetailTx(t);
                            setShowFaturaDetail(true);
                          } else {
                            setDetailTx(t); setShowDetailModal(true);
                          }
                        }}
                      />
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Count */}
      {!loading && filtered.length > 0 && (
        <p className="text-center text-[12px] text-white/45 pt-2 pb-4">
          {filtered.length} transaç{filtered.length === 1 ? "ão" : "ões"} · {grouped.length} dia{grouped.length !== 1 && "s"}
        </p>
      )}

      {/* Detail Modal */}
      {/* Editing reuses the very form that creates a transaction */}
      <NovaTransacaoModal
        open={!!editingTx}
        onClose={() => setEditingTx(null)}
        onSuccess={() => { setEditingTx(null); fetchData(); }}
        initialType={editingTx?.type ?? "despesa"}
        editTransaction={editingTx}
      />

      <CardEntryModal
        entry={detailTx && {
          transactionId: detailTx.id,
          name: detailTx.name,
          category: detailTx.category,
          amount: Number(detailTx.amount),
          date: detailTx.date,
          time: detailTx.time,
          installmentNumber: detailTx.installment_current,
          totalInstallments: detailTx.installments,
          status: detailTx.status === "pago" ? "pago" : "pendente",
          isReceita: detailTx.type === "receita",
        }}
        cardName={detailTx?.payment_method === "cartao" ? "Cartão" : accountMap[detailTx?.account_id ?? ""] ?? "Conta"}
        onClose={() => { setShowDetailModal(false); setDetailTx(null); }}
        onEdit={(id) => {
          const t = detailTx;
          setShowDetailModal(false);
          setDetailTx(null);
          if (t) setEditingTx({
            id: t.id,
            name: t.name,
            type: t.type as "receita" | "despesa",
            amount: Number(t.amount),
            category: t.category,
            date: t.date,
            status: t.status as "pago" | "pendente",
            payment_method: t.payment_method as "conta" | "cartao",
            account_id: t.account_id,
            credit_card_id: t.credit_card_id,
            recurrence_type: t.recurrence_type as "unica" | "parcelado" | "fixa",
            installments: t.installments,
            installment_current: t.installment_current,
            observation: t.observation,
          });
        }}
        onDelete={async (id) => {
          setShowDetailModal(false);
          setDetailTx(null);
          try {
            await deleteTransaction(id);
            toast.success("Lançamento excluído");
            fetchData();
          } catch {
            toast.error("Não foi possível excluir");
          }
        }}
        onToggleStatus={async (id, next) => {
          setShowDetailModal(false);
          setDetailTx(null);
          try {
            await updateTransactionStatus(id, next);
            toast.success(next === "pago" ? "Marcado como pago" : "Marcado como pendente");
            fetchData();
          } catch {
            toast.error("Não foi possível atualizar");
          }
        }}
      />

      {/* Fatura Detail Modal */}
      {(() => {
        const cardData = faturaDetailTx?.credit_card_id
          ? creditCards.find((c: any) => c.id === faturaDetailTx.credit_card_id)
          : null;
        return (
          <FaturaDetailModal
            open={showFaturaDetail}
            onClose={() => { setShowFaturaDetail(false); setFaturaDetailTx(null); }}
            card={cardData ? {
              cardId: cardData.id,
              cardName: cardData.name,
              closingDay: cardData.closing_day,
              dueDay: cardData.due_day,
              color: cardData.color,
              lastFourDigits: cardData.last_four_digits,
            } : null}
            month={selectedMonth}
            year={selectedYear}
            totalAmount={faturaDetailTx?.amount || 0}
            isPaid={faturaDetailTx?.status === "pago"}
            onPaid={fetchData}
          />
        );
      })()}
    </div>
  );
};

export default Transacoes;
