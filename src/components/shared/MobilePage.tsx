import type { ReactNode } from "react";
import { motion } from "framer-motion";
import BackButton from "@/components/shared/BackButton";
import { cn } from "@/lib/utils";

/**
 * The way back, and whatever the page keeps on that line with it.
 *
 * No heading. It used to carry a 28px title and a subtitle on rows of their own, which
 * is three rows of chrome before the page says anything — and the title was almost
 * always repeating the first card underneath it. The content names itself; this is just
 * the way out.
 */
export function PageHeader({ action, onBack }: {
  action?: ReactNode;
  onBack?: () => void;
}) {
  return (
    <div
      className="flex items-center justify-between"
      style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6px)" }}
    >
      <BackButton onClick={onBack} />
      {action}
    </div>
  );
}

/** Graphite surface used for every card on the new design. */
export function Surface({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={cn("rounded-[22px] border border-white/[0.08] willo-glass", className)}
    >
      {children}
    </motion.div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2.5 mt-7 flex items-center justify-between px-1">
      <h2 className="text-[18px] font-bold text-white">{children}</h2>
      {action}
    </div>
  );
}
