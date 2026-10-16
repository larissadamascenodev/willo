import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { X, Pencil, Trash2, AlertTriangle, Check, Clock, ChevronRight } from "lucide-react";
import { getCustomCategories, type CustomCategory } from "@/services/categoryService";
import { getCategoryHexColor } from "@/lib/categoryUtils";
import { getDefaultCategoryIcon } from "@/lib/categoryIcons";
import { getIconComponent } from "@/components/dashboard/CategoryCreateModal";
import { MenuRow } from "@/components/shared/AnchoredMenu";
import { useScrollLock } from "@/hooks/useScrollLock";
import { getCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });

const MONTHS_FULL = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const longDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} de ${MONTHS_FULL[m - 1]} de ${y}`;
};

export interface CardEntry {
  transactionId: string;
  name: string;
  category: string;
  amount: number;
  date: string;
  time?: string | null;
  installmentNumber?: number | null;
  totalInstallments?: number | null;
  /** Only for money moving through an account — a card purchase is settled by the statement. */
  status?: "pago" | "pendente";
  isReceita?: boolean;
}

/**
 * One entry, read rather than worked on.
 *
 * It answers in the order the question is asked: how much, then whether it has
 * happened, then when and under what. The figure is loose on the ground and the facts
 * under it are lines rather than boxes, the way every other screen reads now — a
 * purchase is not important enough to be announced inside three nested cards.
 *
 * Editing and removing are at the foot, written out. They were three unlabelled
 * circles in the corner, which is a toolbar for the two things people do here once a
 * month, and the removal asks in place, in the same words the hold menu uses.
 */
export default function CardEntryModal({ entry, cardName, onClose, onEdit, onDelete, onToggleStatus }: {
  entry: CardEntry | null;
  cardName?: string;
  onClose: () => void;
  onEdit: (transactionId: string) => void;
  onDelete: (transactionId: string) => void;
  /** Present when the entry can be settled on its own. */
  onToggleStatus?: (transactionId: string, next: "pago" | "pendente") => void;
}) {
  const [customCats, setCustomCats] = useState<CustomCategory[]>([]);
  const [asking, setAsking] = useState(false);

  const open = !!entry;
  useScrollLock(open);

  useEffect(() => {
    if (entry) {
      getCustomCategories().then(setCustomCats).catch(() => {});
      setAsking(false);
    }
  }, [entry]);

  const custom = entry ? customCats.find((c) => c.name === entry.category) : undefined;
  const CatIcon = custom ? getIconComponent(custom.icon) : getDefaultCategoryIcon(entry?.category ?? "");
  const catHex = getCategoryHexColor(entry?.category ?? "", customCats);
  const isPlan = !!(entry?.totalInstallments && entry.totalInstallments > 1);
  const income = !!entry?.isReceita;

  const content = (
    <AnimatePresence>
      {open && entry && (
        <div className="fixed inset-0 z-[75] flex items-end justify-center px-4 pb-4 sm:items-center sm:pb-0">
          <motion.div
            className="absolute inset-0 bg-black/62 backdrop-blur-[5px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal
            initial={{ opacity: 0, scale: 0.96, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="relative w-full max-w-[400px] overflow-hidden rounded-[26px] border border-white/[0.09]"
            style={{
              background: "#101113",
              boxShadow: "0 32px 70px -22px rgb(0 0 0 / 0.92), inset 0 1px 0 rgb(255 255 255 / 0.06)",
            }}
          >
            {/* What it is, and the way out. */}
            <div className="flex items-start gap-3 px-5 pt-4">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{ background: `${catHex}1F` }}
              >
                <CatIcon className="h-[18px] w-[18px]" style={{ color: catHex }} />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="truncate text-[15.5px] font-semibold leading-tight text-white">{entry.name}</p>
                <p className="mt-0.5 truncate text-[12px] t-softer">
                  {entry.category}
                  <span className="text-white/20"> · </span>
                  {cardName ?? "Cartão"}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                className="-mr-1.5 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/60 active:opacity-60"
              >
                <X className="h-[18px] w-[18px]" />
              </button>
            </div>

            {/* How much, loose. */}
            <div className="px-5 pb-4 pt-5">
              <p className={cn(
                "truncate text-[38px] font-extrabold leading-none tracking-[-0.035em] tabular-nums",
                income ? "text-willo-green-ink" : "text-white",
              )}>
                {income ? "+" : ""}{fmt(entry.amount)}
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                {entry.status && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold",
                      entry.status === "pago" ? "bg-willo-green/12 text-willo-green-ink" : "bg-amber-300/12 text-willo-amber",
                    )}
                  >
                    {entry.status === "pago" ? <Check className="h-3 w-3" strokeWidth={3} /> : <Clock className="h-3 w-3" />}
                    {entry.status === "pago" ? (income ? "Recebido" : "Pago") : "Pendente"}
                  </span>
                )}
                {isPlan && (
                  <span className="text-[12.5px] t-soft">
                    parcela {entry.installmentNumber} de {entry.totalInstallments}
                    <span className="text-white/20"> · </span>
                    total <span className="tabular-nums">{fmt(entry.amount * (entry.totalInstallments ?? 1))}</span>
                  </span>
                )}
              </div>
            </div>

            {/* The facts, as lines. */}
            <div className="divide-y divide-white/[0.055] border-t border-white/[0.06] px-5">
              <Line label="Data" value={longDate(entry.date)} />
              {entry.time && <Line label="Horário" value={entry.time} />}
              <button
                type="button"
                onClick={() => onEdit(entry.transactionId)}
                className="flex w-full items-center gap-3 py-3.5 text-left active:opacity-70"
              >
                <span className="shrink-0 text-[13.5px] t-soft">Categoria</span>
                <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
                  <CatIcon className="h-[15px] w-[15px] shrink-0" style={{ color: catHex }} />
                  <span className="truncate text-[14px] text-white">{entry.category}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 t-faint" />
                </span>
              </button>
            </div>

            {entry.status === "pendente" && onToggleStatus && !asking && (
              <div className="px-5 pt-4">
                <button
                  type="button"
                  onClick={() => onToggleStatus(entry.transactionId, "pago")}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-white py-3.5 text-[15px] font-bold willo-on-invert active:opacity-80"
                >
                  <Check className="h-4 w-4" strokeWidth={3} />
                  {income ? "Marcar como recebida" : "Marcar como paga"}
                </button>
              </div>
            )}

            {/* What you can do to it — written out, and the question asked in place. */}
            {asking ? (
              <div className="mt-3 border-t border-white/[0.07] p-4">
                <div className="flex items-start gap-2.5 px-1 pb-3">
                  <AlertTriangle className="mt-[1px] h-4 w-4 shrink-0 text-red-400" />
                  <p className="text-[12.5px] leading-snug text-white/78">
                    {isPlan
                      ? "Isso remove a compra inteira, com todas as parcelas."
                      : "Isso não pode ser desfeito."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onDelete(entry.transactionId)}
                  className="h-11 w-full rounded-[14px] bg-red-500 text-[14.5px] font-bold text-white active:opacity-80"
                >
                  Excluir
                </button>
                <button
                  type="button"
                  onClick={() => setAsking(false)}
                  className="mt-2 h-11 w-full rounded-[14px] bg-white/[0.07] text-[14.5px] font-semibold text-white active:opacity-70"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <div className="mt-3 border-t border-white/[0.07]">
                <MenuRow icon={Pencil} label="Editar" onClick={() => onEdit(entry.transactionId)} />
                <MenuRow icon={Trash2} label="Excluir" danger onClick={() => setAsking(true)} />
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return typeof document !== "undefined" ? createPortal(content, document.body) : null;
}

const Line = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center gap-3 py-3.5">
    <span className="shrink-0 text-[13.5px] t-soft">{label}</span>
    <span className="min-w-0 flex-1 truncate text-right text-[14px] text-white">{value}</span>
  </div>
);
