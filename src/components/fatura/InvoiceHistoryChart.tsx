import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { MONTH_SHORT, formatCurrency } from "@/pages/FaturaCartao";
import type { Invoice } from "@/services/invoiceService";
import { cn } from "@/lib/utils";

interface Props {
  invoices: Invoice[];
  selectedMonth: number;
  selectedYear: number;
  onSelect: (month: number, year: number) => void;
  userStartDate?: Date | null;
  /** Closing day of the card, so "open" follows the billing cycle and not the calendar. */
  closingDay?: number | null;
}

type Status = "paga" | "aberta" | "futura";

const STATUS_LABEL: Record<Status, string> = {
  paga: "Paga",
  aberta: "Em aberto",
  futura: "Projeção",
};

export default function InvoiceHistoryChart({ invoices, selectedMonth, selectedYear, onSelect, userStartDate, closingDay }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragState = useRef({ startX: 0, scrollLeft: 0, moved: false });

  const startMonth = userStartDate ? userStartDate.getMonth() + 1 : null;
  const startYear = userStartDate ? userStartDate.getFullYear() : null;

  const chartData = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    let rangeStartM: number, rangeStartY: number;
    if (startMonth && startYear) {
      rangeStartM = startMonth;
      rangeStartY = startYear;
    } else {
      rangeStartM = currentMonth - 6;
      rangeStartY = currentYear;
      while (rangeStartM < 1) { rangeStartM += 12; rangeStartY--; }
    }

    // Only as far as there is something to say: the last month with an invoice, or
    // three months ahead — a chart running to next December was mostly empty stubs.
    const lastWithData = invoices.reduce(
      (acc, inv) => Math.max(acc, inv.year * 12 + (inv.month - 1)),
      currentYear * 12 + (currentMonth - 1),
    );
    const endIndex = Math.max(lastWithData, currentYear * 12 + (currentMonth - 1) + 3);

    const today = now.getDate();
    const openPeriod = currentYear * 12 + (currentMonth - 1) + (closingDay && today >= closingDay ? 1 : 0);

    const entries: { month: number; year: number; amount: number; status: Status; isSelected: boolean }[] = [];
    let m = rangeStartM;
    let y = rangeStartY;
    while (y * 12 + (m - 1) <= endIndex) {
      const invoice = invoices.find((inv) => inv.month === m && inv.year === y);
      const rawAmount = invoice ? Number(invoice.total_amount) : 0;
      const paidAmt = invoice ? Number((invoice as any).paid_amount ?? 0) : 0;
      const isPaid = invoice?.is_paid ?? false;
      const amount = (!isPaid && paidAmt > 0) ? Math.max(0, rawAmount - paidAmt) : rawAmount;
      // The statement collecting purchases right now is open, not a projection —
      // with a closing day of 6, October is already the open one on 26 September.
      const isFuture = y * 12 + (m - 1) > openPeriod;
      entries.push({
        month: m,
        year: y,
        amount,
        status: isPaid ? "paga" : isFuture ? "futura" : "aberta",
        isSelected: m === selectedMonth && y === selectedYear,
      });
      m++;
      if (m > 12) { m = 1; y++; }
    }
    return entries;
  }, [invoices, selectedMonth, selectedYear, startMonth, startYear, closingDay]);

  const maxAmount = useMemo(() => Math.max(...chartData.map((d) => d.amount), 1), [chartData]);
  const selected = chartData.find((d) => d.isSelected);

  useEffect(() => {
    const active = scrollRef.current?.querySelector("[data-active='true']");
    active?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [selectedMonth, selectedYear]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    setIsDragging(true);
    dragState.current = { startX: e.pageX - el.offsetLeft, scrollLeft: el.scrollLeft, moved: false };
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const el = scrollRef.current;
    const x = e.pageX - el.offsetLeft;
    if (Math.abs(x - dragState.current.startX) > 4) dragState.current.moved = true;
    el.scrollLeft = dragState.current.scrollLeft - (x - dragState.current.startX);
  }, [isDragging]);

  const onMouseUp = useCallback(() => setIsDragging(false), []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 }}
      className="mt-4 rounded-[22px] border border-white/[0.08] willo-glass p-5"
    >
      {/* The hero above already states the selected month's figures — this is the navigator */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-white/50">Histórico de faturas</p>
        {selected && (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold",
              selected.status === "paga" && "bg-willo-green/12 text-willo-green",
              selected.status === "aberta" && "bg-white/[0.08] text-white",
              selected.status === "futura" && "bg-white/[0.05] text-white/66",
            )}
          >
            {selected.status === "paga" && <Check className="h-3 w-3" strokeWidth={3} />}
            {MONTH_SHORT[selected.month - 1]} · {STATUS_LABEL[selected.status]}
          </span>
        )}
      </div>

      <div
        ref={scrollRef}
        className="mt-4 flex select-none items-end gap-2 overflow-x-auto pb-1 scrollbar-none"
        style={{ cursor: isDragging ? "grabbing" : "grab" }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        {chartData.map((entry) => {
          const height = entry.amount > 0 ? Math.max(14, (entry.amount / maxAmount) * 92) : 6;
          return (
            <button
              key={`${entry.year}-${entry.month}`}
              data-active={entry.isSelected}
              onClick={() => { if (!dragState.current.moved) onSelect(entry.month, entry.year); }}
              className="flex w-[38px] shrink-0 flex-col items-center gap-2"
            >
              <span className="flex h-[92px] w-full items-end">
                <motion.span
                  initial={{ height: 0 }}
                  animate={{ height }}
                  transition={{ duration: 0.45, ease: "easeOut" }}
                  className={cn(
                    // No ring: it painted outside the scroller and got clipped at the edges
                    "w-full rounded-[8px] transition-all duration-200",
                    entry.status === "paga" && "bg-gradient-to-t from-willo-green/60 to-willo-green",
                    entry.status === "aberta" && "bg-gradient-to-t from-white/60 to-white",
                    entry.status === "futura" && "border border-dashed border-white/20 bg-white/[0.04]",
                    !entry.isSelected && "opacity-45",
                  )}
                />
              </span>
              <span className="flex flex-col items-center gap-1">
                <span
                  className={cn(
                    "text-[11px] tabular-nums transition-colors",
                    entry.isSelected ? "font-bold text-white" : "text-white/50",
                  )}
                >
                  {MONTH_SHORT[entry.month - 1]}
                </span>
                <span className={cn("h-1 w-1 rounded-full transition-colors", entry.isSelected ? "bg-white" : "bg-transparent")} />
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-center gap-4 border-t border-white/[0.06] pt-3 text-[11px] text-white/56">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-willo-green/70" /> Paga
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-white/85" /> Em aberto
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px] border border-dashed border-white/25" /> Projeção
        </span>
      </div>
    </motion.div>
  );
}
