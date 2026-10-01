import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, FileText, Layers, RotateCcw, Check } from "lucide-react";
import { getDefaultCategoryIcon } from "@/lib/categoryIcons";
import { getCategoryHexColor } from "@/lib/categoryUtils";
import { getCurrency } from "@/lib/currency";
import type { ExtractedItem } from "./InvoiceUploadReviewModal";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });

const PHASES = [
  "Abrindo o arquivo",
  "Lendo as compras",
  "Separando parcelamentos",
  "Conferindo estornos",
  "Sugerindo categorias",
];

/** Steady rhythm for the reveal, but never so slow that a long statement drags. */
const revealStep = (count: number) => Math.max(45, Math.min(130, 2600 / Math.max(count, 1)));

const PAGE_ROWS = [96, 64, 88, 52, 92, 70, 84, 58, 76];

function ReadingState() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setPhase((p) => Math.min(p + 1, PHASES.length - 1)), 3200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center px-8">
      {/* Ambient light behind the page */}
      <motion.span
        className="pointer-events-none absolute left-1/2 top-[40%] h-[340px] w-[340px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-willo-green/[0.09] blur-[90px]"
        animate={{ opacity: [0.5, 1, 0.5], scale: [0.94, 1.04, 0.94] }}
        transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        className="relative"
        initial={{ opacity: 0, y: 14, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 22 }}
      >
        {/* Pages stacked behind, for depth */}
        <span className="absolute -right-2.5 top-2 h-full w-full rotate-[5deg] rounded-[20px] border border-white/[0.06] bg-white/[0.02]" />
        <span className="absolute -left-2 top-1 h-full w-full -rotate-[3deg] rounded-[20px] border border-white/[0.05] bg-white/[0.015]" />

        <div className="relative h-56 w-44 overflow-hidden rounded-[20px] border border-white/[0.12] bg-gradient-to-b from-white/[0.08] via-white/[0.03] to-white/[0.015] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)]">
          {/* Statement header */}
          <div className="flex items-center gap-1.5 px-4 pt-4">
            <span className="h-4 w-4 rounded-[5px] bg-white/25" />
            <span className="h-1.5 w-12 rounded-full bg-white/20" />
          </div>
          <span className="mx-4 mt-3 block h-px bg-white/10" />

          <div className="mt-3.5 space-y-[9px] px-4">
            {PAGE_ROWS.map((w, i) => (
              <motion.span
                key={i}
                className="flex items-center gap-1.5"
                animate={{ opacity: [0.45, 1, 0.45] }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.13, ease: "easeInOut" }}
              >
                <span className="h-[5px] flex-1 rounded-full bg-white/35" style={{ maxWidth: `${w}%` }} />
                <span className="h-[5px] w-5 rounded-full bg-white/20" />
              </motion.span>
            ))}
          </div>

          {/* Scanning beam */}
          <motion.div
            className="absolute inset-x-0"
            initial={{ top: "-14%" }}
            animate={{ top: ["-14%", "92%", "-14%"] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="h-16 bg-gradient-to-b from-transparent to-willo-green/[0.18]" />
            <div className="h-px w-full bg-willo-green shadow-[0_0_14px_3px_rgba(200,243,109,0.55)]" />
            <div className="h-10 bg-gradient-to-b from-willo-green/[0.10] to-transparent" />
          </motion.div>
        </div>
      </motion.div>

      <div className="relative mt-10 h-6 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.p
            key={phase}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="text-[18px] font-semibold tracking-tight text-white"
          >
            {PHASES[phase]}…
          </motion.p>
        </AnimatePresence>
      </div>
      <p className="relative mt-2 text-center text-[13px] text-white/35">Costuma levar uns 20 segundos</p>

      <div className="relative mt-8 h-[3px] w-44 overflow-hidden rounded-full bg-white/[0.08]">
        <motion.span
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-willo-green/70 to-willo-green"
          animate={{ width: `${((phase + 1) / PHASES.length) * 100}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 24 }}
        />
      </div>
    </div>
  );
}

function FoundList({ items, onDone }: { items: ExtractedItem[]; onDone: () => void }) {
  const [shown, setShown] = useState(0);
  const step = revealStep(items.length);

  useEffect(() => {
    if (shown >= items.length) return;
    const id = setTimeout(() => setShown((n) => n + 1), shown === 0 ? 220 : step);
    return () => clearTimeout(id);
  }, [shown, items.length, step]);

  const done = shown >= items.length;
  const visible = items.slice(0, shown);
  const running = visible.reduce((sum, i) => sum + i.amount, 0);
  const plans = visible.filter((i) => (i.installment_total ?? 0) > 1).length;
  const refunds = visible.filter((i) => i.amount < 0).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative shrink-0 px-5 pt-3 text-center">
        <motion.span
          className="pointer-events-none absolute left-1/2 top-8 h-40 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-willo-green/[0.10] blur-[70px]"
          animate={{ opacity: done ? 1 : [0.6, 1, 0.6] }}
          transition={{ duration: 2, repeat: done ? 0 : Infinity, ease: "easeInOut" }}
        />
        <motion.p
          key={shown}
          initial={{ scale: 1.14 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 420, damping: 17 }}
          className="relative bg-gradient-to-b from-white to-white/70 bg-clip-text text-[52px] font-extrabold leading-none tracking-tighter text-transparent tabular-nums"
        >
          {shown}
        </motion.p>
        <p className="relative mt-2 text-[13.5px] tracking-tight text-white/45">
          {done ? "lançamentos encontrados" : "lendo os lançamentos…"}
        </p>

        <div className="relative mt-4 flex items-center justify-center gap-1.5">
          <span className="rounded-full border border-white/[0.12] bg-white/[0.04] px-3 py-1.5 text-[12px] font-semibold tabular-nums text-white">
            {fmt(running)}
          </span>
          {plans > 0 && (
            <motion.span
              layout
              className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.04] px-3 py-1.5 text-[12px] text-white/70"
            >
              <Layers className="h-3 w-3" /> {plans}
            </motion.span>
          )}
          {refunds > 0 && (
            <motion.span
              layout
              className="inline-flex items-center gap-1.5 rounded-full border border-willo-green/20 bg-willo-green/[0.08] px-3 py-1.5 text-[12px] text-willo-green"
            >
              <RotateCcw className="h-3 w-3" /> {refunds}
            </motion.span>
          )}
        </div>
      </div>

      <div className="mt-5 min-h-0 flex-1 overflow-y-auto overscroll-contain px-4">
        <div className="space-y-1.5 pb-4">
          <AnimatePresence initial={false}>
            {[...visible].reverse().map((item, i) => {
              const key = `${items.length - 1 - i}`;
              const Icon = getDefaultCategoryIcon(item.category);
              const hex = getCategoryHexColor(item.category, []);
              const isRefund = item.amount < 0;
              return (
                <motion.div
                  key={key}
                  layout
                  initial={{ opacity: 0, y: -14, scale: 0.96, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                  transition={{ type: "spring", stiffness: 430, damping: 32 }}
                  className="flex items-center gap-3 rounded-[18px] border border-white/[0.12] bg-gradient-to-b from-[#171717] to-[#131313] px-3.5 py-2.5 shadow-[0_6px_20px_-12px_rgba(0,0,0,0.9)]"
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1 ring-inset"
                    style={{ background: `${hex}18`, color: hex, boxShadow: `inset 0 0 0 1px ${hex}22` }}
                  >
                    <Icon className="h-4 w-4" style={{ color: hex }} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] tracking-tight text-white">{item.description}</span>
                    <span className="block truncate text-[11.5px] text-white/40">
                      {item.category}
                      {item.installment_total && item.installment_total > 1 && ` · ${item.installment_current ?? 1}/${item.installment_total}`}
                      {isRefund && " · estorno"}
                    </span>
                  </span>
                  <span className={`shrink-0 text-[14px] font-semibold tabular-nums ${isRefund ? "text-willo-green" : "text-white"}`}>
                    {isRefund ? "+" : ""}{fmt(Math.abs(item.amount))}
                  </span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      <div className="shrink-0 px-4 pt-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)" }}>
        <button
          type="button"
          onClick={onDone}
          disabled={!done}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-white text-[16px] font-bold text-[#0B0B0B] transition-opacity disabled:opacity-30"
        >
          <Check className="h-4 w-4" strokeWidth={3} />
          {done ? `Revisar ${items.length} lançamento${items.length === 1 ? "" : "s"}` : "Lendo…"}
        </button>
      </div>
    </div>
  );
}

/** Reading a statement: the scan animation first, then every line found, one by one. */
export default function InvoiceScanScreen({ open, items, onClose, onDone }: {
  open: boolean;
  /** null while the AI is still reading. */
  items: ExtractedItem[] | null;
  onClose: () => void;
  onDone: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="willo-bg fixed inset-0 z-[70] flex flex-col md:inset-auto md:left-1/2 md:top-1/2 md:h-[88vh] md:w-[440px] md:-translate-x-1/2 md:-translate-y-1/2 md:overflow-hidden md:rounded-[32px] md:border md:border-white/[0.12]"
        >
          <div className="shrink-0 px-4" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 10px)" }}>
            <div className="flex h-11 items-center justify-between">
              <button onClick={onClose} aria-label="Cancelar" className="-ml-1 flex h-10 w-10 items-center justify-center rounded-full text-white/70 active:opacity-60">
                <X className="h-6 w-6" />
              </button>
              <span className="text-[16px] font-semibold text-white">Lendo a fatura</span>
              <span className="w-10" />
            </div>
          </div>

          {items === null ? <ReadingState /> : <FoundList items={items} onDone={onDone} />}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
