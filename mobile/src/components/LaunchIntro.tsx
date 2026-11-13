import { useEffect } from "react";
import { Image, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Defs, Ellipse, Path, RadialGradient, Stop } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { GROUND } from "~/theme/tokens";

/**
 * Willo waking up — the whole opening, under two seconds.
 *
 * In the dark, his two eyes light up: the same eyes as on the robot of the home and on
 * the app's icon, so the first thing anyone sees is who will be keeping them company.
 * He blinks, smiles with his eyes, and his name comes up under him. Then the way in is
 * through him: the eyes come towards the screen and open onto the app, which is already
 * there behind.
 *
 * One clock; every step is a window of it. With reduced motion: the eyes and the name,
 * a moment, and the fade.
 */

const ON = [80, 380] as const; // the eyes light up
const BLINK = [520, 700] as const; // one blink
const SMILE = [760, 980] as const; // the eyes turn into a smile
const NAME = [820, 1180] as const; // his name comes up under him
const IN = [1420, 1880] as const; // into the app, through his eyes
export const LAUNCH_INTRO_MS = IN[1] + 20;
const QUICK = [500, 850] as const;
/** A breath on the plain ground before anything moves, once the app is built underneath. */
const START_AFTER = 380;

/* His face's own colours (WilloBot). */
const WHITE = "#EEF6FF";
const COLD = "#6FA8E8";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const WORD = require("../../assets/images/intro/wordmark.png"); // 725 × 222, "willo." in white
const WORD_RATIO = 222 / 725;

function clamp01(v: number) {
  "worklet";
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
function span(t: number, a: number, b: number) {
  "worklet";
  return clamp01((t - a) / (b - a));
}
function outCubic(v: number) {
  "worklet";
  return 1 - (1 - v) ** 3;
}
function inCubic(v: number) {
  "worklet";
  return v * v * v;
}
function inOutCubic(v: number) {
  "worklet";
  return v < 0.5 ? 4 * v * v * v : 1 - (-2 * v + 2) ** 3 / 2;
}
function backOut(v: number) {
  "worklet";
  const s = 1.6;
  return 1 + (s + 1) * (v - 1) ** 3 + s * (v - 1) ** 2;
}
function mix(a: number, b: number, v: number) {
  "worklet";
  return a + (b - a) * v;
}

export default function LaunchIntro({ onDone }: { onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const t = useSharedValue(0);

  /* The face a little above the middle; the name under it. */
  const eyeW = Math.round(Math.min(width * 0.05, 22));
  const eyeH = Math.round(eyeW * 2);
  const gap = eyeW * 2.6; // between the two eyes' centres
  const cx = width / 2;
  const cy = height * 0.45;
  const wordW = Math.min(width * 0.34, 150);
  const wordH = wordW * WORD_RATIO;

  useEffect(() => {
    const end = reduced ? QUICK[1] : LAUNCH_INTRO_MS;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let cancelled = false;
    /* The clock starts only once the screen is free (the phone's launch screen gone, the
       app built underneath): a frame dropped then would make him jump. */
    const start = () => {
      if (cancelled) return;
      t.set(withTiming(end, { duration: end, easing: Easing.linear }));
      const tap = (style: Haptics.ImpactFeedbackStyle) => () => void Haptics.impactAsync(style).catch(() => undefined);
      if (!reduced) {
        timers.push(setTimeout(tap(Haptics.ImpactFeedbackStyle.Soft), BLINK[0] + 90));
        timers.push(setTimeout(tap(Haptics.ImpactFeedbackStyle.Light), SMILE[0] + 120));
      }
      timers.push(setTimeout(onDone, end + 30));
    };
    requestAnimationFrame(() => requestAnimationFrame(() => timers.push(setTimeout(start, START_AFTER))));
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
    // Once, on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* The ground: there until the way in, then gone with him. */
  const ground = useAnimatedStyle(() => {
    const now = t.get();
    const out = reduced ? span(now, QUICK[0], QUICK[1]) : inOutCubic(span(now, IN[0], IN[1]));
    return { opacity: 1 - out };
  });

  /* The face: lighting up, then coming towards the screen on the way in. */
  const face = useAnimatedStyle(() => {
    const now = t.get();
    if (reduced) return { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] };
    const on = outCubic(span(now, ON[0], ON[1]));
    const go = inCubic(span(now, IN[0], IN[1]));
    return {
      opacity: on * (1 - span(now, IN[0] + 160, IN[1])),
      transform: [{ translateY: mix(10, 0, on) - go * eyeH * 0.6 }, { scale: mix(0.7, 1, backOut(on)) * mix(1, 7, go) }],
    };
  });

  /* The open eyes: a blink, then giving way to the smile. */
  const open = useAnimatedStyle(() => {
    const now = t.get();
    const b = span(now, BLINK[0], BLINK[1]);
    const squash = b === 0 || b === 1 ? 1 : 1 - Math.sin(b * Math.PI) * 0.9;
    return { opacity: reduced ? 1 : 1 - span(now, SMILE[0], SMILE[0] + 140), transform: [{ scaleY: squash }] };
  });
  const smile = useAnimatedStyle(() => {
    const v = reduced ? 0 : outCubic(span(t.get(), SMILE[0] + 60, SMILE[1]));
    return { opacity: v, transform: [{ translateY: mix(4, 0, v) }, { scale: mix(0.85, 1, v) }] };
  });

  /* The name: up under him, and away first on the way in. */
  const name = useAnimatedStyle(() => {
    const now = t.get();
    const v = reduced ? 1 : outCubic(span(now, NAME[0], NAME[1]));
    const out = reduced ? 0 : span(now, IN[0], IN[0] + 220);
    return { opacity: v * (1 - out), transform: [{ translateY: mix(14, 0, v) }] };
  });

  const box = gap + eyeW * 3; // the face's square
  const left = cx - box / 2;
  const top = cy - box / 2;
  const eyes = [-gap / 2, gap / 2];
  const arc = `M${eyeW * 0.3} ${eyeW * 1.05}Q${eyeW * 1.1} ${-eyeW * 0.35} ${eyeW * 1.9} ${eyeW * 1.05}`;

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: GROUND, zIndex: 100, overflow: "hidden" }, ground]}>
      <Animated.View style={[{ position: "absolute", left, top, width: box, height: box }, face]}>
        {/* The glow the eyes throw. */}
        <Svg width={box} height={box} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="intro-glow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={COLD} stopOpacity={0.34} />
              <Stop offset="1" stopColor={COLD} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={box / 2} cy={box / 2} rx={box / 2} ry={box * 0.42} fill="url(#intro-glow)" />
        </Svg>

        {eyes.map((dx) => (
          <View key={dx} style={{ position: "absolute", left: box / 2 + dx - eyeW / 2, top: box / 2 - eyeH / 2, width: eyeW, height: eyeH }}>
            {/* Open: a pill of light. */}
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                { borderRadius: eyeW / 2, backgroundColor: WHITE, shadowColor: COLD, shadowOpacity: 0.9, shadowRadius: eyeW * 0.8, shadowOffset: { width: 0, height: 0 } },
                open,
              ]}
            />
            {/* Smiling: shut in an arc. */}
            <Animated.View style={[{ position: "absolute", left: -eyeW * 0.6, top: eyeH * 0.18, width: eyeW * 2.2, height: eyeW * 1.4 }, smile]}>
              <Svg width={eyeW * 2.2} height={eyeW * 1.4}>
                <Path d={arc} stroke={COLD} strokeOpacity={0.35} strokeWidth={eyeW * 0.78} strokeLinecap="round" fill="none" />
                <Path d={arc} stroke={WHITE} strokeWidth={eyeW * 0.46} strokeLinecap="round" fill="none" />
              </Svg>
            </Animated.View>
          </View>
        ))}
      </Animated.View>

      <Animated.View style={[{ position: "absolute", left: cx - wordW / 2, top: top + box + 18, width: wordW, height: wordH }, name]}>
        <Image source={WORD} style={{ width: wordW, height: wordH }} resizeMode="stretch" />
      </Animated.View>
    </Animated.View>
  );
}
