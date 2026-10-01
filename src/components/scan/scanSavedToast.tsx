import { toast } from "sonner";
import { Check } from "lucide-react";
import { getCategoryHexColor, getCategoryIcon } from "@/lib/categoryUtils";
import type { ScanResultItem } from "./ScanResultCard";

import { getCurrency } from "@/lib/currency";
const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });

/** The toast body itself, also drawn inside the welcome showcase phone. */
export function SavedToastCard({ items, onOpen }: { items: ScanResultItem[]; onOpen?: () => void }) {
  const single = items.length === 1 ? items[0] : null;
  const total = items.reduce((s, i) => s + i.amount, 0);
  const category = single?.category || items[0]?.category || "Outros";
  const Icon = getCategoryIcon(category);
  const hex = getCategoryHexColor(category);
  const isIncome = single?.type === "receita";
  const date = single?.date ? new Date(`${single.date}T12:00:00`) : null;
  const otherMonth = date && (date.getMonth() !== new Date().getMonth() || date.getFullYear() !== new Date().getFullYear());

  return (
    <div className="flex w-[calc(100vw-24px)] max-w-[380px] items-center gap-3 rounded-[22px] border border-white/[0.1] willo-glass-inset/95 p-3 pr-2 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.8)] backdrop-blur-xl">
      <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ background: `${hex}24` }}>
        <Icon className="h-5 w-5" style={{ color: hex }} />
        <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#1A1A1A] bg-willo-green">
          <Check className="h-3 w-3 text-[#0B0B0B]" strokeWidth={3.5} />
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-white">
          {single ? (isIncome ? "Receita adicionada" : "Gasto adicionado") : `${items.length} lançamentos adicionados`}
        </p>
        <p className="truncate text-[12px] text-white/50">
          {single ? `${single.merchant || single.description} · ` : ""}
          <span className={isIncome ? "text-willo-green" : "text-white/80"}>{isIncome ? "+" : "−"}{fmt(total)}</span>
          {otherMonth && date ? ` · em ${date.toLocaleDateString("pt-BR", { month: "short", year: "numeric" }).replace(".", "")}` : ""}
        </p>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="h-9 shrink-0 rounded-full bg-white px-3.5 text-[13px] font-semibold text-[#0B0B0B] active:scale-95"
      >
        Ver
      </button>
    </div>
  );
}

/** Confirmation shown after saving scanned receipts, in the app's graphite style. */
export function showScanSavedToast(items: ScanResultItem[], onOpen: () => void) {
  toast.custom(
    (id) => <SavedToastCard items={items} onOpen={() => { toast.dismiss(id); onOpen(); }} />,
    { duration: 4500, position: "top-center" },
  );
}
