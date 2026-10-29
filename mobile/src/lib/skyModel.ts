import { useSyncExternalStore } from "react";

/**
 * Which sky the screens that wear one are wearing.
 *
 * 1 is the first: drawn live, the hour with its fire and its water. 2 is the picture
 * taken from the welcome, with the glow turned down so cards pass over it quietly.
 * Both are kept so the person can choose, and the choice stays on the phone. It is read
 * from the same synchronous store as the home's top, so the screen opens already on
 * the one that was chosen rather than changing under the eye.
 */

export type SkyModel = "1" | "2";

const KEY = "sky-model";
const listeners = new Set<() => void>();

const read = (): SkyModel => {
  try {
    return localStorage.getItem(KEY) === "1" ? "1" : "2";
  } catch {
    return "2";
  }
};

let current: SkyModel = read();

export function setSkyModel(next: SkyModel) {
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

export function useSkyModel() {
  const model = useSyncExternalStore(subscribe, () => current, () => current);
  return [model, setSkyModel] as const;
}
