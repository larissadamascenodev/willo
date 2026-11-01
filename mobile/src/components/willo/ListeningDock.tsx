import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { Easing, FadeIn, FadeInDown, ReduceMotion, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import ParticleOrb from "~/components/registro/ParticleOrb";
import { INK } from "~/theme/tokens";

/**
 * Willo at the foot of the conversation while he listens, the way the phone's own
 * assistant comes up: he rises where the composer was, on a light that breathes, so
 * there is no doubt he is hearing you and no doubt when he stops. He stops by himself
 * when you do; a tap on him stops him sooner, and either way what was said is sent.
 */
export default function ListeningDock({
  reading,
  bottom,
  onStop,
  onCancel,
}: {
  /** He has stopped listening and is working out what was said. */
  reading: boolean;
  bottom: number;
  onStop: () => void;
  onCancel: () => void;
}) {
  const light = useSharedValue(0.65);
  useEffect(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    light.set(withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.System }), -1, true));
  }, [light]);
  const breathing = useAnimatedStyle(() => ({ opacity: light.get() }));

  return (
    <Animated.View entering={FadeInDown.duration(280)} style={{ alignItems: "center", paddingTop: 8, paddingBottom: bottom + 10 }}>
      <Animated.View style={[{ position: "absolute", left: 0, right: 0, bottom: 0, height: 300 }, breathing]} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="dock-light" x1="0" y1="1" x2="0" y2="0">
              <Stop offset="0" stopColor="#4C97F0" stopOpacity={0.42} />
              <Stop offset="0.45" stopColor="#1FA9BC" stopOpacity={0.14} />
              <Stop offset="1" stopColor="#1FA9BC" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#dock-light)" />
        </Svg>
      </Animated.View>

      <ParticleOrb size={112} mode={reading ? "thinking" : "listening"} onPress={reading ? undefined : onStop} />

      <Text style={{ marginTop: 6, fontSize: 16, fontWeight: "700", letterSpacing: -0.2, color: "#fff" }}>{reading ? "Entendendo…" : "Estou ouvindo…"}</Text>
      {reading ? (
        <View style={{ height: 34 }} />
      ) : (
        <Animated.View entering={FadeIn.duration(200)} style={{ flexDirection: "row", alignItems: "center", gap: 4, height: 34 }}>
          <Text style={{ fontSize: 13, color: INK.soft }}>Toque nele para enviar, ou</Text>
          <Pressable onPress={onCancel} hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: "#fff" }}>cancele</Text>
          </Pressable>
        </Animated.View>
      )}
    </Animated.View>
  );
}
