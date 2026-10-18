import { useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

/**
 * The band the page passes under.
 *
 * Only the home has a header pinned over moving content, so only the home needs
 * this: without it a title and a name smear straight through the avatar as they go
 * by. It is a blur that fades to nothing by its own bottom edge, so there is no line
 * across the screen — the content does not stop, it dissolves.
 *
 * It appears once the page has moved at all, and goes when it comes back.
 */
export default function ScrollEdge({ on }: { on: boolean }) {
  const insets = useSafeAreaInsets();
  const shown = useSharedValue(0);

  useEffect(() => {
    shown.value = withTiming(on ? 1 : 0, { duration: 220 });
  }, [on, shown]);

  const style = useAnimatedStyle(() => ({ opacity: shown.value }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: insets.top + 96,
          zIndex: 25,
        },
        style,
      ]}
    >
      <BlurView intensity={22} tint="dark" style={{ flex: 1 }}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="edge" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#0E0E0F" stopOpacity={0.86} />
              <Stop offset="0.58" stopColor="#0E0E0F" stopOpacity={0.36} />
              <Stop offset="1" stopColor="#0E0E0F" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#edge)" />
        </Svg>
      </BlurView>
    </Animated.View>
  );
}
