import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * The half-width tile. A dashboard of nothing but full-width cards reads as one long
 * column with no shape to it, so the summaries that are really a figure and a word
 * sit two to a row and let the cards that need the width keep it.
 *
 * Each tile is lit from its own corner in its own colour, and carries its measure as
 * a rule along the bottom edge rather than a bar stacked inside the text — four
 * identical grey boxes with four identical grey bars is a table, not a dashboard.
 */
export function StatTile({ label, value, caption, icon: Icon, accent, progress, empty = false, onClick }: {
  label: string;
  value: string;
  caption?: string;
  icon: LucideIcon;
  /** Hex. Lights the corner and the rule; the figure stays white so the pair reads as one. */
  accent: string;
  /** 0–1. Drawn full-bleed along the bottom edge when the tile is tracking something. */
  progress?: number;
  /** Nothing to report yet. The tile stays, quieter: a hole in the row is worse than
      a tile saying there is nothing, and the row has to stay a row. */
  empty?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="relative flex min-h-[132px] w-full flex-col justify-between overflow-hidden rounded-[22px] border border-white/[0.08] willo-glass px-4 pb-4 pt-4 text-left transition-transform active:scale-[0.98]"
    >
      {/* The colour arrives as light off the icon rather than as a badge around it */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -left-10 -top-10 h-28 w-28 rounded-full blur-2xl"
        style={{ background: accent, opacity: empty ? 0.05 : 0.16 }}
      />

      <div className="relative flex items-start justify-between gap-2">
        <Icon className="h-[19px] w-[19px]" style={{ color: accent, opacity: empty ? 0.4 : 1 }} strokeWidth={2.2} />
        <ChevronRight className="h-4 w-4 shrink-0 text-white/22" />
      </div>

      <div className="relative mt-4">
        <p className="truncate text-[10.5px] font-semibold uppercase tracking-[0.13em] text-white/45">{label}</p>
        <p className={cn(
          "mt-1.5 truncate text-[20px] font-extrabold leading-none tracking-[-0.035em] tabular-nums",
          empty ? "text-white/30" : "text-white",
        )}>
          {value}
        </p>
        {caption && <p className="mt-1.5 truncate text-[11px] text-white/42">{caption}</p>}
      </div>

      {progress !== undefined && (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-white/[0.06]">
          <motion.span
            className="block h-full"
            style={{ background: accent }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(Math.max(progress, 0), 1) * 100}%` }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          />
        </span>
      )}
    </button>
  );
}

/** Two tiles to a row, matched in height. */
export function TileRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-2 gap-3", className)}>{children}</div>;
}

export default StatTile;
