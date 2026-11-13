import { useEffect } from "react";
import { Pressable, Text, View, type GestureResponderEvent } from "react-native";
import Animated, { Easing, interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Moon, Sun } from "~/components/icons";
import { INK } from "~/theme/tokens";
import { THEME_FADE_MS, th } from "~/theme/theme";

/**
 * The theme as one row with its switch: "Modo escuro", on or off. The moon and the sun
 * cross in the icon and the knob slides in the theme change's own time, so the switch
 * and the circle of the new theme opening from the touch end together.
 */

const TRACK_W = 51;
const TRACK_H = 31;
const KNOB = 27;
const TRAVEL = TRACK_W - KNOB - 4;
const GREEN = "#67CD67";

export default function ThemeTile({ light, onPress }: { light: boolean; onPress: (e: GestureResponderEvent) => void }) {
  /* 1 is dark, 0 is light. */
  const p = useSharedValue(light ? 0 : 1);
  useEffect(() => {
    p.set(withTiming(light ? 0 : 1, { duration: THEME_FADE_MS, easing: Easing.inOut(Easing.cubic) }));
  }, [light, p]);

  /* Worked out here, not in the animation: only worklets may run there. */
  const off = th("rgba(120,120,128,0.36)", "line");
  const moon = useAnimatedStyle(() => ({ opacity: p.get(), transform: [{ rotate: `${(1 - p.get()) * -90}deg` }, { scale: 0.6 + p.get() * 0.4 }] }));
  const sun = useAnimatedStyle(() => ({ opacity: 1 - p.get(), transform: [{ rotate: `${p.get() * 90}deg` }, { scale: 1 - p.get() * 0.4 }] }));
  const track = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(p.get(), [0, 1], [off, GREEN]) }));
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: p.get() * TRAVEL }] }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="switch"
      accessibilityState={{ checked: !light }}
      accessibilityLabel="Modo escuro"
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, minHeight: 58, paddingVertical: 11, backgroundColor: pressed ? th("rgba(255,255,255,0.04)", "bg") : "transparent" })}
    >
      <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: th("rgba(255,255,255,0.07)", "bg") }}>
        <Animated.View style={[{ position: "absolute" }, moon]}>
          <Moon size={17} color={th("#fff")} strokeWidth={1.9} />
        </Animated.View>
        <Animated.View style={[{ position: "absolute" }, sun]}>
          <Sun size={17} color={th("#fff")} strokeWidth={1.9} />
        </Animated.View>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 15.5, fontWeight: "500", color: th("#fff") }}>Modo escuro</Text>
        <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 13, color: th(INK.soft) }}>
          {light ? "Desligado · tema claro" : "Ligado"}
        </Text>
      </View>
      <Animated.View style={[{ width: TRACK_W, height: TRACK_H, borderRadius: TRACK_H / 2, padding: 2 }, track]}>
        <Animated.View style={[{ width: KNOB, height: KNOB, borderRadius: KNOB / 2, backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } }, knob]} />
      </Animated.View>
    </Pressable>
  );
}
