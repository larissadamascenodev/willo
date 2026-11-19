import { useEffect, useState, type ReactNode } from "react";
import { AccessibilityInfo, Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from "expo-glass-effect";
import { isLight, th } from "~/theme/theme";

/**
 * A round button of glass, the phone's own.
 *
 * On iOS 26 it is the system's Liquid Glass itself — the same drop the phone's own apps put
 * in their top rows: dark and see-through over the page, with a thin bright edge where the
 * light catches it. Elsewhere (older iPhones, the browser) it is drawn to look the same:
 * a dark, blurred fill and a rim of light, brightest at the upper left and again, fainter,
 * at the lower right. Pressed, it sinks a little.
 */

const NATIVE = (() => {
  try {
    return isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  } catch {
    return false;
  }
})();

export default function RaisedButton({
  size = 50,
  onPress,
  label,
  children,
  style,
}: {
  size?: number;
  onPress?: () => void;
  label: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const light = isLight();
  const r = size / 2;
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

  const content = <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>{children}</View>;

  let body: ReactNode;
  if (plain) {
    body = (
      <View style={{ width: size, height: size, borderRadius: r, borderWidth: 1, borderColor: light ? "rgba(17,19,24,0.08)" : "rgba(255,255,255,0.12)", backgroundColor: light ? "#FFFFFF" : "#1C1D20" }}>
        {content}
      </View>
    );
  } else if (NATIVE) {
    body = (
      <GlassView glassEffectStyle="regular" colorScheme={th("dark", "tint")} isInteractive={false} style={{ width: size, height: size, borderRadius: r }}>
        {content}
      </GlassView>
    );
  } else {
    /* The rim is a gradient one point wide around the fill: bright upper left, gone in the
       middle, a fainter glint lower right — how the light sits on a drop of glass. */
    body = (
      <LinearGradient
        colors={light ? ["rgba(255,255,255,1)", "rgba(255,255,255,0.5)", "rgba(255,255,255,0.9)"] : ["rgba(255,255,255,0.42)", "rgba(255,255,255,0.06)", "rgba(255,255,255,0.22)"]}
        locations={[0, 0.5, 1]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={{ width: size, height: size, borderRadius: r, padding: 1 }}
      >
        <View style={{ flex: 1, borderRadius: r - 1, overflow: "hidden" }}>
          <BlurView intensity={light ? 50 : 30} tint={th("dark", "tint")} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
          <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: light ? "rgba(255,255,255,0.55)" : "rgba(34,35,40,0.55)" }} />
          {content}
        </View>
      </LinearGradient>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.94 : 1 }], opacity: pressed ? 0.85 : 1 }, style]}
    >
      {body}
    </Pressable>
  );
}
