import { useState } from "react";
import { motion } from "framer-motion";
import { Bell, Check, MessageCircle, Sparkles, TrendingUp, Trophy, Zap } from "lucide-react";
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
        className="mt-10 h-[58px] w-full rounded-full border border-white/[0.06] willo-glass px-6 text-center text-[17px] text-white placeholder:t-softer focus:border-white/20 focus:outline-none"
      />
    </FlowScreen>
  );
}

/* ─── 2. Consent ─── */
export function ConsentStep({ name, onBack, onNext }: StepProps & { name: string }) {
  const [legal, setLegal] = useState<"terms" | "privacy" | null>(null);
  const [checked, setChecked] = useState([false, false]);
  const toggle = (i: number) => setChecked((c) => c.map((v, j) => (j === i ? !v : v)));

  return (
    <FlowScreen
      section="Antes de começar"
      onBack={onBack}
      center
      footer={
        <GlowButton onClick={() => { setChecked([true, true]); setTimeout(onNext, 250); }}>
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
            , incluindo o envio dos meus comprovantes ao <b className="font-semibold text-white/80">Google (Gemini)</b> para leitura e dos meus
            lançamentos à <b className="font-semibold text-white/80">Anthropic (Claude)</b> para categorizar e gerar as análises.
          </>,
          <>
            Entendo que o Willo me ajuda a <b className="font-semibold text-white/80">organizar e acompanhar</b> meu dinheiro, com conteúdo
            educativo que não substitui um consultor ou planejador financeiro, e que ele{" "}
            <b className="font-semibold text-white/80">não movimenta dinheiro</b> nem faz transações: os dados vêm só do que eu registro no app.
          </>,
        ].map((text, i) => (
          <div key={i} className="flex w-full items-start gap-3.5 text-left">
            <button
              type="button"
              role="checkbox"
              aria-checked={checked[i]}
              aria-label={`Confirmar item ${i + 1}`}
              onClick={() => toggle(i)}
              className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors", checked[i] ? "border-white bg-white" : "border-white/25")}
            >
              {checked[i] && <Check className="h-3.5 w-3.5 text-[#0B0B0B]" strokeWidth={3.5} />}
            </button>
            <span onClick={() => toggle(i)} className="cursor-pointer text-[14px] leading-relaxed text-white/66">{text}</span>
          </div>
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
        <Heading light={`${name.trim() || "Você"},`} bold="suas finanças mudam." sub="E você vai ver toda a evolução." />
      </div>

      <div className="mt-8">
        <div className="flex justify-between text-[11px] font-semibold uppercase tracking-[0.2em] text-white/66">
          <span>Mês 1</span>
          <span>Mês 6</span>
        </div>
        <div className="relative mt-2">
          <span className="absolute -left-1 top-1/2 origin-left -translate-y-1/2 -rotate-90 text-[10px] font-semibold uppercase tracking-[0.25em] t-softer">
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
          <span className="flex items-center gap-2 text-white/62"><span className="w-5 border-t-2 border-dashed border-white/40" /> Sem controle</span>
        </div>
        <p className="mt-4 text-center text-[12px] t-softer">Comparação ilustrativa</p>
      </div>
    </FlowScreen>
  );
}

/* ─── 4. How it works ─── */
export function HowItWorksStep({ onBack, onNext }: StepProps) {
  /**
   * O caminho desceu para uma trilha vertical.
   *
   * Em zigue-zague, cada parada custava ~125px de altura fixa, e cinco delas não cabiam
   * em tela nenhuma — a pessoa tinha que arrastar para ver o fim, que é justamente o
   * prêmio. Em coluna, cada parada custa 44px e as cinco cabem num iPhone SE.
   */
  /* Uma linha de descrição cada, de propósito: é o que deixa todas as paradas com a
     mesma altura, e é a altura igual que faz os trechos de linha ficarem iguais. */
  const paradas = [
    { Icon: Zap, titulo: "Anote em segundos", texto: "Fale, digite ou fotografe." },
    { Icon: MessageCircle, titulo: "Pergunte antes de gastar", texto: "O assistente diz se cabe no mês." },
    { Icon: Bell, titulo: "Limites que avisam antes", texto: "O Radar avisa quando aperta." },
    { Icon: Sparkles, titulo: "Seu time de agentes", texto: "Faturas, metas e o mês, cada um no seu." },
    { Icon: Trophy, titulo: "Alcance os objetivos", texto: "Metas com prazo e o caminho até elas.", fim: true },
  ];

  /* Um de cada vez: o disco aparece, o trecho de linha desce até o próximo, o próximo
     aparece. Sem molas — tudo em curvas suaves, que foi o pedido. */
  /* Os tempos se sobrepõem de propósito: o trecho de linha começa enquanto o disco
     ainda está assentando, e é essa emenda que faz a sequência correr como uma coisa
     só em vez de bater compasso. */
  const DISCO = 0.34;
  const TRECHO = 0.34;
  const PASSO = 0.42;
  const entraEm = (i: number) => 0.12 + i * PASSO;
  const desceEm = (i: number) => entraEm(i) + 0.16;

  /* Sai depressa e assenta devagar — é o que faz o movimento parecer peso, não pressa. */
  const SUAVE = [0.16, 1, 0.3, 1] as const;

  return (
    <FlowScreen section="Como funciona" onBack={onBack} footer={<GlowButton onClick={onNext}>Começar minha análise</GlowButton>}>
      <div className="pt-6">
        <Heading light="A vida que você quer" bold="já está a caminho." sub="Primeiro, a gente entende o seu momento." />
      </div>

      <ol className="relative mt-5">
        {paradas.map(({ Icon, titulo, texto, fim }, i) => (
          /* Altura fixa por parada: as descrições têm comprimentos diferentes, e deixar
             a altura seguir o texto faria um par ficar mais junto que o outro. */
          <li key={titulo} className="relative flex h-16 items-start gap-4">
            {/* O trecho de linha até a próxima parada, que desce depois deste disco e
                antes do próximo. É ele que faz a sequência andar. */}
            {!fim && (
              <motion.span
                aria-hidden="true"
                className={cn(
                  "absolute left-[21px] top-[44px] w-[2px] rounded-full",
                  i === paradas.length - 2 ? "bg-gradient-to-b from-white/25 to-willo-green/60" : "bg-white/25",
                )}
                style={{ bottom: -2, transformOrigin: "top" }}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ delay: desceEm(i), duration: TRECHO, ease: [0.37, 0, 0.23, 1] }}
              />
            )}

            {/* Entra crescendo de perto de si mesmo, não do nada: partir de 0,82 em vez
                de 0,4 troca o estalo por um assentar. */}
            <motion.span
              className={cn(
                "relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
                fim ? "bg-willo-green shadow-[0_0_28px_rgba(200,243,109,0.45)]" : "bg-white",
              )}
              initial={{ scale: 0.82, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: entraEm(i), duration: DISCO, ease: SUAVE }}
            >
              <Icon className="h-[19px] w-[19px] text-[#0B0B0B]" strokeWidth={2.2} />
            </motion.span>

            {/* Sobe em vez de vir da esquerda: numa lista vertical, movimento vertical
                acompanha a linha descendo em vez de brigar com ela. */}
            <motion.span
              className="min-w-0 flex-1 pt-[3px]"
              initial={{ opacity: 0, y: 7 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: entraEm(i) + 0.06, duration: 0.42, ease: SUAVE }}
            >
              <span className={cn("block text-[15px] leading-tight", fim ? "font-extrabold text-white" : "font-semibold text-white/90")}>
                {titulo}
              </span>
              <span className="mt-[3px] block truncate text-[12.5px] text-white/55">{texto}</span>
            </motion.span>
          </li>
        ))}
      </ol>
    </FlowScreen>
  );
}
