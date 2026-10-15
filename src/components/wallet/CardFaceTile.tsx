import { motion } from "framer-motion";
import { useLongPress } from "@/hooks/useLongPress";
import { getCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { shade, withAlpha } from "@/lib/tone";
import BankMark from "./BankMark";

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
 */
export const USED_LIMIT_HEX = "rgb(255 255 255 / 0.42)";
export const FREE_LIMIT_HEX = "#C8F36D";

export { shade, withAlpha } from "@/lib/tone";

/**
 * The badge that says where an invoice stands, in the card's own colour: a light
 * translucent fill with a deeper edge of the same hue. Grey said nothing and agreed
 * with nothing; this belongs to the card it sits on, whichever bank that is.
 */
export function statusPill(hex: string, strong = false) {
  return {
    background: withAlpha(hex, strong ? 0.26 : 0.16),
    boxShadow: `inset 0 0 0 1px ${withAlpha(shade(hex, -0.28), 0.95)}`,
    color: shade(hex, 0.66),
  };
}

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
  card, hex, owed, status, index, onOpen, onHold,
}: {
  card: CardFace;
  /** The bank's colour. */
  hex: string;
  /** What the open invoice asks for. */
  owed: number;
  /** Where that invoice stands, in words. */
  status: { label: string; isClosed: boolean };
  index: number;
  onOpen: () => void;
  onHold: () => void;
}) {
  const press = useLongPress(onHold);
  const usedPct = card.limit > 0 ? Math.min((card.used / card.limit) * 100, 100) : 0;
  const available = Math.max(card.limit - card.used, 0);
  const freeTone = shade(hex, 0.58);

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
      style={{
        background: "rgba(255, 255, 255, 0.055)",
        backdropFilter: "blur(26px) saturate(140%)",
        WebkitBackdropFilter: "blur(26px) saturate(140%)",
        boxShadow: "0 24px 50px -32px rgb(0 0 0 / 0.95), inset 0 1px 0 rgb(255 255 255 / 0.08)",
      }}
      className="relative cursor-pointer overflow-hidden rounded-[24px] border border-white/[0.10] px-[18px] pb-[18px] pt-[17px] transition-transform duration-200 active:scale-[0.985]"
    >
      {/* Glass and nothing else. The bank's colour appears three times — on its mark,
          on the limit rule and on the two figures under it — and those three are
          enough to tell one card from another without painting the whole thing. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-6 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)" }}
      />

      <div className="relative flex items-center gap-3">
        <BankMark name={card.name} hex={hex} />

        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-bold tracking-[-0.01em] text-white">{card.name}</p>
          <p className="truncate text-[11.5px] tabular-nums t-softer">
            •••• {card.lastFour ?? "••••"}
            <span className="text-white/20"> · </span>
            vence dia {card.dueDay}
          </p>
        </div>

        {/* Where the invoice stands, as a mark rather than a sentence. */}
        {owed <= 0 ? (
          <span className="shrink-0 rounded-full bg-willo-green/12 px-2.5 py-1 text-[10.5px] font-bold text-willo-green-ink">
            Em dia
          </span>
        ) : (
          <span
            className="shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-bold"
            style={statusPill(hex, status.isClosed)}
          >
            {status.isClosed ? "Fechada" : "Aberta"}
          </span>
        )}
      </div>

      <p className={cn(
        "relative mt-5 truncate text-[29px] font-extrabold leading-none tracking-[-0.035em] tabular-nums",
        owed > 0 ? "text-white" : "t-softer",
      )}>
        {fmt(owed)}
      </p>
      <p className="relative mt-1.5 truncate text-[12px] t-softer">
        {owed > 0 ? status.label : "Sem fatura em aberto"}
      </p>

      {/* The card's colour for what is spent, its lighter tone for what is left. */}
      <div className="relative mt-4 flex h-[7px] gap-[3px]">
        <motion.span
          className="h-full rounded-full"
          style={{
            background: hex,
            boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.25)",
            minWidth: card.used > 0 ? 6 : 0,
          }}
          initial={{ width: 0 }}
          animate={{ width: `${usedPct}%` }}
          transition={{ duration: 0.75, ease: "easeOut", delay: 0.1 + index * 0.07 }}
        />
        <motion.span
          className="h-full rounded-full"
          style={{
            background: freeTone,
            boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.35)",
            minWidth: available > 0 ? 6 : 0,
          }}
          initial={{ width: 0 }}
          animate={{ width: `${card.limit > 0 ? Math.max(100 - usedPct, 0) : 100}%` }}
          transition={{ duration: 0.75, ease: "easeOut", delay: 0.18 + index * 0.07 }}
        />
      </div>

      <div className="relative mt-2 flex items-baseline justify-between gap-3">
        <span className="truncate text-[11.5px] t-softer">
          Usado <span className="font-semibold tabular-nums" style={{ color: hex }}>{fmt(card.used)}</span>
        </span>
        <span className="shrink-0 truncate text-[11.5px] t-softer">
          Disponível{" "}
          <span
            className="font-semibold tabular-nums"
            style={{ color: available > 0 ? freeTone : "rgb(255 255 255 / 0.55)" }}
          >
            {fmt(available)}
          </span>
        </span>
      </div>
    </motion.div>
  );

}
