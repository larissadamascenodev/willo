import { forwardRef, type ReactNode } from "react";
import { Check, Loader2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { currencySymbol } from "@/lib/currency";
import { BANKS, PALETTE, type Bank } from "@/lib/banks";

/** Small gray label above each block of a sheet. */
export const SectionLabel = ({ children, right }: { children: ReactNode; right?: ReactNode }) => (
  <div className="mb-2 mt-6 flex items-center justify-between px-1">
    <p className="text-[13px] font-semibold text-white/45">{children}</p>
    {right}
  </div>
);

/** Round text field used across the wallet sheets. */
export const PillInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>((props, ref) => (
  <input
    ref={ref}
    {...props}
    className={cn(
      "h-12 w-full rounded-full border border-white/[0.06] bg-[#1A1A1A] px-4 text-[15px] text-white placeholder:text-white/30 focus:border-white/25 focus:outline-none",
      props.className,
    )}
  />
));
PillInput.displayName = "PillInput";

/** Horizontal strip of common banks; tapping one fills name and color. "Outro" clears them. */
export function BankChips({ selectedId, onPick, onOther }: { selectedId: string | null; onPick: (b: Bank) => void; onOther: () => void }) {
  return (
    <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 scrollbar-hide">
      {BANKS.map((b) => {
        const selected = selectedId === b.id;
        return (
          <button
            key={b.id}
            type="button"
            onClick={() => onPick(b)}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3.5 text-[13px] font-medium transition-colors",
              selected ? "border-white bg-white/[0.1] text-white" : "border-white/[0.07] bg-[#1A1A1A] text-white/70",
            )}
          >
            <span className="h-6 w-6 rounded-full" style={{ background: b.hex, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.15)" }} />
            {b.name}
          </button>
        );
      })}
      <button
        type="button"
        onClick={onOther}
        className="flex shrink-0 items-center gap-1.5 rounded-full border border-dashed border-white/15 px-3.5 py-1.5 text-[13px] text-white/60"
      >
        <Pencil className="h-3.5 w-3.5" /> Outro
      </button>
    </div>
  );
}

/** Palette swatches. */
export function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex justify-between px-1">
      {PALETTE.map((c) => {
        const selected = value === c.value;
        return (
          <button
            key={c.value}
            type="button"
            onClick={() => onChange(c.value)}
            aria-label={c.value}
            className={cn("flex h-9 w-9 items-center justify-center rounded-full transition-transform", selected ? "scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#111111]" : "opacity-70")}
            style={{ background: c.hex }}
          >
            {selected && <Check className="h-4 w-4 text-white" strokeWidth={3} />}
          </button>
        );
      })}
    </div>
  );
}

const fmtShort = (v: number) => (v >= 1000 ? `${(v / 1000).toLocaleString("pt-BR")} mil` : v.toLocaleString("pt-BR"));

/** Big amount typed digit by digit (cents), with optional quick-pick chips. */
export function MoneyField({ cents, onChange, chips, negative = false, children }: {
  cents: number;
  onChange: (cents: number) => void;
  chips?: number[];
  negative?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-[22px] border border-white/[0.07] bg-[#141414] p-5">
      <label className="relative mx-auto flex w-fit items-baseline gap-1.5">
        <span className="text-[20px] font-bold text-white/40">{negative ? `−${currencySymbol()}` : currencySymbol()}</span>
        <span className={cn("text-[40px] font-extrabold leading-none tracking-tight tabular-nums", cents === 0 ? "text-white/30" : negative ? "text-red-400" : "text-white")}>
          {(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <input
          inputMode="numeric"
          value={cents === 0 ? "" : String(cents)}
          onChange={(e) => onChange(Math.min(Number(e.target.value.replace(/\D/g, "").slice(0, 10) || "0"), 9999999999))}
          aria-label="Valor"
          className="absolute inset-0 w-full cursor-text opacity-0"
        />
      </label>
      {chips && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {chips.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v * 100)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
                cents === v * 100 ? "bg-white text-[#0B0B0B]" : "bg-white/[0.06] text-white/60",
              )}
            >
              {fmtShort(v)}
            </button>
          ))}
        </div>
      )}
      {children}
    </div>
  );
}

/** 1–31 grid for picking a day of the month. */
export function DayGrid({ value, onChange, mark }: { value: number; onChange: (d: number) => void; mark?: number }) {
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => {
        const selected = d === value;
        return (
          <button
            key={d}
            type="button"
            onClick={() => onChange(d)}
            className={cn(
              "relative flex h-10 items-center justify-center rounded-full text-[14px] font-semibold tabular-nums transition-colors",
              selected ? "bg-white text-[#0B0B0B]" : "text-white/70 active:bg-white/10",
            )}
          >
            {d}
            {mark === d && !selected && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-white/40" />}
          </button>
        );
      })}
    </div>
  );
}

/** White pill for the sheet's main action. */
export const SheetAction = ({ children, loading, loadingLabel, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; loadingLabel?: string }) => (
  <button
    type="button"
    {...rest}
    disabled={rest.disabled || loading}
    className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-white text-[16px] font-bold text-[#0B0B0B] transition-opacity active:scale-[0.99] disabled:opacity-40"
  >
    {loading ? (<><Loader2 className="h-4 w-4 animate-spin" /> {loadingLabel}</>) : children}
  </button>
);
