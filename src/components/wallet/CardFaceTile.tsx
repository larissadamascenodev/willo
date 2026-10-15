import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useLongPress } from "@/hooks/useLongPress";
import { getCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";

/**
 * A card that looks like a card.
 *
 * A list row can tell you a number, but it cannot be recognised — and recognising the
 * card is the whole first step of "quanto estou devendo no Nubank". So the top of the
 * tile is the plastic itself, in the bank's own colour, with the chip and the last four
 * digits where they sit on the real thing; the glass underneath carries what the plastic
 * never shows you: what this one is asking for, and how much of it is already spent.
 */

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });

/** Mixes a hex colour towards black (amount < 0) or white (amount > 0). */
function shade(hex: string, amount: number) {
  const n = hex.replace("#", "");
  const full = n.length === 3 ? n.split("").map((c) => c + c).join("") : n;
  const to = amount < 0 ? 0 : 255;
  const t = Math.abs(amount);
  const mix = (c: number) => Math.round(c + (to - c) * t);
  const r = mix(parseInt(full.slice(0, 2), 16));
  const g = mix(parseInt(full.slice(2, 4), 16));
  const b = mix(parseInt(full.slice(4, 6), 16));
  return `rgb(${r} ${g} ${b})`;
}

/** Ink that stays readable on the card's own colour — some banks are yellow. */
function inkOn(hex: string) {
  const n = hex.replace("#", "");
  const full = n.length === 3 ? n.split("").map((c) => c + c).join("") : n;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.6 ? "#101014" : "#FFFFFF";
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
  card, hex, owed, status, isPaid, index, onOpen, onHold,
}: {
  card: CardFace;
  /** The bank's colour. */
  hex: string;
  /** What the open invoice still asks for. */
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
  const ink = inkOn(hex);
  const tight = usedPct >= 80;

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
      className="cursor-pointer overflow-hidden rounded-[26px] border border-white/[0.09] willo-glass transition-transform duration-200 active:scale-[0.985]"
    >
      {/* ── The plastic ───────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden px-[18px] pb-[15px] pt-[17px]"
        style={{
          background:
            `radial-gradient(120% 100% at 8% 0%, ${shade(hex, 0.22)} 0%, transparent 58%),` +
            `linear-gradient(142deg, ${shade(hex, 0.06)} 0%, ${hex} 44%, ${shade(hex, -0.42)} 100%)`,
          color: ink,
        }}
      >
        {/* A band of light across the plastic, and a hairline on the top edge */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -inset-y-10 -left-8 w-24 -rotate-[24deg]"
          style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.14), transparent)" }}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)" }}
        />

        <div className="relative flex items-start justify-between gap-3">
          {/* chip, with its contacts */}
          <span
            className="relative h-[29px] w-[37px] shrink-0 overflow-hidden rounded-[7px]"
            style={{
              background: "linear-gradient(140deg, rgba(255,255,255,0.60), rgba(255,255,255,0.22))",
              boxShadow: `inset 0 1px 1px rgba(255,255,255,0.5), inset 0 0 0 1px ${ink}29`,
            }}
          >
            {/* the contacts, in the pattern they are actually laid out in */}
            <span className="absolute inset-x-[6px] top-1/2 h-px -translate-y-1/2" style={{ background: `${ink}47` }} />
            <span className="absolute inset-y-[5px] left-1/2 w-px -translate-x-1/2" style={{ background: `${ink}47` }} />
            <span className="absolute inset-y-[5px] left-[10px] w-px" style={{ background: `${ink}2E` }} />
            <span className="absolute inset-y-[5px] right-[10px] w-px" style={{ background: `${ink}2E` }} />
          </span>

          <p className="truncate text-[15.5px] font-bold tracking-[-0.01em]">{card.name}</p>
        </div>

        <div className="relative mt-[26px] flex items-end justify-between gap-3">
          <p className="text-[15px] font-semibold tabular-nums tracking-[0.14em]" style={{ opacity: 0.92 }}>
            ••••&nbsp;{card.lastFour ?? "••••"}
          </p>
          {/* The face says when it is due; the glass below says where it stands. */}
          <p className="shrink-0 text-[11.5px] font-medium tabular-nums" style={{ opacity: 0.75 }}>
            Vence dia {card.dueDay}
          </p>
        </div>
      </div>

      {/* ── What it is asking for ─────────────────────────────────── */}
      <div className="px-[18px] pb-[18px] pt-3.5">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[12px] t-softer">
              {isPaid ? "Fatura paga" : status.isClosed ? "Fatura fechada" : "Fatura aberta"}
              <span className="text-white/25"> · </span>
              <span className={cn(status.isClosed && !isPaid && "font-semibold text-amber-300/90")}>
                {status.label.toLowerCase()}
              </span>
            </p>
            <p className={cn(
              "mt-0.5 truncate text-[26px] font-extrabold leading-none tracking-[-0.035em] tabular-nums",
              owed > 0 ? "text-white" : "t-softer",
            )}>
              {fmt(owed)}
            </p>
          </div>
          <ChevronRight className="mb-1 h-[18px] w-[18px] shrink-0 t-faint" />
        </div>

        <div className="mt-4 h-[5px] overflow-hidden rounded-full bg-white/[0.09]">
          <motion.span
            className="block h-full rounded-full"
            style={{ background: usedPct >= 100 ? "#F87171" : tight ? "#FBBF24" : hex }}
            initial={{ width: 0 }}
            animate={{ width: `${usedPct}%` }}
            transition={{ duration: 0.75, ease: "easeOut", delay: 0.1 + index * 0.07 }}
          />
        </div>

        <div className="mt-2 flex items-baseline justify-between gap-3">
          <span className="truncate text-[11.5px] t-softer">
            Usado <span className="font-semibold tabular-nums text-white/75">{fmt(card.used)}</span>
          </span>
          <span className="shrink-0 truncate text-[11.5px] t-softer">
            Disponível{" "}
            <span className={cn(
              "font-semibold tabular-nums",
              available > 0 ? "text-willo-green-ink" : "text-red-400",
            )}>
              {fmt(available)}
            </span>
          </span>
        </div>
      </div>
    </motion.div>
  );
}
