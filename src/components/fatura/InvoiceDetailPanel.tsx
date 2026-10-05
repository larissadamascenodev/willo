import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Layers, Receipt } from "lucide-react";
import { getInvoiceItems } from "@/services/invoiceService";
import { formatCurrency, type EnrichedItem } from "@/pages/FaturaCartao";
import type { OverviewCard, OverviewInvoice } from "@/hooks/useCardsOverview";
import InvoiceCategoryBreakdown from "./InvoiceCategoryBreakdown";
import InvoiceTransactionList from "./InvoiceTransactionList";
import { cn } from "@/lib/utils";

/**
 * Everything a single card's statement had on a page of its own, folded into the tab
 * that already lists the statements. Two screens were showing the same month from the
 * same data; this is the one that survives, so switching cards re-reads the whole
 * thing rather than pushing another route.
 */
export default function InvoiceDetailPanel({ card, invoice, month, year }: {
  card: OverviewCard;
  invoice: OverviewInvoice | null;
  month: number;
  year: number;
}) {
  const [items, setItems] = useState<EnrichedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"geral" | "parcelado">("geral");

  useEffect(() => {
    if (!invoice) {
      setItems([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getInvoiceItems(invoice.id)
      .then((data) => {
        if (!cancelled) setItems(data as EnrichedItem[]);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [invoice]);

  // The split is of the whole statement, not of whatever the toggle is showing — a
  // breakdown that changed with the filter would be answering a different question.
  const categories = useMemo(() => {
    const total = items.reduce((s, i) => s + Number(i.amount), 0);
    const byCat = new Map<string, { total: number; count: number }>();
    for (const i of items) {
      const key = i.transaction_category || "outros";
      const prev = byCat.get(key) ?? { total: 0, count: 0 };
      byCat.set(key, { total: prev.total + Number(i.amount), count: prev.count + 1 });
    }
    return [...byCat.entries()].map(([category, v]) => ({
      category,
      total: v.total,
      count: v.count,
      percentage: total > 0 ? (v.total / total) * 100 : 0,
    }));
  }, [items]);

  const invoiceTotal = items.reduce((s, i) => s + Number(i.amount), 0);
  const parceladas = items.filter((i) => (i.total_installments ?? 1) > 1);
  const shown = view === "geral" ? items : parceladas;

  const limit = card.limit;
  const used = card.used;
  const available = Math.max(limit - used, 0);
  const usedPct = limit > 0 ? Math.min(used / limit, 1) : 0;
  const tight = usedPct >= 0.8;

  return (
    <div className="mt-5 space-y-3">
      {/* What the card has left, which is the question a statement raises */}
      <section className="rounded-[22px] border border-white/[0.08] willo-glass px-5 pb-4 pt-[18px]">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-white/45">Limite usado</p>
          <p className={cn("text-[12.5px] font-semibold tabular-nums", tight ? "text-red-400" : "text-white/55")}>
            {Math.round(usedPct * 100)}%
          </p>
        </div>

        <p className="mt-2 truncate text-[26px] font-extrabold leading-none tracking-[-0.03em] tabular-nums text-white">
          {formatCurrency(used)}
        </p>

        <div className="mt-3.5 h-[6px] overflow-hidden rounded-full bg-white/[0.07]">
          <motion.span
            className={cn("block h-full rounded-full", tight ? "bg-red-400" : "bg-willo-green")}
            initial={{ width: 0 }}
            animate={{ width: `${usedPct * 100}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>

        <div className="mt-3.5 flex items-baseline justify-between gap-3 border-t border-white/[0.06] pt-3">
          <span className="text-[13px] text-white/55">Disponível</span>
          <span className="text-[14px] font-semibold tabular-nums text-white">{formatCurrency(available)}</span>
        </div>
        <div className="mt-1.5 flex items-baseline justify-between gap-3">
          <span className="text-[13px] text-white/55">Limite total</span>
          <span className="text-[14px] font-semibold tabular-nums text-white/70">{formatCurrency(limit)}</span>
        </div>
      </section>

      {loading && items.length === 0 ? (
        <div className="h-48 animate-pulse rounded-[22px] border border-white/[0.08] willo-glass" />
      ) : items.length === 0 ? (
        <div className="rounded-[22px] border border-dashed border-white/[0.10] px-5 py-8 text-center">
          <p className="text-[14px] text-white/55">Nada lançado nessa fatura.</p>
        </div>
      ) : (
        <>
          <InvoiceCategoryBreakdown categories={categories} total={invoiceTotal} />

          {/* Geral or just what is still being paid off, on this card alone — the
              Parcelas tab answers across every card, which is a different question. */}
          <div className="flex items-center justify-between gap-3 px-1 pt-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-white/45">Lançamentos</p>
            <div className="flex rounded-full bg-white/[0.07] p-0.5 [isolation:isolate]">
              {([["geral", "Geral", items.length], ["parcelado", "Parcelado", parceladas.length]] as const).map(([key, label, n]) => (
                <button
                  key={key}
                  onClick={() => setView(key)}
                  className="relative h-7 rounded-full px-3 text-[11.5px] font-semibold"
                >
                  {view === key && (
                    <motion.span
                      layoutId="invoice-items-view"
                      className="pointer-events-none absolute inset-0 rounded-full bg-white"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  )}
                  <span className={cn("relative transform-gpu transition-colors", view === key ? "text-[#0B0B0B]" : "text-white/66")}>
                    {label} {n}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {shown.length === 0 ? (
            <div className="flex items-center gap-3 rounded-[22px] border border-white/[0.08] willo-glass px-4 py-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.06]">
                {view === "parcelado" ? <Layers className="h-4 w-4 text-white/60" /> : <Receipt className="h-4 w-4 text-white/60" />}
              </span>
              <p className="text-[13.5px] text-white/60">
                {view === "parcelado" ? "Nenhuma compra parcelada nessa fatura." : "Nada lançado nessa fatura."}
              </p>
            </div>
          ) : (
            <InvoiceTransactionList
              items={shown}
              hideHeader
              cardName={card.name}
              invoiceMonth={month}
              invoiceYear={year}
              isPaid={invoice?.isPaid}
            />
          )}
        </>
      )}
    </div>
  );
}
