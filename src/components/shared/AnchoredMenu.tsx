import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A menu for the thing under your thumb.
 *
 * A sheet is a place you go to; this is something you do to what you are already
 * holding, so it opens beside it and the page behind it steps back. It places itself —
 * under the thing when there is room, over it when there is not — because the thing
 * held can be anywhere on the screen.
 *
 * Two things are deliberate about how it sits. The page is dimmed more than it is
 * blurred: a heavy blur turned the screen to soup and the menu lost the one thing an
 * anchored menu is for, which is still being able to see what you are holding. And it
 * centres on the middle of what is held rather than lining up with its left edge — a
 * full-width row starts at the page gutter, so left-aligning left the menu pinned to
 * one side of the screen with a third of it empty.
 */

export interface AnchorRect {
  top: number;
  bottom: number;
  left: number;
  width: number;
}

const MARGIN = 14;

export default function AnchoredMenu({ open, anchor, width = 258, onClose, children }: {
  open: boolean;
  /** Where the held thing is. Without one the menu sits in the middle of the screen. */
  anchor?: AnchorRect | null;
  width?: number;
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; from: "top" | "bottom" } | null>(null);

  useLayoutEffect(() => {
    if (!open) { setPos(null); return; }
    const height = panelRef.current?.offsetHeight ?? 200;
    const span = Math.min(width, window.innerWidth - MARGIN * 2);

    if (!anchor) {
      setPos({
        left: Math.max((window.innerWidth - span) / 2, MARGIN),
        top: Math.max((window.innerHeight - height) / 2, MARGIN),
        from: "top",
      });
      return;
    }

    /* Centred on what is held, then pulled back inside the screen. */
    const wanted = anchor.left + anchor.width / 2 - span / 2;
    const left = Math.min(Math.max(wanted, MARGIN), window.innerWidth - span - MARGIN);

    const below = anchor.bottom + 10;
    const fitsBelow = below + height + MARGIN < window.innerHeight;
    const top = fitsBelow ? below : Math.max(anchor.top - height - 10, MARGIN);
    setPos({ left, top, from: fitsBelow ? "top" : "bottom" });
  }, [open, anchor, width, children]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const content = (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[74]">
          <motion.div
            className="absolute inset-0 bg-black/58 backdrop-blur-[5px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={onClose}
          />

          <motion.div
            ref={panelRef}
            role="menu"
            initial={{ opacity: 0, scale: 0.93 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 480, damping: 34 }}
            className="absolute overflow-hidden rounded-[22px] border border-white/[0.10]"
            style={{
              width: Math.min(width, window.innerWidth - MARGIN * 2),
              left: pos?.left ?? MARGIN,
              top: pos?.top ?? MARGIN,
              transformOrigin: pos?.from === "bottom" ? "50% 100%" : "50% 0%",
              background: "rgba(30, 30, 33, 0.86)",
              backdropFilter: "blur(26px) saturate(150%)",
              WebkitBackdropFilter: "blur(26px) saturate(150%)",
              boxShadow: "0 28px 56px -18px rgb(0 0 0 / 0.86), inset 0 1px 0 rgb(255 255 255 / 0.10)",
              visibility: pos ? "visible" : "hidden",
            }}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return typeof document !== "undefined" ? createPortal(content, document.body) : null;
}

/** One line of a menu: a glyph, a word, and nothing else. */
export function MenuRow({ icon: Icon, label, danger, onClick }: {
  icon: LucideIcon;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-3 border-b border-white/[0.06] px-4 py-3 text-left transition-colors last:border-b-0 active:bg-white/[0.07]"
    >
      <Icon
        className={cn("h-[18px] w-[18px] shrink-0", danger ? "text-red-400" : "text-white/85")}
        strokeWidth={2}
      />
      <span className={cn("text-[15px] font-medium", danger ? "text-red-400" : "text-white")}>
        {label}
      </span>
    </button>
  );
}

/** The header every anchored menu wears: what you are holding, and what it is. */
export function MenuHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="border-b border-white/[0.08] px-4 pb-2.5 pt-3">
      <p className="truncate text-[13.5px] font-semibold text-white">{title}</p>
      {subtitle && <p className="mt-0.5 truncate text-[11.5px] t-softer">{subtitle}</p>}
    </div>
  );
}
