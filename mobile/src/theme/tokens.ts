/**
 * The app's ground and ink, as plain values.
 *
 * Tailwind classes cover most of what a screen needs, but a navigator's background,
 * a status bar and a blur tint are set in JavaScript, so the few colours that are
 * asked for in more than one place live here rather than being typed out again.
 */

/** The room with the lights down — the ground on every screen but three. */
export const GROUND = "#08090A";
/** The room — the home, the wallet and the accounts screen. */
export const GROUND_LIT = "#0D0E10";

export const GREEN = "#C8F36D";
export const AMBER = "#F9CE4E";
export const RED = "#F87171";

/** White at the steps the web app calls t-soft, t-softer and t-faint. */
export const INK = {
  full: "#FFFFFF",
  soft: "rgba(255,255,255,0.66)",
  softer: "rgba(255,255,255,0.50)",
  faint: "rgba(255,255,255,0.30)",
  hairline: "rgba(255,255,255,0.055)",
  edge: "rgba(255,255,255,0.08)",
} as const;
