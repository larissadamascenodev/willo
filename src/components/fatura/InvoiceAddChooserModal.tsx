import { useRef, useState, type ComponentType } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PenLine, Camera, Images, FolderUp, ChevronLeft, ChevronRight, Sparkles, Upload } from "lucide-react";
import BottomSheet from "@/components/shared/BottomSheet";

/** "invoice" reads a whole statement; "single" reads one purchase. */
export type ScanMode = "invoice" | "single";

interface Props {
  open: boolean;
  onClose: () => void;
  onManual: () => void;
  onScan: (file: File, mode: ScanMode) => void;
}

type Option = {
  icon: ComponentType<{ className?: string; style?: React.CSSProperties }>;
  hex: string;
  label: string;
  description: string;
  onClick: () => void;
};

const OptionRow = ({ option, index }: { option: Option; index: number }) => (
  <motion.button
    type="button"
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.05, type: "spring", stiffness: 320, damping: 26 }}
    onClick={option.onClick}
    className="flex w-full items-center gap-3.5 rounded-[22px] border border-white/[0.08] willo-glass-inset px-4 py-4 text-left active:scale-[0.99]"
  >
    <span
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
      style={{ background: `${option.hex}1A` }}
    >
      <option.icon className="h-5 w-5" style={{ color: option.hex }} />
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-[15px] font-semibold text-white">{option.label}</span>
      <span className="block text-[12.5px] leading-snug text-white/62">{option.description}</span>
    </span>
    <ChevronRight className="h-4 w-4 shrink-0 t-faint" />
  </motion.button>
);

/**
 * How a purchase gets onto this card: you write it, or you hand over a picture of it.
 *
 * It used to ask a third question first — whether the file was a whole statement or a
 * single receipt — which is a question about how the reader works, not about what you
 * have in your hand. The reader finds what is there either way, and nothing is written
 * until the review screen, so the question is gone.
 */
export default function InvoiceAddChooserModal({ open, onClose, onManual, onScan }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

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
      hex: "#C8F36D",
      label: "Digitar manualmente",
      description: "Nome, valor, parcelas e categoria",
      onClick: () => { onManual(); handleClose(); },
    },
    {
      icon: Upload,
      hex: "#7DD3FC",
      label: "Fazer upload",
      description: "Foto, print ou PDF — a IA lê as compras",
      onClick: () => setUploading(true),
    },
  ];

  const sourceOptions: Option[] = [
    {
      icon: Camera,
      hex: "#C8F36D",
      label: "Tirar foto",
      description: "Usar a câmera agora",
      onClick: () => cameraRef.current?.click(),
    },
    {
      icon: Images,
      hex: "#7DD3FC",
      label: "Galeria",
      description: "Print ou foto salva no aparelho",
      onClick: () => galleryRef.current?.click(),
    },
    {
      icon: FolderUp,
      hex: "#FFFFFF",
      label: "Escolher arquivo",
      description: "PDF da fatura, planilha CSV ou Excel",
      onClick: () => fileRef.current?.click(),
    },
  ];

  return (
    <BottomSheet open={open} onClose={handleClose}>
      <div className="px-5 pb-2">
        <div className="flex items-start gap-2.5">
          {uploading && (
            <button
              type="button"
              onClick={() => setUploading(false)}
              aria-label="Voltar"
              className="-ml-1.5 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/74 active:opacity-60"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-[22px] font-extrabold tracking-tight text-white">
              {uploading ? "De onde vem" : "Adicionar lançamento"}
            </h2>
            <p className="mt-1 text-[13px] leading-snug text-white/62">
              {uploading
                ? "Foto da fatura, print de uma compra ou o PDF do banco."
                : "Escolha como quer registrar esse gasto no cartão."}
            </p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={uploading ? "source" : "main"}
            initial={{ opacity: 0, x: uploading ? 16 : -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="mt-5 space-y-2.5"
          >
            {(uploading ? sourceOptions : mainOptions).map((option, i) => (
              <OptionRow key={option.label} option={option} index={i} />
            ))}
          </motion.div>
        </AnimatePresence>

        {uploading && (
          <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[12px] t-softer">
            <Sparkles className="h-3.5 w-3.5" /> Você confere tudo antes de importar
          </p>
        )}
      </div>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleInputChange} />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={handleInputChange} />
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.csv,.xls,.xlsx,image/*"
        className="hidden"
        onChange={handleInputChange}
      />
    </BottomSheet>
  );
}
