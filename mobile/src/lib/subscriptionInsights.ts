import { knownSub } from "~/lib/subscriptionLogos";
import { money } from "~/lib/money";

/**
 * What the Willo has to say about the subscriptions: which costs the most, where two
 * services do the same job, and — for one of them — how many times it has been charged
 * since it began and what cancelling it would leave in the month and in the year.
 */

/** Services that do the same job: films and series. */
const STREAMING = new Set(["Netflix", "Disney+", "Prime Video", "Max", "Globoplay", "Paramount+", "Apple TV+", "Crunchyroll"]);

export interface SubLike {
  name: string;
  amount: number;
}

export function overviewTips(subs: SubLike[]): string[] {
  if (subs.length === 0) return [];
  const tips: string[] = [];
  const priciest = [...subs].sort((a, b) => b.amount - a.amount)[0];
  if (subs.length > 1) {
    tips.push(`${priciest.name} é a mais cara: ${money(priciest.amount * 12)} por ano. Cancelar libera ${money(priciest.amount)} todo mês.`);
  }

  const streams = subs.filter((s) => STREAMING.has(knownSub(s.name)?.name ?? ""));
  if (streams.length >= 2) {
    const cheapest = Math.min(...streams.map((s) => s.amount));
    const saved = streams.reduce((t, s) => t + s.amount, 0) - cheapest;
    tips.push(`São ${streams.length} serviços de filmes e séries (${streams.map((s) => s.name).join(", ")}). Ficando só com um, sobram ${money(saved * 12)} por ano.`);
  }

  const total = subs.reduce((t, s) => t + s.amount, 0);
  tips.push(`Juntas, suas assinaturas custam ${money(total * 12)} por ano. Vale olhar as que você não usou no último mês.`);
  return tips;
}

/** Months between two dates, counting both ends' months: a series from 5 nov. to 13 dez. is 2. */
const monthIndex = (d: Date) => d.getFullYear() * 12 + d.getMonth();

/**
 * Charges of a monthly subscription that began on `start` (its first charge), up to today,
 * leaving out the months it was skipped.
 */
export function chargesSoFar(start: string, skipped: { month: number; year: number }[], today = new Date()): number {
  const first = new Date(`${start.slice(0, 10)}T12:00:00`);
  const day = first.getDate();
  const skip = new Set(skipped.map((s) => s.year * 12 + s.month));
  let n = 0;
  for (let k = monthIndex(first); k <= monthIndex(today); k++) {
    const y = Math.floor(k / 12);
    const m = k % 12;
    const charge = new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate()), 12);
    if (charge > today) break;
    if (!skip.has(k)) n++;
  }
  return n;
}

/** Charges still to come this year, from the next one on. */
export function chargesLeftThisYear(start: string, today = new Date()): number {
  const first = new Date(`${start.slice(0, 10)}T12:00:00`);
  const day = first.getDate();
  let n = 0;
  for (let m = today.getMonth(); m <= 11; m++) {
    const charge = new Date(today.getFullYear(), m, Math.min(day, new Date(today.getFullYear(), m + 1, 0).getDate()), 12);
    if (charge >= first && charge > today) n++;
  }
  return n;
}
