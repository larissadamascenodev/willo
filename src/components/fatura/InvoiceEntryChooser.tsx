import { useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, PenLine, Upload, X } from "lucide-react";

/**
 * What "add to this statement" can mean. Writing one down and handing over a photo of
 * the whole bill are the two real answers, so they are the two options; the phone
 * itself then asks whether the upload is a picture or a file, which is a question it
 * answers better than a menu of ours would.
 */
export default function InvoiceEntryChooser({ open, onClose, onManual, onFile }: {
  open: boolean;
  onClose: () => void;
  onManual: () => void;
  onFile: (file: File) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const options = [
    {
      key: "manual",
      icon: PenLine,
      hex: "#C8F36D",
      label: "Adicionar manualmente",
      hint: "Receita, despesa ou transferência",
      onClick: onManual,
    },
    {
      key: "upload",
      icon: Upload,
      hex: "#7DD3FC",
      label: "Fazer upload",
      hint: "Foto ou PDF da fatura",
      onClick: () => fileRef.current?.click(),
    },
  ];

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[72] flex items-center justify-center px-5">
          <motion.div
            className="absolute inset-0 bg-black/66 backdrop-blur-[20px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-label="Novo lançamento"
            initial={{ opacity: 0, scale: 0.96, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 14 }}
            transition={{ type: "spring", damping: 26, stiffness: 340 }}
            className="relative w-full max-w-sm overflow-hidden rounded-[28px] border border-white/[0.08] willo-glass-strong shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]"
          >
            <div className="flex items-center justify-between gap-3 px-5 pb-1 pt-5">
              <p className="text-[17px] font-bold tracking-tight text-white">Novo lançamento</p>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-white/74 active:opacity-60"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2.5 p-5 pt-4">
              {options.map((o, i) => {
                const Icon = o.icon;
                return (
                  <motion.button
                    key={o.key}
                    type="button"
                    onClick={o.onClick}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.04 + i * 0.05, type: "spring", stiffness: 320, damping: 26 }}
                    className="flex w-full items-center gap-3.5 rounded-[22px] border border-white/[0.08] bg-white/[0.04] px-4 py-4 text-left active:scale-[0.99]"
                  >
                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                      style={{ background: `${o.hex}1A` }}
                    >
                      <Icon className="h-5 w-5" style={{ color: o.hex }} strokeWidth={2.1} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold text-white">{o.label}</span>
                      <span className="block text-[12.5px] leading-snug text-white/55">{o.hint}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-white/30" />
                  </motion.button>
                );
              })}
            </div>
          </motion.div>

          {/* No capture attribute: that is what makes the phone offer its own camera,
              library and files sheet instead of jumping straight to one of them. */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) onFile(file);
            }}
          />
        </div>
      )}
    </AnimatePresence>
  );
}
