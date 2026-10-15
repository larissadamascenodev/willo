import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CreditCard, Plus } from "lucide-react";
import BackButton from "@/components/shared/BackButton";
import HoldActions from "@/components/shared/HoldActions";
import CardCreateSheet from "@/components/wallet/CardCreateSheet";
import CreditCardEditModal from "@/components/fatura/CreditCardEditModal";
import CardFaceTile from "@/components/wallet/CardFaceTile";
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
 * This screen used to open on three pills — Cartões, Faturas, Parcelas — which asked
 * which view you wanted before you had seen anything. Arriving here, there are only two
 * questions: what do all of these cards add up to, and which one do I want. So the
 * screen is a summary and then the cards themselves, each drawn as a card, because a
 * row of text can state a number but it cannot be recognised at a glance.
 *
 * Every figure here is the open invoice — the one still to be paid. A credit card is a
 * bill, not a history.
 */

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });

interface CardRow {
  card: OverviewCard;
  hex: string;
  /** The invoice that is open, and what it asks for in full. */
  open: OverviewInvoice | null;
  total: number;
  paid: number;
  /** The part of that invoice that is instalments of earlier purchases. */
  parcelado: number;
  parcelas: number;
  status: { label: string; isClosed: boolean };
}

const Cartoes = () => {
  const navigate = useNavigate();
  const { cards, invoices, installments, loading, refresh } = useCardsOverview();
  const [showAddCard, setShowAddCard] = useState(false);
  const [heldCard, setHeldCard] = useState<OverviewCard | null>(null);
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

      const mine = open
        ? installments.filter(
            (i) => i.cardId === card.id && i.month === open.month && i.year === open.year,
          )
        : [];

      const item: CreditCardItem = {
        id: card.id, name: card.name, limit: card.limit, used_limit: card.used,
        closing_day: card.closingDay, due_day: card.dueDay,
        color: card.color, last_four_digits: card.lastFour,
      };

      return {
        card,
        hex: colorFor(card.name, card.color, "#8B5CF6"),
        open,
        total: open?.total ?? 0,
        paid: open?.paid ?? 0,
        parcelado: mine.reduce((s, i) => s + i.amount, 0),
        parcelas: mine.length,
        status: getInvoiceStatusLabel(
          item,
          open ? { amount: open.total, month: open.month, year: open.year, isPaid: open.isPaid } : undefined,
        ),
      };
    });
  }, [cards, invoices, installments]);

  const sums = useMemo(() => {
    const now = new Date();
    const currentKey = monthKey(now.getFullYear(), now.getMonth() + 1);

    const faturas = rows.reduce((s, r) => s + r.total, 0);
    const pago = rows.reduce((s, r) => s + r.paid, 0);
    const parcelado = rows.reduce((s, r) => s + r.parcelado, 0);
    const parcelas = rows.reduce((s, r) => s + r.parcelas, 0);

    /* Everything still to be charged in instalments, this invoice and every one after —
       the figure a limit never shows you until it is gone. */
    const aVencer = installments
      .filter((i) => monthKey(i.year, i.month) >= currentKey)
      .reduce((s, i) => s + i.amount, 0);
    const compras = new Set(
      installments.filter((i) => monthKey(i.year, i.month) >= currentKey).map((i) => i.groupId),
    ).size;

    const limite = rows.reduce((s, r) => s + r.card.limit, 0);
    const usado = rows.reduce((s, r) => s + r.card.used, 0);

    return {
      faturas,
      pago,
      restante: Math.max(faturas - pago, 0),
      parcelado,
      parcelas,
      avista: Math.max(faturas - parcelado, 0),
      aVencer,
      compras,
      limite,
      usado,
      disponivel: Math.max(limite - usado, 0),
      usadoPct: limite > 0 ? Math.min((usado / limite) * 100, 100) : 0,
    };
  }, [rows, installments]);

  const withValue = rows.filter((r) => r.total > 0);

  return (
    <div className="mx-auto max-w-lg pb-28">
      <div className="flex h-11 items-center">
        <BackButton />
      </div>

      {loading ? (
        <div className="mt-4 space-y-3">
          <div className="h-[320px] animate-pulse rounded-[26px] border border-white/[0.08] willo-glass" />
          <div className="h-[240px] animate-pulse rounded-[26px] border border-white/[0.08] willo-glass" />
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
          {/* ══ Everything, added up ══════════════════════════════ */}
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="relative mt-4 overflow-hidden rounded-[26px] border border-white/[0.08] willo-glass p-5"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -left-20 -top-24 h-56 w-64 rounded-full blur-[60px]"
              style={{ background: rows[0]?.hex ?? "#8B5CF6", opacity: 0.22 }}
            />

            <div className="relative">
              <p className="text-[13.5px] text-white/66">Total em faturas</p>
              <p className="mt-1 truncate text-[34px] font-extrabold leading-none tracking-[-0.035em] text-white tabular-nums">
                {fmt(sums.faturas)}
              </p>
              <p className="mt-2 text-[12.5px] t-soft">
                {rows.length} {rows.length === 1 ? "cartão" : "cartões"}
                {sums.pago > 0 && (
                  <>
                    <span className="text-white/25"> · </span>
                    <span className="tabular-nums text-willo-green-ink">{fmt(sums.pago)} já pagos</span>
                    <span className="text-white/25"> · </span>
                    <span className="tabular-nums">restam {fmt(sums.restante)}</span>
                  </>
                )}
              </p>
            </div>

            {/* The share each card takes of that total, in its own colour */}
            <div className="relative mt-4 flex h-[8px] gap-[3px] overflow-hidden rounded-full">
              {sums.faturas > 0 ? (
                withValue.map((r, i) => (
                  <motion.span
                    key={r.card.id}
                    className="h-full rounded-full"
                    style={{ background: r.hex }}
                    initial={{ flexGrow: 0 }}
                    animate={{ flexGrow: r.total / sums.faturas }}
                    transition={{ duration: 0.6, delay: 0.05 * i, ease: "easeOut" }}
                  />
                ))
              ) : (
                <span className="h-full flex-1 rounded-full bg-white/[0.08]" />
              )}
            </div>

            {/* …and which card it is */}
            <div className="relative mt-3.5 space-y-2.5">
              {rows.map((r) => (
                <div key={r.card.id} className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.hex }} />
                  <p className="min-w-0 flex-1 truncate text-[13.5px] text-white/80">{r.card.name}</p>
                  <p className="shrink-0 text-[13.5px] font-semibold tabular-nums text-white">{fmt(r.total)}</p>
                  <p className="w-[38px] shrink-0 text-right text-[12px] tabular-nums t-softer">
                    {sums.faturas > 0 ? Math.round((r.total / sums.faturas) * 100) : 0}%
                  </p>
                </div>
              ))}
            </div>

            {/* What those invoices are made of */}
            <div className="relative mt-4 grid grid-cols-2 gap-2.5 border-t border-white/[0.07] pt-4">
              <div className="rounded-[18px] border border-white/[0.07] bg-white/[0.03] px-3.5 py-3">
                <p className="text-[11.5px] t-softer">Em parcelas</p>
                <p className="mt-1 truncate text-[17px] font-bold leading-none text-white tabular-nums">
                  {fmt(sums.parcelado)}
                </p>
                <p className="mt-1.5 text-[11.5px] t-faint tabular-nums">
                  {sums.parcelas} {sums.parcelas === 1 ? "parcela" : "parcelas"}
                </p>
              </div>
              <div className="rounded-[18px] border border-white/[0.07] bg-white/[0.03] px-3.5 py-3">
                <p className="text-[11.5px] t-softer">Em lançamentos</p>
                <p className="mt-1 truncate text-[17px] font-bold leading-none text-white tabular-nums">
                  {fmt(sums.avista)}
                </p>
                <p className="mt-1.5 text-[11.5px] t-faint">compras à vista</p>
              </div>
            </div>

            {/* The part of the debt that has not reached an invoice yet */}
            {sums.aVencer > 0 && (
              <p className="relative mt-2.5 rounded-[18px] border border-white/[0.07] bg-white/[0.03] px-3.5 py-3 text-[12.5px] t-soft">
                <span className="font-semibold tabular-nums text-white">{fmt(sums.aVencer)}</span> em
                parcelas ainda a vencer, de {sums.compras}{" "}
                {sums.compras === 1 ? "compra parcelada" : "compras parceladas"}
              </p>
            )}

            {/* ── Limite, somando todos os cartões ── */}
            <div className="relative mt-4 border-t border-white/[0.07] pt-4">
              <div className="flex items-baseline justify-between">
                <span className="text-[12.5px] text-white/66">Limite usado</span>
                <span className={cn(
                  "text-[12.5px] font-semibold tabular-nums",
                  sums.usadoPct >= 100 ? "text-red-400" : sums.usadoPct >= 80 ? "text-willo-amber" : "text-white/82",
                )}>
                  {sums.usadoPct.toFixed(0)}%
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.07]">
                <motion.span
                  className="block h-full rounded-full"
                  style={{
                    background: sums.usadoPct >= 100 ? "#F87171" : sums.usadoPct >= 80 ? "#FBBF24" : "#FFFFFF",
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${sums.usadoPct}%` }}
                  transition={{ duration: 0.8, ease: "easeOut", delay: 0.15 }}
                />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[11.5px] t-soft">Usado</p>
                  <p className="text-[14px] font-semibold text-white tabular-nums">{fmt(sums.usado)}</p>
                </div>
                <div className="border-x border-white/[0.07]">
                  <p className="text-[11.5px] t-soft">Disponível</p>
                  <p className={cn(
                    "text-[14px] font-semibold tabular-nums",
                    sums.disponivel > 0 ? "text-willo-green-ink" : "text-red-400",
                  )}>
                    {fmt(sums.disponivel)}
                  </p>
                </div>
                <div>
                  <p className="text-[11.5px] t-soft">Total</p>
                  <p className="text-[14px] font-semibold text-white tabular-nums">{fmt(sums.limite)}</p>
                </div>
              </div>
            </div>
          </motion.section>

          {/* ══ The cards themselves ══════════════════════════════ */}
          <div className="mt-5 space-y-3">
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
                isPaid={!!r.open?.isPaid || (!r.open && r.total === 0)}
                onOpen={() => navigate(`/fatura/${r.card.id}`)}
                onHold={() => setHeldCard(r.card)}
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
