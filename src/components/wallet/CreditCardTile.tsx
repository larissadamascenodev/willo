import { motion } from "framer-motion";
import { CalendarClock, ChevronRight, CreditCard } from "lucide-react";
import { getCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });
}

import { getInvoiceStatusLabel, type CreditCardItem, type OpenInvoiceInfo } from "@/lib/cardInvoice";

export { getInvoiceStatusLabel };
export type { CreditCardItem, OpenInvoiceInfo };

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
export const CreditCardTile = ({ card, idx, invoiceInfo, navigate, extraClass }: {
  card: CreditCardItem;
  idx: number;
  invoiceInfo?: OpenInvoiceInfo;
  navigate: (path: string) => void;
  extraClass?: string;
}) => {
  const usedValue = Number(card.used_limit);
  const limitValue = Number(card.limit);
  const usedPct = limitValue > 0 ? Math.min((usedValue / limitValue) * 100, 100) : 0;
  const available = Math.max(limitValue - usedValue, 0);
  const accent = getAccent(card.color);
  const status = getInvoiceStatusLabel(card, invoiceInfo);
  const invoiceAmount = invoiceInfo?.amount || 0;

  const barColor = usedPct >= 100 ? "bg-red-400" : usedPct >= 80 ? "bg-amber-300" : "bg-white";
  const barTrackColor = "bg-white/[0.08]";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.06 }}
      onClick={() => navigate(`/fatura/${card.id}`)}
      className={cn(
        "relative rounded-[22px] overflow-hidden cursor-pointer group transition-all duration-300 active:scale-[0.98]",
        "willo-glass border border-white/[0.12] hover:border-white/15",
        extraClass
      )}
    >
      <div className="p-4">
        {/* Header: icon + name + chevron */}
        <div className="flex items-center gap-2.5 mb-3">
          <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0", accent.iconBg)}>
            <CreditCard className={cn("w-4 h-4", accent.dot.replace("bg-", "text-"))} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-white leading-tight truncate">{card.name}</p>
            {card.last_four_digits && (
              <p className="text-[12px] text-white/56 tabular-nums mt-0.5">•••• {card.last_four_digits}</p>
            )}
          </div>
          <ChevronRight className="w-4 h-4 text-white/38 shrink-0" />
        </div>

        {/* Invoice highlight */}
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <p className="text-[12px] text-white/62 leading-none mb-1.5">Fatura em aberto</p>
            <p className={cn(
              "text-[24px] font-extrabold tabular-nums leading-none tracking-tight",
              invoiceAmount > 0 ? "text-white" : "text-white/45"
            )}>
              {formatCurrency(invoiceAmount)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[12px] text-white/62 leading-none mb-1.5">Disponível</p>
            <p className={cn("text-sm font-bold tabular-nums leading-none", available > 0 ? "text-willo-green" : "text-destructive")}>
              {formatCurrency(available)}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-2.5">
          <div className={cn("w-full h-1.5 rounded-full overflow-hidden", barTrackColor)}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${usedPct}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className={cn("h-full rounded-full", barColor)}
            />
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[11px] text-white/56 tabular-nums">
              {formatCurrency(usedValue)} / {formatCurrency(limitValue)}
            </span>
            <span className="text-[11px] font-semibold tabular-nums text-white/66">
              {usedPct.toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Footer: contextual date */}
        <div className="flex items-center gap-2 pt-2.5 border-t border-white/[0.06]">
          <CalendarClock className="w-3.5 h-3.5 text-white/50 shrink-0" />
          <span className={cn("text-[12px] tabular-nums", status.isClosed ? "text-amber-300 font-semibold" : "text-white/66")}>
            {status.label}
          </span>
        </div>
      </div>
    </motion.div>
  );
};


