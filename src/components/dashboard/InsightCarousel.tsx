import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { CalendarClock, CreditCard, Hand, PieChart, Receipt, Sparkles, Sun, TrendingDown, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCardsOverview, invoiceDueDate } from "@/hooks/useCardsOverview";
import { useHiddenValues } from "@/hooks/useHiddenValues";
import { useProfile } from "@/hooks/useProfile";
import { useGreeting } from "./DashboardHeader";
import { getCurrency } from "@/lib/currency";
import type { CategoryExpense, FinanceEvent, Transaction } from "@/types/finance";

const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const short = (v: number) =>
  `${v < 0 ? "−" : ""}${getCurrency() === "BRL" ? "R$" : ""} ${Math.abs(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`.trim();

const DWELL = 6500;

/**
 * What the app says back about a category once it has clearly taken over the month.
 * Keep these wry rather than scolding: it is their money, and a dashboard that tuts
 * at you gets closed.
 */
const CATEGORY_QUIPS: { match: RegExp; line: string }[] = [
  { match: /delivery|ifood|rappi|lanche|fast/i, line: "Mais um mês assim e você pede participação nos lucros." },
  { match: /aliment|restaurante|comida|bar\b/i, line: "Comer bem cobra o preço dele." },
  { match: /mercado|supermerc/i, line: "Pelo menos foi tudo pra dentro de casa." },
  { match: /transporte|uber|99|combust|gasolina/i, line: "Quase deu pra dar entrada num carro." },
  { match: /lazer|entreteni|divers|cinema/i, line: "Pelo menos rendeu história." },
  { match: /assinatu|streaming/i, line: "Você ainda usa todas elas?" },
  { match: /vestu|roupa|moda/i, line: "O guarda-roupa agradece." },
  { match: /tecnolog|eletr|game/i, line: "A loja já te chama pelo nome." },
  { match: /viagem|hosped|passage/i, line: "Esse aqui valeu, vai." },
  { match: /sa[úu]de|farm|m[ée]dic/i, line: "Desse não dá pra fugir mesmo." },
  { match: /educa|curso|faculd|livro/i, line: "Esse volta em dobro." },
  { match: /casa|moradia|aluguel|condom/i, line: "O básico, cobrando o de sempre." },
  { match: /pix.*cr[ée]dito/i, line: "Pix no crédito tem taxa. Vale conferir." },
  { match: /servi[çc]o/i, line: "Muita gente trabalhando pra você." },
  { match: /invest/i, line: "Esse não é gasto, é plantio." },
];

const quipFor = (name: string) =>
  CATEGORY_QUIPS.find((q) => q.match.test(name))?.line ?? "Lidera com folga.";

interface Slide {
  id: string;
  label: string;
  icon: LucideIcon;
  accent: string;
  /** Keep it to two lines at phone width; <b> carries the figure. */
  body: React.ReactNode;
  /** The app answering back: a line of opinion under the fact. */
  quip?: string;
  to: string;
  /** How much this deserves the top of the screen. Highest shows first. */
  score: number;
}

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
  const navigate = useNavigate();
  const hidden = useHiddenValues();
  const { cards, invoices } = useCardsOverview();
  const { profile } = useProfile();
  const { greeting, dateStr } = useGreeting();
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [paused, setPaused] = useState(false);

  const firstName = profile?.display_name?.trim().split(" ")[0] ?? "";

  const slides = useMemo<Slide[]>(() => {
    const out: Slide[] = [];
    const monthLabel = MONTHS[month];
    const v = (n: number) => (hidden ? "•••" : short(n));
    const now = new Date();
    const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();

    // ── The greeting opens, every time ──
    out.push({
      id: "ola",
      label: dateStr,
      icon: Sun,
      accent: "#C8F36D",
      body: <>{greeting}{firstName ? <>, <b>{firstName}</b></> : ""}.</>,
      quip: "Veja o que mudou por aqui desde a última vez.",
      to: "/bot-finance",
      score: Infinity,
    });

    // ── How the month is going ──
    if (receitas > 0 || despesas > 0) {
      const over = despesas > receitas;
      const pct = receitas > 0 ? Math.round((despesas / receitas) * 100) : 100;
      if (over) {
        out.push({
          id: "fluxo",
          label: `Balanço de ${monthLabel}`,
          icon: TrendingDown,
          accent: "#F87171",
          body: <>Saiu <b>{v(despesas - receitas)} a mais</b> do que entrou em {monthLabel}.</>,
          quip: "Esse mês cobrou caro. Dá pra virar o jogo no próximo.",
          to: "/bot-finance/balanco",
          score: 95,
        });
      } else {
        out.push({
          id: "fluxo",
          label: `Balanço de ${monthLabel}`,
          icon: Sparkles,
          accent: pct > 85 ? "#FBBF24" : "#C8F36D",
          body: <>Você gastou <b>{pct}%</b> do que entrou em {monthLabel}.</>,
          quip: pct <= 60
            ? "Sobrou folga de verdade. Continua assim."
            : pct <= 85
              ? "Dentro do previsto, sem sustos."
              : "Está no limite. Qualquer imprevisto aperta.",
          to: "/bot-finance/balanco",
          score: pct > 85 ? 78 : 56,
        });
      }
    }

    // ── What is left per day ──
    if (isCurrentMonth && saldoPrevisto > 0 && daysLeft > 0) {
      const perDay = saldoPrevisto / daysLeft;
      out.push({
        id: "diario",
        label: "Até o fim do mês",
        icon: Wallet,
        accent: "#7DD3FC",
        body: <>Sobram <b>{v(perDay)} por dia</b> pelos próximos {daysLeft} dias.</>,
        quip: perDay < 20
          ? "Apertado. Vale segurar o que não for essencial."
          : "Dá pra respirar até virar o mês.",
        to: "/bot-finance/balanco",
        score: perDay < 20 ? 72 : 52,
      });
    }

    // ── Who swallowed the month ──
    const top = [...categories].sort((a, b) => b.amount - a.amount)[0];
    if (top && despesas > 0) {
      const share = Math.round((top.amount / despesas) * 100);
      out.push({
        id: "categoria",
        label: "Maior gasto",
        icon: PieChart,
        accent: "#C084FC",
        body: <><b>{top.name}</b> levou {share}% do que saiu, {v(top.amount)}.</>,
        quip: share >= 30 ? quipFor(top.name) : undefined,
        to: "/analytics/categorias",
        // A category that has taken a third of the month is news; a quarter is not.
        score: 40 + share,
      });
    }

    // ── The single biggest thing that left ──
    const biggest = transactions
      .filter((t) => t.type === "despesa")
      .sort((a, b) => b.amount - a.amount)[0];
    if (biggest && despesas > 0) {
      const share = Math.round((biggest.amount / despesas) * 100);
      out.push({
        id: "maior-saida",
        label: "Maior saída do mês",
        icon: Receipt,
        accent: "#FB923C",
        body: <>Sua maior saída foi <b>{biggest.name}</b>, {v(biggest.amount)}.</>,
        quip: share >= 25 ? `Sozinha, levou ${share}% de tudo que saiu.` : undefined,
        to: "/transacoes",
        score: 30 + share,
      });
    }

    // ── Today, so far ──
    if (isCurrentMonth) {
      const key = todayKey();
      const spentToday = transactions
        .filter((t) => t.type === "despesa" && (t.rawDate ?? t.date) === key)
        .reduce((s, t) => s + t.amount, 0);
      out.push({
        id: "hoje",
        label: "Hoje",
        icon: Hand,
        accent: spentToday > 0 ? "#FBBF24" : "#C8F36D",
        body: spentToday > 0
          ? <>Já saíram <b>{v(spentToday)}</b> hoje.</>
          : <>Você ainda <b>não gastou nada</b> hoje.</>,
        quip: spentToday > 0 ? undefined : "Dia limpo até agora.",
        to: "/transacoes",
        score: spentToday > 0 ? 46 : 50,
      });
    }

    // ── What is still open this month ──
    const openOnes = events.filter((e) => e.status === "pendente" || e.status === "atrasado");
    const openOut = openOnes.filter((e) => e.type !== "receita");
    if (openOut.length > 1) {
      const total = openOut.reduce((s, e) => s + e.amount, 0);
      out.push({
        id: "pendentes",
        label: `Ainda falta em ${monthLabel}`,
        icon: CalendarClock,
        accent: "#FBBF24",
        body: <><b>{openOut.length} contas</b> em aberto somam {v(total)}.</>,
        quip: total > saldoAtual && saldoAtual >= 0 ? "É mais do que está nas contas agora." : undefined,
        to: "/transacoes",
        score: total > saldoAtual && saldoAtual >= 0 ? 85 : 54,
      });
    }

    // ── The invoice closing in ──
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
      const days = Math.round((new Date(pending.due).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000);
      out.push({
        id: "fatura",
        label: "Fatura do cartão",
        icon: CreditCard,
        accent: days <= 3 ? "#F87171" : "#A78BFA",
        body: days <= 0
          ? <><b>{pending.card.name}</b> vence hoje, {v(pending.invoice!.total)}.</>
          : <><b>{v(pending.invoice!.total)}</b> no {pending.card.name}, vence em {days} {days === 1 ? "dia" : "dias"}.</>,
        quip: days <= 3 ? "Essa não dá pra deixar passar." : undefined,
        to: "/cartoes",
        score: days <= 3 ? 90 : Math.max(44, 70 - days),
      });
    }

    // ── The next thing on the calendar, coming in or going out ──
    const next = openOnes.sort((a, b) => (a.rawDate ?? a.date).localeCompare(b.rawDate ?? b.date))[0];
    if (next) {
      const late = next.status === "atrasado";
      const income = next.type === "receita";
      // The formatted date already ends in a full stop ("1 de out."); the sentence
      // brings its own.
      const when = next.date.replace(/\.+$/, "");
      out.push({
        id: "evento",
        label: late ? "Em atraso" : "Próximo evento",
        icon: CalendarClock,
        accent: late ? "#F87171" : income ? "#C8F36D" : "#FBBF24",
        body: late
          ? <><b>{next.name}</b> está atrasado. São {v(next.amount)}.</>
          : income
            ? <><b>{v(next.amount)}</b> de {next.name} entram em {when}.</>
            : <><b>{next.name}</b> vence em {when}, {v(next.amount)}.</>,
        quip: late ? "Quanto antes resolver, menos dói." : undefined,
        to: "/transacoes",
        score: late ? 93 : 48,
      });
    }

    // Greeting first, then the best of the rest, and only as many as anyone will sit
    // through.
    return out.sort((a, b) => b.score - a.score).slice(0, 7);
  }, [receitas, despesas, saldoPrevisto, saldoAtual, categories, events, transactions, month,
      isCurrentMonth, cards, invoices, hidden, greeting, dateStr, firstName]);

  const count = slides.length;

  const go = useCallback((next: number) => {
    if (count === 0) return;
    setDir(next > index ? 1 : -1);
    setIndex(((next % count) + count) % count);
  }, [count, index]);

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

  if (count === 0) return <div className="h-[196px]" aria-hidden="true" />;

  const slide = slides[Math.min(index, count - 1)];
  const Icon = slide.icon;

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

      <div className="relative mt-5 h-[168px]">
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
              <span className="truncate text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/55">
                {slide.label}
              </span>
            </span>

            <p className="mt-3 text-[22px] font-medium leading-[1.26] tracking-[-0.022em] text-white/72 [text-wrap:balance] [&>b]:font-extrabold [&>b]:text-white">
              {slide.body}
            </p>

            {slide.quip && (
              <p className="mt-2.5 text-[13.5px] leading-snug text-white/45 [text-wrap:balance]">{slide.quip}</p>
            )}
          </motion.button>
        </AnimatePresence>
      </div>
    </div>
  );
}
