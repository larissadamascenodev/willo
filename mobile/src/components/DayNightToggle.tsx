import { useEffect } from "react";
import { Pressable, View, type GestureResponderEvent } from "react-native";
import Animated, { Easing, interpolate, interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

/**
 * The day and night switch: a sky with the sun in it, or a night with the moon and
 * stars. Tapped, the knob crosses over, the sun turns into the moon, the clouds go
 * and the stars come out. It only draws; what it switches is up to whoever uses it.
 */

const W = 66;
const H = 34;
const KNOB = 26;
const GAP = (H - KNOB) / 2;
const TRAVEL = W - KNOB - GAP * 2;

const STARS = [
  { x: 12, y: 8, s: 2.2 },
  { x: 22, y: 19, s: 1.6 },
  { x: 9, y: 23, s: 1.4 },
  { x: 30, y: 9, s: 1.4 },
];

export default function DayNightToggle({ light, onPress }: { light: boolean; onPress: (e: GestureResponderEvent) => void }) {
  /* 1 is day, 0 is night. */
  const p = useSharedValue(light ? 1 : 0);
  useEffect(() => {
    p.set(withTiming(light ? 1 : 0, { duration: 420, easing: Easing.inOut(Easing.cubic) }));
  }, [light, p]);

  const track = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(p.get(), [0, 1], ["#1C1F3B", "#7CC8F5"]) }));
  const knob = useAnimatedStyle(() => ({
    transform: [{ translateX: p.get() * TRAVEL }, { rotate: `${(1 - p.get()) * -40}deg` }],
    backgroundColor: interpolateColor(p.get(), [0, 1], ["#E4E6EE", "#FFD43B"]),
    shadowColor: interpolateColor(p.get(), [0, 1], ["#C9CCFF", "#FFC400"]),
  }));
  /* The moon's craters show at night only. */
  const craters = useAnimatedStyle(() => ({ opacity: 1 - p.get() }));
  const stars = useAnimatedStyle(() => ({ opacity: 1 - p.get(), transform: [{ translateY: p.get() * 6 }] }));
  const clouds = useAnimatedStyle(() => ({ opacity: p.get(), transform: [{ translateY: interpolate(p.get(), [0, 1], [8, 0]) }] }));

  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="switch" accessibilityState={{ checked: !light }} accessibilityLabel="Tema escuro">
      {({ pressed }) => (
        <Animated.View style={[{ width: W, height: H, borderRadius: H / 2, overflow: "hidden", transform: [{ scale: pressed ? 0.95 : 1 }] }, track]}>
          {/* Night: stars on the left, where the knob is not. */}
          <Animated.View pointerEvents="none" style={[{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }, stars]}>
            {STARS.map((s, i) => (
              <View key={i} style={{ position: "absolute", left: s.x + 22, top: s.y, width: s.s, height: s.s, borderRadius: s.s, backgroundColor: "#fff" }} />
            ))}
          </Animated.View>
          {/* Day: two soft clouds low on the left. */}
          <Animated.View pointerEvents="none" style={[{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }, clouds]}>
            <View style={{ position: "absolute", left: 6, bottom: -6, width: 22, height: 16, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.95)" }} />
            <View style={{ position: "absolute", left: 18, bottom: -8, width: 20, height: 18, borderRadius: 9, backgroundColor: "rgba(255,255,255,0.85)" }} />
          </Animated.View>
          <Animated.View
            style={[
              { position: "absolute", left: GAP, top: GAP, width: KNOB, height: KNOB, borderRadius: KNOB / 2, shadowOpacity: 0.7, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
              knob,
            ]}
          >
            <Animated.View pointerEvents="none" style={[{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }, craters]}>
              <View style={{ position: "absolute", left: 6, top: 6, width: 7, height: 7, borderRadius: 4, backgroundColor: "rgba(28,31,59,0.18)" }} />
              <View style={{ position: "absolute", left: 14, top: 14, width: 5, height: 5, borderRadius: 3, backgroundColor: "rgba(28,31,59,0.16)" }} />
              <View style={{ position: "absolute", left: 15, top: 5, width: 3.5, height: 3.5, borderRadius: 2, backgroundColor: "rgba(28,31,59,0.14)" }} />
            </Animated.View>
          </Animated.View>
        </Animated.View>
      )}
    </Pressable>
  );
}
