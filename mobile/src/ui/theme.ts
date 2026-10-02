/** As cores e fontes do Willo, as mesmas do site (src/index.css e tailwind.config.ts). */
export const colors = {
  ground: "#0A1220",
  black: "#0B0B0B",
  white: "#FFFFFF",
  green: "#C8F36D",
  red: "#F87171",
  amber: "#FCD34D",
  sky: "#7DD3FC",
} as const;

/** Branco com transparência: a escala de texto e de superfícies do site (text-white/62, bg-white/[0.06]…). */
export const white = (a: number) => `rgba(255,255,255,${a})`;

export const fonts = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extrabold: "Inter_800ExtraBold",
  displayBold: "PlusJakartaSans_700Bold",
  displayExtra: "PlusJakartaSans_800ExtraBold",
} as const;

export type Weight = "regular" | "medium" | "semibold" | "bold" | "extrabold";

export const radii = { card: 22, hero: 28, pill: 999 } as const;
