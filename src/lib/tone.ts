/**
 * Colour arithmetic, shared by everything that wears a bank's colour.
 *
 * A card screen pairs one hue with itself — the colour for what is spent, a lighter
 * tone of it for what is left — because two tones of one hue agree with any bank,
 * which a second hue, however well chosen, does not.
 */

/** Reads #rgb, #rrggbb or rgb(r g b) into its three channels. */
function channels(color: string): [number, number, number] {
  const parsed = color.match(/rgba?\((\d+)[\s,]+(\d+)[\s,]+(\d+)/);
  if (parsed) return [Number(parsed[1]), Number(parsed[2]), Number(parsed[3])];
  const n = color.replace("#", "");
  const full = n.length === 3 ? n.split("").map((c) => c + c).join("") : n;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

/** Mixes a colour towards white (amount > 0) or black (amount < 0). */
export function shade(color: string, amount: number) {
  const to = amount < 0 ? 0 : 255;
  const t = Math.min(Math.abs(amount), 1);
  const [r, g, b] = channels(color).map((c) => Math.round(c + (to - c) * t));
  return `rgb(${r} ${g} ${b})`;
}

/** The same colour at a given opacity, whether it arrived as #hex or as rgb(). */
export function withAlpha(color: string, alpha: number) {
  const [r, g, b] = channels(color);
  return `rgb(${r} ${g} ${b} / ${alpha})`;
}

/** Ink that stays readable on a colour — some banks are yellow. */
export function inkOn(color: string) {
  const [r, g, b] = channels(color).map((c) => c / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.62 ? "#101014" : "#FFFFFF";
}
