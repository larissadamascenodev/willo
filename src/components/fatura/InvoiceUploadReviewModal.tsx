import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Check, Loader2, Sparkles, ShieldCheck, ShieldAlert, AlertTriangle,
  Edit3, ChevronRight, Clock, Wallet, Search, Plus, Settings, Tag, Store, Repeat, Layers,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { DEFAULT_EXPENSE_CATEGORIES, getDefaultCategoryIcon } from "@/lib/categoryIcons";
import { getCustomCategories, createCustomCategory, type CustomCategory } from "@/services/categoryService";
import { getCategoryHexColor } from "@/lib/categoryUtils";
import CategoryCreateModal, { getIconComponent } from "@/components/dashboard/CategoryCreateModal";
import BottomSheet from "@/components/shared/BottomSheet";
import { useAuth } from "@/contexts/AuthContext";

import { currencySymbol, getCurrency } from "@/lib/currency";
export interface ExtractedItem {
  description: string;
  amount: number;
  date: string | null;
  installment_current: number | null;
  installment_total: number | null;
  category: string;
  type?: string;
  confidence?: number;
  merchant?: string | null;
  selected: boolean;
  is_recurring?: boolean;
  time?: string | null;
  account_id?: string | null;
}

interface ReviewAccount {
  id: string;
  name: string;
  is_default?: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  items: ExtractedItem[];
  message: string;
  onConfirm: (items: ExtractedItem[]) => void;
  confirming: boolean;
  avgConfidence?: number;
  accounts?: ReviewAccount[];
  showAccountSelector?: boolean;
}

const fmtMoney = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const tone =
    confidence >= 0.8
      ? { Icon: ShieldCheck, cls: "text-willo-green bg-willo-green/10" }
      : confidence >= 0.5
        ? { Icon: ShieldAlert, cls: "text-amber-300 bg-amber-300/10" }
        : { Icon: AlertTriangle, cls: "text-red-400 bg-red-400/10" };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", tone.cls)}>
      <tone.Icon className="h-3 w-3" /> {pct}%
    </span>
  );
}

function categoryVisual(category: string, customCategories: CustomCategory[]) {
  const custom = customCategories.find((c) => c.name === category);
  const Icon = custom ? getIconComponent(custom.icon) : getDefaultCategoryIcon(category || "");
  return { Icon, hex: getCategoryHexColor(category || "", customCategories) };
}

/** Settings-style row: icon, label on the left, control on the right. */
const Row = ({ icon: Icon, label, children, onClick }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children?: React.ReactNode;
  onClick?: () => void;
}) => (
  <div
    role={onClick ? "button" : undefined}
    onClick={onClick}
    className={cn("flex min-h-[56px] items-center gap-3 px-4 py-2.5", onClick && "cursor-pointer active:bg-white/[0.03]")}
  >
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06]">
      <Icon className="h-4 w-4 text-white/70" />
    </span>
    <span className="shrink-0 text-[15px] text-white">{label}</span>
    <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 text-right">{children}</div>
  </div>
);

const inlineInput = "w-full min-w-0 bg-transparent text-right text-[15px] text-white placeholder:text-white/30 focus:outline-none";

function CategoryPickerSheet({ open, selected, onSelect, onClose, customCategories, onCreateCategory }: {
  open: boolean;
  selected: string;
  onSelect: (cat: string) => void;
  onClose: () => void;
  customCategories: CustomCategory[];
  onCreateCategory: () => void;
}) {
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const unique = [...new Set([
    ...customCategories.filter((c) => c.type === "despesa" && !c.is_hidden_default).map((c) => c.name),
    ...DEFAULT_EXPENSE_CATEGORIES,
  ])];
  const filtered = search ? unique.filter((c) => c.toLowerCase().includes(search.toLowerCase())) : unique;

  return (
    <BottomSheet open={open} onClose={onClose} size="full" zIndex={80}>
      <div className="px-5">
        <div className="flex items-center justify-between">
          <p className="text-[22px] font-bold text-white">Categoria</p>
          <button type="button" onClick={() => { onClose(); navigate("/categorias"); }} className="flex items-center gap-1 text-[13px] text-white/55">
            <Settings className="h-4 w-4" /> Gerenciar
          </button>
        </div>
        <div className="relative mt-4">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input
            placeholder="Buscar categoria"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 w-full rounded-full bg-white/[0.06] pl-11 pr-4 text-[15px] text-white placeholder:text-white/30 focus:outline-none"
          />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 pb-4">
          {filtered.map((cat) => {
            const { Icon, hex } = categoryVisual(cat, customCategories);
            const isSelected = cat.toLowerCase() === selected.toLowerCase();
            return (
              <button
                key={cat}
                type="button"
                onClick={() => { onSelect(cat); onClose(); }}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-[20px] border px-2 py-3.5",
                  isSelected ? "border-white bg-white/[0.08]" : "border-white/[0.06] bg-[#1A1A1A]",
                )}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: `${hex}22` }}>
                  <Icon className="h-5 w-5" style={{ color: hex }} />
                </span>
                <span className="line-clamp-2 text-[12px] leading-tight text-white/85">{cat}</span>
              </button>
            );
          })}
          <button type="button" onClick={onCreateCategory} className="flex flex-col items-center gap-2 rounded-[20px] border border-dashed border-white/15 px-2 py-3.5">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06]">
              <Plus className="h-5 w-5 text-white" />
            </span>
            <span className="text-[12px] text-white/70">Nova</span>
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

function SingleItemReview({ item, onUpdate, accounts = [], showAccountSelector = false, avgConfidence }: {
  item: ExtractedItem;
  onUpdate: (field: keyof ExtractedItem, value: unknown) => void;
  accounts?: ReviewAccount[];
  showAccountSelector?: boolean;
  avgConfidence?: number;
}) {
  const { user } = useAuth();
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showCategoryCreate, setShowCategoryCreate] = useState(false);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const isExpense = item.type !== "receita";
  const conf = item.confidence ?? avgConfidence ?? 0.5;

  const formatAmount = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  useEffect(() => {
    getCustomCategories("despesa").then(setCustomCategories).catch(() => {});
  }, []);

  const { Icon: CatIcon, hex: catHex } = categoryVisual(item.category, customCategories);

  const handleCreateCategoryFromModal = async (data: { name: string; icon: string; color: string }) => {
    if (!user) return;
    try {
      const cat = await createCustomCategory(user.id, { ...data, type: "despesa" });
      setCustomCategories((prev) => [...prev, cat]);
    } finally {
      onUpdate("category", data.name);
      setShowCategoryCreate(false);
    }
  };

  return (
    <div>
      {/* AI banner */}
      <div className="flex items-center justify-center gap-2 pt-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1 text-[12px] text-white/70">
          <Sparkles className="h-3.5 w-3.5" /> Lido pela IA
        </span>
        <ConfidenceBadge confidence={conf} />
      </div>

      {/* Type */}
      <div className="mx-auto mt-5 grid w-[220px] grid-cols-2 rounded-full bg-[#141414] p-1">
        {(["despesa", "receita"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onUpdate("type", t)}
            className={cn("h-9 rounded-full text-[13px] font-semibold transition-colors", (isExpense ? "despesa" : "receita") === t ? "bg-white text-[#0B0B0B]" : "text-white/55")}
          >
            {t === "despesa" ? "Despesa" : "Receita"}
          </button>
        ))}
      </div>

      {/* Amount */}
      <label className="relative mt-5 flex items-baseline justify-center gap-2">
        <span className="text-[24px] font-bold text-white/40">{currencySymbol()}</span>
        <input
          type="text"
          inputMode="numeric"
          value={formatAmount(item.amount)}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "");
            onUpdate("amount", digits ? Number(digits) / 100 : 0);
          }}
          className="w-[70%] bg-transparent text-center text-[52px] font-extrabold leading-none tracking-tight text-white tabular-nums focus:outline-none"
        />
      </label>
      <div className="mt-3 flex justify-center">
        <span className="h-1 w-10 rounded-full" style={{ background: isExpense ? "#F87171" : "#C8F36D" }} />
      </div>

      {/* Fields */}
      <div className="mt-7 divide-y divide-white/[0.06] rounded-[22px] border border-white/[0.07] bg-[#141414]">
        <Row icon={Edit3} label="Descrição">
          <input value={item.description} onChange={(e) => onUpdate("description", e.target.value)} placeholder="Nome" className={inlineInput} />
        </Row>
        <Row icon={Store} label="Local">
          <input value={item.merchant || ""} onChange={(e) => onUpdate("merchant", e.target.value)} placeholder="Opcional" className={inlineInput} />
        </Row>
        <Row icon={Tag} label="Categoria" onClick={() => setShowCategoryPicker(true)}>
          <CatIcon className="h-4 w-4 shrink-0" style={{ color: catHex }} />
          <span className="truncate text-[15px] capitalize text-white">{item.category || "Escolher"}</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-white/25" />
        </Row>
        <Row icon={Clock} label="Data">
          <input
            type="date"
            value={item.date || ""}
            onChange={(e) => onUpdate("date", e.target.value)}
            className="bg-transparent text-right text-[15px] text-white [color-scheme:dark] focus:outline-none"
          />
          {item.time && <span className="text-[13px] text-white/40">{item.time}</span>}
        </Row>
        {showAccountSelector && (
          <Row icon={Wallet} label="Conta">
            {accounts.length > 0 ? (
              <Select value={item.account_id ?? undefined} onValueChange={(value) => onUpdate("account_id", value)}>
                <SelectTrigger className="h-9 w-auto max-w-[190px] gap-1.5 rounded-full border-0 bg-white/[0.06] px-3.5 text-[13px] text-white focus:ring-0">
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent className="z-[80]">
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name} {account.is_default ? "(padrão)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="text-[13px] text-white/40">Cadastre uma conta</span>
            )}
          </Row>
        )}
        <Row icon={Repeat} label="Todo mês">
          <Switch
            checked={!!item.is_recurring}
            onCheckedChange={(checked) => onUpdate("is_recurring", checked)}
            className="data-[state=checked]:bg-willo-green data-[state=unchecked]:bg-white/15"
          />
        </Row>
      </div>

      <p className="mt-4 px-2 text-center text-[12px] text-white/35">Confira os dados antes de confirmar. Você pode editar tudo aqui.</p>

      <CategoryPickerSheet
        open={showCategoryPicker}
        selected={item.category}
        onSelect={(cat) => onUpdate("category", cat)}
        onClose={() => setShowCategoryPicker(false)}
        customCategories={customCategories}
        onCreateCategory={() => { setShowCategoryPicker(false); setShowCategoryCreate(true); }}
      />
      <CategoryCreateModal open={showCategoryCreate} onClose={() => setShowCategoryCreate(false)} onSave={handleCreateCategoryFromModal} title="Nova Categoria" />
    </div>
  );
}

const shortDate = (date: string | null) => {
  if (!date) return null;
  const [, m, d] = date.split("-");
  return m && d ? `${d}/${m}` : null;
};

/** Edit one extracted line before importing: name, category, amount, date and instalments. */
function ItemEditSheet({ item, onClose, onChange }: {
  item: { index: number; data: ExtractedItem } | null;
  onClose: () => void;
  onChange: (index: number, field: keyof ExtractedItem, value: unknown) => void;
}) {
  const { user } = useAuth();
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showCategoryCreate, setShowCategoryCreate] = useState(false);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);

  useEffect(() => {
    getCustomCategories("despesa").then(setCustomCategories).catch(() => {});
  }, []);

  const data = item?.data;
  const update = (field: keyof ExtractedItem, value: unknown) => {
    if (item) onChange(item.index, field, value);
  };

  const handleCreateCategory = async (payload: { name: string; icon: string; color: string }) => {
    if (user) {
      try {
        const cat = await createCustomCategory(user.id, { ...payload, type: "despesa" });
        setCustomCategories((prev) => [...prev, cat]);
      } catch {
        /* the category still applies to this item */
      }
    }
    update("category", payload.name);
    setShowCategoryCreate(false);
  };

  const { Icon: CatIcon, hex: catHex } = categoryVisual(data?.category ?? "", customCategories);
  const isPlan = !!(data?.installment_total && data.installment_total > 1);

  return (
    <>
      <BottomSheet open={!!item} onClose={onClose} zIndex={70}>
        {data && (
          <div className="px-5 pb-2">
            <p className="text-[22px] font-extrabold tracking-tight text-white">Editar lançamento</p>

            <label className="relative mt-5 flex items-baseline justify-center gap-2">
              <span className="text-[22px] font-bold text-white/40">{currencySymbol()}</span>
              <input
                type="text"
                inputMode="numeric"
                value={data.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "");
                  update("amount", digits ? Number(digits) / 100 : 0);
                }}
                className="w-[70%] bg-transparent text-center text-[44px] font-extrabold leading-none tracking-tight text-white tabular-nums focus:outline-none"
              />
            </label>
            {isPlan && (
              <p className="mt-2 text-center text-[12px] text-white/40">valor de cada parcela</p>
            )}

            <div className="mt-6 divide-y divide-white/[0.06] rounded-[22px] border border-white/[0.07] bg-[#141414]">
              <Row icon={Edit3} label="Descrição">
                <input value={data.description} onChange={(e) => update("description", e.target.value)} placeholder="Nome" className={inlineInput} />
              </Row>
              <Row icon={Tag} label="Categoria" onClick={() => setShowCategoryPicker(true)}>
                <CatIcon className="h-4 w-4 shrink-0" style={{ color: catHex }} />
                <span className="truncate text-[15px] text-white">{data.category || "Escolher"}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-white/25" />
              </Row>
              <Row icon={Clock} label="Data da compra">
                <input
                  type="date"
                  value={data.date || ""}
                  onChange={(e) => update("date", e.target.value)}
                  className="bg-transparent text-right text-[15px] text-white [color-scheme:dark] focus:outline-none"
                />
              </Row>
              {isPlan && (
                <Row icon={Layers} label="Parcela">
                  <input
                    type="number"
                    min={1}
                    max={data.installment_total ?? 1}
                    value={data.installment_current ?? 1}
                    onChange={(e) => update("installment_current", Math.max(1, Math.min(data.installment_total ?? 1, Number(e.target.value))))}
                    className="w-12 bg-transparent text-right text-[15px] text-white focus:outline-none"
                  />
                  <span className="text-[15px] text-white/45">de {data.installment_total}</span>
                </Row>
              )}
            </div>

            {isPlan && (
              <p className="mt-3 px-1 text-center text-[12px] leading-snug text-white/35">
                As parcelas anteriores não entram. A cobrança começa nesta fatura e segue até a {data.installment_total}ª.
              </p>
            )}

            <button
              type="button"
              onClick={onClose}
              className="mt-5 flex h-14 w-full items-center justify-center rounded-full bg-white text-[15px] font-bold text-[#0B0B0B] active:scale-[0.99]"
            >
              Pronto
            </button>
          </div>
        )}
      </BottomSheet>

      <CategoryPickerSheet
        open={showCategoryPicker}
        selected={data?.category ?? ""}
        onSelect={(cat) => update("category", cat)}
        onClose={() => setShowCategoryPicker(false)}
        customCategories={customCategories}
        onCreateCategory={() => { setShowCategoryPicker(false); setShowCategoryCreate(true); }}
      />
      <CategoryCreateModal open={showCategoryCreate} onClose={() => setShowCategoryCreate(false)} onSave={handleCreateCategory} title="Nova Categoria" />
    </>
  );
}

function MultiItemReview({ items, setItems, avgConfidence, message }: {
  items: ExtractedItem[];
  setItems: React.Dispatch<React.SetStateAction<ExtractedItem[]>>;
  avgConfidence?: number;
  message: string;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const toggleItem = (idx: number) =>
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, selected: !item.selected } : item)));
  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: keyof ExtractedItem, value: unknown) =>
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  const allSelected = items.every((i) => i.selected);
  const plans = items.filter((i) => i.installment_total && i.installment_total > 1 && (i.installment_current ?? 1) > 1);

  return (
    <div>
      <div className="flex flex-col items-center pt-2 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1 text-[12px] text-white/70">
          <Sparkles className="h-3.5 w-3.5" /> Lido pela IA
          {avgConfidence !== undefined && <span className="text-white/40">· {Math.round(avgConfidence * 100)}% de confiança</span>}
        </span>
        <p className="mt-3 text-[26px] font-extrabold tracking-tight text-white">{items.length} lançamentos</p>
        <p className="text-[14px] text-white/45">{message}</p>
      </div>

      {plans.length > 0 && (
        <div className="mt-5 flex items-start gap-3 rounded-[22px] border border-willo-green/20 bg-willo-green/[0.06] px-4 py-3.5">
          <Layers className="mt-0.5 h-4 w-4 shrink-0 text-willo-green" />
          <p className="text-[13px] leading-snug text-white/70">
            {plans.length === 1 ? "1 parcelamento já em andamento" : `${plans.length} parcelamentos já em andamento`}.
            As parcelas pagas antes desta fatura não são lançadas — a cobrança continua daqui pra frente.
          </p>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between px-1">
        <p className="text-[13px] font-semibold text-white/45">Selecione o que importar</p>
        <button
          type="button"
          onClick={() => setItems((prev) => prev.map((i) => ({ ...i, selected: !allSelected })))}
          className="text-[13px] text-white/70"
        >
          {allSelected ? "Desmarcar todos" : "Marcar todos"}
        </button>
      </div>

      <div className="mt-2 divide-y divide-white/[0.06] rounded-[22px] border border-white/[0.07] bg-[#141414]">
        {items.map((item, idx) => {
          const { Icon, hex } = categoryVisual(item.category, []);
          const isIn = item.type === "receita";
          const day = shortDate(item.date);
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.02 }}
              className={cn("flex items-center gap-3 px-4 py-3 transition-opacity", !item.selected && "opacity-45")}
            >
              <button
                type="button"
                onClick={() => toggleItem(idx)}
                aria-label={item.selected ? "Desmarcar" : "Marcar"}
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors",
                  item.selected ? "border-white bg-white text-[#0B0B0B]" : "border-white/25",
                )}
              >
                {item.selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
              </button>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: `${hex}1F` }}>
                <Icon className="h-4 w-4" style={{ color: hex }} />
              </span>
              <button type="button" onClick={() => setEditing(idx)} className="min-w-0 flex-1 text-left">
                <p className="truncate text-[15px] text-white">{item.description}</p>
                <p className="flex items-center gap-1.5 truncate text-[12px] text-white/40">
                  {day && <span className="tabular-nums">{day}</span>}
                  {day && <span className="text-white/20">·</span>}
                  <span className="truncate">{item.category}</span>
                  {item.installment_total && item.installment_total > 1 && (
                    <span className="shrink-0 rounded-full bg-white/[0.08] px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums text-white/70">
                      {item.installment_current ?? 1}/{item.installment_total}
                    </span>
                  )}
                  {item.confidence !== undefined && item.confidence < 0.8 && <ConfidenceBadge confidence={item.confidence} />}
                </p>
              </button>
              <p className={cn("shrink-0 text-[15px] font-semibold tabular-nums", isIn ? "text-willo-green" : "text-white")}>
                {isIn ? "+" : "−"}{fmtMoney(item.amount)}
              </p>
              <button type="button" onClick={() => removeItem(idx)} aria-label="Remover" className="shrink-0 text-white/30">
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          );
        })}
      </div>
      <p className="mt-3 px-2 text-center text-[12px] text-white/35">Toque em um lançamento para editar nome, categoria e data.</p>

      <ItemEditSheet
        item={editing !== null && items[editing] ? { index: editing, data: items[editing] } : null}
        onClose={() => setEditing(null)}
        onChange={updateItem}
      />
    </div>
  );
}

export default function InvoiceUploadReviewModal({
  open,
  onClose,
  items: initialItems,
  message,
  onConfirm,
  confirming,
  avgConfidence,
  accounts = [],
  showAccountSelector = false,
}: Props) {
  const [items, setItems] = useState<ExtractedItem[]>(initialItems);

  useEffect(() => {
    if (initialItems && initialItems.length > 0) {
      const defaultAccountId = accounts.find((account) => account.is_default)?.id ?? accounts[0]?.id ?? null;
      setItems(
        initialItems.map((item) => ({
          ...item,
          account_id: item.account_id ?? (showAccountSelector ? defaultAccountId : null),
        })),
      );
    }
  }, [initialItems, accounts, showAccountSelector]);

  const isSingleItem = items.length === 1;
  const selectedItems = items.filter((i) => i.selected);
  const totalSelected = selectedItems.reduce((sum, i) => sum + i.amount, 0);

  const handleSingleUpdate = (field: keyof ExtractedItem, value: unknown) => {
    setItems((prev) => prev.map((item, i) => (i === 0 ? { ...item, [field]: value } : item)));
  };

  const confirm = () => (isSingleItem ? onConfirm([{ ...items[0], selected: true }]) : onConfirm(selectedItems));

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="invoice-upload-review"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 34, stiffness: 320 }}
          className="willo-bg fixed inset-0 z-[60] flex flex-col md:inset-auto md:left-1/2 md:top-1/2 md:h-[88vh] md:w-[440px] md:-translate-x-1/2 md:-translate-y-1/2 md:overflow-hidden md:rounded-[32px] md:border md:border-white/[0.08]"
        >
          {/* Nav */}
          <div className="shrink-0 px-4" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 10px)" }}>
            <div className="flex h-11 items-center justify-between">
              <button onClick={onClose} aria-label="Fechar" className="-ml-1 flex h-10 w-10 items-center justify-center rounded-full text-white/70 active:opacity-60">
                <X className="h-6 w-6" />
              </button>
              <span className="text-[16px] font-semibold text-white">{isSingleItem ? "Revisar lançamento" : "Revisar lançamentos"}</span>
              <span className="w-10" />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
            {items.length === 0 ? null : isSingleItem ? (
              <SingleItemReview
                item={items[0]}
                onUpdate={handleSingleUpdate}
                accounts={accounts}
                showAccountSelector={showAccountSelector}
                avgConfidence={avgConfidence}
              />
            ) : (
              <MultiItemReview items={items} setItems={setItems} avgConfidence={avgConfidence} message={message} />
            )}
          </div>

          {/* Confirm */}
          <div className="shrink-0 border-t border-white/[0.06] px-4 pt-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)" }}>
            {!isSingleItem && (
              <div className="mb-2.5 flex items-center justify-between px-1 text-[13px]">
                <span className="text-white/45">{selectedItems.length} de {items.length} selecionados</span>
                <span className="font-semibold text-white tabular-nums">{fmtMoney(totalSelected)}</span>
              </div>
            )}
            <button
              type="button"
              onClick={confirm}
              disabled={confirming || (!isSingleItem && selectedItems.length === 0)}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-white text-[16px] font-bold text-[#0B0B0B] shadow-[0_10px_30px_-12px_rgba(255,255,255,0.35)] transition-opacity disabled:opacity-35"
            >
              {confirming ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Importando...</>
              ) : isSingleItem ? (
                <><Check className="h-4 w-4" strokeWidth={3} /> Confirmar lançamento</>
              ) : (
                <><Check className="h-4 w-4" strokeWidth={3} /> Importar {selectedItems.length} lançamento{selectedItems.length !== 1 ? "s" : ""}</>
              )}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
