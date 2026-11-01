import { getWilloPrefs } from "~/lib/willoPrefs";

/**
 * What the numbers alone answer, in the voice the person chose.
 *
 * The assistant writes in that voice by itself; these answers never reach it, and so
 * they sounded the same whichever one was picked. The words around the figure change
 * with the voice and how the news is. The figure does not.
 */

export type Mood = "good" | "bad" | "plain";

const AROUND: Record<string, Record<Mood, { before?: string; after?: string }>> = {
  direto: { good: {}, bad: {}, plain: {} },
  amigavel: {
    good: { after: "Tá indo bem!" },
    bad: { after: "Calma, dá para ajustar." },
    plain: {},
  },
  descontraido: {
    good: { before: "Tá tranquilo 😄" },
    bad: { before: "Eita, olha só." },
    plain: { before: "Bora lá." },
  },
  firme: {
    good: { after: "Mantenha assim." },
    bad: { after: "Corte o que der agora." },
    plain: { after: "Fique de olho." },
  },
};

export function voiced(text: string, mood: Mood = "plain"): string {
  const { before, after } = AROUND[getWilloPrefs().style]?.[mood] ?? {};
  return [before, text, after].filter(Boolean).join(" ");
}
