/**
 * The light of a payment going through, drawn over the open sheet (WaveLayer).
 *
 * "launch": let go, it rises at once through the sheet and out of its top. "off": gone at
 * once (the save failed, say).
 *
 * Asked for from anywhere and drawn by the layer inside the open sheet, so it covers the
 * whole sheet edge to edge and goes when the sheet goes.
 */

export type SheetLight = "launch" | "off";

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
