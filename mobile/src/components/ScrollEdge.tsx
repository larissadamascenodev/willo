import { useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

/**
 * The band the page passes under.
 *
 * Only the home pins a header over moving content, so only the home needs this:
 * without it a title and a name smear straight through the avatar as they go by.
 *
 * The blur has to fade out, not stop — a blur that simply ends draws a line across
 * the screen. There is no way to fade a blur itself, so it is built in layers, and
 * the order matters: the tallest layer is the weakest, so what the bottom edge ends
 * on is almost nothing. Stacked the other way round, with the full-strength layer
 * reaching furthest, the line is exactly as visible as having no layers at all,
 * which is what it looked like.
 */

/** Height as a fraction of the band, with the blur each layer adds. Weakest last. */
const LAYERS: { to: number; intensity: number }[] = [
  { to: 0.3, intensity: 16 },
  { to: 0.48, intensity: 12 },
  { to: 0.64, intensity: 9 },
  { to: 0.78, intensity: 6 },
  { to: 0.9, intensity: 4 },
  { to: 1, intensity: 2 },
];

export default function ScrollEdge({ on }: { on: boolean }) {
  const insets = useSafeAreaInsets();
  const shown = useSharedValue(0);
  const height = insets.top + 104;

  useEffect(() => {
    shown.value = withTiming(on ? 1 : 0, { duration: 260 });
  }, [on, shown]);

  const style = useAnimatedStyle(() => ({ opacity: shown.value }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: "absolute", top: 0, left: 0, right: 0, height, zIndex: 25 }, style]}
    >
      {LAYERS.map((layer, i) => (
        <BlurView
          key={i}
          intensity={layer.intensity}
          tint="dark"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: height * layer.to,
          }}
        />
      ))}

      {/* The tint, which does fade, carrying the last of it to nothing. */}
      <Svg width="100%" height="100%" style={{ position: "absolute", top: 0, left: 0 }}>
        <Defs>
          <LinearGradient id="edge-tint" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#0E0E0F" stopOpacity={0.8} />
            <Stop offset="0.5" stopColor="#0E0E0F" stopOpacity={0.3} />
            <Stop offset="0.8" stopColor="#0E0E0F" stopOpacity={0.08} />
            <Stop offset="1" stopColor="#0E0E0F" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#edge-tint)" />
      </Svg>
    </Animated.View>
  );
}
