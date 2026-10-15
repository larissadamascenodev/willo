import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useLongPress } from "@/hooks/useLongPress";
import { getCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";

/**
 * One card, as an object you recognise.
 *
 * It is dark like everything else, because a screen full of saturated plastic is a
 * screen you cannot read; the bank's colour appears only as light inside the glass and
 * on the chip, which is enough to tell two cards apart before a word is read. The
 * figure is what this card is asking for, and the rule underneath is how much of it is
 * already spent — the two things that make you open a card in the first place.
 */

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });

/**
 * Spent and free, in the two colours the app owns.
 *
 * A wallet holds a Nubank and an Inter and a Caixa, and no single bank hue sits well
 * beside all three — so anything speaking for the cards as a group uses Willo's own
 * colours instead, and the bank colour stays on the card it belongs to. Grey was tried
 * first and sank into the ground: on a near-black page a neutral has to be lit to be
 * seen at all. So the dim half is white held back, and the half that matters — the
 * room you still have — is the green this app says every good number in.
 * Red is kept for having none left.
 */
export const USED_LIMIT_HEX = "rgb(255 255 255 / 0.42)";
export const FREE_LIMIT_HEX = "#C8F36D";

export interface CardFace {
  id: string;
  name: string;
  lastFour: string | null;
  closingDay: number;
  dueDay: number;
  limit: number;
  used: number;
}

export default function CardFaceTile({
  card, hex, owed, status, isPaid, index, onOpen, onHold,
}: {
  card: CardFace;
  /** The bank's colour. */
  hex: string;
  /** What the open invoice asks for. */
  owed: number;
  /** Where that invoice stands, in words. */
  status: { label: string; isClosed: boolean };
  isPaid: boolean;
  index: number;
  onOpen: () => void;
  onHold: () => void;
}) {
  const press = useLongPress(onHold);
  const usedPct = card.limit > 0 ? Math.min((card.used / card.limit) * 100, 100) : 0;
  const available = Math.max(card.limit - card.used, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      onPointerDown={press.onPointerDown}
      onPointerMove={press.onPointerMove}
      onPointerUp={press.onPointerUp}
      onPointerCancel={press.onPointerCancel}
      onPointerLeave={press.onPointerLeave}
      onContextMenu={(e) => e.preventDefault()}
      onClick={press.guard(onOpen)}
      style={{ boxShadow: "0 24px 50px -32px rgb(0 0 0 / 0.95), inset 0 1px 0 rgb(255 255 255 / 0.07)" }}
      className="relative cursor-pointer overflow-hidden rounded-[24px] border border-white/[0.09] willo-glass px-[18px] pb-[18px] pt-[17px] transition-transform duration-200 active:scale-[0.985]"
    >
      {/* The card's colour as light inside the glass, never as a field of paint */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -left-16 -top-24 h-52 w-60 rounded-full blur-[52px]"
        style={{ background: hex, opacity: 0.26 }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-20 -right-14 h-44 w-44 rounded-full blur-[54px]"
        style={{ background: hex, opacity: 0.12 }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-6 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)" }}
      />

      <div className="relative flex items-center gap-3">
        {/* the chip, in the bank's colour */}
        <span
          className="relative flex h-[30px] w-[38px] shrink-0 overflow-hidden rounded-[8px]"
          style={{
            background: `linear-gradient(145deg, color-mix(in srgb, ${hex}, #fff 22%) 0%, ${hex} 58%, color-mix(in srgb, ${hex}, #000 28%) 100%)`,
            boxShadow: `0 8px 20px -10px ${hex}, inset 0 1px 0 rgb(255 255 255 / 0.35)`,
          }}
        >
          <span className="absolute inset-x-[6px] top-1/2 h-px -translate-y-1/2 bg-black/25" />
          <span className="absolute inset-y-[6px] left-1/2 w-px -translate-x-1/2 bg-black/25" />
          <span className="absolute inset-y-[6px] left-[11px] w-px bg-black/15" />
          <span className="absolute inset-y-[6px] right-[11px] w-px bg-black/15" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-bold tracking-[-0.01em] text-white">{card.name}</p>
          <p className="truncate text-[11.5px] tabular-nums t-softer">
            •••• {card.lastFour ?? "••••"}
            <span className="text-white/20"> · </span>
            vence dia {card.dueDay}
          </p>
        </div>

        <ChevronRight className="h-[18px] w-[18px] shrink-0 t-faint" />
      </div>

      <p className="relative mt-4 truncate text-[12.5px] t-softer">
        {isPaid ? "Fatura paga" : status.isClosed ? "Fatura fechada" : "Fatura aberta"}
        <span className="text-white/20"> · </span>
        <span className={cn(status.isClosed && !isPaid && "font-semibold text-amber-300/90")}>
          {status.label.toLowerCase()}
        </span>
      </p>
      <p className={cn(
        "relative mt-0.5 truncate text-[28px] font-extrabold leading-none tracking-[-0.035em] tabular-nums",
        owed > 0 ? "text-white" : "t-softer",
      )}>
        {fmt(owed)}
      </p>

      <div
        className="relative mt-4 h-[6px] overflow-hidden rounded-full bg-white/[0.07]"
        style={{ boxShadow: "inset 0 1px 1px rgb(0 0 0 / 0.35)" }}
      >
        <motion.span
          className="block h-full rounded-full"
          style={{
            background: usedPct >= 100 ? "#F87171" : hex,
            boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.30)",
          }}
          initial={{ width: 0 }}
          animate={{ width: `${usedPct}%` }}
          transition={{ duration: 0.75, ease: "easeOut", delay: 0.1 + index * 0.07 }}
        />
      </div>

      <div className="relative mt-2 flex items-baseline justify-between gap-3">
        <span className="truncate text-[11.5px] t-softer">
          Usado <span className="font-semibold tabular-nums text-white/75">{fmt(card.used)}</span>
        </span>
        <span className="shrink-0 truncate text-[11.5px] t-softer">
          Disponível{" "}
          <span
            className="font-semibold tabular-nums"
            style={{ color: available > 0 ? FREE_LIMIT_HEX : "#F87171" }}
          >
            {fmt(available)}
          </span>
        </span>
      </div>
    </motion.div>
  );
}
