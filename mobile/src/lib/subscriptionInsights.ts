import { knownSub } from "~/lib/subscriptionLogos";
import { money } from "~/lib/money";

/**
 * What the Willo makes of the subscriptions — said with numbers, never as a lecture:
 * what they cost in hours of work, which services overlap, a plan above the usual price,
 * the one that weighs most — and, for one of them, how many times it has been charged
 * since it began and what cancelling it would leave.
 */

/** Services that do the same job: films and series. */
const STREAMING = new Set(["Netflix", "Disney+", "Prime Video", "Max", "Globoplay", "Paramount+", "Apple TV+", "Crunchyroll"]);
/** Same job: music. */
const MUSIC = new Set(["Spotify", "Apple Music", "Deezer", "YouTube Premium"]);

export interface SubLike {
  name: string;
  amount: number;
}

export type InsightKind = "time" | "overlap" | "plan" | "weight" | "year";

export interface Insight {
  kind: InsightKind;
  /** The figure the insight is about, large. */
  figure: string;
  title: string;
  body: string;
  /** A question to take to the conversation. */
  ask?: string;
}

const hours = (value: number, income: number) => (income > 0 ? value / (income / 220) : 0);
const sayHours = (h: number) => (h >= 8 ? `${Math.round(h / 8)} ${Math.round(h / 8) === 1 ? "dia" : "dias"} de trabalho` : h >= 1 ? `${Math.round(h)} ${Math.round(h) === 1 ? "hora" : "horas"} de trabalho` : `${Math.max(1, Math.round(h * 60))} minutos de trabalho`);

export function subscriptionInsights(subs: SubLike[], income: number): Insight[] {
  if (subs.length === 0) return [];
  const out: Insight[] = [];
  const total = subs.reduce((t, s) => t + s.amount, 0);

  /* What the month's subscriptions cost in work. */
  if (income > 0) {
    out.push({
      kind: "time",
      figure: sayHours(hours(total, income)),
      title: "por mês só em assinaturas",
      body: `Com a sua renda fixa, ${money(total)} por mês equivalem a ${sayHours(hours(total, income))}. No ano, ${sayHours(hours(total * 12, income))}.`,
      ask: "Quais assinaturas eu poderia cortar sem sentir falta?",
    });
  }

  /* Two services doing the same job. */
  for (const [group, label] of [
    [STREAMING, "filmes e séries"],
    [MUSIC, "música"],
  ] as const) {
    const same = subs.filter((s) => group.has(knownSub(s.name)?.name ?? ""));
    if (same.length >= 2) {
      const keep = Math.min(...same.map((s) => s.amount));
      const saved = (same.reduce((t, s) => t + s.amount, 0) - keep) * 12;
      out.push({
        kind: "overlap",
        figure: money(saved),
        title: "por ano, ficando com um só",
        body: `Você assina ${same.length} serviços de ${label}: ${same.map((s) => s.name).join(", ")}. Revezar entre eles mês a mês também funciona.`,
        ask: `Vale a pena manter ${same.map((s) => s.name).join(" e ")} ao mesmo tempo?`,
      });
    }
  }

  /* A plan above what the service usually costs. */
  for (const s of subs) {
    const k = knownSub(s.name);
    if (k?.price && s.amount > k.price * 1.15) {
      out.push({
        kind: "plan",
        figure: money((s.amount - k.price) * 12),
        title: `por ano a mais no plano da ${k.name}`,
        body: `Você paga ${money(s.amount)}; o plano mais comum custa cerca de ${money(k.price)}. Se não usa os extras, um plano menor resolve.`,
        ask: `Qual plano da ${k.name} faz mais sentido para mim?`,
      });
      break;
    }
  }

  /* The one that weighs most. */
  if (subs.length > 1) {
    const top = [...subs].sort((a, b) => b.amount - a.amount)[0];
    out.push({
      kind: "weight",
      figure: `${Math.round((top.amount / total) * 100)}%`,
      title: `do total vai para ${top.name}`,
      body: `São ${money(top.amount * 12)} por ano. Cancelar libera ${money(top.amount)} na sua sobra todo mês.`,
    });
  }

  /* With nothing else to say: the year. */
  if (out.length < 2) {
    out.push({
      kind: "year",
      figure: money(total * 12),
      title: "por ano em assinaturas",
      body: "É o que sai se nada mudar. Vale olhar, de tempos em tempos, as que você não usou no último mês.",
    });
  }
  return out.slice(0, 3);
}

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

/** The next charge on a given day of the month, never before the first one. */
export function nextCharge(day: number, first?: string, today = new Date()): Date {
  const at = (y: number, m: number) => new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate()), 12);
  let next = at(today.getFullYear(), today.getMonth());
  if (next < new Date(today.getFullYear(), today.getMonth(), today.getDate())) next = at(today.getFullYear(), today.getMonth() + 1);
  if (first) {
    const f = new Date(`${first.slice(0, 10)}T12:00:00`);
    if (next < f) next = f;
  }
  return next;
}
