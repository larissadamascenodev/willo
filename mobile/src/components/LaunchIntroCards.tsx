import { useEffect } from "react";
import { Image, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, { Easing, interpolateColor, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { GROUND } from "~/theme/tokens";

/**
 * The cards become the name — the logo's own marks are the cards.
 *
 * In the dark one small card pops up spinning and deals itself into the icon's three —
 * purple, green, orange — fanned like a hand. They shuffle twice, the end one hopping over
 * in an arc, each landing with a little squash. Then they fly to the name's own marks: two
 * stretch up into the l's and one rounds into the point, cooling to white as they land
 * with a little give. Out from behind the first l comes "wi" to the left, and from behind
 * the second, "o" to the right — "willo." is whole, and every distinctive piece of it was
 * a card. The logo sinks back a touch as the dark lifts off the app.
 *
 * One clock; every step is a window of it. With reduced motion: the logo, a moment, and
 * the fade.
 */

const POP = [0, 340] as const; // one card pops up, spinning
const DEAL = [300, 700] as const; // dealt into three, fanned
const SWAP1 = [760, 1080] as const; // shuffled once
const SWAP2 = [1110, 1430] as const; // and once more
const FLY = [1500, 1940] as const; // to the l's and the point, turning white
const PUSH = [1760, 2180] as const; // "wi" and "o" pushed out from behind the l's
const OUT = [2560, 3020] as const; // the logo sinks back as the dark lifts
export const CARDS_INTRO_MS = OUT[1] + 20;
const QUICK = [500, 900] as const;
const START_AFTER = 300;

const COLORS = ["#8A4DFF", "#25D39B", "#FF8A3D"] as const; // the icon's cards
const WHITE = "#FFFFFF";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const WORD = require("../../assets/images/intro/wordmark.png"); // "willo." in white
/* The wordmark, in its own pixels (measured from the picture). */
const PX = { w: 725, h: 222 };
const L = [
  { x: 335, y: 5, w: 56, h: 209 },
  { x: 409, y: 5, w: 56, h: 209 },
];
const POINT = { x: 642, y: 162, w: 78, h: 54 };
const L_ROUND = 0.32;
const WI_END = 328; // "wi" ends before here
const O_START = 470; // "o" starts after the second l
const O_END = 636; // and ends before the point

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
function backOut(v: number, s = 1.7) {
  "worklet";
  return 1 + (s + 1) * (v - 1) ** 3 + s * (v - 1) ** 2;
}
/** A soft spring: past the mark a little, and back. */
function spring(v: number) {
  "worklet";
  if (v <= 0) return 0;
  if (v >= 1) return 1;
  return 1 - Math.exp(-6.2 * v) * Math.cos(8 * v);
}
function mix(a: number, b: number, v: number) {
  "worklet";
  return a + (b - a) * v;
}

type Rect = { x: number; y: number; w: number; h: number; r: number };

export default function LaunchIntroCards({ onDone }: { onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const t = useSharedValue(0);

  const wordW = Math.min(width * 0.6, 250);
  const u = wordW / PX.w;
  const wordH = PX.h * u;
  const left = (width - wordW) / 2;
  const top = (height - wordH) / 2 - height * 0.02;

  /* Where each card lands, by the place it ends the shuffle in: l, l, point. */
  const targets: Rect[] = [
    { x: left + L[0].x * u, y: top + L[0].y * u, w: L[0].w * u, h: L[0].h * u, r: L[0].w * u * L_ROUND },
    { x: left + L[1].x * u, y: top + L[1].y * u, w: L[1].w * u, h: L[1].h * u, r: L[1].w * u * L_ROUND },
    { x: left + POINT.x * u, y: top + POINT.y * u, w: POINT.w * u, h: POINT.h * u, r: (POINT.h * u) / 2 },
  ];

  /* The cards: small rounded squares in the middle of the screen. */
  const size = Math.round(Math.min(width * 0.07, 28));
  const step = size * 1.5;
  const cx = width / 2;
  const cy = top + wordH * 0.5;

  const wiW = WI_END * u;
  const oX = O_START * u;
  const oW = (O_END - O_START) * u;

  useEffect(() => {
    const end = reduced ? QUICK[1] : CARDS_INTRO_MS;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let cancelled = false;
    const start = () => {
      if (cancelled) return;
      t.set(withTiming(end, { duration: end, easing: Easing.linear }));
      const tap = (style: Haptics.ImpactFeedbackStyle, at: number) => timers.push(setTimeout(() => void Haptics.impactAsync(style).catch(() => undefined), at));
      if (!reduced) {
        tap(Haptics.ImpactFeedbackStyle.Soft, POP[0] + 140);
        tap(Haptics.ImpactFeedbackStyle.Light, DEAL[0] + 220);
        tap(Haptics.ImpactFeedbackStyle.Light, SWAP1[1] - 40);
        tap(Haptics.ImpactFeedbackStyle.Light, SWAP2[1] - 40);
        tap(Haptics.ImpactFeedbackStyle.Medium, FLY[1] - 160);
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

  const ground = useAnimatedStyle(() => {
    const now = t.get();
    const out = reduced ? span(now, QUICK[0], QUICK[1]) : inOutSine(span(now, OUT[0] + 100, OUT[1]));
    return { opacity: 1 - out };
  });

  const logo = useAnimatedStyle(() => {
    const now = t.get();
    const out = reduced ? 0 : inOutCubic(span(now, OUT[0], OUT[1] - 80));
    return { opacity: 1 - out, transform: [{ scale: 1 - out * 0.06 }] };
  });

  /* "wi" out to the left of the first l; "o" out to the right of the second. */
  const push = (now: number) => {
    "worklet";
    return reduced ? 1 : backOut(span(now, PUSH[0], PUSH[1]), 1.2);
  };
  const seen = (now: number) => {
    "worklet";
    return reduced ? 1 : span(now, PUSH[0], PUSH[0] + 140);
  };
  const wiSlide = useAnimatedStyle(() => ({ opacity: seen(t.get()), transform: [{ translateX: mix(wiW, 0, push(t.get())) }] }));
  const oSlide = useAnimatedStyle(() => ({ opacity: seen(t.get()), transform: [{ translateX: mix(-oW, 0, push(t.get())) }] }));
  /* With reduced motion the l's and the point are not cards: they are the picture's. */
  const marks = useAnimatedStyle(() => ({ opacity: reduced ? 1 : 0 }));

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: GROUND, zIndex: 100, overflow: "hidden" }, ground]}>
      <Animated.View style={[StyleSheet.absoluteFill, logo]}>
        <View style={{ position: "absolute", left, top, width: wordW, height: wordH }}>
          {/* "wi": a window ending at the first l; out of it leftwards. */}
          <View style={{ position: "absolute", left: 0, top: 0, width: wiW, height: wordH, overflow: "hidden" }}>
            <Animated.View style={wiSlide}>
              <View style={{ width: wiW, height: wordH, overflow: "hidden" }}>
                <Image source={WORD} style={{ width: wordW, height: wordH }} resizeMode="stretch" />
              </View>
            </Animated.View>
          </View>
          {/* "o": a window between the second l and the point; out of it rightwards. */}
          <View style={{ position: "absolute", left: oX, top: 0, width: oW, height: wordH, overflow: "hidden" }}>
            <Animated.View style={oSlide}>
              <View style={{ width: oW, height: wordH, overflow: "hidden" }}>
                <Image source={WORD} style={{ width: wordW, height: wordH, marginLeft: -oX }} resizeMode="stretch" />
              </View>
            </Animated.View>
          </View>
          {/* Reduced motion: the l's and the point straight from the picture. */}
          <Animated.View style={[{ position: "absolute", left: wiW, top: 0, width: oX - wiW, height: wordH, overflow: "hidden" }, marks]}>
            <Image source={WORD} style={{ width: wordW, height: wordH, marginLeft: -wiW }} resizeMode="stretch" />
          </Animated.View>
          <Animated.View style={[{ position: "absolute", left: O_END * u, top: 0, width: wordW - O_END * u, height: wordH, overflow: "hidden" }, marks]}>
            <Image source={WORD} style={{ width: wordW, height: wordH, marginLeft: -O_END * u }} resizeMode="stretch" />
          </Animated.View>
        </View>

        {!reduced &&
          COLORS.map((color, i) => (
            <Card key={color} i={i} color={color} t={t} size={size} step={step} cx={cx} cy={cy} target={targets[(i + 2) % 3]} />
          ))}
      </Animated.View>
    </Animated.View>
  );
}

/**
 * One card. Its place in the row is 0, 1 or 2; each shuffle moves every card one place to
 * the right, the end one hopping round to the start over the others. After the second
 * shuffle it flies to its mark — an l or the point — and becomes it.
 */
function Card({ i, color, t, size, step, cx, cy, target }: { i: number; color: string; t: SharedValue<number>; size: number; step: number; cx: number; cy: number; target: Rect }) {
  const style = useAnimatedStyle(() => {
    const now = t.get();
    const pop = span(now, POP[0], POP[1]);
    const grow = backOut(pop);
    const dealt = backOut(span(now, DEAL[0], DEAL[1]), 1.4);
    const slotAt = (n: number) => (i + n) % 3;
    const xOf = (slot: number) => (slot - 1) * step;
    /* Fanned like a hand: the ends tilted out and a touch lower. */
    const fanTurn = (slot: number) => (slot - 1) * 10;
    const fanY = (slot: number) => Math.abs(slot - 1) * size * 0.18;
    const s1 = inOutCubic(span(now, SWAP1[0], SWAP1[1]));
    const s2 = inOutCubic(span(now, SWAP2[0], SWAP2[1]));
    const hop = (from: number, to: number, v: number) => -Math.sin(v * Math.PI) * (to < from ? step * 1.15 : step * 0.25);
    /* A little squash as a shuffle lands. */
    const land = (v: number) => (v > 0.8 && v < 1 ? Math.sin(((v - 0.8) / 0.2) * Math.PI) * 0.14 : 0);

    let slot = slotAt(0);
    let x = mix(0, xOf(slot), dealt);
    let y = mix(0, fanY(slot), dealt);
    let turn = mix(-40, 0, outCubic(pop)) + mix(0, fanTurn(slot), dealt);
    let squash = 0;
    if (s1 > 0) {
      const a = slotAt(0);
      const b = slotAt(1);
      x = mix(xOf(a), xOf(b), s1);
      y = mix(fanY(a), fanY(b), s1) + hop(a, b, s1);
      turn = mix(fanTurn(a), fanTurn(b), s1) + (b < a ? (-s1 * 360) % 360 : 0);
      squash = land(s1);
      slot = b;
    }
    if (s2 > 0) {
      const a = slotAt(1);
      const b = slotAt(2);
      x = mix(xOf(a), xOf(b), s2);
      y = mix(fanY(a), fanY(b), s2) + hop(a, b, s2);
      turn = mix(fanTurn(a), fanTurn(b), s2) + (b < a ? (-s2 * 360) % 360 : 0);
      squash = land(s2);
      slot = b;
    }

    /* To its mark, a beat apart from one another: stretching into it, turning white. */
    const f0 = FLY[0] + slot * 70;
    const fv = span(now, f0, f0 + (FLY[1] - FLY[0]));
    const f = spring(fv);
    const lit = inOutCubic(fv);
    const w = mix(size, target.w, clamp01(f));
    const h = mix(size, target.h, f);
    const startX = cx + x - size / 2;
    const startY = cy + y - size / 2;
    const toX = target.x + (target.w - w) / 2;
    const toY = target.y + target.h - h; // grown up from the line
    return {
      opacity: clamp01(pop * 3) * (i === 1 ? 1 : span(now, DEAL[0], DEAL[0] + 80)),
      width: w,
      height: h,
      borderRadius: mix(size * 0.26, target.r, lit),
      backgroundColor: interpolateColor(lit, [0, 1], [color, WHITE]),
      transform: [
        { translateX: mix(startX, toX, inOutCubic(fv)) },
        { translateY: mix(startY, toY, inOutCubic(fv)) },
        /* Upright early in the flight, the short way round, so it never lies across the name. */
        { rotate: `${mix(((((turn + 180) % 360) + 360) % 360) - 180, 0, outCubic(clamp01(fv * 2.2)))}deg` },
        { scaleX: mix(0.3, 1, grow) * (1 + squash) },
        { scaleY: mix(0.3, 1, grow) * (1 - squash) },
      ],
    };
  });
  return <Animated.View style={[{ position: "absolute", left: 0, top: 0, zIndex: i === 1 ? 2 : 1 }, style]} />;
}
