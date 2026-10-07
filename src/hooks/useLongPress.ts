import { useCallback, useRef } from "react";

/**
 * Hold to act on a thing. The press has to stay put — scrolling a list is a drag, not
 * a hold — and the tap that the browser fires afterwards is swallowed, or holding a
 * row would open it as well as its menu.
 */
export function useLongPress(onLongPress: () => void, ms = 480) {
  const timer = useRef<number | null>(null);
  const from = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const clear = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    from.current = null;
  }, []);

  return {
    onPointerDown: (e: React.PointerEvent) => {
      fired.current = false;
      from.current = { x: e.clientX, y: e.clientY };
      timer.current = window.setTimeout(() => {
        fired.current = true;
        onLongPress();
      }, ms);
    },
    onPointerMove: (e: React.PointerEvent) => {
      const start = from.current;
      if (!start) return;
      if (Math.abs(e.clientX - start.x) > 8 || Math.abs(e.clientY - start.y) > 8) clear();
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onPointerLeave: clear,
    /** Wrap the element's own click so a hold does not also open it. */
    guard: (run: () => void) => () => {
      if (fired.current) {
        fired.current = false;
        return;
      }
      run();
    },
  };
}
