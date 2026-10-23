import { useMemo, useState } from "react";
import GlowButton from "@/components/shared/GlowButton";
import { FlowScreen, Heading, OptionRow } from "@/components/onboarding-flow/primitives";
import { ReceiptDemo, type DemoItem } from "@/components/onboarding-v2/charts";

/**
 * Where the money goes, and what the app does with a photo of it.
 *
 * The categories picked here are not limits and do not become rules — they are what the
 * Radar watches later, and, right now, what decides which fake receipt the demo shows.
 */

interface Nav {
  onBack: () => void;
  onNext: () => void;
}

const CATEGORIAS_DE_SAIDA = [
  "Aluguel",
  "Luz e água",
  "Internet e celular",
  "Fatura do cartão",
  "Parcelas",
  "Streaming",
  "Academia",
  "Mercado",
  "Delivery",
  "Apps de corrida",
  "Compras online",
];

const MAXIMO = 3;

/* ── 15. Para onde sai ──────────────────────────────────────────────────────── */

export function CategoriasScreen({ value, onChange, onBack, onNext, onSkip }: Nav & {
  value: string[];
  onChange: (v: string[]) => void;
  onSkip: () => void;
}) {
  const toggle = (cat: string) => {
    if (value.includes(cat)) {
      onChange(value.filter((c) => c !== cat));
      return;
    }
    /* Three is the cap, and the oldest pick makes room rather than the tap doing nothing. */
    onChange([...value, cat].slice(-MAXIMO));
  };

  return (
    <FlowScreen
      section="Seus gastos"
      onBack={onBack}
      footer={
        <div className="space-y-3">
          <GlowButton disabled={value.length === 0} onClick={onNext}>
            Continuar
          </GlowButton>
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
      <div className="pt-8">
        <Heading light="Para onde seu dinheiro" bold="mais sai?" sub={`Escolha até ${MAXIMO}.`} />
      </div>

      <div className="mt-6 space-y-2.5 pb-4">
        {CATEGORIAS_DE_SAIDA.map((cat, i) => (
          <OptionRow
            key={cat}
            square
            label={cat}
            selected={value.includes(cat)}
            onClick={() => toggle(cat)}
            delay={0.03 * i}
          />
        ))}
      </div>
    </FlowScreen>
  );
}

/* ── 16. O comprovante ──────────────────────────────────────────────────────── */

/**
 * A plausible shop for each category, all invented — no real brand appears anywhere in
 * the demo, because a made-up receipt showing a real shop's name is a different thing
 * from an example.
 */
const EXEMPLO_POR_CATEGORIA: Record<string, { estabelecimento: string; valor: number }> = {
  "Aluguel": { estabelecimento: "Adm. Predial Aurora", valor: 142000 },
  "Luz e água": { estabelecimento: "Companhia Luz & Água", valor: 18740 },
  "Internet e celular": { estabelecimento: "NetFibra Telecom", valor: 12990 },
  "Fatura do cartão": { estabelecimento: "Banco Aurora", valor: 86350 },
  "Parcelas": { estabelecimento: "Loja Nova Casa", valor: 24900 },
  "Streaming": { estabelecimento: "StreamBox Assinaturas", valor: 3990 },
  "Academia": { estabelecimento: "Academia Movimento", valor: 11900 },
  "Mercado": { estabelecimento: "Mercado Bom Dia", valor: 23780 },
  "Delivery": { estabelecimento: "Cantina do Bairro", valor: 6850 },
  "Apps de corrida": { estabelecimento: "Viaja Já Mobilidade", valor: 2740 },
  "Compras online": { estabelecimento: "Ponto Online", valor: 15990 },
};

const PADRAO = "Mercado";

export function ComprovanteScreen({ categorias, onBack, onNext }: Nav & { categorias: string[] }) {
  const [leu, setLeu] = useState(false);

  const item = useMemo<DemoItem>(() => {
    /* The first thing they said their money goes on, so the example is about them. */
    const categoria = categorias[0] && EXEMPLO_POR_CATEGORIA[categorias[0]] ? categorias[0] : PADRAO;
    const { estabelecimento, valor } = EXEMPLO_POR_CATEGORIA[categoria];
    return {
      estabelecimento,
      valor,
      data: new Date().toLocaleDateString("pt-BR"),
      categoria,
    };
  }, [categorias]);

  return (
    <FlowScreen
      section="Seus gastos"
      onBack={onBack}
      footer={<GlowButton onClick={onNext}>Continuar</GlowButton>}
    >
      <div className="pt-6">
        <Heading light="É assim que o Willo" bold="lê um comprovante." />
      </div>

      <ReceiptDemo item={item} onRead={() => setLeu(true)} />

      {leu && (
        <p className="mt-5 pb-4 text-center text-[13.5px] leading-snug text-white/62">
          Foi isso. Nenhum campo digitado.
        </p>
      )}
    </FlowScreen>
  );
}
