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
  `${first ? `Oi, ${first}!` : "Oi!"} Me conta o que você quer conquistar que eu te ajudo a chegar lá.`;

const ABOUT: Record<CoverKind, string> = {
  viagem: "Viagem sempre sai mais cara do que a gente pensa, né? Passagem, hotel, passeio… Coloca um valor que caiba no bolso.",
  reserva: "A reserva é o seu colchão pra imprevisto. Nada de prazo: ela vai enchendo no seu ritmo.",
  reforma: "Obra adora passar do orçamento. Se der, coloca uma folguinha de uns 10% no valor.",
  casa: "Casa própria é projeto de alguns anos. Quanto antes começar, mais leve fica cada mês.",
  carro: "Dica: pensa no valor da entrada, não no carro inteiro. O resto a gente resolve depois.",
  carreira: "Investir em você é o melhor retorno que existe. Curso, mentoria, equipamento… quanto vai precisar?",
  consumo: "Desejo planejado é desejo aproveitado sem culpa. Quanto custa esse sonho?",
  educacao: "Estudo é investimento. Coloca o valor total do curso, ou das mensalidades que quer cobrir.",
};

export function aboutLine(kind: CoverKind | null, custom: boolean, month: Month): string {
  if (kind === "reserva" && known(month.expense)) {
    return `${ABOUT.reserva} Pelo que você gasta, o ideal fica entre ${money(rounded(month.expense * 3))} e ${money(rounded(month.expense * 6))}.`;
  }
  if (kind) return ABOUT[kind];
  return custom ? "Dá um nome que você bata o olho e já saiba o que é: Moto, Casamento, Cozinha nova…" : "Dá um nome que você bata o olho e já saiba o que é.";
}

/** Reserve suggestions the person can tap to fill the amount: three and six months of expenses. */
export function reserveChips(month: Month): { label: string; cents: number }[] {
  if (!known(month.expense)) return [];
  return [3, 6].map((n) => ({ label: `${n} meses`, cents: Math.round(rounded(month.expense * n) * 100) }));
}

export function timeLine(args: { month: Month; perMonth: number; months: number | null; target: number }): string {
  const { month, perMonth, months, target } = args;
  if (months === null) return "Sem prazo, sem pressão. Se quiser, me fala quanto pensa em separar por mês.";
  if (perMonth <= 0) return "Com o que você vai colocar agora, já fecha a conta. Boa!";
  if (!known(month.income)) return `Pra chegar lá, são ${money(perMonth)} por mês.`;
  const share = Math.round((perMonth / month.income) * 100);
  if (share >= 35 && months < 36) {
    const longer = Math.ceil((target / (months * 2)) * 100) / 100;
    return `Hmm, ${money(perMonth)} por mês é ${share}% do que entra. Puxado! Em ${months * 2} meses cai pra ${money(longer)}.`;
  }
  if (share >= 20) return `${money(perMonth)} por mês é ${share}% da sua renda. Dá, mas vai pedir um pouco de disciplina.`;
  return `${money(perMonth)} por mês? É só ${Math.max(share, 1)}% da sua renda. Tranquilo!`;
}

export function startLine(args: { start: number; accountName: string | null; balance: number | null }): string {
  const { start, accountName, balance } = args;
  if (start <= 0) return "Quer dar o pontapé inicial? Pode deixar zerado também e ir guardando depois.";
  if (balance !== null && accountName && start > balance) {
    return `Opa, ${accountName} só tem ${money(Math.max(balance, 0))} agora. Escolhe outra conta ou um valor menor.`;
  }
  return accountName ? `Fechado! ${money(start)} saem de ${accountName} e já ficam guardados.` : "De qual conta sai o dinheiro?";
}

export function reviewLine(args: { perMonth: number; due: string | null; start: number; hasValue: boolean }): string {
  const { perMonth, due, start, hasValue } = args;
  if (!hasValue) return start > 0 ? `Ficou ótima! Já começa com ${money(start)} guardados.` : "Ficou ótima! É só ir guardando quando der.";
  if (perMonth > 0 && due) return `Tá tudo certo. Guardando ${money(perMonth)} por mês, você chega lá em ${due}.`;
  return "Tá tudo certo. Confere aí e é só criar.";
}
