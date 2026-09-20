/** Words that stay lowercase inside a name, unless they come first. */
const SMALL_WORDS = new Set(["de", "da", "do", "das", "dos", "e", "em", "no", "na", "nos", "nas", "a", "o", "para", "com", "por"]);

/**
 * Normalizes what people type into a readable name:
 * "mercado extra" → "Mercado Extra", "conta de luz" → "Conta de Luz".
 * Words already written in caps or mixed case (iFood, PIX, 99) are kept as they are.
 */
export function toTitleCase(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return trimmed;

  return trimmed
    .split(" ")
    .map((word, i) => {
      if (/[A-ZÀ-Ý]/.test(word.slice(1)) || /\d/.test(word)) return word; // iFood, PIX, 99Food
      const lower = word.toLocaleLowerCase("pt-BR");
      if (i > 0 && SMALL_WORDS.has(lower)) return lower;
      return lower.charAt(0).toLocaleUpperCase("pt-BR") + lower.slice(1);
    })
    .join(" ");
}
