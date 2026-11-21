import { useEffect, useState, type ReactNode } from "react";
import { AccessibilityInfo, View, type StyleProp, type ViewStyle } from "react-native";
import { useGlassEpoch } from "~/lib/glassEpoch";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from "expo-glass-effect";
import { isLight, th } from "~/theme/theme";

/**
 * A piece of glass of any shape — a capsule holding two buttons, a pill with a word — made
 * the way RaisedButton makes its round drop, so they all sit together as one family.
 *
 * On iOS 26 it is the system's Liquid Glass itself. Elsewhere it is drawn to look the same:
 * a blurred fill and a one-point rim of light, brightest at the upper left and again, fainter,
 * at the lower right. With Reduce Transparency on, a plain solid fill.
 *
 * Its size comes from `style` (height, and width if it is not set by what it holds). It is
 * never put inside anything that fades its opacity: glass draws its own light and a fading
 * ancestor flattens it.
 */

const NATIVE = (() => {
  try {
    return isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  } catch {
    return false;
  }
})();

export default function GlassShape({ radius, style, children }: { radius: number; style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  const light = isLight();
  /* Built afresh whenever iOS may have dropped the glass (see lib/glassEpoch). */
  const epoch = useGlassEpoch(NATIVE);
  const [plain, setPlain] = useState(false);
  useEffect(() => {
    if (typeof AccessibilityInfo.isReduceTransparencyEnabled !== "function") return;
    let alive = true;
    AccessibilityInfo.isReduceTransparencyEnabled()
      .then((on) => alive && setPlain(on))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  if (plain) {
    return (
      <View
        style={[
          { borderRadius: radius, borderCurve: "continuous", borderWidth: 1, borderColor: light ? "rgba(17,19,24,0.08)" : "rgba(255,255,255,0.12)", backgroundColor: light ? "#FFFFFF" : "#1C1D20" },
          style,
        ]}
      >
        {children}
      </View>
    );
  }
  if (NATIVE) {
    return (
      <GlassView key={epoch} glassEffectStyle="regular" colorScheme={th("dark", "tint")} isInteractive={false} style={[{ borderRadius: radius }, style]}>
        {children}
      </GlassView>
    );
  }
  return (
    <LinearGradient
      colors={light ? ["rgba(255,255,255,1)", "rgba(255,255,255,0.5)", "rgba(255,255,255,0.9)"] : ["rgba(255,255,255,0.42)", "rgba(255,255,255,0.06)", "rgba(255,255,255,0.22)"]}
      locations={[0, 0.5, 1]}
      start={{ x: 0.15, y: 0 }}
      end={{ x: 0.85, y: 1 }}
      style={[{ borderRadius: radius, padding: 1 }, style]}
    >
      <View style={{ flex: 1, borderRadius: radius - 1, overflow: "hidden" }}>
        <BlurView intensity={light ? 50 : 30} tint={th("dark", "tint")} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
        <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: light ? "rgba(255,255,255,0.55)" : "rgba(34,35,40,0.55)" }} />
        {children}
      </View>
    </LinearGradient>
  );
}
