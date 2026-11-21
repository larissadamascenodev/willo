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

export type BackdropKey = "prisma" | "horizonte" | "aurora" | "oceano" | "ametista" | "brasa" | "grafite" | "meia-noite";

export interface Backdrop {
  label: string;
  ground: string;
  lights: { cx: number; cy: number; rx: number; ry: number; rgb: string; a: number; fade?: number }[];
  /** A field of faint stars across the top. */
  stars?: boolean;
  /** A smooth top-to-bottom wash under the lights: colours and where each sits (0 to 1). */
  wash?: { colors: string[]; stops: number[] };
  /** How hard the corners close (0 to 1); 0.55 when not said. */
  edge?: number;
}

export const BACKDROPS: Record<BackdropKey, Backdrop> = {
  /* The default: the petrol of Horizonte washing down from the top, and in it the Willo
     icon's colours as soft lights — violet pooled to the right, a little orange high in the
     right corner, teal across the middle. Broad and faint, so they melt into the petrol and
     into the dark well above the cards, and the glass of the buttons has colour to bend. */
  prisma: {
    label: "Willo",
    ground: "#07090A",
    edge: 0.3,
    wash: {
      colors: ["#2B5560", "#1F434D", "#15313B", "#0D1D24", "#090F12", "#07090A"],
      stops: [0, 0.14, 0.28, 0.42, 0.56, 0.7],
    },
    lights: [
      { cx: 0.2, cy: -0.06, rx: 0.9, ry: 0.32, rgb: "150,192,198", a: 0.22 },
      { cx: 0.84, cy: 0.27, rx: 0.62, ry: 0.24, rgb: "124,58,237", a: 0.52 },
      { cx: 0.98, cy: 0.1, rx: 0.42, ry: 0.2, rgb: "249,115,22", a: 0.36 },
      { cx: 0.55, cy: 0.2, rx: 0.55, ry: 0.2, rgb: "45,212,191", a: 0.22 },
    ],
  },
  horizonte: {
    label: "Horizonte",
    ground: "#07090A",
    edge: 0.3,
    wash: {
      colors: ["#2F5A62", "#21454D", "#14303A", "#0C1C22", "#08100F", "#07090A"],
      stops: [0, 0.14, 0.28, 0.42, 0.56, 0.7],
    },
    lights: [
      { cx: 0.5, cy: -0.06, rx: 1.0, ry: 0.32, rgb: "150,192,198", a: 0.26 },
      { cx: 0.04, cy: 0.12, rx: 0.62, ry: 0.3, rgb: "70,150,138", a: 0.2 },
      { cx: 0.96, cy: 0.08, rx: 0.6, ry: 0.3, rgb: "56,96,140", a: 0.22 },
    ],
  },
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

/**
 * The light theme's backgrounds. The pale ground alone gives the glass nothing to
 * bend, so these carry soft colour near the top — pastel washes over a light ground —
 * for the bars and buttons to pick up as the page scrolls under them, fading to near
 * white where the cards and figures are.
 */
export type LightBackdropKey = "prisma-claro" | "horizonte-claro" | "nevoa" | "aurora-clara" | "ceu-claro" | "lavanda" | "pessego" | "areia" | "perola";

export const LIGHT_BACKDROPS: Record<LightBackdropKey, Backdrop> = {
  /* The default in the light: Horizonte's petrol washed pale, with the icon's colours as
     pastel lights — lavender to the right, peach in the corner, mint across the middle. */
  "prisma-claro": {
    label: "Willo",
    ground: "#F3F5F6",
    wash: {
      colors: ["#C9DDE0", "#D8E7E9", "#E7EFF0", "#F3F5F6"],
      stops: [0, 0.18, 0.36, 0.55],
    },
    lights: [
      { cx: 0.2, cy: -0.06, rx: 0.9, ry: 0.3, rgb: "255,255,255", a: 0.5 },
      { cx: 0.84, cy: 0.27, rx: 0.62, ry: 0.24, rgb: "196,181,253", a: 0.5 },
      { cx: 0.98, cy: 0.1, rx: 0.42, ry: 0.2, rgb: "253,186,116", a: 0.42 },
      { cx: 0.55, cy: 0.2, rx: 0.55, ry: 0.2, rgb: "153,246,228", a: 0.35 },
    ],
  },
  /* The default in the light: the same petrol, washed pale, fading to the light ground. */
  "horizonte-claro": {
    label: "Horizonte",
    ground: "#F3F5F6",
    wash: {
      colors: ["#C9DDE0", "#D8E7E9", "#E7EFF0", "#F3F5F6"],
      stops: [0, 0.18, 0.36, 0.55],
    },
    lights: [
      { cx: 0.5, cy: -0.06, rx: 1.0, ry: 0.3, rgb: "255,255,255", a: 0.55 },
      { cx: 0.05, cy: 0.12, rx: 0.6, ry: 0.3, rgb: "150,205,195", a: 0.3 },
      { cx: 0.95, cy: 0.1, rx: 0.6, ry: 0.3, rgb: "160,190,225", a: 0.28 },
    ],
  },
  nevoa: {
    label: "Névoa",
    ground: "#F5F5F7",
    lights: [
      { cx: 0.5, cy: -0.05, rx: 1.0, ry: 0.5, rgb: "255,255,255", a: 1 },
      { cx: 0.85, cy: 0.08, rx: 0.7, ry: 0.32, rgb: "170,190,235", a: 0.22 },
    ],
  },
  "aurora-clara": {
    label: "Aurora",
    ground: "#F1F2F8",
    lights: [
      { cx: 0.15, cy: -0.02, rx: 1.0, ry: 0.5, rgb: "140,160,255", a: 0.55 },
      { cx: 0.9, cy: 0.05, rx: 0.9, ry: 0.45, rgb: "196,160,255", a: 0.5 },
      { cx: 0.5, cy: 0.3, rx: 0.9, ry: 0.3, rgb: "130,210,240", a: 0.25 },
    ],
  },
  "ceu-claro": {
    label: "Céu",
    ground: "#EEF3FA",
    lights: [
      { cx: 0.5, cy: -0.08, rx: 1.2, ry: 0.6, rgb: "110,170,250", a: 0.6 },
      { cx: 0.1, cy: 0.25, rx: 0.7, ry: 0.35, rgb: "160,215,250", a: 0.35 },
      { cx: 0.9, cy: 0.35, rx: 0.6, ry: 0.3, rgb: "255,255,255", a: 0.6 },
    ],
  },
  lavanda: {
    label: "Lavanda",
    ground: "#F3F0F8",
    lights: [
      { cx: 0.5, cy: -0.05, rx: 1.1, ry: 0.55, rgb: "170,140,240", a: 0.55 },
      { cx: 0.05, cy: 0.2, rx: 0.7, ry: 0.35, rgb: "240,170,225", a: 0.4 },
      { cx: 0.95, cy: 0.22, rx: 0.6, ry: 0.35, rgb: "150,150,245", a: 0.35 },
    ],
  },
  pessego: {
    label: "Pêssego",
    ground: "#FBF3EE",
    lights: [
      { cx: 0.5, cy: -0.05, rx: 1.1, ry: 0.52, rgb: "255,160,120", a: 0.5 },
      { cx: 0.1, cy: 0.12, rx: 0.7, ry: 0.32, rgb: "255,205,150", a: 0.45 },
      { cx: 0.9, cy: 0.2, rx: 0.6, ry: 0.32, rgb: "250,150,170", a: 0.35 },
    ],
  },
  areia: {
    label: "Areia",
    ground: "#F6F2EA",
    lights: [
      { cx: 0.5, cy: -0.05, rx: 1.2, ry: 0.55, rgb: "230,196,140", a: 0.5 },
      { cx: 0.85, cy: 0.18, rx: 0.6, ry: 0.3, rgb: "245,220,180", a: 0.45 },
    ],
  },
  perola: {
    label: "Pérola",
    ground: "#EEEFF2",
    lights: [
      { cx: 0.5, cy: -0.05, rx: 1.2, ry: 0.6, rgb: "176,186,206", a: 0.55 },
      { cx: 0.2, cy: 0.3, rx: 0.6, ry: 0.3, rgb: "255,255,255", a: 0.7 },
    ],
  },
};

export const LIGHT_BACKDROP_KEYS = Object.keys(LIGHT_BACKDROPS) as LightBackdropKey[];
