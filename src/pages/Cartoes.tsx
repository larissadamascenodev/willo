import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CreditCard, Plus } from "lucide-react";
import BackButton from "@/components/shared/BackButton";
import HoldActions from "@/components/shared/HoldActions";
import type { AnchorRect } from "@/components/shared/AnchoredMenu";
import CardCreateSheet from "@/components/wallet/CardCreateSheet";
import CreditCardEditModal from "@/components/fatura/CreditCardEditModal";
import CardFaceTile, { FREE_LIMIT_HEX, USED_LIMIT_HEX } from "@/components/wallet/CardFaceTile";
import { getInvoiceStatusLabel, type CreditCardItem } from "@/components/wallet/CreditCardTile";
import { getCreditCards } from "@/services/transactionService";
import { colorFor } from "@/lib/banks";
import { getCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import {
  useCardsOverview, monthKey,
  type OverviewCard, type OverviewInvoice,
} from "@/hooks/useCardsOverview";

/**
 * The wallet.
 *
 * Arriving here there are two questions, in this order: what do all of these add up
 * to, and which card do I want. So the total is the first thing on the page, with
 * nothing drawn around it, and under it one panel that breaks that total down — by
 * card, against the limit, and into what is still coming in instalments. Then the
 * cards themselves, as the way in.
 *
 * Every figure is the open invoice, the one still to be paid. A credit card is a bill,
 * not a history.
 */

/** How far the page scrolls before the pinned summary has fully receded. */
const PIN_TRAVEL = 150;

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });

interface CardRow {
  card: OverviewCard;
  hex: string;
  open: OverviewInvoice | null;
  total: number;
  paid: number;
  status: { label: string; isClosed: boolean };
}

const Cartoes = () => {
  const navigate = useNavigate();
  const { cards, invoices, installments, items, loading, refresh } = useCardsOverview();
  const [showAddCard, setShowAddCard] = useState(false);
  const [heldCard, setHeldCard] = useState<OverviewCard | null>(null);
  /* Where the held card sits, so its menu opens beside it. */
  const [heldRect, setHeldRect] = useState<AnchorRect | null>(null);
  const [editingCard, setEditingCard] = useState<any | null>(null);

  const rows = useMemo<CardRow[]>(() => {
    const now = new Date();
    const currentKey = monthKey(now.getFullYear(), now.getMonth() + 1);

    return cards.map((card) => {
      /* The invoice actually open: the earliest from this month on that still owes
         something. Not the calendar month — past the closing day those differ. */
      const open =
        invoices
          .filter(
            (i) => i.cardId === card.id && !i.isPaid && i.total > 0 && monthKey(i.year, i.month) >= currentKey,
          )
          .sort((a, b) => monthKey(a.year, a.month) - monthKey(b.year, b.month))[0] ?? null;

      const item: CreditCardItem = {
        id: card.id, name: card.name, limit: card.limit, used_limit: card.used,
        closing_day: card.closingDay, due_day: card.dueDay,
        color: card.color, last_four_digits: card.lastFour,
      };

      return {
        card,
        hex: colorFor(card.name, card.color, "#8B5CF6"),
        open,
        /* What the invoice asks for today: a payment already made has left it. The
           card screen shows the same figure, so the two never disagree. */
        total: open ? Math.max(open.total - open.paid, 0) : 0,
        paid: open?.paid ?? 0,
        status: getInvoiceStatusLabel(
          item,
          open ? { amount: open.total, month: open.month, year: open.year, isPaid: open.isPaid } : undefined,
        ),
      };
    });
  }, [cards, invoices]);

  const sums = useMemo(() => {
    /* The lines of the invoices that are open — how many there are, and how many of
       them are instalments of something bought earlier. */
    const openKey = new Map(
      rows.filter((r) => r.open).map((r) => [r.card.id, monthKey(r.open!.year, r.open!.month)]),
    );
    const lines = items.filter((i) => openKey.get(i.cardId) === monthKey(i.year, i.month));

    const limite = rows.reduce((s, r) => s + r.card.limit, 0);
    const usado = rows.reduce((s, r) => s + r.card.used, 0);

    return {
      faturas: rows.reduce((s, r) => s + r.total, 0),
      lancamentos: lines.length,
      parcelados: lines.filter((i) => i.isParcelado).length,
      limite,
      usado,
      disponivel: Math.max(limite - usado, 0),
      usadoPct: limite > 0 ? Math.min((usado / limite) * 100, 100) : 0,
    };
  }, [rows, items]);

  /* The summary does not scroll. It stays where it is and recedes — blurring,
     dimming, sinking a little — while the cards travel up over it, the way the home
     screen's greeting behaves under its own cards. */
  const summaryRef = useRef<HTMLDivElement>(null);
  const [summaryHeight, setSummaryHeight] = useState(0);
  const [progress, setProgress] = useState(0);

  const markerRef = useRef<HTMLDivElement>(null);
  const [summaryTop, setSummaryTop] = useState(0);

  useLayoutEffect(() => {
    const el = summaryRef.current;
    if (!el) return;
    /* Where the block would have sat if it still scrolled, read off a marker left in
       the flow. Guessing the number — the back row's height plus the safe area —
       drifts the moment either changes, and the gap shows. */
    const measure = () => {
      setSummaryHeight(el.offsetHeight);
      const marker = markerRef.current;
      if (marker) setSummaryTop(marker.getBoundingClientRect().top + window.scrollY);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [loading, rows.length]);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        /* A page with barely anything below the fold should not recede at all: a few
           pixels of scroll were enough to blur the total, which made a page that
           fits look broken. The travel is whatever room there actually is. */
        const room = document.documentElement.scrollHeight - window.innerHeight;
        if (room < 80) { setProgress(0); return; }
        const travel = Math.min(PIN_TRAVEL, room);
        setProgress(Math.min(Math.max(window.scrollY / travel, 0), 1));
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="mx-auto max-w-lg pb-10 pt-4">
      {/* Over the pinned summary as it leaves, like the cards. */}
      <div className="relative z-20 flex h-11 items-center">
        {/* Cartões is a page off the dashboard, and that is where back goes. */}
        <BackButton to="/" />
      </div>

      {loading ? (
        <div className="mt-5 space-y-4">
          <div className="h-[90px] animate-pulse rounded-[24px] bg-white/[0.04]" />
          <div className="h-[420px] animate-pulse rounded-[24px] border border-white/[0.08] willo-glass" />
        </div>
      ) : cards.length === 0 ? (
        <div className="mt-4 overflow-hidden rounded-[26px] border border-white/[0.08] willo-glass px-5 pb-5 pt-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04]">
            <CreditCard className="h-[22px] w-[22px] text-white/70" strokeWidth={2} />
          </div>
          <p className="mt-3.5 text-[17px] font-bold text-white">Nenhum cartão cadastrado</p>
          <p className="mx-auto mt-1.5 max-w-[16rem] text-[13.5px] leading-snug t-soft">
            Cadastre um cartão para acompanhar faturas, limite e parcelamentos.
          </p>
          <button
            onClick={() => setShowAddCard(true)}
            className="mt-4 flex h-[50px] w-full items-center justify-center gap-2 rounded-[18px] bg-white text-[15px] font-semibold willo-on-invert active:opacity-80"
          >
            <Plus className="h-[18px] w-[18px]" strokeWidth={2.4} /> Adicionar cartão
          </button>
        </div>
      ) : (
        <>
          {/* ══ Pinned: what everything adds up to ══ */}
          <div ref={markerRef} aria-hidden="true" />
          <div
            ref={summaryRef}
            className="fixed inset-x-0 z-10 mx-auto max-w-lg px-4"
            style={{
              top: summaryTop,
              filter: progress > 0.001 ? `blur(${(progress * 12).toFixed(2)}px)` : undefined,
              opacity: 1 - progress * 0.8,
              transform: `scale(${1 - progress * 0.03})`,
              transformOrigin: "50% 0%",
              willChange: "filter, opacity, transform",
              pointerEvents: progress > 0.4 ? "none" : undefined,
            }}
          >
          {/* ══ The figure itself, with nothing drawn around it ══ */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="relative px-1 pt-3"
          >
            {/* The wallet's own light, behind the figure rather than around it — the
                page keeps its depth without the total being put in a box. */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -left-10 -top-8 h-44 w-72 rounded-full blur-[64px]"
              style={{ background: "#8B93A8", opacity: 0.16 }}
            />
            <p className="relative text-[13.5px] text-white/62">Total em faturas</p>
            <p className="relative mt-1 truncate text-[40px] font-extrabold leading-none tracking-[-0.04em] text-white tabular-nums">
              {fmt(sums.faturas)}
            </p>
            <p className="relative mt-2.5 text-[12.5px] t-soft tabular-nums">
              {sums.lancamentos} {sums.lancamentos === 1 ? "lançamento" : "lançamentos"}
              {sums.parcelados > 0 && (
                <>
                  <span className="text-white/20"> · </span>
                  {sums.parcelados} parcelado{sums.parcelados === 1 ? "" : "s"}
                </>
              )}
            </p>
          </motion.div>

          {/* ══ The limit, loose on the page under the total ══
              What each card is spending is on the card itself, a few lines down — the
              only thing the sum of them needs to say is how much room is left. */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="mt-7 px-1"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[11.5px] font-semibold uppercase tracking-[0.12em] t-softer">Limite</span>
              <span className={cn(
                "text-[12px] font-semibold tabular-nums",
                sums.usadoPct >= 100 ? "text-red-400" : "t-softer",
              )}>
                {sums.usadoPct.toFixed(0)}% usado
              </span>
            </div>

            {/* One bar split the way the limit itself is split: each card's share of
                what is spent, in its own colour, and what is still free at the end. */}
            <div className="mt-3 flex h-2.5 gap-[3px]">
              {rows.map((r, i) => {
                const pct = sums.limite > 0 ? (r.card.used / sums.limite) * 100 : 0;
                if (pct < 0.5) return null;
                return (
                  <motion.span
                    key={r.card.id}
                    className="h-full rounded-full"
                    style={{
                      background: USED_LIMIT_HEX,
                      boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.16)",
                      minWidth: 6,
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, delay: 0.1 + i * 0.06, ease: "easeOut" }}
                  />
                );
              })}
              <motion.span
                className="h-full rounded-full"
                style={{
                  /* Flat, with light only on the top edge. The gradient used to end in
                     black, which dirtied the bottom of a seven-pixel bar and made the
                     green look switched off. */
                  background: FREE_LIMIT_HEX,
                  boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.45)",
                  minWidth: sums.disponivel > 0 ? 6 : 0,
                }}
                initial={{ width: 0 }}
                animate={{
                  width: `${sums.limite > 0 ? (sums.disponivel / sums.limite) * 100 : 100}%`,
                }}
                transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
              />
            </div>

            {/* Two columns, so the figures are not read as one sentence. */}
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <p className="flex items-center gap-1.5 text-[11.5px] t-softer">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: USED_LIMIT_HEX }} />
                  Usado
                </p>
                <p className="mt-1 truncate text-[16px] font-bold tabular-nums text-white/72">
                  {fmt(sums.usado)}
                </p>
              </div>
              <div>
                <p className="flex items-center gap-1.5 text-[11.5px] t-softer">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: FREE_LIMIT_HEX }} />
                  Disponível
                </p>
                <p
                  className="mt-1 truncate text-[16px] font-bold tabular-nums"
                  style={{ color: sums.disponivel > 0 ? FREE_LIMIT_HEX : "#F87171" }}
                >
                  {fmt(sums.disponivel)}
                </p>
              </div>
            </div>

            <p className="mt-3 text-[11.5px] tabular-nums t-faint">
              Limite total {fmt(sums.limite)}
            </p>
          </motion.div>
          </div>

          {/* The room the pinned block takes, so the cards begin under it. */}
          <div aria-hidden="true" style={{ height: summaryHeight }} />

          {/* ══ The cards ══ */}
          <div className="relative z-20 mt-6 space-y-3">
            {rows.map((r, i) => (
              <CardFaceTile
                key={r.card.id}
                index={i}
                hex={r.hex}
                card={{
                  id: r.card.id,
                  name: r.card.name,
                  lastFour: r.card.lastFour,
                  closingDay: r.card.closingDay,
                  dueDay: r.card.dueDay,
                  limit: r.card.limit,
                  used: r.card.used,
                }}
                owed={r.total}
                status={r.status}
                onOpen={() => navigate(`/fatura/${r.card.id}`)}
                onHold={(rect) => { setHeldCard(r.card); setHeldRect(rect); }}
              />
            ))}

            <button
              onClick={() => setShowAddCard(true)}
              className="flex h-[54px] w-full items-center justify-center gap-2 rounded-[20px] border border-dashed border-white/20 text-[14.5px] font-semibold text-white/82 active:opacity-70"
            >
              <Plus className="h-[18px] w-[18px]" strokeWidth={2.4} /> Adicionar cartão
            </button>
          </div>
        </>
      )}

      <CardCreateSheet open={showAddCard} onClose={() => setShowAddCard(false)} onCreated={refresh} />

      <HoldActions
        open={!!heldCard}
        anchor={heldRect}
        title={heldCard?.name ?? ""}
        subtitle="Cartão de crédito"
        onClose={() => setHeldCard(null)}
        onEdit={async () => {
          const held = heldCard;
          setHeldCard(null);
          if (!held) return;
          // The edit form needs the stored row, not the overview's trimmed shape.
          const all = (await getCreditCards()) as any[];
          const full = all.find((c) => c.id === held.id);
          if (full) setEditingCard(full);
        }}
        onDelete={async () => {
          const held = heldCard;
          setHeldCard(null);
          if (!held) return;
          const all = (await getCreditCards()) as any[];
          const full = all.find((c) => c.id === held.id);
          // Straight to the confirmation: the menu already asked for Excluir.
          if (full) setEditingCard({ ...full, __deleting: true });
        }}
      />

      {editingCard && (
        <CreditCardEditModal
          open
          card={{
            id: editingCard.id,
            name: editingCard.name,
            closing_day: editingCard.closing_day ?? 1,
            due_day: editingCard.due_day ?? 10,
            limit: Number(editingCard.limit ?? 0),
            color: editingCard.color ?? null,
            last_four_digits: editingCard.last_four_digits ?? null,
          }}
          startDeleting={!!editingCard.__deleting}
          onClose={() => setEditingCard(null)}
          onUpdated={() => { setEditingCard(null); refresh(); }}
          onDeleted={() => { setEditingCard(null); refresh(); }}
        />
      )}
    </div>
  );
};

export default Cartoes;
