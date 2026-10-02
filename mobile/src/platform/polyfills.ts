/**
 * O código de dados do site (serviços, cálculos, hooks) foi escrito para o navegador.
 * Aqui o celular ganha os poucos recursos de navegador que ele usa, para o mesmo código
 * rodar nos dois lugares sem cópia:
 *
 *  - localStorage            (sincrono, guardado em SQLite)
 *  - window.addEventListener / dispatchEvent / CustomEvent  (o aviso "finance-data-changed")
 *  - document.visibilityState / "visibilitychange"          (o app foi para segundo plano)
 *  - window.location.reload                                  (trocar a moeda recarrega a tela)
 */
import "react-native-url-polyfill/auto";
import "expo-sqlite/localStorage/install";
import { AppState } from "react-native";

const g = globalThis as any;

type Listener = (event: any) => void;

if (typeof g.CustomEvent === "undefined") {
  g.CustomEvent = class CustomEvent {
    type: string;
    detail: unknown;
    constructor(type: string, init: { detail?: unknown } = {}) {
      this.type = type;
      this.detail = init.detail ?? null;
    }
  };
}

const target = typeof g.window === "undefined" ? g : g.window;

if (typeof target.dispatchEvent !== "function") {
  const listeners = new Map<string, Set<Listener>>();

  target.addEventListener = (type: string, fn: Listener) => {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type)!.add(fn);
  };
  target.removeEventListener = (type: string, fn: Listener) => {
    listeners.get(type)?.delete(fn);
  };
  target.dispatchEvent = (event: { type: string }) => {
    for (const fn of Array.from(listeners.get(event.type) ?? [])) fn(event);
    return true;
  };
}

if (typeof g.document === "undefined") {
  const visibility = new Set<Listener>();
  AppState.addEventListener("change", () => visibility.forEach((fn) => fn({ type: "visibilitychange" })));

  g.document = {
    get visibilityState() {
      return AppState.currentState === "active" ? "visible" : "hidden";
    },
    addEventListener: (type: string, fn: Listener) => {
      if (type === "visibilitychange") visibility.add(fn);
    },
    removeEventListener: (type: string, fn: Listener) => {
      if (type === "visibilitychange") visibility.delete(fn);
    },
  };
}

if (typeof target.location === "undefined") {
  // Trocar a moeda "recarrega a página" no site; aqui avisa a raiz do app para remontar as telas.
  target.location = {
    search: "",
    origin: "willo://app",
    reload: () => target.dispatchEvent(new g.CustomEvent("willo:reload")),
  };
}
