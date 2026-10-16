import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight, CreditCard } from "lucide-react";
import { useCardsOverview, monthKey } from "@/hooks/useCardsOverview";
import { getInvoiceStatusLabel, type CreditCardItem } from "@/components/wallet/CreditCardTile";
import BankMark from "@/components/wallet/BankMark";
import { colorFor } from "@/lib/banks";
import { shade } from "@/lib/tone";
import { getCurrency } from "@/lib/currency";
import { useHiddenValues } from "@/hooks/useHiddenValues";
import { cn } from "@/lib/utils";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });

/**
 * The cards, the way the balance card does the accounts.
 *
 * A single figure for "faturas" says what you owe without saying who to, which is the
 * part you act on — so each card gets its line: what its open invoice asks for, when
 * it falls due, and how much of its limit is still there. The bar above splits that
 * total the way it is actually split, each share in its bank's colour.
 */
export default function CartoesResumoCard() {
  const navigate = useNavigate();
  const hidden = useHiddenValues();
  const { cards, invoices, loading } = useCardsOverview();

  const rows = useMemo(() => {
    const now = new Date();
    const currentKey = monthKey(now.getFullYear(), now.getMonth() + 1);

    return cards.map((card) => {
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
        owed: open ? Math.max(open.total - open.paid, 0) : 0,
        available: Math.max(card.limit - card.used, 0),
        status: getInvoiceStatusLabel(
          item,
          open ? { amount: open.total, month: open.month, year: open.year, isPaid: open.isPaid } : undefined,
        ),
      };
    });
  }, [cards, invoices]);

  if (loading) {
    return <div className="h-[196px] animate-pulse rounded-[22px] border border-white/[0.08] willo-glass" />;
  }
  if (rows.length === 0) return null;

  const total = rows.reduce((s, r) => s + r.owed, 0);
  const value = (v: number) => (hidden ? "••••" : fmt(v));

  return (
    <button
      onClick={() => navigate("/cartoes")}
      className="block w-full rounded-[22px] border border-white/[0.08] willo-glass px-4 pb-4 pt-3.5 text-left transition-transform active:scale-[0.99]"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[14px] text-white/66">Cartões de crédito</p>
        <ChevronRight className="h-4 w-4 shrink-0 t-faint" />
      </div>

      <p className="mt-1 truncate text-[30px] font-extrabold leading-none tracking-[-0.03em] text-white tabular-nums">
        {value(total)}
      </p>
      <p className="mt-2 truncate text-[13px] t-soft">em faturas abertas</p>

      {/* One bar split by card: the share each takes of what is owed. */}
      <div className="mt-3.5 flex h-[7px] gap-[3px] overflow-hidden rounded-full">
        {total > 0 ? (
          rows.filter((r) => r.owed > 0).map((r, i) => (
            <motion.span
              key={r.card.id}
              className="h-full rounded-full"
              style={{ background: r.hex }}
              initial={{ flexGrow: 0 }}
              animate={{ flexGrow: r.owed / total }}
              transition={{ duration: 0.6, delay: 0.04 * i, ease: "easeOut" }}
            />
          ))
        ) : (
          <span className="h-full flex-1 rounded-full bg-white/[0.08]" />
        )}
      </div>

      <div className="mt-3.5 space-y-3 border-t border-white/[0.06] pt-3.5">
        {rows.map((r) => (
          <div key={r.card.id} className="flex items-center gap-3">
            <BankMark name={r.card.name} hex={r.hex} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium text-white">{r.card.name}</p>
              <p className="truncate text-[11.5px] t-softer">
                {r.owed > 0 ? r.status.label : "Sem fatura em aberto"}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className={cn(
                "text-[14px] font-semibold tabular-nums",
                r.owed > 0 ? "text-white" : "t-softer",
              )}>
                {value(r.owed)}
              </p>
              <p className="text-[11.5px] tabular-nums" style={{ color: shade(r.hex, 0.58) }}>
                {hidden ? "••••" : `${fmt(r.available)} livres`}
              </p>
            </div>
          </div>
        ))}
      </div>
    </button>
  );
}

/** The same subject at half width: one figure, and who it is split between. */
export function CartoesResumoTile() {
  const navigate = useNavigate();
  const hidden = useHiddenValues();
  const { cards, invoices, loading } = useCardsOverview();

  const { total, count } = useMemo(() => {
    const now = new Date();
    const currentKey = monthKey(now.getFullYear(), now.getMonth() + 1);
    const open = invoices.filter(
      (i) => !i.isPaid && i.total > 0 && monthKey(i.year, i.month) >= currentKey,
    );
    return {
      total: open.reduce((s, i) => s + Math.max(i.total - i.paid, 0), 0),
      count: cards.length,
    };
  }, [cards, invoices]);

  if (loading) {
    return <div className="h-[176px] animate-pulse rounded-[22px] border border-white/[0.08] willo-glass" />;
  }

  return (
    <button
      onClick={() => navigate("/cartoes")}
      className="relative flex min-h-[176px] w-full flex-col justify-between overflow-hidden rounded-[22px] border border-white/[0.08] willo-glass p-4 text-left transition-transform active:scale-[0.98]"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="truncate text-[14px] font-medium t-soft">Cartões de crédito</p>
        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-white/25" />
      </div>

      <div>
        <p className={cn(
          "truncate text-[23px] font-extrabold leading-tight tracking-[-0.035em] tabular-nums",
          total > 0 ? "text-white" : "t-faint",
        )}>
          {hidden ? "••••" : fmt(total)}
        </p>
        <p className="mt-1 line-clamp-2 text-[12px] leading-snug t-softer">
          {count === 0
            ? "Nenhum cartão cadastrado"
            : `em faturas abertas · ${count} ${count === 1 ? "cartão" : "cartões"}`}
        </p>
      </div>

      <CreditCard className="pointer-events-none absolute -bottom-3 -right-2 h-20 w-20 text-white/[0.03]" />
    </button>
  );
}
