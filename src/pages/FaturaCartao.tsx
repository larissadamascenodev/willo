import { useState, useEffect, useMemo, useRef } from "react";
import { processScanFile } from "@/lib/scanUpload";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft,
  Plus, MoreVertical, CreditCard,
  CalendarClock, CalendarCheck, Wallet, Shield,
  Pencil, Trash2, Undo2, Check,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getInvoices, getInvoiceItems, getInvoicePayments, payInvoice, undoInvoicePayment, type Invoice, type InvoicePayment } from "@/services/invoiceService";
import { getAccounts, getCreditCards, createTransaction, updateTransaction, deleteTransaction, getTransactionById } from "@/services/transactionService";
import type { RecurrenceScope } from "@/components/fatura/RecurrenceActionModal";
import { cn } from "@/lib/utils";
import { colorFor } from "@/lib/banks";
import InvoiceCategoryBreakdown from "@/components/fatura/InvoiceCategoryBreakdown";
import InvoiceTransactionList from "@/components/fatura/InvoiceTransactionList";
import InvoicePayModal from "@/components/fatura/InvoicePayModal";
import InvoiceHistoryChart from "@/components/fatura/InvoiceHistoryChart";
import InvoiceScanScreen from "@/components/fatura/InvoiceScanScreen";
import InstallmentPurchaseCard from "@/components/installments/InstallmentPurchaseCard";
import SinglePurchaseCard from "@/components/fatura/SinglePurchaseCard";
import CardEntryModal, { type CardEntry } from "@/components/fatura/CardEntryModal";
import type { ActiveInstallmentItem } from "@/lib/installmentProgress";
import { anchorPurchaseDate, invoicePeriodIndex } from "@/lib/installments";
import InvoiceUploadReviewModal, { type ExtractedItem } from "@/components/fatura/InvoiceUploadReviewModal";
import NovaTransacaoModal, { type EditTransactionData } from "@/components/dashboard/NovaTransacaoModal";
import CreditCardEditModal from "@/components/fatura/CreditCardEditModal";

import { getCurrency } from "@/lib/currency";
export interface EnrichedItem {
  id: string;
  invoice_id: string;
  transaction_id: string;
  amount: number;
  installment_number: number;
  total_installments: number;
  transaction_name: string;
  transaction_category: string;
  transaction_date: string;
  transaction_status: string;
  transaction_recurrence_type: string;
  transaction_parent_id: string | null;
}

export interface CreditCardInfo {
  id: string;
  name: string;
  limit: number;
  used_limit: number;
  closing_day: number;
  due_day: number;
  color: string | null;
  last_four_digits: string | null;
}

export interface AccountInfo {
  id: string;
  name: string;
  is_default: boolean;
  current_balance: number;
}

export const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export const MONTH_SHORT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

export function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });
}


const EmptyTab = ({ label }: { label: string }) => (
  <div className="rounded-[22px] border border-dashed border-white/[0.08] px-4 py-10 text-center">
    <p className="text-[14px] text-white/56">{label}</p>
  </div>
);

const FaturaCartao = () => {
  const navigate = useNavigate();
  const { cardId } = useParams<{ cardId: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(
    parseInt(searchParams.get("month") ?? String(now.getMonth() + 1))
  );
  const [selectedYear, setSelectedYear] = useState(
    parseInt(searchParams.get("year") ?? String(now.getFullYear()))
  );

  const [card, setCard] = useState<CreditCardInfo | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [items, setItems] = useState<EnrichedItem[]>([]);
  const [payments, setPayments] = useState<InvoicePayment[]>([]);
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [userStartDate, setUserStartDate] = useState<Date | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [payAccountId, setPayAccountId] = useState("");
  const [uploadProcessing, setUploadProcessing] = useState(false);
  const [extractedItems, setExtractedItems] = useState<ExtractedItem[]>([]);
  const [extractedMessage, setExtractedMessage] = useState("");
  const [declaredTotal, setDeclaredTotal] = useState<number | null>(null);
  const [expectedTotal, setExpectedTotal] = useState<number | null>(null);
  const [carriedOver, setCarriedOver] = useState<number | null>(null);
  const [avgConfidence, setAvgConfidence] = useState<number | undefined>(undefined);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanItems, setScanItems] = useState<ExtractedItem[] | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [confirmingImport, setConfirmingImport] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<EditTransactionData | null>(null);
  const [showEditCard, setShowEditCard] = useState(false);
  const [tab, setTab] = useState<"geral" | "parcelados">("geral");
  const [entry, setEntry] = useState<CardEntry | null>(null);

  const currentInvoice = useMemo(
    () => invoices.find((i) => i.month === selectedMonth && i.year === selectedYear),
    [invoices, selectedMonth, selectedYear]
  );

  /**
   * Opening a card should land on the statement that still needs attention — the oldest
   * one not yet settled, or the period currently collecting purchases when everything is
   * paid. A settled month stays reachable through the history, not as the landing screen.
   */
  const pickedInitialMonth = useRef(false);
  useEffect(() => {
    if (pickedInitialMonth.current || !card) return;
    pickedInitialMonth.current = true;
    if (searchParams.get("month")) return;

    const unpaid = invoices
      .filter((inv) => !inv.is_paid && Number(inv.total_amount) > 0)
      .sort((a, b) => a.year * 12 + a.month - (b.year * 12 + b.month))[0];

    if (unpaid) {
      setSelectedMonth(unpaid.month);
      setSelectedYear(unpaid.year);
      return;
    }
    const period = invoicePeriodIndex(new Date().toISOString().slice(0, 10), card.closing_day);
    setSelectedMonth((period % 12) + 1);
    setSelectedYear(Math.floor(period / 12));
  }, [card, invoices, searchParams]);

  useEffect(() => {
    if (!user || !cardId) return;
    const load = async () => {
      setLoading(true);
      try {
        const [cards, accs, allInvoices, profileRes] = await Promise.all([
          getCreditCards(),
          getAccounts(),
          getInvoices(cardId),
          supabase.from("profiles").select("created_at").eq("id", user.id).single(),
        ]);
        const typedCards = cards as unknown as CreditCardInfo[];
        const foundCard = typedCards.find((c) => c.id === cardId);
        setCard(foundCard ?? null);
        setAccounts(accs as unknown as AccountInfo[]);

        // Filter invoices to only show from user creation month onwards
        const startDate = profileRes.data?.created_at ? new Date(profileRes.data.created_at) : null;
        setUserStartDate(startDate);
        const startMonth = startDate ? startDate.getMonth() + 1 : null;
        const startYear = startDate ? startDate.getFullYear() : null;
        const filtered = (startMonth && startYear)
          ? allInvoices.filter((inv) => inv.year > startYear! || (inv.year === startYear! && inv.month >= startMonth!))
          : allInvoices;
        setInvoices(filtered);
        const defaultAcc = (accs as unknown as AccountInfo[]).find((a) => a.is_default);
        if (defaultAcc) setPayAccountId(defaultAcc.id);
      } catch {
        toast.error("Erro ao carregar fatura");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, cardId]);

  useEffect(() => {
    if (!currentInvoice) { setItems([]); setPayments([]); return; }
    Promise.all([
      getInvoiceItems(currentInvoice.id),
      getInvoicePayments(currentInvoice.id),
    ]).then(([itemsData, paymentsData]) => {
      setItems(itemsData as EnrichedItem[]);
      setPayments(paymentsData);
    }).catch(() => {
      // silently handle
    });
  }, [currentInvoice]);

  const handlePay = async (details: import("@/components/fatura/InvoicePayModal").PaymentDetails) => {
    if (!currentInvoice || !payAccountId) return;
    setPaying(true);
    try {
      await payInvoice(currentInvoice.id, payAccountId, {
        mode: details.mode,
        amount_paid: details.amountPaid,
        installments: details.installments,
        entry_amount: details.entryAmount,
      });
      const modeLabel = details.mode === "total" ? "integralmente" : details.mode === "minimo" ? "parcialmente" : "parcelada";
      toast.success(`Fatura paga ${modeLabel}! ✅`);
      setShowPayModal(false);
      const [updated, cards] = await Promise.all([getInvoices(cardId!), getCreditCards()]);
      setInvoices(updated);
      const typedCards = cards as unknown as CreditCardInfo[];
      const foundCard = typedCards.find((c) => c.id === cardId);
      setCard(foundCard ?? null);
      // Settled month is done with — move on to the one still collecting purchases
      if (details.mode === "total") {
        const today = new Date();
        setSelectedMonth(today.getMonth() + 1);
        setSelectedYear(today.getFullYear());
      }
      window.dispatchEvent(new CustomEvent("finance-data-changed"));
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao pagar fatura");
    } finally {
      setPaying(false);
    }
  };

  const refreshItems = async () => {
    if (!currentInvoice) return;
    const [updatedItems, updatedInvoices, updatedPayments] = await Promise.all([
      getInvoiceItems(currentInvoice.id),
      getInvoices(cardId!),
      getInvoicePayments(currentInvoice.id),
    ]);
    setItems(updatedItems as EnrichedItem[]);
    setInvoices(updatedInvoices);
    setPayments(updatedPayments);
  };

  const handleEditItem = async (transactionId: string, updates?: { name?: string; amount?: number; category?: string }, scope?: RecurrenceScope) => {
    if (updates && Object.keys(updates).length > 0) {
      // Direct update from inline edit
      const cleanUpdates: any = {};
      if (updates.name) cleanUpdates.name = updates.name;
      if (updates.amount) cleanUpdates.amount = updates.amount;
      if (updates.category) cleanUpdates.category = updates.category;
      if (Object.keys(cleanUpdates).length === 0) return;
      await updateTransaction(transactionId, cleanUpdates);
      toast.success("Lançamento atualizado ✅");
      await refreshItems();
    } else if (scope === "current") {
      // For fixa "current only" edit — exclude this month and create a one-off copy
      // Just open the edit modal — on save, user will see the edited version as one-off
      // For now, open the normal edit modal
      try {
        let tx = await getTransactionById(transactionId);
        if (tx.parent_transaction_id) {
          tx = await getTransactionById(tx.parent_transaction_id);
        }
        setEditingTransaction({
          id: tx.id,
          name: tx.name,
          type: tx.type as "receita" | "despesa",
          amount: Number(tx.amount),
          category: tx.category,
          date: tx.date,
          status: tx.status as "pago" | "pendente",
          payment_method: tx.payment_method as "conta" | "cartao",
          account_id: tx.account_id,
          credit_card_id: tx.credit_card_id,
          recurrence_type: "unica" as any,
          installments: null,
          installment_current: null,
          observation: tx.observation,
          _editScope: "current",
          _originalMonth: selectedMonth,
          _originalYear: selectedYear,
        } as any);
      } catch {
        toast.error("Erro ao carregar transação");
      }
    } else {
      // Open NovaTransacaoModal in edit mode — fetch full transaction
      try {
        let tx = await getTransactionById(transactionId);
        // If this is a child installment, get the parent instead
        if (tx.parent_transaction_id) {
          tx = await getTransactionById(tx.parent_transaction_id);
        }
        // For parcelado, show the total amount (per-installment × total installments)
        const isParcelado = tx.recurrence_type === "parcelado" && tx.installments && tx.installments > 1;
        const displayAmount = isParcelado ? Number(tx.amount) * tx.installments : Number(tx.amount);
        setEditingTransaction({
          id: tx.id,
          name: tx.name,
          type: tx.type as "receita" | "despesa",
          amount: displayAmount,
          category: tx.category,
          date: tx.date,
          status: tx.status as "pago" | "pendente",
          payment_method: tx.payment_method as "conta" | "cartao",
          account_id: tx.account_id,
          credit_card_id: tx.credit_card_id,
          recurrence_type: tx.recurrence_type as any,
          installments: tx.installments,
          installment_current: tx.installment_current,
          observation: tx.observation,
        });
      } catch {
        toast.error("Erro ao carregar transação");
      }
    }
  };

  const handleDeleteItem = async (transactionId: string, scope?: RecurrenceScope) => {
    if (scope === "current") {
      // Exclude only this month using recurring_exclusions (0-based month)
      try {
        const tx = await getTransactionById(transactionId);
        const parentId = tx.parent_transaction_id || transactionId;
        await supabase.from("recurring_exclusions").insert({
          transaction_id: parentId,
          user_id: user!.id,
          month: selectedMonth - 1,
          year: selectedYear,
        } as any);
        // Remove the invoice_item for this month
        const itemToRemove = items.find(i => i.transaction_id === transactionId);
        if (itemToRemove) {
          await supabase.from("invoice_items").delete().eq("id", itemToRemove.id);
          // Recalc invoice total
          if (currentInvoice) {
            await supabase.rpc("recalc_invoice_total", { p_invoice_id: currentInvoice.id });
          }
        }
        toast.success("Assinatura removida deste mês ✅");
        await refreshItems();
        // Reload card
        if (cardId) {
          const cards = await getCreditCards();
          const typedCards = cards as unknown as CreditCardInfo[];
          const foundCard = typedCards.find((c) => c.id === cardId);
          setCard(foundCard ?? null);
        }
      } catch {
        toast.error("Erro ao excluir lançamento");
      }
    } else {
      // Delete all — check if this is a child, delete parent
      const tx = await getTransactionById(transactionId);
      const idToDelete = tx.parent_transaction_id || transactionId;
      await deleteTransaction(idToDelete);
      toast.success("Lançamento excluído ✅");
      await refreshItems();
      // Reload card to update used_limit
      if (cardId) {
        const cards = await getCreditCards();
        const typedCards = cards as unknown as CreditCardInfo[];
        const foundCard = typedCards.find((c) => c.id === cardId);
        setCard(foundCard ?? null);
      }
    }
  };

  // Newest purchase first, which is how the statement itself reads
  const sortedItems = useMemo(
    () => [...items].sort((a, b) => {
      const byDate = (b.transaction_date ?? "").localeCompare(a.transaction_date ?? "");
      return byDate !== 0 ? byDate : (b.id ?? "").localeCompare(a.id ?? "");
    }),
    [items],
  );
  const installmentItems = useMemo<ActiveInstallmentItem[]>(
    () => sortedItems
      .filter((i) => i.total_installments > 1)
      .map((i) => ({
        id: i.transaction_id,
        name: i.transaction_name,
        category: i.transaction_category,
        amount: Number(i.amount),
        installment_current: i.installment_number,
        installments: i.total_installments,
        payment_method: "cartao",
        date: i.transaction_date,
        credit_card_id: cardId ?? null,
        isOverdue: false,
        dueDate: null,
      })),
    [sortedItems, cardId],
  );

  const total = currentInvoice ? Number(currentInvoice.total_amount) : 0;
  const paidAmount = currentInvoice ? Number((currentInvoice as any).paid_amount ?? 0) : 0;
  const outstanding = Math.max(0, total - paidAmount);
  const limitTotal = card ? Number(card.limit) : 0;
  const usedLimit = card ? Number(card.used_limit) : 0;
  const availableLimit = limitTotal - usedLimit;
  const usedPct = limitTotal > 0 ? Math.min((usedLimit / limitTotal) * 100, 100) : 0;
  const isOverLimit = usedLimit > limitTotal;

  const openEntry = (item: EnrichedItem) => setEntry({
    transactionId: item.transaction_id,
    name: item.transaction_name,
    category: item.transaction_category,
    amount: Number(item.amount),
    date: item.transaction_date,
    installmentNumber: item.installment_number,
    totalInstallments: item.total_installments,
  });

  // Read a whole statement, or a single purchase, with the AI
  const handleFileUpload = async (file: File, mode: "invoice" | "single") => {
    const isInvoice = mode === "invoice";
    setUploadProcessing(true);
    if (isInvoice) {
      setScanItems(null);
      setScanOpen(true);
    } else {
      toast.loading("Lendo a compra...", { id: "upload-processing" });
    }
    try {
      const data = await processScanFile(file, isInvoice ? "invoice" : "transaction");

      const items: ExtractedItem[] = (data.items || []).map((item: any) => ({
        ...item,
        selected: true,
      }));

      if (items.length === 0) {
        setScanOpen(false);
        toast.dismiss("upload-processing");
        toast.error(isInvoice ? "Nenhuma compra encontrada nessa fatura." : "Nenhuma compra encontrada nessa imagem.");
        return;
      }

      setExtractedItems(items);
      setExtractedMessage(data.message || "Lançamentos encontrados!");
      setDeclaredTotal(isInvoice ? (data.declared_total ?? null) : null);
      setExpectedTotal(isInvoice ? (data.expected_total ?? null) : null);
      setCarriedOver(isInvoice ? (data.carried_over ?? null) : null);
      setAvgConfidence(typeof data.avg_confidence === "number" ? data.avg_confidence : undefined);
      toast.dismiss("upload-processing");

      // The scan screen reveals what was found, then hands over to the review
      if (isInvoice) setScanItems(items);
      else setShowReviewModal(true);
    } catch (err: any) {
      setScanOpen(false);
      toast.dismiss("upload-processing");
      toast.error(err?.message || "Erro ao processar fatura");
    } finally {
      setUploadProcessing(false);
    }
  };

  // Confirm import of extracted items
  const handleConfirmImport = async (selectedItems: ExtractedItem[]) => {
    if (!user || !cardId || !card) return;
    setConfirmingImport(true);
    try {
      const invoicePeriod = selectedYear * 12 + (selectedMonth - 1);

      for (const item of selectedItems) {
        // A refund is a single credit on this invoice, never an instalment plan
        const isRefund = item.amount < 0;
        const isParcelado = !isRefund && !!(item.installment_current && item.installment_total && item.installment_total > 1);
        // "4/10" means three instalments were charged in earlier statements; the card
        // triggers skip those, so this invoice is the first one billed here.
        const paidInstallments = isParcelado ? item.installment_current! - 1 : 0;
        const purchaseDate = anchorPurchaseDate(item, invoicePeriod, paidInstallments, card.closing_day);
        const purchaseNote = isParcelado && item.date && item.date !== purchaseDate
          ? `compra em ${item.date}`
          : "";

        await createTransaction(
          {
            name: item.description,
            type: "despesa",
            amount: item.amount,
            category: item.category || "Outros",
            date: purchaseDate,
            status: "pago",
            payment_method: "cartao",
            credit_card_id: cardId,
            recurrence_type: isParcelado ? "parcelado" : "unica",
            installments: isParcelado ? item.installment_total : null,
            installment_current: isParcelado ? item.installment_current : null,
            observation: paidInstallments > 0
              ? `paid_installments:${paidInstallments}${purchaseNote ? ` | ${purchaseNote}` : ""}`
              : null,
          },
          user.id
        );
      }

      toast.success(`${selectedItems.length} lançamento${selectedItems.length > 1 ? "s" : ""} importado${selectedItems.length > 1 ? "s" : ""} com sucesso! 🎉`);
      setShowReviewModal(false);
      setExtractedItems([]);
      await refreshItems();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao importar lançamentos");
    } finally {
      setConfirmingImport(false);
    }
  };

  const dueInfo = useMemo(() => {
    if (!card) return null;
    const dueDate = new Date(selectedYear, selectedMonth - 1, card.due_day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    const diffDays = Math.round((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    // Don't show "overdue" for invoices from before user started using the app
    if (diffDays < 0 && userStartDate) {
      const invoiceDate = new Date(selectedYear, selectedMonth - 1, 1);
      if (invoiceDate < userStartDate) {
        return null; // Hide due info for pre-creation invoices
      }
    }

    if (diffDays < 0) return { text: `Venceu há ${Math.abs(diffDays)} dias`, overdue: true };
    if (diffDays === 0) return { text: "Vence hoje", overdue: true };
    return { text: `Vence em ${diffDays} dias`, overdue: false };
  }, [card, selectedMonth, selectedYear, userStartDate]);

  const invoiceStatus = useMemo(() => {
    if (!currentInvoice) return null;
    // Only show "paid" if truly no outstanding balance
    if (currentInvoice.is_paid && outstanding <= 0) return "paid";
    if (card) {
      const closingDate = new Date(selectedYear, selectedMonth - 1, card.closing_day);
      const today = new Date();
      if (today > closingDate) return "closed";
    }
    return "open";
  }, [currentInvoice, card, selectedMonth, selectedYear, outstanding]);

  const categoryBreakdown = useMemo(() => {
    if (items.length === 0) return [];
    const map = new Map<string, { total: number; count: number }>();
    items.forEach((item) => {
      const cat = item.transaction_category || "Outros";
      const existing = map.get(cat) || { total: 0, count: 0 };
      existing.total += Number(item.amount);
      existing.count += 1;
      map.set(cat, existing);
    });
    return Array.from(map.entries())
      .map(([category, data]) => ({
        category,
        total: data.total,
        count: data.count,
        percentage: total > 0 ? (data.total / total) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [items, total]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-primary text-sm">Carregando fatura...</div>
      </div>
    );
  }

  const cardColor = card?.color || "hsl(150 100% 45%)";

  const cardHex = colorFor(card?.name ?? "", card?.color, "#3A3A3F");
  const statusChip =
    invoiceStatus === "paid" ? { label: "Paga", hex: "#C8F36D" }
      : invoiceStatus === "closed" ? { label: "Fechada", hex: "#FCD34D" }
        : invoiceStatus === "open" ? { label: "Aberta", hex: "#FFFFFF" }
          : null;

  return (
    <div className="space-y-5 pb-24 pt-2">
      {/* Header — back + menu */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate("/gestao")}
          aria-label="Voltar"
          className="-ml-2 flex h-9 w-9 items-center justify-center text-white/82 transition-colors hover:text-white active:opacity-60"
        >
          <ChevronLeft className="h-6 w-6" strokeWidth={2.25} />
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => uploadRef.current?.click()}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-white/[0.08] willo-glass px-3.5 text-[13px] font-semibold text-white active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" /> Lançamento
          </button>
          <input
            ref={uploadRef}
            type="file"
            accept=".pdf,.csv,.xls,.xlsx,image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) handleFileUpload(file, "invoice");
            }}
          />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button aria-label="Opções do cartão" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-white/82 transition-colors hover:text-white">
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[190px]">
            <DropdownMenuItem onClick={() => setShowEditCard(true)} className="gap-2 text-[13px]">
              <Pencil className="h-3.5 w-3.5" />
              Editar cartão
            </DropdownMenuItem>
            {currentInvoice && Number(currentInvoice.paid_amount ?? 0) > 0 && (
              <DropdownMenuItem
                onClick={async () => {
                  try {
                    await undoInvoicePayment(currentInvoice.id);
                    toast.success("Pagamento desfeito");
                    const updated = await getInvoices(cardId!);
                    setInvoices(updated);
                    // Reload card to update used_limit
                    const cards = await getCreditCards();
                    const typedCards = cards as unknown as CreditCardInfo[];
                    const foundCard = typedCards.find((c) => c.id === cardId);
                    setCard(foundCard ?? null);
                  } catch (err: any) {
                    toast.error(err?.message ?? "Erro ao desfazer pagamento");
                  }
                }}
                className="gap-2 text-[13px] text-destructive focus:text-destructive"
              >
                <Undo2 className="h-3.5 w-3.5" />
                Desfazer pagamento
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>

      {/* Month + add */}
      {/* ===== Invoice + limit ===== */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="relative overflow-hidden rounded-[26px] border border-white/[0.08] willo-glass p-5"
      >
        <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full blur-[70px]" style={{ background: cardHex, opacity: 0.3 }} />

        {/* Card identity */}
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px]" style={{ background: `${cardHex}26` }}>
              <CreditCard className="h-[18px] w-[18px]" style={{ color: cardHex }} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[16px] font-bold text-white">{card?.name}</p>
              {card?.last_four_digits && (
                <p className="text-[12px] tabular-nums text-white/56">•••• {card.last_four_digits}</p>
              )}
            </div>
          </div>
          {statusChip && (
            <span
              className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold"
              style={{ background: `${statusChip.hex}1F`, color: statusChip.hex }}
            >
              {statusChip.label}
            </span>
          )}
        </div>

        {/* Invoice total — always what the statement was worth, never the leftover */}
        <div className="relative mt-5">
          <p className="text-[12px] text-white/62">Fatura de {MONTH_NAMES[selectedMonth - 1]}</p>
          {/* Money already paid has left the account, so the headline is what is still owed */}
          <p className="text-[36px] font-extrabold leading-tight tracking-tight text-white tabular-nums">
            {formatCurrency(paidAmount > 0 && outstanding > 0 ? outstanding : total)}
          </p>
          {total > 0 && outstanding <= 0 ? (
            <p className="flex items-center gap-1.5 text-[13px] font-medium text-willo-green">
              <Check className="h-3.5 w-3.5" strokeWidth={3} /> Paga
            </p>
          ) : dueInfo && outstanding > 0 ? (
            <p className={cn("text-[13px]", dueInfo.overdue ? "text-red-400" : "text-white/62")}>{dueInfo.text}</p>
          ) : null}
        </div>

        {/* Closing / due */}
        <div className="relative mt-4 flex items-center gap-4 border-t border-white/[0.06] pt-4">
          <span className="flex items-center gap-2 text-[12.5px] text-white/66">
            <CalendarClock className="h-4 w-4 shrink-0 text-white/50" />
            Fecha dia <span className="font-semibold text-white">{card?.closing_day}</span>
          </span>
          <span className="h-3 w-px bg-white/10" />
          <span className="flex items-center gap-2 text-[12.5px] text-white/66">
            <CalendarCheck className="h-4 w-4 shrink-0 text-white/50" />
            Vence dia <span className="font-semibold text-white">{card?.due_day}</span>
          </span>
        </div>

        {/* Limit */}
        <div className="relative mt-5 border-t border-white/[0.06] pt-4">
          <div className="flex items-baseline justify-between">
            <span className="text-[12px] text-white/62">Limite usado</span>
            <span className={cn("text-[12.5px] font-semibold tabular-nums", isOverLimit ? "text-red-400" : "text-white/82")}>
              {usedPct.toFixed(0)}%
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.07]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(usedPct, 100)}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="h-full rounded-full"
              style={{ background: isOverLimit ? "#F87171" : cardHex }}
            />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[11.5px] text-white/56">Usado</p>
              <p className="text-[14px] font-semibold text-white tabular-nums">{formatCurrency(usedLimit)}</p>
            </div>
            <div className="border-x border-white/[0.06]">
              <p className="text-[11.5px] text-white/56">Disponível</p>
              <p className={cn("text-[14px] font-semibold tabular-nums", isOverLimit ? "text-red-400" : "text-willo-green")}>{formatCurrency(availableLimit)}</p>
            </div>
            <div>
              <p className="text-[11.5px] text-white/56">Total</p>
              <p className="text-[14px] font-semibold text-white tabular-nums">{formatCurrency(limitTotal)}</p>
            </div>
          </div>
        </div>

        {/* Pay */}
        {currentInvoice && outstanding > 0 && (
          <button
            type="button"
            onClick={() => setShowPayModal(true)}
            className="relative mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-white text-[15px] font-bold text-[#0B0B0B] active:scale-[0.99]"
          >
            <Wallet className="h-4 w-4" />
            Pagar fatura · {formatCurrency(outstanding)}
          </button>
        )}
      </motion.div>

      <InvoiceHistoryChart
        invoices={invoices}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        onSelect={(m, y) => { setSelectedMonth(m); setSelectedYear(y); }}
        userStartDate={userStartDate}
        closingDay={card?.closing_day}
      />
      {categoryBreakdown.length > 0 && (
        <InvoiceCategoryBreakdown categories={categoryBreakdown} total={total} />
      )}

      {/* ===== Geral / Parcelados / À vista ===== */}
      <div className="mt-5 isolate grid grid-cols-2 rounded-full border border-white/[0.08] willo-glass p-1">
        {([["geral", "Geral"], ["parcelados", "Compras parceladas"]] as const).map(([key, label]) => (
          <button key={key} type="button" onClick={() => setTab(key)} className="relative h-10 rounded-full text-[14px] font-medium">
            {tab === key && (
              <motion.span layoutId="fatura-tab" className="pointer-events-none absolute inset-0 z-0 rounded-full bg-white" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
            )}
            <span className={cn("relative z-10 transform-gpu", tab === key ? "text-[#0B0B0B]" : "text-white/82")}>{label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={tab}
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -24 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
      {tab === "geral" && (
        <div className="mt-4 space-y-2.5">
          {sortedItems.length === 0 ? (
            <EmptyTab label="Nenhum lançamento nesta fatura." />
          ) : (
            sortedItems.map((item, i) =>
              item.total_installments > 1 ? (
                <InstallmentPurchaseCard
                  key={item.id}
                  index={i}
                  customCats={[]}
                  card={card ? { name: card.name, color: card.color } : undefined}
                  onOpen={() => openEntry(item)}
                  item={{
                    id: item.transaction_id,
                    name: item.transaction_name,
                    category: item.transaction_category,
                    amount: Number(item.amount),
                    installment_current: item.installment_number,
                    installments: item.total_installments,
                    payment_method: "cartao",
                    date: item.transaction_date,
                    credit_card_id: cardId ?? null,
                    isOverdue: false,
                    dueDate: null,
                  }}
                />
              ) : (
                <SinglePurchaseCard
                  key={item.id}
                  index={i}
                  customCats={[]}
                  card={card ? { name: card.name, color: card.color } : undefined}
                  onOpen={() => openEntry(item)}
                  item={{
                    id: item.id,
                    name: item.transaction_name,
                    category: item.transaction_category,
                    amount: Number(item.amount),
                    date: item.transaction_date,
                  }}
                />
              ),
            )
          )}
        </div>
      )}

      {tab === "parcelados" && (
        <div className="mt-4 space-y-2.5">
          {installmentItems.length === 0 ? (
            <EmptyTab label="Nenhuma compra parcelada nesta fatura." />
          ) : (
            installmentItems.map((item, i) => {
              const source = sortedItems.find((s) => s.transaction_id === item.id);
              return (
                <InstallmentPurchaseCard
                  key={item.id}
                  item={item}
                  index={i}
                  customCats={[]}
                  card={card ? { name: card.name, color: card.color } : undefined}
                  onOpen={source ? () => openEntry(source) : undefined}
                />
              );
            })
          )}
        </div>
      )}

      </motion.div>
      </AnimatePresence>

      {/* Pay Modal */}
      <InvoicePayModal
        open={showPayModal}
        onClose={() => setShowPayModal(false)}
        total={outstanding}
        accounts={accounts}
        payAccountId={payAccountId}
        setPayAccountId={setPayAccountId}
        onConfirm={handlePay}
        paying={paying}
      />

      {/* Add Chooser Modal */}

      <CardEntryModal
        entry={entry}
        cardName={card?.name}
        onClose={() => setEntry(null)}
        onEdit={(id) => { setEntry(null); handleEditItem(id); }}
        onDelete={(id) => { setEntry(null); handleDeleteItem(id); }}
      />

      {/* Reading the statement: scan animation, then every line found */}
      <InvoiceScanScreen
        open={scanOpen}
        items={scanItems}
        onClose={() => { setScanOpen(false); setScanItems(null); }}
        onDone={() => { setScanOpen(false); setScanItems(null); setShowReviewModal(true); }}
      />

      {/* Upload Review Modal */}
      <InvoiceUploadReviewModal
        open={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        items={extractedItems}
        message={extractedMessage}
        declaredTotal={declaredTotal}
        expectedTotal={expectedTotal}
        carriedOver={carriedOver}
        avgConfidence={avgConfidence}
        onConfirm={handleConfirmImport}
        confirming={confirmingImport}
      />

      {/* Manual Add Modal — pre-set to credit card */}
      <NovaTransacaoModal
        open={showManualAdd}
        onClose={() => setShowManualAdd(false)}
        onSuccess={async () => {
          setShowManualAdd(false);
          await refreshItems();
          // Reload card to update used_limit
          if (cardId) {
            const cards = await getCreditCards();
            const typedCards = cards as unknown as CreditCardInfo[];
            const foundCard = typedCards.find((c) => c.id === cardId);
            setCard(foundCard ?? null);
          }
        }}
        initialType="despesa"
        initialPaymentMethod="cartao"
        initialCreditCardId={cardId}
      />

      {/* Edit Transaction Modal */}
      <NovaTransacaoModal
        open={!!editingTransaction}
        onClose={() => setEditingTransaction(null)}
        onSuccess={async () => {
          setEditingTransaction(null);
          await refreshItems();
          // Reload card to update used_limit
          if (cardId) {
            const cards = await getCreditCards();
            const typedCards = cards as unknown as CreditCardInfo[];
            const foundCard = typedCards.find((c) => c.id === cardId);
            setCard(foundCard ?? null);
          }
        }}
        initialType="despesa"
        initialPaymentMethod="cartao"
        initialCreditCardId={cardId}
        editTransaction={editingTransaction}
      />

      {/* Edit Card Modal */}
      {card && (
        <CreditCardEditModal
          open={showEditCard}
          onClose={() => setShowEditCard(false)}
          card={card}
          onUpdated={async () => {
            const cards = await getCreditCards();
            const typedCards = cards as unknown as CreditCardInfo[];
            const foundCard = typedCards.find((c) => c.id === cardId);
            setCard(foundCard ?? null);
          }}
          onDeleted={() => navigate(-1)}
        />
      )}
    </div>
  );
};

export default FaturaCartao;
