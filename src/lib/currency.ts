/**
 * The currency the user chose to see their money in. Values are stored as plain
 * numbers; this only changes how they're displayed (symbol and code), keeping
 * the Brazilian number format (1.234,56) the rest of the app is written in.
 */
export const CURRENCIES = [
  { code: "BRL", name: "Real brasileiro" },
  { code: "USD", name: "Dólar americano" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "Libra esterlina" },
  { code: "CAD", name: "Dólar canadense" },
  { code: "AUD", name: "Dólar australiano" },
  { code: "JPY", name: "Iene japonês" },
  { code: "CHF", name: "Franco suíço" },
  { code: "ARS", name: "Peso argentino" },
  { code: "CLP", name: "Peso chileno" },
  { code: "MXN", name: "Peso mexicano" },
  { code: "PYG", name: "Guarani paraguaio" },
  { code: "UYU", name: "Peso uruguaio" },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];

const STORAGE_KEY = "willo.currency";

function readStored(): CurrencyCode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && CURRENCIES.some((c) => c.code === v)) return v as CurrencyCode;
  } catch {
    // storage unavailable (private mode) — fall back to real
  }
  return "BRL";
}

let current: CurrencyCode = readStored();

export function getCurrency(): CurrencyCode {
  return current;
}

/** Saves the choice and reloads so every screen picks it up at once. */
export function setCurrency(code: CurrencyCode) {
  current = code;
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // keep it for this session at least
  }
  window.location.reload();
}

const symbolCache = new Map<string, string>();

/** "R$", "US$", "€"… as shown in pt-BR. */
export function currencySymbol(code: CurrencyCode = current): string {
  const hit = symbolCache.get(code);
  if (hit) return hit;
  const part = new Intl.NumberFormat("pt-BR", { style: "currency", currency: code })
    .formatToParts(0)
    .find((p) => p.type === "currency");
  const symbol = part?.value ?? code;
  symbolCache.set(code, symbol);
  return symbol;
}

export function currencyName(code: CurrencyCode = current): string {
  return CURRENCIES.find((c) => c.code === code)?.name ?? code;
}

/** Full money formatting in the chosen currency. */
export function formatMoney(value: number, options: Intl.NumberFormatOptions = {}): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: current, ...options });
}
