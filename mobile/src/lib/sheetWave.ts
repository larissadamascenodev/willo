/**
 * The success wave: a ring of green light sent through the open sheet from a point — the
 * check mark's — that pools at the sheet's foot and lingers along its edges. Asked for from
 * anywhere and drawn by the layer inside the open sheet (WaveLayer), so it covers the whole
 * sheet, edge to edge, and goes when the sheet goes.
 */

export interface SheetWave {
  id: number;
  /** Where it starts, in window coordinates. */
  x: number;
  y: number;
}

type Listener = (w: SheetWave) => void;

const listeners = new Set<Listener>();
let next = 1;

export function sheetWave(x: number, y: number) {
  const wave: SheetWave = { id: next++, x, y };
  listeners.forEach((fn) => fn(wave));
}

export function onSheetWave(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
