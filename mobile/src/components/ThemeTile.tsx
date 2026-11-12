import { useEffect } from "react";
import { Pressable, View, type GestureResponderEvent } from "react-native";
import Animated, { Easing, interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Moon, Sun } from "~/components/icons";

/**
 * The theme as a card that is its own switch. Dark, it is a black card with the moon,
 * "Modo escuro" and the switch on; tapped, the whole card turns light, the moon gives
 * way to the sun, the words change and the switch slides off — and back. It draws in
 * its own colours whatever the theme on screen, since it is showing the theme.
 */

const TRACK_W = 50;
const TRACK_H = 30;
const KNOB = 26;
const TRAVEL = TRACK_W - KNOB - 4;

export default function ThemeTile({ light, onPress, height }: { light: boolean; onPress: (e: GestureResponderEvent) => void; height: number }) {
  /* 1 is dark, 0 is light. */
  const p = useSharedValue(light ? 0 : 1);
  useEffect(() => {
    p.set(withTiming(light ? 0 : 1, { duration: 460, easing: Easing.inOut(Easing.cubic) }));
  }, [light, p]);

  const card = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(p.get(), [0, 1], ["#E7E8EC", "#0B0B0D"]),
    borderColor: interpolateColor(p.get(), [0, 1], ["rgba(17,19,24,0.08)", "rgba(255,255,255,0.10)"]),
  }));
  const label = useAnimatedStyle(() => ({ color: interpolateColor(p.get(), [0, 1], ["#111318", "#FFFFFF"]) }));
  const moon = useAnimatedStyle(() => ({ opacity: p.get(), transform: [{ rotate: `${(1 - p.get()) * -90}deg` }, { scale: 0.6 + p.get() * 0.4 }] }));
  const sun = useAnimatedStyle(() => ({ opacity: 1 - p.get(), transform: [{ rotate: `${p.get() * 90}deg` }, { scale: 1 - p.get() * 0.4 }] }));
  const dark = useAnimatedStyle(() => ({ opacity: p.get() }));
  const lightWord = useAnimatedStyle(() => ({ opacity: 1 - p.get() }));
  const track = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(p.get(), [0, 1], ["rgba(17,19,24,0.14)", "#67CD67"]) }));
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: p.get() * TRAVEL }] }));

  return (
    <Pressable onPress={onPress} accessibilityRole="switch" accessibilityState={{ checked: !light }} accessibilityLabel="Modo escuro" style={{ flex: 1 }}>
      {({ pressed }) => (
        <Animated.View
          style={[
            { height, borderRadius: 26, borderCurve: "continuous", borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 10, transform: [{ scale: pressed ? 0.97 : 1 }] },
            card,
          ]}
        >
          <View style={{ width: 24, height: 24, alignItems: "center", justifyContent: "center" }}>
            <Animated.View style={[{ position: "absolute" }, moon]}>
              <Moon size={22} color="#FFFFFF" strokeWidth={1.9} />
            </Animated.View>
            <Animated.View style={[{ position: "absolute" }, sun]}>
              <Sun size={22} color="#111318" strokeWidth={1.9} />
            </Animated.View>
          </View>
          <View style={{ height: 20, alignSelf: "stretch", alignItems: "center", justifyContent: "center" }}>
            <Animated.Text style={[{ position: "absolute", fontSize: 15, fontWeight: "600" }, label, dark]}>Modo escuro</Animated.Text>
            <Animated.Text style={[{ position: "absolute", fontSize: 15, fontWeight: "600" }, label, lightWord]}>Modo claro</Animated.Text>
          </View>
          <Animated.View style={[{ width: TRACK_W, height: TRACK_H, borderRadius: TRACK_H / 2, padding: 2 }, track]}>
            <Animated.View style={[{ width: KNOB, height: KNOB, borderRadius: KNOB / 2, backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } }, knob]} />
          </Animated.View>
        </Animated.View>
      )}
    </Pressable>
  );
}
