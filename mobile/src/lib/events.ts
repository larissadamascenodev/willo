import type { FinanceEvent } from "@/types/finance";

/**
 * How the app reads a month's events.
 *
 * The card on the home and the events page ask the same questions of the same
 * list — is it money coming in, has it happened, how far away is it — and a card
 * that answered them one way and a page that answered them another would disagree
 * about the same bill. So the answers live here once.
 */

const DAY_MS = 86_400_000;

/** Noon on the event's day, so no time zone can move it to the day before. */
export const dateOf = (e: FinanceEvent): Date => {
  const raw = e.rawDate || e.date;
  return raw.includes("T") ? new Date(raw) : new Date(`${raw}T12:00:00`);
};

export const dayOfMonth = (e: FinanceEvent) => Number((e.rawDate ?? "").slice(8, 10)) || dateOf(e).getDate();

export const isIncome = (e: FinanceEvent) => e.type === "receita" || e.status === "recebido";

/** Already happened: paid, or received. */
export const isSettled = (e: FinanceEvent) => e.status === "pago" || e.status === "recebido";

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Whole days from today to the event: 0 today, 1 tomorrow, negative behind. */
export const daysFrom = (e: FinanceEvent, today = new Date()) =>
  Math.round((startOfDay(dateOf(e)) - startOfDay(today)) / DAY_MS);

/** Still to settle and its day has gone. */
export const isOverdue = (e: FinanceEvent, today = new Date()) =>
  !isSettled(e) && (e.status === "atrasado" || daysFrom(e, today) < 0);

/** When it falls, said the way a person would say it. */
export function whenLabel(e: FinanceEvent, today = new Date()): string {
  const n = daysFrom(e, today);
  if (isOverdue(e, today)) {
    if (n === -1) return "venceu ontem";
    return n < 0 ? `venceu há ${-n} dias` : "atrasado";
  }
  if (n === 0) return "hoje";
  if (n === 1) return "amanhã";
  if (n === -1) return "ontem";
  if (n > 1) return `em ${n} dias`;
  return `há ${-n} dias`;
}

/** Still to happen, soonest first — the overdue ones ahead of everything. */
export function upcoming(events: FinanceEvent[], today = new Date()): FinanceEvent[] {
  return events
    .filter((e) => !isSettled(e))
    .sort((a, b) => {
      const oa = isOverdue(a, today) ? 0 : 1;
      const ob = isOverdue(b, today) ? 0 : 1;
      return oa !== ob ? oa - ob : dateOf(a).getTime() - dateOf(b).getTime();
    });
}

/** What is still to come in and still to go out. */
export function stillToHappen(events: FinanceEvent[]) {
  let aReceber = 0;
  let aPagar = 0;
  for (const e of events) {
    if (isSettled(e)) continue;
    if (isIncome(e)) aReceber += e.amount;
    else aPagar += e.amount;
  }
  return { aReceber, aPagar };
}

const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const WEEKDAYS_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export const monthShort = (d: Date) => MONTHS_SHORT[d.getMonth()];
export const weekdayShort = (d: Date) => WEEKDAYS_SHORT[d.getDay()];

/**
 * Where an event stands, as one short phrase: "Vence hoje", "Recebe amanhã",
 * "Atrasado há 6 dias", "Pago". The verb says which way the money goes, so the
 * phrase needs no "a pagar" or "a receber" beside it.
 */
export function dueLabel(e: FinanceEvent, today = new Date()): string {
  const income = isIncome(e);
  if (isSettled(e)) return income ? "Recebido" : "Pago";
  const n = daysFrom(e, today);
  if (isOverdue(e, today)) {
    if (n >= 0) return "Atrasado";
    return n === -1 ? "Atrasado desde ontem" : `Atrasado há ${-n} dias`;
  }
  const verb = income ? "Recebe" : "Vence";
  if (n === 0) return `${verb} hoje`;
  if (n === 1) return `${verb} amanhã`;
  return `${verb} em ${n} dias`;
}
