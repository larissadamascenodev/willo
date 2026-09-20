import { memo, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight, CreditCard, Plus } from "lucide-react";
import { useCardsOverview, cardHex, invoiceDueDate, type OverviewCard, type OverviewInvoice } from "@/hooks/useCardsOverview";

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
const CardsOverviewSection = memo(() => {
  const { cards, invoices, loading } = useCardsOverview();
  return <CardsOverviewView cards={cards} invoices={invoices} loading={loading} />;
});

/** The card itself, fed with data — also drawn by the welcome showcase. */
export function CardsOverviewView({ cards, invoices, loading = false, today = new Date() }: {
  cards: OverviewCard[];
  invoices: OverviewInvoice[];
  loading?: boolean;
  today?: Date;
}) {
  const navigate = useNavigate();

  const summary = useMemo(() => {
    const limit = cards.reduce((s, c) => s + c.limit, 0);
    const used = cards.reduce((s, c) => s + c.used, 0);
    const month = today.getMonth() + 1;
    const year = today.getFullYear();
    const current = cards.map((card) => {
      const invoice = invoices.find((i) => i.cardId === card.id && i.month === month && i.year === year);
      return { card, invoice, due: invoiceDueDate(card, year, month) };
    });
    const invoiceTotal = current.reduce((s, c) => s + (c.invoice?.total ?? 0), 0);
    const pending = current.filter((c) => c.invoice && !c.invoice.isPaid && c.invoice.total > 0);
    const nextDue = pending.map((c) => c.due).sort((a, b) => a.getTime() - b.getTime())[0];
    return { limit, used, available: Math.max(limit - used, 0), current, invoiceTotal, nextDue, allPaid: pending.length === 0 };
  }, [cards, invoices, today]);

  if (loading) {
    return <div className="h-[168px] animate-pulse rounded-[22px] border border-white/[0.07] bg-[#141414]" />;
  }

  if (cards.length === 0) {
    return (
      <button
        onClick={() => navigate("/gestao")}
        className="flex w-full items-center gap-3.5 rounded-[22px] border border-dashed border-white/[0.12] p-4 text-left active:opacity-70"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06]">
          <CreditCard className="h-5 w-5 text-white/70" />
        </span>
        <span className="flex-1">
          <span className="block text-[15px] font-semibold text-white">Adicione um cartão de crédito</span>
          <span className="block text-[12px] text-white/45">Acompanhe limite, faturas e parcelas</span>
        </span>
        <Plus className="h-5 w-5 text-white/50" />
      </button>
    );
  }

  const usedPct = summary.limit > 0 ? Math.min(summary.used / summary.limit, 1) : 0;
  const R = 30;
  const C = 2 * Math.PI * R;

  return (
    <button
      onClick={() => navigate("/cartoes?aba=faturas")}
      className="block w-full rounded-[22px] border border-white/[0.07] bg-[#141414] p-4 text-left active:scale-[0.99] transition-transform"
    >
      <div className="flex items-center justify-between">
        <p className="text-[14px] text-white/50">Cartões de crédito</p>
        <ChevronRight className="h-4 w-4 text-white/30" />
      </div>

      <div className="mt-3 flex items-center gap-4">
        {/* Fatura atual */}
        <div className="min-w-0 flex-1">
          <p className="whitespace-nowrap text-[11px] text-white/45">Fatura atual</p>
          <p className="truncate whitespace-nowrap text-[22px] font-extrabold leading-tight tracking-tight text-white tabular-nums">{fmt(summary.invoiceTotal)}</p>
          <p className={`truncate whitespace-nowrap text-[11px] ${summary.allPaid ? "text-white/40" : "text-amber-300/90"}`}>
            {summary.invoiceTotal === 0 ? "Sem fatura este mês" : summary.allPaid ? "Tudo pago" : summary.nextDue ? dueText(summary.nextDue, today) : ""}
          </p>
        </div>

        {/* Limite disponível */}
        <div className="flex shrink-0 items-center gap-2.5 border-l border-white/[0.08] pl-3">
          <div className="relative h-[52px] w-[52px]">
            <svg viewBox="0 0 76 76" className="h-full w-full -rotate-90">
              <circle cx="38" cy="38" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="9" />
              <motion.circle
                cx="38" cy="38" r={R} fill="none" stroke="#FFFFFF" strokeWidth="9" strokeLinecap="round"
                initial={{ strokeDasharray: `0 ${C}` }}
                animate={{ strokeDasharray: `${(1 - usedPct) * C} ${C}` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-white tabular-nums">
              {Math.round((1 - usedPct) * 100)}%
            </span>
          </div>
          <div>
            <p className="whitespace-nowrap text-[11px] text-white/45">Limite livre</p>
            <p className="whitespace-nowrap text-[14px] font-bold text-white tabular-nums">{fmt(summary.available)}</p>
            <p className="whitespace-nowrap text-[10px] text-white/35 tabular-nums">de {fmt(summary.limit)}</p>
          </div>
        </div>
      </div>

      {/* Per card */}
      <div className="mt-4 space-y-2.5 border-t border-white/[0.06] pt-3.5">
        {summary.current.map(({ card, invoice, due }) => {
          const available = Math.max(card.limit - card.used, 0);
          return (
            <div key={card.id} className="flex items-center gap-2.5">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: cardHex(card.color) }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] text-white">{card.name}</span>
                <span className="block truncate whitespace-nowrap text-[11px] text-white/40 tabular-nums">
                  {invoice?.isPaid ? "Fatura paga" : `Vence ${due.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`} · {fmt(available)} livre
                </span>
              </span>
              <span className={`shrink-0 whitespace-nowrap text-[14px] tabular-nums ${invoice?.isPaid ? "text-white/40 line-through" : "text-white"}`}>
                {fmt(invoice?.total ?? 0)}
              </span>
            </div>
          );
        })}
      </div>
    </button>
  );
}

CardsOverviewSection.displayName = "CardsOverviewSection";
export default CardsOverviewSection;
