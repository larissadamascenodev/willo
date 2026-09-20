import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Check, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * One onboarding screen: back chevron + section label up top, content in
 * the middle, the call to action pinned to the bottom. Black background with
 * a faint light spilling from the top corners.
 */
export function FlowScreen({ section, onBack, children, footer, center = false, scroll = true }: {
  section?: string;
  onBack?: () => void;
  children: ReactNode;
  footer?: ReactNode;
  center?: boolean;
  scroll?: boolean;
}) {
  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <div className="pointer-events-none absolute -left-28 -top-36 h-80 w-80 rounded-full bg-white/[0.07] blur-[100px]" />
      <div className="pointer-events-none absolute -right-28 -top-28 h-72 w-72 rounded-full bg-white/[0.045] blur-[100px]" />

      <div className="relative grid h-14 shrink-0 grid-cols-[48px_1fr_48px] items-center px-3">
        {onBack ? (
          <button type="button" onClick={onBack} aria-label="Voltar" className="flex h-11 w-11 items-center justify-center text-white/80 active:opacity-60">
            <ChevronLeft className="h-6 w-6" />
          </button>
        ) : <span />}
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.28em] text-white/45">{section}</p>
        <span />
      </div>

      <div className={cn("relative min-h-0 flex-1 px-6", scroll ? "overflow-y-auto overscroll-contain" : "overflow-hidden", center && "flex flex-col justify-center")}>
        {children}
      </div>

      {footer && <div className="relative shrink-0 px-6 pb-5 pt-3">{footer}</div>}
    </div>
  );
}

/** "Qual / seu objetivo?" — light first line, heavy second line. */
export function Heading({ light, bold, sub, className }: { light: ReactNode; bold: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className={className}>
      <h1 className="text-[30px] leading-[1.12] tracking-tight text-white">
        <span className="block font-light">{light}</span>
        <span className="block font-extrabold">{bold}</span>
      </h1>
      {sub && <p className="mt-2.5 text-[15px] leading-snug text-white/50">{sub}</p>}
    </motion.div>
  );
}

/** Answer row: white when picked, graphite when not. */
export function OptionRow({ label, hint, selected, onClick, delay = 0, square = false }: {
  label: string;
  hint?: string;
  selected: boolean;
  onClick: () => void;
  delay?: number;
  /** Checkbox look for multiple choice. */
  square?: boolean;
}) {
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-[22px] border px-5 text-left transition-colors",
        hint ? "py-4" : "py-[18px]",
        selected ? "border-white bg-white" : "border-white/[0.06] bg-[#141414]",
      )}
    >
      <span className="min-w-0 flex-1">
        <span className={cn("block text-[16px] font-semibold", selected ? "text-[#0B0B0B]" : "text-white/80")}>{label}</span>
        {hint && <span className={cn("mt-0.5 block text-[13px]", selected ? "text-[#0B0B0B]/60" : "text-white/40")}>{hint}</span>}
      </span>
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center border-2",
          square ? "rounded-[7px]" : "rounded-full",
          selected ? "border-[#0B0B0B] bg-[#0B0B0B]" : "border-white/20",
        )}
      >
        {selected && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3.5} />}
      </span>
    </motion.button>
  );
}

/** Vertical wheel for small integers (age): big center, fading neighbors. */
export function NumberWheel({ value, min, max, onChange, unit }: {
  value: number; min: number; max: number; onChange: (v: number) => void; unit?: string;
}) {
  const ROW = 68;
  const ref = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState((value - min) * ROW);
  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  useLayoutEffect(() => {
    if (ref.current) ref.current.scrollTop = (value - min) * ROW;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    setScrollTop(el.scrollTop);
    const v = Math.min(max, Math.max(min, min + Math.round(el.scrollTop / ROW)));
    if (v !== value) onChange(v);
  };

  return (
    <div className="relative mx-auto h-[340px] w-full">
      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-[68px] -translate-y-1/2 border-y border-white/[0.08]" />
      {unit && (
        <span className="pointer-events-none absolute left-[calc(50%+62px)] top-1/2 -translate-y-1/2 text-[12px] font-semibold uppercase tracking-[0.2em] text-white/50">
          {unit}
        </span>
      )}
      <div
        ref={ref}
        onScroll={onScroll}
        className="h-full snap-y snap-mandatory overflow-y-scroll scrollbar-hide"
        style={{ paddingTop: 170 - ROW / 2, paddingBottom: 170 - ROW / 2, maskImage: "linear-gradient(to bottom, transparent, black 30%, black 70%, transparent)", WebkitMaskImage: "linear-gradient(to bottom, transparent, black 30%, black 70%, transparent)" }}
      >
        {values.map((v, i) => {
          const d = Math.abs(i * ROW - scrollTop) / ROW;
          return (
            <div
              key={v}
              className="flex snap-center items-center justify-center"
              style={{ height: ROW }}
            >
              {/* Scaled, not resized: no reflow while scrolling, so iOS doesn't clip the digits */}
              <span
                className="inline-block px-[0.14em] text-[58px] font-extrabold leading-none tabular-nums text-white will-change-transform"
                style={{ transform: `scale(${Math.max(1 - d * 0.2, 0.45)})`, opacity: Math.max(1 - d * 0.35, 0.12) }}
              >
                {v}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Horizontal ruler for amounts: a big number you can also type,
 * and a scale you drag under the center line.
 */
export function ValueRuler({ value, min, max, step, onChange, format, unit, labelEvery = 10, hint }: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
  unit?: string;
  labelEvery?: number;
  hint?: ReactNode;
}) {
  const TICK = 12;
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const count = Math.round((max - min) / step);
  const skip = useRef(false);

  const scrollToValue = (v: number, smooth = false) => {
    const el = ref.current;
    if (!el) return;
    skip.current = true;
    el.scrollTo({ left: ((v - min) / step) * TICK, behavior: smooth ? "smooth" : "auto" });
    setTimeout(() => { skip.current = false; }, smooth ? 400 : 50);
  };

  useLayoutEffect(() => { scrollToValue(value); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const onScroll = () => {
    const el = ref.current;
    if (!el || skip.current) return;
    const v = Math.min(max, Math.max(min, min + Math.round(el.scrollLeft / TICK) * step));
    if (v !== value) onChange(v);
  };

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const commit = () => {
    const n = Number(draft.replace(/\D/g, ""));
    if (n > 0) {
      const v = Math.min(max, Math.max(min, Math.round(n / step) * step));
      onChange(v);
      scrollToValue(v, true);
    }
    setEditing(false);
  };

  return (
    <div className="w-full">
      <button type="button" onClick={() => { setDraft(String(value)); setEditing(true); }} className="mx-auto flex flex-col items-center">
        <span className="flex items-baseline gap-2">
          {editing ? (
            <input
              ref={inputRef}
              inputMode="numeric"
              value={draft}
              onChange={(e) => setDraft(e.target.value.replace(/\D/g, "").slice(0, 7))}
              onBlur={commit}
              onKeyDown={(e) => e.key === "Enter" && commit()}
              className="w-[220px] bg-transparent text-center text-[64px] font-extrabold leading-none tracking-tight text-white focus:outline-none"
            />
          ) : (
            <span className="inline-block px-[0.1em] text-[64px] font-extrabold leading-none tracking-tight text-white tabular-nums">{format(value)}</span>
          )}
          {unit && <span className="text-[12px] font-semibold uppercase tracking-[0.2em] text-white/50">{unit}</span>}
        </span>
        <span className="mt-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-white/40">Toque para editar</span>
      </button>
      {hint && <div className="mt-3 flex justify-center">{hint}</div>}

      <div className="relative mt-8">
        <div className="pointer-events-none absolute left-1/2 top-0 z-10 h-[46px] w-[3px] -translate-x-1/2 rounded-full bg-white" />
        <div
          ref={ref}
          onScroll={onScroll}
          className="overflow-x-scroll scrollbar-hide"
          style={{ maskImage: "linear-gradient(to right, transparent, black 25%, black 75%, transparent)", WebkitMaskImage: "linear-gradient(to right, transparent, black 25%, black 75%, transparent)" }}
        >
          <div className="relative flex items-start" style={{ width: count * TICK + 2, marginLeft: "50%", marginRight: "50%" }}>
            {Array.from({ length: count + 1 }, (_, i) => {
              // Anchor marks on round values (R$ 1.000, 5.000…), not on the minimum
              const units = Math.round((min + i * step) / step);
              const major = units % labelEvery === 0;
              const mid = units % (labelEvery / 2) === 0;
              return (
                <div key={i} className="absolute top-0 flex flex-col items-center" style={{ left: i * TICK }}>
                  <span className={cn("w-[2px] rounded-full", major ? "h-[34px] bg-white/60" : mid ? "h-[24px] bg-white/35" : "h-[16px] bg-white/20")} />
                  {major && (
                    <span className="mt-2 whitespace-nowrap text-[11px] tabular-nums text-white/40">{format(min + i * step)}</span>
                  )}
                </div>
              );
            })}
            <div style={{ height: 64 }} />
          </div>
        </div>
      </div>
    </div>
  );
}
