import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useDragControls, type PanInfo } from "framer-motion";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** "auto" hugs the content; "full" takes almost the whole screen like a native page sheet. */
  size?: "auto" | "full";
  /** Sticky footer (e.g. the primary action), kept above the home indicator. */
  footer?: ReactNode;
  className?: string;
  zIndex?: number;
  /** Render in place instead of portalling to <body> (used inside the welcome phone). */
  inline?: boolean;
}

/**
 * Native-style bottom sheet: dims the page, slides up from the bottom with a
 * grab handle, and closes on backdrop tap or by dragging the handle down.
 */
/**
 * Sheets stack (a picker on top of a form, a creator on top of the picker), so the scroll
 * lock is counted: saving and restoring the previous value left the page stuck whenever
 * one sheet closed while another was still open.
 */
let scrollLocks = 0;

const BottomSheet = ({ open, onClose, children, size = "auto", footer, className, zIndex = 60, inline = false }: Props) => {
  const dragControls = useDragControls();
  useEffect(() => {
    if (!open || inline) return;
    scrollLocks += 1;
    document.body.style.overflow = "hidden";
    return () => {
      scrollLocks = Math.max(0, scrollLocks - 1);
      if (scrollLocks === 0) document.body.style.overflow = "";
    };
  }, [open, inline]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) onClose();
  };

  const sheet = (
    <AnimatePresence>
      {open && (
        <div className={inline ? "absolute inset-0" : "fixed inset-0"} style={{ zIndex }}>
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-[16px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 34, stiffness: 340 }}
            drag="y"
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={handleDragEnd}
            className={cn(
              "absolute inset-x-0 bottom-0 mx-auto flex w-full max-w-lg flex-col rounded-t-[32px] border-t border-white/[0.08] willo-glass-strong shadow-[0_-20px_60px_rgba(0,0,0,0.6)]",
              size === "full" ? "h-[94dvh]" : "max-h-[92dvh]",
              className,
            )}
          >
            <div
              className="flex shrink-0 cursor-grab touch-none justify-center pb-2 pt-2.5"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <span className="h-1.5 w-10 rounded-full bg-white/20" />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {children}
            </div>
            {footer && (
              <div
                className="shrink-0 border-t border-white/[0.06] willo-glass-strong px-5 pt-3"
                style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)" }}
              >
                {footer}
              </div>
            )}
            {!footer && <div className="shrink-0" style={{ height: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }} />}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  if (inline) return sheet;
  return typeof document !== "undefined" ? createPortal(sheet, document.body) : null;
};

export default BottomSheet;
