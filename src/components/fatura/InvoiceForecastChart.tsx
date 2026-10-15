import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { MONTH_SHORT, formatCurrency } from "@/pages/FaturaCartao";
import type { Invoice } from "@/services/invoiceService";
import { cn } from "@/lib/utils";

/**
 * What this card is about to ask for.
 *
 * A credit card's history is settled; what you can still act on is what has not been
 * billed yet, and that is already known, because every instalment of every plan is
 * already written into a future invoice. So the strip opens on the invoice that is
 * open — always, on every visit — and runs forward from there.
 *
 * The months before it are still there, to the left, for when you want them. You reach
 * them by pulling the strip back, and the next time you arrive it has returned to
 * where it starts. That way the past is available without ever being the first thing
 * you see.
 */

interface Props {
  invoices: Invoice[];
  selectedMonth: number;
  selectedYear: number;
  onSelect: (month: number, year: number) => void;
  /** Closing day, so "open" follows the billing cycle and not the calendar. */
  closingDay?: number | null;
}

type Status = "paga" | "aberta" | "futura";

/** How far back the strip can be pulled. */
const PAST_MONTHS = 12;

/** R$ 1.743,20 is unreadable at 46px wide; "1,7k" is the same number you can see. */
function short(v: number) {
  if (v <= 0) return "—";
  if (v >= 1000) {
    const k = v / 1000;
    return `${(k >= 10 ? Math.round(k) : Number(k.toFixed(1))).toLocaleString("pt-BR")}k`;
  }
  return Math.round(v).toLocaleString("pt-BR");
}

export default function InvoiceForecastChart({
  invoices, selectedMonth, selectedYear, onSelect, closingDay,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef({ startX: 0, scrollLeft: 0, moved: false });

  const { bars, openPeriod, committed, lastLabel } = useMemo(() => {
    const now = new Date();
    const currentPeriod = now.getFullYear() * 12 + now.getMonth();
    /* Past the closing day, this month's invoice is shut and the open one is the next:
       with a closing day of 6, October is already open on 26 September. */
    const open = currentPeriod + (closingDay && now.getDate() >= closingDay ? 1 : 0);

    const at = (period: number) => {
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
      open,
    );
    const end = Math.max(lastWithData, open + 3);

    const list: { period: number; month: number; year: number; amount: number; status: Status }[] = [];
    let total = 0;
    for (let p = open - PAST_MONTHS; p <= end; p++) {
      const { amount, isPaid } = at(p);
      if (p >= open) total += amount;
      list.push({
        period: p,
        month: (p % 12) + 1,
        year: Math.floor(p / 12),
        amount,
        status: isPaid ? "paga" : p > open ? "futura" : "aberta",
      });
    }

    /* The horizon is where the plans actually end, not where the window does. */
    const lastPaying = [...list].reverse().find((b) => b.amount > 0);
    return {
      bars: list,
      openPeriod: open,
      committed: total,
      lastLabel: lastPaying ? `${MONTH_SHORT[lastPaying.month - 1]}/${String(lastPaying.year).slice(2)}` : null,
    };
  }, [invoices, closingDay]);

  const max = useMemo(() => Math.max(...bars.map((b) => b.amount), 1), [bars]);

  /* The one scroll this component performs: on arrival, the open invoice is put at the
     left edge. Selecting a month never moves the strip — that would pull it out from
     under the finger that is dragging it. */
  const parked = useRef(false);
  useLayoutEffect(() => {
    if (parked.current || bars.length === 0) return;
    const el = scrollRef.current;
    const bar = el?.querySelector<HTMLElement>(`[data-period="${openPeriod}"]`);
    if (!el || !bar) return;
    el.scrollLeft = bar.offsetLeft - 4;
    parked.current = true;
  }, [bars, openPeriod]);

  const onDown = useCallback((e: React.MouseEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    setDragging(true);
    drag.current = { startX: e.pageX, scrollLeft: el.scrollLeft, moved: false };
  }, []);

  const onMove = useCallback((e: React.MouseEvent) => {
    const el = scrollRef.current;
    if (!dragging || !el) return;
    e.preventDefault();
    const dx = e.pageX - drag.current.startX;
    if (Math.abs(dx) > 4) drag.current.moved = true;
    el.scrollLeft = drag.current.scrollLeft - dx;
  }, [dragging]);

  const onUp = useCallback(() => setDragging(false), []);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 }}
      className="rounded-[24px] border border-white/[0.08] willo-glass p-5"
    >
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] t-soft">
            Próximas faturas
          </p>
          <p className="mt-1.5 text-[24px] font-extrabold leading-none tracking-[-0.03em] text-white tabular-nums">
            {formatCurrency(committed)}
          </p>
        </div>
        {lastLabel && (
          <p className="shrink-0 pb-0.5 text-right text-[11.5px] leading-tight t-faint">
            comprometido
            <br />
            até {lastLabel}
          </p>
        )}
      </div>

      <div
        ref={scrollRef}
        className="-mx-1 mt-5 flex select-none items-end gap-2 overflow-x-auto px-1 pb-1 scrollbar-none"
        style={{ cursor: dragging ? "grabbing" : "grab" }}
        onMouseDown={onDown}
        onMouseMove={onMove}
        onMouseUp={onUp}
        onMouseLeave={onUp}
      >
        {bars.map((bar) => {
          const isSelected = bar.month === selectedMonth && bar.year === selectedYear;
          const isPast = bar.period < openPeriod;
          const height = bar.amount > 0 ? Math.max(16, (bar.amount / max) * 96) : 5;
          return (
            <button
              key={bar.period}
              data-period={bar.period}
              onClick={() => { if (!drag.current.moved) onSelect(bar.month, bar.year); }}
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
                    bar.status === "paga" && "bg-gradient-to-t from-willo-green/55 to-willo-green",
                    bar.status === "aberta" && "bg-gradient-to-t from-white/55 to-white",
                    bar.status === "futura" && "bg-gradient-to-t from-white/[0.10] to-white/[0.30]",
                    !isSelected && (isPast ? "opacity-35" : "opacity-60"),
                  )}
                />
              </span>

              <span className={cn(
                "flex items-center gap-1 text-[11px] tabular-nums transition-colors",
                isSelected ? "font-bold text-white" : isPast ? "t-faint" : "t-soft",
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
