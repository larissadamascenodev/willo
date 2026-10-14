import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import { getCurrency } from "@/lib/currency";

/**
 * The slip of paper the entries land on while they are being worked out.
 *
 * Everything else in this screen is a conversation, which scrolls away. The receipt is
 * the one thing that stays put and accumulates, so at any moment the person can see
 * what the app believes it heard — and, because each line carries its own state, which
 * of those lines is already in the books and which is still waiting on an answer.
 *
 * It is paper-coloured on purpose. A dark card here would read as one more bubble in
 * the thread; a till receipt reads as the record the thread is producing.
 */

const PAPER = "#F1EDE4";

export type NotinhaStatus = "reading" | "asking" | "saving" | "saved" | "error";

export interface NotinhaLine {
  id: string;
  name: string;
  sub: string;
  amount: number;
  type: "despesa" | "receita";
  status: NotinhaStatus;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });

/** The torn bottom edge, drawn rather than masked so it renders the same everywhere. */
function TornEdge() {
  const teeth = 25;
  const w = 100 / teeth;
  let d = `M0,0 L100,0 L100,0.6`;
  for (let i = teeth; i >= 1; i--) {
    d += ` L${(i * w - w / 2).toFixed(2)},3 L${(i * w - w).toFixed(2)},0.6`;
  }
  d += " Z";
  return (
    <svg className="block w-full" viewBox="0 0 100 3" preserveAspectRatio="none" style={{ height: 9 }} aria-hidden="true">
      <path d={d} fill={PAPER} />
    </svg>
  );
}

function StatusMark({ status }: { status: NotinhaStatus }) {
  if (status === "saved") {
    return (
      <span className="flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-[5px] bg-[#1F9D55]">
        <Check className="h-3 w-3 text-white" strokeWidth={3.2} />
      </span>
    );
  }
  if (status === "error") {
    return <AlertCircle className="h-[17px] w-[17px] shrink-0 text-[#C0392B]" strokeWidth={2.4} />;
  }
  if (status === "asking") {
    return <span className="h-[17px] w-[17px] shrink-0 rounded-[5px] border-[1.5px] border-dashed border-[#9A958A]" />;
  }
  return <Loader2 className="h-[17px] w-[17px] shrink-0 animate-spin text-[#9A958A]" strokeWidth={2.4} />;
}

const subtitleFor = (line: NotinhaLine) => {
  if (line.status === "reading") return "anotando…";
  if (line.status === "saving") return "salvando…";
  if (line.status === "error") return "não consegui salvar";
  if (line.status === "asking") return line.sub ? `${line.sub} · aguardando` : "aguardando";
  return line.sub;
};

export default function Notinha({ lines }: { lines: NotinhaLine[] }) {
  if (lines.length === 0) return null;

  const saved = lines.filter((l) => l.status === "saved").length;
  const allSaved = saved === lines.length;
  const count = `${lines.length} ${lines.length === 1 ? "registro" : "registros"}${allSaved ? (lines.length === 1 ? " salvo" : " salvos") : ""}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="w-full"
    >
      <div className="rounded-t-[14px] px-[18px] pb-3 pt-4" style={{ background: PAPER }}>
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[11.5px] font-bold uppercase tracking-[0.19em] text-[#45423B]">Notinha</p>
          <p className="text-[12px] tabular-nums text-[#6E6A60]">{count}</p>
        </div>

        <div className="mt-2.5 border-t border-dashed border-[#C9C3B4]" />

        <AnimatePresence initial={false}>
          {lines.map((line) => (
            <motion.div
              key={line.id}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="flex items-start gap-2.5 py-2.5">
                <span className="pt-[3px]"><StatusMark status={line.status} /></span>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-[16px] font-semibold leading-tight ${line.status === "saved" ? "text-[#1C1A16]" : "text-[#7C776C]"}`}>
                    {line.name}
                  </p>
                  <p className="truncate text-[12.5px] leading-tight text-[#817C71]">{subtitleFor(line)}</p>
                </div>
                <p className={`shrink-0 text-[16px] font-bold tabular-nums ${line.status === "saved" ? "text-[#1C1A16]" : "text-[#7C776C]"}`}>
                  {line.type === "receita" ? "+" : "−"}{fmt(line.amount)}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {allSaved && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
            <div className="border-t border-dashed border-[#C9C3B4] pt-2.5">
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[#1F9D55]">
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
                Salvo no Willo
              </p>
            </div>
          </motion.div>
        )}
      </div>
      <TornEdge />
    </motion.div>
  );
}
