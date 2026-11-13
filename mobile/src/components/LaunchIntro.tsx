import { useEffect } from "react";
import { Image, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Defs, Ellipse, Path, RadialGradient, Stop } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { GROUND } from "~/theme/tokens";

/**
 * Willo waking up — the whole opening, in about two and a half seconds.
 *
 * In the dark a soft light blooms first, and his eyes open into it — from a thin line to
 * two pills of light, as a screen comes on. He looks to one side and the other, blinks,
 * and smiles with his eyes with a little hop. His name is written in under him. Then he
 * lets the app in gently: the name goes first, the smile opens back into eyes that grow
 * a little as they fade, and the dark lifts slowly off the app already there behind —
 * nothing is cut.
 *
 * One clock; every step is a window of it. With reduced motion: the eyes and the name,
 * a moment, and the fade.
 */

const BLOOM = [0, 420] as const; // the light comes up first
const OPEN = [140, 520] as const; // the eyes open, line to pill
const LOOK = [620, 1060] as const; // a glance to one side and the other
const BLINK = [1100, 1270] as const; // one blink
const SMILE = [1300, 1520] as const; // a smile with the eyes, and a little hop
const NAME = [1260, 1700] as const; // his name, written in under him
const NAME_OUT = [1880, 2120] as const; // the name goes first
const UNSMILE = [1900, 2080] as const; // the smile opens back into eyes
const OUT = [1960, 2560] as const; // the eyes grow a little as they fade; the dark lifts
export const LAUNCH_INTRO_MS = OUT[1] + 20;
const QUICK = [500, 900] as const;
/** A breath on the plain ground before anything moves, once the app is built underneath. */
const START_AFTER = 320;

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
function inOutCubic(v: number) {
  "worklet";
  return v < 0.5 ? 4 * v * v * v : 1 - (-2 * v + 2) ** 3 / 2;
}
function inOutSine(v: number) {
  "worklet";
  return -(Math.cos(Math.PI * v) - 1) / 2;
}
function backOut(v: number, s = 1.8) {
  "worklet";
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
        timers.push(setTimeout(tap(Haptics.ImpactFeedbackStyle.Soft), OPEN[0] + 220));
        timers.push(setTimeout(tap(Haptics.ImpactFeedbackStyle.Light), SMILE[0] + 140));
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

  /* The dark: lifting slowly off the app, starting a beat after the face begins to go. */
  const ground = useAnimatedStyle(() => {
    const now = t.get();
    const out = reduced ? span(now, QUICK[0], QUICK[1]) : inOutSine(span(now, OUT[0] + 120, OUT[1]));
    return { opacity: 1 - out };
  });

  /* The light behind the eyes: up first, breathing with them, gone with them. */
  const glow = useAnimatedStyle(() => {
    const now = t.get();
    if (reduced) return { opacity: 1, transform: [{ scale: 1 }] };
    const up = outCubic(span(now, BLOOM[0], BLOOM[1]));
    const smile = Math.sin(span(now, SMILE[0], SMILE[1]) * Math.PI);
    const out = inOutCubic(span(now, OUT[0], OUT[1]));
    return { opacity: up * (1 + smile * 0.25) * (1 - out), transform: [{ scale: mix(0.6, 1, up) * (1 + smile * 0.08) * mix(1, 1.6, out) }] };
  });

  /* The face as one: the hop of the smile, then growing a little as it fades. */
  const face = useAnimatedStyle(() => {
    const now = t.get();
    if (reduced) return { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] };
    const hop = Math.sin(span(now, SMILE[0], SMILE[1] + 80) * Math.PI) * eyeH * 0.22;
    const out = inOutCubic(span(now, OUT[0], OUT[1]));
    return { opacity: 1 - out, transform: [{ translateY: -hop }, { scale: mix(1, 1.9, out) }] };
  });

  /* Where the eyes look: a glance to one side, the other, and back. */
  const gaze = useAnimatedStyle(() => {
    const now = t.get();
    if (reduced) return { transform: [{ translateX: 0 }] };
    const g = span(now, LOOK[0], LOOK[1]);
    /* left, hold, right, hold, centre */
    const x = g < 0.25 ? -inOutCubic(g / 0.25) : g < 0.4 ? -1 : g < 0.65 ? mix(-1, 1, inOutCubic((g - 0.4) / 0.25)) : g < 0.8 ? 1 : mix(1, 0, inOutCubic((g - 0.8) / 0.2));
    return { transform: [{ translateX: x * eyeW * 0.45 }] };
  });

  /* The open eyes: from a line to a pill, a blink, giving way to the smile and back. */
  const open = useAnimatedStyle(() => {
    const now = t.get();
    if (reduced) return { opacity: 1, transform: [{ scaleY: 1 }] };
    const o = span(now, OPEN[0], OPEN[1]);
    const opening = o === 0 ? 0.06 : mix(0.06, 1, backOut(o, 1.4));
    const b = span(now, BLINK[0], BLINK[1]);
    const blink = b === 0 || b === 1 ? 1 : 1 - Math.sin(b * Math.PI) * 0.92;
    const shut = span(now, SMILE[0], SMILE[0] + 120) * (1 - span(now, UNSMILE[0], UNSMILE[1]));
    return { opacity: clamp01(o * 4) * (1 - shut), transform: [{ scaleY: opening * blink }] };
  });
  const smile = useAnimatedStyle(() => {
    const now = t.get();
    const v = reduced ? 0 : outCubic(span(now, SMILE[0] + 60, SMILE[1])) * (1 - span(now, UNSMILE[0], UNSMILE[1]));
    return { opacity: v, transform: [{ translateY: mix(5, 0, v) }, { scale: mix(0.8, 1, v) }] };
  });

  /* The name: written in from the left, rising a touch, and the first to go. */
  const nameBox = useAnimatedStyle(() => {
    const now = t.get();
    const v = reduced ? 1 : inOutCubic(span(now, NAME[0], NAME[1]));
    const out = reduced ? 0 : inOutCubic(span(now, NAME_OUT[0], NAME_OUT[1]));
    return { opacity: clamp01(v * 1.6) * (1 - out), transform: [{ translateY: mix(10, 0, v) - out * 8 }] };
  });
  const written = useAnimatedStyle(() => ({ width: wordW * (reduced ? 1 : outCubic(span(t.get(), NAME[0], NAME[1]))) }));

  const box = gap + eyeW * 3; // the face's square
  const left = cx - box / 2;
  const top = cy - box / 2;
  const eyes = [-gap / 2, gap / 2];
  const arc = `M${eyeW * 0.3} ${eyeW * 1.05}Q${eyeW * 1.1} ${-eyeW * 0.35} ${eyeW * 1.9} ${eyeW * 1.05}`;
  const glowSize = box * 2.2;

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: GROUND, zIndex: 100, overflow: "hidden" }, ground]}>
      {/* The light the eyes throw, wider than the face. */}
      <Animated.View style={[{ position: "absolute", left: cx - glowSize / 2, top: cy - glowSize / 2, width: glowSize, height: glowSize }, glow]}>
        <Svg width={glowSize} height={glowSize}>
          <Defs>
            <RadialGradient id="intro-glow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={COLD} stopOpacity={0.3} />
              <Stop offset="0.45" stopColor={COLD} stopOpacity={0.1} />
              <Stop offset="1" stopColor={COLD} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={glowSize / 2} cy={glowSize / 2} rx={glowSize / 2} ry={glowSize * 0.4} fill="url(#intro-glow)" />
        </Svg>
      </Animated.View>

      <Animated.View style={[{ position: "absolute", left, top, width: box, height: box }, face]}>
        <Animated.View style={[StyleSheet.absoluteFill, gaze]}>
          {eyes.map((dx) => (
            <View key={dx} style={{ position: "absolute", left: box / 2 + dx - eyeW / 2, top: box / 2 - eyeH / 2, width: eyeW, height: eyeH }}>
              {/* Open: a pill of light. */}
              <Animated.View
                style={[
                  StyleSheet.absoluteFill,
                  { borderRadius: eyeW / 2, backgroundColor: WHITE, shadowColor: COLD, shadowOpacity: 0.95, shadowRadius: eyeW * 0.9, shadowOffset: { width: 0, height: 0 } },
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
      </Animated.View>

      <Animated.View style={[{ position: "absolute", left: cx - wordW / 2, top: top + box + 18, width: wordW, height: wordH }, nameBox]}>
        <Animated.View style={[{ height: wordH, overflow: "hidden" }, written]}>
          <Image source={WORD} style={{ width: wordW, height: wordH }} resizeMode="stretch" />
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}
