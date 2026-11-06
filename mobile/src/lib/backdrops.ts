/**
 * The drawn backgrounds, beside the sky, the plain room and a person's own photo.
 *
 * Each is a near-black ground with a few broad coloured lights pooled near the top —
 * the same build as the room's lights, only in colour — so the upper part of the
 * screen has a mood and the lower part, where the cards and figures are, stays dark
 * enough for white text. Each light is broad and fades all the way to its rim, so
 * they blend into one glow rather than sitting as spots. Coordinates are fractions
 * of the screen; `a` is the light's strength at its centre.
 */

export type BackdropKey = "aurora" | "oceano" | "ametista" | "brasa" | "grafite" | "meia-noite";

export interface Backdrop {
  label: string;
  ground: string;
  lights: { cx: number; cy: number; rx: number; ry: number; rgb: string; a: number; fade?: number }[];
  /** A field of faint stars across the top. */
  stars?: boolean;
}

export const BACKDROPS: Record<BackdropKey, Backdrop> = {
  aurora: {
    label: "Aurora",
    ground: "#05060C",
    lights: [
      { cx: 0.15, cy: -0.02, rx: 1.0, ry: 0.5, rgb: "80,110,255", a: 0.87 },
      { cx: 0.9, cy: 0.05, rx: 0.9, ry: 0.45, rgb: "160,90,255", a: 0.72 },
      { cx: 0.5, cy: 0.28, rx: 0.9, ry: 0.3, rgb: "50,160,230", a: 0.26 },
    ],
  },
  oceano: {
    label: "Oceano",
    ground: "#03070B",
    lights: [
      { cx: 0.5, cy: -0.05, rx: 1.1, ry: 0.55, rgb: "20,100,180", a: 0.95 },
      { cx: 0.1, cy: 0.25, rx: 0.7, ry: 0.35, rgb: "30,150,190", a: 0.41 },
      { cx: 0.95, cy: 0.2, rx: 0.6, ry: 0.35, rgb: "70,90,220", a: 0.43 },
    ],
  },
  ametista: {
    label: "Ametista",
    ground: "#07050B",
    lights: [
      { cx: 0.5, cy: -0.04, rx: 1.1, ry: 0.55, rgb: "130,76,230", a: 0.9 },
      { cx: 0.05, cy: 0.18, rx: 0.7, ry: 0.35, rgb: "210,96,200", a: 0.43 },
      { cx: 0.95, cy: 0.2, rx: 0.6, ry: 0.35, rgb: "96,66,214", a: 0.49 },
    ],
  },
  brasa: {
    label: "Brasa",
    ground: "#0A0605",
    lights: [
      { cx: 0.5, cy: -0.05, rx: 1.1, ry: 0.52, rgb: "255,112,52", a: 0.8 },
      { cx: 0.1, cy: 0.1, rx: 0.7, ry: 0.32, rgb: "255,170,90", a: 0.43 },
      { cx: 0.9, cy: 0.18, rx: 0.6, ry: 0.32, rgb: "210,62,62", a: 0.46 },
    ],
  },
  grafite: {
    label: "Grafite",
    ground: "#0B0C0E",
    lights: [
      { cx: 0.5, cy: -0.05, rx: 1.2, ry: 0.6, rgb: "200,208,224", a: 0.38 },
      { cx: 0.5, cy: 0.6, rx: 1.0, ry: 0.5, rgb: "140,150,170", a: 0.09 },
    ],
  },
  "meia-noite": {
    label: "Meia-noite",
    ground: "#04050A",
    stars: true,
    lights: [
      { cx: 0.5, cy: -0.05, rx: 1.2, ry: 0.55, rgb: "40,60,140", a: 0.94 },
      { cx: 0.85, cy: 0.12, rx: 0.6, ry: 0.3, rgb: "100,120,210", a: 0.29 },
    ],
  },
};

export const BACKDROP_KEYS = Object.keys(BACKDROPS) as BackdropKey[];

/* The same stars every time: a fixed little generator, not Math.random. */
export const STARS = (() => {
  let seed = 7;
  const next = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  return Array.from({ length: 70 }, () => {
    const y = Math.pow(next(), 1.6) * 0.55;
    return { x: next(), y, r: 0.5 + next() * 0.9, o: (0.25 + next() * 0.6) * (1 - y * 1.3) };
  });
})();
