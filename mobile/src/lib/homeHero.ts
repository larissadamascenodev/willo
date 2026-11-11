import { useSyncExternalStore } from "react";
import { onHydrated } from "~/lib/shims";

/**
 * Which the top of the home is: the robot saying his lines, the same lines centred
 * with no robot, or the panel — a raised sheet with the balance, the accounts, the
 * cards and the caixinhas, one face at a time (on trial).
 *
 * The choice is kept on the phone, in the same synchronous store the shared code
 * uses. That store is filled from disk only after this module has been imported, so
 * the choice is read again the moment it is filled — before any screen draws — and
 * the home opens on the one that was chosen, every time, until it is changed.
 */

export type HomeHero = "orb" | "stories" | "panel";

const KEY = "home-hero";
const listeners = new Set<() => void>();

const read = (): HomeHero => {
  try {
    const v = localStorage.getItem(KEY);
    return v === "stories" || v === "panel" ? v : "orb";
  } catch {
    return "orb";
  }
};

let current: HomeHero = read();
onHydrated(() => {
  current = read();
  listeners.forEach((l) => l());
});

export function setHomeHero(next: HomeHero) {
  current = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* Kept for this session only. */
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function useHomeHero() {
  const hero = useSyncExternalStore(subscribe, () => current, () => current);
  return [hero, setHomeHero] as const;
}
