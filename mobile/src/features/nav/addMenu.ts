import { useSyncExternalStore } from "react";

let open = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

/** Abre ou fecha o menu de adicionar (receita, despesa…), de qualquer lugar do app. */
export const addMenu = {
  show() { open = true; emit(); },
  hide() { open = false; emit(); },
};

export function useAddMenuOpen() {
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    () => open,
    () => false,
  );
}
