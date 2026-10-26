import { shade, withAlpha } from "@/lib/tone";

/**
 * A category's colour, as two values React Native can actually read.
 *
 * The shared `chipFill` and `chipInk` answer in `color-mix()` over CSS variables,
 * because on the web the two numbers are theme variables — the disc fills harder and
 * the glyph darkens when the lights come on. None of that survives here: a native
 * style sheet has no variables and no color-mix, so the colour simply disappeared and
 * every category disc came out invisible, leaving its glyph floating in a gap.
 *
 * The app is dark, so these are the dark half of that pair, resolved to plain rgb.
 */

/*
 * The shared helpers write colours the modern way, rgb(r g b / a). The phone reads
 * that; the browser build of the app does not, and silently paints nothing — which
 * is how every category disc came out transparent in the preview while looking
 * right on the phone. Written with commas, both read it the same.
 */
const withCommas = (css: string) => {
  const m = css.match(/rgba?\((\d+)[\s,]+(\d+)[\s,]+(\d+)(?:\s*[/,]\s*([\d.]+))?\)/);
  if (!m) return css;
  return m[4] !== undefined ? `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${m[4]})` : `rgb(${m[1]}, ${m[2]}, ${m[3]})`;
};

/** The soft disc behind a category glyph. */
export const chipFill = (hex: string) => withCommas(withAlpha(hex, 0.12));

/** The glyph itself, at full strength on a dark ground. */
export const chipInk = (hex: string) => withCommas(shade(hex, 0));
