import { useEffect, useRef, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { INK } from "~/theme/tokens";

/**
 * The moment the thing exists.
 *
 * Whatever was made — its own mark, so an account arrives as that bank and a caixinha
 * as that goal — springs in at the middle, a ring leaves it and fades, and a few
 * points fly off in every direction and go out. Then its name, and what it is.
 * It closes by itself after a few seconds; the button is for the impatient.
 */

const SPARKS = 14;
const AUTO_CLOSE_MS = 3200;

export default function Created({
  mark,
  accent,
  title,
  subtitle,
  onClose,
}: {
  mark: ReactNode;
  accent: string;
  title: string;
  subtitle: string;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const pop = useSharedValue(0);
  /* The parent re-renders as it closes; the animation must not start over for it. */
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    pop.set(withSequence(withTiming(0, { duration: 40 }), withSpring(1, { duration: 700, dampingRatio: 0.42, reduceMotion: ReduceMotion.System })));
    const t = setTimeout(() => close.current(), AUTO_CLOSE_MS);
    return () => clearTimeout(t);
  }, [pop]);

  const markStyle = useAnimatedStyle(() => ({
    opacity: Math.min(pop.get() * 3, 1),
    transform: [{ scale: 0.3 + pop.get() * 0.7 }],
  }));

  return (
    <View style={{ flex: 1, alignItems: "center", paddingTop: 70, paddingBottom: insets.bottom + 18, paddingHorizontal: 28 }}>
      <View style={{ width: 220, height: 220, alignItems: "center", justifyContent: "center" }}>
        <Ring accent={accent} delay={120} />
        <Ring accent={accent} delay={340} />
        {Array.from({ length: SPARKS }, (_, i) => (
          <Spark key={i} index={i} accent={accent} />
        ))}
        <Animated.View style={markStyle}>
          <View
            style={{
              shadowColor: accent,
              shadowOpacity: 0.55,
              shadowRadius: 28,
              shadowOffset: { width: 0, height: 8 },
            }}
          >
            {mark}
          </View>
        </Animated.View>
      </View>

      <Animated.View entering={FadeInDown.delay(520).duration(420)} style={{ marginTop: 22, alignItems: "center" }}>
        <Text style={{ fontSize: 28, fontWeight: "800", letterSpacing: -0.9, color: "#fff", textAlign: "center" }}>{title}</Text>
        <Text style={{ marginTop: 8, fontSize: 15, lineHeight: 21, color: INK.soft, textAlign: "center" }}>{subtitle.replace(/R\$\s/g, "R$ ")}</Text>
      </Animated.View>

      <View style={{ flex: 1 }} />

      <Animated.View entering={FadeInDown.delay(900).duration(380)} style={{ alignSelf: "stretch" }}>
        <Pressable
          onPress={onClose}
          style={({ pressed }) => ({
            height: 54,
            borderRadius: 27,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(255,255,255,0.12)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.16)",
            transform: [{ scale: pressed ? 0.98 : 1 }],
          })}
        >
          <Text style={{ fontSize: 16.5, fontWeight: "700", color: "#fff" }}>Pronto</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

/** A circle that leaves the mark and thins out as it goes. */
function Ring({ accent, delay }: { accent: string; delay: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withDelay(delay, withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System })));
  }, [delay, t]);
  const style = useAnimatedStyle(() => ({
    opacity: (1 - t.get()) * 0.7,
    transform: [{ scale: 0.55 + t.get() * 1.25 }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: "absolute", width: 150, height: 150, borderRadius: 75, borderWidth: 2, borderColor: accent },
        style,
      ]}
    />
  );
}

/** One of the points that fly off: its own direction, its own distance. */
function Spark({ index, accent }: { index: number; accent: string }) {
  const t = useSharedValue(0);
  const angle = (index / SPARKS) * Math.PI * 2 + (index % 2) * 0.18;
  const reach = 82 + (index % 3) * 18;
  const size = 5 + (index % 3) * 2;

  useEffect(() => {
    t.set(withDelay(160 + (index % 4) * 50, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System })));
  }, [index, t]);

  const style = useAnimatedStyle(() => ({
    opacity: t.get() < 0.15 ? t.get() / 0.15 : 1 - (t.get() - 0.15) / 0.85,
    transform: [
      { translateX: Math.cos(angle) * reach * t.get() },
      { translateY: Math.sin(angle) * reach * t.get() },
      { scale: 1 - t.get() * 0.6 },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: index % 3 === 0 ? "#fff" : accent,
        },
        style,
      ]}
    />
  );
}
