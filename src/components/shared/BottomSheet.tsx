import { type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useDragControls, type PanInfo } from "framer-motion";
import { useScrollLock } from "@/hooks/useScrollLock";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** "auto" hugs the content; "full" takes almost the whole screen. */
  size?: "auto" | "full";
  /** Sticky footer (e.g. the primary action), kept above the home indicator. */
  footer?: ReactNode;
  className?: string;
  zIndex?: number;
  /** Render in place instead of portalling to <body> (used inside the welcome phone). */
  inline?: boolean;
  /**
   * Where the panel sits. Centre is the app's voice: a panel that arrives in the
   * middle reads as a considered answer, where one shoved up from the edge reads as
   * a drawer. "bottom" is kept for the few places that really are drawers — a picker
   * stacked on an open form, where the hand is already at the foot of the screen.
   */
  placement?: "center" | "bottom";
}

const BottomSheet = ({
  open, onClose, children, size = "auto", footer, className, zIndex = 60, inline = false,
  placement = "center",
}: Props) => {
  const dragControls = useDragControls();
  const bottom = placement === "bottom";

  // Shared with the full-screen overlays: a count per component unlocks the page as soon
  // as one of them closes, even with another still covering it.
  useScrollLock(open && !inline);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) onClose();
  };

  const panel = (
    <motion.div
      role="dialog"
      aria-modal
      initial={bottom ? { y: "100%" } : { opacity: 0, scale: 0.96, y: 12 }}
      animate={bottom ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
      exit={bottom ? { y: "100%" } : { opacity: 0, scale: 0.96, y: 12 }}
      transition={{ type: "spring", damping: bottom ? 34 : 28, stiffness: bottom ? 340 : 320 }}
      {...(bottom
        ? {
            drag: "y" as const,
            dragListener: false,
            dragControls,
            dragConstraints: { top: 0, bottom: 0 },
            dragElastic: { top: 0, bottom: 0.6 },
            onDragEnd: handleDragEnd,
          }
        : {})}
      className={cn(
        "flex w-full flex-col border-white/[0.08] willo-glass-strong",
        bottom
          ? "absolute inset-x-0 bottom-0 mx-auto max-w-lg rounded-t-[32px] border-t shadow-[0_-20px_60px_rgba(0,0,0,0.6)]"
          : "relative mx-auto max-w-md rounded-[30px] border shadow-[0_40px_90px_-30px_rgba(0,0,0,0.95)]",
        bottom
          ? size === "full" ? "h-[94dvh]" : "max-h-[92dvh]"
          : size === "full" ? "max-h-[84dvh]" : "max-h-[80dvh]",
        className,
      )}
    >
      {bottom ? (
        <div
          className="flex shrink-0 cursor-grab touch-none justify-center pb-2 pt-2.5"
          onPointerDown={(e) => dragControls.start(e)}
        >
          <span className="h-1.5 w-10 rounded-full bg-white/20" />
        </div>
      ) : (
        <div className="shrink-0 pt-5" />
      )}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-none">
        {children}
      </div>

      {footer && (
        <div
          className={cn(
            "shrink-0 border-t border-white/[0.06] willo-glass-strong px-5 pt-3",
            bottom ? "" : "rounded-b-[30px] pb-4",
          )}
          style={bottom ? { paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)" } : undefined}
        >
          {footer}
        </div>
      )}
      {!footer && (
        <div
          className="shrink-0"
          style={{ height: bottom ? "calc(env(safe-area-inset-bottom, 0px) + 12px)" : "20px" }}
        />
      )}
    </motion.div>
  );

  const sheet = (
    <AnimatePresence>
      {open && (
        <div
          className={cn(
            inline ? "absolute inset-0" : "fixed inset-0",
            !bottom && "flex items-center justify-center px-5",
          )}
          style={{ zIndex }}
        >
          <motion.div
            className="absolute inset-0 bg-black/66 backdrop-blur-[20px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          {panel}
        </div>
      )}
    </AnimatePresence>
  );

  if (inline) return sheet;
  return typeof document !== "undefined" ? createPortal(sheet, document.body) : null;
};

export default BottomSheet;
