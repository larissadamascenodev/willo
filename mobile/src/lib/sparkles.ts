/**
 * A burst of sparkles, the moment something lands — with the chime, as the receipt's
 * seal ticks. Asked for from anywhere and drawn by the layer inside the open sheet, so
 * it goes when the sheet goes.
 */

export interface SparkleShower {
  id: number;
  seed: number;
  /** Date.now() when it began. */
  at: number;
}

type Listener = (s: SparkleShower) => void;

const listeners = new Set<Listener>();
let next = 1;

export function sparkle() {
  const shower: SparkleShower = { id: next++, seed: Math.floor(Math.random() * 1e9), at: Date.now() };
  listeners.forEach((fn) => fn(shower));
}

export function onSparkle(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
