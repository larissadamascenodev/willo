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

/** The soft disc behind a category glyph. */
export const chipFill = (hex: string) => withAlpha(hex, 0.12);

/** The glyph itself, at full strength on a dark ground. */
export const chipInk = (hex: string) => shade(hex, 0);
