/**
 * A shower of sparkles over the screen, the moment something lands.
 *
 * Asked for from anywhere; drawn by every sparkle layer that is mounted — the one at
 * the app's root and the one inside an open sheet — from the same seed and the same
 * start, so they fall in step. While the sheet is open its own layer is the one seen;
 * when it closes the root's is already exactly there, and they go on falling.
 */

export type SparkleKind = "burst" | "rain";

export interface SparkleShower {
  id: number;
  kind: SparkleKind;
  seed: number;
  /** Date.now() when it began, so a layer that hears of it late still falls in step. */
  at: number;
}

type Listener = (s: SparkleShower) => void;

const listeners = new Set<Listener>();
let next = 1;

export function sparkle(kind: SparkleKind = "burst") {
  const shower: SparkleShower = { id: next++, kind, seed: Math.floor(Math.random() * 1e9), at: Date.now() };
  listeners.forEach((fn) => fn(shower));
}

export function onSparkle(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
