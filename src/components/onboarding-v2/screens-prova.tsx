import { motion, useReducedMotion } from "framer-motion";
import { Star } from "lucide-react";
import GlowButton from "@/components/shared/GlowButton";
import { FlowScreen, Heading } from "@/components/onboarding-flow/primitives";
import { CountUp, EstimateBadge } from "@/components/onboarding-v2/bits";
import { brl0 } from "@/components/onboarding-v2/money";
import { CORAL, VERDE_AGUA } from "@/components/onboarding-v2/tokens";
import { DEPOIMENTOS, PESSOAS_USANDO, type Depoimento } from "@/lib/depoimentos";
import type { DerivedPlan, OnboardingAnswers } from "@/lib/onboardingState";

/**
 * As duas telas de prova: a do próprio mês da pessoa, e a das outras pessoas.
 *
 * A primeira compara o mês de hoje com o mês do plano, e todo número vem do que ela
 * mesma respondeu — não há nada a inventar. A segunda mostra depoimentos reais, e não
 * aparece enquanto não houver nenhum.
 */

interface Nav {
  onBack: () => void;
  onNext: () => void;
}

/* ── Antes e depois ─────────────────────────────────────────────────────────── */

export function AntesDepoisScreen({ answers, plan, onBack, onNext }: Nav & {
  answers: OnboardingAnswers;
  plan: DerivedPlan;
}) {
  const guardando = plan.metaMensal ?? plan.plano.futuro;
  const temMeta = answers.objetivo !== "organizar" && (plan.metaMensal ?? 0) > 0;
  const divida = answers.objetivo === "dividas";

  return (
    <FlowScreen
      section="Seu plano"
      onBack={onBack}
      footer={<GlowButton onClick={onNext}>Continuar</GlowButton>}
    >
      <div className="pt-6">
        <Heading light="Seu mês," bold="antes e depois." />
      </div>

      <div className="mt-7 space-y-3">
        <Coluna
          titulo="Hoje"
          tom="rgba(255,255,255,0.28)"
          linhas={[
            {
              rotulo: "O que sobra no mês",
              valor: plan.sobra,
              cor: plan.sobra !== null && plan.sobra < 0 ? CORAL : undefined,
              vazio: "Você ainda não contou",
            },
            { rotulo: "Guardado por mês", valor: 0 },
            {
              rotulo: divida ? "Previsão de quitar" : "Previsão de chegar lá",
              texto: temMeta ? "sem data" : "—",
            },
          ]}
        />

        <Coluna
          titulo="Com o plano"
          tom={VERDE_AGUA}
          destaque
          linhas={[
            /* A fatia do Futuro só entra quando a meta cabe nela. Mostrar "futuro:
               R$ 340" logo acima de "guardado: R$ 500" é pôr duas verdades lado a lado
               de um jeito que parece erro — e a tela do plano já explica o estouro. */
            ...(plan.metaPesaDemais
              ? []
              : [{ rotulo: "Reservado para o futuro", valor: plan.plano.futuro, cor: VERDE_AGUA }]),
            { rotulo: "Guardado por mês", valor: guardando, cor: VERDE_AGUA, anima: true },
            {
              rotulo: divida ? "Previsão de quitar" : "Previsão de chegar lá",
              texto: temMeta && answers.prazoMeses ? `em ${answers.prazoMeses} meses` : "quando você definir",
            },
          ]}
        />
      </div>

      <p className="mt-5 text-[13.5px] leading-snug text-white/66">
        A diferença não é o Willo guardando por você — é você vendo onde o dinheiro está antes de ele sumir.
      </p>

      <div className="mt-4 flex justify-center pb-2">
        <EstimateBadge />
      </div>
    </FlowScreen>
  );
}

interface Linha {
  rotulo: string;
  valor?: number | null;
  texto?: string;
  cor?: string;
  vazio?: string;
  anima?: boolean;
}

function Coluna({ titulo, tom, linhas, destaque = false }: {
  titulo: string;
  tom: string;
  linhas: Linha[];
  destaque?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-[22px] border p-4"
      style={{
        borderColor: destaque ? `${tom}38` : "rgba(255,255,255,0.07)",
        background: destaque ? `${tom}0F` : "rgba(255,255,255,0.03)",
      }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: destaque ? tom : "rgba(255,255,255,0.55)" }}>
        {titulo}
      </p>
      <div className="mt-2.5 space-y-2">
        {linhas.map((l) => (
          <div key={l.rotulo} className="flex items-baseline justify-between gap-3">
            <span className="text-[14px] text-white/72">{l.rotulo}</span>
            <span className="text-[16px] font-bold tabular-nums" style={{ color: l.cor ?? "#fff" }}>
              {l.texto
                ? l.texto
                : l.valor === null || l.valor === undefined
                  ? (l.vazio ?? "—")
                  : l.anima
                    ? <CountUp to={l.valor} />
                    : brl0(l.valor)}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ── Depoimentos ────────────────────────────────────────────────────────────── */

export function ComunidadeScreen({ onBack, onNext }: Nav) {
  return (
    <FlowScreen
      section="Comunidade"
      onBack={onBack}
      footer={<GlowButton onClick={onNext}>Montar meu plano</GlowButton>}
    >
      <div className="pt-6">
        {PESSOAS_USANDO !== null ? (
          <Heading
            light={`Mais de ${PESSOAS_USANDO.toLocaleString("pt-BR")} pessoas`}
            bold="estão usando o Willo."
          />
        ) : (
          <Heading light="Quem já está" bold="organizando o mês." />
        )}
      </div>

      <div className="mt-7 space-y-3 pb-4">
        {DEPOIMENTOS.map((d, i) => (
          <Cartao key={`${d.nome}-${i}`} depoimento={d} delay={0.08 * i} />
        ))}
      </div>
    </FlowScreen>
  );
}

function Cartao({ depoimento, delay }: { depoimento: Depoimento; delay: number }) {
  const still = useReducedMotion();
  const iniciais = depoimento.nome
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <motion.figure
      initial={{ opacity: 0, y: still ? 0 : 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: still ? 0 : delay, duration: 0.4 }}
      className="rounded-[22px] border border-white/[0.06] willo-glass p-4"
    >
      <figcaption className="flex items-center gap-3">
        {depoimento.foto ? (
          <img src={depoimento.foto} alt="" className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.06] text-[12px] font-bold text-white/80">
            {iniciais}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-[14.5px] font-semibold text-white">{depoimento.nome}</span>
          {depoimento.estrelas !== undefined && (
            <span className="mt-0.5 flex gap-0.5" aria-label={`${depoimento.estrelas} de 5 estrelas`}>
              {Array.from({ length: 5 }, (_, i) => (
                <Star
                  key={i}
                  className="h-3 w-3"
                  style={{ color: i < depoimento.estrelas! ? VERDE_AGUA : "rgba(255,255,255,0.18)" }}
                  fill="currentColor"
                />
              ))}
            </span>
          )}
        </span>
      </figcaption>
      <blockquote className="mt-3 text-[14px] leading-relaxed text-white/72">“{depoimento.texto}”</blockquote>
    </motion.figure>
  );
}
