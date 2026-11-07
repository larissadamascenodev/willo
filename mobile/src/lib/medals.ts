import { plural, type Achievement, type MedalGroup, type MedalIcon } from "~/lib/challenges";

/**
 * The medals, one by one.
 *
 * Each achievement is a collection: one medal per step, each its own thing to win and
 * keep — "Constância" is a 3-day medal, a 7-day medal, a 30-day one — rather than one
 * medal that changes colour. An achievement with a single step is a medal won once,
 * with no levels at all, like "Planejado" or "Primeira caixinha".
 */

export interface Medal {
  /** The collection and the step, e.g. "streak:7". */
  id: string;
  family: string;
  group: MedalGroup;
  icon: MedalIcon;
  /** The collection's name: "Constância". */
  name: string;
  /** This medal's own name: "7 dias seguidos", or the name again for a medal won once. */
  title: string;
  /** Its place in the collection, from 1; 0 for a medal won once. */
  level: number;
  levels: number;
  step: number;
  value: number;
  unit: [string, string];
  what: string;
  earned: boolean;
  /** The day it was won, when the entries can tell it. */
  earnedOn: string | null;
  /** A secret one still hidden. */
  hidden: boolean;
  hint?: string;
}

export function medalsOf(list: Achievement[]): Medal[] {
  const out: Medal[] = [];
  for (const a of list) {
    const single = a.steps.length === 1;
    a.steps.forEach((step, i) => {
      const earned = a.value >= step && !(a.secret && !a.revealed);
      out.push({
        id: `${a.key}:${step}`,
        family: a.key,
        group: a.group,
        icon: a.icon,
        name: a.name,
        title: single ? a.name : a.key === "vault" ? `R$ ${step.toLocaleString("pt-BR")} guardados` : plural(step, a.unit),
        level: single ? 0 : i + 1,
        levels: a.steps.length,
        step,
        value: a.value,
        unit: a.unit,
        what: a.what,
        earned,
        earnedOn: earned ? (a.dates?.[step - 1] ?? null) : null,
        hidden: !!a.secret && !a.revealed,
        hint: a.hint,
      });
    });
  }
  return out;
}

/** What the medal says about itself, in a sentence. */
export function medalLine(m: Medal): string {
  if (m.hidden) return m.hint ?? "Uma medalha secreta. Continue usando o Willo para revelar.";
  if (m.level === 0) return m.earned ? `${m.what}. Medalha conquistada!` : `${m.what}: é só fazer isso uma vez para ganhar.`;
  if (m.earned) return `Você chegou a ${m.title} na coleção ${m.name}. ${CHEER[Math.min(m.level, CHEER.length) - 1]}`;
  return `${m.what}. Ganhe ao chegar a ${m.title}.`;
}

const CHEER = ["Você começou muito bem!", "Está pegando o ritmo!", "Isso já é hábito!", "Poucos chegam até aqui!", "Nível lenda!"];

/** How much is left for one not won yet, in words. */
export function medalLeft(m: Medal): string {
  const n = Math.max(0, m.step - m.value);
  return `${n === 1 ? "Falta" : "Faltam"} ${plural(n, m.unit)}`;
}

export const longDate = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
};
