import { useEffect, useState } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "framer-motion";
import { AlertTriangle, Check, ChevronDown, FileText, X } from "lucide-react";
import GlowButton from "@/components/shared/GlowButton";
import { scoreLevel } from "@/services/raioXService";
import {
  PURPOSE_LABEL, brl0, buildFindings, goalVerdict, purposeOf,
  type OnboardingAnswers, type OnboardingPlan, type Tone,
} from "@/lib/onboardingPlan";
import { cn } from "@/lib/utils";

const TICKS = 40;

/** The score factors, named after the questions that fed them. */
const FACTOR_LABEL: Record<string, string> = {
  "Comprometimento da renda": "Fim do mês",
  Parcelamentos: "Cartão de crédito",
  "Estabilidade de gastos": "Imprevistos",
  "Alertas do Radar": "Clareza dos gastos",
};

const BUCKETS = [
  { key: "essentials", label: "Essenciais", share: 50, hex: "#FFFFFF" },
  { key: "lifestyle", label: "Estilo de vida", share: 30, hex: "#8A8A90" },
  { key: "savings", label: "Metas e reserva", share: 20, hex: "#C8F36D" },
] as const;

const TONE: Record<Tone, { hex: string; Icon: typeof Check }> = {
  good: { hex: "#C8F36D", Icon: Check },
  warn: { hex: "#FCD34D", Icon: AlertTriangle },
  bad: { hex: "#F87171", Icon: X },
};

/** The Raio-X speedometer, fed by the onboarding estimate. */
function StartingScore({ plan }: { plan: OnboardingPlan }) {
  const score = plan.score1000;
  const level = scoreLevel(score);
  const count = useMotionValue(0);
  const shown = useTransform(count, (v) => Math.round(v));
  useEffect(() => {
    const c = animate(count, score, { duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 0.2 });
    return () => c.stop();
  }, [count, score]);

  const lit = Math.round((score / 1000) * TICKS);
  const W = 280, H = 150, cx = W / 2, cy = 142, r1 = 100, r2 = 124;

  return (
    <div
      className="relative overflow-hidden rounded-[28px] border border-white/[0.12] px-4 pb-5 pt-4"
      style={{ background: `radial-gradient(120% 80% at 50% 0%, ${level.hex}1F 0%, rgba(20,20,20,0.95) 55%, #0E0E0E 100%)` }}
    >
      <div className="relative mx-auto" style={{ width: W, maxWidth: "100%" }}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
          {Array.from({ length: TICKS }, (_, i) => {
            const angle = Math.PI - (i / (TICKS - 1)) * Math.PI;
            return (
              <motion.line
                key={i}
                x1={cx + r1 * Math.cos(angle)} y1={cy - r1 * Math.sin(angle)}
                x2={cx + r2 * Math.cos(angle)} y2={cy - r2 * Math.sin(angle)}
                strokeWidth={4.5}
                strokeLinecap="round"
                initial={{ stroke: "rgba(255,255,255,0.08)" }}
                animate={{ stroke: i < lit ? level.hex : "rgba(255,255,255,0.08)" }}
                transition={{ delay: 0.2 + i * 0.025, duration: 0.2 }}
              />
            );
          })}
        </svg>
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
          <motion.span className="text-[52px] font-extrabold leading-none tracking-tighter text-white tabular-nums">{shown}</motion.span>
          <span className="mt-1 text-[11px] text-white/56">de 1000 pontos</span>
        </div>
      </div>
      <div className="mt-3 flex justify-center">
        <span className="rounded-full px-3.5 py-1 text-[13px] font-bold text-[#0B0B0B]" style={{ background: level.hex }}>{level.label}</span>
      </div>

      {/* What forms it — horizontal bars */}
      <div className="mt-5 space-y-3">
        {plan.score.factors.map((f, i) => {
          const hex = f.status === "saudavel" ? "#C8F36D" : f.status === "atencao" ? "#FCD34D" : "#F87171";
          return (
            <div key={f.label}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[13px] font-medium text-white">{FACTOR_LABEL[f.label] ?? f.label}</span>
                <span className="text-[12px] tabular-nums text-white/62">{Math.round(f.value)}%</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/[0.07]">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: hex }}
                  initial={{ width: 0 }}
                  animate={{ width: `${f.value}%` }}
                  transition={{ delay: 0.6 + i * 0.1, duration: 0.7, ease: "easeOut" }}
                />
              </div>
              <p className="mt-1 text-[11.5px] text-white/56">{f.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Savings (or payoff) curve from today to the goal. */
function Trajectory({ answers, plan }: { answers: OnboardingAnswers; plan: OnboardingPlan }) {
  const W = 300, H = 120;
  const months = plan.monthsAtSurplus && plan.cut > 0 ? plan.monthsAtSurplus : plan.months;
  const debt = purposeOf(answers) === "dividas";
  const pts = Array.from({ length: 7 }, (_, i) => {
    const t = i / 6;
    // slow start, steady finish: habits take a month or two to kick in
    const v = Math.pow(t, 1.35);
    return { x: 14 + t * (W - 28), y: H - 14 - v * (H - 34) };
  });
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  return (
    <div className="mt-2.5 rounded-[22px] willo-glass-inset p-4">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/56">Hoje</p>
          <p className="text-[20px] font-extrabold text-white">R$ 0</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-willo-green">{debt ? "Dívida quitada" : "Objetivo"}</p>
          <p className="text-[20px] font-extrabold text-willo-green tabular-nums">{brl0(answers.target)}</p>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full">
        <motion.path d={d} fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.3 }} />
        {pts.filter((_, i) => i % 3 === 0).map((p, i) => (
          <motion.circle key={i} cx={p.x} cy={p.y} r={i === 2 ? 6 : 4} fill={i === 2 ? "#C8F36D" : "#0B0B0B"} stroke={i === 2 ? "#C8F36D" : "#FFFFFF"} strokeWidth="2.5" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.4 + i * 0.4 }} />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-white/56">
        <span>Agora</span>
        <span>em {months} {months === 1 ? "mês" : "meses"}</span>
      </div>
    </div>
  );
}

/**
 * The payoff screen: the analysis of the person's financial profile — the
 * starting score, what the answers revealed and whether the goal fits — and
 * then a suggested plan (50/30/20) they can follow.
 */
export default function ResultStep({ answers, plan, onNext }: { answers: OnboardingAnswers; plan: OnboardingPlan; onNext: () => void }) {
  const [how, setHow] = useState(false);
  const name = answers.name.trim().split(/\s+/)[0];
  const income = Math.max(answers.income, 0);
  const purpose = purposeOf(answers);
  const findings = buildFindings(answers, plan);
  const verdict = goalVerdict(answers, plan);
  const V = TONE[verdict.tone];

  const section = (label: string) => (
    <p className="mb-3 mt-8 px-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-white/56">{label}</p>
  );

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <div className="pointer-events-none absolute -left-28 -top-36 h-80 w-80 rounded-full bg-white/[0.07] blur-[100px]" />
      <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-10">
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto flex w-fit items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.05] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/74"
        >
          <Check className="h-3.5 w-3.5 text-willo-green" strokeWidth={3} /> Análise concluída
        </motion.p>
        <h1 className="mt-4 text-center text-[27px] leading-tight tracking-tight text-white">
          <span className="font-light">{name ? `${name}, este é o seu` : "Este é o seu"} </span>
          <span className="font-extrabold">perfil financeiro.</span>
        </h1>

        {section("Seu score inicial")}
        <StartingScore plan={plan} />

        {section("O que a gente viu")}
        <div className="divide-y divide-white/[0.06] rounded-[24px] border border-white/[0.12] willo-glass-strong px-4">
          {findings.map((f, i) => {
            const T = TONE[f.tone];
            return (
              <motion.div
                key={f.title + i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.08 }}
                className="flex gap-3 py-3.5"
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: `${T.hex}22` }}>
                  <T.Icon className="h-3.5 w-3.5" style={{ color: T.hex }} strokeWidth={3} />
                </span>
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-white">{f.title}</p>
                  <p className="text-[13px] leading-snug text-white/66">{f.detail}</p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {section("Seu objetivo")}
        <div className="rounded-[24px] border border-white/[0.12] willo-glass-strong p-4">
          <p className="text-[13px] text-white/62">{PURPOSE_LABEL[purpose]}</p>
          <p className="flex items-baseline gap-1.5">
            <span className="text-[26px] font-extrabold leading-tight tracking-tight text-white tabular-nums">{brl0(plan.monthlySave)}</span>
            <span className="text-[13px] text-white/62">por mês, em {plan.months} {plan.months === 1 ? "mês" : "meses"}</span>
          </p>
          <div className="mt-3 flex gap-2.5 rounded-[18px] p-3" style={{ background: `${V.hex}14` }}>
            <V.Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: V.hex }} strokeWidth={2.6} />
            <p className="text-[13.5px] leading-snug text-white/80">{verdict.text}</p>
          </div>
          <Trajectory answers={answers} plan={plan} />
        </div>

        {section("Plano sugerido")}
        <div className="rounded-[24px] border border-white/[0.12] willo-glass-strong p-4">
          <p className="text-[22px] font-extrabold uppercase leading-none tracking-tight text-white">Método 50/30/20</p>
          <p className="mt-2 text-[13.5px] leading-snug text-white/66">
            Pelo seu perfil, a gente sugere dividir a renda em três partes. É uma sugestão: você segue no seu ritmo e ajusta no app.
          </p>

          <div className="mt-4 rounded-[20px] willo-glass-inset p-4">
            <div className="flex h-2.5 overflow-hidden rounded-full">
              {BUCKETS.map((b, i) => (
                <motion.span
                  key={b.key}
                  className="h-full rounded-full"
                  style={{ background: b.hex, borderRight: i < BUCKETS.length - 1 ? "3px solid #1A1A1A" : undefined }}
                  initial={{ width: 0 }}
                  animate={{ width: `${b.share}%` }}
                  transition={{ delay: 0.3 + i * 0.12, duration: 0.6, ease: "easeOut" }}
                />
              ))}
            </div>
            <div className="mt-3.5 space-y-2.5">
              {BUCKETS.map((b) => (
                <div key={b.key} className="flex items-center justify-between text-[14px]">
                  <span className="flex items-center gap-2 text-white/74">
                    <span className="h-2 w-2 rounded-full" style={{ background: b.hex }} />
                    {b.label} <span className="text-white/45">{b.share}%</span>
                  </span>
                  <span className="font-semibold tabular-nums" style={{ color: b.key === "savings" ? b.hex : "#FFFFFF" }}>{brl0(plan[b.key])}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-2.5 flex items-center justify-between rounded-[18px] willo-glass-inset px-4 py-3.5 text-[14px]">
            <span className="text-white/70">Reserva de emergência ideal</span>
            <span className="font-semibold text-white tabular-nums">{brl0(plan.reserve)}</span>
          </div>
        </div>

        <button type="button" onClick={() => setHow((v) => !v)} className="mx-auto mt-6 flex items-center gap-2 text-[14px] text-white/74">
          <FileText className="h-4 w-4" /> De onde vêm os seus números
          <ChevronDown className={cn("h-4 w-4 transition-transform", how && "rotate-180")} />
        </button>
        <AnimatePresence initial={false}>
          {how && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="mt-3 space-y-2 rounded-[20px] border border-white/[0.12] willo-glass p-4 text-[13px] leading-relaxed text-white/74">
                <p><b className="text-white/85">Sobra do mês:</b> renda ({brl0(income)}) − gastos ({brl0(answers.spending)}) = {plan.surplus < 0 ? "−" : ""}{brl0(plan.surplus)}.</p>
                <p><b className="text-white/85">Por mês pro objetivo:</b> {brl0(answers.target)} ÷ {plan.months} {plan.months === 1 ? "mês" : "meses"}, arredondado = {brl0(plan.monthlySave)}.</p>
                <p><b className="text-white/85">Score:</b> estimativa pelas suas respostas sobre fim de mês, cartão, imprevistos e dívidas. Ele se ajusta sozinho quando você começar a lançar seus gastos.</p>
                <p><b className="text-white/85">50/30/20:</b> 50% da renda pro essencial, 30% pro estilo de vida e 20% pras metas.</p>
                <p><b className="text-white/85">Reserva ideal:</b> 6 × seus gastos mensais.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="mx-auto mt-6 max-w-[330px] text-center text-[11.5px] leading-relaxed text-white/45">
          Essa análise usa só as suas respostas e serve pra organização e educação financeira. Não é recomendação de investimento.
        </p>
      </div>

      <div className="relative shrink-0 px-5 pb-5 pt-3">
        <GlowButton onClick={onNext}>Vamos começar!</GlowButton>
      </div>
    </div>
  );
}
