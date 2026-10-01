import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/** Discreet back chevron, large title and optional subtitle/right action — shared by detail pages. */
export function PageHeader({ title, subtitle, action, onBack }: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  onBack?: () => void;
}) {
  const navigate = useNavigate();
  return (
    <div style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6px)" }}>
      <div className="flex h-11 items-center justify-between">
        <button onClick={onBack ?? (() => navigate(-1))} aria-label="Voltar" className="-ml-2 flex h-10 items-center text-white/70 active:opacity-60">
          <ChevronLeft className="h-7 w-7" strokeWidth={2.25} />
        </button>
        {action}
      </div>
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-1">
        <h1 className="text-[28px] font-extrabold tracking-tight text-white">{title}</h1>
        {subtitle && <p className="text-[14px] text-white/45">{subtitle}</p>}
      </motion.div>
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
      className={cn("rounded-[22px] border border-white/[0.12] willo-glass", className)}
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
