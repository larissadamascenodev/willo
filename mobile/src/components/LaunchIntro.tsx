import { useEffect } from "react";
import { Image, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, { Easing, interpolateColor, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { GROUND } from "~/theme/tokens";

/**
 * Willo waking up, and becoming his name — one line, about two and a half seconds.
 *
 * His eyes are the two l's of "willo". In the dark a soft light comes up where the l's
 * will be and his eyes open into it, from a line to two pills of light. He glances to one
 * side and the other and blinks. Then his eyes stretch up — with a little give, past the
 * mark and back — and turn into the l's themselves, cooling from his blue light to the
 * logo's white. As they land, "wi" is pushed out from behind the first l to the left and
 * "o." from behind the second to the right. The logo settles, and the dark lifts slowly
 * off the app as the logo sinks back a touch and fades.
 *
 * No picture is swapped for another: the eyes are the l's to the end.
 *
 * One clock; every step is a window of it. With reduced motion: the logo, a moment, and
 * the fade.
 */

const BLOOM = [0, 420] as const; // the light comes up where the l's will be
const OPEN = [140, 520] as const; // the eyes open, line to pill
const LOOK = [600, 1000] as const; // a glance to one side and the other
const BLINK = [1040, 1200] as const; // one blink
const STRETCH = [1300, 1720] as const; // the eyes stretch up into the l's, with a little give
const PUSH = [1520, 1960] as const; // "wi" and "o." pushed out from behind them
const OUT = [2200, 2700] as const; // the logo sinks back as the dark lifts
export const LAUNCH_INTRO_MS = OUT[1] + 20;
const QUICK = [500, 900] as const;
/** A breath on the plain ground before anything moves, once the app is built underneath. */
const START_AFTER = 300;

/* His face's own colours (WilloBot), and the logo's white. */
const EYE = "#EEF6FF";
const COLD = "#6FA8E8";
const LOGO = "#FFFFFF";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const WORD = require("../../assets/images/intro/wordmark.png"); // "willo." in white
/* The wordmark, in its own pixels (measured from the picture). */
const PX = { w: 725, h: 222 };
const L_X = [335, 409]; // where each l starts
const L_W = 56;
const L_TOP = 5;
const L_BOTTOM = 214;
/** The l's own rounding at top and foot, as a share of their width. */
const L_ROUND = 0.32;
const LEFT_END = 328; // "wi" ends before here
const RIGHT_START = 470; // "o." starts here
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
/** A soft spring: past the mark a little, and back. */
function spring(v: number) {
  "worklet";
  if (v <= 0) return 0;
  if (v >= 1) return 1;
  return 1 - Math.exp(-6.5 * v) * Math.cos(8.5 * v);
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

  const eyeW = L_W * u;
  const eyeH = eyeW * 2;
  const eyeMid = EYE_MID * u;
  const lTop = L_TOP * u;
  const lBottom = L_BOTTOM * u;
  const leftW = LEFT_END * u;
  const rightX = RIGHT_START * u;
  const rightW = (PX.w - RIGHT_START) * u;
  const glowSize = wordW * 0.95;
  const glowX = (L_X[0] + (L_X[1] + L_W - L_X[0]) / 2) * u;

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
        timers.push(setTimeout(tap(Haptics.ImpactFeedbackStyle.Light), STRETCH[0] + 160));
        timers.push(setTimeout(tap(Haptics.ImpactFeedbackStyle.Soft), PUSH[0] + 200));
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

  /* The dark: lifting slowly off the app, a beat after the logo begins to go. */
  const ground = useAnimatedStyle(() => {
    const now = t.get();
    const out = reduced ? span(now, QUICK[0], QUICK[1]) : inOutSine(span(now, OUT[0] + 100, OUT[1]));
    return { opacity: 1 - out };
  });

  /* The logo: settled, then sinking back a touch and fading as the app comes up. */
  const logo = useAnimatedStyle(() => {
    const now = t.get();
    const out = reduced ? 0 : inOutCubic(span(now, OUT[0], OUT[1] - 80));
    return { opacity: 1 - out, transform: [{ scale: 1 - out * 0.06 }] };
  });

  /* The light behind the eyes: up first, gone as they become letters. */
  const glow = useAnimatedStyle(() => {
    const now = t.get();
    if (reduced) return { opacity: 0, transform: [{ scale: 1 }] };
    const up = outCubic(span(now, BLOOM[0], BLOOM[1]));
    const away = inOutCubic(span(now, STRETCH[0], PUSH[1]));
    return { opacity: up * (1 - away), transform: [{ scale: mix(0.5, 1, up) * mix(1.4, 1, away) }] };
  });

  /* The pair: the glance, and back to centre before they stretch. */
  const pair = useAnimatedStyle(() => {
    const now = t.get();
    if (reduced) return { transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }, { translateX: 0 }, { translateY: 0 }] };
    const g = span(now, LOOK[0], LOOK[1]);
    /* left, hold, right, hold, centre */
    const x = g < 0.25 ? -inOutCubic(g / 0.25) : g < 0.4 ? -1 : g < 0.65 ? mix(-1, 1, inOutCubic((g - 0.4) / 0.25)) : g < 0.8 ? 1 : mix(1, 0, inOutCubic((g - 0.8) / 0.2));
    /* Close up at first, a face; drawing back to the name's own size as they stretch. */
    const near = mix(1.5, 1, inOutCubic(span(now, STRETCH[0] - 120, STRETCH[1])));
    const dx = glowX - wordW / 2;
    const dy = eyeMid - wordH / 2;
    return { transform: [{ translateX: dx }, { translateY: dy }, { scale: near }, { translateX: -dx + x * eyeW * 0.4 }, { translateY: -dy }] };
  });

  /* An eye: from a line to a pill, a blink, then stretched up into its l — past the mark
     and back — its corners tightening and its light cooling to the logo's white. */
  const eye = useAnimatedStyle(() => {
    const now = t.get();
    if (reduced) return { top: lTop, height: lBottom - lTop, opacity: 1, borderRadius: eyeW * L_ROUND, backgroundColor: LOGO, shadowOpacity: 0 };
    const o = span(now, OPEN[0], OPEN[1]);
    const opening = o === 0 ? 0.06 : mix(0.06, 1, backOut(o, 1.4));
    const b = span(now, BLINK[0], BLINK[1]);
    const blink = b === 0 || b === 1 ? 1 : 1 - Math.sin(b * Math.PI) * 0.92;
    const sv = span(now, STRETCH[0], STRETCH[1]);
    const s = spring(sv);
    const h0 = eyeH * opening * blink;
    /* Before: a pill around its middle. After: the l, from its top to the line; the foot
       reaches the line a little before the top reaches the top, so it grows up from it. */
    const footV = clamp01(s * 1.25);
    const top = mix(eyeMid - h0 / 2, lTop, s);
    const bottom = mix(eyeMid + h0 / 2, lBottom, footV > 1 ? 1 : footV);
    const lit = inOutCubic(sv);
    return {
      top,
      height: Math.max(bottom - top, 1),
      opacity: clamp01(o * 4),
      borderRadius: mix(eyeW / 2, eyeW * L_ROUND, lit),
      backgroundColor: interpolateColor(lit, [0, 1], [EYE, LOGO]),
      shadowOpacity: 0.95 * (1 - lit),
    };
  });

  /* "wi" pushed out from behind the first l to the left; "o." from behind the second to
     the right — each sliding out of a window whose edge is the l. */
  const push = (now: number) => {
    "worklet";
    return reduced ? 1 : backOut(span(now, PUSH[0], PUSH[1]), 1.2);
  };
  const leftSlide = useAnimatedStyle(() => {
    const v = push(t.get());
    return { opacity: clamp01(span(t.get(), PUSH[0], PUSH[0] + 140) * (reduced ? 0 : 1) + (reduced ? 1 : 0)), transform: [{ translateX: mix(leftW, 0, v) }] };
  });
  const rightSlide = useAnimatedStyle(() => {
    const v = push(t.get());
    return { opacity: clamp01(span(t.get(), PUSH[0], PUSH[0] + 140) * (reduced ? 0 : 1) + (reduced ? 1 : 0)), transform: [{ translateX: mix(-rightW, 0, v) }] };
  });


  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: GROUND, zIndex: 100, overflow: "hidden" }, ground]}>
      <Animated.View style={[{ position: "absolute", left, top, width: wordW, height: wordH }, logo]}>
        {/* The light the eyes throw, centred on the two l's. */}
        <Animated.View style={[{ position: "absolute", left: glowX - glowSize / 2, top: eyeMid - glowSize / 2, width: glowSize, height: glowSize }, glow]}>
          <Svg width={glowSize} height={glowSize}>
            <Defs>
              <RadialGradient id="intro-glow" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={COLD} stopOpacity={0.34} />
                <Stop offset="0.45" stopColor={COLD} stopOpacity={0.1} />
                <Stop offset="1" stopColor={COLD} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Ellipse cx={glowSize / 2} cy={glowSize / 2} rx={glowSize / 2} ry={glowSize * 0.4} fill="url(#intro-glow)" />
          </Svg>
        </Animated.View>

        {/* "wi": a window that ends at the first l; the letters slide out of it leftwards. */}
        <View style={{ position: "absolute", left: 0, top: 0, width: leftW, height: wordH, overflow: "hidden" }}>
          <Animated.View style={leftSlide}>
            {/* Only "wi", cut out, so nothing else of the picture comes along. */}
            <View style={{ width: leftW, height: wordH, overflow: "hidden" }}>
              <Image source={WORD} style={{ width: wordW, height: wordH }} resizeMode="stretch" />
            </View>
          </Animated.View>
        </View>

        {/* "o.": a window that starts after the second l; out of it rightwards. */}
        <View style={{ position: "absolute", left: rightX, top: 0, width: rightW, height: wordH, overflow: "hidden" }}>
          <Animated.View style={rightSlide}>
            {/* Only "o.", cut out. */}
            <View style={{ width: rightW, height: wordH, overflow: "hidden" }}>
              <Image source={WORD} style={{ width: wordW, height: wordH, marginLeft: -rightX }} resizeMode="stretch" />
            </View>
          </Animated.View>
        </View>

        {/* His eyes, which are the l's. */}
        <Animated.View style={[StyleSheet.absoluteFill, pair]}>
          {L_X.map((x) => (
            <Animated.View key={x} style={[{ position: "absolute", left: x * u, width: eyeW, shadowColor: COLD, shadowRadius: eyeW * 0.8, shadowOffset: { width: 0, height: 0 } }, eye]} />
          ))}
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}
