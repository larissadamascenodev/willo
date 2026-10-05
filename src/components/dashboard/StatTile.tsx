import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * The half-width tile. A dashboard of nothing but full-width cards reads as one
 * long column with no shape to it, so the summaries that are really just a figure
 * and a word sit two to a row and let the cards that need the width keep it.
 *
 * Every tile keeps the same skeleton — mark, label, figure, caption — so a row of
 * two reads as a pair rather than as two unrelated boxes.
 */
export function StatTile({ label, value, caption, icon: Icon, accent, progress, onClick }: {
  label: string;
  value: string;
  caption?: string;
  icon: LucideIcon;
  /** Hex for the mark; the figure itself stays white so the row keeps one voice. */
  accent: string;
  /** 0–1. Draws a hairline under the figure when the tile is tracking something. */
  progress?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex min-h-[138px] w-full flex-col justify-between rounded-[22px] border border-white/[0.08] willo-glass px-3.5 pb-3.5 pt-3.5 text-left transition-transform active:scale-[0.98]"
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{ background: `${accent}22` }}
        >
          <Icon className="h-[17px] w-[17px]" style={{ color: accent }} strokeWidth={2.1} />
        </span>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-white/25" />
      </div>

      <div className="mt-3">
        <p className="truncate text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white/45">{label}</p>
        <p className="mt-1.5 truncate text-[19px] font-extrabold leading-none tracking-[-0.03em] tabular-nums text-white">
          {value}
        </p>

        {progress !== undefined && (
          <div className="mt-2.5 h-[3px] overflow-hidden rounded-full bg-white/[0.07]">
            <motion.span
              className="block h-full rounded-full"
              style={{ background: accent }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(Math.max(progress, 0), 1) * 100}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
        )}

        {caption && (
          <p className={cn("truncate text-[11px] text-white/45", progress !== undefined ? "mt-2" : "mt-1.5")}>
            {caption}
          </p>
        )}
      </div>
    </button>
  );
}

/** Two tiles to a row, matched in height. */
export function TileRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

export default StatTile;
