import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { getCategoryIcon, getCategoryColor } from "@/lib/categoryUtils";
import type { CustomCategory } from "@/services/categoryService";
import { getCurrency } from "@/lib/currency";

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });

const CARD_HEX: Record<string, string> = {
  violet: "#8B5CF6", emerald: "#10B981", sky: "#0EA5E9", amber: "#F59E0B", rose: "#F43F5E",
  cyan: "#06B6D4", fuchsia: "#D946EF", lime: "#84CC16", purple: "#8A05BE", orange: "#F97316",
};

export interface SinglePurchase {
  id: string;
  name: string;
  category: string;
  amount: number;
  date: string;
}

/**
 * A one-off purchase, in the same language as the instalment card: the ring around the
 * category icon is simply complete, because there is nothing left to pay.
 */
export default function SinglePurchaseCard({ item, index, customCats, card, onOpen }: {
  item: SinglePurchase;
  index: number;
  customCats: CustomCategory[];
  card?: { name: string; color: string | null };
  onOpen?: () => void;
}) {
  const IconComp = getCategoryIcon(item.category, customCats);
  const catColor = getCategoryColor(item.category, customCats);
  const day = item.date
    ? new Date(`${item.date.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "")
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="overflow-hidden rounded-[20px] border border-white/[0.12] willo-glass"
    >
      <button type="button" onClick={onOpen} className="block w-full px-3.5 py-3 text-left">
        <div className="flex items-center gap-3">
          <span className="relative flex h-12 w-12 shrink-0 items-center justify-center">
            <svg viewBox="0 0 48 48" className="absolute inset-0 h-full w-full -rotate-90">
              <circle cx="24" cy="24" r="22" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5" />
              <circle cx="24" cy="24" r="22" fill="none" stroke={`hsl(${catColor})`} strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <span className="flex h-[38px] w-[38px] items-center justify-center rounded-full willo-glass-inset">
              {IconComp && <IconComp className="h-[18px] w-[18px]" style={{ color: `hsl(${catColor})` }} />}
            </span>
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold text-white">{item.name}</p>
            <p className="flex items-center gap-1.5 truncate text-[12px] text-white/62">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: CARD_HEX[card?.color ?? ""] ?? "#8B5CF6" }} />
              {card?.name ?? "Cartão"}
            </p>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-[15px] font-bold text-white tabular-nums">{formatCurrency(item.amount)}</p>
            <p className="text-[11px] text-white/56">à vista</p>
          </div>
        </div>

        <div className="mt-2.5 flex items-center justify-between border-t border-white/[0.06] pt-2.5">
          <span className="flex min-w-0 items-center gap-2 text-[12px] text-white/70">
            <span className="truncate capitalize">{item.category}</span>
            {day && (
              <>
                <span className="text-white/20">·</span>
                <span className="shrink-0 tabular-nums">{day}</span>
              </>
            )}
          </span>
          {onOpen && <ChevronRight className="h-4 w-4 shrink-0 text-white/38" />}
        </div>
      </button>
    </motion.div>
  );
}
