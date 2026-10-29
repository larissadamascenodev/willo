import { useEffect } from "react";
import { Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, { Easing, ReduceMotion, useAnimatedProps, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { isReserveGoal, type Goal } from "@/services/goalService";
import { goalProgress } from "@/lib/goalPresets";
import { goalPreset } from "~/lib/goalIcon";
import { monthYear, paceOf } from "~/lib/cofrinho";
import Surface from "~/components/Surface";
import { ChevronRight } from "~/components/icons";
import { money } from "~/lib/money";
import { INK, RED } from "~/theme/tokens";

/**
 * One cofrinho, as a card.
 *
 * The goal's own glyph sits inside a ring that fills to how far along it is — the one
 * figure a cofrinho is judged by, readable before any number is — and under it the two
 * things that say what to do next: what to put in each month, and when it arrives.
 */

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const SIZE = 62;
const STROKE = 5;
const R = (SIZE - STROKE) / 2;
const LENGTH = 2 * Math.PI * R;

export default function CofrinhoCard({
  goal,
  delay = 0,
  onPress,
}: {
  goal: Goal;
  delay?: number;
  onPress: () => void;
}) {
  const preset = goalPreset(goal);
  const Icon = preset.icon;
  const { progress, percent, remaining, isComplete } = goalProgress(goal);
  const pace = paceOf(goal);
  const held = Number(goal.current_amount) || 0;

  const fill = useSharedValue(0);
  useEffect(() => {
    fill.set(withDelay(delay * 1000 + 150, withTiming(progress, { duration: 900, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System })));
  }, [progress, delay, fill]);
  const arc = useAnimatedProps(() => ({ strokeDashoffset: LENGTH * (1 - fill.get()) }));

  const left = isComplete ? "Meta concluída" : pace.open ? (isReserveGoal(goal) ? "Reserva" : "Sem prazo") : pace.late ? "Prazo vencido" : "Guarde por mês";
  const leftValue = isComplete ? null : !pace.open && !pace.late ? money(pace.monthly) : money(remaining);
  const leftNote = isComplete ? null : pace.open || pace.late ? "faltam" : null;
  const right = !pace.open && goal.deadline ? `até ${monthYear(goal.deadline)}` : null;

  return (
    <Surface radius={26} onPress={onPress} style={{ padding: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <View style={{ width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" }}>
          <Svg width={SIZE} height={SIZE} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
            <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke="rgba(255,255,255,0.09)" strokeWidth={STROKE} fill="none" />
            <AnimatedCircle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              stroke={preset.hex}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={LENGTH}
              fill="none"
              animatedProps={arc}
            />
          </Svg>
          <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: `${preset.hex}22` }}>
            <Icon size={19} color={preset.hex} strokeWidth={2} />
          </View>
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontSize: 16.5, fontWeight: "700", letterSpacing: -0.2, color: "#fff" }}>{goal.name}</Text>
          <Text numberOfLines={1} style={{ marginTop: 5, fontSize: 22, fontWeight: "800", letterSpacing: -0.7, color: "#fff" }}>
            {money(held)}
          </Text>
          <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 12, color: INK.softer }}>
            de {money(Number(goal.target_amount) || 0)} · {percent}%
          </Text>
        </View>

        <ChevronRight size={16} color={INK.faint} />
      </View>

      <View style={{ marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)", flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flexShrink: 1 }}>
          <Text numberOfLines={1} style={{ fontSize: 11.5, color: pace.late ? RED : INK.softer }}>{left}</Text>
          {leftValue ? (
            <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 14, fontWeight: "700", color: "#fff" }}>
              {leftValue}
              {leftNote ? <Text style={{ fontWeight: "500", color: INK.softer }}> {leftNote}</Text> : null}
            </Text>
          ) : null}
        </View>
        {right ? (
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 11.5, color: INK.softer }}>Previsão</Text>
            <Text style={{ marginTop: 2, fontSize: 14, fontWeight: "700", color: "#fff" }}>{right.replace("até ", "")}</Text>
          </View>
        ) : null}
      </View>
    </Surface>
  );
}
