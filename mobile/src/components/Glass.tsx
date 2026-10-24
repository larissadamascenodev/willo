import { useEffect, useState, type ReactNode } from "react";
import { AccessibilityInfo, View, type StyleProp, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from "expo-glass-effect";

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
  interactive = false,
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

  if (reduceTransparency) {
    return (
      <View
        style={[
          shape,
          { backgroundColor: "#1C1D20", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" },
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  if (NATIVE_GLASS) {
    return (
      <GlassView glassEffectStyle="regular" colorScheme="dark" isInteractive={interactive} style={[shape, style]}>
        {children}
      </GlassView>
    );
  }

  return (
    <BlurView
      tint="dark"
      intensity={40}
      style={[
        shape,
        {
          overflow: "hidden",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.12)",
          backgroundColor: "rgba(255,255,255,0.05)",
        },
        style,
      ]}
    >
      {children}
    </BlurView>
  );
}
