/** A nearly-full sheet stops this far under the status bar. */
export const TALL_GAP = 8;

/**
 * The room a nearly-full BottomSheet leaves its content: the screen under the status bar,
 * less the sheet's own top (padding and handle) and foot (the home bar, or the keyboard's
 * edge). Content of exactly this height fills the sheet and never scrolls.
 */
export function tallSheetBody(screenH: number, insetTop: number, insetBottom: number, keyboard: number) {
  return Math.floor(screenH - insetTop - TALL_GAP - keyboard - 10 - 16 - (keyboard > 0 ? 12 : insetBottom + 16)) - 1;
}
