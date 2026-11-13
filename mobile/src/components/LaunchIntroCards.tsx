import { useEffect } from "react";
import { Image, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, { Easing, interpolateColor, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { GROUND } from "~/theme/tokens";

/**
 * The cards, then the name — Uber's opening the other way round.
 *
 * In the dark one small card pops up in the middle and turns, and splits into the three
 * cards of the icon — purple, green, orange — side by side. They swap places twice, each
 * hopping over the next in an arc, the way Uber's shapes do. Then they come together
 * into one, which turns white and becomes the point of "willo.", and the name is written
 * out leftwards from it. The logo settles and sinks back a touch as the dark lifts off
 * the app.
 *
 * One clock; every step is a window of it. With reduced motion: the logo, a moment, and
 * the fade.
 */

const POP = [0, 320] as const; // one card pops up and turns
const SPLIT = [300, 700] as const; // it splits into three, side by side
const SWAP1 = [800, 1160] as const; // they shift one place, hopping in arcs
const SWAP2 = [1220, 1580] as const; // and once more
const MERGE = [1660, 1960] as const; // together into one
const DOT = [1900, 2240] as const; // the one becomes the point, white, at the end of the name
const WRITE = [2000, 2440] as const; // the name written out leftwards from the point
const OUT = [2700, 3160] as const; // the logo sinks back as the dark lifts
export const CARDS_INTRO_MS = OUT[1] + 20;
const QUICK = [500, 900] as const;
const START_AFTER = 300;

const COLORS = ["#8A4DFF", "#25D39B", "#FF8A3D"] as const; // the icon's cards
const WHITE = "#FFFFFF";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const WORD = require("../../assets/images/intro/wordmark.png"); // "willo." in white
const PX = { w: 725, h: 222 };
const TEXT_END = 636; // the letters end before the point
const POINT = { x: 640, y: 162, w: 81, h: 54 }; // the point, in the picture's pixels

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
function mix(a: number, b: number, v: number) {
  "worklet";
  return a + (b - a) * v;
}

export default function LaunchIntroCards({ onDone }: { onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const t = useSharedValue(0);

  const wordW = Math.min(width * 0.6, 250);
  const u = wordW / PX.w;
  const wordH = PX.h * u;
  const left = (width - wordW) / 2;
  const top = (height - wordH) / 2 - height * 0.02;
  const textW = TEXT_END * u;
  const point = { x: left + POINT.x * u, y: top + POINT.y * u, w: POINT.w * u, h: POINT.h * u };

  /* The cards: small rounded squares, a little apart, in the middle of the screen. */
  const size = Math.round(Math.min(width * 0.065, 26));
  const step = size * 1.45;
  const cx = width / 2;
  const cy = top + wordH * 0.55;

  useEffect(() => {
    const end = reduced ? QUICK[1] : CARDS_INTRO_MS;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let cancelled = false;
    const start = () => {
      if (cancelled) return;
      t.set(withTiming(end, { duration: end, easing: Easing.linear }));
      const tap = (style: Haptics.ImpactFeedbackStyle) => () => void Haptics.impactAsync(style).catch(() => undefined);
      if (!reduced) {
        timers.push(setTimeout(tap(Haptics.ImpactFeedbackStyle.Soft), POP[0] + 120));
        timers.push(setTimeout(tap(Haptics.ImpactFeedbackStyle.Light), SPLIT[0] + 200));
        timers.push(setTimeout(tap(Haptics.ImpactFeedbackStyle.Medium), DOT[0] + 140));
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

  /* The name, written out leftwards from the point: a window anchored at its right edge. */
  const written = useAnimatedStyle(() => {
    const v = reduced ? 1 : inOutCubic(span(t.get(), WRITE[0], WRITE[1]));
    return { left: textW * (1 - v), width: textW * v };
  });
  const writtenImage = useAnimatedStyle(() => {
    const v = reduced ? 1 : inOutCubic(span(t.get(), WRITE[0], WRITE[1]));
    return { transform: [{ translateX: -textW * (1 - v) }] };
  });

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: GROUND, zIndex: 100, overflow: "hidden" }, ground]}>
      <Animated.View style={[StyleSheet.absoluteFill, logo]}>
        <View style={{ position: "absolute", left, top, width: wordW, height: wordH }}>
          <Animated.View style={[{ position: "absolute", top: 0, height: wordH, overflow: "hidden" }, written]}>
            <Animated.View style={writtenImage}>
              <Image source={WORD} style={{ width: wordW, height: wordH }} resizeMode="stretch" />
            </Animated.View>
          </Animated.View>
        </View>

        {COLORS.map((color, i) => (
          <Card key={color} i={i} color={color} t={t} reduced={reduced} size={size} step={step} cx={cx} cy={cy} point={point} />
        ))}
      </Animated.View>
    </Animated.View>
  );
}

/**
 * One card. Its place in the row is 0, 1 or 2; the two swaps move every card one place
 * to the right (the last hopping round to the first), in an arc, the one moving furthest
 * going over the others.
 */
function Card({
  i,
  color,
  t,
  reduced,
  size,
  step,
  cx,
  cy,
  point,
}: {
  i: number;
  color: string;
  t: SharedValue<number>;
  reduced: boolean;
  size: number;
  step: number;
  cx: number;
  cy: number;
  point: { x: number; y: number; w: number; h: number };
}) {
  const style = useAnimatedStyle(() => {
    const now = t.get();
    if (reduced) return { opacity: 0 };

    /* The pop: one card (they are all at the middle, stacked), turning as it grows. */
    const pop = span(now, POP[0], POP[1]);
    const grow = backOut(pop);
    /* The split into the row. */
    const sp = backOut(span(now, SPLIT[0], SPLIT[1]), 1.3);
    /* Its slot after each swap. */
    const slotAt = (n: number) => (i + n) % 3;
    const xOf = (slot: number) => (slot - 1) * step;
    const s1 = inOutCubic(span(now, SWAP1[0], SWAP1[1]));
    const s2 = inOutCubic(span(now, SWAP2[0], SWAP2[1]));
    const hopArc = (from: number, to: number, v: number) => {
      /* The one wrapping round (2 → 0) goes over in a high arc; the others step along low. */
      const far = Math.abs(to - from) > 1;
      return -Math.sin(v * Math.PI) * (far ? step * 1.1 : step * 0.28);
    };
    let x = mix(0, xOf(slotAt(0)), sp);
    let y = 0;
    if (s1 > 0) {
      x = mix(xOf(slotAt(0)), xOf(slotAt(1)), s1);
      y = hopArc(slotAt(0), slotAt(1), s1);
    }
    if (s2 > 0) {
      x = mix(xOf(slotAt(1)), xOf(slotAt(2)), s2);
      y = hopArc(slotAt(1), slotAt(2), s2);
    }
    /* Together into one at the middle, then that one to the point. */
    const m = inOutCubic(span(now, MERGE[0], MERGE[1]));
    x = mix(x, 0, m);
    y = mix(y, 0, m);
    const d = inOutCubic(span(now, DOT[0], DOT[1]));
    const toX = point.x + point.w / 2 - cx;
    const toY = point.y + point.h / 2 - cy;
    const w = mix(size, point.w, d);
    const h = mix(size, point.h, d);
    const turn = mix(-35, 0, outCubic(pop)) + (s1 > 0 && s1 < 1 ? Math.sin(s1 * Math.PI) * 12 : 0) + (s2 > 0 && s2 < 1 ? Math.sin(s2 * Math.PI) * 12 : 0);
    /* Only the middle one is the point; the others are hidden inside it as they meet. */
    const merged = span(now, MERGE[1] - 60, MERGE[1]);
    const visible = i === 1 ? 1 : 1 - merged;
    return {
      opacity: clamp01(pop * 3) * visible * (i === 1 || pop >= 1 ? 1 : 0) * (i === 1 ? 1 : span(now, SPLIT[0], SPLIT[0] + 60)),
      width: w,
      height: h,
      borderRadius: mix(size * 0.26, h / 2, d),
      backgroundColor: interpolateColor(d, [0, 1], [color, WHITE]),
      transform: [{ translateX: cx + mix(x, toX, d) - w / 2 }, { translateY: cy + mix(y, toY, d) - h / 2 }, { rotate: `${mix(turn, 0, d)}deg` }, { scale: mix(0.3, 1, grow) }],
    };
  });
  return <Animated.View style={[{ position: "absolute", left: 0, top: 0, zIndex: i === 1 ? 2 : 1 }, style]} />;
}
