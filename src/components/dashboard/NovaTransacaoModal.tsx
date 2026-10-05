import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, TrendingUp, TrendingDown, CalendarDays, FileText, Tag,
  Wallet, StickyNote, Check, Clock, CreditCard, Plus,
  Sparkles, Search, Settings, ChevronRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import BottomSheet from "@/components/shared/BottomSheet";
import TransactionTypeSwitch, { type EntryType } from "@/components/dashboard/TransactionTypeSwitch";
import TransferBody from "@/components/dashboard/TransferSheet";
import { cn } from "@/lib/utils";
import { format, subDays, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  createTransaction,
  updateTransaction,
  getAccounts,
  createAccount,
  suggestCategory,
  getCreditCards,
  createCreditCard,
} from "@/services/transactionService";
import { getCustomCategories, createCustomCategory, type CustomCategory } from "@/services/categoryService";
import CategoryCreateModal, { getIconComponent } from "@/components/dashboard/CategoryCreateModal";
import { getDefaultCategoryIcon, DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from "@/lib/categoryIcons";
import { getCategoryHexColor } from "@/lib/categoryUtils";

import { currencySymbol } from "@/lib/currency";
export interface EditTransactionData {
  id: string;
  name: string;
  type: "receita" | "despesa";
  amount: number;
  category: string;
  date: string;
  status: "pago" | "pendente";
  payment_method: "conta" | "cartao";
  account_id?: string | null;
  credit_card_id?: string | null;
  recurrence_type?: "unica" | "parcelado" | "fixa";
  installments?: number | null;
  installment_current?: number | null;
  observation?: string | null;
}

export interface PrefillData {
  name?: string;
  type?: "receita" | "despesa";
  amount?: number;
  category?: string;
  date?: string;
  recurrence_type?: "unica" | "parcelado" | "fixa";
  installments?: number | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialType?: "receita" | "despesa";
  initialPaymentMethod?: "conta" | "cartao";
  initialCreditCardId?: string;
  editTransaction?: EditTransactionData | null;
  prefillData?: PrefillData | null;
}

/** Settings-style row: icon, label on the left, control on the right. */
const Row = ({ icon: Icon, label, children, onClick }: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: string | number }>;
  label: string;
  children?: React.ReactNode;
  onClick?: () => void;
}) => (
  <div
    role={onClick ? "button" : undefined}
    onClick={onClick}
    className={cn("flex min-h-[58px] items-center gap-3.5 px-[18px] py-2.5", onClick && "cursor-pointer active:bg-white/[0.03]")}
  >
    <Icon className="h-[17px] w-[17px] shrink-0 text-white/40" strokeWidth={2} />
    <span className="shrink-0 text-[15px] text-white">{label}</span>
    <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 text-right">{children}</div>
  </div>
);


const CATEGORIES_EXPENSE = DEFAULT_EXPENSE_CATEGORIES;
const CATEGORIES_INCOME = DEFAULT_INCOME_CATEGORIES;

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

interface Account {
  id: string;
  name: string;
  type: string;
  is_default: boolean;
}

interface CreditCardItem {
  id: string;
  name: string;
  limit: number;
  used_limit: number;
  closing_day: number;
  due_day: number;
  color: string | null;
}

const MONTH_NAMES_SHORT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

const MONTH_NAMES_FULL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const BODY_SLIDE = {
  enter: (dir: number) => ({ x: dir * 26, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir * -26, opacity: 0 }),
};

/** Left to right, matching the switch, so the slide direction follows the eye. */
const KIND_ORDER: EntryType[] = ["receita", "despesa", "transferencia"];

const NovaTransacaoModal = ({ open, onClose, onSuccess, initialType = "despesa", initialPaymentMethod, initialCreditCardId, editTransaction, prefillData }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [type, setType] = useState<"receita" | "despesa">(initialType);
  // The kind of entry being made. Receita and despesa drive this form; transferência
  // swaps the body out, so the three live in one sheet instead of behind a chooser.
  const [entryKind, setEntryKind] = useState<EntryType>(initialType);
  const [slideDir, setSlideDir] = useState(1);
  const [status, setStatus] = useState<"pago" | "pendente">("pago");
  const [description, setDescription] = useState("");
  const [amountCents, setAmountCents] = useState(0);
  const [category, setCategory] = useState("");
  const [suggestedCategory, setSuggestedCategory] = useState<string | null>(null);
  const [suggestingCategory, setSuggestingCategory] = useState(false);
  const [date, setDate] = useState<Date>(new Date());
  const [dateMode, setDateMode] = useState<"hoje" | "ontem" | "outros">("hoje");
  const [showCalendar, setShowCalendar] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"conta" | "cartao">("conta");
  const [recurrenceType, setRecurrenceType] = useState<"unica" | "parcelado" | "fixa">("unica");
  const [installments, setInstallments] = useState<number>(2);
  const [paidInstallments, setPaidInstallments] = useState<number>(0);
  const [paidMonthFlags, setPaidMonthFlags] = useState<boolean[]>([]);
  const [installmentFrequency, setInstallmentFrequency] = useState<"mensal" | "anual">("mensal");
  const [observation, setObservation] = useState("");
  const [accountId, setAccountId] = useState<string>("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [newAccountName, setNewAccountName] = useState("");
  const [showNewAccount, setShowNewAccount] = useState(false);
  const [creditCards, setCreditCards] = useState<CreditCardItem[]>([]);
  const [creditCardId, setCreditCardId] = useState<string>("");
  const [showNewCard, setShowNewCard] = useState(false);
  const [newCardName, setNewCardName] = useState("");
  const [newCardLimit, setNewCardLimit] = useState("");
  const [newCardClosingDay, setNewCardClosingDay] = useState("10");
  const [newCardDueDay, setNewCardDueDay] = useState("20");
  const [submitting, setSubmitting] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showCategoryCreate, setShowCategoryCreate] = useState(false);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const suggestTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Calculate installment months based on purchase date and card closing day
  const installmentMonths = useMemo(() => {
    if (recurrenceType !== "parcelado" || paymentMethod !== "cartao" || installments < 2) return [];
    const selectedCard = creditCards.find(c => c.id === creditCardId);
    if (!selectedCard) return [];
    const closingDay = selectedCard.closing_day;
    const purchaseDate = date;
    const dayOfMonth = purchaseDate.getDate();
    // If purchase day > closing day, first installment is next month
    let firstMonth: number, firstYear: number;
    const pMonth = purchaseDate.getMonth(); // 0-indexed
    const pYear = purchaseDate.getFullYear();
    if (dayOfMonth > closingDay) {
      // Goes to next month
      if (pMonth === 11) {
        firstMonth = 0;
        firstYear = pYear + 1;
      } else {
        firstMonth = pMonth + 1;
        firstYear = pYear;
      }
    } else {
      firstMonth = pMonth;
      firstYear = pYear;
    }
    const months: { month: number; year: number; label: string }[] = [];
    for (let i = 0; i < installments; i++) {
      let m = firstMonth + i;
      let y = firstYear;
      while (m > 11) { m -= 12; y++; }
      months.push({
        month: m,
        year: y,
        label: `${MONTH_NAMES_FULL[m]}${y !== new Date().getFullYear() ? ` ${y}` : ""}`,
      });
    }
    return months;
  }, [recurrenceType, paymentMethod, installments, creditCardId, creditCards, date]);

  // Sync paidMonthFlags length with installmentMonths
  useEffect(() => {
    if (installmentMonths.length > 0) {
      setPaidMonthFlags(prev => {
        const next = new Array(installmentMonths.length).fill(false);
        // Preserve existing selections
        for (let i = 0; i < Math.min(prev.length, next.length); i++) {
          next[i] = prev[i];
        }
        return next;
      });
    }
  }, [installmentMonths.length]);

  // Sync paidInstallments from flags (count consecutive from start)
  useEffect(() => {
    if (paymentMethod === "cartao" && recurrenceType === "parcelado" && installmentMonths.length > 0) {
      let count = 0;
      for (let i = 0; i < paidMonthFlags.length; i++) {
        if (paidMonthFlags[i]) count++;
        else break;
      }
      setPaidInstallments(count);
    }
  }, [paidMonthFlags, paymentMethod, recurrenceType, installmentMonths.length]);

  const hiddenDefaults = new Set(
    customCategories
      .filter((c) => c.type === type && c.is_hidden_default)
      .map((c) => c.name.trim().toLocaleLowerCase("pt-BR"))
  );
  const allCategories = Array.from(
    new Set([
      ...(type === "receita" ? CATEGORIES_INCOME : CATEGORIES_EXPENSE)
        .filter((n) => !hiddenDefaults.has(n.trim().toLocaleLowerCase("pt-BR"))),
      ...customCategories
        .filter((c) => c.type === type && !c.is_hidden_default)
        .map((c) => c.name.trim())
        .filter(Boolean),
    ])
  );
  const usedCategoryColors = allCategories.map((c) => getCategoryHexColor(c, customCategories));

  const filteredCategories = categorySearch
    ? allCategories.filter((c) => c.toLowerCase().includes(categorySearch.toLowerCase()))
    : allCategories;

  // Fetch accounts, credit cards and custom categories
  useEffect(() => {
    if (open && user) {
      setLoadingAccounts(true);
      getAccounts()
        .then((accs) => {
          const filtered = (accs as Account[]).filter((a) => a.type !== "investment");
          setAccounts(filtered);
          const defaultAcc = filtered.find((a: any) => a.is_default);
          if (defaultAcc) setAccountId(defaultAcc.id);
        })
        .catch(() => {
          toast.error("Erro ao carregar contas");
        })
        .finally(() => setLoadingAccounts(false));
      getCreditCards().then((cards) => {
        const typedCards = cards as unknown as CreditCardItem[];
        setCreditCards(typedCards);
        if (initialCreditCardId && typedCards.some(c => c.id === initialCreditCardId)) {
          setCreditCardId(initialCreditCardId);
        } else if (typedCards.length > 0) {
          setCreditCardId(typedCards[0].id);
        }
      });
      getCustomCategories().then((cats) => setCustomCategories(cats)).catch(() => {});
    }
  }, [open, user]);

  const isEditMode = !!editTransaction;

  // Reset form
  useEffect(() => {
    if (open) {
      if (editTransaction) {
        // Edit mode: pre-fill with transaction data
        setType(editTransaction.type);
        setEntryKind(editTransaction.type);
        setStatus(editTransaction.status);
        setDescription(editTransaction.name);
        setAmountCents(Math.round(editTransaction.amount * 100));
        setCategory(editTransaction.category);
        setSuggestedCategory(null);
        const txDate = new Date(editTransaction.date + "T12:00:00");
        setDate(txDate);
        setDateMode("outros");
        setShowCalendar(false);
        setPaymentMethod(editTransaction.payment_method || "conta");
        setRecurrenceType((editTransaction.recurrence_type as any) || "unica");
        setInstallments(editTransaction.installments || 2);
        setPaidInstallments(editTransaction.installment_current ? editTransaction.installment_current - 1 : 0);
        // Pre-fill month flags for edit mode
        const editPaid = editTransaction.installment_current ? editTransaction.installment_current - 1 : 0;
        setPaidMonthFlags(prev => {
          const flags = new Array(editTransaction.installments || 2).fill(false);
          for (let i = 0; i < editPaid; i++) flags[i] = true;
          return flags;
        });
        setInstallmentFrequency("mensal");
        setObservation(editTransaction.observation?.replace(/^paid_installments:\d+\s*(\|\s*)?/, "") || "");
        setShowNewAccount(false);
        setNewAccountName("");
        setShowCategoryModal(false);
        setCategorySearch("");
        if (editTransaction.credit_card_id) setCreditCardId(editTransaction.credit_card_id);
        if (editTransaction.account_id) setAccountId(editTransaction.account_id);
        setShowNewCard(false);
        setNewCardName("");
        setNewCardLimit("");
        setNewCardClosingDay("10");
        setNewCardDueDay("20");
      } else {
        // Create mode: reset form (or pre-fill from OCR)
        const pf = prefillData;
        setType(pf?.type || initialType);
        setEntryKind(pf?.type || initialType);
        setStatus("pago");
        setDescription(pf?.name || "");
        setAmountCents(pf?.amount ? Math.round(pf.amount * 100) : 0);
        setCategory(pf?.category || "");
        setSuggestedCategory(null);
        if (pf?.date) {
          const pfDate = new Date(pf.date + "T12:00:00");
          setDate(pfDate);
          setDateMode("outros");
        } else {
          setDate(new Date());
          setDateMode("hoje");
        }
        setShowCalendar(false);
        setPaymentMethod(initialPaymentMethod ?? "conta");
        setRecurrenceType((pf?.recurrence_type as any) || "unica");
        setInstallments(pf?.installments || 2);
        setPaidInstallments(0);
        setPaidMonthFlags([]);
        setInstallmentFrequency("mensal");
        setObservation("");
        setShowNewAccount(false);
        setNewAccountName("");
        setShowCategoryModal(false);
        setCategorySearch("");
        setCreditCardId("");
        setShowNewCard(false);
        setNewCardName("");
        setNewCardLimit("");
        setNewCardClosingDay("10");
        setNewCardDueDay("20");

        // Trigger AI category suggestion if prefill has a name
        if (pf?.name && pf.name.trim().length >= 2 && !pf.category) {
          triggerSuggest(pf.name, pf.type || initialType);
        }
      }
    }
  }, [open, initialType, editTransaction, prefillData]);

  // AI category suggestion with debounce - faster
  const triggerSuggest = useCallback(
    (desc: string, txType: "receita" | "despesa") => {
      if (suggestTimeoutRef.current) clearTimeout(suggestTimeoutRef.current);
      if (desc.trim().length < 2) {
        setSuggestedCategory(null);
        return;
      }
      suggestTimeoutRef.current = setTimeout(async () => {
        setSuggestingCategory(true);
        const customNames = customCategories.filter(c => c.type === txType).map(c => c.name);
        const result = await suggestCategory(desc, txType, customNames);
        const suggestedName = result.category;
        setSuggestedCategory(suggestedName);
        if (suggestedName && !category) {
          setCategory(suggestedName);
          // Auto-create category if it doesn't exist
          const allCats = [
            ...(txType === "receita" ? CATEGORIES_INCOME : CATEGORIES_EXPENSE),
            ...customCategories.filter(c => c.type === txType).map(c => c.name),
          ];
          if (!allCats.includes(suggestedName) && user) {
            try {
              const cat = await createCustomCategory(user.id, {
                name: suggestedName,
                icon: result.icon || "file-text",
                color: result.color || "#8b5cf6",
                type: txType,
              });
              setCustomCategories(prev => [...prev, cat]);
            } catch {
              // silently fail - category might already exist
            }
          }
        }
        setSuggestingCategory(false);
      }, 350);
    },
    [category, customCategories, user]
  );

  const handleDescriptionChange = (val: string) => {
    setDescription(val);
    triggerSuggest(val, type);
  };

  const handleDateMode = (mode: "hoje" | "ontem" | "outros") => {
    setDateMode(mode);
    if (mode === "hoje") {
      setDate(new Date());
      setShowCalendar(false);
    } else if (mode === "ontem") {
      setDate(subDays(new Date(), 1));
      setShowCalendar(false);
    } else {
      setShowCalendar(true);
    }
  };

  const handleAmountKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      setAmountCents((prev) => Math.floor(prev / 10));
      return;
    }
    if (e.key >= "0" && e.key <= "9") {
      e.preventDefault();
      setAmountCents((prev) => {
        const next = prev * 10 + parseInt(e.key);
        return next > 99999999 ? prev : next;
      });
    }
  };

  const handleCreateAccount = async () => {
    if (!user || !newAccountName.trim()) return;
    try {
      const acc = await createAccount(user.id, { name: newAccountName.trim() });
      setAccounts((prev) => [...prev, acc as Account]);
      setAccountId(acc.id);
      setShowNewAccount(false);
      setNewAccountName("");
      toast.success("Conta criada!");
    } catch {
      toast.error("Erro ao criar conta");
    }
  };

  const handleCreateCreditCard = async () => {
    if (!user || !newCardName.trim() || !newCardLimit) return;
    try {
      const card = await createCreditCard(
        {
          name: newCardName.trim(),
          limit: parseFloat(newCardLimit),
          closing_day: parseInt(newCardClosingDay),
          due_day: parseInt(newCardDueDay),
        },
        user.id
      );
      const typedCard = card as unknown as CreditCardItem;
      setCreditCards((prev) => [...prev, typedCard]);
      setCreditCardId(typedCard.id);
      setShowNewCard(false);
      setNewCardName("");
      setNewCardLimit("");
      toast.success("Cartão cadastrado!");
    } catch {
      toast.error("Erro ao criar cartão");
    }
  };

  const handleCreateCategory = (nameOverride?: string) => {
    const name = (nameOverride || newCategoryName).trim();
    if (!name) return;
    setCategory(name);
    setNewCategoryName("");
    setShowCategoryModal(false);
  };

  const handleCreateCategoryFromModal = async (data: { name: string; icon: string; color: string }) => {
    if (!user) return;
    try {
      const cat = await createCustomCategory(user.id, { ...data, type });
      setCustomCategories((prev) => [...prev, cat]);
      setCategory(data.name);
      setShowCategoryCreate(false);
      setCategorySearch("");
      setShowCategoryModal(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível criar a categoria");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (amountCents === 0) {
      toast.error("Digite um valor");
      return;
    }
    if (!category) {
      toast.error("Selecione uma categoria");
      return;
    }
    if ((paymentMethod === "conta" || type === "receita") && accounts.length === 0) {
      toast.error("Você precisa cadastrar uma conta antes");
      return;
    }
    if ((paymentMethod === "conta" || type === "receita") && !accountId) {
      toast.error("Selecione uma conta");
      return;
    }

    const realAmount = amountCents / 100;
    const isParcelado = recurrenceType === "parcelado" && installments > 1;
    // For parcelado, the amount stored per transaction is per-installment
    const perInstallmentAmount = isParcelado ? Math.round((realAmount / installments) * 100) / 100 : realAmount;
    const currentInstallment = isParcelado ? (paidInstallments + 1) : null;
    const dateStr = format(date, "yyyy-MM-dd");
    const finalName = description.trim() || category;

    setSubmitting(true);
    try {
      const observationValue = isParcelado && paidInstallments > 0
        ? `paid_installments:${paidInstallments}${observation.trim() ? ` | ${observation.trim()}` : ""}`
        : (observation.trim() || null);

      if (isEditMode && editTransaction) {
        // Edit mode: update existing transaction
        await updateTransaction(editTransaction.id, {
          name: finalName,
          type,
          amount: isParcelado ? perInstallmentAmount : realAmount,
          category,
          date: dateStr,
          status: paymentMethod === "cartao" ? "pendente" : status,
          payment_method: type === "despesa" ? paymentMethod : "conta",
          recurrence_type: recurrenceType,
          installments: isParcelado ? installments : null,
          installment_current: currentInstallment,
          observation: observationValue,
          account_id: paymentMethod === "cartao" ? null : (accountId || null),
          credit_card_id: paymentMethod === "cartao" ? (creditCardId || null) : null,
        });
        toast.success("Transação atualizada ✏️", {
          description: `${type === "receita" ? "Receita" : "Despesa"} de ${currencySymbol()} ${formatCurrency(amountCents)}`,
        });
      } else {
        // Create mode
        await createTransaction(
          {
            name: finalName,
            type,
            amount: perInstallmentAmount,
            category,
            date: dateStr,
            status: paymentMethod === "cartao" ? "pendente" : status,
            account_id: paymentMethod === "cartao" ? null : (accountId || null),
            payment_method: type === "despesa" ? paymentMethod : "conta",
            recurrence_type: recurrenceType,
            installments: isParcelado ? installments : null,
            installment_current: currentInstallment,
            observation: observationValue,
            credit_card_id: paymentMethod === "cartao" ? (creditCardId || null) : null,
          },
          user.id
        );
        const statusLabel = status === "pago"
          ? (type === "receita" ? "recebida" : "registrada")
          : "agendada";
        toast.success(`Transação ${statusLabel} 🎯`, {
          description: `${type === "receita" ? "Receita" : "Despesa"} de ${currencySymbol()} ${formatCurrency(amountCents)}`,
        });
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar transação");
    } finally {
      setSubmitting(false);
    }
  };

  const isReceita = type === "receita";
  const accent = isReceita ? "#C8F36D" : "#F87171";
  const usingCard = type === "despesa" && paymentMethod === "cartao";

  // Account colors for visual dots
  const accountColors = ["#8b5cf6", "#f97316", "#00e676", "#00e676", "#3b82f6", "#ec4899"];

  const chip = (active: boolean) =>
    cn(
      "h-9 shrink-0 rounded-full px-4 text-[13px] font-semibold transition-colors",
      active ? "bg-white text-[#0B0B0B]" : "bg-white/[0.06] text-white/74",
    );

  const selectTrigger = "h-9 w-auto max-w-[190px] gap-1.5 rounded-full border-0 bg-white/[0.06] px-3.5 text-[13px] text-white focus:ring-0";

  const changeKind = (next: EntryType) => {
    if (next === entryKind) return;
    // The body travels the way the pill did. Switching used to swap one whole sheet
    // for another, so transferência dropped the modal and rebuilt it from the bottom
    // while receita and despesa only slid — three controls, two different gestures.
    setSlideDir(KIND_ORDER.indexOf(next) > KIND_ORDER.indexOf(entryKind) ? 1 : -1);
    setEntryKind(next);
    if (next !== "transferencia") setType(next);
  };

  // Editing an existing entry has no kind to choose — it already is one.
  const switcher = isEditMode ? null : <TransactionTypeSwitch value={entryKind} onChange={changeKind} />;
  const isTransfer = entryKind === "transferencia" && !isEditMode;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 34, stiffness: 320 }}
          className="willo-bg fixed inset-0 z-[60] flex flex-col md:inset-auto md:left-1/2 md:top-1/2 md:h-[88vh] md:w-[440px] md:-translate-x-1/2 md:-translate-y-1/2 md:overflow-hidden md:rounded-[32px] md:border md:border-white/[0.08]"
        >
          {/* Nav */}
          <div className="shrink-0 px-4" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 10px)" }}>
            <div className="flex h-11 items-center justify-between">
              <button onClick={onClose} aria-label="Fechar" className="-ml-1 flex h-10 w-10 items-center justify-center rounded-full text-white/82 active:opacity-60">
                <X className="h-6 w-6" />
              </button>
              <span className="text-[16px] font-semibold text-white">
                {isEditMode
                  ? "Editar lançamento"
                  : isTransfer
                    ? "Nova transferência"
                    : isReceita
                      ? "Nova receita"
                      : "Nova despesa"}
              </span>
              <span className="w-10" />
            </div>
            {switcher && <div className="pb-1 pt-2">{switcher}</div>}
          </div>

          {/* One shell, one gesture: only this layer changes when the kind changes, and
              it always travels sideways — the sheet itself never leaves the screen. */}
          <div className="relative flex min-h-0 flex-1 flex-col">
            <AnimatePresence initial={false} mode="wait" custom={slideDir}>
              <motion.div
                key={isTransfer ? "transferencia" : type}
                custom={slideDir}
                variants={BODY_SLIDE}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="flex min-h-0 flex-1 flex-col"
              >
                {isTransfer ? (
                  <TransferBody onClose={onClose} onSuccess={onSuccess} />
                ) : (
                  <>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
              {/* Amount */}
              <div className="relative flex flex-col items-center pb-8 pt-7" onClick={() => amountInputRef.current?.focus()}>
                {/* Which kind of entry this is, said as light rather than as one more label */}
                <motion.span
                  key={accent}
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-24 left-1/2 h-[340px] w-[160vw] -translate-x-1/2"
                  style={{ background: `radial-gradient(50% 44% at 50% 48%, ${accent} 0%, transparent 72%)` }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.22 }}
                  transition={{ duration: 0.45 }}
                />
                <span className="relative flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
                  {isReceita
                    ? <TrendingUp className="h-[13px] w-[13px]" style={{ color: accent }} strokeWidth={2.6} />
                    : <TrendingDown className="h-[13px] w-[13px]" style={{ color: accent }} strokeWidth={2.6} />}
                  {isReceita ? "Valor da receita" : "Valor da despesa"}
                </span>
                <div className="relative mt-3.5 flex items-baseline gap-2">
                  <span className="text-[22px] font-bold text-white/45">{currencySymbol()}</span>
                  <motion.span
                    key={amountCents}
                    initial={{ scale: 1.04 }}
                    animate={{ scale: 1 }}
                    className={cn("text-[54px] font-extrabold leading-none tracking-[-0.04em] tabular-nums", amountCents === 0 ? "text-white/30" : "text-white")}
                  >
                    {formatCurrency(amountCents)}
                  </motion.span>
                  <input
                    ref={amountInputRef}
                    inputMode="numeric"
                    value={formatCurrency(amountCents)}
                    onKeyDown={handleAmountKeyDown}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                      setAmountCents(Math.min(Number(digits || "0"), 99999999));
                    }}
                    aria-label="Valor da transação"
                    autoFocus
                    className="absolute inset-0 w-full cursor-text opacity-0"
                  />
                </div>
                <span className="relative mt-4 h-[3px] w-12 rounded-full" style={{ background: accent }} />
              </div>

              {/* Description + category */}
              <div className="divide-y divide-white/[0.055] rounded-[24px] border border-white/[0.07] willo-glass">
                <Row icon={FileText} label="Descrição">
                  <input
                    placeholder={isReceita ? "Ex: Salário" : "Ex: Mercado"}
                    value={description}
                    onChange={(e) => handleDescriptionChange(e.target.value)}
                    maxLength={100}
                    className="w-full min-w-0 bg-transparent text-right text-[15px] text-white placeholder:text-white/45 focus:outline-none"
                  />
                </Row>
                <Row icon={Tag} label="Categoria" onClick={() => setShowCategoryModal(true)}>
                  {suggestingCategory && <Sparkles className="h-3.5 w-3.5 animate-pulse text-white/66" />}
                  {category ? (
                    <span className="flex min-w-0 items-center gap-2">
                      {(() => {
                        const CatIcon = getDefaultCategoryIcon(category);
                        const hex = getCategoryHexColor(category, customCategories);
                        return <CatIcon className="h-4 w-4 shrink-0" style={{ color: hex }} />;
                      })()}
                      <span className="truncate text-[15px] text-white">{category}</span>
                    </span>
                  ) : (
                    <span className="text-[15px] text-white/50">Escolher</span>
                  )}
                  {suggestedCategory && !suggestingCategory && category === suggestedCategory && (
                    <span className="rounded-full bg-white/[0.08] px-1.5 py-0.5 text-[10px] text-white/74">IA</span>
                  )}
                  <ChevronRight className="h-4 w-4 shrink-0 text-white/38" />
                </Row>
              </div>

              {/* Date */}
              <p className="mb-2.5 mt-7 px-1 text-[10.5px] font-semibold uppercase tracking-[0.13em] text-white/45">Data</p>
              <div className="rounded-[22px] border border-white/[0.08] willo-glass p-3">
                <div className="flex gap-2">
                  {(["hoje", "ontem", "outros"] as const).map((mode) => (
                    <button key={mode} type="button" onClick={() => handleDateMode(mode)} className={chip(dateMode === mode)}>
                      {mode === "outros" ? "Outra data" : mode === "hoje" ? "Hoje" : "Ontem"}
                    </button>
                  ))}
                </div>
                {dateMode === "outros" && (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => setShowCalendar((prev) => !prev)}
                      className="flex h-11 w-full items-center gap-2 rounded-full bg-white/[0.06] px-4 text-[15px] text-white"
                    >
                      <CalendarDays className="h-4 w-4 text-white/66" />
                      {format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </button>
                    {showCalendar && (
                      <div className="mt-2 flex justify-center rounded-[18px] bg-white/[0.03] p-2">
                        <Calendar
                          mode="single"
                          selected={date}
                          onSelect={(d) => {
                            if (d) {
                              setDate(d);
                              setShowCalendar(false);
                            }
                          }}
                          className="pointer-events-auto p-1"
                          locale={ptBR}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Where */}
              <p className="mb-2.5 mt-7 px-1 text-[10.5px] font-semibold uppercase tracking-[0.13em] text-white/45">{isReceita ? "Onde entrou" : "Como pagou"}</p>
              <div className="rounded-[22px] border border-white/[0.08] willo-glass">
                {type === "despesa" && (
                  <div className="grid grid-cols-2 gap-1 p-1.5">
                    {([["conta", "Conta", Wallet], ["cartao", "Cartão de crédito", CreditCard]] as const).map(([key, label, Icon]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setPaymentMethod(key);
                          if (key === "cartao") setStatus("pendente");
                        }}
                        className={cn(
                          "flex h-10 items-center justify-center gap-1.5 rounded-full text-[13px] font-semibold transition-colors",
                          paymentMethod === key ? "bg-white text-[#0B0B0B]" : "text-white/70",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {label}
                      </button>
                    ))}
                  </div>
                )}

                <div className={cn(type === "despesa" && "border-t border-white/[0.06]")}>
                  {!usingCard ? (
                    loadingAccounts ? (
                      <div className="flex items-center justify-center gap-2 p-4 text-[13px] text-white/62">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" /> Carregando contas...
                      </div>
                    ) : accounts.length === 0 ? (
                      <div className="space-y-3 p-4 text-center">
                        <p className="text-[14px] text-white/74">Você precisa adicionar uma conta antes</p>
                        <button
                          type="button"
                          onClick={() => { onClose(); navigate("/gestao"); }}
                          className="h-10 rounded-full bg-white px-5 text-[13px] font-semibold text-[#0B0B0B]"
                        >
                          Adicionar conta
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="px-4 py-3.5">
                          <span className="flex items-center gap-2.5 text-[15px] text-white/74">
                            <Wallet className="h-[18px] w-[18px] text-white/62" /> Conta
                          </span>
                          <div className="mt-2.5 flex flex-wrap gap-2">
                            {accounts.map((acc, idx) => {
                              const on = acc.id === accountId;
                              return (
                                <button
                                  key={acc.id}
                                  type="button"
                                  onClick={() => setAccountId(acc.id)}
                                  className={cn(
                                    "flex h-10 items-center gap-2 rounded-full border px-3.5 text-[14px] font-medium transition-colors",
                                    on ? "border-white bg-white text-[#0B0B0B]" : "border-white/[0.08] bg-white/[0.04] text-white/80",
                                  )}
                                >
                                  <span
                                    className="h-2.5 w-2.5 rounded-full"
                                    style={{ backgroundColor: on ? "#0B0B0B" : accountColors[idx % accountColors.length] }}
                                  />
                                  {acc.name}
                                  {acc.is_default && <span className={cn("text-[11px]", on ? "text-[#0B0B0B]/60" : "text-white/56")}>padrão</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        {!showNewAccount ? (
                          <button
                            type="button"
                            onClick={() => setShowNewAccount(true)}
                            className="flex w-full items-center gap-1.5 border-t border-white/[0.06] px-4 py-3 text-[13px] text-white/70"
                          >
                            <Plus className="h-3.5 w-3.5" /> Criar nova conta
                          </button>
                        ) : (
                          <div className="flex gap-2 border-t border-white/[0.06] p-3">
                            <Input
                              placeholder="Nome da conta"
                              value={newAccountName}
                              onChange={(e) => setNewAccountName(e.target.value)}
                              className="h-10 flex-1 rounded-full border-0 bg-white/[0.06] text-[14px]"
                            />
                            <button type="button" onClick={handleCreateAccount} disabled={!newAccountName.trim()} className="h-10 rounded-full bg-white px-4 text-[13px] font-semibold text-[#0B0B0B] disabled:opacity-40">
                              Criar
                            </button>
                            <button type="button" onClick={() => { setShowNewAccount(false); setNewAccountName(""); }} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] text-white/74">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </>
                    )
                  ) : (
                    <>
                      {creditCards.length > 0 ? (
                        <Row icon={CreditCard} label="Cartão">
                          <Select value={creditCardId} onValueChange={setCreditCardId}>
                            <SelectTrigger className={selectTrigger}>
                              <SelectValue placeholder="Selecionar" />
                            </SelectTrigger>
                            <SelectContent className="z-[70]">
                              {creditCards.map((card) => (
                                <SelectItem key={card.id} value={card.id}>
                                  <div className="flex items-center gap-2">
                                    <span>{card.name}</span>
                                    <span className="ml-1 text-[10px] text-muted-foreground">Vence dia {card.due_day}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Row>
                      ) : (
                        <p className="p-4 text-center text-[14px] text-white/62">Nenhum cartão cadastrado</p>
                      )}
                      {!showNewCard ? (
                        <button
                          type="button"
                          onClick={() => setShowNewCard(true)}
                          className="flex w-full items-center gap-1.5 border-t border-white/[0.06] px-4 py-3 text-[13px] text-white/70"
                        >
                          <Plus className="h-3.5 w-3.5" /> Cadastrar cartão
                        </button>
                      ) : (
                        <div className="space-y-2 border-t border-white/[0.06] p-3">
                          <Input placeholder="Nome do cartão (ex: Nubank)" value={newCardName} onChange={(e) => setNewCardName(e.target.value)} className="h-10 rounded-full border-0 bg-white/[0.06] text-[14px]" />
                          <Input placeholder="Limite (ex: 5000)" type="number" value={newCardLimit} onChange={(e) => setNewCardLimit(e.target.value)} className="h-10 rounded-full border-0 bg-white/[0.06] text-[14px]" />
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <Label className="px-2 text-[11px] text-white/62">Fecha dia</Label>
                              <Input type="number" min={1} max={31} value={newCardClosingDay} onChange={(e) => setNewCardClosingDay(e.target.value)} className="h-10 rounded-full border-0 bg-white/[0.06] text-[14px]" />
                            </div>
                            <div className="flex-1">
                              <Label className="px-2 text-[11px] text-white/62">Vence dia</Label>
                              <Input type="number" min={1} max={31} value={newCardDueDay} onChange={(e) => setNewCardDueDay(e.target.value)} className="h-10 rounded-full border-0 bg-white/[0.06] text-[14px]" />
                            </div>
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button type="button" onClick={handleCreateCreditCard} disabled={!newCardName.trim() || !newCardLimit} className="h-10 flex-1 rounded-full bg-white text-[13px] font-semibold text-[#0B0B0B] disabled:opacity-40">
                              Cadastrar
                            </button>
                            <button type="button" onClick={() => { setShowNewCard(false); setNewCardName(""); setNewCardLimit(""); }} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] text-white/74">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Repetition */}
              <p className="mb-2.5 mt-7 px-1 text-[10.5px] font-semibold uppercase tracking-[0.13em] text-white/45">Repetição</p>
              <div className="rounded-[22px] border border-white/[0.08] willo-glass p-3">
                <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                  {(isReceita ? (["unica", "fixa"] as const) : (["unica", "parcelado", "fixa"] as const)).map((rt) => (
                    <button key={rt} type="button" onClick={() => setRecurrenceType(rt)} className={chip(recurrenceType === rt)}>
                      {rt === "unica" ? "Única" : rt === "parcelado" ? "Parcelado" : usingCard ? "Assinatura" : "Todo mês"}
                    </button>
                  ))}
                </div>

                <AnimatePresence>
                  {!isReceita && recurrenceType === "parcelado" && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="space-y-3 overflow-hidden pt-3"
                    >
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          inputMode="numeric"
                          placeholder="Nº de parcelas"
                          value={installments === 0 ? "" : installments}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === "") {
                              setInstallments(0);
                              return;
                            }
                            const parsed = Number(value);
                            if (!Number.isNaN(parsed)) setInstallments(parsed);
                          }}
                          onBlur={() => {
                            setInstallments((prev) => {
                              if (!prev || prev < 2) return 2;
                              return Math.min(prev, 48);
                            });
                          }}
                          min={2}
                          max={48}
                          className="h-10 flex-1 rounded-full border-0 bg-white/[0.06] text-[14px]"
                        />
                        {(["mensal", "anual"] as const).map((f) => (
                          <button key={f} type="button" onClick={() => setInstallmentFrequency(f)} className={chip(installmentFrequency === f)}>
                            {f === "mensal" ? "Mensal" : "Anual"}
                          </button>
                        ))}
                      </div>

                      {paymentMethod === "cartao" && installmentMonths.length > 0 ? (
                        <div className="space-y-2">
                          <p className="px-1 text-[12px] text-white/62">Parcelas já pagas</p>
                          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                            {installmentMonths.map((im, idx) => {
                              const isSelected = paidMonthFlags[idx] ?? false;
                              const isLast = idx === installmentMonths.length - 1;
                              const canToggle = !isSelected ? idx === 0 || (paidMonthFlags[idx - 1] ?? false) : !paidMonthFlags[idx + 1];
                              return (
                                <button
                                  key={`${im.year}-${im.month}`}
                                  type="button"
                                  disabled={!canToggle || isLast}
                                  onClick={() => {
                                    setPaidMonthFlags((prev) => {
                                      const next = [...prev];
                                      next[idx] = !next[idx];
                                      return next;
                                    });
                                  }}
                                  className={cn(
                                    "flex h-9 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 text-[12px] font-semibold transition-colors",
                                    isSelected ? "bg-white text-[#0B0B0B]" : "bg-white/[0.06] text-white/74",
                                    (isLast || (!canToggle && !isSelected)) && "opacity-35",
                                  )}
                                >
                                  {isSelected && <Check className="h-3 w-3" />}
                                  {MONTH_NAMES_SHORT[im.month]}
                                  <span className="text-[10px] opacity-60">{idx + 1}/{installments}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <Input
                          type="number"
                          inputMode="numeric"
                          placeholder="Parcelas já pagas (opcional)"
                          value={paidInstallments === 0 ? "" : paidInstallments}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === "") {
                              setPaidInstallments(0);
                              return;
                            }
                            const parsed = Number(value);
                            if (!Number.isNaN(parsed)) setPaidInstallments(parsed);
                          }}
                          onBlur={() => {
                            setPaidInstallments((prev) => {
                              if (prev < 0) return 0;
                              return Math.min(prev, Math.max(installments - 1, 0));
                            });
                          }}
                          min={0}
                          max={Math.max(installments - 1, 0)}
                          className="h-10 rounded-full border-0 bg-white/[0.06] text-[14px]"
                        />
                      )}

                      {amountCents > 0 && installments > 0 && (
                        <p className="px-1 text-[13px] text-white/70">
                          {installments}x de {currencySymbol()} {formatCurrency(Math.round(amountCents / installments))}
                          {paidInstallments > 0 && ` · ${paidInstallments} já pagas`}
                        </p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Status + note */}
              <form id="nova-transacao-form" onSubmit={handleSubmit}>
                <div className="mt-6 divide-y divide-white/[0.055] rounded-[24px] border border-white/[0.07] willo-glass">
                  {!usingCard && (
                    <Row icon={status === "pago" ? Check : Clock} label={status === "pago" ? (isReceita ? "Recebido" : "Pago") : isReceita ? "A receber" : "Pendente"}>
                      <Switch
                        checked={status === "pago"}
                        onCheckedChange={(checked) => setStatus(checked ? "pago" : "pendente")}
                        className="data-[state=checked]:bg-willo-green data-[state=unchecked]:bg-white/15"
                      />
                    </Row>
                  )}
                  <Row icon={StickyNote} label="Observação">
                    <input
                      placeholder="Opcional"
                      value={observation}
                      onChange={(e) => setObservation(e.target.value)}
                      maxLength={200}
                      className="w-full min-w-0 bg-transparent text-right text-[15px] text-white placeholder:text-white/45 focus:outline-none"
                    />
                  </Row>
                </div>
              </form>
            </div>

            {/* Save */}
            <div className="shrink-0 border-t border-white/[0.06] px-4 pt-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)" }}>
              <button
                type="submit"
                form="nova-transacao-form"
                disabled={submitting || amountCents === 0}
                className="h-14 w-full rounded-full bg-white text-[16px] font-bold text-[#0B0B0B] shadow-[0_10px_30px_-12px_rgba(255,255,255,0.35)] transition-opacity disabled:opacity-35"
              >
                {submitting ? "Salvando..." : isEditMode ? "Salvar alterações" : isReceita ? "Adicionar receita" : "Adicionar despesa"}
              </button>
            </div>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Category picker */}
          <BottomSheet open={showCategoryModal} onClose={() => setShowCategoryModal(false)} size="full" zIndex={70}>
            <div className="px-5">
              <div className="flex items-center justify-between">
                <p className="text-[22px] font-bold text-white">Categoria</p>
                <button
                  type="button"
                  onClick={() => {
                    setShowCategoryModal(false);
                    onClose();
                    navigate("/categorias");
                  }}
                  className="flex items-center gap-1 text-[13px] text-white/70"
                >
                  <Settings className="h-4 w-4" /> Gerenciar
                </button>
              </div>
              <div className="relative mt-4">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
                <input
                  placeholder="Buscar categoria"
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  className="h-11 w-full rounded-full bg-white/[0.06] pl-11 pr-4 text-[15px] text-white placeholder:text-white/45 focus:outline-none"
                />
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 pb-4">
                {filteredCategories.map((cat) => {
                  const customCat = customCategories.find((c) => c.name === cat && c.type === type);
                  const CatIcon = customCat ? getIconComponent(customCat.icon) : getDefaultCategoryIcon(cat);
                  const hex = getCategoryHexColor(cat, customCategories);
                  const selected = category === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        setCategory(cat);
                        setShowCategoryModal(false);
                      }}
                      className={cn(
                        "flex flex-col items-center gap-2 rounded-[20px] border px-2 py-3.5 text-center transition-colors",
                        selected ? "border-white bg-white/[0.08]" : "border-white/[0.06] willo-glass-inset",
                      )}
                    >
                      <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: `${hex}22` }}>
                        <CatIcon className="h-5 w-5" style={{ color: hex }} />
                      </span>
                      <span className="line-clamp-2 text-[12px] leading-tight text-white/85">{cat}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setShowCategoryCreate(true)}
                  className="flex flex-col items-center gap-2 rounded-[20px] border border-dashed border-white/15 px-2 py-3.5"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06]">
                    <Plus className="h-5 w-5 text-white" />
                  </span>
                  <span className="text-[12px] text-white/82">Nova</span>
                </button>
              </div>
              {filteredCategories.length === 0 && (
                <div className="pb-6 text-center">
                  <p className="text-[14px] text-white/56">Nenhuma categoria encontrada</p>
                  {categorySearch.trim() && (
                    <button
                      type="button"
                      onClick={() => setShowCategoryCreate(true)}
                      className="mt-3 rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-[#0B0B0B]"
                    >
                      Criar “{categorySearch.trim()}”
                    </button>
                  )}
                </div>
              )}
            </div>
          </BottomSheet>

          {/* Category Create Modal */}
          <CategoryCreateModal
            open={showCategoryCreate}
            onClose={() => setShowCategoryCreate(false)}
            onSave={handleCreateCategoryFromModal}
            title="Nova Categoria"
            initialName={categorySearch.trim()}
            existingNames={allCategories}
            usedColors={usedCategoryColors}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NovaTransacaoModal;
