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
 * the screen. There is no way to fade a blur itself, so it is built in layers: each
 * one shorter than the last, so near the top the page is looking through four of
 * them and by the bottom edge through none. A mask would be tidier, but the only
 * masking component here renders as a white slab on the web, which is no way to
 * check one's work.
 */

/** Fractions of the band's height, deepest first. */
const LAYERS = [1, 0.74, 0.5, 0.3];

export default function ScrollEdge({ on }: { on: boolean }) {
  const insets = useSafeAreaInsets();
  const shown = useSharedValue(0);
  const height = insets.top + 96;

  useEffect(() => {
    shown.value = withTiming(on ? 1 : 0, { duration: 220 });
  }, [on, shown]);

  const style = useAnimatedStyle(() => ({ opacity: shown.value }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: "absolute", top: 0, left: 0, right: 0, height, zIndex: 25 }, style]}
    >
      {LAYERS.map((fraction, i) => (
        <BlurView
          key={i}
          intensity={14}
          tint="dark"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: height * fraction,
          }}
        />
      ))}

      {/* The tint, which does fade, carrying the last of it to nothing. */}
      <Svg width="100%" height="100%" style={{ position: "absolute", top: 0, left: 0 }}>
        <Defs>
          <LinearGradient id="edge-tint" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#0E0E0F" stopOpacity={0.86} />
            <Stop offset="0.58" stopColor="#0E0E0F" stopOpacity={0.3} />
            <Stop offset="1" stopColor="#0E0E0F" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#edge-tint)" />
      </Svg>
    </Animated.View>
  );
}
