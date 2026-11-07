import { useEffect } from "react";
import { Image, Platform, StyleSheet, useWindowDimensions } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import Svg, { Defs, LinearGradient as SvgGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { GROUND } from "~/theme/tokens";
import { loadIntroSound } from "~/lib/introSounds";

/**
 * What plays when the app opens, over the app while it gets ready underneath.
 *
 * In acts, never two at once. The name writes itself out alone in the middle of the
 * dark screen, holds, and is drawn back in towards its dot. Three points of light —
 * orange, teal, violet — circle where it was and draw together; where they meet, each
 * blooms into one of the brand's cards, back card first, stacking into the mark: two
 * cards and, in front, the violet one shaped like a speech bubble. Willo's visor rises
 * on it, his eyes open, he blinks — and the mark dives towards the person, growing
 * until its violet card fills the screen with his eyes passing by, and the app is there
 * behind it.
 *
 * Every piece is the brand's own: the cards drawn in its colours, the visor, the eyes
 * and the name cut from the artwork. Everything runs on one clock, so each step is a
 * window of it and the order reads straight off the table below. With reduced motion
 * it is the finished mark and name, a moment, and a fade.
 */

const WORD_IN = [120, 820] as const; // the name writes itself out, alone
const WORD_OUT = [1300, 1640] as const; // and is drawn back in, towards its dot
const ORBIT = [1520, 2320] as const; // three points of light circle and draw in
const BLOOM = [2140, 520, 110] as const; // start, length, gap: each card blooms from the middle
const VISOR = [2650, 2920] as const;
const EYES = [2830, 3020] as const;
const BLINK = [3260, 3430] as const;
const DIVE = [3620, 4240] as const; // the mark grows past the screen
const REVEAL = [3900, 4300] as const; // and the app shows through
export const LAUNCH_INTRO_MS = REVEAL[1];
const QUICK = [900, 1250] as const;

const ORANGE: [string, string] = ["#FF5B1F", "#FFB23A"];
const TEAL: [string, string] = ["#10B5A0", "#57E6C4"];
const VIOLET: [string, string, string] = ["#C04DFF", "#6A2BF0", "#3712A6"];

const VISOR_IMG = require("../../assets/images/intro/head.png"); // 428 × 223
const EYES_IMG = require("../../assets/images/intro/eyes.png"); // 250 × 137
const WORD_IMG = require("../../assets/images/intro/wordmark.png"); // 725 × 222

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
function backOut(v: number, s = 1.5) {
  "worklet";
  const c = s + 1;
  return 1 + c * (v - 1) ** 3 + s * (v - 1) ** 2;
}
function mix(a: number, b: number, v: number) {
  "worklet";
  return a + (b - a) * v;
}

export default function LaunchIntro({ onDone }: { onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const t = useSharedValue(0);

  /* The mark: its cards are S wide; the name beside it is as tall as a card's middle. */
  const S = Math.min(width * 0.32, 140);
  const cardH = S * 0.56;
  const step = S * 0.17; // how far each card sits below the one behind it
  const markH = cardH + step * 2 + S * 0.1; // with the bubble's tail
  const wordH = S * 0.5;
  const wordW = (wordH * 725) / 222;
  const cx = width / 2;
  const cy = height / 2;

  useEffect(() => {
    const end = reduced ? QUICK[1] : LAUNCH_INTRO_MS;
    t.set(withTiming(end, { duration: end, easing: Easing.linear }));
    const sound = reduced ? null : loadIntroSound();
    const tap = (style: Haptics.ImpactFeedbackStyle) => () => void Haptics.impactAsync(style).catch(() => undefined);
    const timers = reduced
      ? []
      : [
          ...[0, 1, 2].map((i) => setTimeout(tap(Haptics.ImpactFeedbackStyle.Light), BLOOM[0] + i * BLOOM[2] + 120)),
          ...(sound ? [setTimeout(sound.play, BLINK[0])] : []),
          setTimeout(tap(Haptics.ImpactFeedbackStyle.Medium), DIVE[0] + 120),
        ];
    const done = setTimeout(onDone, end + 30);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(done);
      if (sound) setTimeout(sound.release, 1500);
    };
    // The intro plays once, as it mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* The whole of it: dark ground, then, at the end, see-through onto the app. */
  const shell = useAnimatedStyle(() => {
    const now = t.get();
    const out = reduced ? span(now, QUICK[0], QUICK[1]) : span(now, REVEAL[0], REVEAL[1]);
    return { opacity: 1 - outCubic(out) };
  });

  /* The mark, diving at the end. */
  const mark = useAnimatedStyle(() => {
    const dive = span(reduced ? 0 : t.get(), DIVE[0], DIVE[1]);
    const grow = dive <= 0 ? 1 : 1 + 26 * inCubic(dive) + 0.25 * dive;
    return { transform: [{ scale: grow }] };
  });

  /* The name, alone: written out from the left, then drawn back in from the left, so its
     dot is the last of it to go. */
  const wordClip = useAnimatedStyle(() => {
    const now = reduced ? 0 : t.get();
    const write = outCubic(span(now, WORD_IN[0] + 120, WORD_IN[1]));
    const back = inOutCubic(span(now, WORD_OUT[0], WORD_OUT[1]));
    return { width: wordW * write * (1 - back), transform: [{ translateX: wordW * back }] };
  });
  const wordInk = useAnimatedStyle(() => {
    const now = reduced ? 0 : t.get();
    const inn = outCubic(span(now, WORD_IN[0], WORD_IN[1]));
    const back = inOutCubic(span(now, WORD_OUT[0], WORD_OUT[1]));
    const fade = span(now, WORD_OUT[1] - 120, WORD_OUT[1]);
    return {
      opacity: clamp01(inn * 2) * (1 - fade),
      transform: [{ translateX: -wordW * back }, { translateY: (1 - inn) * 8 }],
    };
  });

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: GROUND, zIndex: 50 }, shell]}>
      {/* The three points of light, circling in. */}
      {!reduced && [0, 1, 2].map((i) => <Spark key={i} i={i} t={t} cx={cx} cy={cy} />)}

      {/* The mark: centred on the visor, so it dives into Willo's face. */}
      <Animated.View style={[{ position: "absolute", left: cx - S / 2, top: cy - markH / 2, width: S, height: markH, transformOrigin: [S / 2, step * 2 + cardH / 2, 0] }, mark]}>
        <Card t={t} reduced={reduced} i={0} S={S} h={cardH} top={0} colors={ORANGE} />
        <Card t={t} reduced={reduced} i={1} S={S} h={cardH} top={step} colors={TEAL} />
        <Card t={t} reduced={reduced} i={2} S={S} h={cardH} top={step * 2} colors={VIOLET} bubble />
        <Face t={t} reduced={reduced} S={S} top={step * 2} h={cardH} />
      </Animated.View>

      {/* The name, alone in the middle. */}
      {!reduced && (
        <Animated.View style={[{ position: "absolute", left: cx - wordW / 2, top: cy - wordH / 2, height: wordH, overflow: "hidden" }, wordClip]}>
          <Animated.View style={wordInk}>
            <Image source={WORD_IMG} style={{ width: wordW, height: wordH }} resizeMode="contain" />
          </Animated.View>
        </Animated.View>
      )}
    </Animated.View>
  );
}

/** One of the three points of light: circling the middle, drawing in, and gone as its card blooms. */
function Spark({ i, t, cx, cy }: { i: number; t: SharedValue<number>; cx: number; cy: number }) {
  const color = i === 0 ? ORANGE[1] : i === 1 ? TEAL[1] : VIOLET[0];
  const style = useAnimatedStyle(() => {
    const now = t.get();
    const v = span(now, ORBIT[0], ORBIT[1]);
    const angle = (i * 2 * Math.PI) / 3 + v * Math.PI * 2.4 - Math.PI / 2;
    const r = 42 * (1 - inCubic(v)) + 4;
    const appear = outCubic(span(now, ORBIT[0] + i * 90, ORBIT[0] + 300 + i * 90));
    const gone = span(now, BLOOM[0] + i * BLOOM[2], BLOOM[0] + i * BLOOM[2] + 160);
    return {
      opacity: appear * (1 - gone),
      transform: [{ translateX: Math.cos(angle) * r }, { translateY: Math.sin(angle) * r }, { scale: mix(0.4, 1, appear) * (1 + gone * 1.5) }],
    };
  });
  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: cx - 6,
          top: cy - 6,
          width: 12,
          height: 12,
          borderRadius: 6,
          backgroundColor: color,
          shadowColor: color,
          shadowOpacity: 0.9,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 0 },
        },
        style,
      ]}
    />
  );
}

/**
 * A card of the mark, drawn in the brand's colours: a rounded slab with a gradient, a
 * bright edge where the light catches it and a soft glow of its own colour. The front
 * one is a speech bubble, with a small tail at the middle of its foot.
 */
function Card({
  t,
  reduced,
  i,
  S,
  h,
  top,
  colors,
  bubble = false,
}: {
  t: SharedValue<number>;
  reduced: boolean;
  i: number;
  S: number;
  h: number;
  top: number;
  colors: string[];
  bubble?: boolean;
}) {
  /* Each card grows out of the middle of the mark. */
  const markMid = (h + S * 0.17 * 2 + S * 0.1) / 2;
  const w = bubble ? S : S * 0.94;
  const left = (S - w) / 2;
  const r = h * 0.36;
  const tail = bubble ? h * 0.2 : 0;
  const id = `intro-card-${i}`;
  const d = bubble
    ? `M${r} 0 H${w - r} Q${w} 0 ${w} ${r} V${h - r} Q${w} ${h} ${w - r} ${h} H${w / 2 + tail * 1.25} Q${w / 2 + tail * 0.4} ${h} ${w / 2 + tail * 0.25} ${h + tail * 0.55} Q${w / 2} ${h + tail} ${w / 2 - tail * 0.25} ${h + tail * 0.55} Q${w / 2 - tail * 0.4} ${h} ${w / 2 - tail * 1.25} ${h} H${r} Q0 ${h} 0 ${h - r} V${r} Q0 0 ${r} 0 Z`
    : `M${r} 0 H${w - r} Q${w} 0 ${w} ${r} V${h - r} Q${w} ${h} ${w - r} ${h} H${r} Q0 ${h} 0 ${h - r} V${r} Q0 0 ${r} 0 Z`;

  const style = useAnimatedStyle(() => {
    const now = reduced ? 99999 : t.get();
    const a = BLOOM[0] + i * BLOOM[2];
    const v = span(now, a, a + BLOOM[1]);
    /* From the middle of the mark to its place, growing from a point. */
    const s = v <= 0 ? 0.001 : mix(0.15, 1, backOut(v, 1.3));
    const fromY = markMid - (top + h / 2);
    return {
      opacity: clamp01(v * 3),
      transform: [{ translateY: fromY * (1 - outCubic(v)) }, { scale: s }],
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left,
          top,
          width: w,
          height: h + tail,
          /* A glow of its own colour, following its shape (on the phone; the web would draw a box). */
          ...(Platform.OS === "web" ? {} : { shadowColor: colors[1], shadowOpacity: 0.55, shadowRadius: 16, shadowOffset: { width: 0, height: 0 } }),
        },
        style,
      ]}
    >
      <Svg width={w} height={h + tail}>
        <Defs>
          <SvgGradient id={`${id}-fill`} x1="0" y1="0" x2="1" y2={bubble ? "1" : "0.2"}>
            <Stop offset="0" stopColor={colors[0]} />
            <Stop offset={bubble ? "0.5" : "1"} stopColor={colors[1]} />
            <Stop offset="1" stopColor={colors[2] ?? colors[1]} />
          </SvgGradient>
          <SvgGradient id={`${id}-shine`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.28} />
            <Stop offset="0.35" stopColor="#FFFFFF" stopOpacity={0.06} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </SvgGradient>
          <RadialGradient id={`${id}-glow`} cx="0.15" cy="0.5" r="0.6">
            <Stop offset="0" stopColor="#FF7BFF" stopOpacity={bubble ? 0.45 : 0} />
            <Stop offset="1" stopColor="#FF7BFF" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Path d={d} fill={`url(#${id}-fill)`} />
        <Path d={d} fill={`url(#${id}-glow)`} />
        <Path d={d} fill={`url(#${id}-shine)`} />
        {/* The bright rim where the light catches the top edge. */}
        <Path d={`M${r * 0.7} ${1.2} H${w - r * 0.7}`} stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth={1.2} strokeLinecap="round" />
        <Rect x={0.6} y={0.6} width={w - 1.2} height={h - 1.2} rx={r} fill="none" stroke="#FFFFFF" strokeOpacity={0.18} strokeWidth={1.2} />
      </Svg>
    </Animated.View>
  );
}

/** Willo's visor on the front card, and his eyes, which open and blink. */
function Face({ t, reduced, S, top, h }: { t: SharedValue<number>; reduced: boolean; S: number; top: number; h: number }) {
  const vw = S * 0.58;
  const vh = (vw * 223) / 428;
  const ew = vw * (250 / 428) * 0.92;
  const eh = (ew * 137) / 250;
  const vx = (S - vw) / 2;
  const vy = top + (h - vh) / 2;

  const visor = useAnimatedStyle(() => {
    const v = span(reduced ? 99999 : t.get(), VISOR[0], VISOR[1]);
    return { opacity: clamp01(v * 2.5), transform: [{ translateY: (1 - outCubic(v)) * 6 }, { scale: mix(0.6, 1, backOut(v, 1.6)) }] };
  });
  const eyes = useAnimatedStyle(() => {
    const now = reduced ? 99999 : t.get();
    const open = outCubic(span(now, EYES[0], EYES[1]));
    const b = span(now, BLINK[0], BLINK[1]);
    const blink = b > 0 && b < 1 ? Math.abs(Math.cos(b * Math.PI)) : 1;
    return { opacity: open > 0 ? 1 : 0, transform: [{ scaleY: Math.max(0.06, open * blink) }] };
  });

  return (
    <>
      <Animated.View style={[{ position: "absolute", left: vx, top: vy, width: vw, height: vh }, visor]}>
        <Image source={VISOR_IMG} style={{ width: vw, height: vh }} />
      </Animated.View>
      <Animated.View style={[{ position: "absolute", left: (S - ew) / 2, top: vy + (vh - eh) / 2, width: ew, height: eh }, eyes]}>
        <Image source={EYES_IMG} style={{ width: ew, height: eh }} />
      </Animated.View>
    </>
  );
}
