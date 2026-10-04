import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

import { getCurrency } from "@/lib/currency";
export const TONE_HEX = { otimo: "#C8F36D", ok: "#7DD3FC", atencao: "#FCD34D", critico: "#F87171" } as const;
export const LIGHT_HEX = { verde: "#C8F36D", amarelo: "#FCD34D", vermelho: "#F87171" } as const;

export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency(), maximumFractionDigits: 0 });
export const brlCents = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });
export const pct = (v: number) => `${Math.round(v * 100)}%`;
export const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function Card({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      onClick={onClick}
      className={cn("rounded-[24px] border border-white/[0.08] willo-glass", onClick && "cursor-pointer active:scale-[0.99] transition-transform", className)}
    >
      {children}
    </motion.div>
  );
}

export function Section({ icon: Icon, title, hint, aside, children, id }: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="mt-7 scroll-mt-24">
      <div className="mb-3 flex items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[18px] font-bold tracking-tight text-white">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06]">
              <Icon className="h-[15px] w-[15px] text-white/82" strokeWidth={2.2} />
            </span>
            {title}
          </h2>
          {hint && <p className="mt-0.5 pl-9 text-[12px] text-white/56">{hint}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Friendly one-liner that sits on top of an analysis, with a tinted rail. */
export function Verdict({ children, hex = "#FFFFFF" }: { children: React.ReactNode; hex?: string }) {
  return (
    <p className="relative rounded-[16px] bg-white/[0.04] py-2.5 pl-4 pr-3 text-[13px] leading-snug text-white/85">
      <span className="absolute inset-y-2.5 left-0 w-[3px] rounded-r-full" style={{ background: hex }} />
      {children}
    </p>
  );
}

export function Bar({ value, hex, className, delay = 0 }: { value: number; hex: string; className?: string; delay?: number }) {
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-white/[0.07]", className)}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: hex }}
        initial={{ width: 0 }}
        whileInView={{ width: `${Math.min(Math.max(value, 0), 1) * 100}%` }}
        viewport={{ once: true }}
        transition={{ delay, duration: 0.6, ease: "easeOut" }}
      />
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, layoutId }: {
  value: T;
  options: { key: T; label: string }[];
  onChange: (v: T) => void;
  layoutId: string;
}) {
  return (
    <div className="flex isolate rounded-full border border-white/[0.08] willo-glass p-1">
      {options.map((o) => (
        <button key={o.key} type="button" onClick={() => onChange(o.key)} className="relative h-9 flex-1 rounded-full px-3 text-[13px] font-semibold">
          {value === o.key && (
            <motion.span layoutId={layoutId} className="pointer-events-none absolute inset-0 z-0 rounded-full bg-white" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
          )}
          <span className={cn("relative z-10 transform-gpu whitespace-nowrap transition-colors", value === o.key ? "text-[#0B0B0B]" : "text-white/74")}>{o.label}</span>
        </button>
      ))}
    </div>
  );
}
