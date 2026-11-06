import { useEffect, useState, type ReactNode } from "react";
import { AccessibilityInfo, View, type StyleProp, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from "expo-glass-effect";

import { isLight, th } from "~/theme/theme";

/* The native glass on the light ground: a fine white rim and a soft shadow give it an
   edge, which the dark ground gives it for free. */
const LIGHT_EDGE: ViewStyle = {
  borderWidth: 0.75,
  borderColor: "rgba(255,255,255,0.9)",
  shadowColor: "#000",
  shadowOpacity: 0.08,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 4 },
};
/**
 * A control's surface, in the system's liquid glass where the phone has it.
 *
 * Glass is for the layer of things you touch that floats over the content — a
 * switcher, a selector — not for the content itself; a card of figures in glass
 * reads as a button. So this is only used for controls.
 *
 * Three surfaces, in order of preference: the real glass on iOS 26 and later; a
 * blur where it is not there; and a plain translucent fill when the person has
 * asked the system to reduce transparency, which is a request to see no glass at
 * all. Both availability checks are needed — some early iOS 26 builds report glass
 * as supported and then crash on the API.
 *
 * Never put this inside anything that clips it or fades its opacity: glass draws
 * its own rim and highlight past its edge, and a fading ancestor flattens it.
 */

const NATIVE_GLASS = (() => {
  try {
    return isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  } catch {
    return false;
  }
})();

export default function Glass({
  children,
  style,
  radius = 999,
  /* Kept so callers can say it, but the native glass is never made interactive: an
     interactive glass inside a Pressable takes the first touch for its own shimmer,
     and the button under it then needed a second tap to answer. */
  interactive: _interactive = false,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  /** For a surface that is itself something you press. */
  interactive?: boolean;
}) {
  const [reduceTransparency, setReduceTransparency] = useState(false);

  useEffect(() => {
    /* Only iOS can say; the browser build has no such setting and no such call. */
    if (typeof AccessibilityInfo.isReduceTransparencyEnabled !== "function") return;
    let alive = true;
    AccessibilityInfo.isReduceTransparencyEnabled()
      .then((on) => alive && setReduceTransparency(on))
      .catch(() => {});
    let sub: { remove: () => void } | undefined;
    try {
      sub = AccessibilityInfo.addEventListener("reduceTransparencyChanged", setReduceTransparency);
    } catch {
      sub = undefined;
    }
    return () => {
      alive = false;
      sub?.remove();
    };
  }, []);

  const shape: ViewStyle = { borderRadius: radius, borderCurve: "continuous" };
  const light = isLight();

  if (reduceTransparency) {
    return (
      <View
        style={[
          shape,
          light
            ? { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "rgba(17,19,24,0.08)" }
            : { backgroundColor: "#1C1D20", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" },
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  if (NATIVE_GLASS) {
    return (
      <GlassView glassEffectStyle="regular" colorScheme={th("dark", "tint")} isInteractive={false} style={[shape, light && LIGHT_EDGE, style]}>
        {children}
      </GlassView>
    );
  }

  return (
    <BlurView
      tint={th("dark", "tint")}
      intensity={light ? 55 : 40}
      style={[
        shape,
        {
          overflow: "hidden",
          borderWidth: 1,
          /* In the light, glass is white: a bright rim and a milky fill, so it reads
             against the pale ground and catches the colour behind it. */
          borderColor: light ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.12)",
          backgroundColor: light ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.05)",
        },
        style,
      ]}
    >
      {children}
    </BlurView>
  );
}
