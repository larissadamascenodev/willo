import { Platform, type TextStyle } from "react-native";
import { INK } from "./tokens";
import { th } from "./theme";

/**
 * The handful of text shapes the app actually uses.
 *
 * The web says these as Tailwind classes — `text-[30px] font-extrabold tracking-
 * [-0.03em] tabular-nums` — and they repeat on nearly every card. Written once here
 * they stay the same across screens, which is the only reason the figures on two
 * different screens look like they belong to one app.
 */

/* Figures line up in columns, so their digits have to be the same width. */
const nums: TextStyle = Platform.select({
  ios: { fontVariant: ["tabular-nums"] },
  default: {},
}) as TextStyle;

const base = {
  /** The answer a screen leads with. */
  figure: { fontSize: 30, fontWeight: "800", letterSpacing: -0.9, color: "#fff", ...nums },
  /** The same, when the screen is only about that one number. */
  figureBig: { fontSize: 38, fontWeight: "800", letterSpacing: -1.3, color: "#fff", ...nums },
  /** What the figure is — sits above it, quiet. */
  cardLabel: { fontSize: 14, color: INK.soft },
  /** The small capitals that head a section. */
  eyebrow: {
    fontSize: 11.5,
    fontWeight: "600",
    letterSpacing: 1.3,
    textTransform: "uppercase",
    color: INK.softer,
  },
  /** A screen's own name. */
  title: { fontSize: 28, fontWeight: "800", letterSpacing: -0.8, color: "#fff" },
  /** A row's name. */
  rowName: { fontSize: 15, fontWeight: "500", color: "#fff" },
  /** A row's figure. */
  rowValue: { fontSize: 15, fontWeight: "600", color: "#fff", ...nums },
  /** What a row is under its name. */
  rowNote: { fontSize: 11.5, color: INK.softer },
  /** A sentence explaining the figure above it. */
  note: { fontSize: 12.5, color: INK.soft, lineHeight: 17 },
} satisfies Record<string, TextStyle>;

/* Read when a screen draws, so each shape carries the ink of the theme on screen. */
export const type = Object.fromEntries(
  Object.keys(base).map((k) => [k, undefined]),
) as unknown as typeof base;
for (const k of Object.keys(base) as (keyof typeof base)[]) {
  Object.defineProperty(type, k, {
    enumerable: true,
    get: () => {
      const style = base[k] as TextStyle;
      return style.color ? { ...style, color: th(style.color as string) } : style;
    },
  });
}
