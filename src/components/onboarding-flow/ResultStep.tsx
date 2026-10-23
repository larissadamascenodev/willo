import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "framer-motion";
import { AlertTriangle, Check, ChevronDown, FileText, TrendingUp, X } from "lucide-react";
import GlowButton from "@/components/shared/GlowButton";
import { scoreLevel } from "@/services/raioXService";
import {
  PURPOSE_LABEL, brl0, buildFindings, goalVerdict, purposeOf,
  type OnboardingAnswers, type OnboardingPlan, type Tone,
} from "@/lib/onboardingPlan";
import { cn } from "@/lib/utils";

const TICKS = 40;
const VERDE = "#C8F36D";

/** Sai depressa e assenta devagar: o mesmo movimento das telas de pergunta. */
const SUAVE = [0.16, 1, 0.3, 1] as const;

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
  { key: "savings", label: "Metas e reserva", share: 20, hex: VERDE },
] as const;

const TONE: Record<Tone, { hex: string; Icon: typeof Check }> = {
  good: { hex: VERDE, Icon: Check },
  warn: { hex: "#FCD34D", Icon: AlertTriangle },
  bad: { hex: "#F87171", Icon: X },
};

/**
 * Um trecho da análise. Sem cartão: um fio separa do anterior e o conteúdo
 * fica solto no fundo da tela, que é o que dá o ar de leitura e não de painel.
 */
function Bloco({ rotulo, primeiro = false, children }: { rotulo: string; primeiro?: boolean; children: ReactNode }) {
  return (
    <section className={cn("mt-8", !primeiro && "border-t border-white/[0.06] pt-8")}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/40">{rotulo}</p>
      {children}
    </section>
  );
}

/** O velocímetro do Raio-X, aceso pela estimativa do onboarding. */
function StartingScore({ plan }: { plan: OnboardingPlan }) {
  const score = plan.score1000;
  const level = scoreLevel(score);
  const count = useMotionValue(0);
  const shown = useTransform(count, (v) => Math.round(v));
  useEffect(() => {
    const c = animate(count, score, { duration: 1.6, ease: SUAVE, delay: 0.25 });
    return () => c.stop();
  }, [count, score]);

  const lit = Math.round((score / 1000) * TICKS);
  const W = 280, H = 150, cx = W / 2, cy = 142, r1 = 100, r2 = 124;

  return (
    <div className="relative mx-auto mt-7" style={{ width: W, maxWidth: "100%" }}>
      {/* A luz sai do próprio número e se perde no fundo — nada de caixa em volta. */}
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[64%] h-60 w-60 -translate-x-1/2 -translate-y-1/2 rounded-full blur-[72px]"
        style={{ background: `${level.hex}2E` }}
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3, duration: 1.1, ease: SUAVE }}
      />

      <svg viewBox={`0 0 ${W} ${H}`} className="relative w-full">
        {Array.from({ length: TICKS }, (_, i) => {
          const angle = Math.PI - (i / (TICKS - 1)) * Math.PI;
          return (
            <motion.line
              key={i}
              x1={cx + r1 * Math.cos(angle)} y1={cy - r1 * Math.sin(angle)}
              x2={cx + r2 * Math.cos(angle)} y2={cy - r2 * Math.sin(angle)}
              strokeWidth={4.5}
              strokeLinecap="round"
              initial={{ stroke: "rgba(255,255,255,0.07)" }}
              animate={{ stroke: i < lit ? level.hex : "rgba(255,255,255,0.07)" }}
              transition={{ delay: 0.25 + i * 0.025, duration: 0.2 }}
            />
          );
        })}
      </svg>

      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
        <motion.span className="text-[58px] font-extrabold leading-none tracking-tighter text-white tabular-nums">
          {shown}
        </motion.span>
        <span className="mt-2 text-[10.5px] font-semibold uppercase tracking-[0.22em] text-white/40">de 1000 pontos</span>
      </div>
    </div>
  );
}

/** A curva de hoje até o objetivo, da largura inteira da tela. */
function Trajectory({ answers, plan }: { answers: OnboardingAnswers; plan: OnboardingPlan }) {
  const W = 340, H = 132;
  const months = plan.monthsAtSurplus && plan.cut > 0 ? plan.monthsAtSurplus : plan.months;
  const debt = purposeOf(answers) === "dividas";

  // Começa devagar e firma no fim: o hábito leva um mês ou dois para pegar.
  const pts = Array.from({ length: 25 }, (_, i) => {
    const t = i / 24;
    return { x: t * W, y: H - 10 - Math.pow(t, 1.4) * (H - 30) };
  });
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  // A curva vai até a borda da tela, mas o selo para antes para não ser cortado.
  const selo = pts[pts.length - 4];

  return (
    <div className="relative mt-7">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-white/35">Hoje</p>
          <p className="mt-1 text-[20px] font-extrabold leading-none text-white/65 tabular-nums">R$ 0</p>
        </div>
        <div className="text-right">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.2em]" style={{ color: VERDE }}>
            {debt ? "Dívida quitada" : "Objetivo"}
          </p>
          <p className="mt-1 text-[20px] font-extrabold leading-none tabular-nums" style={{ color: VERDE }}>
            {brl0(answers.target)}
          </p>
        </div>
      </div>

      <div className="relative mt-4 -mx-5">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height: 132 }}>
          <defs>
            <linearGradient id="res-area" x1="0" x2="0" y1="0" y2={H} gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={VERDE} stopOpacity="0.3" />
              <stop offset="100%" stopColor={VERDE} stopOpacity="0" />
            </linearGradient>
            <linearGradient id="res-line" x1="0" x2={W} y1="0" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.45" />
              <stop offset="100%" stopColor={VERDE} stopOpacity="1" />
            </linearGradient>
          </defs>

          {[0.33, 0.66].map((f) => (
            <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="rgba(255,255,255,0.045)" />
          ))}

          <motion.path
            d={`${d} L${W},${H} L0,${H} Z`}
            fill="url(#res-area)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1, duration: 0.7 }}
          />
          <motion.path
            d={d}
            fill="none"
            stroke="url(#res-line)"
            strokeWidth="3"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.3, duration: 1.4, ease: "easeInOut" }}
          />
        </svg>

        {/* O selo de chegada, o mesmo da tela da evolução. */}
        <motion.span
          aria-hidden="true"
          className="absolute flex h-9 w-9 items-center justify-center rounded-full shadow-[0_0_24px_rgba(200,243,109,0.5)]"
          style={{ background: VERDE, left: `${(selo.x / W) * 100}%`, top: `${(selo.y / H) * 100}%`, x: "-50%", y: "-50%" }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 1.5, type: "spring", stiffness: 300, damping: 16 }}
        >
          <TrendingUp className="h-4 w-4 text-[#0B0B0B]" strokeWidth={2.8} />
        </motion.span>
      </div>

      <div className="mt-3 flex justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
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
  const nivel = scoreLevel(plan.score1000);
  const V = TONE[verdict.tone];

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <div className="pointer-events-none absolute -left-28 -top-36 h-80 w-80 rounded-full bg-white/[0.07] blur-[100px]" />
      <div className="pointer-events-none absolute -right-28 -top-28 h-72 w-72 rounded-full bg-white/[0.045] blur-[100px]" />

      <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-10">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: SUAVE }}
          className="flex w-fit items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.24em]"
          style={{ color: VERDE }}
        >
          <Check className="h-3.5 w-3.5" strokeWidth={3.2} /> Análise concluída
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06, duration: 0.5, ease: SUAVE }}
          className="mt-3 text-[30px] leading-[1.12] tracking-tight text-white"
        >
          <span className="block font-light">{name ? `${name}, este é o seu` : "Este é o seu"}</span>
          <span className="block font-extrabold">perfil financeiro.</span>
        </motion.h1>

        <StartingScore plan={plan} />

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1, duration: 0.5, ease: SUAVE }}
          className="mt-5 flex items-baseline justify-center gap-2.5"
        >
          <span className="text-[22px] font-extrabold tracking-tight" style={{ color: nivel.hex }}>{nivel.label}</span>
          <span className="text-[13px] text-white/40">é o seu ponto de partida</span>
        </motion.div>

        <Bloco rotulo="O que forma esse número">
          <div className="mt-5 space-y-5">
            {plan.score.factors.map((f, i) => {
              const hex = f.status === "saudavel" ? VERDE : f.status === "atencao" ? "#FCD34D" : "#F87171";
              return (
                <motion.div
                  key={f.label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + i * 0.08, duration: 0.45, ease: SUAVE }}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[14.5px] font-semibold text-white/90">{FACTOR_LABEL[f.label] ?? f.label}</span>
                    <span className="text-[13px] font-bold tabular-nums" style={{ color: hex }}>{Math.round(f.value)}%</span>
                  </div>
                  <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-white/[0.07]">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: hex }}
                      initial={{ width: 0 }}
                      animate={{ width: `${f.value}%` }}
                      transition={{ delay: 0.6 + i * 0.1, duration: 0.85, ease: SUAVE }}
                    />
                  </div>
                  <p className="mt-2 text-[12.5px] leading-snug text-white/45">{f.description}</p>
                </motion.div>
              );
            })}
          </div>
        </Bloco>

        <Bloco rotulo="O que a gente viu">
          <div className="mt-2 divide-y divide-white/[0.05]">
            {findings.map((f, i) => {
              const T = TONE[f.tone];
              return (
                <motion.div
                  key={f.title + i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.08, duration: 0.42, ease: SUAVE }}
                  className="flex gap-3.5 py-4"
                >
                  <span className="mt-[3px] h-2 w-2 shrink-0 rounded-full" style={{ background: T.hex }} />
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-white">{f.title}</p>
                    <p className="mt-0.5 text-[13px] leading-snug text-white/50">{f.detail}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </Bloco>

        <Bloco rotulo="Seu objetivo">
          <p className="mt-4 text-[13.5px] text-white/45">{PURPOSE_LABEL[purpose]}</p>
          <p className="mt-1.5 text-[42px] font-extrabold leading-none tracking-tight text-white tabular-nums">
            {brl0(plan.monthlySave)}
          </p>
          <p className="mt-2 text-[14px] text-white/50">
            por mês, em {plan.months} {plan.months === 1 ? "mês" : "meses"}
          </p>

          <div className="mt-5 border-l-2 pl-4" style={{ borderColor: V.hex }}>
            <p className="text-[13.5px] leading-relaxed text-white/75">{verdict.text}</p>
          </div>

          <Trajectory answers={answers} plan={plan} />
        </Bloco>

        <Bloco rotulo="Plano sugerido">
          <p className="mt-4 text-[26px] font-extrabold leading-none tracking-tight text-white">Método 50/30/20</p>
          <p className="mt-2.5 text-[13.5px] leading-relaxed text-white/50">
            Pelo seu perfil, a gente sugere dividir a renda em três partes. É uma sugestão: você segue no seu ritmo e ajusta no app.
          </p>

          <div className="mt-6 flex gap-1.5">
            {BUCKETS.map((b, i) => (
              <motion.span
                key={b.key}
                className="h-1.5 basis-0 origin-left rounded-full"
                style={{ background: b.hex, flexGrow: b.share }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.3 + i * 0.12, duration: 0.7, ease: SUAVE }}
              />
            ))}
          </div>

          <div className="mt-5 divide-y divide-white/[0.05]">
            {BUCKETS.map((b) => (
              <div key={b.key} className="flex items-baseline justify-between gap-3 py-3.5">
                <span className="flex items-baseline gap-2.5 text-[14.5px] text-white/75">
                  <span className="h-2 w-2 shrink-0 translate-y-[-1px] rounded-full" style={{ background: b.hex }} />
                  {b.label}
                  <span className="text-[12px] tabular-nums text-white/30">{b.share}%</span>
                </span>
                <span
                  className="text-[15.5px] font-bold tabular-nums"
                  style={{ color: b.key === "savings" ? b.hex : "#FFFFFF" }}
                >
                  {brl0(plan[b.key])}
                </span>
              </div>
            ))}
            <div className="flex items-baseline justify-between gap-3 py-3.5">
              <span className="text-[14.5px] text-white/50">Reserva de emergência ideal</span>
              <span className="text-[15.5px] font-bold text-white/80 tabular-nums">{brl0(plan.reserve)}</span>
            </div>
          </div>
        </Bloco>

        <div className="mt-8 border-t border-white/[0.06] pt-6">
          <button
            type="button"
            onClick={() => setHow((v) => !v)}
            className="flex w-full items-center gap-2 text-[13.5px] text-white/55"
          >
            <FileText className="h-4 w-4" /> De onde vêm os seus números
            <ChevronDown className={cn("ml-auto h-4 w-4 transition-transform", how && "rotate-180")} />
          </button>
          <AnimatePresence initial={false}>
            {how && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.35, ease: SUAVE }}
                className="overflow-hidden"
              >
                <div className="space-y-2.5 pt-4 text-[12.5px] leading-relaxed text-white/50">
                  <p><b className="font-semibold text-white/75">Sobra do mês:</b> renda ({brl0(income)}) − gastos ({brl0(answers.spending)}) = {plan.surplus < 0 ? "−" : ""}{brl0(plan.surplus)}.</p>
                  <p><b className="font-semibold text-white/75">Por mês pro objetivo:</b> {brl0(answers.target)} ÷ {plan.months} {plan.months === 1 ? "mês" : "meses"}, arredondado = {brl0(plan.monthlySave)}.</p>
                  <p><b className="font-semibold text-white/75">Score:</b> estimativa pelas suas respostas sobre fim de mês, cartão, imprevistos e dívidas. Ele se ajusta sozinho quando você começar a lançar seus gastos.</p>
                  <p><b className="font-semibold text-white/75">50/30/20:</b> 50% da renda pro essencial, 30% pro estilo de vida e 20% pras metas.</p>
                  <p><b className="font-semibold text-white/75">Reserva ideal:</b> 6 × seus gastos mensais.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="mt-7 text-[11.5px] leading-relaxed text-white/30">
          Essa análise usa só as suas respostas e serve pra organização e educação financeira. Não é recomendação de investimento.
        </p>
      </div>

      <div className="relative shrink-0 px-5 pb-5 pt-3">
        <GlowButton onClick={onNext}>Vamos começar!</GlowButton>
      </div>
    </div>
  );
}
