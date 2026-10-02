import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, Keyboard } from "lucide-react";
import ScanResultCard, { type ScanAccount, type ScanResultItem } from "./ScanResultCard";

interface Props<T extends ScanResultItem> {
  open: boolean;
  photoUrl: string | null;
  /** null while the AI is still reading the receipt. */
  items: T[] | null;
  onItemsChange: (items: T[]) => void;
  accounts: ScanAccount[];
  accountId: string | null;
  onAccountChange: (id: string) => void;
  lowConfidence?: boolean;
  confirming?: boolean;
  onClose: () => void;
  onConfirm: () => void;
  /** Drawn instead of the photo (the welcome/onboarding demos use a drawn receipt). */
  backdrop?: React.ReactNode;
  /** Status pill text while reading. */
  readingLabel?: string;
  /** Overrides the confirm button label. */
  confirmLabel?: string;
  /** Extra room above the back button (px), for a drawn status bar. */
  topInset?: number;
  /** Overrides the result title. */
  resultTitle?: string;
}

/** Four white corners framing what the AI is reading, breathing slowly. */
export const ScanBrackets = () => (
  <motion.div
    className="pointer-events-none absolute inset-x-[9%] top-[22%] bottom-[31%]"
    initial={{ opacity: 0, scale: 1.08 }}
    animate={{ opacity: 1, scale: [1, 1.02, 1] }}
    exit={{ opacity: 0 }}
    transition={{ opacity: { duration: 0.3 }, scale: { duration: 2.4, repeat: Infinity, ease: "easeInOut" } }}
  >
    {[
      "left-0 top-0 border-l-[3px] border-t-[3px] rounded-tl-[18px]",
      "right-0 top-0 border-r-[3px] border-t-[3px] rounded-tr-[18px]",
      "left-0 bottom-0 border-l-[3px] border-b-[3px] rounded-bl-[18px]",
      "right-0 bottom-0 border-r-[3px] border-b-[3px] rounded-br-[18px]",
    ].map((c) => (
      <span key={c} className={`absolute h-12 w-12 border-white ${c}`} />
    ))}
    {/* Soft light passing inside the frame */}
    <motion.span
      className="absolute inset-x-3 h-16 bg-gradient-to-b from-transparent via-white/[0.08] to-transparent"
      initial={{ top: "0%" }}
      animate={{ top: ["0%", "85%", "0%"] }}
      transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
    />
  </motion.div>
);

/** Black status pill with a pulsing dot, e.g. "LENDO O COMPROVANTE…". */
export const ScanStatusPill = ({ label = "Lendo o comprovante…" }: { label?: string }) => (
  <motion.span
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0 }}
    className="inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-black/85 px-5 py-3 text-[12px] font-semibold uppercase tracking-[0.2em] text-white"
  >
    <motion.span
      className="h-2 w-2 rounded-full bg-white"
      animate={{ opacity: [0.3, 1, 0.3] }}
      transition={{ duration: 1.2, repeat: Infinity }}
    />
    {label}
  </motion.span>
);

/** @deprecated kept for older callers — the brackets replaced the full-width sweep. */
export const ScanSweep = () => (
  <>
    <div className="absolute inset-0 bg-black/40" />
    <ScanBrackets />
  </>
);

/**
 * Full-screen receipt capture: the photo fills the screen, dimmed and framed
 * while the AI reads, then the result card slides up to confirm.
 */
function ScanCaptureScreen<T extends ScanResultItem>({
  open, photoUrl, items, onItemsChange, accounts, accountId, onAccountChange, lowConfidence, confirming, onClose, onConfirm,
  backdrop, readingLabel, confirmLabel, topInset = 0, resultTitle,
}: Props<T>) {
  const reading = !items;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] overflow-hidden bg-black"
        >
          {backdrop ?? (photoUrl && <img src={photoUrl} alt="Comprovante" className="absolute inset-0 h-full w-full object-cover" />)}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 to-transparent" />

          <AnimatePresence>
            {reading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40" />
            )}
          </AnimatePresence>
          <AnimatePresence>{reading && <ScanBrackets />}</AnimatePresence>

          <button
            type="button"
            onClick={onClose}
            aria-label="Voltar"
            className="absolute left-3 z-10 flex h-11 w-11 items-center justify-center rounded-full text-white active:opacity-60"
            style={{ top: `calc(env(safe-area-inset-top, 0px) + ${10 + topInset}px)` }}
          >
            <ChevronLeft className="h-7 w-7" strokeWidth={2.5} />
          </button>

          <AnimatePresence>
            {reading && (
              <div className="absolute inset-x-0 flex justify-center" style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 22%)" }}>
                <ScanStatusPill label={readingLabel} />
              </div>
            )}
          </AnimatePresence>

          {/* A way out when the receipt will not read, or there is no receipt at all. */}
          {!reading && !items && (
            <button
              type="button"
              onClick={() => {
                onClose();
                window.dispatchEvent(new CustomEvent("open-type-chooser"));
              }}
              className="absolute inset-x-0 z-10 mx-auto flex h-12 w-[216px] items-center justify-center gap-2 rounded-full border border-white/[0.22] willo-glass-control text-[15px] font-semibold text-white active:opacity-70"
              style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 28px)" }}
            >
              <Keyboard className="h-[18px] w-[18px]" strokeWidth={2} />
              Digitar manualmente
            </button>
          )}

          <AnimatePresence>
            {items && (
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", stiffness: 260, damping: 30 }}
                className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-[32px] bg-black"
                style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
              >
                <ScanResultCard
                  items={items}
                  onItemsChange={onItemsChange}
                  accounts={accounts}
                  accountId={accountId}
                  onAccountChange={onAccountChange}
                  lowConfidence={lowConfidence}
                  confirming={confirming}
                  onConfirm={onConfirm}
                  confirmLabel={confirmLabel}
                  title={resultTitle}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default ScanCaptureScreen;
