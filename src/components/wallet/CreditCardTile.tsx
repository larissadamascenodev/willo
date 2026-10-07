import { motion } from "framer-motion";
import { useLongPress } from "@/hooks/useLongPress";
import { CalendarClock, ChevronRight, CreditCard } from "lucide-react";
import { getCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });
}

export interface CreditCardItem {
  id: string;
  name: string;
  limit: number;
  used_limit: number;
  closing_day: number;
  due_day: number;
  color: string | null;
  last_four_digits: string | null;
}

export interface OpenInvoiceInfo {
  amount: number;
  month: number;
  year: number;
  isPaid: boolean;
}

export function getInvoiceStatusLabel(card: CreditCardItem, invoiceInfo?: OpenInvoiceInfo): { label: string; isClosed: boolean } {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // If the invoice shown is for a future month (current month already paid), show closing date
  if (invoiceInfo && (invoiceInfo.month > currentMonth || invoiceInfo.year > currentYear || invoiceInfo.isPaid)) {
    const closingDay = card.closing_day;
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const monthLabel = monthNames[(invoiceInfo.month - 1) % 12];
    return { label: `Fecha dia ${closingDay} de ${monthLabel}`, isClosed: false };
  }

  const today = now.getDate();
  const closingDay = card.closing_day;
  const dueDay = card.due_day;

  if (today >= closingDay) {
    let dueDate: Date;
    if (dueDay > closingDay) {
      dueDate = new Date(now.getFullYear(), now.getMonth(), dueDay);
    } else {
      dueDate = new Date(now.getFullYear(), now.getMonth() + 1, dueDay);
    }
    const diffMs = dueDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { label: `Venceu há ${Math.abs(diffDays)} dias`, isClosed: true };
    if (diffDays === 0) return { label: "Vence hoje", isClosed: true };
    if (diffDays === 1) return { label: "Vence amanhã", isClosed: true };
    return { label: `Vence em ${diffDays} dias`, isClosed: true };
  }

  const daysUntilClose = closingDay - today;
  return { label: `Fecha em ${daysUntilClose} dia${daysUntilClose > 1 ? "s" : ""}`, isClosed: false };
}

export const ACCENT_MAP: Record<string, { border: string; iconBg: string; dot: string }> = {
  violet: { border: "border-violet-500/25", iconBg: "bg-violet-500/15", dot: "bg-violet-400" },
  emerald: { border: "border-emerald-500/25", iconBg: "bg-emerald-500/15", dot: "bg-emerald-400" },
  sky: { border: "border-sky-500/25", iconBg: "bg-sky-500/15", dot: "bg-sky-400" },
  amber: { border: "border-amber-500/25", iconBg: "bg-amber-500/15", dot: "bg-amber-400" },
  rose: { border: "border-rose-500/25", iconBg: "bg-rose-500/15", dot: "bg-rose-400" },
  cyan: { border: "border-cyan-500/25", iconBg: "bg-cyan-500/15", dot: "bg-cyan-400" },
  fuchsia: { border: "border-fuchsia-500/25", iconBg: "bg-fuchsia-500/15", dot: "bg-fuchsia-400" },
  lime: { border: "border-lime-500/25", iconBg: "bg-lime-500/15", dot: "bg-lime-400" },
};

export function getAccent(color: string | null) {
  return ACCENT_MAP[color ?? "violet"] ?? ACCENT_MAP.violet;
}

/* ══════════════════════════════════════════════
   Credit Card Tile – shared by mobile & desktop
   ══════════════════════════════════════════════ */

const TILE_HEX: Record<string, string> = {
  violet: "#8B5CF6", emerald: "#10B981", sky: "#0EA5E9", amber: "#F59E0B", rose: "#F43F5E",
  cyan: "#06B6D4", fuchsia: "#D946EF", lime: "#84CC16", purple: "#8A05BE", orange: "#F97316",
};

/**
 * The card itself, as a piece of glass lit by its own colour. The name and the chip
 * carry the identity, the open statement is the figure, and the limit runs underneath
 * as a single rule with what is spent and what is left on either end.
 */
export const CreditCardTile = ({ card, idx, invoiceInfo, navigate, extraClass, onLongPress }: {
  card: CreditCardItem;
  idx: number;
  invoiceInfo?: OpenInvoiceInfo;
  navigate: (path: string) => void;
  extraClass?: string;
  /** Hold the card to edit or remove it. */
  onLongPress?: () => void;
}) => {
  const press = useLongPress(() => onLongPress?.());
  const usedValue = Number(card.used_limit);
  const limitValue = Number(card.limit);
  const usedPct = limitValue > 0 ? Math.min((usedValue / limitValue) * 100, 100) : 0;
  const available = Math.max(limitValue - usedValue, 0);
  const status = getInvoiceStatusLabel(card, invoiceInfo);
  const invoiceAmount = invoiceInfo?.amount || 0;
  const hex = TILE_HEX[card.color ?? "violet"] ?? TILE_HEX.violet;
  const tight = usedPct >= 80;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.06 }}
      onPointerDown={onLongPress ? press.onPointerDown : undefined}
      onPointerMove={onLongPress ? press.onPointerMove : undefined}
      onPointerUp={onLongPress ? press.onPointerUp : undefined}
      onPointerCancel={onLongPress ? press.onPointerCancel : undefined}
      onPointerLeave={onLongPress ? press.onPointerLeave : undefined}
      onContextMenu={(e) => { if (onLongPress) e.preventDefault(); }}
      onClick={press.guard(() => navigate(`/fatura/${card.id}`))}
      className={cn(
        "relative cursor-pointer overflow-hidden rounded-[24px] border border-white/[0.09] willo-glass px-[18px] pb-[18px] pt-4",
        "transition-transform duration-200 active:scale-[0.985]",
        extraClass,
      )}
    >
      {/* The card's colour, as light inside the glass rather than as a border */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -left-16 -top-20 h-48 w-56 rounded-full blur-[46px]"
        style={{ background: hex, opacity: 0.3 }}
      />
      {/* A hairline catching the light along the top edge */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-5 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)" }}
      />

      <div className="relative flex items-center gap-2.5">
        <span
          className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[10px]"
          style={{ background: hex, boxShadow: `0 6px 16px -6px ${hex}` }}
        >
          <span className="h-[7px] w-[11px] rounded-[2px] bg-white/85" />
        </span>
        <p className="min-w-0 flex-1 truncate text-[16px] font-bold tracking-[-0.01em] text-white">{card.name}</p>
        {card.last_four_digits && (
          <span className="shrink-0 text-[12px] tabular-nums text-white/40">•••• {card.last_four_digits}</span>
        )}
        <ChevronRight className="h-4 w-4 shrink-0 text-white/35" />
      </div>

      <p className="relative mt-3.5 truncate text-[12.5px] text-white/55">
        {invoiceInfo?.isPaid ? "Fatura paga" : "Fatura aberta"}
        <span className="text-white/25"> · </span>
        <span className={cn(status.isClosed && "font-semibold text-amber-300/90")}>{status.label.toLowerCase()}</span>
      </p>

      <p className={cn(
        "relative mt-1 truncate text-[27px] font-extrabold leading-none tracking-[-0.035em] tabular-nums",
        invoiceAmount > 0 ? "text-white" : "text-white/40",
      )}>
        {formatCurrency(invoiceAmount)}
      </p>

      <div className="relative mt-4 h-[5px] overflow-hidden rounded-full bg-white/[0.09]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${usedPct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ background: usedPct >= 100 ? "#F87171" : tight ? "#FBBF24" : hex }}
        />
      </div>

      <div className="relative mt-2 flex items-baseline justify-between gap-3">
        <span className="truncate text-[11.5px] text-white/45">
          Usado <span className="font-semibold tabular-nums text-white/75">{formatCurrency(usedValue)}</span>
        </span>
        <span className="shrink-0 truncate text-[11.5px] text-white/45">
          Disponível <span className={cn("font-semibold tabular-nums", available > 0 ? "text-willo-green" : "text-red-400")}>
            {formatCurrency(available)}
          </span>
        </span>
      </div>
    </motion.div>
  );
};
