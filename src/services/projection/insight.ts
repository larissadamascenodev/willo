/**
 * Humanized AI insight generator based on projections.
 */

import type { DashboardData } from "@/types/finance";
import type { MonthProjection } from "./types";

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

/**
 * Generate humanized AI insight based on projections.
 * Uses varied, conversational tone with light irony.
 */
export function getInsight(
  data: DashboardData,
  projections: MonthProjection[]
): { text: string; tip: string; tone: "positive" | "neutral" | "negative" } {
  const endBalance = projections[projections.length - 1]?.balance ?? 0;
  const positiveMonths = projections.filter((p) => p.delta > 0).length;
  const negativeMonths = projections.filter((p) => p.delta < 0).length;
  const avgDelta = projections.reduce((s, p) => s + p.delta, 0) / projections.length;
  const isConsistent = positiveMonths >= 4;
  const isUnstable = positiveMonths >= 2 && negativeMonths >= 2;
  const isGrowing = endBalance > data.saldoAtual * 1.1;
  const isStable = Math.abs(endBalance - data.saldoAtual) < data.saldoAtual * 0.1;
  const firstNegIdx = projections.findIndex((p, i) => i > 0 && p.balance < 0);
  const hasFutureDip = projections.some((p, i) => i > 0 && p.balance < projections[i - 1].balance * 0.7);

  const seed = new Date().getDate();

  // ── TENDÊNCIA DE CRESCIMENTO ──
  if (isConsistent && isGrowing) {
    const texts = [
      "Se continuar assim, você vai entrar numa fase bem tranquila 👀",
      "O ritmo tá ótimo — seu saldo tá subindo com consistência 📈",
      "Pode comemorar (com moderação): a tendência é de crescimento 🎉",
      "Tá mandando bem, viu? Seu dinheiro tá se multiplicando quietinho 💪",
    ];
    const tips = [
      "Se esse ritmo continuar, dá até pra começar uma reserva já.",
      "Aproveita o momento bom pra separar algo pra investir.",
      "Que tal direcionar parte desse crescimento pra uma meta específica?",
    ];
    return { text: pick(texts, seed), tip: pick(tips, seed + 1), tone: "positive" };
  }

  // ── ESTABILIDADE ──
  if (isStable && positiveMonths >= 3) {
    const texts = [
      "Tá estável, e isso já é uma vitória — muita gente queria estar assim 😌",
      "Sem grandes surpresas por aqui. Tá no controle 🎯",
      "Seu saldo tá firme. Não tá crescendo rápido, mas também não tá caindo.",
      "Tudo equilibrado. Um empurrãozinho a mais e vira crescimento 💡",
    ];
    const tips = [
      "Economizar um pouco a mais todo mês tem um efeito forte no longo prazo.",
      "Estabilidade é base. Agora pensa no que te leva pro próximo nível.",
      "Tente reduzir um gasto variável pra transformar estabilidade em crescimento.",
    ];
    return { text: pick(texts, seed), tip: pick(tips, seed + 1), tone: "neutral" };
  }

  // ── INSTABILIDADE / OSCILAÇÃO ──
  if (isUnstable) {
    const texts = [
      "Tá indo bem… mas tem um ponto ali na frente que merece atenção 👀",
      "Tem meses bons e meses ruins — tá oscilando demais pra ficar tranquilo",
      "A montanha-russa financeira tá ativa. Bora estabilizar isso? 🎢",
      "Alguns meses salvam, outros complicam. Consistência é o jogo aqui.",
    ];
    const tips = [
      "Tente manter suas despesas mais previsíveis nos próximos meses.",
      "Identifique os meses ruins e veja se tem gasto que dá pra antecipar ou cortar.",
      "Use a simulação pra testar: o que acontece se você economizar um pouco mais?",
    ];
    return { text: pick(texts, seed), tip: pick(tips, seed + 1), tone: "neutral" };
  }

  // ── RISCO COM PONTO ESPECÍFICO ──
  if (hasFutureDip && avgDelta < 0) {
    const dipMonth = projections.findIndex((p, i) => i > 0 && p.balance < projections[i - 1].balance * 0.7);
    const monthName = dipMonth >= 0 ? ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][projections[dipMonth].month] : "";
    const texts = [
      `Olha, lá por ${monthName} a coisa pode apertar um pouco 😬`,
      `Tem uma queda chegando por volta de ${monthName}. Melhor se preparar.`,
      `Se continuar nesse ritmo, ${monthName} vai ser apertado 💸`,
    ];
    const tips = [
      "Use a simulação abaixo pra ver como pequenas mudanças fazem diferença.",
      "Revise seus gastos recorrentes — tem algo que dá pra pausar ou reduzir?",
      "Antecipar uma economia agora pode amortecer o impacto lá na frente.",
    ];
    return { text: pick(texts, seed), tip: pick(tips, seed + 1), tone: "negative" };
  }

  // ── RISCO GERAL ──
  if (avgDelta < 0) {
    const texts = [
      "Se continuar assim, você pode apertar nos próximos meses 💸",
      "A tendência não tá boa — os gastos tão vencendo as receitas",
      "Alerta ligado: a projeção mostra que o saldo vai encolher 📉",
      "Bora reagir? O caminho atual leva pra um aperto financeiro.",
    ];
    const tips = [
      "Revise suas despesas recorrentes e veja onde pode cortar.",
      "Mesmo 100 a menos por mês faz diferença em 6 meses.",
      "Use a simulação pra encontrar o ponto de equilíbrio.",
    ];
    return { text: pick(texts, seed), tip: pick(tips, seed + 1), tone: "negative" };
  }

  // ── SALDO NEGATIVO IMINENTE ──
  if (firstNegIdx >= 0) {
    const monthName = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][projections[firstNegIdx].month];
    return {
      text: `Atenção: a projeção indica saldo negativo em ${monthName} 😬`,
      tip: "Hora de agir. Revise gastos e considere formas de aumentar a renda.",
      tone: "negative",
    };
  }

  // ── POSITIVO GENÉRICO ──
  if (endBalance > 0) {
    const texts = [
      "Seu saldo se mantém positivo. Pequenos ajustes podem trazer uma folga legal 💡",
      "Tá tudo certo por aqui. Nada urgente, mas sempre dá pra melhorar.",
      "Cenário tranquilo. Que tal aproveitar pra planejar algo a mais?",
    ];
    const tips = [
      "Economizar um pouco a mais todo mês tem um efeito forte no longo prazo.",
      "Já pensou em criar uma reserva de emergência? Agora seria um bom momento.",
    ];
    return { text: pick(texts, seed), tip: pick(tips, seed + 1), tone: "neutral" };
  }

  return {
    text: "Atenção: a projeção indica saldo negativo em breve 😬",
    tip: "Revise suas despesas recorrentes e veja onde pode cortar.",
    tone: "negative",
  };
}
