import type { AgentId, WilloStyle } from "~/lib/willoPrefs";

/**
 * Willo's specialists. The person talks only to Willo; these are the parts of him
 * that know one thing well, each with its own colour until their portraits arrive.
 */

export interface Agent {
  id: AgentId;
  name: string;
  role: string;
  about: string;
  hex: string;
  /** Can be switched off in the settings. Argos cannot: he checks the numbers. */
  optional: boolean;
}

export const AGENTS: Agent[] = [
  { id: "cronos", name: "Cronos", role: "Fluxo de caixa e cartões", about: "Acompanha saldos, faturas, vencimentos e parcelas, e avisa antes de faltar dinheiro.", hex: "#7CC4FF", optional: true },
  { id: "atena", name: "Atena", role: "Decisões e simulações", about: "Simula compras, à vista ou parcelado, e mostra o impacto em cada mês antes de você decidir.", hex: "#B9B0FF", optional: true },
  { id: "alura", name: "Alura", role: "Perfil e planejamento", about: "Entende sua realidade e monta o seu plano financeiro, com metas e limites que cabem.", hex: "#5EEAD4", optional: true },
  { id: "lora", name: "Lora", role: "Hábitos de consumo", about: "Compara meses, encontra gastos fora do padrão, assinaturas e oportunidades de economia.", hex: "#F9A8D4", optional: true },
  { id: "julius", name: "Július", role: "Limites e alertas", about: "Firme e econômico: acompanha seus limites e avisa quando um gasto ameaça o plano.", hex: "#F9CE4E", optional: true },
  { id: "argos", name: "Argos", role: "Conferência dos dados", about: "Trabalha nos bastidores conferindo cálculos, duplicidades e se os dados estão completos.", hex: "#C8D0DC", optional: false },
];

export const STYLES: { id: WilloStyle; label: string; sample: string }[] = [
  { id: "amigavel", label: "Amigável", sample: "Ei, tá tudo sob controle! Só fica de olho na fatura que vence dia 13, combinado?" },
  { id: "direto", label: "Neutro e direto", sample: "Fatura Nubank: R$ 1.640,37, vence dia 13. Saldo atual cobre 0%." },
  { id: "descontraido", label: "Descontraído", sample: "Bora lá: a fatura chega dia 13 com R$ 1.640. Dá pra respirar, mas sem delivery todo dia, hein 😄" },
  { id: "firme", label: "Firme e disciplinado", sample: "A fatura de R$ 1.640 vence dia 13 e o saldo não cobre. Corte gastos variáveis agora." },
];
