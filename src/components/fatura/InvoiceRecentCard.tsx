import { useMemo } from "react";
import { motion } from "framer-motion";
import { ChevronRight, Receipt } from "lucide-react";
import { readInvoice } from "@/lib/invoice/readModel";
import { InvoiceLineRow } from "./InvoiceTransactionList";
import type { EnrichedItem } from "@/pages/FaturaCartao";

/**
 * The last few things that happened on this card.
 *
 * The same shape the home screen uses for recent transactions: a title, a way through
 * to the whole list, and four lines. The panel is for the invoice as a whole — the
 * statement itself is a page, not a tail stacked under it.
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
      className="overflow-hidden rounded-[24px] border border-white/[0.08] willo-glass"
    >
      <div className="flex items-center justify-between px-4 pb-1 pt-4">
        <h3 className="text-[16px] font-semibold text-white">Lançamentos recentes</h3>
        {lines.length > 0 && (
          <button
            type="button"
            onClick={onSeeAll}
            className="flex items-center gap-0.5 text-[13px] text-white/66 active:opacity-60"
          >
            Ver todos <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center px-4 py-9 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.06]">
            <Receipt className="h-5 w-5 t-soft" />
          </span>
          <p className="mt-3 text-[14px] text-white/66">Nenhum lançamento nesta fatura</p>
        </div>
      ) : (
        <div className="mt-1 divide-y divide-white/[0.055]">
          {visible.map((line, i) => (
            <InvoiceLineRow
              key={line.id}
              line={line}
              index={i}
              onOpen={() => {
                const item = byId.get(line.id);
                if (item) onOpen(item);
              }}
            />
          ))}
        </div>
      )}

      {lines.length > visible.length && (
        <button
          type="button"
          onClick={onSeeAll}
          className="flex h-[46px] w-full items-center justify-center gap-1 border-t border-white/[0.06] text-[13.5px] font-semibold text-white/75 active:bg-white/[0.03]"
        >
          Ver os outros {lines.length - visible.length}
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </motion.section>
  );
}
