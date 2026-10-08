import { useEffect } from "react";

/**
 * Hold the page still while something covers it.
 *
 * The count is shared by every overlay because they stack: a picker over a form over the
 * reading screen. Saving and restoring the previous value instead left the page frozen
 * whenever one closed while another was still open.
 */
let locks = 0;

export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    locks += 1;
    document.body.style.overflow = "hidden";
    return () => {
      locks = Math.max(0, locks - 1);
      if (locks === 0) document.body.style.overflow = "";
    };
  }, [active]);
}
