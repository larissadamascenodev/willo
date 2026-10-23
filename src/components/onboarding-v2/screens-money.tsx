import { motion, AnimatePresence } from "framer-motion";
import GlowButton from "@/components/shared/GlowButton";
import { FlowScreen, Heading, OptionRow } from "@/components/onboarding-flow/primitives";
import { CountUp, MoneyInput } from "@/components/onboarding-v2/bits";
import { brl, brl0 } from "@/components/onboarding-v2/money";
import { CORAL, VERDE_AGUA } from "@/components/onboarding-v2/tokens";
import { horaTrabalho, horasDe, type TipoRenda } from "@/lib/onboardingMath";
import type { Objetivo } from "@/lib/onboardingState";

/**
 * What the person wants and what they have to work with: the objective, how the money
 * arrives, how much of it there is, how much leaves, and what an hour of their work is
 * actually worth.
 *
 * The spending question is the only one that can be skipped, and skipping it is a real
 * answer rather than a zero — several screens after this one check for null and say
 * less instead of guessing.
 */

interface Nav {
  onBack: () => void;
  onNext: () => void;
}

/* ── 6. O objetivo ──────────────────────────────────────────────────────────── */

/**
 * The subtitle says what picking this does, before it is picked; the reaction says the
 * Willo heard it, after. Two different moments, so they are allowed to coexist.
 */
const OBJETIVOS: { value: Objetivo; label: string; hint: string; reacao: string }[] = [
  {
    value: "dividas",
    label: "Sair das dívidas",
    hint: "Um prazo e uma parcela por mês",
    reacao: "Boa. Vamos traçar esse caminho.",
  },
  {
    value: "juntar",
    label: "Juntar dinheiro",
    hint: "Uma meta com nome e data",
    reacao: "Combinado. Vamos dar nome e prazo pra isso.",
  },
  {
    value: "investir",
    label: "Começar a investir",
    hint: "Primeiro a reserva de emergência",
    reacao: "Antes de investir, vamos montar o seu colchão.",
  },
  {
    value: "organizar",
    label: "Organizar os gastos",
    hint: "Seu mês dividido em 50/30/20",
    reacao: "Começa por aí. Clareza primeiro, o resto vem.",
  },
];

export function ObjetivoScreen({ value, onChange, onBack, onNext }: Nav & {
  value: Objetivo | null;
  onChange: (v: Objetivo) => void;
}) {
  const escolhido = OBJETIVOS.find((o) => o.value === value);

  return (
    <FlowScreen
      section="Seu objetivo"
      onBack={onBack}
      footer={<GlowButton disabled={!value} onClick={onNext}>Continuar</GlowButton>}
    >
      <div className="pt-8">
        <Heading light="Qual é o seu" bold="objetivo agora?" />
      </div>

      <div className="mt-8 space-y-3">
        {OBJETIVOS.map((o, i) => (
          <OptionRow
            key={o.value}
            label={o.label}
            hint={o.hint}
            selected={value === o.value}
            onClick={() => onChange(o.value)}
            delay={0.05 * i}
          />
        ))}
      </div>

      {/* The Willo answering, so picking an objective feels like being heard. */}
      <AnimatePresence mode="wait">
        {escolhido && (
          <motion.p
            key={escolhido.value}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.28 }}
            className="mt-6 text-[15px] leading-snug text-white/72"
          >
            {escolhido.reacao}
          </motion.p>
        )}
      </AnimatePresence>
    </FlowScreen>
  );
}

/* ── 7. De onde vem o dinheiro ──────────────────────────────────────────────── */

/**
 * The subtitles are not decoration: this answer decides how big the emergency fund
 * should be and whether an hourly rate means anything, so it is worth being sure which
 * line is yours.
 */
const TIPOS_RENDA: { value: TipoRenda; label: string; hint: string }[] = [
  { value: "clt", label: "CLT", hint: "Salário fixo todo mês" },
  { value: "autonomo", label: "Autônomo ou freelancer", hint: "Renda que varia de mês a mês" },
  { value: "empresario", label: "Empresário(a)", hint: "Pró-labore ou retiradas" },
  { value: "servidor", label: "Servidor(a) público(a)", hint: "Renda fixa e estável" },
  { value: "aposentado", label: "Aposentado(a) ou pensionista", hint: "Benefício ou pensão" },
  { value: "estudante", label: "Estudante, sem renda fixa", hint: "Bolsa, estágio ou ajuda" },
  { value: "outro", label: "Outro", hint: "Conte pra gente depois" },
];

export function TipoRendaScreen({ value, onChange, onBack, onNext }: Nav & {
  value: TipoRenda | null;
  onChange: (v: TipoRenda) => void;
}) {
  return (
    <FlowScreen
      section="Sua renda"
      onBack={onBack}
      footer={<GlowButton disabled={!value} onClick={onNext}>Continuar</GlowButton>}
    >
      <div className="pt-8">
        <Heading light="Como você" bold="ganha dinheiro?" />
      </div>

      <div className="mt-7 space-y-2.5 pb-4">
        {TIPOS_RENDA.map((t, i) => (
          <OptionRow
            key={t.value}
            label={t.label}
            hint={t.hint}
            selected={value === t.value}
            onClick={() => onChange(t.value)}
            delay={0.04 * i}
          />
        ))}
      </div>
    </FlowScreen>
  );
}

/* ── 8. Quanto entra ────────────────────────────────────────────────────────── */

export function RendaScreen({ value, onChange, tipo, onBack, onNext }: Nav & {
  value: number | null;
  onChange: (v: number | null) => void;
  tipo: TipoRenda | null;
}) {
  const ok = (value ?? 0) > 0;
  return (
    <FlowScreen
      section="Sua renda"
      onBack={onBack}
      center
      footer={<GlowButton disabled={!ok} onClick={onNext}>Continuar</GlowButton>}
    >
      <Heading light="Qual a sua" bold="renda mensal média?" />
      <MoneyInput value={value} onChange={onChange} onEnter={() => ok && onNext()} />
      <p className="mt-4 text-center text-[13.5px] leading-snug text-white/62">
        Se tem mais de uma fonte, some todas.
        {tipo === "autonomo" && <span className="block mt-1">Pense na média dos últimos meses.</span>}
      </p>
    </FlowScreen>
  );
}

/* ── 9. Quanto sai ──────────────────────────────────────────────────────────── */

export function GastosScreen({ value, onChange, onBack, onNext, onSkip }: Nav & {
  value: number | null;
  onChange: (v: number | null) => void;
  onSkip: () => void;
}) {
  const ok = (value ?? 0) > 0;
  return (
    <FlowScreen
      section="Sua renda"
      onBack={onBack}
      center
      footer={
        <div className="space-y-3">
          <GlowButton disabled={!ok} onClick={onNext}>Continuar</GlowButton>
          <button
            type="button"
            onClick={onSkip}
            className="mx-auto block min-h-[44px] px-4 text-[14px] text-white/62 underline underline-offset-4"
          >
            Prefiro pular
          </button>
        </div>
      }
    >
      <Heading light="Quanto você" bold="gasta por mês, mais ou menos?" />
      <MoneyInput value={value} onChange={onChange} onEnter={() => ok && onNext()} />
      <p className="mt-4 text-center text-[13.5px] leading-snug text-white/62">
        É só uma estimativa. Depois o app mede o real.
      </p>
    </FlowScreen>
  );
}

/* ── 10. O que sobra ────────────────────────────────────────────────────────── */

/**
 * The first number the flow gives back instead of asking for. Shown only when there is
 * a spending figure to subtract, because without one this screen would be inventing.
 */
export function MesScreen({ renda, gastos, onBack, onNext }: Nav & { renda: number; gastos: number }) {
  const sobra = renda - gastos;
  const sobrando = sobra >= 0;

  return (
    <FlowScreen
      section="Sua renda"
      onBack={onBack}
      center
      footer={<GlowButton onClick={onNext}>Continuar</GlowButton>}
    >
      <p className="text-center text-[11px] font-semibold uppercase tracking-[0.28em] text-white/62">Seu mês</p>

      <p className="mt-6 text-center text-[20px] font-light text-white/80">
        {sobrando ? "Hoje, sobram" : "Hoje, faltam"}
      </p>

      {/* The colour is the verdict: there is money left, or there is not. */}
      <p className="mt-2 text-center" style={{ color: sobrando ? VERDE_AGUA : CORAL }}>
        <CountUp
          to={Math.abs(sobra)}
          className="text-[56px] font-extrabold leading-none tracking-tight"
          format={brl0}
        />
      </p>

      <p className="mt-6 text-center text-[14px] leading-snug text-white/62">
        {brl0(renda)} de renda − {brl0(gastos)} de gastos
      </p>
    </FlowScreen>
  );
}

/* ── 11. Uma hora do seu trabalho ───────────────────────────────────────────── */

const horasTexto = (h: number) => h.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

export function HoraTrabalhoScreen({ renda, tipo, onBack, onNext }: Nav & {
  renda: number;
  tipo: TipoRenda | null;
}) {
  const hora = horaTrabalho(renda);
  const exemplos = [
    { rotulo: "Um delivery de R$ 45", horas: horasDe(4500, renda) },
    { rotulo: "Um tênis de R$ 300", horas: horasDe(30000, renda) },
  ];

  return (
    <FlowScreen
      section="Sua renda"
      onBack={onBack}
      center
      footer={<GlowButton onClick={onNext}>Continuar</GlowButton>}
    >
      <h1 className="text-[30px] leading-[1.12] tracking-tight text-white">
        <span className="block font-light">Uma hora do seu trabalho vale</span>
        <span className="block font-extrabold">{brl(Math.round(hora))}</span>
      </h1>
      {tipo === "autonomo" && <p className="mt-2 text-[14px] text-white/62">Em média, pelo que você contou.</p>}

      <div className="mt-8 space-y-3">
        {exemplos.map((e, i) => (
          <motion.div
            key={e.rotulo}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.12 }}
            className="flex items-baseline justify-between gap-3 rounded-[20px] border border-white/[0.06] willo-glass px-5 py-4"
          >
            <span className="text-[14.5px] text-white/80">{e.rotulo}</span>
            <span className="text-[16px] font-bold tabular-nums" style={{ color: VERDE_AGUA }}>
              {horasTexto(e.horas)} h
            </span>
          </motion.div>
        ))}
      </div>

      <p className="mt-7 text-[14.5px] leading-snug text-white/72">Não é pra culpar. É pra decidir com clareza.</p>
    </FlowScreen>
  );
}
