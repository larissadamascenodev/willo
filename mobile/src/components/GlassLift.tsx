import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

/**
 * The lift that makes a piece of Liquid Glass — a button, a pill, a card — sit raised instead
 * of flat, the same on both themes.
 *
 * Laid over it, inside its shape: a rim of light brightest along the top and the upper left,
 * fading down the sides to a faint edge at the bottom, and a soft sheen over the upper half,
 * like a drop of glass. On the dark the light is white at a whisper; on the light it is a
 * bright white rim and sheen with the lower edge a hair darker, so the piece reads as
 * standing off the pale ground.
 */
export default function GlassLift({ radius, light = false }: { radius: number; light?: boolean }) {
  const sheen = light ? ["rgba(255,255,255,0.55)", "rgba(255,255,255,0.12)", "rgba(255,255,255,0)"] as const : ["rgba(255,255,255,0.13)", "rgba(255,255,255,0.03)", "rgba(255,255,255,0)"] as const;
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius, overflow: "hidden" }}>
      <LinearGradient colors={sheen} locations={[0, 0.45, 0.6]} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: radius,
          borderCurve: "continuous",
          borderWidth: 1,
          borderTopColor: light ? "rgba(255,255,255,1)" : "rgba(255,255,255,0.34)",
          borderLeftColor: light ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.2)",
          borderRightColor: light ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.12)",
          borderBottomColor: light ? "rgba(17,19,24,0.08)" : "rgba(255,255,255,0.07)",
        }}
      />
    </View>
  );
}
