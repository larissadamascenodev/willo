import type { ActiveInstallmentItem } from "@/lib/installmentProgress";
import { installmentTotals } from "@/services/activeInstallments";
import { money } from "~/lib/money";

/**
 * Questions answered from the app's own numbers, with no AI in between.
 *
 * "Quanto posso gastar?", "qual meu saldo?", "quando vence a fatura?", "quando acabam
 * as parcelas?" have one right answer, and it is already worked out on the phone. These
 * come back at once and say so; everything else goes on to the assistant. A question
 * only half matched here goes on too — answering the wrong question fast is no help.
 */

const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

interface Snapshot {
  contas?: { saldo_atual: number; saldo_previsto_fim_mes: number | null; lista: { nome: string; saldo: number }[] };
  cartoes?: { nome: string; fatura_aberta: number; vence_em: string; disponivel: number; limite: number }[];
}

export interface LocalAnswer {
  text: string;
  /** Which specialist the answer belongs to, for the mark beside it. */
  agent: "cronos" | "atena";
}

export function localAnswer(question: string, snapshot: Snapshot, installments: ActiveInstallmentItem[] | null): LocalAnswer | null {
  const q = plain(question);
  /* Anything about buying something specific is a simulation: that is the assistant's. */
  if (/\b(comprar|compra|parcelar|financiar|emprestimo)\b/.test(q)) return null;

  const now = new Date();
  const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1;

  if (/quanto (eu )?posso gastar|quanto (eu )?tenho (pra|para) gastar|quanto sobra/.test(q)) {
    const left = snapshot.contas?.saldo_previsto_fim_mes;
    if (left == null) return null;
    if (left <= 0)
      return {
        agent: "cronos",
        text: `Com o que já está lançado, o mês fecha em ${money(left)}. Melhor segurar os gastos variáveis até o fim do mês.`,
      };
    return {
      agent: "cronos",
      text: `Com o que já está lançado, sobram ${money(left)} até o fim do mês. São ${daysLeft} ${daysLeft === 1 ? "dia" : "dias"}, então dá uns ${money(left / daysLeft)} por dia sem apertar.`,
    };
  }

  if (/\b(meu|qual|quanto).*(saldo)|saldo (atual|das contas|em conta)|quanto (eu )?tenho (na|em) conta/.test(q)) {
    const c = snapshot.contas;
    if (!c) return null;
    const lista = c.lista.filter((a) => Math.abs(a.saldo) > 0.004).map((a) => `${a.nome} ${money(a.saldo)}`).join(", ");
    return { agent: "cronos", text: `Você tem ${money(c.saldo_atual)} somando as contas${lista ? ` (${lista})` : ""}.` };
  }

  if (/\bfatura/.test(q) && /(quanto|qual|quando|vence|valor)/.test(q) && !/(aumentou|subiu|por que|porque)/.test(q)) {
    const cards = (snapshot.cartoes ?? []).filter((c) => c.fatura_aberta > 0);
    if (cards.length === 0) return { agent: "cronos", text: "Nenhuma fatura em aberto agora." };
    return {
      agent: "cronos",
      text: cards.map((c) => `A fatura do ${c.nome} está em ${money(c.fatura_aberta)} e vence em ${c.vence_em}.`).join(" "),
    };
  }

  if (/\b(limite)\b/.test(q) && /(quanto|qual|disponivel|tenho)/.test(q)) {
    const cards = snapshot.cartoes ?? [];
    if (cards.length === 0) return null;
    return { agent: "cronos", text: cards.map((c) => `${c.nome}: ${money(c.disponivel)} disponível de ${money(c.limite)}.`).join(" ") };
  }

  if (/parcel/.test(q) && /(quando|terminam|acabam|livre|quanto)/.test(q) && installments) {
    const t = installmentTotals(installments);
    if (!t) return { agent: "cronos", text: "Você não tem nenhum parcelamento ativo." };
    const when = t.lastEndDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    return {
      agent: "cronos",
      text: `São ${installments.length} compras parceladas, ${money(t.totalMensal)} por mês, e falta pagar ${money(t.totalRestante)}. A última parcela é em ${when}.`,
    };
  }

  return null;
}
