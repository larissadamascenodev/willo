import type { ReactNode } from "react";
import { motion } from "framer-motion";
import BackButton from "@/components/shared/BackButton";
import { cn } from "@/lib/utils";

/**
 * The way back and what you are looking at, on one line.
 *
 * It used to be two: a chevron on its own row and a large heading under it, which is
 * two rows of chrome before the page has said anything. The arrow and the title sit
 * together now, and the title is sized to lead a row rather than to own one.
 */
export function PageHeader({ title, subtitle, action, onBack }: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  onBack?: () => void;
}) {
  return (
    <div style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6px)" }}>
      <div className="flex items-start gap-3">
        <BackButton onClick={onBack} className="mt-0.5" />
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="min-w-0 flex-1"
        >
          <h1 className="truncate text-[23px] font-extrabold leading-tight tracking-tight text-white">
            {title}
          </h1>
          {subtitle && <p className="text-[13px] t-soft">{subtitle}</p>}
        </motion.div>
        {action}
      </div>
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
