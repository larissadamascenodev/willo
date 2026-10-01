import { motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, CreditCard, Pencil, RefreshCw, Trash2, Wallet } from "lucide-react";
import type { CustomCategory } from "@/services/categoryService";
import { getCategoryColor, getCategoryIcon } from "@/lib/categoryUtils";
import { getCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";

/*
 * The visual pieces of the Transações page, kept apart from its data loading
 * so the welcome showcase can draw the real page with sample data.
 */

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

export type TabFilter = "todos" | "receita" | "despesa";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });

const WEEKDAYS = ["Domingo", "Segunda-Feira", "Terça-Feira", "Quarta-Feira", "Quinta-Feira", "Sexta-Feira", "Sábado"];
const MONTHS_FULL = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export const formatDateHeader = (dateStr: string, today = new Date()) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const isToday = date.toDateString() === today.toDateString();
  const weekday = WEEKDAYS[date.getDay()];
  const month = MONTHS_FULL[date.getMonth()];
  const label = `${weekday}, ${d} De ${month}`;
  return { label, isToday };
};

/** Balance with income and expenses underneath (mobile header of Transações). */
export const TransactionsSummaryCard = ({ saldoAtual, saldoPrevisto, receitas, despesas, className }: {
  saldoAtual: number;
  saldoPrevisto: number;
  receitas: number;
  despesas: number;
  className?: string;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className={cn("rounded-[24px] border border-white/[0.12] bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-4", className)}
  >
    <p className="text-[13px] text-white/62">Saldo disponível</p>
    <p className="text-[32px] font-extrabold leading-tight tracking-tight text-white tabular-nums">{fmt(saldoAtual)}</p>
    {saldoPrevisto !== saldoAtual && (
      <p className="text-[12px] text-white/56 tabular-nums">Previsto no fim do mês: {fmt(saldoPrevisto)}</p>
    )}
    <div className="mt-4 grid grid-cols-2 border-t border-white/[0.12] pt-3.5">
      <div className="pr-3">
        <span className="flex items-center gap-1 text-[12px] text-white/62">
          <ArrowDownLeft className="h-3.5 w-3.5 text-willo-green" strokeWidth={2.5} /> Receitas
        </span>
        <p className="mt-0.5 text-[17px] font-bold text-white tabular-nums">{fmt(receitas)}</p>
      </div>
      <div className="border-l border-white/[0.12] pl-4">
        <span className="flex items-center gap-1 text-[12px] text-white/62">
          <ArrowUpRight className="h-3.5 w-3.5 text-red-400" strokeWidth={2.5} /> Despesas
        </span>
        <p className="mt-0.5 text-[17px] font-bold text-white tabular-nums">{fmt(despesas)}</p>
      </div>
    </div>
  </motion.div>
);

/** Todas / Receitas / Despesas. */
export const TransactionTabs = ({ value, onChange, layoutId = "tx-tab-pill" }: { value: TabFilter; onChange: (v: TabFilter) => void; layoutId?: string }) => (
  <div className="grid flex-1 grid-cols-3 isolate rounded-full border border-white/[0.12] willo-glass p-1">
    {([
      { key: "todos" as TabFilter, label: "Todas" },
      { key: "receita" as TabFilter, label: "Receitas" },
      { key: "despesa" as TabFilter, label: "Despesas" },
    ]).map((tab) => (
      <button
        key={tab.key}
        onClick={() => onChange(tab.key)}
        className="relative h-9 rounded-full text-[13px] font-semibold"
      >
        {value === tab.key && (
          <motion.span
            layoutId={layoutId}
            className="pointer-events-none absolute inset-0 z-0 rounded-full bg-white"
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
          />
        )}
        <span className={`relative z-10 transition-colors ${value === tab.key ? "text-[#0B0B0B]" : "text-white/70"}`}>{tab.label}</span>
      </button>
    ))}
  </div>
);

/** One transaction: swipe right to edit, left to delete. */
export const TransactionListItem = ({
  tx,
  accountName,
  onDelete,
  onEdit,
  customCategories,
  creditCards,
}: {
  tx: TransactionRow;
  accountName: string;
  onDelete: (id: string) => void;
  onEdit: (tx: TransactionRow) => void;
  customCategories?: CustomCategory[];
  creditCards?: any[];
}) => {
  const x = useMotionValue(0);
  const editOpacity = useTransform(x, [0, 60, 120], [0, 0.5, 1]);
  const deleteOpacity = useTransform(x, [-120, -60, 0], [1, 0.5, 0]);
  const isReceita = tx.type === "receita";

  // Resolve icon & color based on special entries
  const isFatura = tx.id.startsWith("fatura-");
  const isInitialBalance = tx.id.startsWith("initial-balance-");

  let CatIcon = getCategoryIcon(tx.category, customCategories);
  let catColor = getCategoryColor(tx.category, customCategories);

  if (isFatura) {
    CatIcon = CreditCard;
    const card = creditCards?.find((c: any) => c.id === tx.credit_card_id);
    if (card?.color) {
      // Convert hex to HSL for consistency
      const hex = card.color;
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      let h = 0, s = 0;
      const l = (max + min) / 2;
      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        else if (max === g) h = ((b - r) / d + 2) / 6;
        else h = ((r - g) / d + 4) / 6;
      }
      catColor = `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
    } else {
      catColor = "260 70% 60%"; // fallback purple
    }
  } else if (isInitialBalance) {
    CatIcon = Wallet;
    catColor = "210 80% 55%"; // blue
  }
  const isRecurring = tx.recurrence_type === "fixa" || (tx.installments && tx.installments > 1);
  const isPending = tx.status !== "pago";

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.x > 100) {
      onEdit(tx);
    } else if (info.offset.x < -100) {
      onDelete(tx.id);
    }
  };

  return (
    <div className="relative overflow-hidden">
      {/* Background actions */}
      <div className="absolute inset-0 flex">
        <motion.div
          style={{ opacity: editOpacity }}
          className="flex items-center justify-start pl-5 w-1/2 bg-white/[0.12]"
        >
          <Pencil className="w-4 h-4 text-white" />
        </motion.div>
        <motion.div
          style={{ opacity: deleteOpacity }}
          className="flex items-center justify-end pr-5 w-1/2 ml-auto bg-red-500/25"
        >
          <Trash2 className="w-4 h-4 text-red-400" />
        </motion.div>
      </div>

      {/* Draggable card */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.3}
        onDragEnd={handleDragEnd}
        style={{ x }}
        className="relative flex items-center gap-3 px-4 py-3 cursor-grab active:cursor-grabbing willo-glass"
        onClick={() => onEdit(tx)}
        whileTap={{ scale: 0.99 }}
      >
        {/* Category icon */}
        <div
          className="relative w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: `hsl(${catColor} / 0.12)` }}
        >
          <CatIcon className="w-[18px] h-[18px]" style={{ color: `hsl(${catColor})` }} />
          {isPending && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-[#141414] bg-amber-300" />}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-[15px] font-medium text-white truncate">{tx.name}</p>
            {isRecurring && <RefreshCw className="w-3 h-3 text-white/45 shrink-0" />}
          </div>
          <p className="text-[12px] text-white/56 truncate">
            {tx.category}
            {tx.installments && tx.installment_current ? ` · ${tx.installment_current}/${tx.installments}x` : ""}
            {accountName ? ` · ${accountName}` : ""}
            {tx.time ? ` · ${tx.time}` : ""}
          </p>
        </div>

        {/* Amount + status tag */}
        <div className="text-right shrink-0">
          <p className={`text-[15px] font-semibold tabular-nums ${isReceita ? "text-willo-green" : "text-white"}`}>
            {isReceita ? "+" : "−"}{fmt(tx.amount)}
          </p>
          <span className={`block text-[11px] ${isPending ? "text-amber-300/90" : "text-white/50"}`}>
            {isPending ? (isReceita ? "A receber" : "Pendente") : (isReceita ? "Recebido" : "Pago")}
          </span>
        </div>
      </motion.div>
    </div>
  );
};
