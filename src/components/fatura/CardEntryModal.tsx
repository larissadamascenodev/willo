import { useState, useEffect, type ComponentType } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { X, Pencil, Trash2, Calendar, Clock, Tag, CreditCard, Layers, ChevronRight, AlertTriangle } from "lucide-react";
import { getCustomCategories, type CustomCategory } from "@/services/categoryService";
import { getCategoryHexColor } from "@/lib/categoryUtils";
import { getDefaultCategoryIcon } from "@/lib/categoryIcons";
import { getIconComponent } from "@/components/dashboard/CategoryCreateModal";
import { getCurrency } from "@/lib/currency";


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
}

/**
 * A purchase on a card is settled by the statement, not on its own — so this has no
 * paid/pending switch. It shows what the purchase was and gets out of the way.
 */
export default function CardEntryModal({ entry, cardName, onClose, onEdit, onDelete }: {
  entry: CardEntry | null;
  cardName?: string;
  onClose: () => void;
  onEdit: (transactionId: string) => void;
  onDelete: (transactionId: string) => void;
}) {
  const [customCats, setCustomCats] = useState<CustomCategory[]>([]);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (entry) {
      getCustomCategories().then(setCustomCats).catch(() => {});
      setConfirmingDelete(false);
    }
  }, [entry]);

  const open = !!entry;
  const custom = entry ? customCats.find((c) => c.name === entry.category) : undefined;
  const CatIcon = custom ? getIconComponent(custom.icon) : getDefaultCategoryIcon(entry?.category ?? "");
  const catHex = getCategoryHexColor(entry?.category ?? "", customCats);
  const isPlan = !!(entry?.totalInstallments && entry.totalInstallments > 1);

  const content = (
    <AnimatePresence>
      {open && entry && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center px-5">
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", stiffness: 340, damping: 26 }}
            className="relative w-full max-w-sm overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#141414] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]"
          >
            <span
              className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full blur-[60px]"
              style={{ background: catHex, opacity: 0.22 }}
            />

            <div className="relative px-5 pt-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px]" style={{ background: `${catHex}1F` }}>
                    <CatIcon className="h-5 w-5" style={{ color: catHex }} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[17px] font-bold tracking-tight text-white">{entry.name}</p>
                    <p className="flex items-center gap-1.5 truncate text-[12px] text-white/45">
                      <CreditCard className="h-3.5 w-3.5 shrink-0" /> {cardName ?? "Cartão"}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onEdit(entry.transactionId)}
                    aria-label="Editar"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-white/70 active:opacity-60"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Fechar"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-white/60 active:opacity-60"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <p className="relative mt-5 text-center text-[42px] font-extrabold leading-none tracking-tighter text-white tabular-nums">
                {fmt(entry.amount)}
              </p>
              {isPlan && (
                <p className="mt-2 text-center text-[12.5px] text-white/45">
                  parcela {entry.installmentNumber} de {entry.totalInstallments} · total {fmt(entry.amount * (entry.totalInstallments ?? 1))}
                </p>
              )}
            </div>

            <div className="relative mt-5 divide-y divide-white/[0.06] border-t border-white/[0.06]">
              <Line icon={Calendar} label="Data" value={longDate(entry.date)} />
              {entry.time && <Line icon={Clock} label="Horário" value={entry.time} />}
              <button
                type="button"
                onClick={() => onEdit(entry.transactionId)}
                className="flex w-full items-center gap-3 px-5 py-3.5 text-left active:bg-white/[0.03]"
              >
                <Tag className="h-4 w-4 shrink-0 text-white/40" />
                <span className="shrink-0 text-[14px] text-white/55">Categoria</span>
                <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
                  <CatIcon className="h-4 w-4 shrink-0" style={{ color: catHex }} />
                  <span className="truncate text-[14px] text-white">{entry.category}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-white/25" />
                </span>
              </button>
              {isPlan && (
                <Line icon={Layers} label="Parcela" value={`${entry.installmentNumber} de ${entry.totalInstallments}`} />
              )}
            </div>

            {!confirmingDelete ? (
              <div className="relative grid grid-cols-2 gap-2.5 p-5">
                <button
                  type="button"
                  onClick={() => onEdit(entry.transactionId)}
                  className="flex h-12 items-center justify-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] text-[14px] font-semibold text-white active:opacity-70"
                >
                  <Pencil className="h-4 w-4" /> Editar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  className="flex h-12 items-center justify-center gap-2 rounded-full border border-red-400/20 bg-red-400/[0.08] text-[14px] font-semibold text-red-400 active:opacity-70"
                >
                  <Trash2 className="h-4 w-4" /> Excluir
                </button>
              </div>
            ) : (
              <div className="relative p-5">
                <div className="flex items-start gap-3 rounded-[18px] border border-red-400/20 bg-red-400/[0.06] px-4 py-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                  <p className="text-[13px] leading-snug text-white/70">
                    {isPlan
                      ? `Isso remove a compra inteira, com as ${entry.totalInstallments} parcelas.`
                      : "Essa compra será removida da fatura."}
                  </p>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    className="h-12 rounded-full border border-white/[0.08] bg-white/[0.04] text-[14px] font-semibold text-white"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(entry.transactionId)}
                    className="h-12 rounded-full bg-red-500 text-[14px] font-bold text-white"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return typeof document !== "undefined" ? createPortal(content, document.body) : null;
}

const Line = ({ icon: Icon, label, value }: { icon: ComponentType<{ className?: string }>; label: string; value: string }) => (
  <div className="flex items-center gap-3 px-5 py-3.5">
    <Icon className="h-4 w-4 shrink-0 text-white/40" />
    <span className="shrink-0 text-[14px] text-white/55">{label}</span>
    <span className="min-w-0 flex-1 truncate text-right text-[14px] text-white">{value}</span>
  </div>
);
