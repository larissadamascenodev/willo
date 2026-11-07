import { useSyncExternalStore } from "react";
import { Dimensions } from "react-native";
import { captureScreen } from "react-native-view-shot";
import { onHydrated } from "~/lib/shims";

/**
 * Dark or light, inside the app.
 *
 * Willo was drawn for the dark: white ink at a few strengths, white glass, near-black
 * grounds. Rather than keep a second copy of every screen, each colour a screen draws
 * goes through `th()`, which in the dark hands it back untouched and in the light
 * turns it into its counterpart:
 *
 * - white ink becomes near-black ink at the same strength, and the dark ink on the
 *   white pills becomes white, so a pill inverts as a whole;
 * - white fills (glass, chips, cards) become dark fills at about the same weight, and
 *   the near-black grounds and sheets become the light ground;
 * - colours that read on black but vanish on white — the oranges, ambers, the green —
 *   are darkened, keeping their hue, until they stand out on the light ground;
 * - pure black stays black: shadows and the veil behind a sheet are dark in both.
 *
 * Every green in the app, in both themes, is the one green: the iPhone switch's,
 * #67CD67, the colour of Pago and Recebido.
 *
 * The welcome, sign-in and sign-up are always dark: the choice is made inside the app,
 * so the theme is only ever light while someone is signed in (see the door in
 * app/_layout). The screens are drawn again from scratch when it changes.
 */

export type ThemeMode = "dark" | "light";
export type Role = "fg" | "bg" | "line" | "grad" | "tint";

export const WILLO_GREEN = "#67CD67";
export const LIGHT_GROUND = "#F5F5F7";
const LIGHT_SHEET = [250, 250, 251];
const INK = [17, 19, 24];

/* ── The person's choice, kept on the phone ─────────────────────────────────── */

const KEY = "theme";
const listeners = new Set<() => void>();
const readPref = (): ThemeMode => {
  try {
    return localStorage.getItem(KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
};
let pref: ThemeMode = readPref();
onHydrated(() => {
  pref = readPref();
  listeners.forEach((l) => l());
});

export function setThemePref(next: ThemeMode) {
  pref = next;
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

/* Where to put the person back after the screens are drawn again for a new theme. */
let returnRoute: string | null = null;

/*
 * The change itself, at the touch: a circle in the new theme's ground is born under the
 * finger and grows until it covers the screen; the screens are drawn again in the new
 * theme under it; and it clears off them. Nothing is photographed or waited for, so it
 * starts the instant the theme is tapped, and it happens every time.
 */
export interface ThemeCover {
  to: ThemeMode;
  x: number;
  y: number;
}
let cover: ThemeCover | null = null;
const coverListeners = new Set<() => void>();
const setCover = (next: ThemeCover | null) => {
  cover = next;
  coverListeners.forEach((l) => l());
};
export function useThemeCover() {
  return useSyncExternalStore(
    (l) => {
      coverListeners.add(l);
      return () => {
        coverListeners.delete(l);
      };
    },
    () => cover,
    () => cover,
  );
}
export const liftThemeCover = () => setCover(null);

/** How long the circle takes to cover the screen. */
export const COVER_GROW_MS = 380;

/*
 * The better change, when it can be had: a photograph of the screen taken beforehand,
 * while the person is only looking at it (prepareThemeShot), so it is ready at the touch.
 * At the touch the photograph is laid over the screen — identical to it — the theme
 * changes underneath, and a circle opens in the photograph from the finger, showing
 * the new theme inside it until it has all of it. No flat colour at any moment.
 */
interface Shot {
  /** The last one taken, perhaps still loading. */
  uri: string | null;
  /** The last one known to be on screen-ready, used at the touch. */
  ready: string | null;
}
let shot: Shot = { uri: null, ready: null };
let reveal: { x: number; y: number } | null = null;
const shotListeners = new Set<() => void>();
const emitShot = () => shotListeners.forEach((l) => l());
const subscribeShot = (l: () => void) => {
  shotListeners.add(l);
  return () => {
    shotListeners.delete(l);
  };
};
export function useThemeShot() {
  return useSyncExternalStore(subscribeShot, () => shot, () => shot);
}
export function useThemeReveal() {
  return useSyncExternalStore(subscribeShot, () => reveal, () => reveal);
}
/** The photograph has loaded: it may be used at the next touch. */
export const markShotReady = (uri: string) => {
  if (shot.uri !== uri) return;
  const waiting = readyWaiters;
  readyWaiters = [];
  setTimeout(() => waiting.forEach((w) => w()), 0);
  shot = { ...shot, ready: uri };
  emitShot();
};
/** The reveal is over: the photograph, now of the old theme, is thrown away. */
export const endThemeReveal = () => {
  reveal = null;
  shot = { uri: null, ready: null };
  emitShot();
  /* The next photograph at once, so a change straight back has its effect too. */
  setTimeout(() => void prepareThemeShot(), 150);
};

/* Waiting for a photograph to be on screen-ready, for a change tapped while it loads. */
let readyWaiters: (() => void)[] = [];
let taking: Promise<void> | null = null;

/** Photographs the screen as it is now, for the next change of theme. */
export function prepareThemeShot(): Promise<void> {
  if (taking) return taking;
  if (reveal || cover) return Promise.resolve();
  taking = (async () => {
    try {
      const uri = await captureScreen({ format: "jpg", quality: 0.85, result: "tmpfile", width: Math.round(Dimensions.get("window").width * 2) });
      if (!reveal && !cover) {
        shot = { ...shot, uri };
        emitShot();
      }
    } catch {
      /* No photograph: the circle of colour does the change instead. */
    } finally {
      taking = null;
    }
  })();
  return taking;
}

/** Resolves once a photograph is ready, or after `ms` without one. */
const whenReady = (ms: number) =>
  new Promise<void>((resolve) => {
    if (shot.ready) return resolve();
    readyWaiters.push(resolve);
    setTimeout(resolve, ms);
  });

let changing = false;

/** Changes the theme from a screen, coming back to `route` once it is drawn again. */
export async function switchTheme(next: ThemeMode, route: string, from?: { x: number; y: number }, tries = 0): Promise<void> {
  if (next === pref) return;
  /* Tapped while a change is still running: it waits for that one to finish and then
     runs, with its own effect, instead of being lost. */
  if (cover || reveal || changing) {
    if (tries > 30) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
    return switchTheme(next, route, from, tries + 1);
  }
  changing = true;
  const { width, height } = Dimensions.get("window");
  const at = { x: from?.x ?? width / 2, y: from?.y ?? height * 0.4 };
  /* Tapped before the photograph was ready (changing back and forth quickly): take it
     now and wait for it — a tenth of a second — rather than change without the effect. */
  if (!shot.ready) {
    await prepareThemeShot();
    await whenReady(450);
  }
  changing = false;
  if (shot.ready) {
    /* The photograph goes over the screen and the theme changes under it, in one go. */
    reveal = at;
    emitShot();
    returnRoute = route;
    setThemePref(next);
    return;
  }
  setCover({ to: next, x: at.x, y: at.y });
  /* The screens are drawn again once the circle has covered them. */
  setTimeout(() => {
    returnRoute = route;
    setThemePref(next);
  }, COVER_GROW_MS);
}

export function takeReturnRoute() {
  const r = returnRoute;
  returnRoute = null;
  return r;
}

/**
 * Called at the top of every screen: when the theme changes, the screen is drawn again
 * where it stands — same state, same data, same scroll — and every colour read with
 * th() comes out in the new theme. Nothing is torn down and built again, so the change
 * takes a moment rather than the time to load every screen afresh.
 */
export function useThemeRedraw() {
  useSyncExternalStore(subscribe, () => pref, () => pref);
}

export function useThemePref() {
  const value = useSyncExternalStore(subscribe, () => pref, () => pref);
  return [value, setThemePref] as const;
}

/* ── What is being drawn right now ──────────────────────────────────────────── */

let active: ThemeMode = "dark";
const cache = new Map<string, string>();
/* What th() has already turned into, so a colour passed through twice — a component
   handing its colour to another that also asks — is not turned back. */
const made = new Set<string>();

/** Set by the door before it draws: light only while someone is signed in. */
export function setActiveTheme(mode: ThemeMode) {
  if (mode === active) return;
  active = mode;
  cache.clear();
  made.clear();
}

export function activeTheme(): ThemeMode {
  return active;
}

export const isLight = () => active === "light";

/* ── Colours ────────────────────────────────────────────────────────────────── */

type RGBA = { r: number; g: number; b: number; a: number };

function parse(input: string): RGBA | null {
  const s = input.trim().toLowerCase();
  if (s === "white") return { r: 255, g: 255, b: 255, a: 1 };
  if (s === "black") return { r: 0, g: 0, b: 0, a: 1 };
  if (s[0] === "#") {
    let h = s.slice(1);
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
    if (h.length !== 6 && h.length !== 8) return null;
    const n = parseInt(h.slice(0, 6), 16);
    if (Number.isNaN(n)) return null;
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1 };
  }
  /* Both ways of writing it: rgba(1, 2, 3, 0.5) and the newer rgb(1 2 3 / 0.5),
     which the card colours use. */
  const m = s.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[,/]\s*([\d.]+)(%?)\s*)?\)$/);
  if (!m) return null;
  const alpha = m[4] === undefined ? 1 : m[5] ? +m[4] / 100 : +m[4];
  return { r: +m[1], g: +m[2], b: +m[3], a: alpha };
}

/* Always four decimals of alpha: no colour written by hand looks like this, so what
   th() made can never be mistaken for a colour it still has to turn. */
const out = (c: RGBA) => `rgba(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)},${Math.min(1, Math.max(0, c.a)).toFixed(4)})`;

function hsl({ r, g, b }: RGBA) {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  h *= 60;
  return { h, s, l };
}

function fromHsl(h: number, s: number, l: number, a: number): RGBA {
  const k = (n: number) => (n + h / 30) % 12;
  const q = s * Math.min(l, 1 - l);
  const f = (n: number) => l - q * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return { r: f(0) * 255, g: f(8) * 255, b: f(4) * 255, a };
}

function luminance({ r, g, b }: RGBA) {
  const ch = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

const GROUND_LUM = luminance({ r: 245, g: 245, b: 247, a: 1 });
const contrast = (c: RGBA) => (GROUND_LUM + 0.05) / (luminance(c) + 0.05);

const isGreen = (c: RGBA) => {
  const { h, s, l } = hsl(c);
  return h >= 75 && h <= 160 && s >= 0.35 && l > 0.2 && l < 0.85;
};

/** Darkens a colour, keeping its hue, until it reads on the light ground. */
function legible(c: RGBA, target: number): RGBA {
  const { h: hue, s, l } = hsl(c);
  /* Yellow darkened as it is turns olive; it is turned a step towards orange instead,
     so a pending amber stays amber on white. */
  const h = hue >= 38 && hue <= 62 ? 34 : hue;
  let L = l;
  let next = c;
  while (contrast(next) < target && L > 0.12) {
    L -= 0.02;
    next = fromHsl(h, Math.min(1, s * 1.02), L, c.a);
  }
  return next;
}

function toLight(c: RGBA, role: Role): RGBA {
  const { s } = hsl(c);
  const min = Math.min(c.r, c.g, c.b);
  const max = Math.max(c.r, c.g, c.b);
  const white = min >= 225 && s < 0.25;
  const pureBlack = max === 0;
  const dark = max <= 48;
  const grey = s < 0.18;

  if (role === "grad") {
    if (dark && !pureBlack) return { r: 245, g: 245, b: 247, a: c.a };
    return c;
  }

  if (role === "fg") {
    if (white) return { r: INK[0], g: INK[1], b: INK[2], a: Math.min(1, c.a * 1.06) };
    if (dark) return { r: 255, g: 255, b: 255, a: c.a };
    if (grey) {
      const v = 255 - (c.r + c.g + c.b) / 3;
      return { r: v * 0.92, g: v * 0.93, b: v * 0.96, a: c.a };
    }
    return legible(c, 3.4);
  }

  if (role === "line") {
    if (white) return { r: INK[0], g: INK[1], b: INK[2], a: Math.min(1, c.a * 0.9 + 0.02) };
    if (dark) return c;
    if (grey) return { r: INK[0], g: INK[1], b: INK[2], a: 0.14 * c.a };
    return legible(c, 2.4);
  }

  // bg
  if (white) {
    /* Solid white is the inverted pill; a whisper of white is glass, a chip or a card. */
    if (c.a >= 0.75) return { r: 21, g: 23, b: 28, a: c.a };
    return { r: INK[0], g: INK[1], b: INK[2], a: Math.min(0.3, c.a * 0.8) };
  }
  if (pureBlack) return { r: 0, g: 0, b: 0, a: c.a * 0.55 };
  if (dark) return { r: LIGHT_SHEET[0], g: LIGHT_SHEET[1], b: LIGHT_SHEET[2], a: c.a };
  if (grey) {
    const v = 255 - (c.r + c.g + c.b) / 3;
    return { r: v, g: v, b: v + 2, a: c.a };
  }
  /* Tinted chips need a little more of their colour to show on white. */
  if (c.a < 0.5) return { ...legible(c, 2), a: Math.min(1, c.a * 1.35) };
  return c;
}

const GREEN_RGB = parse(WILLO_GREEN)!;

/**
 * The colour to draw, for the theme on screen. `role` is what the colour is for: ink
 * and icons ("fg", the default), a fill ("bg"), a border or rule ("line"), a gradient
 * stop ("grad"), or a blur's tint ("tint").
 */
export function th<T>(color: T, role: Role = "fg"): T {
  return thIn(active, color, role);
}

/** The same, for a given theme rather than the one on screen: text on a background
    photo follows the photo's veil, not the app's theme. */
export function thIn<T>(mode: ThemeMode, color: T, role: Role = "fg"): T {
  if (Array.isArray(color)) return color.map((c) => thIn(mode, c, role)) as T;
  if (typeof color !== "string") return color;
  if (role === "tint") {
    if (mode !== "light") return color;
    return (color === "dark" ? "light" : color.replace("Dark", "Light")) as T;
  }
  const key = mode + role + color;
  const hit = cache.get(key);
  if (hit !== undefined) return hit as T;
  if (made.has(color)) return color;

  let result = color as string;
  const c = parse(color);
  if (c) {
    let next = c;
    if (isGreen(c)) next = { ...GREEN_RGB, a: c.a };
    if (mode === "light") next = toLight(next, role);
    result = next === c ? color : out(next);
    /* Only what was actually turned is marked as made: a colour left as it was (a
       white gradient stop, say) must still be turned where it is used as ink or fill. */
    if (mode === "light" && result !== color) made.add(result);
  }
  cache.set(key, result);
  return result as T;
}

/**
 * A style written once at the top of a file, whose colours are read when a screen
 * draws rather than when the file loads, so it follows the theme like the rest.
 */
export function live<T extends object>(style: T): T {
  const out = {} as T;
  for (const key of Object.keys(style)) {
    const value = (style as Record<string, unknown>)[key];
    Object.defineProperty(out, key, {
      enumerable: true,
      configurable: true,
      get: () => {
        if (typeof value !== "string" || !/Color$|^color$/.test(key)) return value;
        if (key === "color" || key === "tintColor") return th(value);
        return th(value, key === "backgroundColor" ? "bg" : "line");
      },
    });
  }
  return out;
}
