import { useSyncExternalStore } from "react";
import { onHydrated } from "~/lib/shims";

/**
 * Which of the two the top of the home is: the robot saying his lines, or the same
 * lines centred with no robot.
 *
 * The choice is kept on the phone, in the same synchronous store the shared code
 * uses. That store is filled from disk only after this module has been imported, so
 * the choice is read again the moment it is filled — before any screen draws — and
 * the home opens on the one that was chosen, every time, until it is changed.
 */

export type HomeHero = "orb" | "stories";

const KEY = "home-hero";
const listeners = new Set<() => void>();

const read = (): HomeHero => {
  try {
    return localStorage.getItem(KEY) === "stories" ? "stories" : "orb";
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
