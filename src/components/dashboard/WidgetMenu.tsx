import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, EyeOff, Pencil, RectangleHorizontal, Square, Trash2 } from "lucide-react";
import { useHiddenValues, setHiddenValues } from "@/hooks/useHiddenValues";
import { cn } from "@/lib/utils";
import type { WidgetSize } from "@/lib/homeWidgets";

/**
 * What can be done to the card you are holding.
 *
 * It opens where the card is, not from the bottom of the screen: a sheet is a place
 * you go to, and this is a thing you do to something already under your thumb. The
 * page behind it blurs so the menu is the only thing in focus, and the card keeps its
 * position, so letting go lands you back exactly where you were.
 */

const WIDTH = 252;
const MARGIN = 12;

export interface WidgetMenuTarget {
  id: string;
  label: string;
  description: string;
  size: WidgetSize;
  resizable: boolean;
  /** Where the card is, so the menu opens beside it. */
  rect: { top: number; bottom: number; left: number; width: number };
}

export default function WidgetMenu({ target, onClose, onEdit, onResize, onRemove }: {
  target: WidgetMenuTarget | null;
  onClose: () => void;
  onEdit: () => void;
  onResize: (size: WidgetSize) => void;
  onRemove: () => void;
}) {
  const hidden = useHiddenValues();
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!target) { setPos(null); return; }
    const height = panelRef.current?.offsetHeight ?? 220;
    const left = Math.min(
      Math.max(target.rect.left, MARGIN),
      window.innerWidth - WIDTH - MARGIN,
    );
    /* Under the card when there is room for it, over it when there is not. */
    const below = target.rect.bottom + 10;
    const top = below + height + MARGIN < window.innerHeight
      ? below
      : Math.max(target.rect.top - height - 10, MARGIN);
    setPos({ left, top });
  }, [target]);

  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [target, onClose]);

  const content = (
    <AnimatePresence>
      {target && (
        <div className="fixed inset-0 z-[70]">
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
              width: WIDTH,
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
            <Row
              icon={hidden ? Eye : EyeOff}
              label={hidden ? "Mostrar dados" : "Ocultar dados"}
              onClick={() => { setHiddenValues(!hidden); onClose(); }}
            />
            <Row icon={Pencil} label="Editar widgets" onClick={onEdit} />
            <Row icon={Trash2} label="Remover" danger onClick={onRemove} />

            {target.resizable && (
              <div className="flex items-center justify-center gap-2 border-t border-white/[0.08] px-3 py-2.5">
                <SizeButton
                  icon={Square}
                  active={target.size === "half"}
                  label="Metade da linha"
                  onClick={() => onResize("half")}
                />
                <SizeButton
                  icon={RectangleHorizontal}
                  active={target.size === "full"}
                  label="Linha inteira"
                  onClick={() => onResize("full")}
                />
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return typeof document !== "undefined" ? createPortal(content, document.body) : null;
}

function Row({ icon: Icon, label, danger, onClick }: {
  icon: typeof Pencil;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-white/[0.07]",
        "border-b border-white/[0.06] last:border-b-0",
      )}
    >
      <Icon className={cn("h-[18px] w-[18px] shrink-0", danger ? "text-red-400" : "text-white/85")} strokeWidth={2} />
      <span className={cn("text-[15px] font-medium", danger ? "text-red-400" : "text-white")}>{label}</span>
    </button>
  );
}

function SizeButton({ icon: Icon, active, label, onClick }: {
  icon: typeof Square;
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "flex h-11 flex-1 items-center justify-center rounded-[14px] border transition-colors",
        active
          ? "border-willo-green/60 bg-willo-green/[0.12] text-willo-green-ink"
          : "border-white/[0.10] bg-white/[0.04] text-white/70",
      )}
    >
      <Icon className="h-5 w-5" strokeWidth={1.8} />
    </button>
  );
}
