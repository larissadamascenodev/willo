import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CalendarClock, CreditCard, PieChart, Sparkles, TrendingDown, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCardsOverview, invoiceDueDate } from "@/hooks/useCardsOverview";
import { useHiddenValues } from "@/hooks/useHiddenValues";
import { getCurrency } from "@/lib/currency";
import type { CategoryExpense, FinanceEvent } from "@/types/finance";
import { cn } from "@/lib/utils";

const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const short = (v: number) =>
  `${v < 0 ? "−" : ""}${getCurrency() === "BRL" ? "R$" : ""} ${Math.abs(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`.trim();

const DWELL = 6000;

interface Slide {
  id: string;
  label: string;
  icon: LucideIcon;
  accent: string;
  /** Keep it to two lines at phone width; <b> carries the figure. */
  body: React.ReactNode;
  to: string;
}

/**
 * The room the balance card used to take, spent on the things the app knows but was
 * never going to say — each one a sentence rather than another figure, because the
 * figures all have cards of their own further down.
 *
 * Everything here is derived from data the dashboard has already loaded; the Raio-X
 * reading is far richer, but it costs a page of queries, and this sits above the fold
 * on every open.
 */
export default function InsightCarousel({ receitas, despesas, saldoPrevisto, categories, events, month, isCurrentMonth }: {
  receitas: number;
  despesas: number;
  saldoPrevisto: number;
  categories: CategoryExpense[];
  events: FinanceEvent[];
  month: number;
  isCurrentMonth: boolean;
}) {
  const navigate = useNavigate();
  const hidden = useHiddenValues();
  const { cards, invoices } = useCardsOverview();
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [paused, setPaused] = useState(false);

  const slides = useMemo<Slide[]>(() => {
    const out: Slide[] = [];
    const monthLabel = MONTHS[month];
    const v = (n: number) => (hidden ? "•••" : short(n));

    // How the month is going
    if (receitas > 0) {
      const pct = Math.round((despesas / receitas) * 100);
      const over = despesas > receitas;
      out.push({
        id: "fluxo",
        label: `Balanço de ${monthLabel}`,
        icon: over ? TrendingDown : Sparkles,
        accent: over ? "#F87171" : "#C8F36D",
        body: over
          ? <>Saiu <b>{v(despesas - receitas)} a mais</b> do que entrou em {monthLabel}.</>
          : <>Você gastou <b>{pct}%</b> do que entrou em {monthLabel}.</>,
        to: "/bot-finance/balanco",
      });
    }

    // What is left per day for the rest of the month
    if (isCurrentMonth && saldoPrevisto > 0) {
      const now = new Date();
      const left = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
      if (left > 0) {
        out.push({
          id: "diario",
          label: "Até o fim do mês",
          icon: Wallet,
          accent: "#7DD3FC",
          body: <>Sobram <b>{v(saldoPrevisto / left)} por dia</b> pelos próximos {left} dias.</>,
          to: "/bot-finance/balanco",
        });
      }
    }

    // Where the money actually went
    const top = [...categories].sort((a, b) => b.amount - a.amount)[0];
    if (top && despesas > 0) {
      const share = Math.round((top.amount / despesas) * 100);
      out.push({
        id: "categoria",
        label: "Maior gasto",
        icon: PieChart,
        accent: "#C084FC",
        body: <><b>{top.name}</b> levou {share}% do que saiu — {v(top.amount)}.</>,
        to: "/analytics/categorias",
      });
    }

    // The invoice closing in on you
    const today = new Date();
    const pending = cards
      .map((card) => {
        const rolls = today.getDate() > card.closingDay ? 1 : 0;
        const i = today.getFullYear() * 12 + today.getMonth() + rolls;
        const invoice = invoices.find((x) => x.cardId === card.id && x.month === (i % 12) + 1 && x.year === Math.floor(i / 12));
        return { card, invoice, due: invoiceDueDate(card, Math.floor(i / 12), (i % 12) + 1) };
      })
      .filter((x) => x.invoice && !x.invoice.isPaid && x.invoice.total > 0)
      .sort((a, b) => a.due.getTime() - b.due.getTime())[0];
    if (pending) {
      const days = Math.round((pending.due.setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000);
      out.push({
        id: "fatura",
        label: "Fatura do cartão",
        icon: CreditCard,
        accent: "#A78BFA",
        body: days <= 0
          ? <><b>{pending.card.name}</b> fecha hoje em {v(pending.invoice!.total)}.</>
          : <><b>{v(pending.invoice!.total)}</b> no {pending.card.name}, vence em {days} {days === 1 ? "dia" : "dias"}.</>,
        to: "/cartoes",
      });
    }

    // The next thing you have to pay
    const nextDue = events
      .filter((e) => e.status === "pendente" || e.status === "atrasado")
      .sort((a, b) => (a.rawDate ?? a.date).localeCompare(b.rawDate ?? b.date))[0];
    if (nextDue) {
      out.push({
        id: "vencimento",
        label: nextDue.status === "atrasado" ? "Em atraso" : "Próximo vencimento",
        icon: CalendarClock,
        accent: nextDue.status === "atrasado" ? "#F87171" : "#FBBF24",
        body: <><b>{nextDue.name}</b> — {v(nextDue.amount)} em {nextDue.date}.</>,
        to: "/transacoes",
      });
    }

    return out;
  }, [receitas, despesas, saldoPrevisto, categories, events, month, isCurrentMonth, cards, invoices, hidden]);

  const count = slides.length;

  const go = useCallback((next: number) => {
    if (count === 0) return;
    setDir(next > index ? 1 : -1);
    setIndex(((next % count) + count) % count);
  }, [count, index]);

  // Advances on its own; a drag or a tap stops it, since by then it is being read.
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

  if (count === 0) return <div className="mt-4 h-[129px]" aria-hidden="true" />;

  const slide = slides[Math.min(index, count - 1)];
  const Icon = slide.icon;

  return (
    <div className="relative mt-4 h-[129px] overflow-hidden rounded-[24px] border border-white/[0.08] willo-glass">
      {/* The slide's own colour, lit from the corner behind its mark */}
      <motion.span
        key={`glow-${slide.id}`}
        aria-hidden="true"
        className="pointer-events-none absolute -left-12 -top-12 h-40 w-40 rounded-full blur-[42px]"
        style={{ background: slide.accent }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.2 }}
        transition={{ duration: 0.5 }}
      />

      <AnimatePresence initial={false} mode="wait" custom={dir}>
        <motion.button
          key={slide.id}
          custom={dir}
          onClick={() => navigate(slide.to)}
          onPointerDown={() => setPaused(true)}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.14}
          onDragEnd={(_, info) => {
            if (info.offset.x < -44) go(index + 1);
            else if (info.offset.x > 44) go(index - 1);
          }}
          variants={{
            enter: (d: number) => ({ x: d * 40, opacity: 0 }),
            center: { x: 0, opacity: 1 },
            exit: (d: number) => ({ x: d * -40, opacity: 0 }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 flex w-full cursor-grab flex-col justify-between px-[18px] pb-[18px] pt-[15px] text-left active:cursor-grabbing"
        >
          <span className="flex items-center gap-2">
            <Icon className="h-[15px] w-[15px] shrink-0" style={{ color: slide.accent }} strokeWidth={2.3} />
            <span className="truncate text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/50">
              {slide.label}
            </span>
            <ArrowRight className="ml-auto h-3.5 w-3.5 shrink-0 text-white/25" />
          </span>

          <p className="text-[17px] font-medium leading-[1.32] tracking-[-0.015em] text-white/75 [text-wrap:balance] [&>b]:font-extrabold [&>b]:text-white">
            {slide.body}
          </p>
        </motion.button>
      </AnimatePresence>

      {/* Where you are in the set, and how long this one has left */}
      {count > 1 && (
        <div className="pointer-events-none absolute inset-x-[18px] bottom-[11px] flex gap-1">
          {slides.map((s, i) => (
            <span key={s.id} className="h-[2.5px] flex-1 overflow-hidden rounded-full bg-white/[0.14]">
              {i === index && (
                <motion.span
                  key={`${s.id}-${paused}`}
                  className="block h-full rounded-full bg-white/70"
                  initial={{ width: paused ? "100%" : "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: paused ? 0 : DWELL / 1000, ease: "linear" }}
                />
              )}
              {i < index && <span className="block h-full w-full rounded-full bg-white/35" />}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
