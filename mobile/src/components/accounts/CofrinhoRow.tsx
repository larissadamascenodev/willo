import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { isReserveGoal, type Goal } from "@/services/goalService";
import { goalProgress } from "@/lib/goalPresets";
import { goalPreset } from "~/lib/goalIcon";
import { monthYear, paceOf } from "~/lib/cofrinho";
import CofrinhoCover from "~/components/accounts/CofrinhoCover";
import { money } from "~/lib/money";
import { GREEN, INK, RED } from "~/theme/tokens";

/**
 * One cofrinho, as a line of the list.
 *
 * Its picture, its name, how far along it is as a thin bar, and the one sentence that
 * says what to do next. What is held is on the right with what it is held toward. It
 * is a row, not a card: the list reads as a list, and the page it opens is where the
 * cofrinho gets room.
 */

export default function CofrinhoRow({
  goal,
  first,
  delay = 0,
  onPress,
}: {
  goal: Goal;
  first?: boolean;
  delay?: number;
  onPress: () => void;
}) {
  const preset = goalPreset(goal);
  const { progress, percent, isComplete } = goalProgress(goal);
  const pace = paceOf(goal);
  const held = Number(goal.current_amount) || 0;

  const fill = useSharedValue(0);
  useEffect(() => {
    fill.set(withDelay(delay * 1000 + 150, withTiming(progress, { duration: 800, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System })));
  }, [progress, delay, fill]);
  const bar = useAnimatedStyle(() => ({ width: `${fill.get() * 100}%` }));

  const note = isComplete
    ? "Meta concluída"
    : pace.late
      ? "Prazo vencido"
      : pace.open
        ? isReserveGoal(goal)
          ? "Reserva, no seu ritmo"
          : "Sem prazo"
        : `${money(pace.monthly)}/mês · ${monthYear(goal.deadline as string).replace(/ \d{2}(\d{2})$/, "/$1")}`;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        paddingHorizontal: 4,
        paddingVertical: 14,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: "rgba(255,255,255,0.06)",
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <CofrinhoCover goal={goal} width={52} height={52} radius={16} />

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: 15.5, fontWeight: "600", color: "#fff" }}>{goal.name}</Text>
        <View style={{ marginTop: 7, height: 4, borderRadius: 2, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.09)" }}>
          <Animated.View style={[{ height: 4, borderRadius: 2, backgroundColor: isComplete ? GREEN : preset.hex }, bar]} />
        </View>
        <Text numberOfLines={1} style={{ marginTop: 6, fontSize: 12, color: pace.late && !isComplete ? RED : INK.softer }}>{note}</Text>
      </View>

      <View style={{ alignItems: "flex-end", maxWidth: 124 }}>
        <Text numberOfLines={1} style={{ fontSize: 15.5, fontWeight: "700", color: "#fff" }}>{money(held)}</Text>
        <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12, color: INK.softer }}>
          {percent}% de {money(Number(goal.target_amount) || 0)}
        </Text>
      </View>
    </Pressable>
  );
}
