import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check, Wallet, AlertTriangle } from "lucide-react";
import { getCategoryIcon, getCategoryColor } from "@/lib/categoryUtils";
import type { ActiveInstallmentItem } from "@/lib/installmentProgress";
import type { CustomCategory } from "@/services/categoryService";
import { getCurrency } from "@/lib/currency";

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });

const SCHEDULE_PREVIEW = 4;

const CARD_HEX: Record<string, string> = {
  violet: "#8B5CF6", emerald: "#10B981", sky: "#0EA5E9", amber: "#F59E0B", rose: "#F43F5E",
  cyan: "#06B6D4", fuchsia: "#D946EF", lime: "#84CC16", purple: "#8A05BE", orange: "#F97316",
};

const monthLabel = (d: Date) => d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", "").replace(" de ", "/");

/** One installment purchase: segmented installment track, key numbers, and expandable schedule. */
export default function InstallmentPurchaseCard({ item, index, customCats, card, onOpen }: {
  item: ActiveInstallmentItem;
  index: number;
  customCats: CustomCategory[];
  card?: { name: string; color: string | null };
  /** Tapping the card opens the purchase; the chevron still expands the schedule. */
  onOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const paidCount = item.installment_current - 1;
  const remaining = item.installments - paidCount;
  const total = item.amount * item.installments;
  const IconComp = getCategoryIcon(item.category, customCats);
  const catColor = getCategoryColor(item.category, customCats);
  const isCard = item.payment_method === "cartao";
  const start = new Date(`${item.date.slice(0, 10)}T12:00:00`);
  const end = new Date(start);
  end.setMonth(end.getMonth() + (item.installments - 1));
  const next = item.dueDate ? new Date(`${item.dueDate.slice(0, 10)}T12:00:00`) : null;
  const denseTrack = item.installments > 24;

  const schedule = Array.from({ length: item.installments }, (_, n) => {
    const d = new Date(start);
    d.setMonth(d.getMonth() + n);
    return { n: n + 1, date: d, status: n < paidCount ? "paga" : n === paidCount ? "atual" : "futura" };
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className={`overflow-hidden rounded-[20px] border willo-glass ${item.isOverdue ? "border-red-400/30" : "border-white/[0.08]"}`}
    >
      <button
        type="button"
        onClick={() => (onOpen ? onOpen() : setOpen((v) => !v))}
        className="block w-full px-3.5 py-3 text-left"
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          {/* Icon wrapped by a ring that fills as installments are paid */}
          <span className="relative flex h-12 w-12 shrink-0 items-center justify-center">
            <svg viewBox="0 0 48 48" className="absolute inset-0 h-full w-full -rotate-90">
              <circle cx="24" cy="24" r="22" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5" />
              <motion.circle
                cx="24" cy="24" r="22" fill="none" stroke={`hsl(${catColor})`} strokeWidth="2.5" strokeLinecap="round"
                initial={{ strokeDasharray: `0 ${2 * Math.PI * 22}` }}
                animate={{ strokeDasharray: `${Math.max(item.installment_current / item.installments, 0.04) * 2 * Math.PI * 22} ${2 * Math.PI * 22}` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </svg>
            <span className="flex h-[38px] w-[38px] items-center justify-center rounded-full willo-glass-inset">
              {IconComp && <IconComp className="h-[18px] w-[18px]" style={{ color: `hsl(${catColor})` }} />}
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold text-white">{item.name}</p>
            <p className={`flex items-center gap-1.5 truncate text-[12px] ${item.isOverdue ? "text-red-400" : "text-white/62"}`}>
              {item.isOverdue ? (
                <AlertTriangle className="h-3 w-3 shrink-0" />
              ) : isCard ? (
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: CARD_HEX[card?.color ?? ""] ?? "#8B5CF6" }} />
              ) : (
                <Wallet className="h-3 w-3 shrink-0" />
              )}
              {item.isOverdue ? "Em atraso · " : ""}
              {isCard ? card?.name ?? "Cartão" : "Conta"}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[15px] font-bold text-white tabular-nums">{formatCurrency(item.amount)}</p>
            <p className="text-[11px] text-white/56 tabular-nums">de {formatCurrency(total)}</p>
          </div>
        </div>

        {/* Installment track */}
        <div className="mt-2.5 flex items-baseline justify-between">
          <p className="text-[12px] text-white/70">
            Parcela <span className="font-semibold text-white">{item.installment_current}</span> de {item.installments}
          </p>
          <p className="text-[11px] text-white/56">
            {remaining} {remaining === 1 ? "restante" : "restantes"}
          </p>
        </div>
        {denseTrack ? (
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
            <div className="h-full rounded-full bg-willo-green" style={{ width: `${(paidCount / item.installments) * 100}%` }} />
          </div>
        ) : (
          <div className="mt-1.5 flex gap-[3px]">
            {schedule.map((s) => (
              <span
                key={s.n}
                className={`h-1.5 flex-1 rounded-full ${
                  s.status === "paga" ? "bg-willo-green" : s.status === "atual" ? (item.isOverdue ? "bg-red-400" : "bg-white") : "bg-white/[0.1]"
                }`}
              />
            ))}
          </div>
        )}

        <div className="mt-2 flex items-center justify-between text-[11px] text-white/62 tabular-nums">
          <span>
            Falta {formatCurrency(item.amount * remaining)} · {next ? `próxima ${next.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}` : `até ${monthLabel(end)}`}
          </span>
          <span
            role="button"
            aria-label={open ? "Recolher parcelas" : "Ver parcelas"}
            onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
            className="-m-2 flex h-8 w-8 items-center justify-center rounded-full active:bg-white/[0.06]"
          >
            <ChevronDown className={`h-4 w-4 text-white/56 transition-transform ${open ? "rotate-180" : ""}`} />
          </span>
        </div>
      </button>

      {/* Schedule */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/[0.06] px-3.5 pb-3 pt-3">
              <div className="relative">
                {/* Timeline rail */}
                <span className="absolute bottom-3 left-[9px] top-3 w-px bg-white/[0.08]" />
                {(showAll ? schedule : schedule.slice(paidCount, paidCount + SCHEDULE_PREVIEW)).map((s) => {
                  const isCurrent = s.status === "atual";
                  const isPaid = s.status === "paga";
                  const month = s.date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
                  return (
                    <div
                      key={s.n}
                      className={`relative flex items-center gap-3 rounded-[14px] py-2 pl-0 pr-2 ${isCurrent ? "bg-white/[0.05]" : ""}`}
                    >
                      <span
                        className={`relative z-10 flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full ${
                          isPaid ? "bg-willo-green text-[#0B0B0B]" : isCurrent ? (item.isOverdue ? "bg-red-400" : "bg-white") : "border border-white/20 willo-glass"
                        }`}
                      >
                        {isPaid && <Check className="h-3 w-3" strokeWidth={3} />}
                      </span>
                      <span className={`w-9 shrink-0 text-[12px] tabular-nums ${isPaid ? "text-white/50" : "text-white/70"}`}>{s.n}ª</span>
                      <span className={`min-w-0 flex-1 truncate whitespace-nowrap text-[14px] capitalize ${isPaid ? "text-white/56" : "text-white"}`}>
                        {month} {s.date.getFullYear()}
                      </span>
                      {isCurrent && (
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.isOverdue ? "bg-red-400/15 text-red-400" : "bg-white/15 text-white"}`}>
                          {item.isOverdue ? "Em atraso" : "Este mês"}
                        </span>
                      )}
                      <span className={`shrink-0 text-right text-[14px] tabular-nums ${isPaid ? "text-white/50 line-through" : "font-medium text-white"}`}>
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
              {schedule.length > SCHEDULE_PREVIEW && (
                <button
                  type="button"
                  onClick={() => setShowAll((v) => !v)}
                  className="mt-2 flex h-9 w-full items-center justify-center gap-1 rounded-full bg-white/[0.05] text-[12px] font-medium text-white/82 active:opacity-70"
                >
                  {showAll ? "Mostrar menos" : `Ver todas as ${schedule.length} parcelas`}
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAll ? "rotate-180" : ""}`} />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
