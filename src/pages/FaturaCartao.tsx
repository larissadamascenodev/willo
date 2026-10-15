import { useState, useEffect, useMemo, useRef } from "react";
import { importStatement } from "@/services/invoiceImport";
import { processScanFile } from "@/lib/scanUpload";
import { motion } from "framer-motion";
import {
  Plus, MoreVertical,
  CalendarClock, CalendarCheck, Wallet,
  Pencil, Undo2, Check,
} from "lucide-react";
import BackButton from "@/components/shared/BackButton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getInvoices, getInvoiceItems, getInvoicePayments, payInvoice, undoInvoicePayment, type Invoice, type InvoicePayment } from "@/services/invoiceService";
import { getAccounts, getCreditCards, createTransaction, updateTransaction, deleteTransaction, getTransactionById } from "@/services/transactionService";
import type { RecurrenceScope } from "@/components/fatura/RecurrenceActionModal";
import { cn } from "@/lib/utils";
import { colorFor } from "@/lib/banks";
import InvoiceTransactionList from "@/components/fatura/InvoiceTransactionList";
import InvoicePayModal from "@/components/fatura/InvoicePayModal";
import InvoiceForecastChart from "@/components/fatura/InvoiceForecastChart";
import InvoiceRecentCard from "@/components/fatura/InvoiceRecentCard";
import CardEntryModal from "@/components/fatura/CardEntryModal";
import InvoiceAddChooserModal from "@/components/fatura/InvoiceAddChooserModal";
import InvoiceScanScreen from "@/components/fatura/InvoiceScanScreen";
import { invoicePeriodIndex } from "@/lib/installments";
import { statementCarryLine } from "@/lib/statementCarry";
import { findPreviousImport, hashFile, recordImport, type PreviousImport } from "@/services/invoiceImports";
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
  /** Only used to break ties between lines bought on the same day. */
  created_at?: string | null;
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
    <p className="text-[14px] t-soft">{label}</p>
  </div>
);

const FaturaCartao = () => {
  const navigate = useNavigate();
  const { cardId } = useParams<{ cardId: string }>();
  const location = useLocation();
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
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [payAccountId, setPayAccountId] = useState("");
  const [uploadProcessing, setUploadProcessing] = useState(false);
  const [extractedItems, setExtractedItems] = useState<ExtractedItem[]>([]);
  const [extractedMessage, setExtractedMessage] = useState("");
  const [declaredTotal, setDeclaredTotal] = useState<number | null>(null);
  const [expectedTotal, setExpectedTotal] = useState<number | null>(null);
  const [carriedOver, setCarriedOver] = useState<number | null>(null);
  const [declaredNext, setDeclaredNext] = useState<number | null>(null);
  const [declaredOutstanding, setDeclaredOutstanding] = useState<number | null>(null);
  const [declaredCardLimit, setDeclaredCardLimit] = useState<number | null>(null);
  const [declaredUsedLimit, setDeclaredUsedLimit] = useState<number | null>(null);
  const [documentHash, setDocumentHash] = useState<string | null>(null);
  const [documentName, setDocumentName] = useState<string | null>(null);
  const [alreadyImported, setAlreadyImported] = useState<PreviousImport | null>(null);
  const [avgConfidence, setAvgConfidence] = useState<number | undefined>(undefined);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanItems, setScanItems] = useState<ExtractedItem[] | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [confirmingImport, setConfirmingImport] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<EditTransactionData | null>(null);
  const [showEditCard, setShowEditCard] = useState(false);
  const [tab, setTab] = useState<"geral" | "parcelados">("geral");
  const [showAddChooser, setShowAddChooser] = useState(false);
  const [recentEntry, setRecentEntry] = useState<EnrichedItem | null>(null);

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

  const total = currentInvoice ? Number(currentInvoice.total_amount) : 0;
  const paidAmount = currentInvoice ? Number((currentInvoice as any).paid_amount ?? 0) : 0;
  const outstanding = Math.max(0, total - paidAmount);
  const limitTotal = card ? Number(card.limit) : 0;
  const usedLimit = card ? Number(card.used_limit) : 0;
  const availableLimit = limitTotal - usedLimit;
  const usedPct = limitTotal > 0 ? Math.min((usedLimit / limitTotal) * 100, 100) : 0;
  const isOverLimit = usedLimit > limitTotal;

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
    setAlreadyImported(null);
    try {
      if (isInvoice && cardId) {
        // The same file hashes the same, so a repeat is visible before anything is written.
        const hash = await hashFile(file);
        setDocumentHash(hash);
        setDocumentName(file.name || null);
        setAlreadyImported(await findPreviousImport(cardId, hash));
      }

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

      if (isInvoice) {
        // What the statement brought in from last month goes in as its own line, so the
        // invoice ends up asking for what the statement asks for.
        const carry = statementCarryLine(
          data.carried_over,
          `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`,
        );
        if (carry) items.push(carry);
      }
      setExtractedItems(items);
      setExtractedMessage(data.message || "Lançamentos encontrados!");
      setDeclaredTotal(isInvoice ? (data.declared_total ?? null) : null);
      setExpectedTotal(isInvoice ? (data.expected_total ?? null) : null);
      setCarriedOver(isInvoice ? (data.carried_over ?? null) : null);
      setDeclaredNext(isInvoice ? (data.declared_next_invoice ?? null) : null);
      setDeclaredOutstanding(isInvoice ? (data.declared_outstanding ?? null) : null);
      setDeclaredCardLimit(isInvoice ? (data.declared_card_limit ?? null) : null);
      setDeclaredUsedLimit(isInvoice ? (data.declared_used_limit ?? null) : null);
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
      /* The same sequence the card panel runs — it is one function now. This screen
         used to skip applying the payments the statement reported, so importing the
         very same PDF here left earlier invoices unsettled and their limit held. */
      const outcome = await importStatement({
        userId: user.id,
        card: { id: cardId, dueDay: card.due_day },
        month: selectedMonth,
        year: selectedYear,
        items: selectedItems,
        documentHash,
        documentName,
        declared: {
          cardLimit: declaredCardLimit,
          usedLimit: declaredUsedLimit,
          total: declaredTotal,
          nextClosing: declaredNext,
        },
      });

      const n = outcome.rowCount;
      toast.success(`${n} lançamento${n > 1 ? "s" : ""} importado${n > 1 ? "s" : ""} com sucesso! 🎉`);
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

  /**
   * Where this invoice is in its month: when it closed (or closes), when it is due, and
   * where today sits between the two. The strip is drawn from the previous closing to
   * the due date, because that whole stretch is one cycle — the part before the notch
   * is still collecting purchases, the part after it is waiting to be paid.
   */
  const cycle = useMemo(() => {
    if (!card) return null;
    const dayIn = (y: number, m: number, d: number) =>
      new Date(y, m - 1, Math.min(d, new Date(y, m, 0).getDate()));

    const closing = dayIn(selectedYear, selectedMonth, card.closing_day);
    let due = dayIn(selectedYear, selectedMonth, card.due_day);
    if (due <= closing) due = dayIn(selectedYear, selectedMonth + 1, card.due_day);
    const start = dayIn(selectedYear, selectedMonth - 1, card.closing_day);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const span = Math.max(due.getTime() - start.getTime(), 1);
    const at = (d: Date) => Math.min(Math.max((d.getTime() - start.getTime()) / span, 0), 1) * 100;
    const days = (d: Date) => Math.round((d.getTime() - today.getTime()) / 86_400_000);

    const toClose = days(closing);
    const toDue = days(due);
    const label = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

    const sentence =
      total > 0 && outstanding <= 0 ? "Fatura paga."
      : toDue < 0 ? `Venceu há ${Math.abs(toDue)} dia${Math.abs(toDue) === 1 ? "" : "s"}.`
      : toClose > 0
        ? `Ainda aberta: fecha em ${toClose} dia${toClose === 1 ? "" : "s"} e vence em ${toDue}.`
        : toDue === 0 ? "Fechada. Vence hoje."
        : `Fechada. Vence em ${toDue} dia${toDue === 1 ? "" : "s"}.`;

    return {
      closingLabel: label(closing),
      dueLabel: label(due),
      closingPct: at(closing),
      pct: at(today),
      overdue: toDue < 0 && outstanding > 0,
      sentence,
    };
  }, [card, selectedMonth, selectedYear, total, outstanding]);

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

  /* Two views, one set of figures. The whole list of entries is this same screen with
     the panel folded away: it reads the same invoice, the same items and the same
     handlers, so there is no second place for the numbers to disagree. */
  const onEntries = location.pathname.endsWith("/lancamentos");
  const monthQuery = `?month=${selectedMonth}&year=${selectedYear}`;
  const headline = paidAmount > 0 && outstanding > 0 ? outstanding : total;

  return (
    <div className="mx-auto max-w-lg pb-28 pt-2">
      {onEntries ? (
        <div className="space-y-4">
          <div className="flex h-11 items-center justify-between">
            <BackButton to={`/fatura/${cardId}${monthQuery}`} />
            <button
              type="button"
              onClick={() => setShowAddChooser(true)}
              aria-label="Adicionar lançamento"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.07] text-white/82 ring-1 ring-white/10 active:scale-95"
            >
              <Plus className="h-[18px] w-[18px]" strokeWidth={2.4} />
            </button>
          </div>

          {/* Which invoice this list belongs to — the one thing a bare list cannot say. */}
          <div className="px-1">
            <p className="text-[12.5px] t-softer">{card?.name}</p>
            <p className="mt-0.5 text-[25px] font-extrabold leading-tight tracking-[-0.03em] text-white">
              Fatura de {MONTH_NAMES[selectedMonth - 1]}
            </p>
            <p className="mt-1 text-[13px] t-soft tabular-nums">
              {formatCurrency(total)}
              <span className="text-white/25"> · </span>
              {items.length} lançament{items.length === 1 ? "o" : "os"}
            </p>
          </div>

          <div className="isolate grid grid-cols-2 rounded-full border border-white/[0.08] willo-glass p-1">
            {([["geral", "Todos"], ["parcelados", "Parcelados"]] as const).map(([key, label]) => (
              <button key={key} type="button" onClick={() => setTab(key)} className="relative h-10 rounded-full text-[14px] font-medium">
                {tab === key && (
                  <motion.span layoutId="entries-tab" className="pointer-events-none absolute inset-0 z-0 rounded-full willo-invert" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
                )}
                <span className={cn("relative z-10 transform-gpu", tab === key ? "willo-on-invert" : "text-white/82")}>{label}</span>
              </button>
            ))}
          </div>

          <InvoiceTransactionList
            items={items}
            filter={tab === "parcelados" ? "parcelados" : "todos"}
            cardName={card?.name}
            invoiceMonth={selectedMonth}
            invoiceYear={selectedYear}
            payments={payments}
            isPaid={invoiceStatus === "paid"}
            onEditItem={handleEditItem}
            onDeleteItem={handleDeleteItem}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex h-11 items-center justify-between">
            <BackButton to="/cartoes" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button aria-label="Opções do cartão" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.07] text-white/82 ring-1 ring-white/10 transition-colors hover:text-white">
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
                        const cards = await getCreditCards();
                        const typedCards = cards as unknown as CreditCardInfo[];
                        setCard(typedCards.find((c) => c.id === cardId) ?? null);
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

          {/* ── Who this is, and what it is asking for ── */}
          <div className="px-1">
            <div className="flex items-center gap-2.5">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px]"
                style={{ background: cardHex }}
              >
                <span className="h-[6px] w-[9px] rounded-[1.5px] bg-white/85" />
              </span>
              <p className="min-w-0 flex-1 truncate text-[15px] font-semibold text-white">
                {card?.name}
                {card?.last_four_digits && (
                  <span className="t-softer tabular-nums"> · ••••{card.last_four_digits}</span>
                )}
              </p>
              {statusChip && (
                <span
                  className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold"
                  style={{ background: `${statusChip.hex}1F`, color: statusChip.hex }}
                >
                  {statusChip.label}
                </span>
              )}
            </div>

            <p className="mt-5 text-[13px] text-white/62">Fatura de {MONTH_NAMES[selectedMonth - 1]}</p>
            {/* What is still owed, never the leftover of a figure already part paid. */}
            <p className="mt-0.5 text-[40px] font-extrabold leading-none tracking-[-0.04em] text-white tabular-nums">
              {formatCurrency(headline)}
            </p>
            {paidAmount > 0 && outstanding > 0 ? (
              <p className="mt-2 text-[12.5px] t-soft tabular-nums">
                <span className="text-willo-green-ink">{formatCurrency(paidAmount)} já pagos</span> de{" "}
                {formatCurrency(total)}
              </p>
            ) : total > 0 && outstanding <= 0 ? (
              <p className="mt-2 flex items-center gap-1.5 text-[13px] font-medium text-willo-green-ink">
                <Check className="h-3.5 w-3.5" strokeWidth={3} /> Fatura paga
              </p>
            ) : null}
          </div>

          {/* ── The cycle, then the limit: the two things that bound this invoice ── */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="rounded-[24px] border border-white/[0.08] willo-glass px-5 pb-5 pt-4"
          >
            {cycle && (
              <>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[11.5px] font-semibold uppercase tracking-[0.12em] t-softer">Fecha</span>
                  <span className="text-[11.5px] font-semibold uppercase tracking-[0.12em] t-softer">Vence</span>
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-3">
                  <span className="text-[15px] font-bold text-white">{cycle.closingLabel}</span>
                  <span className={cn("text-[15px] font-bold", cycle.overdue ? "text-red-400" : "text-white")}>
                    {cycle.dueLabel}
                  </span>
                </div>

                {/* Where today sits between the two dates. */}
                <div className="relative mt-3 h-[6px] rounded-full bg-white/[0.08]">
                  <motion.span
                    className="absolute inset-y-0 left-0 rounded-full bg-white/35"
                    initial={{ width: 0 }}
                    animate={{ width: `${cycle.pct}%` }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                  />
                  {/* the closing day, as a notch on the way to the due date */}
                  <span
                    className="absolute top-1/2 h-[12px] w-px -translate-y-1/2 bg-white/35"
                    style={{ left: `${cycle.closingPct}%` }}
                  />
                  <motion.span
                    className="absolute top-1/2 h-[13px] w-[13px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[#0B0C10] bg-white"
                    initial={{ left: 0 }}
                    animate={{ left: `${cycle.pct}%` }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                  />
                </div>

                <p className={cn("mt-3 text-[13px]", cycle.overdue ? "text-red-400" : "t-soft")}>
                  {cycle.sentence}
                </p>

                <div className="my-4 h-px bg-white/[0.07]" />
              </>
            )}

            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] text-white/66">Limite</span>
              <span className={cn(
                "text-[12.5px] font-semibold tabular-nums",
                isOverLimit ? "text-red-400" : usedPct >= 80 ? "text-willo-amber" : "text-white/72",
              )}>
                {usedPct.toFixed(0)}% usado
              </span>
            </div>

            <div className="mt-2.5 h-[10px] overflow-hidden rounded-full bg-white/[0.07]">
              <motion.span
                className="block h-full rounded-full"
                style={{ background: isOverLimit ? "#F87171" : usedPct >= 80 ? "#FBBF24" : cardHex }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(usedPct, 100)}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>

            <div className="mt-3 flex items-baseline justify-between gap-3">
              <span className="truncate text-[12.5px] t-soft">
                Usado <span className="font-semibold tabular-nums text-white">{formatCurrency(usedLimit)}</span>
              </span>
              <span className="shrink-0 truncate text-[12.5px] t-soft">
                Disponível{" "}
                <span className={cn(
                  "font-semibold tabular-nums",
                  availableLimit > 0 ? "text-willo-green-ink" : "text-red-400",
                )}>
                  {formatCurrency(availableLimit)}
                </span>
              </span>
            </div>
            <p className="mt-1.5 text-[11.5px] t-faint tabular-nums">
              Limite total {formatCurrency(limitTotal)}
            </p>
          </motion.section>

          {/* ── The two things you came here to do ── */}
          <div className="space-y-2.5">
            {currentInvoice && outstanding > 0 && (
              <button
                type="button"
                onClick={() => setShowPayModal(true)}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-white text-[15px] font-bold willo-on-invert active:scale-[0.99]"
              >
                <Wallet className="h-4 w-4" />
                Pagar fatura · {formatCurrency(outstanding)}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowAddChooser(true)}
              className="flex h-13 w-full items-center justify-center gap-2 rounded-full border border-white/[0.14] willo-glass-control py-4 text-[14.5px] font-semibold text-white active:scale-[0.99]"
            >
              <Plus className="h-4 w-4" strokeWidth={2.4} />
              Adicionar lançamento
            </button>
          </div>

          {/* What this card is about to ask for, month by month */}
          <InvoiceForecastChart
            invoices={invoices}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onSelect={(m, y) => { setSelectedMonth(m); setSelectedYear(y); }}
            closingDay={card?.closing_day}
          />

          <InvoiceRecentCard
            items={items}
            onSeeAll={() => navigate(`/fatura/${cardId}/lancamentos${monthQuery}`)}
            onOpen={setRecentEntry}
          />
        </div>
      )}

      {/* The same card Transações opens for a transaction. */}
      <CardEntryModal
        entry={recentEntry && {
          transactionId: recentEntry.transaction_id,
          name: recentEntry.transaction_name,
          category: recentEntry.transaction_category,
          amount: Number(recentEntry.amount),
          date: recentEntry.transaction_date,
          installmentNumber: recentEntry.installment_number,
          totalInstallments: recentEntry.total_installments,
        }}
        cardName={card?.name}
        onClose={() => setRecentEntry(null)}
        onEdit={(id) => { setRecentEntry(null); void handleEditItem(id); }}
        onDelete={(id) => { setRecentEntry(null); void handleDeleteItem(id); }}
      />

      {/* What "add to this card" can mean */}
      <InvoiceAddChooserModal
        open={showAddChooser}
        onClose={() => setShowAddChooser(false)}
        onManual={() => { setShowAddChooser(false); setShowManualAdd(true); }}
        onScan={(file, mode) => { setShowAddChooser(false); void handleFileUpload(file, mode); }}
      />

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
        declaredNextInvoice={declaredNext}
        declaredOutstanding={declaredOutstanding}
        alreadyImported={alreadyImported}
        invoicePeriod={selectedYear * 12 + (selectedMonth - 1)}
        closingDay={card?.closing_day}
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
