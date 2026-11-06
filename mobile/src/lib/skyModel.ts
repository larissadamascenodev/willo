import { useSyncExternalStore } from "react";
import { File, Paths } from "expo-file-system";
import { onHydrated } from "~/lib/shims";
import { BACKDROP_KEYS, LIGHT_BACKDROP_KEYS, type BackdropKey, type LightBackdropKey } from "~/lib/backdrops";

/**
 * What the screens that wear a sky are wearing.
 *
 * - "2", the default: the hour as a picture, with the glow turned down so cards pass
 *   over it quietly.
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
const PHOTO_KEY = "sky-photo";
const listeners = new Set<() => void>();

const readModel = (): SkyModel => {
  try {
    const v = localStorage.getItem(KEY);
    return v === "1" || v === "plain" || v === "custom" || BACKDROP_KEYS.includes(v as BackdropKey) ? (v as SkyModel) : "2";
  } catch {
    return "2";
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
  if (current === "custom" && !photo) current = "2";
};
settle();

onHydrated(() => {
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
const LIGHT_KEY = "sky-model-light";
const readLight = (): LightSkyModel => {
  try {
    const v = localStorage.getItem(LIGHT_KEY);
    return v === "custom" || LIGHT_BACKDROP_KEYS.includes(v as LightBackdropKey) ? (v as LightSkyModel) : "aurora-clara";
  } catch {
    return "aurora-clara";
  }
};
let currentLight: LightSkyModel = readLight();
onHydrated(() => {
  currentLight = readLight();
  if (currentLight === "custom" && !photo) currentLight = "aurora-clara";
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

/* ── Blurring the person's own photo ───────────────────────────────────────────
   A photo can be busy under the cards; the person can soften it. Only a photo of
   their own offers this — the backgrounds that come with the app are already soft. */

const BLUR_KEY = "sky-photo-blur";
const readBlur = () => {
  try {
    return localStorage.getItem(BLUR_KEY) === "1";
  } catch {
    return false;
  }
};
let blurred = readBlur();
onHydrated(() => {
  blurred = readBlur();
  listeners.forEach((l) => l());
});

export function setSkyPhotoBlur(next: boolean) {
  blurred = next;
  try {
    localStorage.setItem(BLUR_KEY, next ? "1" : "0");
  } catch {
    /* Kept for this session only. */
  }
  listeners.forEach((l) => l());
}

export function useSkyPhotoBlur() {
  const value = useSyncExternalStore(subscribe, () => blurred, () => blurred);
  return [value, setSkyPhotoBlur] as const;
}
