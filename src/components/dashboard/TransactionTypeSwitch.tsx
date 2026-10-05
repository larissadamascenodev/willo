import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type EntryType = "receita" | "despesa" | "transferencia";

const OPTIONS: { key: EntryType; label: string; accent: string }[] = [
  { key: "receita", label: "Receita", accent: "#C8F36D" },
  { key: "despesa", label: "Despesa", accent: "#F87171" },
  { key: "transferencia", label: "Transferência", accent: "#7DD3FC" },
];

/**
 * One sheet for all three kinds of entry. Choosing the kind used to be a screen of
 * its own that you passed through before the form appeared; here it is the first
 * control on the form, so changing your mind halfway costs a tap instead of a
 * close and a reopen. A card expense is not a fourth option — it is a despesa whose
 * payment method is a card, which the despesa form already asks.
 */
export default function TransactionTypeSwitch({ value, onChange }: {
  value: EntryType;
  onChange: (next: EntryType) => void;
}) {
  return (
    <div className="flex gap-1 rounded-full border border-white/[0.08] bg-white/[0.04] p-1 [isolation:isolate]">
      {OPTIONS.map((o) => {
        const active = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            aria-pressed={active}
            className="relative flex-1 rounded-full px-2 py-2.5 text-center"
          >
            {active && (
              <motion.span
                layoutId="willo-entry-type"
                transition={{ type: "spring", stiffness: 420, damping: 36 }}
                className="absolute inset-0 rounded-full bg-white"
              />
            )}
            <span
              className={cn(
                "relative transform-gpu text-[13px] font-semibold transition-colors",
                active ? "text-[#0B0B0B]" : "text-white/60",
              )}
            >
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
