import type { CategoryExpense } from "@/types/finance";
import type { ActiveInstallmentItem } from "@/lib/installmentProgress";
import { installmentProjection, installmentTotals } from "@/services/activeInstallments";
import { fetchGoals } from "@/services/goalService";
import { buildProfile, planMethods } from "@/lib/plan/financialPlan";
import { loadPlanInputs } from "@/services/financialPlan";
import type { AnswerCard, Simulation } from "~/components/willo/AnswerCards";

/**
 * Which picture goes with which question, and what Willo says he is doing meanwhile.
 *
 * Read from the question's words and drawn only from the app's own figures. A question
 * that matches nothing gets no card: a chart beside an answer it does not illustrate is
 * noise.
 */

const PAYMENT = /^(faturas?|pagamento de fatura|cart[aã]o de cr[eé]dito)$/i;
const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** What he says while working, so the wait reads as work. */
export function workingOn(question: string): string {
  const q = plain(question);
  if (/comprar|compra|parcelar|financiar/.test(q)) return "Simulando a compra mês a mês…";
  if (/fatura|cartao|limite/.test(q)) return "Olhando suas faturas…";
  if (/parcel/.test(q)) return "Somando suas parcelas…";
  if (/gast|categoria|onde|padrao|atipic/.test(q)) return "Separando seus gastos por categoria…";
  if (/assinatura/.test(q)) return "Procurando o que se repete todo mês…";
  if (/plano|organizar|salario|renda|orcamento/.test(q)) return "Montando o plano com seus números…";
  if (/meta|caixinha|guardar|economizar|reserva/.test(q)) return "Procurando o que pesa nos seus planos…";
  return "Pensando…";
}

/** The steps shown while the assistant works on something bigger. */
export const STEPS = ["Lendo seus números", "Analisando", "Montando a resposta"];

interface Snapshot {
  contas?: { saldo_previsto_fim_mes: number | null };
  mes?: { receitas: number; despesas: number };
  previsao?: { proximos_meses: { mes: string; sobra: number }[] };
  cartoes?: { nome: string; fatura_aberta: number; vence_em: string; limite: number; usado: number }[];
}

export async function cardsFor(
  question: string,
  ctx: { snapshot: Snapshot; categories: CategoryExpense[]; installments: ActiveInstallmentItem[] | null; simulation?: Simulation | null },
): Promise<AnswerCard[]> {
  const q = plain(question);
  const now = new Date();
  const month = MONTHS[now.getMonth()];
  const cards: AnswerCard[] = [];

  if (ctx.simulation) {
    cards.push({ type: "simulacao", data: ctx.simulation });
    return cards;
  }

  if (/quanto (eu )?posso gastar|sobra|fim do mes|saldo|entrou|saiu|receita|despesa/.test(q) && ctx.snapshot.mes) {
    const left = ctx.snapshot.contas?.saldo_previsto_fim_mes ?? null;
    const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1;
    cards.push({
      type: "fluxo",
      month: month[0].toUpperCase() + month.slice(1),
      receitas: ctx.snapshot.mes.receitas,
      despesas: ctx.snapshot.mes.despesas,
      sobra: left,
      perDay: left != null && left > 0 ? left / daysLeft : null,
    });
  } else if (/fatura|limite|cartao/.test(q) && (ctx.snapshot.cartoes ?? []).length > 0) {
    cards.push({
      type: "faturas",
      items: (ctx.snapshot.cartoes ?? []).map((c) => ({ nome: c.nome, falta: c.fatura_aberta, vence: c.vence_em, limite: c.limite, usado: c.usado })),
    });
  } else if (/parcel/.test(q) && ctx.installments && installmentTotals(ctx.installments)) {
    const months = installmentProjection(ctx.installments, 6).filter((m) => m.value > 0).slice(0, 6);
    cards.push({
      type: "meses",
      title: "Parcelas nos próximos meses",
      items: months.map((m, i) => ({ mes: MONTHS[m.month].slice(0, 3) + (m.year !== now.getFullYear() ? ` ${String(m.year).slice(2)}` : ""), valor: m.value, destaque: i === 0 })),
    });
  } else if (/gast|categoria|onde|padrao|atipic|economiz/.test(q) && ctx.categories.length > 0) {
    cards.push({
      type: "categorias",
      month,
      /* Paying an invoice is not spending: its purchases are already in their own categories. */
      items: [...ctx.categories].filter((c) => c.amount > 0 && !PAYMENT.test(c.name.trim())).sort((a, b) => b.amount - a.amount).map((c) => ({ name: c.name, amount: c.amount })),
    });
  } else if (/proximos meses|projecao|previsao|vou conseguir pagar/.test(q) && (ctx.snapshot.previsao?.proximos_meses ?? []).length > 0) {
    cards.push({
      type: "meses",
      title: "Sobra prevista mês a mês",
      tone: "sobra",
      items: ctx.snapshot.previsao!.proximos_meses.map((m, i) => ({ mes: m.mes.replace(/ de \d{4}$/, "").slice(0, 3), valor: m.sobra, destaque: i === 0 })),
    });
  } else if (/plano|organizar|salario|renda|orcamento|metodo/.test(q)) {
    try {
      const inputs = await loadPlanInputs();
      const past = buildProfile(inputs);
      const profile = past && past.incomeAvg > 0 ? past : buildProfile({ months: [...inputs.months, inputs.current].filter((m) => m.income > 0), saved: inputs.saved });
      const best = profile ? planMethods(profile)[0] : null;
      if (best) {
        const HEX: Record<string, string> = { necessidades: "#7CC4FF", desejos: "#B9B0FF", dividas: "#F9A8D4", guardar: "#C8F36D", livre: "#ECECEF" };
        cards.push({ type: "plano", label: best.label, why: best.why, items: best.allocations.map((a) => ({ label: a.label, amount: a.amount, hex: HEX[a.bucket] ?? "#ECECEF" })) });
      }
    } catch {
      /* No card rather than a wrong one. */
    }
  } else if (/meta|caixinha|objetivo|viagem|guardar/.test(q)) {
    try {
      const goals = (await fetchGoals()).filter((g) => (g as { status?: string }).status !== "completed");
      if (goals.length > 0) cards.push({ type: "metas", items: goals });
    } catch {
      /* No card rather than a wrong one. */
    }
  }
  return cards;
}
