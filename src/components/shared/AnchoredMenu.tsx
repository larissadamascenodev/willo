import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A menu for the thing under your thumb.
 *
 * A sheet is a place you go to; this is something you do to what you are already
 * holding, so it opens beside it and the page behind it blurs. It places itself —
 * under the thing when there is room, over it when there is not, pulled in from the
 * edges — because the thing held can be anywhere on the screen.
 */

export interface AnchorRect {
  top: number;
  bottom: number;
  left: number;
  width: number;
}

const MARGIN = 12;

export default function AnchoredMenu({ open, anchor, width = 252, onClose, children }: {
  open: boolean;
  /** Where the held thing is. Without one the menu sits in the middle of the screen. */
  anchor?: AnchorRect | null;
  width?: number;
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) { setPos(null); return; }
    const height = panelRef.current?.offsetHeight ?? 200;
    if (!anchor) {
      setPos({
        left: Math.max((window.innerWidth - width) / 2, MARGIN),
        top: Math.max((window.innerHeight - height) / 2, MARGIN),
      });
      return;
    }
    const left = Math.min(Math.max(anchor.left, MARGIN), window.innerWidth - width - MARGIN);
    const below = anchor.bottom + 10;
    const top = below + height + MARGIN < window.innerHeight
      ? below
      : Math.max(anchor.top - height - 10, MARGIN);
    setPos({ left, top });
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
            className="absolute inset-0 bg-black/45 backdrop-blur-[18px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />

          <motion.div
            ref={panelRef}
            role="menu"
            initial={{ opacity: 0, scale: 0.92, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ type: "spring", stiffness: 460, damping: 32 }}
            className="absolute overflow-hidden rounded-[22px] border border-white/[0.10]"
            style={{
              width,
              left: pos?.left ?? MARGIN,
              top: pos?.top ?? MARGIN,
              transformOrigin: "50% 0%",
              background: "rgba(28, 28, 31, 0.78)",
              backdropFilter: "blur(30px) saturate(150%)",
              WebkitBackdropFilter: "blur(30px) saturate(150%)",
              boxShadow: "0 30px 60px -20px rgb(0 0 0 / 0.9), inset 0 1px 0 rgb(255 255 255 / 0.10)",
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
