import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Check } from "lucide-react";
import { MONTH_SHORT, formatCurrency } from "@/pages/FaturaCartao";
import type { Invoice } from "@/services/invoiceService";
import { cn } from "@/lib/utils";

interface Props {
  invoices: Invoice[];
  selectedMonth: number;
  selectedYear: number;
  onSelect: (month: number, year: number) => void;
  userStartDate?: Date | null;
}

export default function InvoiceHistoryChart({ invoices, selectedMonth, selectedYear, onSelect, userStartDate }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragState = useRef({ startX: 0, scrollLeft: 0 });

  const startMonth = userStartDate ? userStartDate.getMonth() + 1 : null;
  const startYear = userStartDate ? userStartDate.getFullYear() : null;

  const chartData = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Determine start: user creation month or 6 months before current
    let rangeStartM: number, rangeStartY: number;
    if (startMonth && startYear) {
      rangeStartM = startMonth;
      rangeStartY = startYear;
    } else {
      rangeStartM = currentMonth - 6;
      rangeStartY = currentYear;
      while (rangeStartM < 1) { rangeStartM += 12; rangeStartY--; }
    }

    // End: December of the year after the current year
    const rangeEndM = 12;
    const rangeEndY = currentYear + 1;

    // Build entries from start to end
    const entries: { month: number; year: number; amount: number; isPaid: boolean; isSelected: boolean; isFuture: boolean }[] = [];
    let m = rangeStartM;
    let y = rangeStartY;
    while (y < rangeEndY || (y === rangeEndY && m <= rangeEndM)) {
      const invoice = invoices.find((inv) => inv.month === m && inv.year === y);
      const rawAmount = invoice ? Number(invoice.total_amount) : 0;
      const paidAmt = invoice ? Number((invoice as any).paid_amount ?? 0) : 0;
      const isPaid = invoice?.is_paid ?? false;
      // For open invoices with partial payment, show outstanding amount
      const amount = (!isPaid && paidAmt > 0) ? Math.max(0, rawAmount - paidAmt) : rawAmount;
      const isSelected = m === selectedMonth && y === selectedYear;
      const isFuture = y > currentYear || (y === currentYear && m > currentMonth);
      entries.push({ month: m, year: y, amount, isPaid, isSelected, isFuture });
      m++;
      if (m > 12) { m = 1; y++; }
    }
    return entries;
  }, [invoices, selectedMonth, selectedYear, startMonth, startYear]);

  const maxAmount = useMemo(() => Math.max(...chartData.map((d) => d.amount), 1), [chartData]);

  useEffect(() => {
    if (scrollRef.current) {
      const active = scrollRef.current.querySelector("[data-active='true']");
      if (active) {
        active.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }
    }
  }, [selectedMonth, selectedYear]);

  // Mouse drag to scroll
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    setIsDragging(true);
    dragState.current = { startX: e.pageX - el.offsetLeft, scrollLeft: el.scrollLeft };
    el.style.cursor = "grabbing";
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const el = scrollRef.current;
    const x = e.pageX - el.offsetLeft;
    el.scrollLeft = dragState.current.scrollLeft - (x - dragState.current.startX);
  }, [isDragging]);

  const onMouseUp = useCallback(() => {
    setIsDragging(false);
    if (scrollRef.current) scrollRef.current.style.cursor = "grab";
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 }}
      className="glass-card p-5 space-y-4"
    >
      {/* Header — title only, no legend here */}
      <div className="flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-willo-green" />
        <h2 className="text-sm font-bold text-foreground">Histórico de Faturas</h2>
      </div>

      {/* Bar chart — draggable */}
      <div
        ref={scrollRef}
        className="flex items-end gap-1.5 overflow-x-auto scrollbar-none pb-1 select-none"
        style={{ minHeight: 120, cursor: "grab" }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        {chartData.map((entry) => {
          const barHeight = entry.amount > 0
            ? Math.max(20, (entry.amount / maxAmount) * 90)
            : 16;

          return (
            <button
              key={`${entry.year}-${entry.month}`}
              data-active={entry.isSelected}
              onClick={() => { if (!isDragging) onSelect(entry.month, entry.year); }}
              className="flex flex-col items-center gap-1.5 min-w-[60px] flex-1 group"
            >
              {/* Value tooltip */}
              <div className={cn(
                "text-[10px] font-bold transition-opacity duration-150",
                entry.isSelected ? "opacity-100 text-primary" : "opacity-0 group-hover:opacity-100 text-muted-foreground"
              )}>
                {entry.amount > 0 ? formatCurrency(entry.amount) : "—"}
              </div>

              {/* Bar block */}
              <div className="relative w-full">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: barHeight }}
                  transition={{ duration: 0.5, ease: "easeOut", delay: 0.02 }}
                  className={cn(
                    "w-full rounded-lg transition-all duration-200 cursor-pointer relative overflow-hidden",
                    entry.isSelected
                      ? "bg-primary/30 border-2 border-primary shadow-[0_0_12px_-2px_hsl(var(--primary)/0.4)]"
                      : entry.isFuture
                      ? "bg-primary/10 border border-primary/15 group-hover:bg-primary/15"
                      : entry.isPaid
                      ? "bg-gradient-to-t from-emerald-600/40 to-emerald-500/20 border border-emerald-500/30 group-hover:from-emerald-600/50 group-hover:to-emerald-500/30 shadow-[0_0_8px_-3px_rgba(16,185,129,0.3)]"
                      : "bg-muted/50 border border-border/20 group-hover:bg-muted/70"
                  )}
                >
                  {/* Shimmer effect for paid past invoices */}
                  {entry.isPaid && !entry.isSelected && (
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-400/15 to-transparent"
                      initial={{ x: "-100%" }}
                      animate={{ x: "200%" }}
                      transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 4, ease: "easeInOut" }}
                    />
                  )}
                </motion.div>

                {/* Check icon for paid past invoices */}
                {entry.isPaid && !entry.isSelected && entry.amount > 0 && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.5, type: "spring", stiffness: 300, damping: 20 }}
                    className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center shadow-md"
                  >
                    <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                  </motion.div>
                )}
              </div>

              {/* Month label */}
              <span className={cn(
                "text-[10px] font-semibold transition-colors",
                entry.isSelected ? "text-primary" : "text-muted-foreground/60"
              )}>
                {MONTH_SHORT[entry.month - 1]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Legend — below the chart */}
      <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500/50" />
          <span>Paga</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-muted-foreground/40" />
          <span>Aberta</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-primary/20 border border-primary/30" />
          <span>Projeção</span>
        </div>
      </div>
    </motion.div>
  );
}
