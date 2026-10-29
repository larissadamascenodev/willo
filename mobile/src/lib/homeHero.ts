import { useSyncExternalStore } from "react";

/**
 * Which of the two the top of the home is: the sphere, or the stories.
 *
 * Both exist so they can be tried against each other, and the choice is kept on the
 * phone. It is read from the same synchronous store the shared code uses, which is
 * filled before anything draws — so the screen opens on the one that was chosen,
 * rather than on one and then changing to the other.
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
