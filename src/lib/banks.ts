/**
 * Well-known Brazilian banks: their brand color for previews and lists, and
 * the closest palette color to store (accounts and cards save a palette name).
 */
export interface Bank {
  id: string;
  name: string;
  hex: string;
  /** Palette name saved on the account/card. */
  accent: string;
  match: RegExp;
}

export const BANKS: Bank[] = [
  { id: "nubank", name: "Nubank", hex: "#8A05BE", accent: "violet", match: /nubank|\bnu\b/i },
  { id: "itau", name: "Itaú", hex: "#EC7000", accent: "amber", match: /ita[uú]/i },
  { id: "bradesco", name: "Bradesco", hex: "#CC092F", accent: "rose", match: /bradesco/i },
  { id: "santander", name: "Santander", hex: "#EC0000", accent: "rose", match: /santander/i },
  { id: "inter", name: "Inter", hex: "#FF7A00", accent: "amber", match: /inter\b/i },
  { id: "caixa", name: "Caixa", hex: "#005CA9", accent: "sky", match: /caixa/i },
  { id: "bb", name: "Banco do Brasil", hex: "#FCD116", accent: "amber", match: /banco do brasil|\bbb\b/i },
  { id: "c6", name: "C6 Bank", hex: "#242424", accent: "sky", match: /c6/i },
  { id: "picpay", name: "PicPay", hex: "#11C76F", accent: "emerald", match: /picpay/i },
  { id: "mercadopago", name: "Mercado Pago", hex: "#00B1EA", accent: "cyan", match: /mercado pago/i },
];

/** Palette colors, in the order the pickers show them. */
export const PALETTE: { value: string; hex: string }[] = [
  { value: "violet", hex: "#8B5CF6" },
  { value: "sky", hex: "#0EA5E9" },
  { value: "cyan", hex: "#06B6D4" },
  { value: "emerald", hex: "#10B981" },
  { value: "lime", hex: "#84CC16" },
  { value: "amber", hex: "#F59E0B" },
  { value: "rose", hex: "#F43F5E" },
  { value: "fuchsia", hex: "#D946EF" },
];

export const COLOR_HEX: Record<string, string> = {
  ...Object.fromEntries(PALETTE.map((c) => [c.value, c.hex])),
  purple: "#8A05BE",
  orange: "#F97316",
  blue: "#3B82F6",
};

export const bankFor = (name: string) => BANKS.find((b) => b.match.test(name));

/** The color an account or card shows: the bank's brand color, else its palette color. */
export function colorFor(name: string, color: string | null | undefined, fallback = "#6B7280") {
  return bankFor(name)?.hex ?? COLOR_HEX[color ?? ""] ?? fallback;
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2)).toUpperCase();
}
