import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, TrendingUp, TrendingDown, CalendarDays, FileText, Tag,
  Wallet, StickyNote, Check, Clock, CreditCard, Plus,
  Sparkles, Search, Settings, ChevronRight, Minus, Layers, Repeat,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import BottomSheet from "@/components/shared/BottomSheet";
import { colorFor, initials } from "@/lib/banks";
import { cardHex } from "@/hooks/useCardsOverview";
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

/** One heading per section, and one card per section. Nothing is boxed inside a box. */
const SECTION = "mb-2.5 mt-7 px-1 text-[10.5px] font-semibold uppercase tracking-[0.13em] text-white/45";
const GROUP = "divide-y divide-white/[0.055] rounded-[24px] border border-white/[0.07] willo-glass";

/**
 * The one control that switches between a handful of things. It lives above the group
 * it governs, never inside it, so a section never reads as two cards.
 */
function SegmentedControl<T extends string>({ id, value, options, onChange }: {
  id: string;
  value: T;
  options: { key: T; label: string; icon?: React.ComponentType<{ className?: string }> }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid gap-1 rounded-full border border-white/[0.07] bg-white/[0.04] p-1 [isolation:isolate]"
         style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const active = o.key === value;
        const Icon = o.icon;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            aria-pressed={active}
            className="relative h-10 rounded-full"
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                transition={{ type: "spring", stiffness: 420, damping: 36 }}
                className="absolute inset-0 rounded-full bg-white"
              />
            )}
            <span className={cn(
              "relative flex transform-gpu items-center justify-center gap-1.5 text-[13.5px] font-semibold transition-colors",
              active ? "text-[#0B0B0B]" : "text-white/60",
            )}>
              {Icon && <Icon className="h-4 w-4" />}
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** The same control, sized to sit on the right-hand side of a row. */
function MiniSegmented<T extends string>({ id, value, options, onChange }: {
  id: string;
  value: T;
  options: { key: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-full bg-white/[0.07] p-0.5 [isolation:isolate]">
      {options.map((o) => {
        const active = o.key === value;
        return (
          <button key={o.key} type="button" onClick={() => onChange(o.key)} className="relative h-8 rounded-full px-3 text-[12.5px] font-semibold">
            {active && (
              <motion.span
                layoutId={`mini-${id}`}
                transition={{ type: "spring", stiffness: 420, damping: 36 }}
                className="absolute inset-0 rounded-full bg-white"
              />
            )}
            <span className={cn("relative transform-gpu transition-colors", active ? "text-[#0B0B0B]" : "text-white/66")}>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** A number you nudge rather than type: nobody wants a keyboard for "12". */
const Stepper = ({ value, min, max, onChange, suffix }: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  suffix?: string;
}) => {
  const set = (v: number) => onChange(Math.min(Math.max(v, min), max));
  return (
    <span className="flex items-center gap-1 rounded-full bg-white/[0.07] p-0.5">
      <button
        type="button"
        onClick={() => set(value - 1)}
        disabled={value <= min}
        aria-label="Menos"
        className="flex h-8 w-8 items-center justify-center rounded-full text-white/80 disabled:opacity-25 active:bg-white/10"
      >
        <Minus className="h-4 w-4" strokeWidth={2.6} />
      </button>
      <span className="min-w-[34px] text-center text-[15px] font-bold tabular-nums text-white">
        {value}{suffix}
      </span>
      <button
        type="button"
        onClick={() => set(value + 1)}
        disabled={value >= max}
        aria-label="Mais"
        className="flex h-8 w-8 items-center justify-center rounded-full text-white/80 disabled:opacity-25 active:bg-white/10"
      >
        <Plus className="h-4 w-4" strokeWidth={2.6} />
      </button>
    </span>
  );
};

/** An account or a card to pick, shown as itself rather than as a chip in a box. */
const PickRow = ({ selected, onClick, hex, initials: ini, icon: Icon, title, subtitle }: {
  selected: boolean;
  onClick: () => void;
  hex: string;
  initials?: string;
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  title: string;
  subtitle?: string;
}) => (
  <button type="button" onClick={onClick} className="flex w-full items-center gap-3.5 px-[18px] py-3 text-left active:bg-white/[0.03]">
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11.5px] font-bold text-white"
      style={{ background: hex }}
    >
      {Icon ? <Icon className="h-[15px] w-[15px]" style={{ color: "#fff" }} /> : ini}
    </span>
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[15px] font-medium text-white">{title}</span>
      {subtitle && <span className="block truncate text-[12px] text-white/40">{subtitle}</span>}
    </span>
    <span className={cn(
      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
      selected ? "border-white bg-white" : "border-white/20",
    )}>
      {selected && <Check className="h-3 w-3 text-[#0B0B0B]" strokeWidth={3.4} />}
    </span>
  </button>
);

const AddRow = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button type="button" onClick={onClick} className="flex w-full items-center gap-3.5 px-[18px] py-3.5 text-left active:bg-white/[0.03]">
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-dashed border-white/20">
      <Plus className="h-4 w-4 text-white/60" />
    </span>
    <span className="text-[14.5px] text-white/70">{label}</span>
  </button>
);

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
  const [showDateSheet, setShowDateSheet] = useState(false);
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
          // Falling back to the first account matters: with none flagged as default
          // nothing was selected at all, and the form let you submit without one.
          const defaultAcc = filtered.find((a: any) => a.is_default) ?? filtered[0];
          if (defaultAcc) setAccountId((prev) => prev || defaultAcc.id);
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

  const today = new Date();
  const isToday = format(date, "yyyy-MM-dd") === format(today, "yyyy-MM-dd");
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const isYesterday = format(date, "yyyy-MM-dd") === format(yesterday, "yyyy-MM-dd");
  const dateLabel = isToday ? "Hoje" : isYesterday ? "Ontem" : format(date, "d 'de' MMMM", { locale: ptBR });

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
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain scrollbar-none px-4 pb-6">
              {/* Amount */}
              <div className="relative flex flex-col items-center pb-8 pt-7" onClick={() => amountInputRef.current?.focus()}>
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

              {/* ── O que foi ──────────────────────────────────────────── */}
              <p className={SECTION}>O que foi</p>
              <div className={GROUP}>
                <Row icon={FileText} label="Descrição">
                  <input
                    placeholder={isReceita ? "Ex: Salário" : "Ex: Mercado"}
                    value={description}
                    onChange={(e) => handleDescriptionChange(e.target.value)}
                    maxLength={100}
                    className="w-full min-w-0 bg-transparent text-right text-[15px] text-white placeholder:text-white/30 focus:outline-none"
                  />
                </Row>
                <Row icon={Tag} label="Categoria" onClick={() => setShowCategoryModal(true)}>
                  {suggestingCategory && <Sparkles className="h-3.5 w-3.5 animate-pulse text-white/60" />}
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
                    <span className="text-[15px] text-white/35">Escolher</span>
                  )}
                  {suggestedCategory && !suggestingCategory && category === suggestedCategory && (
                    <span className="rounded-full bg-white/[0.08] px-1.5 py-0.5 text-[10px] text-white/70">IA</span>
                  )}
                  <ChevronRight className="h-4 w-4 shrink-0 text-white/30" />
                </Row>
                <Row icon={CalendarDays} label="Data" onClick={() => setShowDateSheet(true)}>
                  <span className="truncate text-[15px] text-white">{dateLabel}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-white/30" />
                </Row>
              </div>

              {/* ── Onde ───────────────────────────────────────────────── */}
              <p className={SECTION}>{isReceita ? "Onde entrou" : "Como pagou"}</p>

              {/* The choice sits above the group it governs rather than inside it:
                  a control boxed within the box it filters reads as two cards. */}
              {type === "despesa" && (
                <div className="mb-2.5">
                  <SegmentedControl<"conta" | "cartao">
                    id="pay-method"
                    value={paymentMethod}
                    onChange={(key) => {
                      setPaymentMethod(key);
                      if (key === "cartao") setStatus("pendente");
                    }}
                    options={[
                      { key: "conta" as const, label: "Conta", icon: Wallet },
                      { key: "cartao" as const, label: "Cartão", icon: CreditCard },
                    ]}
                  />
                </div>
              )}

              <div className={GROUP}>
                {!usingCard ? (
                  loadingAccounts ? (
                    <div className="flex items-center justify-center gap-2 px-[18px] py-5 text-[13px] text-white/60">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" /> Carregando contas…
                    </div>
                  ) : accounts.length === 0 ? (
                    <div className="space-y-3 px-[18px] py-5 text-center">
                      <p className="text-[14px] text-white/70">Você precisa de uma conta antes</p>
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
                      {accounts.map((acc) => (
                        <PickRow
                          key={acc.id}
                          selected={acc.id === accountId}
                          onClick={() => setAccountId(acc.id)}
                          hex={colorFor(acc.name, (acc as { color?: string | null }).color ?? null)}
                          initials={initials(acc.name)}
                          title={acc.name}
                          subtitle={acc.is_default ? "Conta padrão" : undefined}
                        />
                      ))}
                      {!showNewAccount ? (
                        <AddRow label="Criar nova conta" onClick={() => setShowNewAccount(true)} />
                      ) : (
                        <div className="flex gap-2 px-3 py-3">
                          <input
                            placeholder="Nome da conta"
                            value={newAccountName}
                            onChange={(e) => setNewAccountName(e.target.value)}
                            className="h-11 min-w-0 flex-1 rounded-full bg-white/[0.06] px-4 text-[14px] text-white placeholder:text-white/35 focus:outline-none"
                          />
                          <button type="button" onClick={handleCreateAccount} disabled={!newAccountName.trim()} className="h-11 shrink-0 rounded-full bg-white px-4 text-[13px] font-semibold text-[#0B0B0B] disabled:opacity-40">
                            Criar
                          </button>
                          <button type="button" onClick={() => { setShowNewAccount(false); setNewAccountName(""); }} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-white/70">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </>
                  )
                ) : (
                  <>
                    {creditCards.length === 0 ? (
                      <p className="px-[18px] py-5 text-center text-[14px] text-white/60">Nenhum cartão cadastrado</p>
                    ) : (
                      creditCards.map((card) => (
                        <PickRow
                          key={card.id}
                          selected={card.id === creditCardId}
                          onClick={() => setCreditCardId(card.id)}
                          hex={cardHex(card.color)}
                          icon={CreditCard}
                          title={card.name}
                          subtitle={`Vence dia ${card.due_day}`}
                        />
                      ))
                    )}
                    {!showNewCard ? (
                      <AddRow label="Cadastrar cartão" onClick={() => setShowNewCard(true)} />
                    ) : (
                      <div className="space-y-2 px-3 py-3">
                        <input placeholder="Nome do cartão" value={newCardName} onChange={(e) => setNewCardName(e.target.value)} className="h-11 w-full rounded-full bg-white/[0.06] px-4 text-[14px] text-white placeholder:text-white/35 focus:outline-none" />
                        <input placeholder="Limite" inputMode="numeric" value={newCardLimit} onChange={(e) => setNewCardLimit(e.target.value)} className="h-11 w-full rounded-full bg-white/[0.06] px-4 text-[14px] text-white placeholder:text-white/35 focus:outline-none" />
                        <div className="flex gap-2">
                          <label className="flex h-11 flex-1 items-center gap-2 rounded-full bg-white/[0.06] px-4">
                            <span className="shrink-0 text-[13px] text-white/50">Fecha</span>
                            <input inputMode="numeric" value={newCardClosingDay} onChange={(e) => setNewCardClosingDay(e.target.value)} className="w-full min-w-0 bg-transparent text-right text-[14px] tabular-nums text-white focus:outline-none" />
                          </label>
                          <label className="flex h-11 flex-1 items-center gap-2 rounded-full bg-white/[0.06] px-4">
                            <span className="shrink-0 text-[13px] text-white/50">Vence</span>
                            <input inputMode="numeric" value={newCardDueDay} onChange={(e) => setNewCardDueDay(e.target.value)} className="w-full min-w-0 bg-transparent text-right text-[14px] tabular-nums text-white focus:outline-none" />
                          </label>
                        </div>
                        <div className="flex gap-2 pt-0.5">
                          <button type="button" onClick={handleCreateCreditCard} disabled={!newCardName.trim() || !newCardLimit} className="h-11 flex-1 rounded-full bg-white text-[13px] font-semibold text-[#0B0B0B] disabled:opacity-40">
                            Cadastrar
                          </button>
                          <button type="button" onClick={() => { setShowNewCard(false); setNewCardName(""); setNewCardLimit(""); }} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06] text-white/70">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* ── Repetição ──────────────────────────────────────────── */}
              <p className={SECTION}>Repetição</p>
              <SegmentedControl<"unica" | "parcelado" | "fixa">
                id="recurrence"
                value={recurrenceType}
                onChange={setRecurrenceType}
                options={
                  isReceita
                    ? [
                        { key: "unica" as const, label: "Única" },
                        { key: "fixa" as const, label: "Todo mês" },
                      ]
                    : [
                        { key: "unica" as const, label: "Única" },
                        { key: "parcelado" as const, label: "Parcelado" },
                        { key: "fixa" as const, label: usingCard ? "Assinatura" : "Todo mês" },
                      ]
                }
              />

              <AnimatePresence initial={false}>
                {!isReceita && recurrenceType === "parcelado" && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <div className={cn(GROUP, "mt-2.5")}>
                      <Row icon={Layers} label="Parcelas">
                        <Stepper
                          value={installments}
                          min={2}
                          max={48}
                          onChange={setInstallments}
                          suffix="x"
                        />
                      </Row>
                      <Row icon={Repeat} label="Frequência">
                        <MiniSegmented<"mensal" | "anual">
                          id="freq"
                          value={installmentFrequency}
                          onChange={setInstallmentFrequency}
                          options={[
                            { key: "mensal" as const, label: "Mensal" },
                            { key: "anual" as const, label: "Anual" },
                          ]}
                        />
                      </Row>
                      {!(paymentMethod === "cartao" && installmentMonths.length > 0) && (
                        <Row icon={Check} label="Já pagas">
                          <Stepper
                            value={paidInstallments}
                            min={0}
                            max={Math.max(installments - 1, 0)}
                            onChange={setPaidInstallments}
                          />
                        </Row>
                      )}
                    </div>

                    {/* On a card the months are real invoices, so they are picked by name */}
                    {paymentMethod === "cartao" && installmentMonths.length > 0 && (
                      <div className="mt-2.5">
                        <p className="mb-2 px-1 text-[12px] text-white/50">Quais parcelas já foram pagas?</p>
                        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 scrollbar-none">
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
                    )}

                    {amountCents > 0 && installments > 0 && (
                      <p className="mt-2.5 px-1 text-[13px] text-white/60">
                        <b className="font-semibold text-white">{installments}x de {currencySymbol()} {formatCurrency(Math.round(amountCents / installments))}</b>
                        {paidInstallments > 0 && ` · ${paidInstallments} já pagas`}
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Fechamento ─────────────────────────────────────────── */}
              <form id="nova-transacao-form" onSubmit={handleSubmit}>
                <p className={SECTION}>Mais</p>
                <div className={GROUP}>
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

          {/* When it happened: two taps for the usual answers, a calendar for the rest */}
          <BottomSheet open={showDateSheet} onClose={() => setShowDateSheet(false)} zIndex={70}>
            <div className="px-4 pb-2">
              <h3 className="px-1 text-[17px] font-bold text-white">Quando foi?</h3>
              <div className={cn(GROUP, "mt-3")}>
                {([["hoje", "Hoje"], ["ontem", "Ontem"]] as const).map(([mode, label]) => {
                  const on = mode === "hoje" ? isToday : isYesterday;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => { handleDateMode(mode); setShowDateSheet(false); }}
                      className="flex w-full items-center gap-3.5 px-[18px] py-3.5 text-left active:bg-white/[0.03]"
                    >
                      <CalendarDays className="h-[17px] w-[17px] shrink-0 text-white/40" strokeWidth={2} />
                      <span className="flex-1 text-[15px] text-white">{label}</span>
                      {on && <Check className="h-4 w-4 shrink-0 text-white" strokeWidth={2.8} />}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex justify-center rounded-[24px] border border-white/[0.07] willo-glass p-2">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => {
                    if (d) {
                      setDate(d);
                      setDateMode("outros");
                      setShowDateSheet(false);
                    }
                  }}
                  className="pointer-events-auto p-1"
                  locale={ptBR}
                />
              </div>
            </div>
          </BottomSheet>

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
