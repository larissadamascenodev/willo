import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { MONTH_SHORT, formatCurrency } from "@/pages/FaturaCartao";
import type { Invoice } from "@/services/invoiceService";
import { cn } from "@/lib/utils";
import { shade } from "@/components/wallet/CardFaceTile";

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
  /** The card's own colour: this strip is about one card, so it wears it. */
  hex: string;
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
  invoices, selectedMonth, selectedYear, onSelect, closingDay, hex,
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
    /* Measured between the two boxes rather than from offsetLeft: offsetLeft counts
       from the nearest positioned ancestor, which here is the page — so it carried the
       page gutter into the number and scrolled a slice of the open month off screen. */
    el.scrollLeft += bar.getBoundingClientRect().left - el.getBoundingClientRect().left;
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
      className="px-1"
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
        className="mt-5 flex select-none items-end gap-2 overflow-x-auto pb-1 scrollbar-none"
        style={{
          cursor: dragging ? "grabbing" : "grab",
          /* Only the far side fades, to say there is more ahead. The near side is a
             hard edge: the open invoice is parked flush against it, and a sliver of
             last month peeking out from behind it reads as a drawing mistake. */
          maskImage: "linear-gradient(90deg, #000 calc(100% - 18px), transparent 100%)",
          WebkitMaskImage: "linear-gradient(90deg, #000 calc(100% - 18px), transparent 100%)",
        }}
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

              <span className="relative flex h-[96px] w-full items-end">
                <motion.span
                  initial={{ height: 0 }}
                  animate={{ height }}
                  transition={{ duration: 0.45, ease: "easeOut" }}
                  className="w-full rounded-[9px]"
                  style={{
                    /* Settled and open invoices are the card's colour at full strength;
                       the ones still to come are the same colour, lighter. One hue, so
                       any bank's card reads the same way. */
                    background: bar.status === "futura" ? shade(hex, 0.55) : hex,
                    boxShadow: isSelected ? `0 8px 22px -10px ${hex}` : undefined,
                    opacity: isSelected ? 1 : isPast ? 0.45 : 0.72,
                  }}
                />
                {/* A settled month wears its tick, so paid and open are never the
                    same thing drawn in the same colour. */}
                {bar.status === "paga" && bar.amount > 0 && (
                  <span className="absolute inset-x-0 bottom-1.5 flex justify-center">
                    <span
                      className="flex h-[17px] w-[17px] items-center justify-center rounded-full"
                      style={{ background: "rgb(0 0 0 / 0.35)" }}
                    >
                      <Check className="h-[11px] w-[11px] text-white" strokeWidth={3.4} />
                    </span>
                  </span>
                )}
              </span>

              <span className={cn(
                "text-[11px] tabular-nums transition-colors",
                isSelected ? "font-bold text-white" : isPast ? "t-faint" : "t-soft",
              )}>
                {MONTH_SHORT[bar.month - 1]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-4 text-[11px] t-softer">
        <span className="flex items-center gap-1.5">
          <span
            className="flex h-3 w-3 items-center justify-center rounded-[3px]"
            style={{ background: hex }}
          >
            <Check className="h-2 w-2 text-white" strokeWidth={4} />
          </span>
          Paga
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: hex }} /> Em aberto
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: shade(hex, 0.55) }} /> A vencer
        </span>
      </div>
    </motion.section>
  );
}
