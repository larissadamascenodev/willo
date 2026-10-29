import { View, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import type { Goal } from "@/services/goalService";
import { goalPreset } from "~/lib/goalIcon";

/**
 * What a cofrinho looks like.
 *
 * The person's own picture when there is one. When there is not, a cover made from
 * the goal itself: its colour, deepened into the room's own dark, with its glyph held
 * large in one corner — a trip is blue and a plane, a house is its own. It stands in
 * until a picture is added, and it is never a grey placeholder.
 */

/** The preset's colour taken down toward the ground, so it sits in the room rather than on it. */
const deep = (hex: string, mix: number) => {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const to = (c: number, ground: number) => Math.round(c * mix + ground * (1 - mix));
  return `rgb(${to(r, 13)},${to(g, 14)},${to(b, 16)})`;
};

export default function CaixinhaCover({
  goal,
  width,
  height,
  radius = 0,
  glyph,
  glyphTop,
  style,
}: {
  goal: Pick<Goal, "name" | "cover_image">;
  width?: number;
  height: number;
  radius?: number;
  /** The glyph's size; left out, it is drawn in proportion to the cover. */
  glyph?: number;
  /** Where the large glyph sits from the top; left out, it is cropped at the foot. */
  glyphTop?: number;
  style?: ViewStyle;
}) {
  const preset = goalPreset(goal);
  const Icon = preset.icon;
  const size = glyph ?? Math.round(height * 0.46);

  return (
    <View style={[{ width: width ?? "100%", height, borderRadius: radius, overflow: "hidden" }, style]}>
      {goal.cover_image ? (
        <Image source={{ uri: goal.cover_image }} contentFit="cover" transition={260} style={{ width: "100%", height: "100%" }} />
      ) : (
        <>
          <LinearGradient
            colors={[deep(preset.hex, 0.92), deep(preset.hex, 0.5), deep(preset.hex, 0.2)]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          />
          {/* A soft light from the top corner, so it is a surface and not a fill. */}
          <LinearGradient
            colors={["rgba(255,255,255,0.18)", "rgba(255,255,255,0)"]}
            start={{ x: 0.85, y: 0 }}
            end={{ x: 0.3, y: 0.7 }}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          />
          {/* Small, the glyph sits in the middle; large, it is held in the corner and cropped. */}
          {height < 90 ? (
            <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
              <Icon size={Math.round(height * 0.44)} color="rgba(255,255,255,0.92)" strokeWidth={1.9} />
            </View>
          ) : (
            <View style={[{ position: "absolute", right: -size * 0.12, opacity: 0.34 }, glyphTop !== undefined ? { top: glyphTop } : { bottom: -size * 0.14 }]}>
              <Icon size={size} color="#fff" strokeWidth={1.4} />
            </View>
          )}
        </>
      )}
    </View>
  );
}
