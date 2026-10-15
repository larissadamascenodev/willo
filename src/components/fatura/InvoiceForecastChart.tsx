import { useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { MONTH_SHORT, formatCurrency } from "@/pages/FaturaCartao";
import type { Invoice } from "@/services/invoiceService";
import { cn } from "@/lib/utils";

/**
 * What this card is about to ask for.
 *
 * The old chart looked backwards: six months of history, with the months still to come
 * as an afterthought at the right edge. But a credit card's history is settled — what
 * you can still act on is what has not been billed yet, and that is already known,
 * because every instalment of every plan is already written into a future invoice.
 *
 * So the window starts at the invoice that is open and runs to the last month that has
 * anything in it. Two settled months stay on the left, dimmed: they are the only thing
 * that makes "R$ 1.800 next month" mean anything.
 */

interface Props {
  invoices: Invoice[];
  selectedMonth: number;
  selectedYear: number;
  onSelect: (month: number, year: number) => void;
  /** Closing day, so "open" follows the billing cycle and not the calendar. */
  closingDay?: number | null;
  /** How many settled months to keep on the left, for comparison. */
  pastMonths?: number;
}

type Status = "paga" | "aberta" | "futura";

/** R$ 1.743,20 is unreadable at 40px wide; "1,7k" is the same number you can see. */
function short(v: number) {
  if (v <= 0) return "—";
  if (v >= 1000) {
    const k = v / 1000;
    return `${(k >= 10 ? Math.round(k) : Number(k.toFixed(1))).toLocaleString("pt-BR")}k`;
  }
  return Math.round(v).toLocaleString("pt-BR");
}

export default function InvoiceForecastChart({
  invoices, selectedMonth, selectedYear, onSelect, closingDay, pastMonths = 2,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const { bars, committed, lastLabel } = useMemo(() => {
    const now = new Date();
    const currentPeriod = now.getFullYear() * 12 + now.getMonth();
    /* Past the closing day, this month's invoice is shut and the open one is the next:
       with a closing day of 6, October is already open on 26 September. */
    const openPeriod = currentPeriod + (closingDay && now.getDate() >= closingDay ? 1 : 0);

    const amountAt = (period: number) => {
      const y = Math.floor(period / 12);
      const m = (period % 12) + 1;
      const inv = invoices.find((i) => i.month === m && i.year === y);
      if (!inv) return { amount: 0, isPaid: false };
      const raw = Number(inv.total_amount);
      const paid = Number((inv as any).paid_amount ?? 0);
      const isPaid = inv.is_paid ?? false;
      return { amount: !isPaid && paid > 0 ? Math.max(raw - paid, 0) : raw, isPaid };
    };

    const lastWithData = invoices.reduce(
      (acc, inv) => Math.max(acc, inv.year * 12 + (inv.month - 1)),
      openPeriod,
    );
    const end = Math.max(lastWithData, openPeriod + 3);
    const start = openPeriod - pastMonths;

    const list: { period: number; month: number; year: number; amount: number; status: Status }[] = [];
    let committedTotal = 0;
    for (let p = start; p <= end; p++) {
      const { amount, isPaid } = amountAt(p);
      if (p >= openPeriod) committedTotal += amount;
      list.push({
        period: p,
        month: (p % 12) + 1,
        year: Math.floor(p / 12),
        amount,
        status: isPaid ? "paga" : p > openPeriod ? "futura" : "aberta",
      });
    }

    /* A settled month is kept for comparison, but an empty one compares nothing — it is
       a stub with a dash over it, taking the width of a real month. */
    while (list.length && list[0].period < openPeriod && list[0].amount <= 0) list.shift();

    /* The horizon is where the plans actually end, not where the window does. */
    const lastPaying = [...list].reverse().find((b) => b.amount > 0);
    return {
      bars: list,
      committed: committedTotal,
      lastLabel: lastPaying ? `${MONTH_SHORT[lastPaying.month - 1]}/${String(lastPaying.year).slice(2)}` : null,
    };
  }, [invoices, closingDay, pastMonths]);

  const max = useMemo(() => Math.max(...bars.map((b) => b.amount), 1), [bars]);

  useEffect(() => {
    const active = scrollRef.current?.querySelector("[data-active='true']");
    active?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [selectedMonth, selectedYear]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 }}
      className="rounded-[22px] border border-white/[0.08] willo-glass p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] t-soft">
            Próximas faturas
          </p>
          <p className="mt-1.5 text-[24px] font-extrabold leading-none tracking-[-0.03em] text-white tabular-nums">
            {formatCurrency(committed)}
          </p>
          <p className="mt-1.5 text-[12px] t-softer">
            já comprometido{lastLabel ? ` até ${lastLabel}` : ""}
          </p>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="-mx-1 mt-5 flex select-none items-end gap-2 overflow-x-auto px-1 pb-1 scrollbar-none"
      >
        {bars.map((bar) => {
          const isSelected = bar.month === selectedMonth && bar.year === selectedYear;
          const height = bar.amount > 0 ? Math.max(16, (bar.amount / max) * 96) : 5;
          return (
            <button
              key={bar.period}
              data-active={isSelected}
              onClick={() => onSelect(bar.month, bar.year)}
              className="flex w-[46px] shrink-0 flex-col items-center gap-1.5"
            >
              {/* The figure above its own bar: reading a chart should not need a tap. */}
              <span className={cn(
                "text-[10.5px] font-semibold tabular-nums transition-colors",
                isSelected ? "text-white" : "t-faint",
              )}>
                {short(bar.amount)}
              </span>

              <span className="flex h-[96px] w-full items-end">
                <motion.span
                  initial={{ height: 0 }}
                  animate={{ height }}
                  transition={{ duration: 0.45, ease: "easeOut" }}
                  className={cn(
                    "w-full rounded-[9px]",
                    bar.status === "paga" && "bg-gradient-to-t from-willo-green/60 to-willo-green",
                    bar.status === "aberta" && "bg-gradient-to-t from-white/55 to-white",
                    bar.status === "futura" && "bg-gradient-to-t from-white/[0.10] to-white/[0.28]",
                    !isSelected && "opacity-55",
                  )}
                />
              </span>

              <span className={cn(
                "flex items-center gap-1 text-[11px] tabular-nums transition-colors",
                isSelected ? "font-bold text-white" : "t-soft",
              )}>
                {bar.status === "paga" && <Check className="h-2.5 w-2.5 shrink-0 text-willo-green-ink" strokeWidth={3.5} />}
                {MONTH_SHORT[bar.month - 1]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-center gap-4 border-t border-white/[0.06] pt-3 text-[11px] t-soft">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-willo-green/70" /> Paga
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-white/85" /> Em aberto
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-white/[0.22]" /> A vencer
        </span>
      </div>
    </motion.section>
  );
}
