import { useEffect, useMemo } from "react";
import { View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";

/**
 * Willo Flow (Implementação 001): the convergence. As the slide is done, 65 points of light
 * — not solid confetti — leave the centre of the knob where it stopped and gather at the seal of
 * the Pass, spreading sideways up to ±47.5 % of the width on the way, each 1 to 3.3 across, in
 * #c8aaff, #79e2ca, #ffc08b and #eee0ff, on a smoothed path, their opacity rising and falling as
 * a sine. 560 ms, then the Pass (once the entry is written). Drawn over everything, touching nothing.
 */

export const FLOW_MS = 560;
const COLORS = ["#c8aaff", "#79e2ca", "#ffc08b", "#eee0ff"];

interface Spark {
  d: number;
  life: number;
  spread: number;
  r: number;
  color: string;
}

export default function WilloFlow({ from, to, width, height }: { from: { x: number; y: number }; to: { x: number; y: number }; width: number; height: number }) {
  const clock = useSharedValue(0);
  const sparks = useMemo<Spark[]>(
    () =>
      Array.from({ length: 65 }, (_, i) => ({
        d: Math.random() * 0.24,
        life: 0.65 + Math.random() * 0.35,
        spread: (Math.random() - 0.5) * width * 0.95,
        r: 1 + Math.random() * 2.3,
        color: COLORS[i % 4],
      })),
    [width],
  );
  useEffect(() => {
    clock.set(withTiming(1.25, { duration: FLOW_MS * 1.25, easing: Easing.linear }));
  }, [clock]);
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, width, height, zIndex: 20 }}>
      {sparks.map((s, i) => (
        <Spark key={i} s={s} clock={clock} from={from} to={to} />
      ))}
    </View>
  );
}

function Spark({ s, clock, from, to }: { s: Spark; clock: SharedValue<number>; from: { x: number; y: number }; to: { x: number; y: number } }) {
  const size = s.r * 2;
  const style = useAnimatedStyle(() => {
    const u = (clock.get() - s.d) / s.life;
    if (u <= 0 || u >= 1) return { opacity: 0 };
    const e = u * u * (3 - 2 * u);
    const bend = Math.sin(Math.PI * u);
    return {
      opacity: bend,
      transform: [{ translateX: from.x + (to.x - from.x) * e + s.spread * bend - s.r }, { translateY: from.y + (to.y - from.y) * e - s.r }],
    };
  });
  return (
    <Animated.View
      style={[
        { position: "absolute", left: 0, top: 0, width: size, height: size, borderRadius: s.r, backgroundColor: s.color, shadowColor: s.color, shadowOpacity: 1, shadowRadius: 7, shadowOffset: { width: 0, height: 0 } },
        style,
      ]}
    />
  );
}
