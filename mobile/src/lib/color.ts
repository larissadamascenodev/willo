/** "220 10% 55%" (o formato HSL do site) vira uma cor que o React Native entende. */
export function hsl(triplet: string, alpha = 1): string {
  const [h, s, l] = triplet.trim().split(/\s+/);
  return alpha >= 1 ? `hsl(${h}, ${s}, ${l})` : `hsla(${h}, ${s}, ${l}, ${alpha})`;
}

/** "#C8F36D" + 0.12 → um tom translúcido da mesma cor (o `${hex}1F` do site). */
export function tint(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
