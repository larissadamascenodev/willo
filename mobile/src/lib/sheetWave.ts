/**
 * The light of a payment going through, drawn over the open sheet (WaveLayer).
 *
 * "charge": while it is being saved, a warm glow gathers at the sheet's foot and breathes.
 * "launch": saved, it shoots up through the sheet and out of its top, and fades there.
 * "off": gone at once (it failed, say).
 *
 * Asked for from anywhere and drawn by the layer inside the open sheet, so it covers the
 * whole sheet edge to edge and goes when the sheet goes.
 */

export type SheetLight = "charge" | "launch" | "off";

type Listener = (cmd: SheetLight) => void;

const listeners = new Set<Listener>();

export function sheetLight(cmd: SheetLight) {
  listeners.forEach((fn) => fn(cmd));
}

export function onSheetLight(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
