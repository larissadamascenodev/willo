import { useEffect } from "react";
import { Image, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Defs, Ellipse, Path, RadialGradient, Stop } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { GROUND } from "~/theme/tokens";

/**
 * Willo waking up, and becoming his name — one line, about two and a half seconds.
 *
 * His eyes are the two l's of "willo". In the dark a soft light comes up where the l's
 * will be, and his eyes open into it, from a line to two pills of light. He glances to one
 * side and the other, blinks, and smiles with his eyes, with a little hop. Then the eyes
 * open again and stretch up into the two l's, and the rest of the name grows out of them:
 * "wi" to the left, "o." to the right — the logo, whole, where his face was. On the way
 * out the logo grows a hair as the dark lifts slowly off the app behind it.
 *
 * One clock; every step is a window of it. With reduced motion: the logo, a moment, and
 * the fade.
 */

const BLOOM = [0, 380] as const; // the light comes up where the l's will be
const OPEN = [120, 480] as const; // the eyes open, line to pill
const LOOK = [560, 960] as const; // a glance to one side and the other
const BLINK = [1000, 1160] as const; // one blink
const SMILE = [1200, 1420] as const; // a smile with the eyes, and a little hop
const UNSMILE = [1460, 1580] as const; // the smile opens back into eyes
const STRETCH = [1560, 1900] as const; // the eyes stretch up into the two l's
const GROW = [1700, 2080] as const; // "wi" and "o." grow out of them
const SETTLE = [1980, 2140] as const; // the l's become the logo's own
const OUT = [2300, 2780] as const; // the logo grows a hair as the dark lifts
export const LAUNCH_INTRO_MS = OUT[1] + 20;
const QUICK = [500, 900] as const;
/** A breath on the plain ground before anything moves, once the app is built underneath. */
const START_AFTER = 320;

/* His face's own colours (WilloBot). */
const WHITE = "#EEF6FF";
const COLD = "#6FA8E8";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const WORD = require("../../assets/images/intro/wordmark.png"); // "willo." in white
/* The wordmark, in its own pixels (measured from the picture). */
const PX = { w: 725, h: 222 };
const L1 = { x: 335, w: 56 }; // the first l
const L2 = { x: 409, w: 56 }; // the second l
const L_TOP = 5;
const L_BOTTOM = 214;
const LEFT_END = 326; // "wi" ends before here
const RIGHT_START = 472; // "o." starts here
/** Where an eye sits on its l before it stretches: the middle of the lower letters. */
const EYE_MID = 150;

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
function backOut(v: number, s = 1.6) {
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

  /* The logo about three fifths of the screen wide, in the middle. */
  const wordW = Math.min(width * 0.6, 250);
  const u = wordW / PX.w;
  const wordH = PX.h * u;
  const left = (width - wordW) / 2;
  const top = (height - wordH) / 2 - height * 0.02;

  const eyeW = L1.w * u;
  const eyeH = eyeW * 2;
  const eyeTop = EYE_MID * u - eyeH / 2;
  const lTop = L_TOP * u;
  const lH = (L_BOTTOM - L_TOP) * u;
  const leftW = LEFT_END * u;
  const rightX = RIGHT_START * u;
  const rightW = (PX.w - RIGHT_START) * u;

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
        timers.push(setTimeout(tap(Haptics.ImpactFeedbackStyle.Soft), STRETCH[1] - 40));
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

  /* The dark: lifting slowly off the app. */
  const ground = useAnimatedStyle(() => {
    const now = t.get();
    const out = reduced ? span(now, QUICK[0], QUICK[1]) : inOutSine(span(now, OUT[0] + 80, OUT[1]));
    return { opacity: 1 - out };
  });

  /* The whole logo: a hair larger on the way out, fading with the dark. */
  const logo = useAnimatedStyle(() => {
    const now = t.get();
    const out = reduced ? 0 : inOutCubic(span(now, OUT[0], OUT[1]));
    return { opacity: 1 - out * 0.6, transform: [{ scale: 1 + out * 0.08 }] };
  });

  /* The light behind the eyes: up first, breathing with the smile, gone as the name grows. */
  const glow = useAnimatedStyle(() => {
    const now = t.get();
    if (reduced) return { opacity: 0, transform: [{ scale: 1 }] };
    const up = outCubic(span(now, BLOOM[0], BLOOM[1]));
    const smile = Math.sin(span(now, SMILE[0], SMILE[1]) * Math.PI);
    const away = inOutCubic(span(now, STRETCH[0], GROW[1]));
    return { opacity: up * (1 + smile * 0.3) * (1 - away), transform: [{ scale: mix(0.6, 1, up) * (1 + smile * 0.08) }] };
  });

  /* The eyes as a pair: the glance, and the hop of the smile. */
  const pair = useAnimatedStyle(() => {
    const now = t.get();
    if (reduced) return { opacity: 0, transform: [{ translateX: 0 }, { translateY: 0 }] };
    const g = span(now, LOOK[0], LOOK[1]);
    /* left, hold, right, hold, centre */
    const x = g < 0.25 ? -inOutCubic(g / 0.25) : g < 0.4 ? -1 : g < 0.65 ? mix(-1, 1, inOutCubic((g - 0.4) / 0.25)) : g < 0.8 ? 1 : mix(1, 0, inOutCubic((g - 0.8) / 0.2));
    const hop = Math.sin(span(now, SMILE[0], SMILE[1] + 80) * Math.PI) * eyeH * 0.25;
    /* Once the l's are the logo's own, the eyes give way to them. */
    return { opacity: 1 - span(now, SETTLE[0], SETTLE[1]), transform: [{ translateX: x * eyeW * 0.4 }, { translateY: -hop }] };
  });

  /* An open eye: from a line to a pill, a blink, shut in the smile and back, then
     stretched up into its l. */
  const eye = useAnimatedStyle(() => {
    const now = t.get();
    const o = span(now, OPEN[0], OPEN[1]);
    const opening = o === 0 ? 0.06 : mix(0.06, 1, backOut(o, 1.4));
    const b = span(now, BLINK[0], BLINK[1]);
    const blink = b === 0 || b === 1 ? 1 : 1 - Math.sin(b * Math.PI) * 0.92;
    const shut = span(now, SMILE[0], SMILE[0] + 120) * (1 - span(now, UNSMILE[0], UNSMILE[1]));
    const s = inOutCubic(span(now, STRETCH[0], STRETCH[1]));
    /* The pill's height opening around its middle; then its top rising to the l's top and
       its foot dropping to the line. */
    const h = eyeH * opening * blink;
    const midTop = eyeTop + (eyeH - h) / 2;
    const top = mix(midTop, lTop, s);
    const bottom = mix(midTop + h, lTop + lH, s);
    return { opacity: clamp01(o * 4) * (1 - shut), top, height: Math.max(bottom - top, 1) };
  });
  const smile = useAnimatedStyle(() => {
    const now = t.get();
    const v = outCubic(span(now, SMILE[0] + 60, SMILE[1])) * (1 - span(now, UNSMILE[0], UNSMILE[1]));
    return { opacity: v, transform: [{ translateY: mix(4, 0, v) }, { scale: mix(0.8, 1, v) }] };
  });

  /* "wi", growing out to the left of the l's; "o.", out to the right. */
  const grow = (now: number) => {
    "worklet";
    return reduced ? 1 : outCubic(span(now, GROW[0], GROW[1]));
  };
  const leftPart = useAnimatedStyle(() => {
    const v = grow(t.get());
    return { left: leftW * (1 - v), width: leftW * v, opacity: clamp01(v * 2) };
  });
  const leftImage = useAnimatedStyle(() => ({ transform: [{ translateX: -leftW * (1 - grow(t.get())) }] }));
  const rightPart = useAnimatedStyle(() => {
    const v = grow(t.get());
    return { width: rightW * v, opacity: clamp01(v * 2) };
  });
  /* The l's as the logo has them, in place of the stretched eyes. */
  const middle = useAnimatedStyle(() => ({ opacity: reduced ? 1 : span(t.get(), SETTLE[0], SETTLE[1]) }));

  const glowSize = wordW * 0.9;
  const arcW = eyeW * 1.5;
  const arc = `M${arcW * 0.12} ${eyeW * 0.9}Q${arcW * 0.5} ${-eyeW * 0.25} ${arcW * 0.88} ${eyeW * 0.9}`;
  const eyesAt = [L1.x * u, L2.x * u];

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: GROUND, zIndex: 100, overflow: "hidden" }, ground]}>
      <Animated.View style={[{ position: "absolute", left, top, width: wordW, height: wordH }, logo]}>
        {/* The light the eyes throw, centred on the two l's. */}
        <Animated.View
          style={[
            { position: "absolute", left: (L1.x + (L2.x + L2.w - L1.x) / 2) * u - glowSize / 2, top: EYE_MID * u - glowSize / 2, width: glowSize, height: glowSize },
            glow,
          ]}
        >
          <Svg width={glowSize} height={glowSize}>
            <Defs>
              <RadialGradient id="intro-glow" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={COLD} stopOpacity={0.32} />
                <Stop offset="0.45" stopColor={COLD} stopOpacity={0.1} />
                <Stop offset="1" stopColor={COLD} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Ellipse cx={glowSize / 2} cy={glowSize / 2} rx={glowSize / 2} ry={glowSize * 0.4} fill="url(#intro-glow)" />
          </Svg>
        </Animated.View>

        {/* "wi" */}
        <Animated.View style={[{ position: "absolute", top: 0, height: wordH, overflow: "hidden" }, leftPart]}>
          <Animated.View style={leftImage}>
            <Image source={WORD} style={{ width: wordW, height: wordH }} resizeMode="stretch" />
          </Animated.View>
        </Animated.View>

        {/* "o." */}
        <Animated.View style={[{ position: "absolute", left: rightX, top: 0, height: wordH, overflow: "hidden" }, rightPart]}>
          <Image source={WORD} style={{ width: wordW, height: wordH, marginLeft: -rightX }} resizeMode="stretch" />
        </Animated.View>

        {/* The logo's own l's, taking over from the eyes. */}
        <Animated.View style={[{ position: "absolute", left: leftW, top: 0, width: rightX - leftW, height: wordH, overflow: "hidden" }, middle]}>
          <Image source={WORD} style={{ width: wordW, height: wordH, marginLeft: -leftW }} resizeMode="stretch" />
        </Animated.View>

        {/* His eyes, which are the l's. */}
        <Animated.View style={[StyleSheet.absoluteFill, pair]}>
          {eyesAt.map((x) => (
            <View key={x} style={{ position: "absolute", left: x, top: 0, width: eyeW, height: wordH }}>
              <Animated.View
                style={[
                  { position: "absolute", left: 0, width: eyeW, borderRadius: eyeW / 2, backgroundColor: WHITE, shadowColor: COLD, shadowOpacity: 0.95, shadowRadius: eyeW * 0.8, shadowOffset: { width: 0, height: 0 } },
                  eye,
                ]}
              />
              <Animated.View style={[{ position: "absolute", left: (eyeW - arcW) / 2, top: EYE_MID * u - eyeW * 0.55, width: arcW, height: eyeW * 1.1 }, smile]}>
                <Svg width={arcW} height={eyeW * 1.1}>
                  <Path d={arc} stroke={COLD} strokeOpacity={0.35} strokeWidth={eyeW * 0.62} strokeLinecap="round" fill="none" />
                  <Path d={arc} stroke={WHITE} strokeWidth={eyeW * 0.38} strokeLinecap="round" fill="none" />
                </Svg>
              </Animated.View>
            </View>
          ))}
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}
