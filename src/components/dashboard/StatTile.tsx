import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * The summary tile. A dashboard of nothing but full-width cards reads as one long
 * column with no shape to it, so the summaries that are really a figure and a word
 * sit two to a row and let the cards that need the width keep it.
 *
 * The icon sits in a disc of its own rather than loose in the corner: on a tile with
 * a picture behind it a bare glyph has nothing to stand on, and the disc is what
 * makes four different tiles read as one family. The colour is the ring around that
 * disc and the rule along the bottom edge; the figure stays white, so the eye reads
 * the number first and the subject second.
 */

/** The disc the icon stands in. Shared so the wide tile is the same object, stretched. */
function TileBadge({ icon: Icon, accent, empty }: { icon: LucideIcon; accent: string; empty: boolean }) {
  return (
    <span
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/[0.07] ring-1"
      style={{ ["--tw-ring-color" as string]: accent + (empty ? "22" : "3d") }}
    >
      <Icon className="h-[21px] w-[21px]" style={{ color: accent, opacity: empty ? 0.45 : 1 }} strokeWidth={2.1} />
    </span>
  );
}

const SHELL =
  "relative flex w-full flex-col overflow-hidden rounded-[22px] border border-white/[0.08] willo-glass p-4 text-left transition-transform active:scale-[0.98]";

/** The rule along the bottom edge, drawn only when the tile is tracking something. */
function TileProgress({ progress, accent }: { progress: number; accent: string }) {
  return (
    <span className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-white/[0.06]">
      <motion.span
        className="block h-full"
        style={{ background: accent }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(Math.max(progress, 0), 1) * 100}%` }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      />
    </span>
  );
}

export function StatTile({ label, value, caption, icon, accent, progress, empty = false, onClick }: {
  label: string;
  value: string;
  caption?: string;
  icon: LucideIcon;
  /** Hex. Rings the disc and draws the rule; the figure stays white so the pair reads as one. */
  accent: string;
  /** 0–1. Drawn full-bleed along the bottom edge when the tile is tracking something. */
  progress?: number;
  /** Nothing to report yet. The tile stays, quieter: a hole in the row is worse than
      a tile saying there is nothing, and the row has to stay a row. */
  empty?: boolean;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className={cn(SHELL, "min-h-[176px] justify-between")}>
      <div className="flex items-start justify-between gap-2">
        <TileBadge icon={icon} accent={accent} empty={empty} />
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-white/25" />
      </div>

      <div className="mt-4">
        <p className="truncate text-[14px] font-medium text-white/50">{label}</p>
        <p className={cn(
          "mt-0.5 truncate text-[23px] font-extrabold leading-tight tracking-[-0.035em] tabular-nums",
          empty ? "text-white/35" : "text-white",
        )}>
          {value}
        </p>
        {/* Two lines, not one truncated: "0 assinaturas ativas · por mês" says nothing
            useful when it is cut after the third word. */}
        {caption && <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-white/40">{caption}</p>}
      </div>

      {progress !== undefined && <TileProgress progress={progress} accent={accent} />}
    </button>
  );
}

/**
 * The same tile across the full width, for a subject that is two figures rather than
 * one — money out and money in, which only mean something beside each other.
 */
export function StatTileWide({ label, icon, accent, columns, empty = false, onClick }: {
  label: string;
  icon: LucideIcon;
  accent: string;
  /** Two or three figures, read left to right. */
  columns: { label: string; value: string; caption?: string; tone?: "neutral" | "in" | "out" }[];
  empty?: boolean;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className={SHELL}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <TileBadge icon={icon} accent={accent} empty={empty} />
          <p className="text-[14px] font-medium text-white/50">{label}</p>
        </div>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-white/25" />
      </div>

      <div className="mt-4 grid gap-3" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
        {columns.map((col, i) => (
          <div key={col.label} className={cn("min-w-0", i > 0 && "border-l border-white/[0.07] pl-3")}>
            <p className="truncate text-[11.5px] font-medium text-white/42">{col.label}</p>
            <p className={cn(
              "mt-0.5 truncate text-[20px] font-extrabold leading-tight tracking-[-0.035em] tabular-nums",
              empty ? "text-white/35"
                : col.tone === "in" ? "text-willo-green-ink"
                : col.tone === "out" ? "text-[#F87171]"
                : "text-white",
            )}>
              {col.value}
            </p>
            {col.caption && <p className="mt-1 truncate text-[11.5px] text-white/40">{col.caption}</p>}
          </div>
        ))}
      </div>
    </button>
  );
}

/** Two tiles to a row, matched in height. */
export function TileRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-2 gap-3", className)}>{children}</div>;
}

export default StatTile;
