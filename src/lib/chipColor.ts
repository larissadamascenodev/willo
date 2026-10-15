/**
 * A category's colour, worn on either ground.
 *
 * The palette was picked against black: bright hues at around 12% opacity for the
 * disc, full strength for the glyph. On paper the same two values collapse — a 12%
 * tint of anything is nearly the page, and a hue bright enough to glow in the dark is
 * washed out against white.
 *
 * So the two numbers become theme variables: the disc fills harder and the glyph
 * darkens. The hue itself never changes, because it is how the person recognises the
 * category at a glance, and that has to survive turning the lights on.
 */

/** The soft disc behind a category glyph. */
export const chipFill = (hex: string) =>
  `color-mix(in srgb, ${hex} var(--chip-fill), transparent)`;

/** The glyph itself, deepened on paper so it still reads as its own colour. */
export const chipInk = (hex: string) =>
  `color-mix(in srgb, ${hex}, #000 var(--chip-deepen))`;
