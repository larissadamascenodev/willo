import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * The handful of browser things the shared code still asks for.
 *
 * Everything under ../src that is not a screen was written against a browser, and
 * most of it only reaches for two of them: a key/value store it can read without
 * waiting, and an event to say the data has changed so every open screen refetches.
 * Giving the phone both means those files cross over untouched — which is the whole
 * point of sharing them.
 *
 * `localStorage` has to answer immediately, so the keys are read into memory once
 * before the app draws anything and written back in the background afterwards.
 */

const PREFIX = "willo:";
const memory = new Map<string, string>();

const storage = {
  getItem: (key: string) => (memory.has(key) ? memory.get(key)! : null),
  setItem: (key: string, value: string) => {
    memory.set(key, String(value));
    void AsyncStorage.setItem(PREFIX + key, String(value));
  },
  removeItem: (key: string) => {
    memory.delete(key);
    void AsyncStorage.removeItem(PREFIX + key);
  },
  clear: () => {
    const keys = [...memory.keys()].map((k) => PREFIX + k);
    memory.clear();
    void AsyncStorage.multiRemove(keys);
  },
  key: (i: number) => [...memory.keys()][i] ?? null,
  get length() {
    return memory.size;
  },
};

/* Something was written: the reads kept for a few minutes (the cards, the accounts, the
   month) are out of date. Forgotten before any screen hears of it, so every screen that
   reloads gets today's figures — a paid invoice gives its limit back at once, not after
   the app is opened again. The web clears them where it writes; the phone's screens
   only send the event, so the clearing lives here, where every event passes. */
const FRESH = new Set(["finance-data-changed", "transaction-created"]);
function forgetCachedReads() {
  try {
    /* eslint-disable @typescript-eslint/no-require-imports */
    require("@/services/transactionService").clearFinanceQueryCache();
    require("@/services/dashboardData").clearDashboardCache();
    require("@/lib/financeEngine").clearMaterializedCache();
    /* eslint-enable @typescript-eslint/no-require-imports */
  } catch {
    /* not loaded yet: nothing kept to forget */
  }
}

/** One listener list, standing in for the page that used to carry them. */
type Listener = (event: { type: string; detail?: unknown }) => void;
const listeners = new Map<string, Set<Listener>>();

const events = {
  addEventListener: (type: string, fn: Listener) => {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type)!.add(fn);
  },
  removeEventListener: (type: string, fn: Listener) => {
    listeners.get(type)?.delete(fn);
  },
  dispatchEvent: (event: { type: string; detail?: unknown }) => {
    if (FRESH.has(event.type)) forgetCachedReads();
    listeners.get(event.type)?.forEach((fn) => {
      try {
        fn(event);
      } catch {
        /* one bad listener should not stop the others */
      }
    });
    return true;
  },
};

/* Modules that keep a choice in memory read it when they are first imported, which
   is before the stored keys have arrived: they would always see the default. They
   ask to be told once the keys are in, and read again then. */
let hydrated = false;
const whenHydrated = new Set<() => void>();

/** Runs `fn` once the stored keys are in memory — at once, if they already are. */
export function onHydrated(fn: () => void) {
  if (hydrated) fn();
  else whenHydrated.add(fn);
}

/** Reads the stored keys into memory. Call once, before the first screen draws. */
export async function hydrateShims() {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(PREFIX));
    const pairs = await AsyncStorage.multiGet(keys);
    for (const [key, value] of pairs) {
      if (value !== null) memory.set(key.slice(PREFIX.length), value);
    }
  } catch {
    /* a first run with nothing stored is the normal case */
  }
  hydrated = true;
  whenHydrated.forEach((fn) => {
    try {
      fn();
    } catch {
      /* one bad reader should not stop the others */
    }
  });
  whenHydrated.clear();
}

export function installShims() {
  const g = globalThis as Record<string, unknown>;

  if (!g.localStorage) g.localStorage = storage;

  /* React Native already defines `window` as the global object; what it does not
     define is the part of it the shared hooks listen on. */
  const win = (g.window ?? (g.window = g)) as Record<string, unknown>;
  if (typeof win.addEventListener !== "function") {
    Object.assign(win, events);
  }
  if (typeof g.CustomEvent !== "function") {
    g.CustomEvent = class {
      type: string;
      detail: unknown;
      constructor(type: string, init?: { detail?: unknown }) {
        this.type = type;
        this.detail = init?.detail;
      }
    };
  }
  /* Only reached when the currency is changed, which the phone app does not offer
     yet; without it that call would crash rather than do nothing. */
  if (!win.location) win.location = { reload: () => {}, href: "" };
}
