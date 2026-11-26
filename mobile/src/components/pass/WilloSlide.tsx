import { useEffect, useRef, useState } from "react";
import { Platform, Text, View } from "react-native";
import Animated, { Easing, cancelAnimation, runOnJS, useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { ArrowRight } from "~/components/icons";
import { passTheme } from "./passTheme";

/**
 * Willo Slide (Implementação 001): the confirmation the finger slides across.
 *
 * A track 58 high, a knob of 48 four or five in from its edge. Around the knob an orbital light
 * turns every 2.4 s — a conic gradient clear until 165°, a lilac at 220°, #c9b5ff at 290°, white
 * at 320° and clear again by 350° (assets/images/brand/orbit.png). Behind the knob a lilac trail
 * follows it. The words go in 160 ms once the knob has moved 2.5 % and come back in 230 ms if
 * it is let go short. Only at 96 % is it confirmed; let go before, it slides back and nothing is
 * written. A screen reader's "activate" confirms it too.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ORBIT = require("../../../assets/images/brand/orbit.png") as number;
const H = 58;
const KNOB = 48;
const PAD = 5;
const RING = KNOB + 6;

export default function WilloSlide({ label = "Deslize para confirmar", busy, onConfirm }: { label?: string; busy: boolean; onConfirm: () => void }) {
  const t = passTheme();
  const [w, setW] = useState(0);
  const max = Math.max(0, w - KNOB - PAD * 2);
  const x = useSharedValue(0);
  const turn = useSharedValue(0);
  const fired = useRef(false);

  useEffect(() => {
    turn.set(withRepeat(withTiming(360, { duration: 2400, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(turn);
  }, [turn]);

  const fire = () => {
    if (fired.current) return;
    fired.current = true;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    onConfirm();
  };

  const pan = Gesture.Pan()
    .enabled(!busy && max > 0)
    .activeOffsetX([-4, 4])
    .failOffsetY([-26, 26])
    .onUpdate((e) => {
      x.set(Math.min(max, Math.max(0, e.translationX)));
    })
    .onEnd(() => {
      if (x.get() >= max * 0.96) {
        x.set(withTiming(max, { duration: 90 }));
        runOnJS(fire)();
      } else {
        x.set(withSpring(0, { duration: 420, dampingRatio: 0.82 }));
      }
    })
    .onFinalize((_, ok) => {
      if (!ok && x.get() < max * 0.96) x.set(withSpring(0, { duration: 420, dampingRatio: 0.82 }));
    });

  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  const ring = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }, { rotate: `${turn.get()}deg` }] }));
  const trail = useAnimatedStyle(() => ({ width: x.get() + KNOB / 2 + PAD }));
  const words = useAnimatedStyle(() => {
    const gone = max > 0 && x.get() > max * 0.025;
    return { opacity: withTiming(gone ? 0 : 1, { duration: gone ? 160 : 230 }) };
  });

  /* The same confirmation without the gesture: a screen reader's "activate", or Enter / Space
     on a keyboard (the track takes focus). */
  const a11y =
    Platform.OS === "web"
      ? {
          focusable: true,
          onKeyDown: (e: { nativeEvent: { key: string }; preventDefault?: () => void }) => {
            if (busy || (e.nativeEvent.key !== "Enter" && e.nativeEvent.key !== " ")) return;
            e.preventDefault?.();
            x.set(withTiming(max, { duration: 160 }));
            fire();
          },
        }
      : { accessibilityActions: [{ name: "activate" as const }], onAccessibilityAction: () => !busy && fire() };
  return (
    <GestureDetector gesture={pan}>
      <View
        onLayout={(e) => setW(e.nativeEvent.layout.width)}
        accessible
        accessibilityRole="button"
        accessibilityLabel="Confirmar transação"
        accessibilityHint="Deslize para a direita ou ative para confirmar"
        accessibilityState={{ disabled: busy }}
        {...a11y}
        style={{ height: H, borderRadius: 40, borderWidth: 1, borderColor: t.line, backgroundColor: t.track, overflow: "hidden" }}
      >
        {/* The lilac trail behind the knob, soft at its tail. */}
        <Animated.View pointerEvents="none" style={[{ position: "absolute", left: 0, top: 0, bottom: 0 }, trail]}>
          <LinearGradient colors={["rgba(187,166,245,0)", "rgba(187,166,245,0.22)", "rgba(187,166,245,0.5)"]} locations={[0, 0.55, 1]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1, borderRadius: 40 }} />
        </Animated.View>
        <Animated.View pointerEvents="none" style={[{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center", paddingLeft: 35 }, words]}>
          <Text style={{ fontSize: 15, fontWeight: "500", color: t.muted }}>{label}</Text>
        </Animated.View>
        {/* The orbital light, turning around the knob. */}
        <Animated.Image pointerEvents="none" source={ORBIT} style={[{ position: "absolute", left: PAD - 3, top: PAD - 3, width: RING, height: RING }, ring]} />
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              left: PAD,
              top: PAD,
              width: KNOB,
              height: KNOB,
              borderRadius: KNOB / 2,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: t.knob,
              shadowColor: "#c9b5ff",
              shadowOpacity: 1,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 0 },
            },
            knob,
          ]}
        >
          <ArrowRight size={21} color={t.knobInk} strokeWidth={2.4} />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

/** Where the knob's centre ends, in the slide's own frame: for the particles to start from. */
export const slideKnobEnd = (width: number) => ({ x: width - PAD - KNOB / 2, y: H / 2 });
export const SLIDE_H = H;
