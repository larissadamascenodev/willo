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
 * Arriving here there are two questions, in this order: what do all of these add up
 * to, and which card do I want. So the total is the first thing on the page, with
 * nothing drawn around it, and under it one panel that breaks that total down — by
 * card, against the limit, and into what is still coming in instalments. Then the
 * cards themselves, as the way in.
 *
 * Every figure is the open invoice, the one still to be paid. A credit card is a bill,
 * not a history.
 */

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });
const MONTH_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

interface CardRow {
  card: OverviewCard;
  hex: string;
  open: OverviewInvoice | null;
  total: number;
  paid: number;
  status: { label: string; isClosed: boolean };
}

/** The share of the limit that is spent, drawn as an arc rather than another bar. */
function LimitGauge({ pct, available, used, limit }: {
  pct: number;
  available: number;
  used: number;
  limit: number;
}) {
  const tone = pct >= 100 ? "#F87171" : pct >= 80 ? "#FBBF24" : "#FFFFFF";
  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg viewBox="0 0 160 88" className="w-[190px]" aria-hidden="true">
          <path
            d="M 12 80 A 68 68 0 0 1 148 80"
            fill="none"
            stroke="rgb(255 255 255 / 0.09)"
            strokeWidth="11"
            strokeLinecap="round"
          />
          <motion.path
            d="M 12 80 A 68 68 0 0 1 148 80"
            fill="none"
            stroke={tone}
            strokeWidth="11"
            strokeLinecap="round"
            pathLength={1}
            initial={{ strokeDasharray: "0 1" }}
            animate={{ strokeDasharray: `${Math.min(pct, 100) / 100} 1` }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          />
        </svg>

        <div className="absolute inset-x-0 bottom-1 flex flex-col items-center">
          <p className={cn(
            "text-[22px] font-extrabold leading-none tracking-[-0.03em] tabular-nums",
            available > 0 ? "text-white" : "text-red-400",
          )}>
            {fmt(available)}
          </p>
          <p className="mt-1 text-[11.5px] t-softer">disponível</p>
        </div>
      </div>

      <div className="mt-1 flex w-full items-baseline justify-between gap-3">
        <span className="truncate text-[11.5px] t-softer">
          Usado <span className="font-semibold tabular-nums text-white/75">{fmt(used)}</span>
        </span>
        <span className="shrink-0 truncate text-[11.5px] t-softer">
          Limite <span className="font-semibold tabular-nums text-white/75">{fmt(limit)}</span>
        </span>
      </div>
    </div>
  );
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
        status: getInvoiceStatusLabel(
          item,
          open ? { amount: open.total, month: open.month, year: open.year, isPaid: open.isPaid } : undefined,
        ),
      };
    });
  }, [cards, invoices]);

  const sums = useMemo(() => {
    const now = new Date();
    const currentKey = monthKey(now.getFullYear(), now.getMonth() + 1);
    const ahead = installments.filter((i) => monthKey(i.year, i.month) >= currentKey);

    /* The strip starts at the invoice that is open, not at the calendar month: past the
       closing day those are different, and an empty October at the head of the run says
       nothing about what is coming. */
    const openKeys = rows.map((r) => (r.open ? monthKey(r.open.year, r.open.month) : null));
    const firstKey = Math.min(...openKeys.filter((k): k is number => k !== null), currentKey + 1);

    /* What the next six invoices already carry in instalments, before a single new
       purchase — the part of next month that is decided before it starts. */
    const load = Array.from({ length: 6 }, (_, k) => {
      const key = firstKey + k;
      const y = Math.floor(key / 12);
      const m = (key % 12) + 1;
      return {
        key,
        label: MONTH_SHORT[m - 1],
        amount: ahead
          .filter((i) => monthKey(i.year, i.month) === key)
          .reduce((s, i) => s + i.amount, 0),
      };
    });

    const faturas = rows.reduce((s, r) => s + r.total, 0);
    const pago = rows.reduce((s, r) => s + r.paid, 0);
    const limite = rows.reduce((s, r) => s + r.card.limit, 0);
    const usado = rows.reduce((s, r) => s + r.card.used, 0);
    const lastKey = ahead.length ? Math.max(...ahead.map((i) => monthKey(i.year, i.month))) : null;

    return {
      faturas,
      pago,
      restante: Math.max(faturas - pago, 0),
      maior: Math.max(...rows.map((r) => r.total), 1),
      aVencer: ahead.reduce((s, i) => s + i.amount, 0),
      compras: new Set(ahead.map((i) => i.groupId)).size,
      horizonte: lastKey === null
        ? null
        : `${MONTH_SHORT[lastKey % 12]}/${String(Math.floor(lastKey / 12)).slice(2)}`,
      load,
      limite,
      usado,
      disponivel: Math.max(limite - usado, 0),
      usadoPct: limite > 0 ? Math.min((usado / limite) * 100, 100) : 0,
    };
  }, [rows, installments]);

  const maxLoad = Math.max(...sums.load.map((l) => l.amount), 1);

  return (
    <div className="mx-auto max-w-lg pb-28">
      <div className="flex h-11 items-center">
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
          {/* ══ The figure itself, with nothing drawn around it ══ */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="px-1 pt-3"
          >
            <p className="text-[13.5px] text-white/62">Total em faturas</p>
            <p className="mt-1 truncate text-[40px] font-extrabold leading-none tracking-[-0.04em] text-white tabular-nums">
              {fmt(sums.faturas)}
            </p>
            <p className="mt-2.5 text-[12.5px] t-soft">
              {rows.length} {rows.length === 1 ? "cartão" : "cartões"}
              {sums.pago > 0 && (
                <>
                  <span className="text-white/20"> · </span>
                  <span className="tabular-nums text-willo-green-ink">{fmt(sums.pago)} já pagos</span>
                  <span className="text-white/20"> · </span>
                  <span className="tabular-nums">restam {fmt(sums.restante)}</span>
                </>
              )}
            </p>
          </motion.div>

          {/* ══ That total, taken apart ══ */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="mt-5 rounded-[24px] border border-white/[0.08] willo-glass px-5 py-4"
          >
            {/* — por cartão — */}
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.12em] t-softer">Por cartão</p>
            <div className="mt-3 space-y-3.5">
              {rows.map((r, i) => (
                <div key={r.card.id}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-[14px] font-medium text-white">{r.card.name}</span>
                    <span className="shrink-0 text-[14.5px] font-semibold tabular-nums text-white">
                      {fmt(r.total)}
                    </span>
                  </div>
                  <div className="mt-2 h-[6px] overflow-hidden rounded-full bg-white/[0.06]">
                    <motion.span
                      className="block h-full rounded-full"
                      style={{ background: r.hex }}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max((r.total / sums.maior) * 100, r.total > 0 ? 4 : 0)}%` }}
                      transition={{ duration: 0.6, delay: 0.08 + i * 0.07, ease: "easeOut" }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* — limite, somando os cartões — */}
            <div className="mt-5 border-t border-white/[0.07] pt-4">
              <p className="text-[11.5px] font-semibold uppercase tracking-[0.12em] t-softer">Limite</p>
              <div className="mt-1">
                <LimitGauge
                  pct={sums.usadoPct}
                  available={sums.disponivel}
                  used={sums.usado}
                  limit={sums.limite}
                />
              </div>
            </div>

            {/* — o que já está comprometido em parcelas — */}
            {sums.aVencer > 0 && (
              <div className="mt-4 border-t border-white/[0.07] pt-4">
                <div className="flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11.5px] font-semibold uppercase tracking-[0.12em] t-softer">
                      Parcelamentos
                    </p>
                    <p className="mt-1.5 truncate text-[21px] font-extrabold leading-none tracking-[-0.03em] text-white tabular-nums">
                      {fmt(sums.aVencer)}
                    </p>
                  </div>
                  <p className="shrink-0 text-right text-[11.5px] leading-tight t-faint">
                    {sums.compras} {sums.compras === 1 ? "compra" : "compras"}
                    {sums.horizonte && (
                      <>
                        <br />
                        até {sums.horizonte}
                      </>
                    )}
                  </p>
                </div>

                {/* The next six months, as the instalments already owe them */}
                <div className="mt-3.5 flex items-end gap-1.5">
                  {sums.load.map((l, i) => (
                    <div key={l.key} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                      <span className="flex h-[38px] w-full items-end">
                        <motion.span
                          className={cn(
                            "w-full rounded-[5px]",
                            i === 0 ? "bg-white/80" : "bg-white/[0.18]",
                          )}
                          initial={{ height: 0 }}
                          animate={{ height: `${l.amount > 0 ? Math.max((l.amount / maxLoad) * 100, 8) : 3}%` }}
                          transition={{ duration: 0.5, delay: 0.1 + i * 0.04, ease: "easeOut" }}
                        />
                      </span>
                      <span className="text-[10px] t-faint">{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.section>

          {/* ══ The cards ══ */}
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
