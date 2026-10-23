import { useState } from "react";
import { motion } from "framer-motion";
import { BrainCircuit, Camera, Check, TrendingUp } from "lucide-react";
import GlowButton from "@/components/shared/GlowButton";
import LegalModal from "@/components/shared/LegalModal";
import { FlowScreen, Heading } from "@/components/onboarding-flow/primitives";
import { EvolutionChart } from "@/components/onboarding-v2/charts";
import { cn } from "@/lib/utils";

/**
 * The first four screens the person answers: their name, what they are agreeing to,
 * what the month could look like, and how the app works.
 *
 * The welcome screen before these is the Welcome page itself, which is why the flow
 * starts at the name and its back arrow leaves for /welcome.
 */

interface Nav {
  onBack: () => void;
  onNext: () => void;
}

const SECTION = "Sobre você";

/* ── 2. O nome ──────────────────────────────────────────────────────────────── */

export function NomeScreen({ value, onChange, onBack, onNext }: Nav & {
  value: string;
  onChange: (v: string) => void;
}) {
  const ok = value.trim().length >= 2;
  return (
    <FlowScreen
      section={SECTION}
      onBack={onBack}
      center
      footer={
        <GlowButton variant="light" disabled={!ok} onClick={onNext}>
          Continuar
        </GlowButton>
      }
    >
      <Heading light="Como podemos" bold="te chamar?" />
      <input
        autoFocus
        value={value}
        aria-label="Seu nome ou apelido"
        onChange={(e) => onChange(e.target.value.slice(0, 30))}
        onKeyDown={(e) => {
          if (e.key === "Enter" && ok) onNext();
        }}
        placeholder="Seu nome ou apelido..."
        className="mt-10 h-[58px] w-full rounded-full border border-white/[0.06] willo-glass px-6 text-center text-[17px] text-white placeholder:t-softer focus:border-white/20 focus:outline-none"
      />
    </FlowScreen>
  );
}

/* ── 3. O que está sendo aceito ─────────────────────────────────────────────── */

/**
 * Both boxes are required, and the button ticks them — which is what its label says it
 * does. The point of showing them separately is that the second one is not boilerplate:
 * it names the two companies that will read what the person photographs.
 */
export function TermosScreen({ onAccept, onBack }: {
  onBack: () => void;
  onAccept: () => void;
}) {
  const [legal, setLegal] = useState<"terms" | "privacy" | null>(null);
  const [marcados, setMarcados] = useState([false, false]);
  const toggle = (i: number) => setMarcados((m) => m.map((v, j) => (j === i ? !v : v)));

  const aceitarTudo = () => {
    setMarcados([true, true]);
    window.setTimeout(onAccept, 250);
  };

  const caixas = [
    <>
      Li e aceito os{" "}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setLegal("terms");
        }}
        className="text-white/85 underline underline-offset-2"
      >
        Termos de Uso
      </button>{" "}
      e a{" "}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setLegal("privacy");
        }}
        className="text-white/85 underline underline-offset-2"
      >
        Política de Privacidade
      </button>
      .
    </>,
    <>
      Concordo que minhas respostas e comprovantes sejam processados por inteligência artificial do{" "}
      <b className="font-semibold text-white/85">Google (Gemini)</b> e da{" "}
      <b className="font-semibold text-white/85">Anthropic (Claude)</b> para categorizar gastos e gerar comentários.
    </>,
  ];

  return (
    <FlowScreen
      section={SECTION}
      onBack={onBack}
      center
      footer={<GlowButton variant="light" onClick={aceitarTudo}>Aceitar tudo e começar</GlowButton>}
    >
      <Heading light="Antes de começar," bold="só confirme:" />

      <div className="mt-8 space-y-5">
        {caixas.map((texto, i) => (
          <button
            key={i}
            type="button"
            onClick={() => toggle(i)}
            aria-pressed={marcados[i]}
            className="flex w-full items-start gap-3.5 py-1 text-left"
          >
            <span
              className={cn(
                "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] border-2 transition-colors",
                marcados[i] ? "border-white bg-white" : "border-white/25",
              )}
            >
              {marcados[i] && <Check className="h-3.5 w-3.5 text-[#0B0B0B]" strokeWidth={3.5} />}
            </span>
            <span className="text-[14px] leading-relaxed text-white/66">{texto}</span>
          </button>
        ))}
      </div>

      <p className="mt-7 text-[12.5px] leading-relaxed t-softer">
        O Willo é educativo e não substitui consultoria financeira profissional.
      </p>

      <LegalModal open={!!legal} onClose={() => setLegal(null)} type={legal ?? "terms"} />
    </FlowScreen>
  );
}

/* ── 4. O mês que vem aí ────────────────────────────────────────────────────── */

export function MudancaScreen({ nome, onBack, onNext }: Nav & { nome: string }) {
  return (
    <FlowScreen
      section={SECTION}
      onBack={onBack}
      footer={<GlowButton variant="light" onClick={onNext}>Quero ver</GlowButton>}
    >
      <div className="pt-8">
        <Heading light={`${nome.trim() || "Você"},`} bold="seu mês vai mudar." />
      </div>
      <div className="mt-8">
        <EvolutionChart />
      </div>
    </FlowScreen>
  );
}

/* ── 5. Como funciona ───────────────────────────────────────────────────────── */

const PASSOS = [
  {
    icon: Camera,
    titulo: "Foto do comprovante",
    texto: "O Willo lê o valor, a data e a categoria sozinho.",
  },
  {
    icon: BrainCircuit,
    titulo: "Raio-X do seu dinheiro",
    texto: "Onde ele entra, por onde sai e o que isso quer dizer.",
  },
  {
    icon: TrendingUp,
    titulo: "Plano que se ajusta com você",
    texto: "O mês muda, e o plano muda junto.",
  },
];

export function ComoFuncionaScreen({ onBack, onNext }: Nav) {
  return (
    <FlowScreen
      section={SECTION}
      onBack={onBack}
      footer={<GlowButton variant="light" onClick={onNext}>Montar meu plano</GlowButton>}
    >
      <div className="pt-8">
        <Heading light="É simples assim:" bold="três passos." />
      </div>

      <div className="mt-9 space-y-4">
        {PASSOS.map(({ icon: Icon, titulo, texto }, i) => (
          <motion.div
            key={titulo}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.1, duration: 0.42 }}
            className="flex items-start gap-4 rounded-[22px] border border-white/[0.06] willo-glass p-4"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.05]">
              <Icon className="h-5 w-5 text-white/85" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15.5px] font-semibold text-white">{titulo}</span>
              <span className="mt-0.5 block text-[13.5px] leading-snug text-white/62">{texto}</span>
            </span>
            <span className="mt-1 text-[12px] font-semibold tabular-nums t-softer">{i + 1}</span>
          </motion.div>
        ))}
      </div>
    </FlowScreen>
  );
}
