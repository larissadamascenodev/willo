import { useState } from "react";
import { motion } from "framer-motion";
import GlowButton from "@/components/shared/GlowButton";
import { FlowScreen, Heading } from "@/components/onboarding-flow/primitives";
import { Chips, EstimateBadge, MoneyInput, MonthPicker } from "@/components/onboarding-v2/bits";
import { GoalChart, ReserveChart, TodayVsPlanBars } from "@/components/onboarding-v2/charts";
import { brl0 } from "@/components/onboarding-v2/money";
import { CORAL } from "@/components/onboarding-v2/tokens";
import { mensalNecessario } from "@/lib/onboardingMath";
import type { DerivedPlan, Objetivo, OnboardingAnswers } from "@/lib/onboardingState";

/**
 * The goal: how much, by when, and what that actually looks like month by month.
 *
 * Only two of the four objectives ask anything here — paying off a debt and saving up.
 * Investing and organising are read off what the person already said, which is why the
 * last screen is the only one all four reach.
 */

interface Nav {
  onBack: () => void;
  onNext: () => void;
}

const NOMES_DE_META = ["Viagem", "Carro", "Casa", "Reserva", "Estudos", "Outro"];

/* ── 12. Quanto ─────────────────────────────────────────────────────────────── */

export function MetaValorScreen({ objetivo, valor, onValor, nome, onNome, onBack, onNext }: Nav & {
  objetivo: Objetivo;
  valor: number | null;
  onValor: (v: number | null) => void;
  nome: string;
  onNome: (v: string) => void;
}) {
  const divida = objetivo === "dividas";
  const ok = (valor ?? 0) > 0;

  return (
    <FlowScreen
      section="Seu objetivo"
      onBack={onBack}
      center
      footer={<GlowButton variant="light" disabled={!ok} onClick={onNext}>Continuar</GlowButton>}
    >
      {divida ? (
        <Heading light="Quanto você deve," bold="mais ou menos?" />
      ) : (
        <Heading light="Quanto você precisa" bold="juntar?" />
      )}

      <MoneyInput value={valor} onChange={onValor} onEnter={() => ok && onNext()} />

      {!divida && (
        <div className="mt-6">
          <p className="text-center text-[13.5px] text-white/62">Para quê?</p>
          <Chips options={NOMES_DE_META} value={NOMES_DE_META.includes(nome) ? nome : ""} onChange={onNome} />
          <input
            value={nome}
            aria-label="Nome da meta"
            onChange={(e) => onNome(e.target.value.slice(0, 40))}
            placeholder="Ou escreva do seu jeito..."
            className="mt-4 h-[52px] w-full rounded-full border border-white/[0.06] willo-glass px-5 text-center text-[15px] text-white placeholder:t-softer focus:border-white/20 focus:outline-none"
          />
        </div>
      )}
    </FlowScreen>
  );
}

/* ── 13. Em quanto tempo ────────────────────────────────────────────────────── */

export function MetaPrazoScreen({ objetivo, prazo, onPrazo, onBack, onNext }: Nav & {
  objetivo: Objetivo;
  prazo: number | null;
  onPrazo: (v: number) => void;
}) {
  const divida = objetivo === "dividas";
  return (
    <FlowScreen
      section="Seu objetivo"
      onBack={onBack}
      center
      footer={<GlowButton variant="light" disabled={!prazo} onClick={onNext}>Continuar</GlowButton>}
    >
      <Heading light="Em quanto tempo você quer" bold={divida ? "quitar?" : "chegar lá?"} />
      <MonthPicker value={prazo} onChange={onPrazo} />
    </FlowScreen>
  );
}

/* ── 14. O que isso quer dizer ──────────────────────────────────────────────── */

export function MetaGraficoScreen({ answers, plan, onBack, onNext }: Nav & {
  answers: OnboardingAnswers;
  plan: DerivedPlan;
}) {
  const { objetivo } = answers;
  return (
    <FlowScreen
      section="Seu objetivo"
      onBack={onBack}
      footer={<GlowButton variant="light" onClick={onNext}>Continuar</GlowButton>}
    >
      <div className="pt-6 pb-4">
        {objetivo === "investir" ? (
          <Investir plan={plan} />
        ) : objetivo === "organizar" ? (
          <Organizar plan={plan} />
        ) : (
          <DividaOuMeta answers={answers} plan={plan} />
        )}
      </div>
    </FlowScreen>
  );
}

/** Paying off, or saving up: the same line pointed in opposite directions. */
function DividaOuMeta({ answers, plan }: { answers: OnboardingAnswers; plan: DerivedPlan }) {
  const subindo = answers.objetivo === "juntar";
  const prazoPedido = answers.prazoMeses ?? 12;
  const valor = answers.metaValorCentavos ?? 0;
  const realista = plan.prazoRealista;

  /* With a realistic month count on the table, the person chooses which one to look at
     — the plan they asked for, or the one today's surplus actually pays for. */
  const [vendo, setVendo] = useState<"pedido" | "realista">(realista ? "realista" : "pedido");
  const prazo = vendo === "realista" && realista ? realista : prazoPedido;
  const mensal = mensalNecessario(valor, prazo);

  /* Nothing is left over: there is no month count to offer, only somewhere to start. */
  if (plan.sobra !== null && plan.sobra <= 0) {
    const precisa = mensalNecessario(valor, prazoPedido);
    return (
      <>
        <h1 className="text-[26px] font-extrabold leading-[1.15] tracking-tight text-white">Hoje não sobra.</h1>
        <p className="mt-3 text-[15.5px] leading-snug text-white/72">
          Primeiro vamos achar <b className="font-bold text-white">{brl0(precisa)}</b> nos seus gastos. É disso que o
          plano cuida nas próximas semanas.
        </p>
        <div className="mt-6">
          <GoalChart meses={prazoPedido} subindo={subindo} />
        </div>
        <div className="mt-4 flex justify-center">
          <EstimateBadge />
        </div>
      </>
    );
  }

  return (
    <>
      <h1 className="text-[26px] leading-[1.15] tracking-tight text-white">
        <span className="font-extrabold">{brl0(mensal)}/mês</span>
        <span className="font-light">
          {subindo ? ` e você chega lá em ${prazo} meses` : ` e sua dívida zera em ${prazo} meses`}
        </span>
      </h1>

      <div className="mt-5">
        <GoalChart key={`${prazo}-${subindo}`} meses={prazo} subindo={subindo} />
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <EstimateBadge />
        <span className="text-[12.5px] t-soft">{subindo ? "sem contar rendimento" : "sem contar juros"}</span>
      </div>

      {realista && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 rounded-[20px] border border-white/[0.07] willo-glass p-4"
        >
          <p className="text-[14.5px] leading-snug text-white/78">
            Com o que sobra hoje, o caminho é de <b className="font-bold text-white">{realista} meses</b>.{" "}
            {vendo === "realista" ? `Quer ver o de ${prazoPedido}?` : "Quer ver esse?"}
          </p>
          <button
            type="button"
            onClick={() => setVendo((v) => (v === "realista" ? "pedido" : "realista"))}
            className="mt-3 min-h-[44px] w-full rounded-full border border-white/[0.14] px-4 text-[14px] font-semibold text-white"
          >
            {vendo === "realista" ? `Ver o plano de ${prazoPedido} meses` : `Ver o caminho de ${realista} meses`}
          </button>
        </motion.div>
      )}
    </>
  );
}

/** The cushion before the investments, which is the honest first step. */
function Investir({ plan }: { plan: DerivedPlan }) {
  const reserva = plan.reserva;

  if (!reserva) {
    return (
      <>
        <h1 className="text-[26px] font-extrabold leading-[1.15] tracking-tight text-white">
          Antes de investir, a reserva.
        </h1>
        <p className="mt-3 text-[15.5px] leading-snug text-white/72">
          Ela é o que impede um imprevisto de virar dívida. Assim que o app souber quanto você gasta por mês, ele mostra
          de quanto a sua precisa ser.
        </p>
      </>
    );
  }

  const guardando = plan.metaMensal ?? 0;
  const meses = guardando > 0 ? Math.ceil(reserva.minima / guardando) : null;

  return (
    <>
      <h1 className="text-[26px] leading-[1.15] tracking-tight text-white">
        <span className="block font-light">Sua reserva de emergência</span>
        <span className="block font-extrabold">{brl0(reserva.minima)} a {brl0(reserva.ideal)}</span>
      </h1>
      <p className="mt-3 text-[15px] leading-snug text-white/72">
        De {reserva.mesesMinimo} a {reserva.mesesIdeal} meses dos seus gastos. É ela que segura um imprevisto sem virar
        dívida — e é por ela que se começa, antes de qualquer investimento.
      </p>

      <ReserveChart
        minima={reserva.minima}
        ideal={reserva.ideal}
        mesesMinimo={reserva.mesesMinimo}
        mesesIdeal={reserva.mesesIdeal}
      />

      {meses !== null && (
        <p className="mt-5 text-[15px] leading-snug text-white/78">
          Guardando <b className="font-bold text-white">{brl0(guardando)}/mês</b>, você chega na mínima em{" "}
          <b className="font-bold text-white">{meses} meses</b>.
        </p>
      )}

      <div className="mt-5 flex justify-center">
        <EstimateBadge />
      </div>
    </>
  );
}

/** Where the month goes today, beside where it could go. */
function Organizar({ plan }: { plan: DerivedPlan }) {
  if (plan.gastos === null) {
    return (
      <>
        <h1 className="text-[26px] leading-[1.15] tracking-tight text-white">
          <span className="block font-light">Seu mês, dividido em</span>
          <span className="block font-extrabold">50/30/20</span>
        </h1>
        <p className="mt-3 text-[15px] leading-snug text-white/72">
          Metade para o que você precisa, 30% para o que você quer, 20% para o seu futuro. Em reais, sobre a sua renda:
        </p>
        <div className="mt-6 space-y-2">
          <Linha rotulo="Necessidades" valor={plan.plano.necessidades} />
          <Linha rotulo="Desejos" valor={plan.plano.desejos} />
          <Linha rotulo="Futuro" valor={plan.plano.futuro} />
        </div>
        <div className="mt-5 flex justify-center">
          <EstimateBadge />
        </div>
      </>
    );
  }

  return (
    <>
      <h1 className="text-[26px] leading-[1.15] tracking-tight text-white">
        <span className="block font-light">Como está hoje,</span>
        <span className="block font-extrabold">e como poderia ficar.</span>
      </h1>

      <TodayVsPlanBars
        renda={plan.renda}
        gastos={plan.gastos}
        necessidades={plan.plano.necessidades}
        desejos={plan.plano.desejos}
        futuro={plan.plano.futuro}
      />

      {plan.noVermelho && (
        <p className="mt-5 text-[15px] leading-snug" style={{ color: CORAL }}>
          Hoje os gastos passam da renda. É exatamente aí que o app começa a trabalhar.
        </p>
      )}

      <div className="mt-5 flex justify-center">
        <EstimateBadge />
      </div>
    </>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 rounded-[18px] border border-white/[0.06] willo-glass px-4 py-3">
      <span className="text-[14.5px] text-white/80">{rotulo}</span>
      <span className="text-[16px] font-bold tabular-nums text-white">{brl0(valor)}</span>
    </div>
  );
}
