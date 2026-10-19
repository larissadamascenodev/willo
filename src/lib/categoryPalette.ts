/**
 * What a category can be called, drawn with, and coloured.
 *
 * The glyph names here are lucide's own slugs, which is how a custom category's
 * choice is stored in the database — so the list has to be the same list on both
 * apps, or a category drawn with a bus in the browser comes out blank on the phone.
 * Each app keeps its own slug-to-drawing map, because the two packages ship
 * different files; only the vocabulary is shared.
 */

export const CATEGORY_ICON_SLUGS = [
  "shopping-cart", "utensils", "car", "pill", "home", "book-open", "shirt",
  "paw-print", "scissors", "gamepad-2", "gift", "plane", "smartphone",
  "dollar-sign", "briefcase", "music", "coffee", "dumbbell", "clapperboard",
  "file-text", "wrench", "shopping-bag", "lightbulb", "target", "heart",
  "repeat", "graduation-cap", "trending-up", "award", "users", "wallet",
  "piggy-bank", "zap", "star", "globe", "camera", "headphones", "monitor",
  "tv", "bus", "landmark", "bike", "fuel", "baby", "stethoscope", "palette",
  "utensils-crossed", "wine", "pizza", "hammer", "key", "shield", "umbrella",
  "tent", "map", "truck", "leaf", "flame", "gem", "crown",
  "badge-dollar-sign", "hand-coins", "receipt", "banknote", "droplets",
  "cup-soda", "package", "popcorn", "salad", "ice-cream", "plug", "wifi",
  "phone", "building-2",
] as const;

export type CategoryIconSlug = (typeof CATEGORY_ICON_SLUGS)[number];

/** The glyph a category falls back to when it has not chosen one. */
export const DEFAULT_CATEGORY_ICON_SLUG = "file-text";

/**
 * The colours a category may take.
 *
 * Each category keeps its own, because a chart of categories is only readable if no
 * two slices are the same colour. So the picker offers these and marks the ones
 * already taken.
 */
export const CATEGORY_COLOR_OPTIONS = [
  "#00e676", "#f44336", "#ff9800", "#2196f3", "#9c27b0",
  "#e91e63", "#00bcd4", "#8bc34a", "#ffc107", "#795548",
  "#607060", "#3f51b5", "#009688", "#ff5722", "#673ab7",
  "#cddc39", "#4caf50", "#03a9f4", "#ff4081", "#7c4dff",
  "#18ffff", "#69f0ae", "#ffab40", "#ea80fc",
];

/**
 * Names that say nothing.
 *
 * A category called "outros" is a category that will swallow everything and leave
 * the charts with one grey wedge and no information in them, so it is refused at
 * the door rather than explained away later.
 */
export const FORBIDDEN_CATEGORY_NAMES = [
  "outros", "outro", "diversos", "geral", "varios", "sem categoria",
];

/** Accents and case removed, for comparing two names a person typed. */
export const normalizeCategoryName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/** Why this name cannot be used, or null when it can. */
export function categoryNameProblem(
  name: string,
  existingNames: string[],
): string | null {
  const trimmed = name.trim();
  if (trimmed.length < 2) return "Dê um nome com pelo menos duas letras.";

  const normalized = normalizeCategoryName(trimmed);
  if (FORBIDDEN_CATEGORY_NAMES.includes(normalized)) {
    return "Esse nome é vago demais — use algo que diga o que é.";
  }
  if (existingNames.some((n) => normalizeCategoryName(n) === normalized)) {
    return "Já existe uma categoria com esse nome.";
  }
  return null;
}

/** The first colour nobody has taken, so two categories never share one. */
export function firstFreeCategoryColor(usedColors: string[]): string {
  const taken = new Set(usedColors.map((c) => c.toLowerCase()));
  return (
    CATEGORY_COLOR_OPTIONS.find((c) => !taken.has(c.toLowerCase())) ??
    CATEGORY_COLOR_OPTIONS[0]
  );
}
