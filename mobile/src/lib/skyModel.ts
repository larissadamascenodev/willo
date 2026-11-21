import { useSyncExternalStore } from "react";
import { File, Paths } from "expo-file-system";
import { onHydrated } from "~/lib/shims";
import { BACKDROP_KEYS, LIGHT_BACKDROP_KEYS, type BackdropKey, type LightBackdropKey } from "~/lib/backdrops";

/**
 * What the screens that wear a sky are wearing.
 *
 * - "willo", the default (lib/backdrops): a quiet graphite, a little lighter at the top,
 *   with soft colourless lights for the glass — nothing that competes with the figures.
 * - "prisma": Horizonte's petrol with the Willo icon's colours in it as soft lights —
 *   violet, a little orange, teal — washing down into the dark.
 * - "horizonte": one calm petrol light at the top, washing down smoothly into the dark.
 * - "2": the hour as a picture, with the glow turned down so cards pass over it quietly.
 * - "1": the same hour drawn live, with its fire and its water.
 * - "plain": no sky, only the room's soft lights on the dark ground.
 * - "custom": a photo the person chose, kept on the phone.
 * - and the drawn ones in lib/backdrops: Aurora, Oceano, Ametista, Brasa, Grafite,
 *   Meia-noite.
 *
 * The choice stays on the phone until it is changed. It is read from the same
 * synchronous store as the home's top, and read again the moment that store is filled
 * from disk, so the screen opens already on the one that was chosen.
 *
 * The custom photo is kept by its file name only: the folder an app's documents live
 * in can move between installs, so the full address is rebuilt each time.
 */

export type SkyModel = "1" | "2" | "plain" | "custom" | BackdropKey;

const KEY = "sky-model";
const DEFAULT: SkyModel = "anil";
/* Set once the older defaults ("2", "aurora-clara", Horizonte, then Prisma) have been moved to the new one. */
const MOVED_KEY = "sky-default-willo";
const LIGHT_KEY = "sky-model-light";
const LIGHT_DEFAULT = "willo-claro" as const;
const PHOTO_KEY = "sky-photo";
/* Set once the backgrounds that left the list have been moved to the nearest that stayed. */
const TRIMMED_KEY = "sky-trimmed-v1";
const INDIGO_KEY = "sky-default-indigo";
const DARK_NEAREST: Record<string, SkyModel> = {
  horizonte: "bruma",
  aurora: "azul",
  oceano: "azul",
  "meia-noite": "azul",
  ametista: "violeta",
  brasa: "terra",
  grafite: "willo",
  plain: "willo",
  "1": "willo",
  "2": "willo",
};
const LIGHT_NEAREST: Record<string, LightBackdropKey> = {
  "horizonte-claro": "nevoa",
  "aurora-clara": "lavanda",
  pessego: "areia",
};
const listeners = new Set<() => void>();

const readModel = (): SkyModel => {
  try {
    const v = localStorage.getItem(KEY);
    return v === "1" || v === "2" || v === "plain" || v === "custom" || BACKDROP_KEYS.includes(v as BackdropKey) ? (v as SkyModel) : DEFAULT;
  } catch {
    return DEFAULT;
  }
};

const readPhoto = (): string | null => {
  try {
    const name = localStorage.getItem(PHOTO_KEY);
    if (!name) return null;
    const file = new File(Paths.document, name);
    return file.exists ? file.uri : null;
  } catch {
    return null;
  }
};

let current: SkyModel = readModel();
let photo: string | null = readPhoto();
/* A custom choice with its photo gone falls back to the default. */
const settle = () => {
  if (current === "custom" && !photo) current = DEFAULT;
};
settle();

onHydrated(() => {
  /* Once, on the phone's own stored choices: whoever was on the old defaults moves to the
     new one; a background picked on purpose (a drawn one, a photo) stays. */
  try {
    if (!localStorage.getItem(MOVED_KEY)) {
      localStorage.setItem(MOVED_KEY, "1");
      const dark = localStorage.getItem(KEY);
      if (dark === "2" || dark === "horizonte" || dark === "prisma") localStorage.setItem(KEY, DEFAULT);
      const light = localStorage.getItem(LIGHT_KEY);
      if (light === "aurora-clara" || light === "horizonte-claro" || light === "prisma-claro") localStorage.setItem(LIGHT_KEY, LIGHT_DEFAULT);
    }
  } catch {
    /* Read as they are. */
  }
  /* Once: the list was trimmed to two groups; whoever wore one that left it moves to the
     nearest one still offered. */
  try {
    if (!localStorage.getItem(TRIMMED_KEY)) {
      localStorage.setItem(TRIMMED_KEY, "1");
      const dark = localStorage.getItem(KEY);
      const near = dark ? DARK_NEAREST[dark] : undefined;
      if (near) localStorage.setItem(KEY, near);
      const light = localStorage.getItem(LIGHT_KEY);
      const nearLight = light ? LIGHT_NEAREST[light] : undefined;
      if (nearLight) localStorage.setItem(LIGHT_KEY, nearLight);
    }
  } catch {
    /* Read as they are. */
  }
  /* Once: Índigo became the default in the dark (2026-11-21); whoever was still on the old
     default, Willo, moves to it. A background chosen on purpose stays. */
  try {
    if (!localStorage.getItem(INDIGO_KEY)) {
      localStorage.setItem(INDIGO_KEY, "1");
      const dark = localStorage.getItem(KEY);
      if (!dark || dark === "willo") localStorage.setItem(KEY, DEFAULT);
    }
  } catch {
    /* Read as they are. */
  }
  current = readModel();
  photo = readPhoto();
  settle();
  listeners.forEach((l) => l());
});

export function setSkyModel(next: SkyModel) {
  if (next === "custom" && !photo) return;
  current = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* Kept for this session only. */
  }
  listeners.forEach((l) => l());
}

/** Keeps a new photo (already saved in the documents folder) and wears it. */
export function setSkyPhoto(fileName: string, wear = true) {
  const previous = (() => {
    try {
      return localStorage.getItem(PHOTO_KEY);
    } catch {
      return null;
    }
  })();
  try {
    localStorage.setItem(PHOTO_KEY, fileName);
  } catch {
    /* Kept for this session only. */
  }
  photo = new File(Paths.document, fileName).uri;
  /* The photo it replaces is no longer reachable from anywhere. */
  if (previous && previous !== fileName) {
    try {
      const old = new File(Paths.document, previous);
      if (old.exists) old.delete();
    } catch {
      /* Left behind; harmless. */
    }
  }
  if (wear) setSkyModel("custom");
  else listeners.forEach((l) => l());
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

/** The custom photo's address on this phone, if there is one. */
export function useSkyPhoto() {
  return useSyncExternalStore(subscribe, () => photo, () => photo);
}

/* ── The light theme's background, kept apart so each theme keeps its own ───── */

export type LightSkyModel = LightBackdropKey | "custom";

const readLight = (): LightSkyModel => {
  try {
    const v = localStorage.getItem(LIGHT_KEY);
    return v === "custom" || LIGHT_BACKDROP_KEYS.includes(v as LightBackdropKey) ? (v as LightSkyModel) : LIGHT_DEFAULT;
  } catch {
    return LIGHT_DEFAULT;
  }
};
let currentLight: LightSkyModel = readLight();
onHydrated(() => {
  currentLight = readLight();
  if (currentLight === "custom" && !photo) currentLight = LIGHT_DEFAULT;
  listeners.forEach((l) => l());
});

export function setLightSkyModel(next: LightSkyModel) {
  if (next === "custom" && !photo) return;
  currentLight = next;
  try {
    localStorage.setItem(LIGHT_KEY, next);
  } catch {
    /* Kept for this session only. */
  }
  listeners.forEach((l) => l());
}

export function useLightSkyModel() {
  const model = useSyncExternalStore(subscribe, () => currentLight, () => currentLight);
  return [model, setLightSkyModel] as const;
}

/* ── How the person's own photo is worn ───────────────────────────────────────
   Always blurred, under a veil of a set strength (see Room). Only the light theme
   asks one thing: whether that veil is light or dark. The amount and blur kept here
   are what earlier versions stored; Room no longer reads them. */

/** The dark theme's three strengths of veil over a photo. */
export const VEIL_STEPS = [
  { key: "suave", label: "Suave", amount: 0.36 },
  { key: "media", label: "Média", amount: 0.5 },
  { key: "forte", label: "Forte", amount: 0.66 },
] as const;

/** The step nearest a stored strength. */
export function nearestStep(amount: number) {
  let best = 1;
  VEIL_STEPS.forEach((s, i) => {
    if (Math.abs(s.amount - amount) < Math.abs(VEIL_STEPS[best].amount - amount)) best = i;
  });
  return best;
}

export interface PhotoLook {
  tone: "light" | "dark";
  /** How strong the veil is, 0 to 0.85. */
  amount: number;
  blur: boolean;
}

const LOOK_KEY = (mode: "dark" | "light") => `sky-photo-look-${mode}`;
const DEFAULT_LOOK: Record<"dark" | "light", PhotoLook> = {
  dark: { tone: "dark", amount: 0.5, blur: false },
  light: { tone: "light", amount: 0.5, blur: false },
};

const readLook = (mode: "dark" | "light"): PhotoLook => {
  try {
    const raw = localStorage.getItem(LOOK_KEY(mode));
    if (raw) {
      const v = JSON.parse(raw) as Partial<PhotoLook>;
      return {
        tone: v.tone === "light" || v.tone === "dark" ? v.tone : DEFAULT_LOOK[mode].tone,
        amount: typeof v.amount === "number" ? Math.min(0.85, Math.max(0, v.amount)) : DEFAULT_LOOK[mode].amount,
        blur: !!v.blur,
      };
    }
    /* The earlier on/off blur, carried over. */
    return { ...DEFAULT_LOOK[mode], blur: localStorage.getItem("sky-photo-blur") === "1" };
  } catch {
    return DEFAULT_LOOK[mode];
  }
};
const looks = { dark: readLook("dark"), light: readLook("light") };
onHydrated(() => {
  looks.dark = readLook("dark");
  looks.light = readLook("light");
  listeners.forEach((l) => l());
});

export function setPhotoLook(mode: "dark" | "light", next: PhotoLook) {
  looks[mode] = next;
  try {
    localStorage.setItem(LOOK_KEY(mode), JSON.stringify(next));
  } catch {
    /* Kept for this session only. */
  }
  listeners.forEach((l) => l());
}

export function usePhotoLook(mode: "dark" | "light") {
  return useSyncExternalStore(subscribe, () => looks[mode], () => looks[mode]);
}

/** The address of a photo in the documents folder, by its file name. */
export function photoUri(fileName: string) {
  return new File(Paths.document, fileName).uri;
}

/** Throws away a photo that was picked and then not used. */
export function discardPhoto(fileName: string) {
  try {
    const f = new File(Paths.document, fileName);
    if (f.exists) f.delete();
  } catch {
    /* Left behind; harmless. */
  }
}
