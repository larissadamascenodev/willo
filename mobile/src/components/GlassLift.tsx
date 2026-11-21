import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

/**
 * The lift a piece of Liquid Glass has on a bright ground, given back on a dark one.
 *
 * Over a dark background the system glass has little light to bend and reads flat. Laid over
 * it, inside its shape: a rim of light brightest along the top and the upper left, fading down
 * the sides to a faint glint at the bottom, and a soft sheen over the upper half — so the
 * button or pill sits raised, like a drop of glass, as it does on the light themes.
 */
export default function GlassLift({ radius }: { radius: number }) {
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius, overflow: "hidden" }}>
      <LinearGradient colors={["rgba(255,255,255,0.13)", "rgba(255,255,255,0.03)", "rgba(255,255,255,0)"]} locations={[0, 0.45, 0.6]} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
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
          borderTopColor: "rgba(255,255,255,0.34)",
          borderLeftColor: "rgba(255,255,255,0.2)",
          borderRightColor: "rgba(255,255,255,0.12)",
          borderBottomColor: "rgba(255,255,255,0.07)",
        }}
      />
    </View>
  );
}
