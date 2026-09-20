import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, MoreVertical, Pencil, Trash2, Bell, CalendarDays, Wallet, Tag, RefreshCw, Clock,
  FileText, StickyNote, Check, History, ChevronDown, ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { updateTransactionStatus, updateTransaction, deleteTransaction, getAccounts, createTransaction, getTransactionById } from "@/services/transactionService";
import { excludeRecurringForMonth, excludeRecurringFromMonthOnward } from "@/services/recurringService";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from "@/lib/categoryIcons";
import { getCategoryIcon } from "@/lib/categoryUtils";
import { getCustomCategories, type CustomCategory } from "@/services/categoryService";

import { currencySymbol, getCurrency } from "@/lib/currency";
const CATEGORIES_EXPENSE = DEFAULT_EXPENSE_CATEGORIES;
const CATEGORIES_INCOME = DEFAULT_INCOME_CATEGORIES;

const MONTHS_FULL = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const formatFullDate = (dateStr: string) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${d} de ${MONTHS_FULL[m - 1]} de ${y}`;
};

interface TransactionRow {
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
}

interface AccountRow { id: string; name: string; color: string | null; }

type ModalStep = "detail" | "pay-confirm" | "delete-confirm" | "edit-scope" | "edit-form" | "menu";

interface Props {
  open: boolean;
  tx: TransactionRow | null;
  accountName: string;
  onClose: () => void;
  onRefresh: () => void;
  userId?: string;
  selectedMonth: number;
  selectedYear: number;
}

const TransactionDetailModal = ({ open, tx, accountName, onClose, onRefresh, userId, selectedMonth, selectedYear }: Props) => {
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [step, setStep] = useState<ModalStep>("detail");
  const [loading, setLoading] = useState(false);
  const [editScope, setEditScope] = useState<"this" | "all">("all");

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editAmountCents, setEditAmountCents] = useState(0);
  const [editCategory, setEditCategory] = useState("");
  const [editStatus, setEditStatus] = useState<"pago" | "pendente">("pago");
  const [editDate, setEditDate] = useState<Date>(new Date());
  const [editDateMode, setEditDateMode] = useState<"hoje" | "ontem" | "outros">("outros");
  const [editShowCalendar, setEditShowCalendar] = useState(false);
  const [editObservation, setEditObservation] = useState("");
  const [editAccountId, setEditAccountId] = useState<string>("");
  const [editAccounts, setEditAccounts] = useState<AccountRow[]>([]);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Similar/recurring transactions
  const [similarTxs, setSimilarTxs] = useState<{ id: string; name: string; amount: number; date: string; status: string; category: string }[]>([]);
  const [similarExpanded, setSimilarExpanded] = useState(false);

  useEffect(() => {
    if (open) getCustomCategories().then(setCustomCategories).catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!open || !tx || !user) { setSimilarTxs([]); return; }

    const fetchSimilar = async () => {
      const isRec = tx.recurrence_type === "fixa";
      const now = new Date();
      const endOfYear = `${now.getFullYear()}-12-31`;

      if (isRec) {
        // Fetch all instances of this recurring transaction
        const { data } = await supabase
          .from("transactions")
          .select("id, name, amount, date, status, category")
          .eq("user_id", user.id)
          .eq("name", tx.name)
          .eq("type", tx.type)
          .order("date", { ascending: false })
          .limit(24);
        setSimilarTxs(data || []);
      } else {
        // Find similar by name pattern (first 3+ chars match)
        const namePrefix = tx.name.trim().toLowerCase().slice(0, Math.min(tx.name.length, 15));
        if (namePrefix.length < 3) { setSimilarTxs([]); return; }

        const { data } = await supabase
          .from("transactions")
          .select("id, name, amount, date, status, category")
          .eq("user_id", user.id)
          .eq("type", tx.type)
          .ilike("name", `%${namePrefix}%`)
          .neq("id", tx.id)
          .order("date", { ascending: false })
          .limit(10);
        setSimilarTxs(data || []);
      }
    };

    fetchSimilar();
  }, [open, tx?.id, user]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showDropdown) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showDropdown]);

  if (!tx) return null;

  const isReceita = tx.type === "receita";
  const isPaid = tx.status === "pago";
  const isRecurring = tx.recurrence_type === "fixa";
  const Icon = getCategoryIcon(tx.category, customCategories);

  const handleClose = () => {
    setStep("detail");
    setShowDropdown(false);
    onClose();
  };

  const handlePay = async () => {
    setLoading(true);
    try {
      const dbTx = await getTransactionById(tx.id);
      const isRecurringCurrentOccurrence = tx.recurrence_type === "fixa" && dbTx.date !== tx.date;

      if (isRecurringCurrentOccurrence) {
        if (!user?.id) throw new Error("Usuário não autenticado");

        const [year, month] = tx.date.split("-").map(Number);

        await excludeRecurringForMonth(tx.id, month - 1, year, user.id);
        await createTransaction(
          {
            name: dbTx.name,
            type: dbTx.type as "receita" | "despesa",
            amount: Number(dbTx.amount),
            category: dbTx.category,
            date: tx.date,
            status: "pago",
            payment_method: dbTx.payment_method as "conta" | "cartao",
            recurrence_type: "unica",
            account_id: dbTx.payment_method === "cartao" ? null : dbTx.account_id,
            credit_card_id: dbTx.payment_method === "cartao" ? dbTx.credit_card_id : null,
            observation: dbTx.observation,
          },
          user.id
        );
      } else {
        await updateTransactionStatus(tx.id, "pago");
      }

      toast.success(isReceita ? "Receita marcada como recebida" : "Transação marcada como paga");
      onRefresh();
      handleClose();
    } catch (error: any) {
      toast.error(error?.message || "Erro ao pagar");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await deleteTransaction(tx.id);
      toast.success("Transação excluída");
      onRefresh();
      handleClose();
    } catch {
      toast.error("Erro ao excluir");
    } finally {
      setLoading(false);
    }
  };

  const isOriginalMonth = (() => {
    if (!tx) return false;
    const [y, m] = tx.date.split("-").map(Number);
    return m - 1 === selectedMonth && y === selectedYear;
  })();

  const handleDeleteFixaThisMonth = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      if (isOriginalMonth) {
        // Deleting from the original month: we need to change the base transaction's
        // date to the next month so the balance trigger reverses the impact,
        // and then create an exclusion for this month.
        // Actually the simplest approach: update status to 'pendente' so the trigger
        // reverses the balance, then move the date forward by 1 month.
        const origDate = new Date(tx.date + "T12:00:00");
        const nextMonth = new Date(origDate.getFullYear(), origDate.getMonth() + 1, Math.min(origDate.getDate(), 28));
        const newDateStr = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-${String(nextMonth.getDate()).padStart(2, "0")}`;
        await updateTransaction(tx.id, { date: newDateStr, status: "pendente" });
      } else {
        await excludeRecurringForMonth(tx.id, selectedMonth, selectedYear, userId);
      }
      toast.success("Removida deste mês");
      onRefresh();
      handleClose();
    } catch {
      toast.error("Erro ao remover");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFixaAll = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      // Check if the original transaction month is >= selected month
      const [origY, origM] = tx.date.split("-").map(Number);
      const origMonthIndex = origY * 12 + (origM - 1);
      const selectedMonthIndex = selectedYear * 12 + selectedMonth;

      if (origMonthIndex >= selectedMonthIndex) {
        // The original transaction is in or after the selected month,
        // so we should delete it entirely (triggers balance reversal)
        await deleteTransaction(tx.id);
      } else {
        // Original is before selected month - just create exclusions from here onward
        await excludeRecurringFromMonthOnward(tx.id, selectedMonth, selectedYear, userId);
      }
      toast.success("Removida deste e dos próximos meses");
      onRefresh();
      handleClose();
    } catch {
      toast.error("Erro ao remover");
    } finally {
      setLoading(false);
    }
  };

  const openEditForm = () => {
    setEditName(tx.name);
    setEditAmountCents(Math.round(tx.amount * 100));
    setEditCategory(tx.category);
    setEditStatus(tx.status as "pago" | "pendente");
    setEditObservation(tx.observation || "");
    setEditAccountId(tx.account_id || "");
    // Parse date
    const [y, m, d] = tx.date.split("-").map(Number);
    setEditDate(new Date(y, m - 1, d));
    setEditDateMode("outros");
    setEditShowCalendar(false);
    // Fetch accounts
    getAccounts().then((accs) => setEditAccounts(accs as AccountRow[]));
    if (isRecurring) {
      setStep("edit-scope");
    } else {
      setStep("edit-form");
    }
  };

  const handleEditDateMode = (mode: "hoje" | "ontem" | "outros") => {
    setEditDateMode(mode);
    if (mode === "hoje") { setEditDate(new Date()); setEditShowCalendar(false); }
    else if (mode === "ontem") { setEditDate(subDays(new Date(), 1)); setEditShowCalendar(false); }
    else { setEditShowCalendar(true); }
  };

  const handleEditAmountKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      setEditAmountCents((prev) => Math.floor(prev / 10));
    } else if (/^\d$/.test(e.key)) {
      e.preventDefault();
      setEditAmountCents((prev) => prev * 10 + parseInt(e.key));
    }
  };


  const handleSaveEdit = async () => {
    setLoading(true);
    try {
      const dateStr = `${editDate.getFullYear()}-${String(editDate.getMonth() + 1).padStart(2, "0")}-${String(editDate.getDate()).padStart(2, "0")}`;

      if (isRecurring && editScope === "this" && user) {
        // "Apenas esta": exclude original from this month, create a one-time copy
        await excludeRecurringForMonth(tx.id, selectedMonth, selectedYear, user.id);
        await createTransaction(
          {
            name: editName,
            type: tx.type as "receita" | "despesa",
            amount: editAmountCents / 100,
            category: editCategory,
            date: dateStr,
            status: editStatus,
            payment_method: tx.payment_method as "conta" | "cartao",
            recurrence_type: "unica",
            account_id: editAccountId || tx.account_id || null,
            credit_card_id: tx.credit_card_id || null,
            observation: editObservation || null,
          },
          user.id
        );
        toast.success("Transação deste mês atualizada");
      } else {
        // "Todas": update the base transaction
        await updateTransaction(tx.id, {
          name: editName,
          amount: editAmountCents / 100,
          category: editCategory,
          status: editStatus,
          date: dateStr,
        });
        toast.success("Transação atualizada");
      }
      onRefresh();
      handleClose();
    } catch {
      toast.error("Erro ao atualizar");
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    switch (step) {
      case "detail":
        return (
          <div className="relative">
            {/* Header row: icon+name left, actions right */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0"
                  style={{ background: isReceita ? "hsl(var(--primary) / 0.15)" : "hsl(var(--muted) / 0.4)" }}
                >
                  <Icon className="w-6 h-6 text-foreground" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-[15px] font-bold text-foreground truncate">{tx.name}</h2>
                  <p className="text-[11px] text-muted-foreground/60 flex items-center gap-1 mt-0.5">
                    <Wallet className="w-3 h-3" />
                    {tx.payment_method === "cartao" ? "Cartão de crédito" : accountName || "Sem conta"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button className="w-8 h-8 rounded-xl bg-muted/20 flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-muted/40 transition-all">
                  <Bell className="w-4 h-4" />
                </button>
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setShowDropdown(!showDropdown)}
                    className="w-8 h-8 rounded-xl bg-muted/20 flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-muted/40 transition-all"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  <AnimatePresence>
                    {showDropdown && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-10 z-10 w-40 rounded-xl bg-popover border border-border/30 shadow-xl overflow-hidden backdrop-blur-xl"
                      >
                        <button
                          onClick={() => { setShowDropdown(false); openEditForm(); }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/40 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5 text-primary" />
                          Editar
                        </button>
                        <div className="h-px bg-border/20" />
                        <button
                          onClick={() => { setShowDropdown(false); setStep("delete-confirm"); }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Excluir
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <button onClick={handleClose} className="w-8 h-8 rounded-xl bg-muted/20 flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-muted/40 transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Amount */}
            <div className="mt-5 mb-4">
              <span className={cn(
                "inline-block px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider mb-2",
                isReceita ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"
              )}>
                {isReceita ? "Receita" : "Despesa"}
              </span>
              <p className="text-3xl font-extrabold tabular-nums tracking-tight text-foreground">
                {fmt(tx.amount)}
              </p>
              {/* Tags row */}
              <div className="flex items-center gap-2 mt-2.5">
                {isRecurring && (
                  <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                    <RefreshCw className="w-3 h-3" /> {tx.payment_method === "cartao" ? "Assinatura" : "Variável"}
                  </span>
                )}
                {tx.installments && tx.installment_current && (
                  <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                    <FileText className="w-3 h-3" /> {tx.installment_current}/{tx.installments}x
                  </span>
                )}
                <span
                  className={cn(
                    "px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1",
                    isPaid
                      ? "bg-primary/10 text-primary"
                      : "bg-amber-500/15 text-amber-400"
                  )}
                >
                  <Clock className="w-3 h-3" />
                  {isPaid ? (isReceita ? "Recebido" : "Pago") : "Pendente"}
                </span>
              </div>
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 mb-5 pt-4 border-t border-border/10">
              <div>
                <p className="text-[11px] text-muted-foreground/60 flex items-center gap-1 mb-1">
                  <CalendarDays className="w-3 h-3" /> Data
                </p>
                <p className="text-[13px] font-semibold text-foreground">{formatFullDate(tx.date)}</p>
                {tx.time && (
                  <p className="mt-1 flex items-center gap-1 text-[12px] font-medium text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {tx.time}
                  </p>
                )}
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground/60 flex items-center gap-1 mb-1">
                  <Wallet className="w-3 h-3" /> Conta
                </p>
                <p className="text-[13px] font-semibold text-foreground">
                  {tx.payment_method === "cartao" ? "Cartão de crédito" : accountName || "Sem conta"}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground/60 flex items-center gap-1 mb-1">
                  <Tag className="w-3 h-3" /> Categoria
                </p>
                <p className="text-[13px] font-semibold text-foreground">{tx.category}</p>
              </div>
              {tx.observation && (
                <div>
                  <p className="text-[11px] text-muted-foreground/60 flex items-center gap-1 mb-1">
                    <StickyNote className="w-3 h-3" /> Nota
                  </p>
                  <p className="text-[13px] font-semibold text-foreground truncate">{tx.observation}</p>
                </div>
              )}
            </div>

            {/* Similar / Recurring Transactions */}
            {similarTxs.length > 1 && (
              <div className="mb-4 pt-3 border-t border-border/10">
                <button
                  onClick={() => setSimilarExpanded(!similarExpanded)}
                  className="w-full flex items-center justify-between mb-2"
                >
                  <p className="text-[11px] font-semibold text-muted-foreground/70 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5" />
                    {isRecurring ? "Histórico de Recorrência" : "Transações Semelhantes"}
                  </p>
                  {similarExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground/40" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/40" />}
                </button>

                <AnimatePresence>
                  {similarExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-none">
                        {similarTxs
                          .filter((s) => s.id !== tx.id)
                          .slice(0, 12)
                          .map((s) => {
                            const sDate = new Date(s.date + "T12:00:00");
                            const dateLabel = `${String(sDate.getDate()).padStart(2, "0")} ${MONTHS_FULL[sDate.getMonth()].slice(0, 3)}. ${sDate.getFullYear()}`;
                            const sIsReceita = tx.type === "receita";

                            return (
                              <div
                                key={s.id}
                                className="flex items-center gap-3 rounded-xl border border-border/10 bg-muted/5 px-3 py-2.5"
                              >
                                <div
                                  className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                                  style={{ background: sIsReceita ? "hsl(var(--primary) / 0.12)" : "hsl(var(--muted) / 0.3)" }}
                                >
                                  {(() => {
                                    const InstallmentIcon = getCategoryIcon(s.category, customCategories);
                                    return <InstallmentIcon className="w-4 h-4 text-foreground/80" />;
                                  })()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[11px] font-semibold text-foreground/80 truncate">{s.name}</p>
                                  <p className="text-[9px] text-muted-foreground/50">{dateLabel} · {s.category}</p>
                                </div>
                                <p className={cn(
                                  "text-[12px] font-bold tabular-nums shrink-0",
                                  sIsReceita ? "text-primary" : "text-foreground"
                                )}>
                                  {sIsReceita ? "+" : ""}{fmt(Number(s.amount))}
                                </p>
                              </div>
                            );
                          })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Action button */}
            {!isPaid && (
              <button
                onClick={() => setStep("pay-confirm")}
                className="w-full py-3.5 rounded-xl text-sm font-bold bg-primary/10 text-primary ring-1 ring-primary/30 hover:bg-primary/20 transition-all"
              >
                {isReceita ? "Receber" : "Marcar como pago"}
              </button>
            )}
          </div>
        );

      case "pay-confirm":
        return (
          <div className="space-y-5 text-center">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Wallet className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">{isReceita ? "Confirmar recebimento" : "Confirmar pagamento"}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Deseja marcar <span className="font-semibold text-foreground">"{tx.name}"</span> como {isReceita ? "recebido" : "pago"}?
              </p>
              <p className={`text-xl font-bold mt-2 ${isReceita ? "text-primary" : "text-destructive"}`}>
                {fmt(tx.amount)}
              </p>
            </div>
            <div className="space-y-2">
              <button
                onClick={handlePay}
                disabled={loading}
                className="w-full py-3 rounded-xl text-sm font-bold bg-primary/15 text-primary border border-primary/20 hover:bg-primary/25 transition-all disabled:opacity-50"
              >
                {loading ? (isReceita ? "Confirmando..." : "Pagando...") : "Confirmar"}
              </button>
              <button
                onClick={() => setStep("detail")}
                className="w-full py-2.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        );

      case "delete-confirm":
        return (
          <div className="space-y-5 text-center">
            <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Excluir transação</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Tem certeza que deseja excluir <span className="font-semibold text-foreground">"{tx.name}"</span>? Esta ação não pode ser desfeita.
              </p>
            </div>
            <div className="space-y-2">
              {isRecurring ? (
                <>
                  <button
                    onClick={handleDeleteFixaThisMonth}
                    disabled={loading}
                    className="w-full py-3 rounded-xl text-sm font-bold bg-muted/30 text-foreground border border-border/20 hover:bg-muted/50 transition-all disabled:opacity-50"
                  >
                    Apagar apenas este mês
                  </button>
                  <button
                    onClick={handleDeleteFixaAll}
                    disabled={loading}
                    className="w-full py-3 rounded-xl text-sm font-bold bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 transition-all disabled:opacity-50"
                  >
                    Apagar este e todos os futuros
                  </button>
                </>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => setStep("detail")}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold text-muted-foreground bg-muted/30 border border-border/20 hover:bg-muted/50 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={loading}
                    className="flex-1 py-3 rounded-xl text-sm font-bold bg-destructive/15 text-destructive border border-destructive/20 hover:bg-destructive/25 transition-all disabled:opacity-50"
                  >
                    {loading ? "Excluindo..." : "Excluir"}
                  </button>
                </div>
              )}
              {isRecurring && (
                <button
                  onClick={() => setStep("detail")}
                  className="w-full py-2.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground transition-all"
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>
        );

      case "edit-scope":
        return (
          <div className="space-y-5">
            <div>
              <h3 className="text-lg font-bold text-foreground">Editar despesa fixa</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Esta é uma despesa recorrente. Deseja editar apenas esta ocorrência ou todas as pendentes dos próximos meses?
              </p>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => { setEditScope("this"); setStep("edit-form"); }}
                className="w-full py-3.5 rounded-xl text-sm font-bold bg-primary/15 text-primary border border-primary/20 hover:bg-primary/25 transition-all"
              >
                Apenas esta
              </button>
              <button
                onClick={() => { setEditScope("all"); setStep("edit-form"); }}
                className="w-full py-3 rounded-xl text-sm font-bold text-foreground bg-muted/30 border border-border/20 hover:bg-muted/50 transition-all"
              >
                Todas as pendentes
              </button>
              <button
                onClick={() => setStep("detail")}
                className="w-full py-2.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        );

      case "edit-form": {
        const accentHsl = isReceita ? "hsl(var(--primary))" : "hsl(var(--destructive))";
        const editCategories = tx.type === "receita" ? CATEGORIES_INCOME : CATEGORIES_EXPENSE;
        const formattedEditDate = format(editDate, "dd/MM/yy");

        return (
          <div className="flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="relative flex items-center justify-center pt-3 pb-2 px-5">
              <span className="text-base font-bold text-foreground">
                {isReceita ? "Editar Receita" : "Editar Despesa"}
              </span>
              <button
                onClick={() => setStep("detail")}
                className="absolute right-4 w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 pb-20 md:pb-4">
              {/* Value display */}
              <div
                className="mx-5 mb-4 rounded-xl p-5 text-center cursor-text border border-border/10"
                style={{ background: `${accentHsl.replace(")", " / 0.08)")}` }}
                onClick={() => amountInputRef.current?.focus()}
              >
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Valor</p>
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-xl font-bold text-muted-foreground">{currencySymbol()}</span>
                  <motion.span
                    key={editAmountCents}
                    initial={{ scale: 1.05 }}
                    animate={{ scale: 1 }}
                    className="font-display text-4xl font-bold tabular-nums tracking-tight text-foreground"
                  >
                    {formatCurrency(editAmountCents)}
                  </motion.span>
                </div>
                <input
                  ref={amountInputRef}
                  className="sr-only"
                  onKeyDown={handleEditAmountKeyDown}
                  aria-label="Valor da transação"
                  autoFocus
                />
              </div>

              {/* Status toggle */}
              <div className="flex justify-center mb-5 px-5">
                <div className="flex gap-2 w-full">
                  <button
                    type="button"
                    onClick={() => setEditStatus("pago")}
                    className={cn(
                      "flex items-center justify-center gap-1.5 flex-1 py-2.5 rounded-xl text-xs font-bold transition-all border",
                      editStatus === "pago"
                        ? isReceita
                          ? "bg-primary/15 text-primary border-primary/30"
                          : "bg-destructive/15 text-destructive border-destructive/30"
                        : "bg-muted/30 text-muted-foreground border-transparent hover:bg-muted/50"
                    )}
                  >
                    <Check className="w-3.5 h-3.5" />
                    {isReceita ? "Já recebi" : "Já paguei"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditStatus("pendente")}
                    className={cn(
                      "flex items-center justify-center gap-1.5 flex-1 py-2.5 rounded-xl text-xs font-bold transition-all border",
                      editStatus === "pendente"
                        ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                        : "bg-muted/30 text-muted-foreground border-transparent hover:bg-muted/50"
                    )}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    Pendente
                  </button>
                </div>
              </div>

              {/* Form fields */}
              <div className="px-5 space-y-5">
                {/* Date */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <CalendarDays className="w-4 h-4 text-muted-foreground" />
                    Data
                  </div>
                  <div className="flex gap-2">
                    {(["hoje", "ontem", "outros"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => handleEditDateMode(mode)}
                        className={cn(
                          "px-4 py-2 rounded-xl text-xs font-semibold transition-all border",
                          editDateMode === mode
                            ? "bg-primary/15 text-primary border-primary/25"
                            : "bg-muted/30 text-muted-foreground hover:text-foreground border-transparent"
                        )}
                      >
                        {mode === "outros" ? formattedEditDate : mode.charAt(0).toUpperCase() + mode.slice(1)}
                      </button>
                    ))}
                  </div>
                  <AnimatePresence>
                    {editShowCalendar && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="rounded-xl border border-border/20 bg-card p-1">
                          <Calendar
                            mode="single"
                            selected={editDate}
                            onSelect={(d) => d && setEditDate(d)}
                            className="p-2 pointer-events-auto"
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    Descrição
                  </div>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Nome da transação"
                    className="w-full h-11 px-3 rounded-xl bg-muted/30 border border-border/20 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                    maxLength={100}
                  />
                </div>

                {/* Category */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Tag className="w-4 h-4 text-muted-foreground" />
                    Categoria
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCategoryPicker(!showCategoryPicker)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 h-11 rounded-xl text-sm border transition-colors",
                      editCategory
                        ? "bg-muted/30 border-border/20 text-foreground"
                        : "bg-muted/30 border-border/20 text-muted-foreground"
                    )}
                  >
                    {editCategory || "Selecionar categoria"}
                    <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <AnimatePresence>
                    {showCategoryPicker && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {editCategories.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => { setEditCategory(c); setShowCategoryPicker(false); }}
                              className={cn(
                                "px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all border",
                                editCategory === c
                                  ? "bg-primary/15 text-primary border-primary/25"
                                  : "bg-muted/30 text-muted-foreground border-border/20 hover:border-border/40"
                              )}
                            >
                              {c}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Account */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Wallet className="w-4 h-4 text-muted-foreground" />
                    Conta
                  </div>
                  <div className="relative">
                    <select
                      value={editAccountId}
                      onChange={(e) => setEditAccountId(e.target.value)}
                      className="w-full h-11 px-3 rounded-xl bg-muted/30 border border-border/20 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 appearance-none"
                    >
                      <option value="">Sem conta</option>
                      {editAccounts.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Observation */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <StickyNote className="w-4 h-4 text-muted-foreground" />
                    Observação
                  </div>
                  <input
                    value={editObservation}
                    onChange={(e) => setEditObservation(e.target.value)}
                    placeholder="Adicionar nota (opcional)"
                    className="w-full h-11 px-3 rounded-xl bg-muted/30 border border-border/20 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                  />
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 pt-2 pb-2">
                  <button
                    onClick={() => setStep("detail")}
                    className="flex-1 py-3 rounded-xl text-sm font-bold text-muted-foreground bg-muted/30 border border-border/20 hover:bg-muted/50 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={loading}
                    className="flex-1 py-3 rounded-xl text-sm font-bold text-primary-foreground bg-primary hover:bg-primary/90 transition-all disabled:opacity-50"
                  >
                    {loading ? "Salvando..." : "Atualizar"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={cn(
            "fixed inset-0 z-50 flex justify-center bg-black/70 backdrop-blur-sm",
            step === "edit-form" ? "items-stretch md:items-center" : "items-center"
          )}
          onClick={handleClose}
        >
          <motion.div
            key={step}
            initial={{ opacity: 0, y: step === "edit-form" ? "100%" : 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: step === "edit-form" ? "100%" : 40 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "w-full max-w-md shadow-2xl",
              step === "edit-form"
                ? "h-full md:h-auto md:max-h-[92vh] mx-0 md:mx-4 rounded-none md:rounded-2xl bg-card border-0 md:border md:border-border/20 p-0 flex flex-col overflow-hidden"
                : "mx-4 mb-20 sm:mb-0 rounded-2xl bg-card/95 backdrop-blur-xl border border-border/15 p-5 max-h-[75vh] overflow-y-auto ring-1 ring-white/[0.03]"
            )}
          >
            {renderContent()}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TransactionDetailModal;
