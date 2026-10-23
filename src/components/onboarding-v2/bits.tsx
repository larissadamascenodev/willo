import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { brl, brl0 } from "@/components/onboarding-v2/money";
import "@/components/onboarding-v2/onboarding-v2.css";

/** The small pieces several onboarding screens need, and nothing else does. */

/** A number that climbs into place. Still, and instantly, for anyone who asked for less motion. */
export function CountUp({ to, format = brl0, className, duration = 1.1 }: {
  to: number;
  format?: (v: number) => string;
  className?: string;
  duration?: number;
}) {
  const still = useReducedMotion();
  const [shown, setShown] = useState(still ? to : 0);
  const from = useRef(0);

  useEffect(() => {
    if (still) { setShown(to); return; }
    const start = performance.now();
    const origin = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / (duration * 1000), 1);
      /* Fast out of the gate, settling at the end, so the last digits are readable. */
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(origin + (to - origin) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration, still]);

  return <span className={cn("tabular-nums", className)}>{format(shown)}</span>;
}

/**
 * A big amount in reais, typed as centavos.
 *
 * The digits go in from the right the way a card machine takes them, which is the one
 * way to type money that never needs a decimal point.
 */
export function MoneyInput({ value, onChange, autoFocus = true, placeholder = "R$ 0,00", onEnter }: {
  value: number | null;
  onChange: (centavos: number | null) => void;
  autoFocus?: boolean;
  placeholder?: string;
  onEnter?: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);

  return (
    <input
      ref={ref}
      inputMode="numeric"
      aria-label="Valor em reais"
      value={value === null ? "" : brl(value)}
      placeholder={placeholder}
      onKeyDown={(e) => { if (e.key === "Enter" && onEnter) onEnter(); }}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "").slice(0, 9);
        onChange(digits ? Number(digits) : null);
      }}
      className="mt-8 h-[72px] w-full bg-transparent text-center text-[46px] font-extrabold tabular-nums leading-none tracking-tight text-white placeholder:text-white/20 focus:outline-none"
    />
  );
}

/** Quick answers that fill a field, with room to write your own. */
export function Chips({ options, value, onChange }: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="mt-5 flex flex-wrap justify-center gap-2">
      {options.map((o, i) => (
        <motion.button
          key={o}
          type="button"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 * i }}
          onClick={() => onChange(o)}
          className={cn(
            "min-h-[44px] rounded-full border px-4 text-[14px] font-semibold transition-colors",
            value === o ? "border-white bg-white text-[#0B0B0B]" : "border-white/[0.08] willo-glass text-white/80",
          )}
        >
          {o}
        </motion.button>
      ))}
    </div>
  );
}

/** Months, from three to five years, with the four everyone actually picks on top. */
export function MonthPicker({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  const atalhos = [6, 12, 18, 24];
  const v = value ?? 12;
  return (
    <div className="mt-8">
      <p className="text-center text-[52px] font-extrabold leading-none tabular-nums tracking-tight text-white">
        {v}
        <span className="ml-2 text-[16px] font-semibold uppercase tracking-[0.2em] text-white/60">
          {v === 1 ? "mês" : "meses"}
        </span>
      </p>

      <input
        type="range"
        min={3}
        max={60}
        step={1}
        value={v}
        aria-label="Prazo em meses"
        onChange={(e) => onChange(Number(e.target.value))}
        className="willo-month-range mt-8 h-11 w-full cursor-pointer appearance-none bg-transparent"
      />
      <div className="flex justify-between text-[11px] tabular-nums t-soft">
        <span>3</span>
        <span>60</span>
      </div>

      <div className="mt-5 flex justify-center gap-2">
        {atalhos.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onChange(m)}
            className={cn(
              "min-h-[44px] min-w-[64px] rounded-full border px-4 text-[14px] font-semibold transition-colors",
              v === m ? "border-white bg-white text-[#0B0B0B]" : "border-white/[0.08] willo-glass text-white/80",
            )}
          >
            {m}m
          </button>
        ))}
      </div>
    </div>
  );
}

/** Says out loud that a number on screen is arithmetic, not a promise. */
export function EstimateBadge({ children = "Estimativa" }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/[0.10] bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/62">
      {children}
    </span>
  );
}

/** A line of the plan: label, value, and a bar showing its share. */
export function PlanRow({ label, value, share, tone, delay = 0 }: {
  label: string;
  value: number;
  share: number;
  tone: string;
  delay?: number;
}) {
  const still = useReducedMotion();
  return (
    <div className="py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[14.5px] text-white/80">{label}</span>
        <span className="text-[16px] font-bold tabular-nums text-white">{brl0(value)}</span>
      </div>
      <div className="mt-2 h-[7px] overflow-hidden rounded-full bg-white/[0.07]">
        <motion.span
          className="block h-full rounded-full"
          style={{ background: tone }}
          initial={{ width: still ? `${share}%` : 0 }}
          animate={{ width: `${share}%` }}
          transition={{ delay, duration: still ? 0 : 0.7, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}
