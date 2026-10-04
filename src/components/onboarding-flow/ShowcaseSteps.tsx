import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import GlowButton from "@/components/shared/GlowButton";
import ScanCaptureScreen from "@/components/scan/ScanCaptureScreen";
import type { ScanResultItem } from "@/components/scan/ScanResultCard";
import { DemoStatement } from "@/components/auth/DemoReceipt";
import { getCategoryHexColor, getCategoryIcon } from "@/lib/categoryUtils";
import { DEFAULT_CATEGORY_TYPE } from "@/lib/categoryIcons";
import { brl0 } from "@/lib/onboardingPlan";
import { cn } from "@/lib/utils";
import wordmarkOnDark from "@/assets/logo/willo-wordmark-light.png";
import { FlowScreen, Heading } from "./primitives";

interface StepProps {
  onBack: () => void;
  onNext: () => void;
}

/* ─── Categories showcase ─── */
const SHOWCASE = [
  { name: "Supermercado", amount: 1240 },
  { name: "Delivery", amount: 412 },
  { name: "Transporte", amount: 318 },
  { name: "Assinaturas", amount: 266 },
  { name: "Moradia", amount: 980 },
  { name: "Lazer", amount: 190 },
  { name: "Saúde", amount: 145 },
  { name: "Academia", amount: 120 },
];

export function CategoriesStep({ onBack, onNext }: StepProps) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % SHOWCASE.length), 1500);
    return () => clearInterval(t);
  }, []);
  const cat = SHOWCASE[i];
  const Icon = getCategoryIcon(cat.name);
  const hex = getCategoryHexColor(cat.name);
  const total = Object.keys(DEFAULT_CATEGORY_TYPE).length;

  return (
    <FlowScreen section="Seus gastos" onBack={onBack} footer={<GlowButton onClick={onNext}>Quero ver o meu</GlowButton>}>
      <div className="pt-6">
        <Heading light="Em todo gasto," bold="você vê pra onde foi." />
      </div>
      <div className="relative mt-7 h-[230px] overflow-hidden rounded-[28px] border border-white/[0.08] willo-glass">
        <AnimatePresence mode="popLayout">
          <motion.div
            key={cat.name}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
            className="absolute inset-0 flex flex-col items-center justify-center"
            style={{ background: `radial-gradient(80% 70% at 50% 40%, ${hex}26 0%, transparent 70%)` }}
          >
            <span className="flex h-24 w-24 items-center justify-center rounded-full" style={{ background: `${hex}22` }}>
              <Icon className="h-11 w-11" style={{ color: hex }} />
            </span>
            <p className="mt-4 text-[20px] font-bold text-white">{cat.name}</p>
            <p className="text-[14px] text-white/66 tabular-nums">{brl0(cat.amount)} este mês</p>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="mt-4 flex justify-between gap-1.5">
        {SHOWCASE.map((c, j) => {
          const I = getCategoryIcon(c.name);
          const on = j === i;
          return (
            <span
              key={c.name}
              className={cn("flex h-10 flex-1 items-center justify-center rounded-[12px] border transition-colors", on ? "border-white bg-white/[0.1]" : "border-white/[0.06] willo-glass")}
            >
              <I className="h-4 w-4" style={{ color: on ? getCategoryHexColor(c.name) : "rgba(255,255,255,0.35)" }} />
            </span>
          );
        })}
      </div>
      <div className="mt-8 text-center">
        <p className="text-[52px] font-extrabold leading-none tracking-tight text-white tabular-nums">{total}</p>
        <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-white/62">Categorias prontas no Willo</p>
      </div>
    </FlowScreen>
  );
}

/* ─── "Every month you have X left" ─── */
export function InsightStep({ surplus, monthlySave, cut, onBack, onNext }: StepProps & { surplus: number; monthlySave: number; cut: number }) {
  const positive = surplus >= 0;
  return (
    <FlowScreen section="Seu mês" onBack={onBack} center footer={<GlowButton onClick={onNext}>E como eu controlo isso?</GlowButton>}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-[30px] font-light leading-tight text-white">Todo mês {positive ? "sobram" : "faltam"}</p>
        <p className="mt-1 flex items-baseline gap-2">
          <span className={cn("text-[58px] font-extrabold leading-none tracking-tight tabular-nums", positive ? "text-white" : "text-[#F87171]")}>
            {brl0(surplus)}
          </span>
        </p>
        <p className="mt-4 text-[16px] leading-snug text-white/70">
          {positive ? "Isso é o que dá pra direcionar pra sua meta." : "Esse é o buraco que vamos fechar juntos."}
        </p>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="mt-8 rounded-[24px] border border-white/[0.08] willo-glass p-5"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/62">Pra chegar na meta, guarde</p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <p className="flex items-baseline gap-2">
            <span className="text-[40px] font-extrabold leading-none tracking-tight text-white tabular-nums">{brl0(monthlySave)}</span>
            <span className="text-[12px] font-semibold uppercase tracking-[0.15em] text-white/62">/mês</span>
          </p>
          <span className={cn("shrink-0 rounded-full px-3 py-1 text-[12px] font-semibold", cut > 0 ? "bg-[#F87171]/15 text-[#F87171]" : "bg-willo-green/15 text-willo-green")}>
            {cut > 0 ? `−${brl0(cut)} nos gastos` : "Cabe na sua sobra"}
          </span>
        </div>
      </motion.div>
    </FlowScreen>
  );
}

/* ─── Interactive scan demo ─── */
const DEMO_ITEMS: ScanResultItem[] = [
  { description: "iFood", amount: 45.9, category: "Delivery", date: "2026-09-02" },
  { description: "Uber", amount: 27.9, category: "Transporte", date: "2026-09-04" },
  { description: "Netflix", amount: 55.9, category: "Assinaturas", date: "2026-09-05" },
  { description: "Supermercado Extra", amount: 312.4, category: "Supermercado", date: "2026-09-09" },
  { description: "Drogasil", amount: 89.5, category: "Saúde", date: "2026-09-12" },
  { description: "Posto Shell", amount: 180, category: "Transporte", date: "2026-09-14" },
];

export function ScanDemoStep({ onBack, onNext }: StepProps) {
  const [phase, setPhase] = useState<"intro" | "reading" | "result">("intro");

  useEffect(() => {
    if (phase !== "reading") return;
    const t = setTimeout(() => setPhase("result"), 2600);
    return () => clearTimeout(t);
  }, [phase]);

  return (
    <div className="relative h-full overflow-hidden bg-black">
      <DemoStatement />
      <button type="button" onClick={onBack} aria-label="Voltar" className="absolute left-3 top-3 z-10 flex h-11 w-11 items-center justify-center text-white">
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m15 18-6-6 6-6" /></svg>
      </button>

      <AnimatePresence>
        {phase === "intro" && (
          <motion.div exit={{ opacity: 0 }} className="absolute inset-x-0 bottom-0 flex flex-col items-center px-5 pb-6">
            <div className="w-full rounded-[22px] border border-white/10 bg-black/80 p-4 text-center backdrop-blur-xl">
              <p className="text-[17px] font-bold text-white">Essa fatura é nossa.</p>
              <p className="mt-1 text-[13.5px] leading-snug text-white/70">Toque e veja o que o Willo lê numa foto de fatura ou comprovante.</p>
            </div>
            <motion.button
              type="button"
              onClick={() => setPhase("reading")}
              aria-label="Ver o que o app lê"
              className="relative mt-5 flex h-[76px] w-[76px] items-center justify-center rounded-full"
              whileTap={{ scale: 0.92 }}
            >
              <span className="absolute inset-0 animate-ping rounded-full border-2 border-white/40" style={{ animationDuration: "1.8s" }} />
              <span className="absolute inset-0 rounded-full border-[4px] border-white" />
              <span className="h-[58px] w-[58px] rounded-full bg-white" />
            </motion.button>
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-white/82">Ver o que o app lê</p>
          </motion.div>
        )}
      </AnimatePresence>

      <ScanCaptureScreen
        open={phase !== "intro"}
        photoUrl={null}
        backdrop={<DemoStatement />}
        items={phase === "result" ? DEMO_ITEMS : null}
        onItemsChange={() => {}}
        accounts={[]}
        accountId={null}
        onAccountChange={() => {}}
        onClose={() => setPhase("intro")}
        onConfirm={onNext}
        readingLabel="Lendo a fatura…"
        confirmLabel="Continuar"
        resultTitle="Fatura de setembro"
      />
    </div>
  );
}

/* ─── Commitment: draw a check ─── */
export function CommitmentStep({ onBack, onNext }: StepProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [length, setLength] = useState(0);
  const done = length > 120;

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.clientWidth * ratio;
    c.height = c.clientHeight * ratio;
    const ctx = c.getContext("2d");
    if (ctx) {
      ctx.scale(ratio, ratio);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 7;
      ctx.strokeStyle = "#FFFFFF";
    }
  }, []);

  const point = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const onDown = (e: React.PointerEvent) => {
    drawing.current = true;
    last.current = point(e);
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drawing.current || !last.current) return;
    const p = point(e);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setLength((l) => l + Math.hypot(p.x - last.current!.x, p.y - last.current!.y));
    last.current = p;
  };
  const onUp = () => { drawing.current = false; last.current = null; };
  const clear = () => {
    const c = canvasRef.current;
    c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    setLength(0);
  };

  return (
    <FlowScreen section="Compromisso" onBack={onBack} scroll={false} footer={<GlowButton disabled={!done} onClick={onNext}>Confirmar</GlowButton>}>
      <div className="flex h-full flex-col justify-center pb-6">
        <h1 className="text-center text-[26px] leading-tight tracking-tight text-white">
          <span className="font-light">Você topa cuidar do seu dinheiro</span>{" "}
          <span className="font-extrabold">um pouco todo dia?</span>
        </h1>
        <p className="mt-2 text-center text-[14px] leading-snug text-white/62">Um minuto por dia já muda o mês. É um combinado com você.</p>
        <div className="relative mt-8 h-[250px] overflow-hidden rounded-[26px] border border-white/[0.08] willo-glass">
          {length === 0 && (
            <svg viewBox="0 0 100 100" className="pointer-events-none absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 54 L40 76 L84 26" />
            </svg>
          )}
          <canvas
            ref={canvasRef}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerLeave={onUp}
            className="absolute inset-0 h-full w-full touch-none"
          />
          <AnimatePresence>
            {done && (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="absolute right-3 top-3 rounded-full bg-willo-green px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[#0B0B0B]">
                Combinado
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <p className="mt-4 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-white/56">Desenhe um ✓ na caixa para confirmar</p>
        <button type="button" onClick={clear} className="mx-auto mt-2 text-[13px] text-white/50">Limpar</button>
      </div>
    </FlowScreen>
  );
}

/* ─── Notifications, shown the way they'll arrive ─── */
const NOTIFS = [
  { when: "agora", title: "Fatura do Nubank vence amanhã", body: "R$ 1.284,90. Seu saldo cobre." },
  { when: "8 min", title: "Dia verde", body: "Você pode gastar até R$ 136 hoje sem apertar o mês." },
  { when: "1 h", title: "Meta Viagem chegou a 60%", body: "Faltam R$ 4.800. No seu ritmo, em março." },
];

export function NotificationStep({ onBack, onNext }: StepProps) {
  const [asking, setAsking] = useState(false);

  const enable = async () => {
    setAsking(true);
    try {
      if (Capacitor.isNativePlatform()) await LocalNotifications.requestPermissions();
      else if ("Notification" in window && Notification.permission === "default") await Notification.requestPermission();
    } catch {
      // the user can turn them on later in Configurações
    } finally {
      setAsking(false);
      onNext();
    }
  };

  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <FlowScreen
      section="Lembretes"
      onBack={onBack}
      scroll={false}
      footer={
        <div className="space-y-3">
          <GlowButton onClick={enable} disabled={asking}>Ativar lembretes</GlowButton>
          <button type="button" onClick={onNext} className="w-full text-center text-[14px] text-white/62">Agora não</button>
        </div>
      }
    >
      <Heading light="Ative os lembretes" bold="e nunca mais pague juros." className="pt-4" />

      {/* iPhone lock screen, cut at the bottom */}
      <div className="relative mx-auto mt-6 h-[420px] w-[280px]">
        <div
          className="absolute inset-x-0 top-0 h-[560px]"
          style={{
            borderRadius: "46px",
            padding: "4px",
            background: "linear-gradient(135deg, #b8b8bd 0%, #5d5d62 14%, #2a2a2d 32%, #1d1d1f 50%, #3f3f43 68%, #8c8c92 86%, #505055 100%)",
          }}
        >
          <div className="h-full w-full rounded-[43px] bg-black p-[7px]">
            <div className="relative h-full w-full overflow-hidden rounded-[37px] bg-[radial-gradient(120%_80%_at_30%_10%,#2b2b2e_0%,#121213_55%,#050505_100%)]">
              <span className="absolute left-1/2 top-[10px] h-[26px] w-[92px] -translate-x-1/2 rounded-full bg-black" />
              <p className="mt-14 text-center text-[13px] font-medium capitalize text-white/82">{today}</p>
              <p className="text-center text-[64px] font-semibold leading-none tracking-tight text-white/90">9:41</p>
              <div className="mt-5 space-y-2 px-3">
                {NOTIFS.map((n, i) => (
                  <motion.div
                    key={n.title}
                    initial={{ opacity: 0, y: -30, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: 0.5 + i * 0.9, type: "spring", stiffness: 260, damping: 22 }}
                    className="flex items-start gap-2.5 rounded-[18px] bg-white/[0.14] p-2.5 backdrop-blur-xl"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-black">
                      <img src={wordmarkOnDark} alt="" className="w-6" style={{ filter: "brightness(0) invert(1)" }} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-[12px] font-semibold text-white">{n.title}</p>
                        <span className="shrink-0 text-[10px] text-white/66">{n.when}</span>
                      </div>
                      <p className="text-[11.5px] leading-snug text-white/85">{n.body}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black to-transparent" />
      </div>
    </FlowScreen>
  );
}

/* ─── Calculating ─── */
const STAGES = [
  { title: "Lendo suas respostas", text: "Renda, gastos e hábitos" },
  { title: "Calculando sua sobra", text: "O que sobra e o que aperta" },
  { title: "Avaliando cartão e dívidas", text: "Onde estão os riscos" },
  { title: "Montando seu perfil", text: "Seu score inicial de saúde financeira" },
];

export function CalculatingStep({ onDone }: { onDone: () => void }) {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const DURATION = 5200;
    const t = setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / DURATION);
      // ease-in-out with a small pause near the end, like real work
      setPct(Math.round((p < 0.85 ? p / 0.85 * 0.92 : 0.92 + (p - 0.85) / 0.15 * 0.08) * 100));
      if (p >= 1) {
        clearInterval(t);
        setTimeout(onDone, 400);
      }
    }, 60);
    return () => clearInterval(t);
  }, [onDone]);

  const stage = STAGES[Math.min(STAGES.length - 1, Math.floor((pct / 100) * STAGES.length))];
  const r = 70, c = 2 * Math.PI * r;

  return (
    <div className="relative flex h-full flex-col items-center justify-center px-8">
      <div className="pointer-events-none absolute -left-28 -top-36 h-80 w-80 rounded-full bg-white/[0.07] blur-[100px]" />
      <div className="relative h-[170px] w-[170px]">
        <svg viewBox="0 0 170 170" className="h-full w-full -rotate-90">
          <circle cx="85" cy="85" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="9" />
          <circle cx="85" cy="85" r={r} fill="none" stroke="url(#calc-grad)" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`} />
          <defs>
            <linearGradient id="calc-grad" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#8a8a8f" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <img src={wordmarkOnDark} alt="" className="h-4 w-auto opacity-90" style={{ filter: "brightness(0) invert(1)" }} />
          <span className="mt-2 text-[26px] font-extrabold tabular-nums text-white">{pct}%</span>
        </div>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={stage.title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mt-10 text-center">
          <p className="text-[20px] font-extrabold uppercase tracking-tight text-white">{stage.title}…</p>
          <p className="mt-1 text-[14px] text-white/66">{stage.text}</p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
