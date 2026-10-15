import { useEffect, useRef, useState, type ComponentType } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { PenLine, Camera, Images, FolderUp, ChevronLeft, ChevronRight, Sparkles, Upload, X } from "lucide-react";
import { shade, withAlpha } from "@/components/wallet/CardFaceTile";
import { useScrollLock } from "@/hooks/useScrollLock";

/** "invoice" reads a whole statement; "single" reads one purchase. */
export type ScanMode = "invoice" | "single";

interface Props {
  open: boolean;
  onClose: () => void;
  onManual: () => void;
  onScan: (file: File, mode: ScanMode) => void;
  /** Whose invoice this is — the sheet belongs to a card, so it says which. */
  cardName?: string;
  /** The card's colour, which the sheet borrows the way the rest of the screen does. */
  hex: string;
}

type Option = {
  icon: ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  description: string;
  tone: string;
  onClick: () => void;
};

/**
 * How a purchase gets onto this card.
 *
 * It used to be the app's generic sheet: a flat panel, two rows in borrowed colours,
 * arriving over a card screen it had nothing to do with. A sheet opened from a card
 * belongs to that card — so this one is glass the screen shows through, lit by the
 * bank's own colour, and it names the card at the top.
 *
 * It also used to ask a third question first: whether the file was a whole statement
 * or a single receipt. That is a question about how the reader works, not about what
 * you have in your hand. The reader finds what is there either way, and nothing is
 * written until the review screen, so the question is gone.
 */
export default function InvoiceAddChooserModal({ open, onClose, onManual, onScan, cardName, hex }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  useScrollLock(open);
  useEffect(() => {
    if (!open) setUploading(false);
  }, [open]);

  const light = shade(hex, 0.55);

  const handleClose = () => {
    setUploading(false);
    onClose();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    onScan(file, "invoice");
    handleClose();
  };

  const mainOptions: Option[] = [
    {
      icon: PenLine,
      label: "Digitar manualmente",
      description: "Nome, valor, parcelas e categoria",
      tone: hex,
      onClick: () => { onManual(); handleClose(); },
    },
    {
      icon: Upload,
      label: "Fazer upload",
      description: "Foto, print ou PDF — a IA lê as compras",
      tone: light,
      onClick: () => setUploading(true),
    },
  ];

  const sourceOptions: Option[] = [
    {
      icon: Camera,
      label: "Tirar foto",
      description: "Usar a câmera agora",
      tone: hex,
      onClick: () => cameraRef.current?.click(),
    },
    {
      icon: Images,
      label: "Galeria",
      description: "Print ou foto salva no aparelho",
      tone: light,
      onClick: () => galleryRef.current?.click(),
    },
    {
      icon: FolderUp,
      label: "Escolher arquivo",
      description: "PDF da fatura, planilha CSV ou Excel",
      tone: "#FFFFFF",
      onClick: () => fileRef.current?.click(),
    },
  ];

  const options = uploading ? sourceOptions : mainOptions;

  const content = (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[74] flex items-end justify-center px-4 pb-5 sm:items-center sm:pb-0">
          <motion.div
            className="absolute inset-0 bg-black/55 backdrop-blur-[14px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
          />

          <motion.div
            role="dialog"
            aria-modal
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
            className="relative w-full max-w-md overflow-hidden rounded-[30px] border border-white/[0.10]"
            style={{
              /* Glass the screen shows through, rather than a panel laid over it. */
              background: "rgba(18, 18, 21, 0.62)",
              backdropFilter: "blur(38px) saturate(150%)",
              WebkitBackdropFilter: "blur(38px) saturate(150%)",
              boxShadow: "0 40px 90px -30px rgb(0 0 0 / 0.95), inset 0 1px 0 rgb(255 255 255 / 0.10)",
            }}
          >
            {/* The card's own light, inside the glass */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full blur-[64px]"
              style={{ background: hex, opacity: 0.3 }}
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-24 -left-16 h-52 w-52 rounded-full blur-[64px]"
              style={{ background: hex, opacity: 0.14 }}
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-10 top-0 h-px"
              style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)" }}
            />

            <div className="relative px-5 pb-5 pt-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  {uploading ? (
                    <button
                      type="button"
                      onClick={() => setUploading(false)}
                      aria-label="Voltar"
                      className="-ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-white/80 active:opacity-60"
                    >
                      <ChevronLeft className="h-[18px] w-[18px]" />
                    </button>
                  ) : (
                    <span
                      className="flex h-[22px] w-[30px] shrink-0 items-center justify-center rounded-[6px]"
                      style={{ background: hex, boxShadow: `0 8px 18px -8px ${hex}` }}
                    >
                      <span className="h-[5px] w-[8px] rounded-[1.5px] bg-white/85" />
                    </span>
                  )}
                  <p className="truncate text-[12.5px] font-semibold uppercase tracking-[0.1em] text-white/70">
                    {cardName ?? "Cartão"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleClose}
                  aria-label="Fechar"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-white/74 active:opacity-60"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <h2 className="mt-4 text-[24px] font-extrabold leading-tight tracking-[-0.03em] text-white">
                {uploading ? "De onde vem" : "Adicionar lançamento"}
              </h2>
              <p className="mt-1.5 text-[13px] leading-snug text-white/60">
                {uploading
                  ? "Foto da fatura, print de uma compra ou o PDF do banco."
                  : "Como você quer registrar esse gasto no cartão."}
              </p>

              <AnimatePresence mode="wait">
                <motion.div
                  key={uploading ? "source" : "main"}
                  initial={{ opacity: 0, x: uploading ? 18 : -18 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="mt-5 space-y-2.5"
                >
                  {options.map((option, i) => (
                    <motion.button
                      key={option.label}
                      type="button"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.04 + i * 0.05, type: "spring", stiffness: 320, damping: 26 }}
                      onClick={option.onClick}
                      className="flex w-full items-center gap-3.5 rounded-[22px] border border-white/[0.08] bg-white/[0.05] px-4 py-3.5 text-left transition-colors active:bg-white/[0.09]"
                      style={{ boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.06)" }}
                    >
                      <span
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]"
                        style={{
                          background: withAlpha(option.tone, 0.18),
                          boxShadow: `inset 0 0 0 1px ${withAlpha(option.tone, 0.26)}`,
                        }}
                      >
                        <option.icon className="h-5 w-5" style={{ color: option.tone }} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-semibold text-white">{option.label}</span>
                        <span className="block text-[12.5px] leading-snug text-white/60">
                          {option.description}
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 t-faint" />
                    </motion.button>
                  ))}
                </motion.div>
              </AnimatePresence>

              {uploading && (
                <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[12px] t-softer">
                  <Sparkles className="h-3.5 w-3.5" /> Você confere tudo antes de importar
                </p>
              )}
            </div>
          </motion.div>

          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleInputChange} />
          <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={handleInputChange} />
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.csv,.xls,.xlsx,image/*"
            className="hidden"
            onChange={handleInputChange}
          />
        </div>
      )}
    </AnimatePresence>
  );

  return typeof document !== "undefined" ? createPortal(content, document.body) : null;
}
