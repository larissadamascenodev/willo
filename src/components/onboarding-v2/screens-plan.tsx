import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Bell, Check, ChevronDown, MessageCircle, Sparkles } from "lucide-react";
import GlowButton from "@/components/shared/GlowButton";
import { FlowScreen, Heading } from "@/components/onboarding-flow/primitives";
import { CountUp, EstimateBadge, PlanRow } from "@/components/onboarding-v2/bits";
import { brl0 } from "@/components/onboarding-v2/money";
import { CORAL, VERDE_AGUA } from "@/components/onboarding-v2/tokens";
import type { DerivedPlan, OnboardingAnswers } from "@/lib/onboardingState";
import { cn } from "@/lib/utils";

/**
 * The last stretch before the account: a promise, a preference, the pause while the
 * numbers are worked out, the plan itself, and what the person is walking away with.
 */

interface Nav {
  onBack: () => void;
  onNext: () => void;
}

const SECTION = "Seu plano";

/* ── 17. O compromisso ──────────────────────────────────────────────────────── */

/**
 * Drawing the tick rather than tapping it, because the gesture is the point: it takes a
 * second of deliberate movement, which is what makes it read as a promise.
 *
 * Tapping is always available beside it, in words — a drawing gesture is no good with a
 * keyboard, a switch or a screen reader, so it can never be the only way through.
 */
export function CompromissoScreen({ onBack, onConfirm }: { onBack: () => void; onConfirm: () => void }) {
  const [pontos, setPontos] = useState<{ x: number; y: number }[]>([]);
  const [feito, setFeito] = useState(false);
  const desenhando = useRef(false);
  const caixa = useRef<HTMLDivElement>(null);

  const confirmar = () => {
    if (feito) return;
    setFeito(true);
    window.setTimeout(onConfirm, 620);
  };

  const ponto = (e: React.PointerEvent) => {
    const r = caixa.current?.getBoundingClientRect();
    if (!r) return null;
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const comecar = (e: React.PointerEvent) => {
    if (feito) return;
    desenhando.current = true;
    caixa.current?.setPointerCapture(e.pointerId);
    const p = ponto(e);
    setPontos(p ? [p] : []);
  };

  const mover = (e: React.PointerEvent) => {
    if (!desenhando.current || feito) return;
    const p = ponto(e);
    if (p) setPontos((atual) => [...atual, p]);
  };

  /* Enough movement to be a gesture rather than a slip of the finger. */
  const terminar = () => {
    desenhando.current = false;
    if (pontos.length >= 8) confirmar();
    else setPontos([]);
  };

  return (
    <FlowScreen section={SECTION} onBack={onBack} center>
      <Heading light="Você topa seguir" bold="o plano que vamos criar?" />

      <div
        ref={caixa}
        onPointerDown={comecar}
        onPointerMove={mover}
        onPointerUp={terminar}
        onPointerCancel={terminar}
        role="presentation"
        className={cn(
          "relative mt-9 h-[190px] w-full touch-none rounded-[26px] border-2 border-dashed transition-colors",
          feito ? "border-transparent" : "border-white/20",
        )}
      >
        <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
          {pontos.length > 1 && (
            <polyline
              points={pontos.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke={VERDE_AGUA}
              strokeWidth={5}
              strokeLinecap="round"
              strokeLinejoin="round"
              /* The stroke glows as it is drawn, so the gesture leaves light behind it. */
              style={{ filter: `drop-shadow(0 0 7px ${VERDE_AGUA})` }}
            />
          )}
        </svg>

        {!pontos.length && !feito && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[14px] text-white/45">
            Desenhe um ✓ aqui
          </span>
        )}

        {feito && (
          <motion.span
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 420, damping: 20 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <span
              className="flex h-20 w-20 items-center justify-center rounded-full"
              style={{ background: VERDE_AGUA }}
            >
              <Check className="h-10 w-10 text-[#0B0B0B]" strokeWidth={3} />
            </span>
          </motion.span>
        )}
      </div>

      <div className="mt-7 flex items-center justify-center gap-5">
        <button
          type="button"
          onClick={confirmar}
          className="min-h-[44px] px-2 text-[14.5px] text-white/70 underline underline-offset-4"
        >
          Prefiro tocar
        </button>
        {/* A tick that came out wrong should not have to be lived with. */}
        {pontos.length > 0 && !feito && (
          <button
            type="button"
            onClick={() => setPontos([])}
            className="min-h-[44px] px-2 text-[14.5px] text-white/50 underline underline-offset-4"
          >
            Limpar
          </button>
        )}
      </div>
    </FlowScreen>
  );
}

/* ── 18. Os lembretes ───────────────────────────────────────────────────────── */

export function LembretesScreen({ onBack, onDecide }: {
  onBack: () => void;
  onDecide: (ativar: boolean) => void;
}) {
  const ativar = async () => {
    /* On an iPhone outside an installed app there is no Notification at all, so the
       preference is all there is to save — asking would throw. */
    try {
      if (typeof Notification !== "undefined" && typeof Notification.requestPermission === "function") {
        await Notification.requestPermission();
      }
    } catch {
      /* refused, blocked, unsupported: the preference is kept either way */
    }
    onDecide(true);
  };

  return (
    <FlowScreen
      section={SECTION}
      onBack={onBack}
      center
      footer={
        <div className="space-y-3">
          <GlowButton onClick={ativar}>Ativar</GlowButton>
          <button
            type="button"
            onClick={() => onDecide(false)}
            className="mx-auto block min-h-[44px] px-4 text-[14px] text-white/62 underline underline-offset-4"
          >
            Agora não
          </button>
        </div>
      }
    >
      <span className="mx-auto mb-7 flex h-16 w-16 items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.05]">
        <Bell className="h-7 w-7 text-white/85" />
      </span>
      <Heading light="Ative os lembretes e" bold="não perca nenhum vencimento." />
    </FlowScreen>
  );
}

/* ── 19. Lendo suas respostas ───────────────────────────────────────────────── */

const ETAPAS = ["Calculando seu mês", "Montando sua divisão 50/30/20", "Ajustando sua meta"];

export function LendoScreen({ onDone }: { onDone: () => void }) {
  const still = useReducedMotion();
  const [prontas, setProntas] = useState(0);

  useEffect(() => {
    if (still) {
      setProntas(ETAPAS.length);
      const t = window.setTimeout(onDone, 300);
      return () => window.clearTimeout(t);
    }
    const marcos = ETAPAS.map((_, i) => window.setTimeout(() => setProntas(i + 1), 800 + i * 800));
    const fim = window.setTimeout(onDone, 3100);
    return () => {
      marcos.forEach(window.clearTimeout);
      window.clearTimeout(fim);
    };
  }, [onDone, still]);

  return (
    <FlowScreen section={SECTION} center>
      <Heading light="Só um instante." bold="Lendo suas respostas…" />

      <div className="mt-10 space-y-4">
        {ETAPAS.map((etapa, i) => {
          const pronta = i < prontas;
          return (
            <div key={etapa} className="flex items-center gap-3.5">
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  pronta ? "border-transparent" : "border-white/20",
                )}
                style={pronta ? { background: VERDE_AGUA } : undefined}
              >
                {pronta && <Check className="h-4 w-4 text-[#0B0B0B]" strokeWidth={3.5} />}
              </span>
              <span className={cn("text-[15.5px] transition-colors", pronta ? "text-white" : "text-white/45")}>
                {etapa}
              </span>
            </div>
          );
        })}
      </div>
    </FlowScreen>
  );
}

/* ── 20. O plano ────────────────────────────────────────────────────────────── */

export function PlanoScreen({ answers, plan, onBack, onNext }: Nav & {
  answers: OnboardingAnswers;
  plan: DerivedPlan;
}) {
  const nome = answers.nome.trim().split(/\s+/)[0] ?? "";
  const falta = plan.sobra !== null && plan.sobra < 0 ? Math.abs(plan.sobra) : null;
  const temMeta = plan.metaMensal !== null && plan.metaMensal > 0;

  return (
    <FlowScreen
      section={SECTION}
      onBack={onBack}
      footer={<GlowButton onClick={onNext}>Vamos começar!</GlowButton>}
    >
      <div className="pt-6">
        <Heading light="Seu plano está pronto," bold={`${nome || "vamos lá"}.`} />
      </div>

      <div className="mt-7 rounded-[24px] border border-white/[0.07] willo-glass p-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-white/60">50/30/20 em reais</p>
          <EstimateBadge />
        </div>
        <div className="mt-3">
          <PlanRow label="Necessidades · 50%" value={plan.plano.necessidades} share={50} tone="rgba(255,255,255,0.45)" delay={0.1} />
          <PlanRow label="Desejos · 30%" value={plan.plano.desejos} share={30} tone="rgba(255,255,255,0.28)" delay={0.2} />
          <PlanRow label="Futuro · 20%" value={plan.plano.futuro} share={20} tone={VERDE_AGUA} delay={0.3} />
        </div>
        {/* Only when it actually fits: saying the Futuro "includes" more than the
            Futuro holds is a sentence that contradicts the number above it. */}
        {temMeta && !plan.metaPesaDemais && (
          <p className="mt-2 text-[13px] leading-snug t-soft">
            O Futuro já inclui {brl0(plan.metaMensal ?? 0)} da sua{" "}
            {answers.objetivo === "dividas" ? "dívida" : "meta"}.
          </p>
        )}
      </div>

      {temMeta && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="mt-4 rounded-[24px] border border-white/[0.07] willo-glass p-5"
        >
          <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-white/60">
            {answers.objetivo === "dividas" ? "Sua dívida" : "Sua meta"}
          </p>
          <p className="mt-2 text-[18px] font-bold text-white">
            {answers.metaNome.trim() || (answers.objetivo === "dividas" ? "Sair das dívidas" : "Reserva de emergência")}
          </p>
          <div className="mt-3 flex items-end justify-between gap-4">
            <span>
              <span className="block text-[12px] t-soft">Valor</span>
              <span className="block text-[16px] font-semibold tabular-nums text-white">
                {brl0(answers.metaValorCentavos ?? plan.reserva?.minima ?? 0)}
              </span>
            </span>
            {answers.prazoMeses && (
              <span className="text-right">
                <span className="block text-[12px] t-soft">Prazo</span>
                <span className="block text-[16px] font-semibold tabular-nums text-white">
                  {answers.prazoMeses} meses
                </span>
              </span>
            )}
            <span className="text-right">
              <span className="block text-[12px] t-soft">Por mês</span>
              <span className="block text-[16px] font-semibold tabular-nums" style={{ color: VERDE_AGUA }}>
                {brl0(plan.metaMensal ?? 0)}
              </span>
            </span>
          </div>

          {/* Said out loud, and nothing is changed because of it: the plan is theirs.
              Past the whole income it is not a tight plan but an impossible one, and
              calling that "doable" would be the one thing this screen must not do. */}
          {plan.metaPesaDemais && (
            <p className="mt-4 text-[13.5px] leading-snug text-white/70">
              {plan.metaPercentual >= 100
                ? `Ela pede ${plan.metaPercentual}% da sua renda, ou seja, mais do que entra no mês. Com um prazo maior ela cabe — dá para ajustar depois.`
                : `Ela pede ${plan.metaPercentual}% da sua renda, acima dos 20% do Futuro. Dá para seguir assim — é bom só saber disso.`}
            </p>
          )}
        </motion.div>
      )}

      {falta !== null && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="mt-4 rounded-[20px] border p-4"
          style={{ borderColor: `${CORAL}40`, background: `${CORAL}14` }}
        >
          <p className="text-[14.5px] leading-snug" style={{ color: CORAL }}>
            Faltam <CountUp to={falta} className="font-bold" /> por mês para fechar a conta. No app o Willo mostra onde
            ajustar.
          </p>
        </motion.div>
      )}

      <p className="mt-5 pb-2 text-center text-[13px] t-soft">Você pode ajustar depois.</p>
    </FlowScreen>
  );
}

/* ── 21. O que você leva ────────────────────────────────────────────────────── */

const LEVA = [
  { icon: Bell, titulo: "Avisos antes de apertar", texto: "Os alertas do Radar, enquanto ainda dá pra decidir." },
  { icon: MessageCircle, titulo: "Pergunte antes de gastar", texto: "O Willo responde se cabe no seu mês." },
  { icon: Sparkles, titulo: "Seu time de agentes", texto: "Trabalhando junto com o Willo, cada um no seu assunto." },
];

export function LevaScreen({ onBack, onNext }: Nav) {
  const [aberto, setAberto] = useState(false);

  return (
    <FlowScreen
      section={SECTION}
      onBack={onBack}
      footer={<GlowButton onClick={onNext}>Continuar</GlowButton>}
    >
      <div className="pt-6">
        <Heading light="O que você" bold="leva daqui." />
      </div>

      <div className="mt-7 space-y-3">
        {LEVA.map(({ icon: Icon, titulo, texto }, i) => (
          <motion.div
            key={titulo}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 * i }}
            className="flex items-start gap-4 rounded-[22px] border border-white/[0.06] willo-glass p-4"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.05]">
              <Icon className="h-5 w-5 text-white/85" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15.5px] font-semibold text-white">{titulo}</span>
              <span className="mt-0.5 block text-[13.5px] leading-snug text-white/62">{texto}</span>
            </span>
          </motion.div>
        ))}
      </div>

      {/* The sources are the reason to believe the numbers, so they are not something to
          be found behind a tap. They sit on the screen, in small print, always. */}
      <p className="mt-6 text-[12px] leading-relaxed t-softer">
        Regra 50/30/20: Elizabeth Warren e Amelia Warren Tyagi, <i>All Your Worth: The Ultimate Lifetime Money Plan</i>{" "}
        (2005). Reserva de emergência de 3 a 6 meses de gastos, e de 6 a 12 quando a renda varia. Estimativas, não
        garantias.
      </p>

      <div className="mt-4 overflow-hidden rounded-[22px] border border-white/[0.06] willo-glass">
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          className="flex min-h-[52px] w-full items-center justify-between gap-3 px-5 text-left"
        >
          <span className="text-[14.5px] font-semibold text-white/85">De onde vêm seus números</span>
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-white/60 transition-transform", aberto && "rotate-180")} />
        </button>

        {aberto && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            transition={{ duration: 0.28 }}
            className="px-5 pb-5"
          >
            <ul className="space-y-3 text-[13.5px] leading-relaxed text-white/66">
              <li>
                <b className="font-semibold text-white/85">O seu mês</b> é o que você respondeu de renda menos o que
                respondeu de gastos. Nada vem de fora.
              </li>
              <li>
                <b className="font-semibold text-white/85">A divisão</b> aplica os 50/30/20 em reais sobre a sua renda,
                e o Futuro é onde a meta cabe.
              </li>
              <li>
                <b className="font-semibold text-white/85">A meta</b> é o valor dividido pelo prazo, arredondado para
                cima para o último mês não ficar faltando — sem juros e sem rendimento.
              </li>
              <li>
                <b className="font-semibold text-white/85">A reserva</b> é o seu gasto mensal multiplicado pelos meses
                que você quer conseguir atravessar.
              </li>
            </ul>
          </motion.div>
        )}
      </div>
      <div className="pb-2" />
    </FlowScreen>
  );
}
