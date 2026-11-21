import type { FinanceEvent } from "@/types/finance";
import { daysFrom, isIncome, isOverdue, isSettled, whenLabel } from "~/lib/events";
import { money } from "~/lib/money";

/**
 * What Willo says at the top of the home: one short line, the most pressing thing first.
 *
 * A bill gone past its day; one due today or tomorrow; a month whose bills pass what comes
 * in; what can be spent today; and, when there is nothing to say, hello. The line is split
 * so the words that matter can be lit: `lead` plain, `accent` in the brand's colour, `say`
 * the sentence under it.
 */

export interface HomeLine {
  lead: string;
  accent: string;
  say: string;
}

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function greeting(now: Date) {
  const h = now.getHours();
  return h < 5 ? "Boa noite" : h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

export function homeLine({
  events,
  free,
  leftToday,
  tomorrow,
  daysLeft,
  firstName,
  hidden,
  now = new Date(),
}: {
  events: FinanceEvent[];
  /** Free until the month ends, after every bill (lib/spendable). */
  free: number;
  leftToday: number;
  tomorrow: number;
  daysLeft: number;
  firstName: string;
  hidden?: boolean;
  now?: Date;
}): HomeLine {
  const show = (v: number) => (hidden ? "R$ •••" : money(v));
  const bills = events.filter((e) => !isIncome(e) && !isSettled(e));

  const late = bills.filter((e) => isOverdue(e, now));
  if (late.length === 1) {
    const e = late[0];
    return { lead: "Uma conta ", accent: "está atrasada.", say: `${e.name} ${whenLabel(e, now)} · ${show(e.amount)}. Que tal resolver hoje?` };
  }
  if (late.length > 1) {
    const sum = late.reduce((t, e) => t + e.amount, 0);
    return { lead: `${late.length} contas `, accent: "estão atrasadas.", say: `Somam ${show(sum)}. Que tal resolver hoje?` };
  }

  const soon = bills.filter((e) => {
    const n = daysFrom(e, now);
    return n === 0 || n === 1;
  });
  if (soon.length) {
    const e = soon.sort((a, b) => daysFrom(a, now) - daysFrom(b, now))[0];
    const today = daysFrom(e, now) === 0;
    const more = soon.length - 1;
    return {
      lead: `${e.name} `,
      accent: today ? "vence hoje." : "vence amanhã.",
      say: `São ${show(e.amount)}${more > 0 ? `, e mais ${more} ${more === 1 ? "conta" : "contas"} até amanhã` : ""}.`,
    };
  }

  if (free < 0) {
    const owed = bills.reduce((t, e) => t + e.amount, 0);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return {
      lead: `${MONTHS[now.getMonth()]} está `,
      accent: "no limite.",
      say: owed > 0 ? `Ainda vencem ${show(owed)} até o dia ${last}. Bora ajustar juntos?` : "As contas do mês passaram do que entrou. Bora ajustar juntos?",
    };
  }

  if (leftToday > 0.5) {
    return {
      lead: "Hoje dá para gastar ",
      accent: `${show(leftToday)}.`,
      say: daysLeft > 1 ? `E ${show(tomorrow)} por dia até o fim do mês, sem apertar.` : "Hoje fecha o mês: o que sobrar fica para o próximo.",
    };
  }

  return { lead: `${greeting(now)}${firstName ? ", " : ""}`, accent: firstName ? `${firstName}.` : ".", say: "Tudo em dia por aqui." };
}
