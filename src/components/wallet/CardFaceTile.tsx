import { motion } from "framer-motion";
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

/**
 * …except on a card that is itself green. PicPay and Inter bring their own greens, and
 * two greens side by side on one rule say nothing — so when the bank's hue comes near
 * ours, what is left is drawn in white instead. The rule still reads as a pair; only
 * which pair changes.
 */
export function freeToneFor(cardHex: string) {
  const n = cardHex.replace("#", "");
  const full = n.length === 3 ? n.split("").map((c) => c + c).join("") : n;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return FREE_LIMIT_HEX;
  const d = max - min;
  const hue =
    (max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
  const apart = Math.abs(hue - 80);
  return Math.min(apart, 360 - apart) < 85 ? "#FFFFFF" : FREE_LIMIT_HEX;
}

/**
 * Mixes a hex colour towards white (amount > 0) or black (amount < 0).
 *
 * Inside a single card, light and dark of the bank's own colour are the pair: used
 * against free, this invoice against the ones still coming. Two tones of one hue agree
 * with any bank — which a second hue, however well chosen, does not.
 */
export function shade(hex: string, amount: number) {
  const n = hex.replace("#", "");
  const full = n.length === 3 ? n.split("").map((c) => c + c).join("") : n;
  const to = amount < 0 ? 0 : 255;
  const t = Math.min(Math.abs(amount), 1);
  const mix = (c: number) => Math.round(c + (to - c) * t);
  const [r, g, b] = [0, 2, 4].map((i) => mix(parseInt(full.slice(i, i + 2), 16)));
  return `rgb(${r} ${g} ${b})`;
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

        {/* Where the invoice stands, as a mark rather than a sentence. */}
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-bold",
            owed <= 0
              ? "bg-willo-green/12 text-willo-green-ink"
              : status.isClosed
                ? "bg-white/[0.10] text-white/85"
                : "bg-white/[0.06] text-white/62",
          )}
        >
          {owed <= 0 ? "Em dia" : status.isClosed ? "Fechada" : "Aberta"}
        </span>
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

      {/* The same two tones as everywhere else: what is spent in the card's own
          colour, what is left in the green this app says every good number in. */}
      <div className="relative mt-4 flex h-[7px] gap-[3px]">
        <motion.span
          className="h-full rounded-full"
          style={{
            background: usedPct >= 100 ? "#F87171" : hex,
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
          Usado <span className="font-semibold tabular-nums text-white/75">{fmt(card.used)}</span>
        </span>
        <span className="shrink-0 truncate text-[11.5px] t-softer">
          Disponível{" "}
          <span
            className="font-semibold tabular-nums"
            style={{ color: available > 0 ? freeTone : "#F87171" }}
          >
            {fmt(available)}
          </span>
        </span>
      </div>
    </motion.div>
  );
}
