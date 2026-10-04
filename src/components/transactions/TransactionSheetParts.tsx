import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { currencySymbol } from "@/lib/currency";

/**
 * The building blocks the scanner review introduced, shared so that reading a
 * transaction, creating one and editing one all look like the same screen.
 */

/** Settings-style row: icon and label on the left, the value or control on the right. */
export const Row = ({ icon: Icon, label, children, onClick, muted }: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  children?: ReactNode;
  onClick?: () => void;
  muted?: boolean;
}) => (
  <div
    role={onClick ? "button" : undefined}
    onClick={onClick}
    className={cn(
      "flex min-h-[56px] items-center gap-3 px-4 py-2.5",
      onClick && "cursor-pointer active:bg-white/[0.03]",
    )}
  >
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06]">
      <Icon className="h-4 w-4 text-white/82" />
    </span>
    <span className={cn("shrink-0 text-[15px]", muted ? "text-white/62" : "text-white")}>{label}</span>
    <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 text-right">{children}</div>
  </div>
);

export const inlineInput =
  "w-full min-w-0 bg-transparent text-right text-[15px] text-white placeholder:text-white/45 focus:outline-none";

/** The group the rows sit in. */
export const RowGroup = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn("divide-y divide-white/[0.06] rounded-[22px] border border-white/[0.08] willo-glass", className)}>
    {children}
  </div>
);

/** Despesa / Receita, as a segmented pill. */
export const TypeToggle = ({ value, onChange }: {
  value: "despesa" | "receita";
  onChange: (v: "despesa" | "receita") => void;
}) => (
  <div className="mx-auto grid w-[220px] isolate grid-cols-2 rounded-full willo-glass p-1">
    {(["despesa", "receita"] as const).map((t) => (
      <button
        key={t}
        type="button"
        onClick={() => onChange(t)}
        className={cn(
          "h-9 rounded-full text-[13px] font-semibold transition-colors",
          value === t ? "bg-white text-[#0B0B0B]" : "text-white/70",
        )}
      >
        {t === "despesa" ? "Despesa" : "Receita"}
      </button>
    ))}
  </div>
);

const formatAmount = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** The big centred amount, editable or not, with the type's colour bar under it. */
export const AmountHero = ({ cents, onChange, isExpense, hint }: {
  cents: number;
  onChange?: (cents: number) => void;
  isExpense: boolean;
  hint?: string;
}) => (
  <div>
    <label className="relative mt-5 flex items-baseline justify-center gap-2">
      <span className="text-[24px] font-bold text-white/56">{currencySymbol()}</span>
      {onChange ? (
        <input
          type="text"
          inputMode="numeric"
          value={formatAmount(cents)}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "");
            onChange(digits ? Number(digits) : 0);
          }}
          className="w-[70%] bg-transparent text-center text-[52px] font-extrabold leading-none tracking-tight text-white tabular-nums focus:outline-none"
        />
      ) : (
        <span className="text-center text-[52px] font-extrabold leading-none tracking-tight text-white tabular-nums">
          {formatAmount(cents)}
        </span>
      )}
    </label>
    <div className="mt-3 flex justify-center">
      <span className="h-1 w-10 rounded-full" style={{ background: isExpense ? "#F87171" : "#C8F36D" }} />
    </div>
    {hint && <p className="mt-2 text-center text-[12px] text-white/50">{hint}</p>}
  </div>
);
