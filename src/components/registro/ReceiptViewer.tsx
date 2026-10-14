import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Download, Loader2, Share2, X } from "lucide-react";
import { toast } from "sonner";
import { useScrollLock } from "@/hooks/useScrollLock";
import { deliverReceipt, renderReceipt, type ReceiptItem } from "@/lib/receiptImage";

/**
 * The receipt, big enough to read and ready to leave.
 *
 * It shows the actual picture that would be shared rather than a styled copy of it, so
 * there is no gap between what the person approves here and what lands in the other
 * app. Both buttons act on that same image.
 */

export default function ReceiptViewer({ open, items, onClose }: {
  open: boolean;
  items: ReceiptItem[];
  onClose: () => void;
}) {
  useScrollLock(open);
  const [url, setUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || items.length === 0) return;
    let dead = false;
    let made: string | null = null;

    renderReceipt(items)
      .then((b) => {
        if (dead) return;
        made = URL.createObjectURL(b);
        setBlob(b);
        setUrl(made);
      })
      .catch(() => { if (!dead) toast.error("Não consegui montar o comprovante."); });

    return () => {
      dead = true;
      if (made) URL.revokeObjectURL(made);
      setUrl(null);
      setBlob(null);
    };
  }, [open, items]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const deliver = async () => {
    if (!blob || busy) return;
    setBusy(true);
    try {
      const how = await deliverReceipt(blob, `notinha-willo-${Date.now()}.png`);
      if (how === "downloaded") toast.success("Comprovante salvo.");
      if (how === "opened") toast.message("Abri o comprovante — segure para salvar.");
    } catch {
      toast.error("Não consegui compartilhar agora.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  // One device offers the share sheet, another only a download; the button says which.
  const canShare = typeof navigator !== "undefined" && !!navigator.canShare;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[140] flex flex-col bg-black/82 backdrop-blur-2xl"
        role="dialog"
        aria-label="Comprovante"
      >
        <div
          className="flex shrink-0 justify-end px-4"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
        >
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/85 ring-1 ring-white/15 backdrop-blur-md active:opacity-70"
          >
            <X className="h-[18px] w-[18px]" strokeWidth={2.4} />
          </button>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 py-4">
          {url ? (
            <motion.img
              key={url}
              src={url}
              alt="Comprovante"
              initial={{ opacity: 0, y: 14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="max-h-full w-full max-w-[330px] object-contain drop-shadow-[0_24px_48px_rgba(0,0,0,0.6)]"
            />
          ) : (
            <Loader2 className="h-6 w-6 animate-spin text-white/50" />
          )}
        </div>

        <div
          className="shrink-0 px-5"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 18px)" }}
        >
          <button
            onClick={deliver}
            disabled={!blob || busy}
            className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-willo-green text-[16px] font-bold tracking-[-0.01em] text-[#0B0B0B] transition-transform active:scale-[0.985] disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4.5 w-4.5 animate-spin" />
              : canShare ? <Share2 className="h-[18px] w-[18px]" strokeWidth={2.4} />
              : <Download className="h-[18px] w-[18px]" strokeWidth={2.4} />}
            {canShare ? "Compartilhar ou salvar" : "Salvar imagem"}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
