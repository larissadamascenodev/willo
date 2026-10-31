import { useCallback, useEffect, useRef } from "react";

/**
 * One tap or two, on the same thing.
 *
 * The sphere listens on a tap and opens Registro rápido on a double tap. A tap waits a
 * moment to see whether a second follows; the wait is short enough not to be felt.
 */
const WINDOW_MS = 260;

export function useTapOrDouble(single: () => void, double: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ single, double });
  latest.current = { single, double };

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
      latest.current.double();
      return;
    }
    timer.current = setTimeout(() => {
      timer.current = null;
      latest.current.single();
    }, WINDOW_MS);
  }, []);
}
