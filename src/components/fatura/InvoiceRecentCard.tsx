import { useMemo } from "react";
import { motion } from "framer-motion";
import { ChevronRight, FastForward, Receipt, Undo2 } from "lucide-react";
import { readInvoice } from "@/lib/invoice/readModel";
import { getCategoryIcon, getCategoryHexColor } from "@/lib/categoryUtils";
import { chipFill, chipInk } from "@/lib/chipColor";
import { cn } from "@/lib/utils";
import { formatCurrency, type EnrichedItem } from "@/pages/FaturaCartao";

/**
 * The last few things that happened on this card.
 *
 * Light on purpose: the full statement is one tap away, so this is a glance, not a
 * list — small discs, one line of context each, and no second way through to the same
 * page at the bottom. Everything it needs to say fits on the line it is already using.
 */
export default function InvoiceRecentCard({ items, count = 4, onSeeAll, onOpen }: {
  items: EnrichedItem[];
  count?: number;
  onSeeAll: () => void;
  onOpen: (item: EnrichedItem) => void;
}) {
  const { lines } = useMemo(() => readInvoice(items), [items]);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const visible = lines.slice(0, count);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12 }}
      className="overflow-hidden rounded-[24px] border border-white/[0.07] bg-white/[0.035] px-1 pb-1 pt-3.5 backdrop-blur-xl"
    >
      <div className="flex items-center justify-between px-3.5 pb-1">
        <h3 className="text-[15px] font-semibold text-white">Lançamentos recentes</h3>
        {lines.length > 0 && (
          <button
            type="button"
            onClick={onSeeAll}
            className="-mr-1 flex items-center gap-0.5 rounded-full px-2 py-1 text-[12.5px] text-white/62 active:opacity-60"
          >
            Ver todos <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center px-4 py-8 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.05]">
            <Receipt className="h-[18px] w-[18px] t-soft" />
          </span>
          <p className="mt-2.5 text-[13.5px] text-white/62">Nenhum lançamento nesta fatura</p>
        </div>
      ) : (
        <div className="mt-0.5">
          {visible.map((line, i) => {
            const isRefund = line.amount < 0;
            const isEarly = line.kind === "antecipacao";
            const hex = isRefund ? "#C8F36D" : isEarly ? "#7DD3FC" : getCategoryHexColor(line.category);
            const Icon = isRefund ? Undo2 : isEarly ? FastForward : getCategoryIcon(line.category);
            const item = byId.get(line.id);

            return (
              <motion.button
                key={line.id}
                type="button"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 + i * 0.035 }}
                onClick={() => item && onOpen(item)}
                className="flex w-full items-center gap-3 rounded-[18px] px-3 py-2.5 text-left transition-colors active:bg-white/[0.045]"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                  style={{ background: chipFill(hex) }}
                >
                  <Icon className="h-[15px] w-[15px]" style={{ color: chipInk(hex) }} />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-white">{line.name}</span>
                  <span className="block truncate text-[11.5px] t-softer">
                    {line.category}
                    {line.installment ? ` · ${line.installment.current}/${line.installment.total}x` : ""}
                  </span>
                </span>

                <span
                  className={cn(
                    "shrink-0 text-[14px] font-semibold tabular-nums",
                    isRefund ? "text-willo-green-ink" : "text-white",
                  )}
                >
                  {isRefund ? "+" : "−"}{formatCurrency(Math.abs(line.amount))}
                </span>
              </motion.button>
            );
          })}
        </div>
      )}
    </motion.section>
  );
}
