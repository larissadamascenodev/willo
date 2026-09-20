/**
 * Radar Financeiro — intelligent insight engine.
 * Analyzes transactions and generates actionable financial insights.
 */

import type { DashboardData, Transaction } from "@/types/finance";

import { getCurrency } from "@/lib/currency";
export interface RadarInsight {
  id: string;
  tipo: "alerta" | "atencao" | "oportunidade";
  categoria: string | null;
  titulo: string;
  descricao: string;
  impacto_valor: number;
  intensidade: "baixa" | "media" | "alta";
  acao: {
    tipo: "ver_categoria" | "ver_detalhes" | "ajustar_limite";
    referencia: string;
  };
}

export type RadarStatus = {
  label: string;
  level: "verde" | "amarelo" | "vermelho";
  insightCount: number;
};

// ─── helpers ────────────────────────────────────────────────────────

function paidExpenses(txs: Transaction[]): Transaction[] {
  return txs.filter((t) => t.type === "despesa" && t.status === "pago");
}

function paidIncome(txs: Transaction[]): Transaction[] {
  return txs.filter((t) => t.type === "receita" && t.status === "pago");
}

function sumByCategory(txs: Transaction[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const t of txs) {
    map[t.category] = (map[t.category] ?? 0) + t.amount;
  }
  return map;
}

function countByCategory(txs: Transaction[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const t of txs) {
    map[t.category] = (map[t.category] ?? 0) + 1;
  }
  return map;
}

function fmt(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });
}

// ─── engine ─────────────────────────────────────────────────────────

export function generateRadarInsights(
  currentData: DashboardData,
  previousData: DashboardData | null
): RadarInsight[] {
  const insights: RadarInsight[] = [];

  const currentExpenses = paidExpenses(currentData.transactions);
  const currentIncome = paidIncome(currentData.transactions);
  const totalDespesas = currentExpenses.reduce((s, t) => s + t.amount, 0);
  const totalReceitas = currentIncome.reduce((s, t) => s + t.amount, 0);

  const catCurrent = sumByCategory(currentExpenses);
  const catPrev = previousData ? sumByCategory(paidExpenses(previousData.transactions)) : {};
  const catCount = countByCategory(currentExpenses);

  // ── RULE 1: Category spending increase ────────────────────────────
  for (const [cat, currentAmt] of Object.entries(catCurrent)) {
    const prevAmt = catPrev[cat] ?? 0;
    if (prevAmt > 0 && currentAmt > prevAmt * 1.2) {
      const diff = currentAmt - prevAmt;
      const pct = Math.round(((currentAmt - prevAmt) / prevAmt) * 100);
      const intensidade = pct > 50 ? "alta" : "media";

      insights.push({
        id: `aumento-${cat}`,
        tipo: "atencao",
        categoria: cat,
        titulo: "Gasto aumentou",
        descricao: `${cat} subiu ${fmt(diff)} (+${pct}%) em relação ao mês anterior.`,
        impacto_valor: diff,
        intensidade,
        acao: { tipo: "ver_categoria", referencia: cat },
      });
    }
  }

  // ── RULE 2: High frequency ────────────────────────────────────────
  const categories = Object.keys(catCount);
  if (categories.length > 0) {
    const avgCount = Object.values(catCount).reduce((a, b) => a + b, 0) / categories.length;
    for (const [cat, count] of Object.entries(catCount)) {
      if (count > avgCount * 1.5 && count >= 4) {
        insights.push({
          id: `frequencia-${cat}`,
          tipo: "atencao",
          categoria: cat,
          titulo: "Frequência alta",
          descricao: `Você tem ${count} transações em ${cat} — acima da média de ${Math.round(avgCount)} por categoria.`,
          impacto_valor: catCurrent[cat] ?? 0,
          intensidade: "media",
          acao: { tipo: "ver_categoria", referencia: cat },
        });
      }
    }
  }

  // ── RULE 3: Income commitment ─────────────────────────────────────
  if (totalReceitas > 0 && totalDespesas > totalReceitas * 0.8) {
    const pct = Math.round((totalDespesas / totalReceitas) * 100);
    insights.push({
      id: "comprometimento-renda",
      tipo: "alerta",
      categoria: null,
      titulo: "Alto comprometimento da renda",
      descricao: `Suas despesas representam ${pct}% da sua receita (${fmt(totalDespesas)} de ${fmt(totalReceitas)}).`,
      impacto_valor: totalDespesas - totalReceitas * 0.8,
      intensidade: pct > 100 ? "alta" : "media",
      acao: { tipo: "ver_detalhes", referencia: "despesas" },
    });
  }

  // ── RULE 4: High installments ─────────────────────────────────────
  const installmentTxs = currentData.transactions.filter(
    (t) => t.type === "despesa" && (t as any).recurrence_type === "parcelado"
  );
  // Fallback: estimate from categories or pending
  const totalParcelado = installmentTxs.reduce((s, t) => s + t.amount, 0);
  if (totalReceitas > 0 && totalParcelado > totalReceitas * 0.3) {
    const pct = Math.round((totalParcelado / totalReceitas) * 100);
    insights.push({
      id: "parcelamentos-altos",
      tipo: "alerta",
      categoria: null,
      titulo: "Parcelamentos elevados",
      descricao: `${fmt(totalParcelado)} em parcelamentos (${pct}% da renda). Evite novas parcelas.`,
      impacto_valor: totalParcelado,
      intensidade: pct > 50 ? "alta" : "media",
      acao: { tipo: "ver_detalhes", referencia: "parcelamentos" },
    });
  }

  // ── Sort by priority ──────────────────────────────────────────────
  const priority: Record<string, number> = { alerta: 0, atencao: 1, oportunidade: 2 };
  insights.sort((a, b) => {
    const dp = priority[a.tipo] - priority[b.tipo];
    if (dp !== 0) return dp;
    return b.impacto_valor - a.impacto_valor;
  });

  return insights.slice(0, 3);
}

export function getRadarStatus(insights: RadarInsight[]): RadarStatus {
  const hasAlerta = insights.some((i) => i.tipo === "alerta");
  if (hasAlerta) {
    return { label: "Atenção necessária", level: "vermelho", insightCount: insights.length };
  }
  if (insights.length > 0) {
    return { label: "Pontos de atenção", level: "amarelo", insightCount: insights.length };
  }
  return { label: "Tudo sob controle", level: "verde", insightCount: 0 };
}
