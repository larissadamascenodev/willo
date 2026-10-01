import { useSyncExternalStore } from "react";

const KEY = "willo:hide-values";

/**
 * Whether money is masked on screen. The eye lives in the page header and the
 * figures live further down the card stack, so this can't be local state — and
 * since it survives a reload, hiding your balance in public stays hidden.
 */
let value = (() => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
})();

const listeners = new Set<() => void>();

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function setHiddenValues(next: boolean) {
  value = next;
  try {
    localStorage.setItem(KEY, next ? "1" : "0");
  } catch {
    // private mode — the toggle still works for this session
  }
  listeners.forEach((fn) => fn());
}

export function useHiddenValues() {
  return useSyncExternalStore(subscribe, () => value, () => false);
}
