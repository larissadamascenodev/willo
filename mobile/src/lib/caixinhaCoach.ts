import type { CoverKind } from "~/lib/coverKind";
import { money } from "~/lib/money";

/**
 * What Willo says while a caixinha is being made.
 *
 * Nothing here is generic filler and nothing here is a call to a model: each line is
 * worked out from the person's own month — what comes in, what goes out — and from the
 * choice just made, so the same question is answered differently for a trip than for a
 * reserve, and for someone who earns three thousand than for someone who earns thirty.
 * It never invents a figure: when the month is not known yet it says what it can and
 * leaves the number out.
 */

export interface Month {
  /** The average of what has come in lately, or this month's when there is no history. */
  income: number;
  expense: number;
}

const known = (n: number) => Number.isFinite(n) && n > 0;
const rounded = (n: number) => (n >= 1000 ? Math.round(n / 50) * 50 : Math.round(n));

export const purposeLine = (first: string | null) =>
  `${first ? `Oi, ${first}. ` : "Oi! "}Escolha um objetivo e eu te ajudo com o valor e o prazo.`;

const ABOUT: Record<CoverKind, string> = {
  viagem: "Viagem costuma custar mais do que a gente imagina: passagem, hospedagem, passeios. Dê um nome e um valor que caiba no seu mês.",
  reserva: "A reserva é o que te segura num imprevisto. Não precisa de prazo: ela se enche conforme der.",
  reforma: "Obra quase sempre passa do orçamento. Se puder, some uma folga de 10% ao valor.",
  casa: "Entrada de imóvel é um objetivo de anos. Quanto mais cedo começar, menos pesa cada mês.",
  carro: "Pense no valor da entrada, não do carro inteiro. O resto o financiamento ou o próximo ano resolvem.",
  carreira: "Investir em você costuma ser o melhor retorno que existe. Curso, mentoria, equipamento: qual é o primeiro passo?",
  consumo: "Um desejo planejado é um desejo que você aproveita sem culpa. Quanto ele custa?",
  educacao: "Estudo é investimento. Coloque o valor total do curso ou da mensalidade que você quer cobrir.",
};

export function aboutLine(kind: CoverKind | null, custom: boolean, month: Month): string {
  if (kind === "reserva" && known(month.expense)) {
    return `${ABOUT.reserva} Com o que você gasta por mês, o ideal fica entre ${money(rounded(month.expense * 3))} e ${money(rounded(month.expense * 6))}.`;
  }
  if (kind) return ABOUT[kind];
  return custom ? "Dê um nome que você reconheça na hora: Moto, Casamento, Reforma da cozinha…" : "Dê um nome que você reconheça na hora.";
}

/** Reserve suggestions the person can tap to fill the amount: three and six months of expenses. */
export function reserveChips(month: Month): { label: string; cents: number }[] {
  if (!known(month.expense)) return [];
  return [3, 6].map((n) => ({ label: `${n} meses`, cents: Math.round(rounded(month.expense * n) * 100) }));
}

export function timeLine(args: { month: Month; perMonth: number; months: number | null; target: number }): string {
  const { month, perMonth, months, target } = args;
  if (months === null) return "Sem prazo você guarda conforme der. Se quiser, diga quanto pretende separar por mês.";
  if (perMonth <= 0) return "Esse prazo já cobre o valor com o que você vai colocar agora.";
  if (!known(month.income)) return `Para chegar lá, são ${money(perMonth)} por mês.`;
  const share = Math.round((perMonth / month.income) * 100);
  if (share >= 35 && months < 36) {
    const longer = Math.ceil(target / (months * 2) * 100) / 100;
    return `São ${money(perMonth)} por mês, ${share}% do que entra. É pesado. Em ${months * 2} meses cai para ${money(longer)}.`;
  }
  if (share >= 20) return `${money(perMonth)} por mês é ${share}% da sua renda. Dá, mas pede atenção aos outros gastos.`;
  return `${money(perMonth)} por mês é só ${Math.max(share, 1)}% da sua renda. Cabe tranquilo.`;
}

export function startLine(args: { start: number; accountName: string | null; balance: number | null }): string {
  const { start, accountName, balance } = args;
  if (start <= 0) return "Quer já colocar algum valor? Pode deixar zerado e guardar depois, sem pressa.";
  if (balance !== null && accountName && start > balance) {
    return `${accountName} tem ${money(Math.max(balance, 0))} agora, menos que isso. Escolha outra conta ou um valor menor.`;
  }
  return accountName ? `Certo, ${money(start)} saem de ${accountName} e já ficam guardados.` : "Escolha de qual conta sai o dinheiro.";
}

export function reviewLine(args: { perMonth: number; due: string | null; start: number }): string {
  const { perMonth, due, start } = args;
  const parts: string[] = [];
  if (perMonth > 0 && due) parts.push(`Guardando ${money(perMonth)} por mês, você chega lá em ${due}.`);
  if (start > 0) parts.push(`${money(start)} já começam guardados.`);
  parts.push("Se quiser, coloque uma foto sua para ela ficar com a sua cara.");
  return parts.join(" ");
}
