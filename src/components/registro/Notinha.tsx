import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, ArrowUpRight, Check } from "lucide-react";
import { getCurrency } from "@/lib/currency";

/**
 * The slip the entries land on while they are being worked out.
 *
 * Everything else on this screen is a conversation, which scrolls away. The receipt
 * stays and accumulates, so at any moment the person can see what the app believes it
 * heard and which lines are already in the books.
 *
 * It is glass rather than paper. A till receipt was the obvious drawing, but the app is
 * made of translucent surfaces and a cream rectangle in the middle of them would be a
 * quotation from somewhere else. The torn edge carries the idea on its own; the
 * material belongs here.
 *
 * While a line is still being read, the whole receipt shimmers instead of growing a
 * spinner — the thing itself is unfinished, and that is more honest than parking a
 * loader beside it.
 */

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });

export type NotinhaStatus = "reading" | "asking" | "saving" | "saved" | "error";

export interface NotinhaLine {
  id: string;
  name: string;
  sub: string;
  amount: number;
  type: "despesa" | "receita";
  status: NotinhaStatus;
}

/** The torn bottom edge, drawn rather than masked so it renders the same everywhere. */
function TornEdge() {
  const teeth = 26;
  const w = 100 / teeth;
  let d = "M0,0 L100,0 L100,0.5";
  for (let i = teeth; i >= 1; i--) {
    d += ` L${(i * w - w / 2).toFixed(2)},3 L${(i * w - w).toFixed(2)},0.5`;
  }
  d += " Z";
  return (
    <svg
      className="-mt-px block w-full"
      viewBox="0 0 100 3"
      preserveAspectRatio="none"
      style={{ height: 9 }}
      aria-hidden="true"
    >
      <path d={d} fill="rgba(255,255,255,0.062)" />
    </svg>
  );
}

function StatusMark({ status }: { status: NotinhaStatus }) {
  if (status === "saved") {
    return (
      <motion.span
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 520, damping: 22 }}
        className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-willo-green"
      >
        <Check className="h-3 w-3 text-[#0B0B0B]" strokeWidth={3.4} />
      </motion.span>
    );
  }
  if (status === "error") {
    return <AlertCircle className="h-[18px] w-[18px] shrink-0 text-[#F87171]" strokeWidth={2.4} />;
  }
  if (status === "asking") {
    return (
      <motion.span
        animate={{ opacity: [0.35, 0.9, 0.35] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        className="h-[18px] w-[18px] shrink-0 rounded-full border-[1.5px] border-dashed border-willo-green/70"
      />
    );
  }
  return <span className="h-[18px] w-[18px] shrink-0 rounded-full border-[1.5px] border-white/20" />;
}

const subtitleFor = (line: NotinhaLine) => {
  // By the time a line is drawn it has already been read; what it is doing is waiting
  // its turn behind whichever line is being asked about.
  if (line.status === "reading") return line.sub ? `${line.sub} · na fila` : "na fila";
  if (line.status === "saving") return "salvando…";
  if (line.status === "error") return "não consegui salvar";
  if (line.status === "asking") return line.sub ? `${line.sub} · falta uma coisa` : "falta uma coisa";
  return line.sub;
};

export default function Notinha({ lines, onOpen }: {
  lines: NotinhaLine[];
  /** Opens the shareable receipt. Only offered once something is actually filed. */
  onOpen?: () => void;
}) {
  if (lines.length === 0) return null;

  const savedCount = lines.filter((l) => l.status === "saved").length;
  const allSaved = savedCount === lines.length;
  const busy = lines.some((l) => l.status === "reading" || l.status === "saving");
  const total = lines.reduce((t, l) => t + (l.type === "receita" ? l.amount : -l.amount), 0);

  const Shell = allSaved && onOpen ? "button" : "div";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
      className="w-full"
    >
      <Shell
        {...(allSaved && onOpen ? { onClick: onOpen, type: "button" as const } : {})}
        className={`block w-full rounded-t-[18px] border border-b-0 border-white/[0.09] bg-white/[0.062] px-[18px] pb-3.5 pt-4 text-left backdrop-blur-xl ${
          busy ? "willo-shimmer" : ""
        } ${allSaved && onOpen ? "transition-transform active:scale-[0.985]" : ""}`}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] t-soft">Notinha</p>
          {allSaved && onOpen ? (
            <span className="flex items-center gap-1 text-[12px] font-semibold text-willo-green-ink">
              Ver comprovante
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.6} />
            </span>
          ) : (
            <span className="text-[12px] tabular-nums t-softer">
              {lines.length} {lines.length === 1 ? "registro" : "registros"}
            </span>
          )}
        </div>

        <div className="mt-3 border-t border-dashed border-white/[0.13]" />

        <AnimatePresence initial={false}>
          {lines.map((line) => (
            <motion.div
              key={line.id}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="flex items-start gap-3 py-3">
                <span className="pt-[3px]"><StatusMark status={line.status} /></span>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-[16px] font-semibold leading-tight tracking-[-0.01em] ${
                    line.status === "saved" ? "text-white" : "text-white/70"
                  }`}>
                    {line.name}
                  </p>
                  <p className="truncate text-[12.5px] leading-tight t-softer">{subtitleFor(line)}</p>
                </div>
                <p className={`shrink-0 text-[16px] font-bold tabular-nums tracking-[-0.02em] ${
                  line.status === "saved"
                    ? line.type === "receita" ? "text-willo-green-ink" : "text-white"
                    : "t-soft"
                }`}>
                  {line.type === "receita" ? "+" : "−"}{fmt(line.amount)}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {allSaved && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.3 }}
            className="border-t border-dashed border-white/[0.13] pt-3"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-willo-green-ink">
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
                Salvo no Willo
              </p>
              {lines.length > 1 && (
                <p className="text-[13px] font-bold tabular-nums text-white/75">
                  {total >= 0 ? "+" : "−"}{fmt(Math.abs(total))}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </Shell>
      <TornEdge />
    </motion.div>
  );
}
