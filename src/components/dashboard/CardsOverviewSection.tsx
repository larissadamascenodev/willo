import { memo, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight, CreditCard, Plus } from "lucide-react";
import { useCardsOverview, cardHex, invoiceDueDate, type OverviewCard, type OverviewInvoice } from "@/hooks/useCardsOverview";
import { StatTile } from "@/components/dashboard/StatTile";

import { getCurrency } from "@/lib/currency";
const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });

function dueText(date: Date, now = new Date()) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const days = Math.round((date.getTime() - today.getTime()) / 86400000);
  const label = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  if (days < 0) return `Venceu em ${label}`;
  if (days === 0) return "Vence hoje";
  if (days === 1) return "Vence amanhã";
  return `Vence em ${days} dias · ${label}`;
}

/** Dashboard card: current invoice and available limit across credit cards; opens the cards page. */
const CardsOverviewSection = memo(({ compact = false }: { compact?: boolean }) => {
  const { cards, invoices, loading } = useCardsOverview();
  return <CardsOverviewView cards={cards} invoices={invoices} loading={loading} compact={compact} />;
});

/** The card itself, fed with data — also drawn by the welcome showcase. */
export function CardsOverviewView({ cards, invoices, loading = false, today = new Date(), compact = false }: {
  cards: OverviewCard[];
  invoices: OverviewInvoice[];
  loading?: boolean;
  today?: Date;
  compact?: boolean;
}) {
  const navigate = useNavigate();

  const summary = useMemo(() => {
    const limit = cards.reduce((s, c) => s + c.limit, 0);
    const used = cards.reduce((s, c) => s + c.used, 0);
    // The statement collecting purchases right now, per card: past its closing day the
    // open one is already next month's, so the calendar month would show a settled one.
    const current = cards.map((card) => {
      const rolls = today.getDate() > card.closingDay ? 1 : 0;
      const index = today.getFullYear() * 12 + today.getMonth() + rolls;
      const month = (index % 12) + 1;
      const year = Math.floor(index / 12);
      const invoice = invoices.find((i) => i.cardId === card.id && i.month === month && i.year === year);
      return { card, invoice, due: invoiceDueDate(card, year, month) };
    });
    const invoiceTotal = current.reduce((s, c) => s + (c.invoice?.total ?? 0), 0);
    const pending = current.filter((c) => c.invoice && !c.invoice.isPaid && c.invoice.total > 0);
    const nextDue = pending.map((c) => c.due).sort((a, b) => a.getTime() - b.getTime())[0];
    return { limit, used, available: Math.max(limit - used, 0), current, invoiceTotal, nextDue, allPaid: pending.length === 0 };
  }, [cards, invoices, today]);

  if (loading) {
    return <div className={`${compact ? "h-[138px]" : "h-[168px]"} animate-pulse rounded-[22px] border border-white/[0.08] willo-glass`} />;
  }

  if (cards.length === 0) {
    if (compact) return null;
    return (
      <button
        onClick={() => navigate("/gestao")}
        className="flex w-full items-center gap-3.5 rounded-[22px] border border-dashed border-white/[0.08] p-4 text-left active:opacity-70"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06]">
          <CreditCard className="h-5 w-5 text-white/82" />
        </span>
        <span className="flex-1">
          <span className="block text-[15px] font-semibold text-white">Adicione um cartão de crédito</span>
          <span className="block text-[12px] text-white/62">Acompanhe limite, faturas e parcelas</span>
        </span>
        <Plus className="h-5 w-5 text-white/66" />
      </button>
    );
  }

  const usedPct = summary.limit > 0 ? Math.min(summary.used / summary.limit, 1) : 0;
  const tight = usedPct >= 0.8;

  if (compact) {
    return (
      <StatTile
        label="Em faturas"
        value={fmt(summary.invoiceTotal)}
        caption={summary.allPaid
          ? `${cards.length} ${cards.length === 1 ? "cartão" : "cartões"} · tudo pago`
          : summary.nextDue
            ? `Vence ${summary.nextDue.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`
            : `${cards.length} ${cards.length === 1 ? "cartão" : "cartões"}`}
        icon={CreditCard}
        accent={tight ? "#F87171" : "#A78BFA"}
        progress={usedPct}
        onClick={() => navigate("/cartoes")}
      />
    );
  }

  return (
    <button
      onClick={() => navigate("/cartoes?aba=faturas")}
      className="block w-full rounded-[22px] border border-white/[0.08] willo-glass px-[14px] pb-[14px] pt-3.5 text-left transition-transform active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] text-white/50">Cartões de crédito</p>
          {/* What you owe is the figure; the limit is context underneath it. The two
              used to share the row as equals, which made neither the headline. */}
          <p className="mt-1.5 truncate text-[32px] font-extrabold leading-none tracking-[-0.035em] tabular-nums text-white">
            {fmt(summary.invoiceTotal)}
          </p>
          <p className={`mt-1.5 truncate text-[12px] ${summary.allPaid ? "text-white/50" : "text-amber-300/90"}`}>
            {summary.invoiceTotal === 0
              ? "Sem fatura este mês"
              : summary.allPaid
                ? "Tudo pago"
                : summary.nextDue
                  ? dueText(summary.nextDue, today)
                  : "A pagar"}
          </p>
        </div>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-white/35" />
      </div>

      {/* The limit as a bar rather than a ring: a 52px ring reading "15%" never said
          15% of what, and the figures below carry it better. */}
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.08]">
        <motion.div
          className={`h-full rounded-full ${tight ? "bg-amber-300" : "bg-white/75"}`}
          initial={{ width: 0 }}
          animate={{ width: `${usedPct * 100}%` }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        />
      </div>
      <p className="mt-2.5 text-[12.5px] text-white/55">
        <span className="font-semibold text-white tabular-nums">{fmt(summary.available)}</span> livres
        {" "}de <span className="tabular-nums">{fmt(summary.limit)}</span>
      </p>

      <div className="mt-3.5 border-t border-white/[0.07]">
        {summary.current.map(({ card, invoice, due }, i) => (
          <div key={card.id} className={`flex items-center gap-2.5 py-2.5 ${i > 0 ? "border-t border-white/[0.05]" : ""}`}>
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: cardHex(card.color) }} />
            <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-white">{card.name}</span>
            <span className="shrink-0 whitespace-nowrap text-[11.5px] text-white/45 tabular-nums">
              {invoice?.isPaid ? "paga" : due.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
            </span>
            <span
              className={`w-[88px] shrink-0 text-right text-[13.5px] font-bold tabular-nums ${
                invoice?.isPaid ? "text-white/45 line-through" : "text-white"
              }`}
            >
              {fmt(invoice?.total ?? 0)}
            </span>
          </div>
        ))}
      </div>
    </button>
  );
}

CardsOverviewSection.displayName = "CardsOverviewSection";
export default CardsOverviewSection;
