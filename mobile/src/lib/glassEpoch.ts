import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { useIsFocused } from "expo-router";

/* Whether the screen is in view; outside a navigator it counts as always. */
function useInView() {
  try {
    return useIsFocused();
  } catch {
    return true;
  }
}

/**
 * A key for a native Liquid Glass view, new each time its screen comes back into view and
 * each time the app comes back to the front.
 *
 * iOS drops a glass effect for good once anything above it goes (nearly) transparent — a
 * screen's transition, a fade, the app going to the background — leaving only what was on
 * the glass: words on nothing. Keyed with this, the glass is built afresh whenever that may
 * have happened. `on` is false where no native glass is drawn, so nothing is rebuilt there.
 */
export function useGlassEpoch(on: boolean) {
  const inView = useInView();
  const [epoch, setEpoch] = useState(0);
  useEffect(() => {
    if (on && inView) setEpoch((e) => e + 1);
  }, [on, inView]);
  useEffect(() => {
    if (!on) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") setEpoch((e) => e + 1);
    });
    return () => sub.remove();
  }, [on]);
  return epoch;
}
