import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight, CreditCard, Plus } from "lucide-react";
import BackButton from "@/components/shared/BackButton";
import HoldActions from "@/components/shared/HoldActions";
import CardCreateSheet from "@/components/wallet/CardCreateSheet";
import CreditCardEditModal from "@/components/fatura/CreditCardEditModal";
import { getInvoiceStatusLabel, type CreditCardItem } from "@/components/wallet/CreditCardTile";
import { getCreditCards } from "@/services/transactionService";
import { useLongPress } from "@/hooks/useLongPress";
import { colorFor } from "@/lib/banks";
import { getCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import {
  useCardsOverview, monthKey,
  type OverviewCard, type OverviewInvoice,
} from "@/hooks/useCardsOverview";

/**
 * Every card, on one panel.
 *
 * This screen used to open on three pills — Cartões, Faturas, Parcelas — which asked
 * which view you wanted before you had seen anything, and then answered with a month
 * for whichever card the filter happened to be on. But the question on arriving is
 * always the same one: which card. So the screen is the answer to that and nothing
 * else, and everything about a card now lives inside the card.
 *
 * The figure on a row is what that card is asking for now, not what it has spent since
 * it was created: a credit card is a bill, and the bill is the open invoice.
 */

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });

interface CardRow {
  card: OverviewCard;
  hex: string;
  /** What the open invoice still asks for. */
  owed: number;
  /** The invoice that figure came from, for the status line. */
  open: OverviewInvoice | null;
  available: number;
  usedPct: number;
}

/** One card. Tap opens it; hold edits or removes it. */
function CardLine({ row, index, onOpen, onHold }: {
  row: CardRow;
  index: number;
  onOpen: () => void;
  onHold: () => void;
}) {
  const press = useLongPress(onHold);
  const { card, hex, owed, open, available, usedPct } = row;

  const item: CreditCardItem = {
    id: card.id,
    name: card.name,
    limit: card.limit,
    used_limit: card.used,
    closing_day: card.closingDay,
    due_day: card.dueDay,
    color: card.color,
    last_four_digits: card.lastFour,
  };
  const status = getInvoiceStatusLabel(
    item,
    open ? { amount: owed, month: open.month, year: open.year, isPaid: open.isPaid } : undefined,
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 + index * 0.05, duration: 0.3 }}
      onPointerDown={press.onPointerDown}
      onPointerMove={press.onPointerMove}
      onPointerUp={press.onPointerUp}
      onPointerCancel={press.onPointerCancel}
      onPointerLeave={press.onPointerLeave}
      onContextMenu={(e) => e.preventDefault()}
      onClick={press.guard(onOpen)}
      className="cursor-pointer px-4 py-3.5 transition-colors active:bg-white/[0.03]"
    >
      <div className="flex items-center gap-3">
        {/* The chip, in the bank's own colour: two cards are told apart without reading. */}
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]"
          style={{ background: hex, boxShadow: `0 8px 18px -10px ${hex}` }}
        >
          <span className="h-[8px] w-[12px] rounded-[2px] bg-white/85" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-white">{card.name}</p>
          <p className="truncate text-[11.5px] t-softer">
            {open?.isPaid ? "Fatura paga" : status.isClosed ? "Fatura fechada" : "Fatura aberta"}
            <span className="text-white/25"> · </span>
            <span className={cn(status.isClosed && !open?.isPaid && "font-semibold text-amber-300/90")}>
              {status.label.toLowerCase()}
            </span>
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className={cn(
            "text-[15px] font-bold tabular-nums",
            owed > 0 ? "text-white" : "t-softer",
          )}>
            {fmt(owed)}
          </p>
          <p className="text-[11.5px] t-softer tabular-nums">
            {fmt(available)} <span className="t-faint">livres</span>
          </p>
        </div>

        <ChevronRight className="h-4 w-4 shrink-0 t-faint" />
      </div>

      {/* How much of the card is already spoken for. */}
      <div className="mt-2.5 h-[4px] overflow-hidden rounded-full bg-white/[0.08]">
        <motion.span
          className="block h-full rounded-full"
          style={{ background: usedPct >= 100 ? "#F87171" : usedPct >= 80 ? "#FBBF24" : hex }}
          initial={{ width: 0 }}
          animate={{ width: `${usedPct}%` }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 + index * 0.05 }}
        />
      </div>
    </motion.div>
  );
}

const Cartoes = () => {
  const navigate = useNavigate();
  const { cards, invoices, loading, refresh } = useCardsOverview();
  const [showAddCard, setShowAddCard] = useState(false);
  const [heldCard, setHeldCard] = useState<OverviewCard | null>(null);
  const [editingCard, setEditingCard] = useState<any | null>(null);

  const rows = useMemo<CardRow[]>(() => {
    const now = new Date();
    const currentKey = monthKey(now.getFullYear(), now.getMonth() + 1);

    return cards.map((card) => {
      /* The invoice that is actually open: the earliest from this month on that still
         owes something. Not the calendar month — past the closing day those differ. */
      const open =
        invoices
          .filter(
            (i) =>
              i.cardId === card.id &&
              !i.isPaid &&
              i.total > 0 &&
              monthKey(i.year, i.month) >= currentKey,
          )
          .sort((a, b) => monthKey(a.year, a.month) - monthKey(b.year, b.month))[0] ?? null;

      return {
        card,
        hex: colorFor(card.name, card.color, "#8B5CF6"),
        owed: open ? Math.max(open.total - open.paid, 0) : 0,
        open,
        available: Math.max(card.limit - card.used, 0),
        usedPct: card.limit > 0 ? Math.min((card.used / card.limit) * 100, 100) : 0,
      };
    });
  }, [cards, invoices]);

  const totalOwed = rows.reduce((s, r) => s + r.owed, 0);
  const totalLimit = rows.reduce((s, r) => s + r.card.limit, 0);
  const totalAvailable = rows.reduce((s, r) => s + r.available, 0);

  return (
    <div className="mx-auto max-w-lg pb-28">
      <div className="flex h-11 items-center">
        <BackButton />
      </div>

      {loading ? (
        <div className="mt-4 h-[280px] animate-pulse rounded-[24px] border border-white/[0.08] willo-glass" />
      ) : cards.length === 0 ? (
        <div className="mt-4 overflow-hidden rounded-[24px] border border-white/[0.08] willo-glass px-5 pb-5 pt-6 text-center">
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
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="mt-4 overflow-hidden rounded-[24px] border border-white/[0.08] willo-glass"
        >
          <div className="px-4 pb-3.5 pt-4">
            <p className="text-[14px] text-white/66">Em faturas abertas</p>
            <p className="mt-1 truncate text-[30px] font-extrabold leading-none tracking-[-0.03em] text-white tabular-nums">
              {fmt(totalOwed)}
            </p>
            <p className="mt-2 text-[12.5px] t-soft">
              {rows.length} {rows.length === 1 ? "cartão" : "cartões"}
              <span className="text-white/25"> · </span>
              <span className="tabular-nums">{fmt(totalAvailable)}</span> de limite livre
            </p>

            {/* One bar split by card: the share each one takes of what is owed. */}
            <div className="mt-3.5 flex h-[7px] gap-[3px] overflow-hidden rounded-full">
              {totalOwed > 0 ? (
                rows.filter((r) => r.owed > 0).map((r, i) => (
                  <motion.span
                    key={r.card.id}
                    className="h-full rounded-full"
                    style={{ background: r.hex }}
                    initial={{ flexGrow: 0 }}
                    animate={{ flexGrow: r.owed / totalOwed }}
                    transition={{ duration: 0.6, delay: 0.04 * i, ease: "easeOut" }}
                  />
                ))
              ) : (
                <span className="h-full flex-1 rounded-full bg-white/[0.08]" />
              )}
            </div>
          </div>

          <div className="divide-y divide-white/[0.06] border-t border-white/[0.06]">
            {rows.map((row, i) => (
              <CardLine
                key={row.card.id}
                row={row}
                index={i}
                onOpen={() => navigate(`/fatura/${row.card.id}`)}
                onHold={() => setHeldCard(row.card)}
              />
            ))}
          </div>

          <button
            onClick={() => setShowAddCard(true)}
            className="flex h-[52px] w-full items-center justify-center gap-2 border-t border-white/[0.06] text-[14.5px] font-semibold text-white/82 active:bg-white/[0.03]"
          >
            <Plus className="h-[17px] w-[17px]" strokeWidth={2.4} /> Adicionar cartão
          </button>
        </motion.section>
      )}

      {totalLimit > 0 && (
        <p className="mt-3 px-1 text-[12px] t-faint tabular-nums">
          Limite total {fmt(totalLimit)} · usado {fmt(Math.max(totalLimit - totalAvailable, 0))}
        </p>
      )}

      <CardCreateSheet open={showAddCard} onClose={() => setShowAddCard(false)} onCreated={refresh} />

      <HoldActions
        open={!!heldCard}
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
