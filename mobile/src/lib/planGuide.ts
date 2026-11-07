import type { MethodId } from "@/lib/plan/financialPlan";

/**
 * Each plan explained the way a person would explain it to a friend: a name of its own
 * colour, one line to say what it is, three steps for how it works, how much effort it
 * asks, what it is best at, and who it is for. The figures always come from the plan
 * itself; this is only how it is told.
 */

export type GuideIcon = "pie" | "piggy" | "target" | "wallet" | "layers" | "waves";

export interface PlanGuide {
  /** Its colour: light, middle, deep. */
  hue: [string, string, string];
  icon: GuideIcon;
  /** A name short enough for a table. */
  short: string;
  /** One line: what it is. */
  tagline: string;
  /** How it works, in three steps. */
  steps: [string, string, string];
  effort: "Baixo" | "Médio" | "Alto";
  /** What it is best at. */
  focus: string;
  /** Who it is for, in a few words. */
  idealFor: string;
}

export const PLAN_GUIDE: Record<MethodId, PlanGuide> = {
  "50-30-20": {
    hue: ["#BFE3FF", "#4FA8F0", "#123B66"],
    icon: "pie",
    short: "50/30/20",
    tagline: "Divide sua renda em três partes: essencial, escolhas e futuro.",
    steps: [
      "Metade da sua renda fixa vai para o essencial: casa, mercado, contas, transporte.",
      "Até 30% fica para as suas escolhas: lazer, delivery, compras, assinaturas.",
      "Pelo menos 20% vai para guardar ou quitar dívidas, todo mês.",
    ],
    effort: "Baixo",
    focus: "Equilíbrio",
    idealFor: "Renda estável e quem quer uma regra simples",
  },
  "pague-se-primeiro": {
    hue: ["#C8F5C8", "#4FB84F", "#14532D"],
    icon: "piggy",
    short: "Pague-se primeiro",
    tagline: "Assim que o dinheiro cai, uma parte vai direto para a sua reserva.",
    steps: [
      "No dia em que a renda fixa entra, separe 15% para a reserva antes de qualquer gasto.",
      "O que sobra é o seu dinheiro do mês, para usar sem culpa.",
      "Não mexa na reserva: ela é para emergências e para os seus planos.",
    ],
    effort: "Baixo",
    focus: "Criar reserva",
    idealFor: "Quem ainda não tem reserva de emergência",
  },
  "base-zero": {
    hue: ["#E2D6FF", "#8B5CF6", "#3B1F80"],
    icon: "target",
    short: "Base zero",
    tagline: "Cada real da sua renda ganha um destino antes do mês começar.",
    steps: [
      "Liste o essencial, as parcelas e quanto quer guardar.",
      "Distribua a renda fixa entre eles até sobrar zero sem destino.",
      "Acompanhe durante o mês e ajuste quando algo mudar.",
    ],
    effort: "Alto",
    focus: "Controle total",
    idealFor: "Quem quer saber para onde vai cada real",
  },
  envelopes: {
    hue: ["#FFE3B8", "#F2A03A", "#7A4410"],
    icon: "wallet",
    short: "Envelopes",
    tagline: "Cada gasto variável ganha um limite fixo, como dinheiro num envelope.",
    steps: [
      "Escolha as categorias onde o dinheiro mais escapa: delivery, compras, lazer.",
      "Dê a cada uma um limite para o mês.",
      "Acabou o limite, acabou o gasto ali até o mês virar.",
    ],
    effort: "Médio",
    focus: "Conter excessos",
    idealFor: "Quem perde o controle em categorias específicas",
  },
  reorganizacao: {
    hue: ["#FFD0DC", "#F05A7E", "#7A1531"],
    icon: "layers",
    short: "Reorganização",
    tagline: "Primeiro o essencial, depois tudo o que sobra vai para quitar dívidas.",
    steps: [
      "Garanta o essencial do mês.",
      "Direcione o que sobra para parcelas e dívidas, das mais caras para as mais baratas.",
      "Reduza as escolhas por um tempo, até a renda ficar livre.",
    ],
    effort: "Médio",
    focus: "Sair das dívidas",
    idealFor: "Quem tem muita renda presa em parcelas e dívidas",
  },
  "renda-variavel": {
    hue: ["#C9F2F2", "#2BB5B5", "#0D4D52"],
    icon: "waves",
    short: "Renda variável",
    tagline: "O plano é feito só sobre o que entra com certeza. O resto vira reserva.",
    steps: [
      "Planeje o mês só com a sua renda fixa, a que entra todo mês.",
      "Quando entrar dinheiro extra, mande primeiro para a reserva.",
      "Meses fracos ficam cobertos pelos meses bons.",
    ],
    effort: "Médio",
    focus: "Segurança",
    idealFor: "Quem tem renda que muda de um mês para o outro",
  },
};

/** The four places money goes, said plainly. */
export const BUCKET_GUIDE = {
  necessidades: { label: "Essencial", hint: "Casa, mercado, contas, saúde, transporte" },
  desejos: { label: "Escolhas", hint: "Lazer, delivery, compras, assinaturas" },
  dividas: { label: "Dívidas e parcelas", hint: "Empréstimos, financiamentos, juros" },
  guardar: { label: "Guardado", hint: "Reserva, caixinhas, investimentos" },
} as const;
