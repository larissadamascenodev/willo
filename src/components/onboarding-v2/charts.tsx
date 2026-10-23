import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { EstimateBadge } from "@/components/onboarding-v2/bits";
import { brl0 } from "@/components/onboarding-v2/money";
import { CORAL, VERDE_AGUA } from "@/components/onboarding-v2/tokens";

/**
 * Every picture in the onboarding, drawn by hand in SVG.
 *
 * No chart library: these are five fixed shapes, each animated by drawing its own line,
 * and a library would cost more than it saves — in bundle and in control over how the
 * line arrives. Anyone who asked for less motion gets the finished shape, immediately.
 */

const GREEN = VERDE_AGUA;
const WHITE = "rgba(255,255,255,0.72)";

/** A path that draws itself, or is simply there when motion is unwanted. */
function DrawnPath({ d, stroke, width = 3, delay = 0, dashed = false, duration = 1.3 }: {
  d: string;
  stroke: string;
  width?: number;
  delay?: number;
  dashed?: boolean;
  duration?: number;
}) {
  const still = useReducedMotion();
  return (
    <motion.path
      d={d}
      fill="none"
      stroke={stroke}
      strokeWidth={width}
      strokeLinecap="round"
      strokeDasharray={dashed ? "6 7" : undefined}
      initial={{ pathLength: still ? 1 : 0, opacity: still ? 1 : 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{
        pathLength: { delay, duration: still ? 0 : duration, ease: [0.22, 1, 0.36, 1] },
        opacity: { delay, duration: 0.2 },
      }}
    />
  );
}

function Grid({ w, h, lines = [0.25, 0.5, 0.75] }: { w: number; h: number; lines?: number[] }) {
  return (
    <>
      {lines.map((p) => (
        <line key={p} x1={0} x2={w} y1={h * p} y2={h * p} stroke="rgba(255,255,255,0.05)" />
      ))}
    </>
  );
}

function Legend({ color, label, dashed = false }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span
        className="h-[3px] w-6 rounded-full"
        style={
          dashed
            ? { backgroundImage: `repeating-linear-gradient(90deg, ${color} 0 5px, transparent 5px 10px)` }
            : { background: color }
        }
      />
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/66">{label}</span>
    </span>
  );
}

/* ── 4. Com o Willo x sem apoio ─────────────────────────────────────────────── */

export function EvolutionChart() {
  const W = 320;
  const H = 180;
  /* One line finds its way up; the other keeps spending the month it earns. */
  const comWillo = "M 10 158 C 70 142, 108 120, 158 92 S 248 44, 310 20";
  const semApoio = "M 10 158 C 48 126, 76 150, 112 132 S 176 158, 212 126 S 272 152, 310 140";

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Comparação ilustrativa entre usar o Willo e seguir sem apoio"
      >
        <defs>
          <linearGradient id="evo2-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={GREEN} stopOpacity="0.20" />
            <stop offset="100%" stopColor={GREEN} stopOpacity="0" />
          </linearGradient>
        </defs>
        <Grid w={W} h={H} />
        <motion.path
          d={`${comWillo} L 310 ${H} L 10 ${H} Z`}
          fill="url(#evo2-fill)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1, duration: 0.6 }}
        />
        <DrawnPath d={semApoio} stroke={WHITE} width={2.5} dashed delay={0.15} />
        <DrawnPath d={comWillo} stroke={GREEN} width={3.5} delay={0.4} />
      </svg>

      <div className="mt-3 flex items-center justify-center gap-5">
        <Legend color={GREEN} label="Com o Willo" />
        <Legend color={WHITE} label="Sem apoio" dashed />
      </div>
      <div className="mt-4 flex justify-center">
        <EstimateBadge>Comparação ilustrativa</EstimateBadge>
      </div>
    </div>
  );
}

/* ── 14. A meta ao longo do prazo ───────────────────────────────────────────── */

/**
 * The goal as a line: climbing to the target when saving, falling to zero when paying
 * a debt off. Same arithmetic, drawn in the direction it is lived.
 */
export function GoalChart({ meses, subindo }: { meses: number; subindo: boolean }) {
  const W = 320;
  const H = 170;
  const L = 14;
  const R = 306;
  const T = 18;
  const B = 148;

  const d = useMemo(() => {
    const passos = Math.max(meses, 1);
    const pontos = Array.from({ length: passos + 1 }, (_, i) => {
      const x = L + ((R - L) * i) / passos;
      const share = i / passos;
      const y = subindo ? B - (B - T) * share : B - (B - T) * (1 - share);
      return `${x.toFixed(1)} ${y.toFixed(1)}`;
    });
    return `M ${pontos.join(" L ")}`;
  }, [meses, subindo]);

  const cor = subindo ? GREEN : CORAL;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label={subindo ? "Projeção do quanto você junta por mês" : "Projeção da dívida caindo a cada mês"}
    >
      <defs>
        <linearGradient id="goal-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={cor} stopOpacity="0.20" />
          <stop offset="100%" stopColor={cor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <Grid w={W} h={H} lines={[0.15, 0.45, 0.75]} />
      <line x1={L} x2={R} y1={B} y2={B} stroke="rgba(255,255,255,0.12)" />
      <motion.path
        d={`${d} L ${R} ${B} L ${L} ${B} Z`}
        fill="url(#goal-fill)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.5 }}
      />
      <DrawnPath d={d} stroke={cor} width={3.5} />
      <motion.circle
        cx={R}
        cy={subindo ? T : B}
        r={5}
        fill={cor}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 1.25, type: "spring", stiffness: 420, damping: 18 }}
      />
      <text x={L} y={H - 4} fill="rgba(255,255,255,0.45)" fontSize="11">
        hoje
      </text>
      <text x={R} y={H - 4} fill="rgba(255,255,255,0.45)" fontSize="11" textAnchor="end">
        {meses} meses
      </text>
    </svg>
  );
}

/* ── 14b. Reserva de emergência ─────────────────────────────────────────────── */

export function ReserveChart({ minima, ideal, mesesMinimo, mesesIdeal }: {
  minima: number;
  ideal: number;
  mesesMinimo: number;
  mesesIdeal: number;
}) {
  const still = useReducedMotion();
  const share = ideal > 0 ? (minima / ideal) * 100 : 0;
  return (
    <div className="mt-6">
      <div className="relative h-[12px] overflow-hidden rounded-full bg-white/[0.07]">
        <motion.span
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ background: GREEN }}
          initial={{ width: still ? `${share}%` : 0 }}
          animate={{ width: `${share}%` }}
          transition={{ duration: still ? 0 : 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <div className="mt-3 flex items-start justify-between gap-4">
        <span className="text-left">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
            Mínima · {mesesMinimo} meses
          </span>
          <span className="block text-[18px] font-bold tabular-nums" style={{ color: GREEN }}>
            {brl0(minima)}
          </span>
        </span>
        <span className="text-right">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
            Ideal · {mesesIdeal} meses
          </span>
          <span className="block text-[18px] font-bold tabular-nums text-white/80">{brl0(ideal)}</span>
        </span>
      </div>
    </div>
  );
}

/* ── 14c. Como está hoje x 50/30/20 ─────────────────────────────────────────── */

export function TodayVsPlanBars({ renda, gastos, necessidades, desejos, futuro }: {
  renda: number;
  gastos: number;
  necessidades: number;
  desejos: number;
  futuro: number;
}) {
  const still = useReducedMotion();
  const maior = Math.max(renda, gastos, 1);
  const alturaDe = (v: number) => `${Math.max((v / maior) * 100, 2)}%`;

  const Bar = ({ v, color, delay }: { v: number; color: string; delay: number }) => (
    <motion.span
      className="block w-full rounded-t-[8px]"
      style={{ background: color }}
      initial={{ height: still ? alturaDe(v) : 0 }}
      animate={{ height: alturaDe(v) }}
      transition={{ delay: still ? 0 : delay, duration: still ? 0 : 0.7, ease: [0.22, 1, 0.36, 1] }}
    />
  );

  return (
    <div className="mt-6 grid grid-cols-2 gap-5">
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">Como está hoje</p>
        <div className="flex h-[130px] items-end gap-2">
          <span className="flex h-full flex-1 flex-col justify-end">
            <Bar v={renda} color="rgba(255,255,255,0.28)" delay={0.1} />
          </span>
          <span className="flex h-full flex-1 flex-col justify-end">
            <Bar v={gastos} color={gastos > renda ? CORAL : "rgba(255,255,255,0.5)"} delay={0.2} />
          </span>
        </div>
        <div className="mt-2 flex gap-2 text-[10px] uppercase tracking-[0.12em] t-soft">
          <span className="flex-1">Renda</span>
          <span className="flex-1">Gastos</span>
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">50/30/20 em reais</p>
        <div className="flex h-[130px] items-end gap-2">
          <span className="flex h-full flex-1 flex-col justify-end">
            <Bar v={necessidades} color="rgba(255,255,255,0.45)" delay={0.3} />
          </span>
          <span className="flex h-full flex-1 flex-col justify-end">
            <Bar v={desejos} color="rgba(255,255,255,0.28)" delay={0.4} />
          </span>
          <span className="flex h-full flex-1 flex-col justify-end">
            <Bar v={futuro} color={GREEN} delay={0.5} />
          </span>
        </div>
        <div className="mt-2 flex gap-2 text-[10px] uppercase tracking-[0.12em] t-soft">
          <span className="flex-1">Nec.</span>
          <span className="flex-1">Desejos</span>
          <span className="flex-1">Futuro</span>
        </div>
      </div>
    </div>
  );
}

/* ── 16. O comprovante de exemplo ───────────────────────────────────────────── */

export interface DemoItem {
  estabelecimento: string;
  valor: number;
  data: string;
  categoria: string;
}

/**
 * A made-up receipt, drawn rather than photographed: no real shop, no real brand, and
 * nothing that could be mistaken for someone's actual purchase.
 */
export function ReceiptDemo({ item, onRead }: { item: DemoItem; onRead: () => void }) {
  const still = useReducedMotion();
  const [stage, setStage] = useState<"parado" | "lendo" | "pronto">("parado");

  const ler = () => {
    if (stage !== "parado") return;
    setStage("lendo");
    window.setTimeout(
      () => {
        setStage("pronto");
        onRead();
      },
      still ? 200 : 1600,
    );
  };

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={ler}
        aria-label="Tocar para o Willo ler o comprovante de exemplo"
        className="relative mx-auto block w-[210px] overflow-hidden rounded-[18px] border border-white/[0.08]"
      >
        <svg viewBox="0 0 210 250" className="block w-full" role="img" aria-label="Comprovante fictício de exemplo">
          <rect width="210" height="250" fill="#F4F1EA" />
          <text x="105" y="34" textAnchor="middle" fontSize="13" fontWeight="700" fill="#2A2A2A">
            {item.estabelecimento}
          </text>
          <text x="105" y="52" textAnchor="middle" fontSize="9" fill="#8A8A8A">
            CUPOM NAO FISCAL · EXEMPLO
          </text>
          <line x1="18" x2="192" y1="64" y2="64" stroke="#D6D1C6" strokeDasharray="4 4" />
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <rect x="18" y={78 + i * 22} width={110 - i * 18} height="7" rx="3.5" fill="#D6D1C6" />
              <rect x="150" y={78 + i * 22} width="42" height="7" rx="3.5" fill="#D6D1C6" />
            </g>
          ))}
          <line x1="18" x2="192" y1="156" y2="156" stroke="#D6D1C6" strokeDasharray="4 4" />
          <text x="18" y="180" fontSize="11" fontWeight="700" fill="#2A2A2A">
            TOTAL
          </text>
          <text x="192" y="180" fontSize="15" fontWeight="800" textAnchor="end" fill="#2A2A2A">
            {brl0(item.valor)}
          </text>
          <text x="18" y="202" fontSize="9" fill="#8A8A8A">
            {item.data}
          </text>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <rect key={i} x={18 + i * 20} y="216" width={i % 3 === 0 ? 7 : 3} height="22" fill="#2A2A2A" opacity="0.8" />
          ))}
        </svg>

        {stage === "lendo" && (
          <motion.span
            className="pointer-events-none absolute inset-x-0 h-[3px]"
            style={{ background: GREEN, boxShadow: `0 0 18px 4px ${GREEN}` }}
            initial={{ top: 0 }}
            animate={{ top: "100%" }}
            transition={{ duration: 1.4, ease: "linear" }}
          />
        )}
      </button>

      <p className="mt-4 text-center text-[13px] leading-snug text-white/62">
        {stage === "parado" && "Este comprovante é de exemplo. Toque e veja o que o Willo lê."}
        {stage === "lendo" && (
          <span className="font-semibold uppercase tracking-[0.18em] text-white/80">Lendo valores…</span>
        )}
      </p>

      {stage === "pronto" && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 rounded-[20px] border border-white/[0.08] willo-glass p-4"
        >
          {[
            ["Estabelecimento", item.estabelecimento],
            ["Valor", brl0(item.valor)],
            ["Data", item.data],
            ["Categoria", item.categoria],
          ].map(([rotulo, valor], i) => (
            <motion.div
              key={rotulo}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.08 * i }}
              className="flex items-baseline justify-between gap-3 py-1.5"
            >
              <span className="text-[13px] t-soft">{rotulo}</span>
              <span className="text-[14.5px] font-semibold text-white">{valor}</span>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
