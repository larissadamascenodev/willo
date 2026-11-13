import { useEffect } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { GROUND } from "~/theme/tokens";

/**
 * The way into Registro rápido from the back of the phone: Willo's eyes, a blink, and
 * gone — under half a second, while the sheet is already coming up behind. Whoever
 * taps twice wants to note something now; this says "it's me, go ahead" and never makes
 * them wait.
 */

const MS = 420;
const WHITE = "#EEF6FF";
const COLD = "#6FA8E8";

export default function QuickBlink({ onDone }: { onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const t = useSharedValue(0);

  useEffect(() => {
    t.set(withTiming(MS, { duration: MS, easing: Easing.linear }));
    const id = setTimeout(onDone, MS + 20);
    return () => clearTimeout(id);
    // Once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const eyeW = Math.round(Math.min(width * 0.05, 22));
  const eyeH = eyeW * 2;
  const gap = eyeW * 2.4;

  /* The dark and the eyes go together, from a little after the blink. */
  const ground = useAnimatedStyle(() => {
    const v = t.get();
    const out = v < 230 ? 0 : (v - 230) / (MS - 230);
    return { opacity: 1 - out * out * (3 - 2 * out) };
  });
  /* Up at once, one quick blink, open again. */
  const eye = useAnimatedStyle(() => {
    const v = t.get();
    const on = Math.min(v / 90, 1);
    const b = v < 110 ? 0 : v > 250 ? 1 : (v - 110) / 140;
    const blink = b === 0 || b === 1 ? 1 : 1 - Math.sin(b * Math.PI) * 0.92;
    return { opacity: on, transform: [{ scale: 0.85 + on * 0.15 }, { scaleY: blink }] };
  });

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: GROUND, zIndex: 100 }, ground]}>
      <View style={{ position: "absolute", left: width / 2 - gap / 2 - eyeW / 2, top: height * 0.45 - eyeH / 2, flexDirection: "row", gap: gap - eyeW }}>
        {[0, 1].map((k) => (
          <Animated.View
            key={k}
            style={[{ width: eyeW, height: eyeH, borderRadius: eyeW / 2, backgroundColor: WHITE, shadowColor: COLD, shadowOpacity: 0.95, shadowRadius: eyeW * 0.8, shadowOffset: { width: 0, height: 0 } }, eye]}
          />
        ))}
      </View>
    </Animated.View>
  );
}
