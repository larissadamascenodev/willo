import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Check } from "~/components/icons";
import { money } from "~/lib/money";
import { playCash } from "~/lib/sounds";
import { GREEN, INK } from "~/theme/tokens";

/**
 * The moment something lands — a sticker, like a payment app's "pago".
 *
 * It is stamped onto the thread: a round seal drops in a little too big, a little
 * turned, and settles; a ring of light pulses out of it once; the coins chime and the
 * phone taps back. Celebratory the first time and quick enough to be nothing the
 * hundredth. The amount, when there is one, is written on the seal.
 */
export default function Confirmado({ text, total, income = false }: { text: string; total?: number; income?: boolean }) {
  const stamp = useSharedValue(0);
  const ring = useSharedValue(0);

  useEffect(() => {
    stamp.set(withSpring(1, { damping: 11, stiffness: 260, mass: 0.8, reduceMotion: ReduceMotion.System }));
    ring.set(withDelay(120, withSequence(withTiming(1, { duration: 620, easing: Easing.out(Easing.cubic) }), withTiming(1, { duration: 0 }))));
    playCash();
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }, [stamp, ring]);

  const seal = useAnimatedStyle(() => ({
    opacity: Math.min(1, stamp.get() * 1.6),
    transform: [{ scale: 1.6 - stamp.get() * 0.6 }, { rotate: `${-14 + stamp.get() * 6}deg` }],
  }));
  const halo = useAnimatedStyle(() => ({
    opacity: (1 - ring.get()) * 0.6,
    transform: [{ scale: 0.8 + ring.get() * 0.9 }],
  }));

  const tone = income ? GREEN : "#7CC4FF";

  return (
    <View style={{ alignItems: "center", paddingVertical: 10 }}>
      <View style={{ width: 132, height: 132, alignItems: "center", justifyContent: "center" }}>
        <Animated.View
          pointerEvents="none"
          style={[{ position: "absolute", width: 132, height: 132, borderRadius: 66, borderWidth: 2, borderColor: tone }, halo]}
        />
        <Animated.View
          style={[
            {
              width: 112,
              height: 112,
              borderRadius: 56,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: `${tone}1F`,
              borderWidth: 2,
              borderColor: tone,
              borderStyle: "dashed",
            },
            seal,
          ]}
        >
          <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: tone }}>
            <Check size={19} color="#0B0B0B" strokeWidth={3.6} />
          </View>
          <Text style={{ marginTop: 6, fontSize: 13, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase", color: tone }}>{text}</Text>
          {total != null && total > 0 && (
            <Text style={{ marginTop: 1, fontSize: 12, fontWeight: "700", color: "#fff" }}>
              {income ? "+" : ""}
              {money(total)}
            </Text>
          )}
        </Animated.View>
      </View>
      <Animated.Text entering={FadeIn.delay(380).duration(300)} style={{ marginTop: 2, fontSize: 12.5, color: INK.softer }}>
        Está nas suas transações
      </Animated.Text>
    </View>
  );
}
