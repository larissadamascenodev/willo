import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, animate, motion, useMotionValue, type PanInfo } from "framer-motion";
import { Check, Gift, X } from "lucide-react";
import { toast } from "sonner";
import GlowButton from "@/components/shared/GlowButton";
import LegalModal from "@/components/shared/LegalModal";
import { HomeScreen, NavStill, PhoneFrame, RaioXScreen, ScanStill } from "@/components/auth/WelcomeShowcase";
import { cn } from "@/lib/utils";

/*
 * Interface only. Billing (StoreKit / Play Billing via RevenueCat) isn't wired
 * yet, so every purchase button just continues the flow — nobody is charged.
 */

export type PlanId = "anual" | "mensal" | "anual-desconto";

export const PRICES = {
  anual: { total: "149,90", perMonth: "12,49" },
  mensal: { total: "39,90" },
  // 99,90 ÷ 12 = 8,32/mês — that's 79% under the monthly plan, so "75% OFF" undersells it
  desconto: { total: "99,90", perMonth: "8,32", off: 75 },
} as const;

const SLIDES = [
  { key: "home", caption: "Todo o seu dinheiro num lugar só" },
  { key: "scan", caption: "Foto do comprovante vira lançamento" },
  { key: "raiox", caption: "O Raio-X mostra onde ajustar" },
] as const;

/** Three phones; the middle one in focus, swipeable, advancing on its own. */
function PhoneCarousel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % SLIDES.length), 3400);
    return () => clearTimeout(t);
  }, [index, paused]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    setPaused(true);
    if (info.offset.x < -40) setIndex((i) => (i + 1) % SLIDES.length);
    else if (info.offset.x > 40) setIndex((i) => (i - 1 + SLIDES.length) % SLIDES.length);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <motion.div className="relative min-h-0 flex-1 touch-pan-y" drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.15} onDragEnd={onDragEnd}>
        {SLIDES.map((s, i) => {
          let pos = i - index;
          if (pos > 1) pos -= SLIDES.length;
          if (pos < -1) pos += SLIDES.length;
          const center = pos === 0;
          return (
            <motion.div
              key={s.key}
              className="absolute left-1/2 top-0 h-full"
              style={{ aspectRatio: "0.49", zIndex: center ? 3 : 1 }}
              initial={false}
              animate={{ x: `calc(-50% + ${pos * 62}%)`, scale: center ? 1 : 0.8, opacity: center ? 1 : 0.35, rotateY: pos * -8 }}
              transition={{ type: "spring", stiffness: 180, damping: 26 }}
              onClick={() => { setPaused(true); setIndex(i); }}
            >
              <PhoneFrame className="h-full">
                {s.key === "home" && (<><HomeScreen /><NavStill /></>)}
                {s.key === "scan" && <ScanStill />}
                {s.key === "raiox" && (<><RaioXScreen /><NavStill activePath="/bot-finance" /></>)}
              </PhoneFrame>
            </motion.div>
          );
        })}
      </motion.div>
      <div className="mt-3 h-5 text-center">
        <AnimatePresence mode="wait">
          <motion.p key={index} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="text-[13px] text-white/60">
            {SLIDES[index].caption}
          </motion.p>
        </AnimatePresence>
      </div>
      <div className="mt-2 flex justify-center gap-1.5">
        {SLIDES.map((s, i) => (
          <span key={s.key} className={cn("h-1.5 rounded-full transition-all", i === index ? "w-5 bg-white" : "w-1.5 bg-white/25")} />
        ))}
      </div>
    </div>
  );
}

/** A sheet that slides up inside the paywall. */
function Sheet({ open, onClose, children }: { open: boolean; onClose?: () => void; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="absolute inset-0 z-40 bg-black/70 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="absolute inset-x-0 bottom-0 z-50 rounded-t-[32px] border-t border-white/[0.1] willo-glass-strong px-5 pt-3"
            style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 34 }}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function PlanOption({ selected, onClick, title, price, sub, badge }: { selected: boolean; onClick: () => void; title: string; price: string; sub: string; badge?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex w-full items-center gap-4 rounded-[22px] border p-4 text-left transition-colors",
        selected ? "border-white bg-white/[0.06]" : "border-white/[0.1] willo-glass-inset",
      )}
    >
      {badge && (
        <span className="absolute -top-2.5 right-4 rounded-full bg-willo-green px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#0B0B0B]">{badge}</span>
      )}
      <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2", selected ? "border-white bg-white" : "border-white/30")}>
        {selected && <Check className="h-3.5 w-3.5 text-black" strokeWidth={3.5} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-semibold uppercase tracking-[0.2em] text-white/50">{title}</span>
        <span className="block text-[20px] font-extrabold tracking-tight text-white">{price}</span>
        <span className="block text-[12.5px] text-white/45">{sub}</span>
      </span>
    </button>
  );
}

/* ─────────────────────────── Roulette ─────────────────────────── */

const SEGMENTS = ["5%", "10%", "5%", "25%", "gift", "5%", "10%", "25%"] as const;
const SEG = 360 / SEGMENTS.length;
const GIFT = SEGMENTS.indexOf("gift");
const ACCENT = "#C8F36D";

const CONFETTI = Array.from({ length: 36 }, (_, i) => ({
  x: (i * 37) % 100,
  delay: (i % 9) * 0.06,
  rot: (i * 53) % 360,
  color: ["#FFFFFF", ACCENT, "#9A9AA0", "#FFFFFF"][i % 4],
  w: 6 + (i % 3) * 2,
}));

/**
 * The discount wheel and, once it stops, the 75% offer sliding up under it —
 * the wheel stays on screen with the winning slice lit. Spins fresh every
 * time it opens.
 */
function DiscountWheel({ onAccept, onSkip }: { onAccept: () => void; onSkip: () => void }) {
  const rotation = useMotionValue(0);
  const [stage, setStage] = useState<"ready" | "spinning" | "won">("ready");
  const won = stage === "won";

  const spin = () => {
    if (stage !== "ready") return;
    setStage("spinning");
    // Five full turns, then settle with the gift under the pointer (top)
    const target = 360 * 5 + (360 - (GIFT * SEG + SEG / 2));
    animate(rotation, target, { duration: 4.2, ease: [0.12, 0.8, 0.18, 1], onComplete: () => setTimeout(() => setStage("won"), 250) });
  };

  const R = 150;
  const slices = useMemo(
    () =>
      SEGMENTS.map((label, i) => {
        const a0 = ((i * SEG - 90) * Math.PI) / 180;
        const a1 = (((i + 1) * SEG - 90) * Math.PI) / 180;
        const mid = (((i + 0.5) * SEG - 90) * Math.PI) / 180;
        return {
          label,
          d: `M${R},${R} L${R + R * Math.cos(a0)},${R + R * Math.sin(a0)} A${R},${R} 0 0 1 ${R + R * Math.cos(a1)},${R + R * Math.sin(a1)} Z`,
          tx: R + R * 0.66 * Math.cos(mid),
          ty: R + R * 0.66 * Math.sin(mid),
          rot: (i + 0.5) * SEG,
        };
      }),
    [],
  );

  return (
    <motion.div
      className="absolute inset-0 z-50 flex flex-col overflow-hidden rounded-t-[34px] bg-black px-6 shadow-[0_-30px_80px_rgba(0,0,0,0.8)]"
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 230, damping: 30 }}
      style={{ paddingTop: "max(56px, env(safe-area-inset-top))", paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}
    >
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-80 w-80 -translate-x-1/2 rounded-full bg-white/[0.08] blur-[110px]" />
      <div className="relative text-center">
        <h2 className="text-[28px] font-bold leading-tight tracking-tight text-white">Você ganhou um prêmio.</h2>
        <p className="mt-2 text-[15px] text-white/50">Gire a roleta e ganhe até 75% de desconto.</p>
      </div>

      {/* Wheel — centered while spinning; slides up only when the offer card arrives */}
      <div className={cn("relative flex flex-1 justify-center", won ? "items-start pt-6" : "items-center")}>
        <motion.div
          layout
          className="w-full max-w-[290px]"
          animate={{ scale: won ? 0.9 : 1 }}
          transition={{ type: "spring", stiffness: 180, damping: 24 }}
        >
        <motion.div
          className="relative aspect-square w-full"
          initial={{ scale: 0.5, rotate: -90, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ delay: 0.25, type: "spring", stiffness: 140, damping: 16 }}
        >
          {/* Pointer */}
          <div className="absolute -top-3 left-1/2 z-10 -translate-x-1/2">
            <div className="h-0 w-0 border-x-[12px] border-t-[20px] border-x-transparent border-t-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)]" />
          </div>
          <div className="absolute -inset-2 rounded-full border border-white/[0.15] willo-glass-inset shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]" />
          <motion.svg viewBox={`0 0 ${R * 2} ${R * 2}`} className="relative h-full w-full" style={{ rotate: rotation }}>
            {slices.map((s, i) => {
              const lit = won && s.label === "gift";
              return (
                <g key={i}>
                  <motion.path
                    d={s.d}
                    stroke="#0B0B0B"
                    strokeWidth="2"
                    initial={false}
                    animate={{ fill: lit ? ACCENT : i % 2 ? "#1E1E1E" : "#262626" }}
                    transition={{ duration: 0.4 }}
                  />
                  {s.label === "gift" ? (
                    <g transform={`rotate(${s.rot} ${s.tx} ${s.ty})`}>
                      <Gift x={s.tx - 14} y={s.ty - 14} width={28} height={28} color={lit ? "#0B0B0B" : "#FFFFFF"} strokeWidth={2.4} />
                    </g>
                  ) : (
                    <text x={s.tx} y={s.ty} textAnchor="middle" dominantBaseline="central" fill="rgba(255,255,255,0.8)" fontSize="18" fontWeight="600" transform={`rotate(${s.rot} ${s.tx} ${s.ty})`}>{s.label}</text>
                  )}
                </g>
              );
            })}
            <circle cx={R} cy={R} r="22" fill="#0B0B0B" stroke="#FFFFFF" strokeOpacity="0.3" strokeWidth="2" />
            <circle cx={R} cy={R} r="6" fill="#FFFFFF" />
          </motion.svg>
        </motion.div>
        </motion.div>
      </div>

      {/* Stays in the layout (just fades) so the wheel doesn't jump when it goes */}
      <motion.div animate={{ opacity: won ? 0 : 1 }} className={cn("relative space-y-3", won && "pointer-events-none")}>
        <GlowButton variant="light" onClick={spin} disabled={stage === "spinning"}>{stage === "spinning" ? "Girando…" : "Girar"}</GlowButton>
        <button type="button" onClick={onSkip} disabled={stage === "spinning"} className="w-full py-2 text-[14px] text-white/45 disabled:opacity-0">Não quero desconto</button>
      </motion.div>

      {/* The offer */}
      <AnimatePresence>
        {won && (
          <>
            <div key="confetti" className="pointer-events-none absolute inset-0 overflow-hidden">
              {CONFETTI.map((c, i) => (
                <motion.span
                  key={i}
                  className="absolute top-0 rounded-[2px]"
                  style={{ left: `${c.x}%`, width: c.w, height: c.w * 1.6, background: c.color }}
                  initial={{ y: -30, rotate: c.rot, opacity: 1 }}
                  animate={{ y: 520, rotate: c.rot + 540, opacity: 0 }}
                  transition={{ duration: 2.4, delay: c.delay, ease: "easeIn" }}
                />
              ))}
            </div>
            <motion.div
              key="offer"
              className="absolute inset-x-0 bottom-0 rounded-t-[32px] border-t border-white/[0.1] willo-glass-strong px-6 pt-6 text-center"
              style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 30 }}
            >
              <motion.p
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.2 }}
                className="text-[40px] font-extrabold leading-none tracking-tight"
                style={{ color: ACCENT }}
              >
                {PRICES.desconto.off}% OFF
              </motion.p>
              <div className="mt-3 flex items-baseline justify-center gap-2.5">
                <span className="text-[16px] font-semibold text-white/35 line-through">R$ {PRICES.mensal.total}/mês</span>
                <span className="text-[34px] font-extrabold tracking-tight" style={{ color: ACCENT }}>R$ {PRICES.desconto.perMonth}</span>
                <span className="text-[15px] text-white/55">/mês</span>
              </div>
              <p className="mt-1 text-[13.5px] text-white/50">R$ {PRICES.desconto.total} cobrado por ano, cancele quando quiser</p>
              <div className="mt-5 space-y-1">
                <GlowButton variant="dark" onClick={onAccept}>Quero meu desconto</GlowButton>
                <button type="button" onClick={onSkip} className="w-full py-3 text-[14px] text-white/45">Não, prefiro pagar o preço cheio</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─────────────────────────── Paywall ─────────────────────────── */

/** Staggered entrance for the paywall's blocks, top to bottom. */
const rise = (i: number) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: 0.25 + i * 0.08, type: "spring" as const, stiffness: 260, damping: 26 },
});

interface Props {
  name?: string;
  /** Tapped a purchase button (no billing yet: the caller just moves on). */
  onPurchase: (plan: PlanId) => void;
  /** Left without buying. */
  onClose: () => void;
  /** X opens the discount wheel instead of closing. */
  offerDiscount?: boolean;
  /** "Restaurar": defaults to a "no purchase found" notice. */
  onRestore?: () => void;
}

/**
 * Willo Pro paywall: three phones showing the real app, the annual price up
 * front and the full list one tap away. With `offerDiscount`, X never just
 * closes: it opens the discount wheel (a fresh spin every time), and only
 * turning the discount down leaves.
 */
export default function Paywall({ name, onPurchase, onClose, offerDiscount = true, onRestore }: Props) {
  const [plansOpen, setPlansOpen] = useState(false);
  const [plan, setPlan] = useState<"anual" | "mensal">("anual");
  const [stage, setStage] = useState<"paywall" | "wheel">("paywall");
  const [legal, setLegal] = useState<"terms" | "privacy" | null>(null);
  const first = name?.trim().split(/\s+/)[0];

  const close = () => {
    if (!offerDiscount) onClose();
    else setStage("wheel");
  };

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-black" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="pointer-events-none absolute left-1/2 top-[18%] h-96 w-96 -translate-x-1/2 rounded-full bg-white/[0.07] blur-[120px]" />

      <div className="relative flex h-14 shrink-0 items-center justify-center px-4">
        <button type="button" onClick={close} aria-label="Fechar" className="absolute left-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.08] text-white/80 active:scale-95">
          <X className="h-5 w-5" />
        </button>
        <motion.span {...rise(0)} className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.35em] text-white">
          Willo
          <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] tracking-[0.2em] text-[#0B0B0B] shadow-[0_0_18px_rgba(255,255,255,0.35)]">Pro</span>
        </motion.span>
      </div>

      <motion.h1 {...rise(1)} className="relative shrink-0 px-6 text-center text-[25px] leading-tight tracking-tight text-white">
        <span className="font-light">{first ? `${first}, agora é` : "Agora é"}</span>
        <span className="font-extrabold"> colocar em prática.</span>
      </motion.h1>

      <motion.div {...rise(2)} className="relative mt-4 flex min-h-0 flex-1 flex-col px-2" style={{ perspective: 1200 }}>
        <PhoneCarousel />
      </motion.div>

      <div className="relative shrink-0 px-5 pt-4" style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
        <motion.div {...rise(3)} className="rounded-[24px] border border-white/[0.1] willo-glass px-5 py-4">
          <p className="flex items-baseline gap-1">
            <span className="text-[30px] font-extrabold leading-none tracking-tight text-white">R$ {PRICES.anual.perMonth}</span>
            <span className="text-[14px] text-white/50">/mês</span>
          </p>
          <p className="mt-1.5 text-[12.5px] leading-snug text-white/45">R$ {PRICES.anual.total} cobrado por ano, cancele quando quiser</p>
        </motion.div>

        <motion.div {...rise(4)} className="mt-4">
          <GlowButton variant="light" onClick={() => onPurchase("anual")}>Quero meu plano agora</GlowButton>
        </motion.div>
        <motion.div {...rise(5)}>
          <button type="button" onClick={() => setPlansOpen(true)} className="mt-1 w-full py-3 text-[13px] font-semibold uppercase tracking-[0.2em] text-white/70">
            Ver todos os planos
          </button>
          <p className="text-center text-[11px] text-white/30">Renova automaticamente. Cancele quando quiser.</p>
        </motion.div>
      </div>

      <Sheet open={plansOpen} onClose={() => setPlansOpen(false)}>
        <h2 className="text-center text-[22px] font-extrabold tracking-tight text-white">Escolha seu plano</h2>
        <div className="mt-5 space-y-3">
          <PlanOption selected={plan === "anual"} onClick={() => setPlan("anual")} title="Anual" price={`R$ ${PRICES.anual.total}/ano`} sub={`Equivale a R$ ${PRICES.anual.perMonth}/mês`} badge="Economize 68%" />
          <PlanOption selected={plan === "mensal"} onClick={() => setPlan("mensal")} title="Mensal" price={`R$ ${PRICES.mensal.total}/mês`} sub="Cobrado todo mês" />
        </div>
        <div className="mt-5">
          <GlowButton variant="light" onClick={() => onPurchase(plan)}>Continuar</GlowButton>
        </div>
        <p className="mt-3 text-center text-[11px] text-white/30">Renova automaticamente. Cancele quando quiser.</p>
        <div className="mt-3 flex items-center justify-center gap-2 text-[12.5px] text-white/50">
          <button type="button" onClick={onRestore ?? (() => toast("Nenhuma compra encontrada para restaurar."))} className="py-1">Restaurar</button>
          <span className="text-white/20">·</span>
          <button type="button" onClick={() => setLegal("terms")} className="py-1">Termos</button>
          <span className="text-white/20">·</span>
          <button type="button" onClick={() => setLegal("privacy")} className="py-1">Privacidade</button>
        </div>
      </Sheet>

      <AnimatePresence>
        {stage === "wheel" && <DiscountWheel key="wheel" onAccept={() => onPurchase("anual-desconto")} onSkip={onClose} />}
      </AnimatePresence>

      <LegalModal open={legal !== null} type={legal ?? "terms"} onClose={() => setLegal(null)} />
    </div>
  );
}
