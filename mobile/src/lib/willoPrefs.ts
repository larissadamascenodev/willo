import { useSyncExternalStore } from "react";

/**
 * How Willo talks to this person, and which of his specialists are at work.
 *
 * Kept on the phone for now, read from the same synchronous store the home's choices
 * use, and sent with every question so the assistant answers in the chosen voice. The
 * voice changes the words, never the numbers or how serious a risk is.
 */

export type WilloStyle = "amigavel" | "direto" | "descontraido" | "firme";
export type WilloLength = "curtas" | "detalhadas";
export type AgentId = "alura" | "atena" | "cronos" | "lora" | "julius" | "argos";

export interface WilloPrefs {
  style: WilloStyle;
  length: WilloLength;
  agents: Record<AgentId, boolean>;
}

const KEY = "willo-prefs";
const DEFAULTS: WilloPrefs = {
  style: "descontraido",
  length: "curtas",
  agents: { alura: true, atena: true, cronos: true, lora: true, julius: true, argos: true },
};

const listeners = new Set<() => void>();

const read = (): WilloPrefs => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const saved = JSON.parse(raw) as Partial<WilloPrefs>;
    /* Argos checks the numbers; he is never switched off. */
    return { ...DEFAULTS, ...saved, agents: { ...DEFAULTS.agents, ...(saved.agents ?? {}), argos: true } };
  } catch {
    return DEFAULTS;
  }
};

let current: WilloPrefs = read();

export function setWilloPrefs(next: Partial<WilloPrefs>) {
  current = { ...current, ...next, agents: { ...current.agents, ...(next.agents ?? {}), argos: true } };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* Kept for this session only. */
  }
  listeners.forEach((l) => l());
}

export const getWilloPrefs = () => current;

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function useWilloPrefs(): WilloPrefs {
  return useSyncExternalStore(subscribe, () => current, () => current);
}
