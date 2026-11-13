import { useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { ChevronLeft, ChevronRight } from "~/components/icons";
import { INK } from "~/theme/tokens";
import { th } from "~/theme/theme";

/**
 * A tutorial one screen at a time: a drawing of the iPhone screen the person will see,
 * with a finger where to touch, then what to do in a sentence, and the way to the next
 * step. A step can carry its own button (Instalar atalho).
 */

export interface WalkStep {
  title: string;
  text: ReactNode;
  screen: ReactNode;
  action?: { label: string; onPress: () => void; icon?: ReactNode };
}

export default function Walkthrough({ steps, finish }: { steps: WalkStep[]; finish: string }) {
  const [at, setAt] = useState(0);
  const step = steps[at];
  const last = at === steps.length - 1;
  const tick = () => void Haptics.selectionAsync().catch(() => undefined);

  return (
    <View style={{ marginTop: 18 }}>
      <Animated.View key={at} entering={FadeIn.duration(220)}>
        {step.screen}
        <Text style={{ marginTop: 16, fontSize: 12, fontWeight: "700", letterSpacing: 1.2, color: th(INK.softer) }}>
          PASSO {at + 1} DE {steps.length}
        </Text>
        <Text style={{ marginTop: 4, fontSize: 20, fontWeight: "800", letterSpacing: -0.4, color: th("#fff") }}>{step.title}</Text>
        <Text style={{ marginTop: 6, fontSize: 14.5, lineHeight: 21, color: th(INK.soft) }}>{step.text}</Text>
        {step.action && (
          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
              step.action!.onPress();
            }}
            style={({ pressed }) => ({ marginTop: 14, height: 50, borderRadius: 25, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", backgroundColor: th("#fff", "bg"), opacity: pressed ? 0.85 : 1 })}
          >
            {step.action.icon}
            <Text style={{ fontSize: 15.5, fontWeight: "700", color: th("#0B0B0B") }}>{step.action.label}</Text>
          </Pressable>
        )}
        {last && (
          <View style={{ marginTop: 14, padding: 14, borderRadius: 18, backgroundColor: th("rgba(103,205,103,0.12)", "bg") }}>
            <Text style={{ fontSize: 14, lineHeight: 20, color: th("#fff") }}>{finish}</Text>
          </View>
        )}
      </Animated.View>

      {/* Where we are, and the way back and on. */}
      <View style={{ marginTop: 18, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable
          disabled={at === 0}
          onPress={() => {
            tick();
            setAt((n) => n - 1);
          }}
          accessibilityLabel="Passo anterior"
          style={({ pressed }) => ({ width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: th("rgba(255,255,255,0.08)", "bg"), opacity: at === 0 ? 0.35 : pressed ? 0.7 : 1 })}
        >
          <ChevronLeft size={20} color={th("#fff")} strokeWidth={2.4} />
        </Pressable>
        <View style={{ flex: 1, flexDirection: "row", justifyContent: "center", gap: 6 }}>
          {steps.map((_, i) => (
            <View key={i} style={{ width: i === at ? 18 : 7, height: 7, borderRadius: 4, backgroundColor: th(i === at ? "#fff" : "rgba(255,255,255,0.22)", "bg") }} />
          ))}
        </View>
        <Pressable
          disabled={last}
          onPress={() => {
            tick();
            setAt((n) => n + 1);
          }}
          accessibilityLabel="Próximo passo"
          style={({ pressed }) => ({ height: 46, paddingHorizontal: 18, borderRadius: 23, flexDirection: "row", gap: 4, alignItems: "center", justifyContent: "center", backgroundColor: th(last ? "rgba(255,255,255,0.08)" : "#fff", "bg"), opacity: last ? 0.35 : pressed ? 0.85 : 1 })}
        >
          <Text style={{ fontSize: 14.5, fontWeight: "700", color: th(last ? "#fff" : "#0B0B0B") }}>Próximo</Text>
          <ChevronRight size={16} color={th(last ? "#fff" : "#0B0B0B")} strokeWidth={2.4} />
        </Pressable>
      </View>
    </View>
  );
}
