import { useEffect } from "react";
import { Image, StyleSheet, useWindowDimensions } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { GROUND } from "~/theme/tokens";

/**
 * What plays when the app opens, over the app while it gets ready underneath — short.
 *
 * The three cards come up stacked, as a hand of cards does, at the start of where the name
 * will be. They run across and pull the name out behind them, "willo" written as they
 * pass. At its end they draw together, shrink, and become the logo's own point — the green
 * one after the name. A moment on the finished logo, and the screen fades onto the app.
 *
 * One clock; every step is a window of it. With reduced motion it is the finished logo, a
 * moment, and the fade.
 */

const RISE = [80, 620] as const; // the cards come up, one after another
const RISE_GAP = 70;
const PULL = [640, 1440] as const; // they run across, the name written behind them
const MERGE = [1440, 1880] as const; // at its end they shrink into the point
const POINT = [1780, 2080] as const; // the point settles, green
const OUT = [2550, 3000] as const; // the screen fades onto the app
export const LAUNCH_INTRO_MS = OUT[1] + 20;
const QUICK = [700, 1050] as const;

/* eslint-disable @typescript-eslint/no-require-imports -- the artwork, bundled */
const CARDS = [
  require("../../assets/images/intro/card-purple.png"),
  require("../../assets/images/intro/card-green.png"),
  require("../../assets/images/intro/card-orange.png"),
] as const;
const WORD = require("../../assets/images/intro/wordmark.png"); // 725 × 222, "willo." in white
/* eslint-enable @typescript-eslint/no-require-imports */

/* The wordmark, in its own pixels: the letters end where the point begins. */
const WORD_PX = 725;
const WORD_PY = 222;
const TEXT_END = 640;
const DOT = { x: 640, y: 162, w: 81, h: 54 };
const GREEN = "#67CD67";

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

  /* The name about three fifths of the screen's width, in the middle of it. */
  const wordW = Math.min(width * 0.6, 260);
  const u = wordW / WORD_PX;
  const wordH = WORD_PY * u;
  const left = (width - wordW) / 2;
  const top = (height - wordH) / 2 - height * 0.02;
  const textW = TEXT_END * u;
  /* The point, on the screen. */
  const dot = { x: left + DOT.x * u, y: top + DOT.y * u, w: DOT.w * u, h: DOT.h * u };

  useEffect(() => {
    const end = reduced ? QUICK[1] : LAUNCH_INTRO_MS;
    t.set(withTiming(end, { duration: end, easing: Easing.linear }));
    const tap = (style: Haptics.ImpactFeedbackStyle) => () => void Haptics.impactAsync(style).catch(() => undefined);
    const timers = reduced
      ? []
      : [setTimeout(tap(Haptics.ImpactFeedbackStyle.Light), RISE[1] - 40), setTimeout(tap(Haptics.ImpactFeedbackStyle.Medium), POINT[0] + 40)];
    const done = setTimeout(onDone, end + 30);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(done);
    };
    // Once, on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shell = useAnimatedStyle(() => {
    const now = t.get();
    const out = reduced ? span(now, QUICK[0], QUICK[1]) : span(now, OUT[0], OUT[1]);
    return { opacity: 1 - out };
  });

  /* The name, written behind the cards as they run: a window opening left to right. */
  const written = useAnimatedStyle(() => {
    const v = reduced ? 1 : inOutCubic(span(t.get(), PULL[0], PULL[1]));
    return { width: textW * v };
  });

  /* The point: there once the cards have become it, green, settling with a little give. */
  const point = useAnimatedStyle(() => {
    const v = reduced ? 1 : span(t.get(), POINT[0], POINT[1]);
    return { opacity: v > 0 ? 1 : 0, transform: [{ scale: v === 0 ? 0 : mix(0.4, 1, backOut(v)) }] };
  });

  const cardW = wordH * 0.62;
  const cardH = cardW * (560 / 680);

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: GROUND, zIndex: 100, overflow: "hidden" }, shell]}>
      {/* The name, white, without its point: the point is the cards' to make. */}
      <Animated.View style={[{ position: "absolute", left, top, height: wordH, overflow: "hidden" }, written]}>
        <Image source={WORD} style={{ width: wordW, height: wordH }} resizeMode="stretch" />
      </Animated.View>

      <Animated.View
        style={[
          {
            position: "absolute",
            left: dot.x,
            top: dot.y,
            width: dot.w,
            height: dot.h,
            borderRadius: dot.h / 2,
            backgroundColor: GREEN,
          },
          point,
        ]}
      />

      {!reduced &&
        CARDS.map((src, i) => (
          <Card
            key={i}
            i={i}
            src={src}
            t={t}
            w={cardW}
            h={cardH}
            startX={left - cardW * 0.35}
            endX={left + textW - cardW * 0.2}
            midY={top + wordH * 0.48}
            dot={dot}
          />
        ))}
    </Animated.View>
  );
}

/**
 * One card: up from below into the stack, along the line pulling the name, then drawn
 * into the point, small and green-tinted, gone as the point appears.
 */
function Card({
  i,
  src,
  t,
  w,
  h,
  startX,
  endX,
  midY,
  dot,
}: {
  i: number;
  src: number;
  t: SharedValue<number>;
  w: number;
  h: number;
  startX: number;
  endX: number;
  midY: number;
  dot: { x: number; y: number; w: number; h: number };
}) {
  /* Stacked as a hand: the back card a touch higher and turned the other way. */
  const offY = (1 - i) * h * 0.16;
  const turn = (i - 1) * 7;

  const style = useAnimatedStyle(() => {
    const now = t.get();
    const a = RISE[0] + i * RISE_GAP;
    const rise = outCubic(span(now, a, a + (RISE[1] - RISE[0]) - RISE_GAP * 2));
    /* Each card lags the one ahead a little as they run, so they pull rather than slide. */
    const pull = inOutCubic(span(now, PULL[0] + (2 - i) * 40, PULL[1] + (2 - i) * 40));
    const merge = inOutCubic(span(now, MERGE[0], MERGE[1]));

    const x = mix(startX, endX, pull);
    const yRun = midY - h / 2 + offY + mix(160, 0, rise);
    /* Into the point: centred on it, as small as it is. */
    const toX = dot.x + dot.w / 2 - w / 2;
    const toY = dot.y + dot.h / 2 - h / 2;
    const scale = mix(1, dot.h / h, merge);
    return {
      opacity: rise * (1 - span(now, POINT[0], POINT[0] + 160)),
      transform: [
        { translateX: mix(x, toX, merge) },
        { translateY: mix(yRun, toY, merge) },
        { rotate: `${mix(turn + mix(-14, 0, rise), 0, merge) - pull * (1 - merge) * 4 * Math.sin(pull * Math.PI)}deg` },
        { scale },
      ],
    };
  });

  return (
    <Animated.View style={[{ position: "absolute", left: 0, top: 0, width: w, height: h }, style]}>
      <Image source={src} style={{ width: w, height: h }} resizeMode="stretch" />
    </Animated.View>
  );
}
