/**
 * Parts of the app that are built but kept out of sight for now.
 *
 * Their screens and code stay as they are; only the ways in are hidden — the home
 * cards, the chat cards, the phone alerts. Setting one back to true brings it back
 * everywhere at once.
 */
export const FEATURES = {
  /** Meu plano financeiro: the /plano page, its home card, its alerts and the chat's plan card. */
  plano: false,
  /** Desafios e conquistas: the home tile, the check-in shelf and the medals. */
  desafios: false,
} as const;
