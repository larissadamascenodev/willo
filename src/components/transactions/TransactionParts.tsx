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

// Short forms, because the header is set in tracked caps and a full "quinta-feira,
// 15 de outubro" runs the width of the screen.
const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export const formatDateHeader = (dateStr: string, today = new Date()) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const isToday = date.toDateString() === today.toDateString();
  const weekday = WEEKDAYS[date.getDay()];
  const month = MONTHS_SHORT[date.getMonth()];
  const label = `${weekday}, ${d} de ${month}`;
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
    className={cn("rounded-[22px] border border-white/[0.08] willo-glass px-4 pb-4 pt-3.5", className)}
  >
    <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-white/45">Saldo em contas</p>
    <p className={cn(
      "mt-1.5 truncate text-[30px] font-extrabold leading-none tracking-[-0.03em] tabular-nums",
      saldoAtual < 0 ? "text-red-400" : "text-white",
    )}>
      {fmt(saldoAtual)}
    </p>
    {saldoPrevisto !== saldoAtual && (
      <p className="mt-2 truncate text-[13px] text-white/55">
        Previsto no fim do mês:{" "}
        <span className="font-semibold tabular-nums text-white/80">{fmt(saldoPrevisto)}</span>
      </p>
    )}

    {/* Both on one scale, the way the dashboard draws them, so the two pages agree */}
    <div className="mt-4 space-y-3 border-t border-white/[0.07] pt-4">
      {([
        { label: "Entrada", value: receitas, tone: "in" as const },
        { label: "Saída", value: despesas, tone: "out" as const },
      ]).map(({ label, value, tone }, i) => (
        <div key={label}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[13.5px] font-medium text-white">{label}</span>
            <span className={cn("shrink-0 text-[14px] font-semibold tabular-nums", tone === "in" ? "text-white" : "text-red-400")}>
              {tone === "out" ? "−" : ""}{fmt(value)}
            </span>
          </div>
          <div className="mt-1.5 h-[5px] overflow-hidden rounded-full bg-white/[0.06]">
            <motion.span
              className={cn("block h-full rounded-full", tone === "in" ? "bg-willo-green" : "bg-red-400")}
              initial={{ width: 0 }}
              animate={{ width: `${Math.max((value / Math.max(receitas, despesas, 1)) * 100, value > 0 ? 3 : 0)}%` }}
              transition={{ duration: 0.6, delay: 0.05 + i * 0.07, ease: "easeOut" }}
            />
          </div>
        </div>
      ))}
    </div>
  </motion.div>
);

/** Todas / Receitas / Despesas. */
export const TransactionTabs = ({ value, onChange, layoutId = "tx-tab-pill" }: { value: TabFilter; onChange: (v: TabFilter) => void; layoutId?: string }) => (
  <div className="grid flex-1 grid-cols-3 isolate rounded-full border border-white/[0.07] bg-white/[0.04] p-1">
    {([
      { key: "todos" as TabFilter, label: "Todas" },
      { key: "receita" as TabFilter, label: "Receitas" },
      { key: "despesa" as TabFilter, label: "Despesas" },
    ]).map((tab) => (
      <button
        key={tab.key}
        onClick={() => onChange(tab.key)}
        className="relative h-10 rounded-full text-[13.5px] font-semibold"
      >
        {value === tab.key && (
          <motion.span
            layoutId={layoutId}
            className="pointer-events-none absolute inset-0 z-0 rounded-full bg-white"
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
          />
        )}
        <span className={`relative z-10 transform-gpu transition-colors ${value === tab.key ? "text-[#0B0B0B]" : "text-white/60"}`}>{tab.label}</span>
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
        className="relative flex cursor-grab items-center gap-3.5 px-4 py-3.5 active:cursor-grabbing willo-glass"
        onClick={() => onEdit(tx)}
        whileTap={{ scale: 0.99 }}
      >
        {/* Category icon */}
        {/* The pending dot is gone: the status is already written under the amount,
            and a bare dot on the icon says nothing on its own. */}
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{ background: `hsl(${catColor} / 0.15)` }}
        >
          <CatIcon className="h-[17px] w-[17px]" style={{ color: `hsl(${catColor})` }} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-[14.5px] font-medium text-white">{tx.name}</p>
            {isRecurring && <RefreshCw className="h-3 w-3 shrink-0 text-white/35" />}
          </div>
          <p className="mt-0.5 truncate text-[12px] text-white/45">
            {tx.category}
            {tx.installments && tx.installment_current ? ` · ${tx.installment_current}/${tx.installments}x` : ""}
            {accountName ? ` · ${accountName}` : ""}
            {tx.time ? ` · ${tx.time}` : ""}
          </p>
        </div>

        {/* Amount + status tag */}
        <div className="shrink-0 text-right">
          <p className={cn("text-[14.5px] font-semibold tabular-nums", isReceita ? "text-willo-green" : "text-white")}>
            {isReceita ? "+" : "−"}{fmt(tx.amount)}
          </p>
          <span className={cn("mt-0.5 block text-[11.5px]", isPending ? "text-amber-300/90" : "text-white/40")}>
            {isPending ? (isReceita ? "A receber" : "Pendente") : (isReceita ? "Recebido" : "Pago")}
          </span>
        </div>
      </motion.div>
    </div>
  );
};
