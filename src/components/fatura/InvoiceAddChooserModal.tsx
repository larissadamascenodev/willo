import { useRef, useState, type ComponentType } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PenLine, FileText, Receipt, Camera, Images, FolderUp, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import BottomSheet from "@/components/shared/BottomSheet";

/** "invoice" reads a whole statement; "single" reads one purchase (a receipt or a cropped screenshot). */
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
    className="flex w-full items-center gap-3.5 rounded-[22px] border border-white/[0.07] bg-[#161616] px-4 py-4 text-left active:scale-[0.99]"
  >
    <span
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
      style={{ background: `${option.hex}1A` }}
    >
      <option.icon className="h-5 w-5" style={{ color: option.hex }} />
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-[15px] font-semibold text-white">{option.label}</span>
      <span className="block text-[12.5px] leading-snug text-white/45">{option.description}</span>
    </span>
    <ChevronRight className="h-4 w-4 shrink-0 text-white/25" />
  </motion.button>
);

export default function InvoiceAddChooserModal({ open, onClose, onManual, onScan }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [scanMode, setScanMode] = useState<ScanMode | null>(null);

  const handleClose = () => {
    setScanMode(null);
    onClose();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    onScan(file, scanMode ?? "invoice");
    handleClose();
  };

  const mainOptions: Option[] = [
    {
      icon: FileText,
      hex: "#C8F36D",
      label: "Fatura completa",
      description: "PDF ou foto da fatura — a IA lê todas as compras de uma vez",
      onClick: () => setScanMode("invoice"),
    },
    {
      icon: Receipt,
      hex: "#5ED8C8",
      label: "Uma compra só",
      description: "Print ou comprovante de um lançamento específico",
      onClick: () => setScanMode("single"),
    },
    {
      icon: PenLine,
      hex: "#FFFFFF",
      label: "Digitar manualmente",
      description: "Preencher nome, valor, parcelas e categoria",
      onClick: () => { onManual(); handleClose(); },
    },
  ];

  const scanOptions: Option[] = [
    {
      icon: FolderUp,
      hex: "#C8F36D",
      label: "Escolher arquivo",
      description: scanMode === "invoice" ? "PDF da fatura, planilha CSV ou Excel" : "PDF ou imagem do comprovante",
      onClick: () => fileRef.current?.click(),
    },
    {
      icon: Images,
      hex: "#5ED8C8",
      label: "Galeria",
      description: scanMode === "invoice" ? "Print da fatura salvo no aparelho" : "Print da compra salvo no aparelho",
      onClick: () => galleryRef.current?.click(),
    },
    {
      icon: Camera,
      hex: "#FFFFFF",
      label: "Tirar foto",
      description: "Usar a câmera agora",
      onClick: () => cameraRef.current?.click(),
    },
  ];

  const inScanStep = scanMode !== null;
  const title = !inScanStep
    ? "Adicionar lançamento"
    : scanMode === "invoice"
      ? "Enviar a fatura"
      : "Enviar a compra";
  const subtitle = !inScanStep
    ? "Escolha como quer registrar esse gasto no cartão."
    : scanMode === "invoice"
      ? "Parcelamentos em andamento entram a partir desta fatura — as parcelas já pagas não são lançadas."
      : "Serve para aquela compra que você acabou de fazer, sem precisar subir a fatura inteira.";

  return (
    <BottomSheet open={open} onClose={handleClose}>
      <div className="px-5 pb-2">
        <div className="flex items-start gap-2.5">
          {inScanStep && (
            <button
              type="button"
              onClick={() => setScanMode(null)}
              aria-label="Voltar"
              className="-ml-1.5 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/60 active:opacity-60"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-[22px] font-extrabold tracking-tight text-white">{title}</h2>
            <p className="mt-1 text-[13px] leading-snug text-white/45">{subtitle}</p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={scanMode ?? "main"}
            initial={{ opacity: 0, x: inScanStep ? 16 : -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="mt-5 space-y-2.5"
          >
            {(inScanStep ? scanOptions : mainOptions).map((option, i) => (
              <OptionRow key={option.label} option={option} index={i} />
            ))}
          </motion.div>
        </AnimatePresence>

        {inScanStep && (
          <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[12px] text-white/30">
            <Sparkles className="h-3.5 w-3.5" /> Você confere tudo antes de importar
          </p>
        )}
      </div>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleInputChange} />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={handleInputChange} />
      <input
        ref={fileRef}
        type="file"
        accept={scanMode === "single" ? ".pdf,image/*" : ".pdf,.csv,.xls,.xlsx,image/*"}
        className="hidden"
        onChange={handleInputChange}
      />
    </BottomSheet>
  );
}
