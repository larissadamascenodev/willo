import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, CreditCard, Hand, PieChart, Receipt, Sparkles, Sun, TrendingDown, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCardsOverview, invoiceDueDate } from "@/hooks/useCardsOverview";
import { useHiddenValues } from "@/hooks/useHiddenValues";
import { useProfile } from "@/hooks/useProfile";
import { useGreeting } from "@/lib/greeting";
import { buildInsights, DWELL, type InsightSlide } from "@/lib/insights";
import type { CategoryExpense, FinanceEvent, Transaction } from "@/types/finance";

/* Which readings exist, how they are worded and how they are ranked all live in
   lib/insights, where the phone app reads the same set. This is the browser's half:
   the glyph names turned into drawings, and the sentence turned into markup. */
const GLYPHS: Record<string, LucideIcon> = {
  CalendarClock, CreditCard, Hand, PieChart, Receipt, Sparkles, Sun, TrendingDown, Wallet,
};


const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * The top of the screen, spent on what the app noticed: a fact and then a line of
 * opinion about it, because a dashboard that only recites figures is a spreadsheet
 * with rounded corners.
 *
 * The greeting opens the set, then every candidate reading is built, scored by how
 * much it deserves attention, and the best few kept. An overdue bill outranks a tidy
 * month; a category that has swallowed a third of the spend outranks a routine
 * invoice. All of it comes off data the dashboard has already loaded. The Raio-X
 * analysis is far deeper, but it costs a page of queries, and this renders on every
 * open.
 *
 * It sits on the background rather than in a card: a card here would draw an edge
 * across the top of the screen and cut the page in two.
 */
export default function InsightCarousel({
  receitas, despesas, saldoPrevisto, saldoAtual, categories, events, transactions, month, isCurrentMonth,
}: {
  receitas: number;
  despesas: number;
  saldoPrevisto: number;
  saldoAtual: number;
  categories: CategoryExpense[];
  events: FinanceEvent[];
  transactions: Transaction[];
  month: number;
  isCurrentMonth: boolean;
}) {
  const hidden = useHiddenValues();
  const { cards, invoices } = useCardsOverview();
  const { profile } = useProfile();
  const { greeting, dateStr } = useGreeting();
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [paused, setPaused] = useState(false);

  const firstName = profile?.display_name?.trim().split(" ")[0] ?? "";

  /* The one reading this screen has to work out for itself: which invoice is next.
     It comes off the cards overview, which only this side has loaded. */
  const invoice = useMemo(() => {
    const today = new Date();
    const pending = cards
      .map((card) => {
        const rolls = today.getDate() > card.closingDay ? 1 : 0;
        const i = today.getFullYear() * 12 + today.getMonth() + rolls;
        const found = invoices.find((x) => x.cardId === card.id && x.month === (i % 12) + 1 && x.year === Math.floor(i / 12));
        return { card, invoice: found, due: invoiceDueDate(card, Math.floor(i / 12), (i % 12) + 1) };
      })
      .filter((x) => x.invoice && !x.invoice.isPaid && x.invoice.total > 0)
      .sort((a, b) => a.due.getTime() - b.due.getTime())[0];
    if (!pending) return null;
    return {
      cardName: pending.card.name,
      total: pending.invoice!.total,
      days: Math.round((new Date(pending.due).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000),
    };
  }, [cards, invoices]);

  const slides = useMemo<InsightSlide[]>(
    () => buildInsights({
      greeting, dateStr, firstName, receitas, despesas, saldoPrevisto, saldoAtual,
      categories, events, transactions, month, isCurrentMonth, invoice, hidden,
    }),
    [greeting, dateStr, firstName, receitas, despesas, saldoPrevisto, saldoAtual,
     categories, events, transactions, month, isCurrentMonth, invoice, hidden],
  );

  const count = slides.length;

  // Stepping by hand stops at the ends, the way a story does: tapping forward on the
  // last one should not throw you back to the first. Only the clock below wraps.
  // Stepping never pauses: a story keeps running after you tap past one. Only a
  // finger held down holds it, and letting go starts the next one's clock.
  const step = useCallback((delta: number) => {
    setDir(delta);
    setIndex((i) => Math.min(Math.max(i + delta, 0), Math.max(count - 1, 0)));
  }, [count]);

  // A tap moves at once, so the carousel never feels like it is waiting to see whether
  // a second one is coming. If it is, the move is put back and the entry sheet opens.
  const tapAt = useRef(0);
  const indexBeforeTap = useRef(0);
  const indexRef = useRef(0);
  indexRef.current = index;
  const pressed = useRef<{ x: number; y: number } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    pressed.current = { x: e.clientX, y: e.clientY };
    setPaused(true);
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const from = pressed.current;
    pressed.current = null;
    setPaused(false);
    // A drag has its own handler; only a press that stayed put counts as a tap.
    if (!from || Math.abs(e.clientX - from.x) > 10 || Math.abs(e.clientY - from.y) > 10) return;

    const now = Date.now();
    if (now - tapAt.current < 280) {
      tapAt.current = 0;
      setIndex(indexBeforeTap.current);
      window.dispatchEvent(new CustomEvent("open-registro-rapido"));
      return;
    }
    tapAt.current = now;
    indexBeforeTap.current = indexRef.current;

    const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
    step(e.clientX - box.left < box.width * 0.34 ? -1 : 1);
  }, [step]);

  useEffect(() => {
    if (paused || count <= 1) return;
    const t = setTimeout(() => {
      setDir(1);
      setIndex((i) => (i + 1) % count);
    }, DWELL);
    return () => clearTimeout(t);
  }, [paused, count, index]);

  useEffect(() => {
    if (index >= count) setIndex(0);
  }, [count, index]);

  if (count === 0) return <div className="h-[160px]" aria-hidden="true" />;

  const slide = slides[Math.min(index, count - 1)];
  const Icon = GLYPHS[slide.icon] ?? Sun;

  return (
    <div className="relative">
      {/* The slide's colour, washed across the whole top of the screen and faded out
          well before the first card. There is no edge anywhere to read as a seam. */}
      <motion.span
        key={`wash-${slide.id}`}
        aria-hidden="true"
        className="pointer-events-none absolute -left-[12vw] -right-[12vw] -top-[220px] h-[560px]"
        style={{ background: `radial-gradient(68% 50% at 50% 48%, ${slide.accent} 0%, transparent 70%)` }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.26 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      />

      {/* Where you are in the set, and how long this one has left */}
      {count > 1 && (
        <div className="relative flex gap-1">
          {slides.map((s, i) => (
            <span key={s.id} className="h-[2.5px] flex-1 overflow-hidden rounded-full bg-white/[0.16]">
              {i === index && (
                <motion.span
                  key={`${s.id}-${paused}`}
                  className="block h-full rounded-full bg-white/75"
                  initial={{ width: paused ? "100%" : "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: paused ? 0 : DWELL / 1000, ease: "linear" }}
                />
              )}
              {i < index && <span className="block h-full w-full rounded-full bg-white/40" />}
            </span>
          ))}
        </div>
      )}

      {/* Fixed so slides of different lengths do not make the page jump as they turn,
          but sized to the longest one rather than generously — the slack was showing as
          a band of empty screen under every short insight. */}
      <div className="relative mt-4 h-[138px]">
        <AnimatePresence initial={false} mode="wait" custom={dir}>
          <motion.div
            key={slide.id}
            custom={dir}
            role="group"
            aria-label={`${slide.label}. Toque à direita para avançar, à esquerda para voltar, duas vezes para lançar.`}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={() => { pressed.current = null; setPaused(false); }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.14}
            onDragEnd={(_, info) => {
              if (info.offset.x < -44) step(1);
              else if (info.offset.x > 44) step(-1);
            }}
            variants={{
              enter: (d: number) => ({ x: d * 36, opacity: 0 }),
              center: { x: 0, opacity: 1 },
              exit: (d: number) => ({ x: d * -36, opacity: 0 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 flex w-full cursor-grab flex-col items-start justify-start text-left active:cursor-grabbing"
          >
            <span className="flex items-center gap-2">
              <Icon className="h-[15px] w-[15px] shrink-0" style={{ color: slide.accent }} strokeWidth={2.3} />
              <span className="truncate text-[10.5px] font-semibold uppercase tracking-[0.14em] t-soft">
                {slide.label}
              </span>
            </span>

            <p className="mt-3 text-[22px] font-medium leading-[1.26] tracking-[-0.022em] text-white/72 [text-wrap:balance]">
              {slide.body.map((part, i) =>
                part.bold
                  ? <b key={i} className="font-extrabold text-white">{part.text}</b>
                  : <span key={i}>{part.text}</span>,
              )}
            </p>

            {slide.quip && (
              <p className="mt-2.5 text-[13.5px] leading-snug t-softer [text-wrap:balance]">{slide.quip}</p>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
