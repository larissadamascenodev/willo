import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import type { Goal } from "@/services/goalService";
import { goalProgress } from "@/lib/goalPresets";
import { goalPreset } from "~/lib/goalIcon";
import CofrinhoCover from "~/components/accounts/CofrinhoCover";
import { Plus } from "~/components/icons";
import { money } from "~/lib/money";
import { GREEN } from "~/theme/tokens";

/**
 * One cofrinho, as a picture you can hold.
 *
 * The cofrinhos are things people are saving toward — a trip, a car, a house — so the
 * shelf leads with what they look like. Each is a tall card that is all picture, with
 * what is held written across the foot of it and how far along as a thin line under
 * that. How much of it is done sits in a small glass tag in the corner.
 */

export const TILE_W = 196;
export const TILE_H = 252;

export default function CofrinhoTile({
  goal,
  delay = 0,
  width = TILE_W,
  height = TILE_H,
  onPress,
}: {
  goal: Goal;
  delay?: number;
  width?: number;
  height?: number;
  onPress: () => void;
}) {
  const preset = goalPreset(goal);
  const { progress, percent, isComplete } = goalProgress(goal);

  const fill = useSharedValue(0);
  useEffect(() => {
    fill.set(withDelay(delay * 1000 + 250, withTiming(progress, { duration: 900, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System })));
  }, [progress, delay, fill]);
  const bar = useAnimatedStyle(() => ({ width: `${fill.get() * 100}%` }));

  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }] })}>
      <View style={{ width, height, borderRadius: 28, borderCurve: "continuous", overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" }}>
        <CofrinhoCover goal={goal} width={width} height={height} glyph={Math.round(width * 0.72)} glyphTop={Math.round(height * 0.07)} />
        <LinearGradient
          colors={["rgba(8,9,10,0)", "rgba(8,9,10,0.55)", "rgba(8,9,10,0.92)"]}
          locations={[0.3, 0.62, 1]}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />

        <View style={{ position: "absolute", top: 12, left: 12, height: 26, paddingHorizontal: 10, borderRadius: 13, overflow: "hidden", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" }}>
          <BlurView intensity={40} tint="dark" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(18,20,26,0.3)" }} />
          <Text style={{ fontSize: 12, fontWeight: "700", color: isComplete ? GREEN : "#fff" }}>{percent}%</Text>
        </View>

        <View style={{ position: "absolute", left: 16, right: 16, bottom: 16 }}>
          <Text numberOfLines={2} style={{ fontSize: 14, fontWeight: "600", lineHeight: 18, color: "rgba(255,255,255,0.86)" }}>{goal.name}</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ marginTop: 4, fontSize: width < 150 ? 18 : 23, fontWeight: "800", letterSpacing: -0.8, color: "#fff" }}>
            {money(Number(goal.current_amount) || 0)}
          </Text>
          <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
            de {money(Number(goal.target_amount) || 0)}
          </Text>
          <View style={{ marginTop: 10, height: 4, borderRadius: 2, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.18)" }}>
            <Animated.View style={[{ height: 4, borderRadius: 2, backgroundColor: isComplete ? GREEN : preset.hex }, bar]} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

/** The last place on the shelf: a new one. Glass, so it reads as an empty frame. */
export function NewCofrinhoTile({ onPress, width = 132, height = TILE_H }: { onPress: () => void; width?: number; height?: number }) {
  return (
    <Pressable onPress={onPress} accessibilityLabel="Novo cofrinho" style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }] })}>
      <View
        style={{
          width,
          height,
          borderRadius: 28,
          borderCurve: "continuous",
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.12)",
          backgroundColor: "rgba(255,255,255,0.05)",
        }}
      >
        <View style={{ width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.10)" }}>
          <Plus size={20} color="#fff" strokeWidth={2.4} />
        </View>
        <Text style={{ fontSize: 13.5, fontWeight: "600", color: "#fff", textAlign: "center" }}>Novo{"\n"}cofrinho</Text>
      </View>
    </Pressable>
  );
}
