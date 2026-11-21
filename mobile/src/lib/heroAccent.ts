import { useSyncExternalStore } from "react";
import { onHydrated } from "~/lib/shims";

/**
 * How Willo's line on the home lights its key words — chosen in Aparência.
 *
 * "branco", the default: all of it white, the line in a lighter weight and its key words bold.
 * The colours: the whole line bold, its key words in the colour chosen.
 */
export type HeroAccent = "branco" | "lilas" | "verde" | "azul" | "rosa";

export const HERO_ACCENTS: { key: HeroAccent; label: string; color: string | null }[] = [
  { key: "branco", label: "Branco", color: null },
  { key: "lilas", label: "Lilás", color: "#C4B5FD" },
  { key: "verde", label: "Verde", color: "#67CD67" },
  { key: "azul", label: "Azul", color: "#7DB8FF" },
  { key: "rosa", label: "Rosa", color: "#F9A8D4" },
];

const KEY = "hero-accent";
const listeners = new Set<() => void>();
const read = (): HeroAccent => {
  try {
    const v = localStorage.getItem(KEY);
    return HERO_ACCENTS.some((a) => a.key === v) ? (v as HeroAccent) : "branco";
  } catch {
    return "branco";
  }
};
let current: HeroAccent = read();
onHydrated(() => {
  current = read();
  listeners.forEach((l) => l());
});

export function setHeroAccent(next: HeroAccent) {
  current = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* Kept for this session only. */
  }
  listeners.forEach((l) => l());
}

export function useHeroAccent() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => current,
    () => current,
  );
}
