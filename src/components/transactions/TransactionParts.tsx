import { motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, CreditCard, Pencil, RefreshCw, Trash2, Wallet } from "lucide-react";
import type { CustomCategory } from "@/services/categoryService";
import { useLongPress } from "@/hooks/useLongPress";
import { getCategoryIcon, getCategoryHexColor } from "@/lib/categoryUtils";
import { hexFor } from "@/lib/banks";
import { chipFill, chipInk } from "@/lib/chipColor";
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

/**
 * The month, read out on the page itself.
 *
 * There is no card around it: a figure this size is already the loudest thing on the
 * screen, and a panel behind it only adds an edge for the eye to stop at. The two
 * flows sit under it on one shared scale, so which side is bigger is answered before
 * either number is read.
 */
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
    className={cn("px-1", className)}
  >
    <p className="text-[11px] font-semibold uppercase tracking-[0.13em] t-softer">Saldo em contas</p>
    <p className={cn(
      "mt-1.5 truncate text-[38px] font-extrabold leading-none tracking-[-0.04em] tabular-nums",
      saldoAtual < 0 ? "text-red-400" : "text-white",
    )}>
      {fmt(saldoAtual)}
    </p>
    {saldoPrevisto !== saldoAtual && (
      <p className="mt-2.5 truncate text-[12.5px] t-soft">
        Previsto no fim do mês:{" "}
        <span className="font-semibold tabular-nums text-white/80">{fmt(saldoPrevisto)}</span>
      </p>
    )}

    {/* Both on one scale, the way the dashboard draws them, so the two pages agree */}
    <div className="mt-5 space-y-3.5">
      {([
        { label: "Entrada", value: receitas, tone: "in" as const },
        { label: "Saída", value: despesas, tone: "out" as const },
      ]).map(({ label, value, tone }, i) => (
        <div key={label}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[13px] t-soft">{label}</span>
            <span className={cn("shrink-0 text-[14.5px] font-bold tabular-nums", tone === "in" ? "text-white" : "text-red-400")}>
              {tone === "out" ? "−" : ""}{fmt(value)}
            </span>
          </div>
          <div className="mt-2 h-[5px] overflow-hidden rounded-full bg-white/[0.07]">
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
  <div className="grid flex-1 grid-cols-3 isolate rounded-full border border-white/[0.06] bg-white/[0.035] p-1">
    {([
      { key: "todos" as TabFilter, label: "Todas" },
      { key: "receita" as TabFilter, label: "Receitas" },
      { key: "despesa" as TabFilter, label: "Despesas" },
    ]).map((tab) => (
      <button
        key={tab.key}
        onClick={() => onChange(tab.key)}
        className="relative h-[38px] rounded-full text-[13px] font-semibold"
      >
        {value === tab.key && (
          <motion.span
            layoutId={layoutId}
            className="pointer-events-none absolute inset-0 z-0 rounded-full willo-invert"
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
          />
        )}
        <span className={`relative z-10 transform-gpu transition-colors ${value === tab.key ? "willo-on-invert" : "t-soft"}`}>{tab.label}</span>
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
  onLongPress,
}: {
  tx: TransactionRow;
  accountName: string;
  onDelete: (id: string) => void;
  onEdit: (tx: TransactionRow) => void;
  customCategories?: CustomCategory[];
  creditCards?: any[];
  /** Hold a row to choose between editing and removing it. */
  onLongPress?: (tx: TransactionRow) => void;
}) => {
  const press = useLongPress(() => onLongPress?.(tx));
  const x = useMotionValue(0);
  const editOpacity = useTransform(x, [0, 60, 120], [0, 0.5, 1]);
  const deleteOpacity = useTransform(x, [-120, -60, 0], [1, 0.5, 0]);
  const isReceita = tx.type === "receita";

  // Resolve icon & color based on special entries
  const isFatura = tx.id.startsWith("fatura-");
  const isInitialBalance = tx.id.startsWith("initial-balance-");

  let CatIcon = getCategoryIcon(tx.category, customCategories);
  if (isFatura) CatIcon = CreditCard;
  else if (isInitialBalance) CatIcon = Wallet;

  /* The disc takes the same colour the rest of the app gives this thing — the
     category's own, the card's own, blue for an opening balance — so a row here and a
     row inside an invoice are recognisably the same kind of object. */
  const discHex = isFatura
    ? hexFor(creditCards?.find((c: any) => c.id === tx.credit_card_id)?.color, "#A855F7")
    : isInitialBalance
      ? "#3B82F6"
      : getCategoryHexColor(tx.category, customCategories);

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
        className="relative flex cursor-grab items-center gap-3.5 px-4 py-3.5 active:cursor-grabbing"
        onPointerDownCapture={onLongPress ? press.onPointerDown : undefined}
        onPointerMove={onLongPress ? press.onPointerMove : undefined}
        onPointerUp={onLongPress ? press.onPointerUp : undefined}
        onPointerCancel={onLongPress ? press.onPointerCancel : undefined}
        onPointerLeave={onLongPress ? press.onPointerLeave : undefined}
        onContextMenu={(e) => { if (onLongPress) e.preventDefault(); }}
        onClick={press.guard(() => onEdit(tx))}
        whileTap={{ scale: 0.99 }}
      >
        {/* Category icon */}
        {/* The pending dot is gone: the status is already written under the amount,
            and a bare dot on the icon says nothing on its own. */}
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
          style={{ background: chipFill(discHex) }}
        >
          <CatIcon className="h-[18px] w-[18px]" style={{ color: chipInk(discHex) }} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-[15px] font-medium text-white">{tx.name}</p>
            {isRecurring && <RefreshCw className="h-3 w-3 shrink-0 t-faint" />}
          </div>
          <p className="mt-0.5 truncate text-[12px] t-softer">
            {tx.category}
            {tx.installments && tx.installment_current ? ` · ${tx.installment_current}/${tx.installments}x` : ""}
            {accountName ? ` · ${accountName}` : ""}
            {tx.time ? ` · ${tx.time}` : ""}
          </p>
        </div>

        {/* Amount + status tag */}
        <div className="shrink-0 text-right">
          <p className={cn("text-[15px] font-semibold tabular-nums", isReceita ? "text-willo-green-ink" : "text-white")}>
            {isReceita ? "+" : "−"}{fmt(tx.amount)}
          </p>
          <span className={cn("mt-0.5 block text-[11.5px]", isPending ? "text-amber-300/90" : "t-softer")}>
            {isPending ? (isReceita ? "A receber" : "Pendente") : (isReceita ? "Recebido" : "Pago")}
          </span>
        </div>
      </motion.div>
    </div>
  );
};
