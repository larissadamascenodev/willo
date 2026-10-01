import { useState } from "react";
import { motion } from "framer-motion";
import { BrainCircuit, Camera, Check, TrendingUp, Trophy } from "lucide-react";
import GlowButton from "@/components/shared/GlowButton";
import LegalModal from "@/components/shared/LegalModal";
import { cn } from "@/lib/utils";
import { FlowScreen, Heading } from "./primitives";

interface StepProps {
  onBack: () => void;
  onNext: () => void;
}

/* ─── 1. Name ─── */
export function NameStep({ value, onChange, onBack, onNext }: StepProps & { value: string; onChange: (v: string) => void }) {
  const ok = value.trim().length >= 2;
  return (
    <FlowScreen
      section="Sobre você"
      onBack={onBack}
      center
      footer={<GlowButton disabled={!ok} onClick={onNext}>Continuar</GlowButton>}
    >
      <Heading light="Como podemos" bold="te chamar?" />
      <input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, 30))}
        onKeyDown={(e) => e.key === "Enter" && ok && onNext()}
        placeholder="Seu nome ou apelido..."
        className="mt-10 h-[58px] w-full rounded-full border border-white/[0.06] willo-glass px-6 text-center text-[17px] text-white placeholder:text-white/30 focus:border-white/20 focus:outline-none"
      />
    </FlowScreen>
  );
}

/* ─── 2. Consent ─── */
export function ConsentStep({ name, onBack, onNext }: StepProps & { name: string }) {
  const [legal, setLegal] = useState<"terms" | "privacy" | null>(null);
  const [checked, setChecked] = useState([false, false, false]);
  const toggle = (i: number) => setChecked((c) => c.map((v, j) => (j === i ? !v : v)));

  return (
    <FlowScreen
      section="Antes de começar"
      onBack={onBack}
      center
      footer={
        <GlowButton onClick={() => { setChecked([true, true, true]); setTimeout(onNext, 250); }}>
          Aceitar tudo e começar
        </GlowButton>
      }
    >
      <Heading light={`${name.trim() ? `${name.trim()}, antes` : "Antes"} de começar,`} bold="só confirme:" />
      <div className="mt-8 space-y-5">
        {[
          <>
            Aceito os{" "}
            <button type="button" onClick={(e) => { e.stopPropagation(); setLegal("terms"); }} className="underline underline-offset-2 text-white/80">Termos de Uso</button>{" "}
            e a{" "}
            <button type="button" onClick={(e) => { e.stopPropagation(); setLegal("privacy"); }} className="underline underline-offset-2 text-white/80">Política de Privacidade</button>
            , incluindo a leitura dos meus comprovantes por inteligência artificial (Google Gemini).
          </>,
          <>
            Entendo que o Willo me ajuda a <b className="font-semibold text-white/80">organizar e acompanhar</b> meu dinheiro e que o conteúdo é
            educativo: não substitui um consultor ou planejador financeiro.
          </>,
          <>
            Sei que o Willo <b className="font-semibold text-white/80">não movimenta dinheiro</b> nem faz transações financeiras. Os dados vêm
            só do que eu registro no app.
          </>,
        ].map((text, i) => (
          <button key={i} type="button" onClick={() => toggle(i)} className="flex w-full items-start gap-3.5 text-left">
            <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors", checked[i] ? "border-white bg-white" : "border-white/25")}>
              {checked[i] && <Check className="h-3.5 w-3.5 text-[#0B0B0B]" strokeWidth={3.5} />}
            </span>
            <span className="text-[14px] leading-relaxed text-white/50">{text}</span>
          </button>
        ))}
      </div>
      <LegalModal open={!!legal} onClose={() => setLegal(null)} type={legal || "terms"} />
    </FlowScreen>
  );
}

/* ─── 3. "Your money is about to change" ─── */
export function EvolutionStep({ name, onBack, onNext }: StepProps & { name: string }) {
  const W = 320, H = 190;
  const withWillo = "M 12 170 C 70 150, 110 128, 160 104 S 250 52, 298 28";
  const without = "M 12 170 C 60 140, 100 138, 150 146 S 240 150, 298 158";

  return (
    <FlowScreen section="Sua evolução" onBack={onBack} footer={<GlowButton onClick={onNext}>Quero ver</GlowButton>}>
      <div className="pt-10">
        <Heading light={`${name.trim() || "Você"},`} bold="seu dinheiro vai mudar." sub="E você vai ver toda a evolução." />
      </div>

      <div className="mt-8">
        <div className="flex justify-between text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">
          <span>Mês 1</span>
          <span>Mês 6</span>
        </div>
        <div className="relative mt-2">
          <span className="absolute -left-1 top-1/2 origin-left -translate-y-1/2 -rotate-90 text-[10px] font-semibold uppercase tracking-[0.25em] text-white/30">
            Seu saldo
          </span>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full pl-4">
            {[40, 90, 140].map((y) => <line key={y} x1="0" x2={W} y1={y} y2={y} stroke="rgba(255,255,255,0.05)" />)}
            <defs>
              <linearGradient id="evo-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.14" />
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
              </linearGradient>
            </defs>
            <motion.path
              d={`${withWillo} L 298 ${H} L 12 ${H} Z`}
              fill="url(#evo-fill)"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2, duration: 0.6 }}
            />
            <motion.path
              d={without}
              fill="none"
              stroke="rgba(255,255,255,0.35)"
              strokeWidth="2.5"
              strokeDasharray="6 7"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.3, duration: 1.2, ease: "easeInOut" }}
            />
            <motion.path
              d={withWillo}
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="3.5"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.3, duration: 1.4, ease: "easeInOut" }}
            />
            <circle cx="12" cy="170" r="6" fill="#0B0B0B" stroke="#FFFFFF" strokeWidth="3" />
            <motion.circle cx="298" cy="158" r="5" fill="rgba(255,255,255,0.5)" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.4 }} />
          </svg>
          <motion.span
            className="absolute right-0 top-[6px] flex h-9 w-9 items-center justify-center rounded-full bg-willo-green shadow-[0_0_24px_rgba(200,243,109,0.55)]"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 1.6, type: "spring", stiffness: 300, damping: 16 }}
          >
            <TrendingUp className="h-4 w-4 text-[#0B0B0B]" strokeWidth={2.8} />
          </motion.span>
        </div>
        <div className="mt-5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.2em]">
          <span className="flex items-center gap-2 text-white"><span className="h-[3px] w-5 rounded-full bg-white" /> Com o Willo</span>
          <span className="flex items-center gap-2 text-white/45"><span className="w-5 border-t-2 border-dashed border-white/40" /> Sem controle</span>
        </div>
        <p className="mt-4 text-center text-[12px] text-white/30">Comparação ilustrativa</p>
      </div>
    </FlowScreen>
  );
}

/* ─── 4. How it works ─── */
export function HowItWorksStep({ onBack, onNext }: StepProps) {
  // The path runs down beside each stop and crosses over only below its label,
  // so no line ever runs through the text.
  const stops = [
    { Icon: Camera, title: "Foto do comprovante", text: "e o gasto já fica anotado", x: 30, y: 40, side: "right" as const },
    { Icon: BrainCircuit, title: "Raio-X do seu dinheiro", text: "score, alertas e o que fazer", x: 270, y: 165, side: "left" as const },
    { Icon: TrendingUp, title: "Projeção visível", text: "o saldo dos próximos meses", x: 30, y: 290, side: "right" as const },
  ];
  const path = "M 30 40 C 30 100, 40 116, 150 118 S 270 128, 270 165 C 270 222, 262 238, 150 240 S 30 252, 30 290 C 30 344, 40 356, 150 358 S 262 366, 262 392";

  return (
    <FlowScreen section="Como funciona" onBack={onBack} footer={<GlowButton onClick={onNext}>Começar minha análise</GlowButton>}>
      <div className="pt-8">
        <Heading light="A vida financeira que você quer" bold="já está a caminho." sub="Primeiro, a gente entende o seu momento." />
      </div>
      <div className="relative mx-auto mt-6 h-[420px] w-[300px]">
        <svg viewBox="0 0 300 420" className="absolute inset-0 h-full w-full">
          <motion.path
            d={path}
            fill="none"
            stroke="rgba(255,255,255,0.85)"
            strokeWidth="3"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.8, ease: "easeInOut" }}
          />
        </svg>
        {stops.map(({ Icon, title, text, x, y, side }, i) => (
          <motion.div
            key={title}
            className="absolute"
            style={{ left: x, top: y }}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 + i * 0.5, type: "spring", stiffness: 300, damping: 20 }}
          >
            <span className="absolute -left-[19px] -top-[19px] flex h-[38px] w-[38px] items-center justify-center rounded-full bg-white">
              <Icon className="h-[18px] w-[18px] text-[#0B0B0B]" />
            </span>
            <div className={cn("absolute top-[-20px] w-[176px]", side === "right" ? "left-[30px]" : "right-[30px] text-right")}>
              <p className="text-[14px] font-bold text-white">{title}</p>
              <p className="text-[12.5px] leading-snug text-white/45">{text}</p>
            </div>
          </motion.div>
        ))}
        <motion.span
          className="absolute flex h-12 w-12 items-center justify-center rounded-full bg-willo-green shadow-[0_0_30px_rgba(200,243,109,0.6)]"
          style={{ left: 262 - 24, top: 392 - 24 }}
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.9, type: "spring", stiffness: 280, damping: 14 }}
        >
          <Trophy className="h-5 w-5 text-[#0B0B0B]" />
        </motion.span>
      </div>
    </FlowScreen>
  );
}
