import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import Animated, { Easing, FadeIn, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { Check, X } from "~/components/icons";
import { loudnessOf } from "~/lib/voice";

/**
 * Speaking an entry instead of typing it: the screen goes soft behind a blur and only the voice
 * is left — a band of light bars, mirrored from the middle, rising and falling with how loud the
 * person is (the newest sound at the centre, the older spreading out), in the Willo Flow's
 * colours. "Ouvindo…" while they speak; when they stop (a short silence, or Pronto) it reads
 * "Anotando…" and the bars settle into a slow breath until what was heard is filled in.
 */

const BARS = 15; // each side of the middle
const COLORS = ["#eee0ff", "#c8aaff", "#79e2ca", "#c8aaff", "#ffc08b"];

export type VoiceStage = "off" | "on" | "reading";

export default function VoiceOverlay({ stage, level, onCancel, onStop }: { stage: VoiceStage; level?: number; onCancel: () => void; onStop: () => void }) {
  const reduce = useReducedMotion();
  /* The last few loudnesses, newest first: the middle bar is now, the outer ones a moment ago. */
  const [trail, setTrail] = useState<number[]>(() => Array(BARS + 1).fill(0));
  const last = useRef(0);
  useEffect(() => {
    if (stage !== "on" || typeof level !== "number") return;
    const now = Date.now();
    if (now - last.current < 55) return;
    last.current = now;
    const loud = loudnessOf(level) ?? 0;
    setTrail((t) => [loud, ...t.slice(0, BARS)]);
  }, [level, stage]);
  useEffect(() => {
    if (stage === "on") setTrail(Array(BARS + 1).fill(0));
  }, [stage]);

  /* While it reads, a slow breath instead of the voice. */
  const breath = useSharedValue(0);
  useEffect(() => {
    if (stage === "reading" && !reduce) breath.set(withRepeat(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }), -1, true));
    else {
      cancelAnimation(breath);
      breath.set(0);
    }
  }, [stage, reduce, breath]);

  const reading = stage === "reading";
  return (
    <Modal visible={stage !== "off"} transparent animationType="fade" statusBarTranslucent onRequestClose={onCancel}>
      <BlurView intensity={55} tint="dark" style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: "rgba(6,6,10,0.42)", alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
          <Animated.View entering={FadeIn.duration(220)} style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 22, fontWeight: "600", letterSpacing: -0.4, color: "#f5f5f7" }}>{reading ? "Anotando…" : "Ouvindo…"}</Text>
            <Text style={{ marginTop: 8, fontSize: 14.5, color: "rgba(245,245,247,0.6)", textAlign: "center" }}>
              {reading ? "Já preencho o que você disse." : "Diga o valor, com o que foi e a conta."}
            </Text>
          </Animated.View>

          {/* The voice: mirrored bars from the middle. */}
          <View style={{ marginTop: 46, height: 150, flexDirection: "row", alignItems: "center", gap: 5 }}>
            {[...trail.slice(1).reverse(), ...trail].map((v, i) => {
              const fromMid = Math.abs(i - BARS);
              return <Bar key={i} loud={reading ? 0.12 : v} weight={1 - fromMid / (BARS + 3)} color={COLORS[fromMid % COLORS.length]} breath={breath} />;
            })}
          </View>

          <View style={{ position: "absolute", bottom: 70, flexDirection: "row", alignItems: "center", gap: 34 }}>
            <Pressable onPress={onCancel} accessibilityRole="button" accessibilityLabel="Cancelar" hitSlop={8} style={({ pressed }) => ({ width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)", opacity: pressed ? 0.7 : 1 })}>
              <X size={24} color="#f5f5f7" strokeWidth={2.2} />
            </Pressable>
            <Pressable
              onPress={onStop}
              disabled={reading}
              accessibilityRole="button"
              accessibilityLabel="Pronto"
              hitSlop={8}
              style={({ pressed }) => ({ width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", backgroundColor: "#f5f5f7", opacity: reading ? 0.4 : pressed ? 0.85 : 1 })}
            >
              <Check size={30} color="#171719" strokeWidth={2.6} />
            </Pressable>
          </View>
        </View>
      </BlurView>
    </Modal>
  );
}

function Bar({ loud, weight, color, breath }: { loud: number; weight: number; color: string; breath: ReturnType<typeof useSharedValue<number>> }) {
  const h = useSharedValue(6);
  useEffect(() => {
    const target = 6 + Math.min(1, loud * 1.35) * 140 * Math.max(0.15, weight);
    h.set(withTiming(target, { duration: 110, easing: Easing.out(Easing.quad) }));
  }, [loud, weight, h]);
  const style = useAnimatedStyle(() => ({ height: h.get() + breath.get() * 18 * weight, opacity: 0.55 + 0.45 * weight }));
  return <Animated.View style={[{ width: 5, borderRadius: 3, backgroundColor: color, shadowColor: color, shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } }, style]} />;
}
