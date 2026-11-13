import { useEffect, type ComponentType, type ReactElement, type ReactNode } from "react";
import { Image, StyleSheet, useWindowDimensions, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import MaskedViewBase from "@react-native-masked-view/masked-view";
import * as Haptics from "expo-haptics";
import { GROUND } from "~/theme/tokens";

/**
 * What plays when the app opens, over the app while it gets ready underneath — short.
 *
 * The three cards come up one after another, each on a soft spring, growing a touch and
 * straightening as they settle into a hand at the start of where the name will be. They
 * run across, leaning into the run, each a beat behind the one ahead, and pull the name
 * out behind them — written with a soft leading edge rather than cut. At its end they
 * draw in one by one, shrinking and turning square, and become the logo's own point: the
 * green one after the name, which lands with a little give. A moment on the logo, which
 * grows a hair as the screen fades onto the app.
 *
 * One clock; every step is a window of it. With reduced motion it is the finished logo, a
 * moment, and the fade.
 */

const RISE = [60, 760] as const; // the cards come up, one after another
const RISE_EACH = 520;
const RISE_GAP = 90;
const PULL = [700, 1560] as const; // they run across, the name written behind them
const LAG = 55; // each card a beat behind the one ahead
const MERGE = [1520, 1980] as const; // at its end they draw into the point, one by one
const MERGE_GAP = 60;
const POINT = [1880, 2240] as const; // the point lands, white
const SHINE = [2260, 2900] as const; // a gleam crosses the finished name
const OUT = [2980, 3440] as const; // the logo grows a hair as the screen fades onto the app
const FADE_IN = 360; // it begins dark and comes up
export const LAUNCH_INTRO_MS = OUT[1] + 20;
const QUICK = [700, 1050] as const;
/** A breath on the plain ground before anything moves, once the app is built underneath. */
const START_AFTER = 520;

/* Its class types predate React 19's; used as the component it is. */
const MaskedView = MaskedViewBase as unknown as ComponentType<{ maskElement: ReactElement; style?: ViewStyle; pointerEvents?: "none"; children?: ReactNode }>;

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
/* The point is white, like the name: the cards keep the colour. */
const POINT_COLOR = "#FFFFFF";
/** The soft leading edge the name is written with. */
const FEATHER = 34;

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
function inOutQuint(v: number) {
  "worklet";
  return v < 0.5 ? 16 * v ** 5 : 1 - (-2 * v + 2) ** 5 / 2;
}
/** A soft spring: past the mark a little, and back. */
function spring(v: number) {
  "worklet";
  if (v <= 0) return 0;
  if (v >= 1) return 1;
  return 1 - Math.exp(-6.2 * v) * Math.cos(7.4 * v);
}
function backOut(v: number, s = 1.7) {
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
  const dot = { x: DOT.x * u, y: DOT.y * u, w: DOT.w * u, h: DOT.h * u };

  useEffect(() => {
    const end = reduced ? QUICK[1] : LAUNCH_INTRO_MS;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let cancelled = false;
    /* The clock starts only once the screen is free: while the phone's own launch screen
       fades and the app is built underneath, frames are dropped, and a card caught
       mid-rise stood still and then jumped. Until then the screen is the plain ground. */
    const start = () => {
      if (cancelled) return;
      t.set(withTiming(end, { duration: end, easing: Easing.linear }));
      const tap = (style: Haptics.ImpactFeedbackStyle) => () =>
        void Haptics.impactAsync(style).catch(() => undefined);
      if (!reduced) {
        timers.push(
          setTimeout(
            tap(Haptics.ImpactFeedbackStyle.Soft),
            RISE[0] + RISE_EACH * 0.6,
          ),
        );
        timers.push(
          setTimeout(tap(Haptics.ImpactFeedbackStyle.Medium), POINT[0] + 60),
        );
      }
      timers.push(setTimeout(onDone, end + 30));
    };
    /* Two frames drawn (the app's first paint has happened), then a breath. */
    requestAnimationFrame(() =>
      requestAnimationFrame(() => timers.push(setTimeout(start, START_AFTER))),
    );
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
    // Once, on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shell = useAnimatedStyle(() => {
    const now = t.get();
    const out = reduced
      ? span(now, QUICK[0], QUICK[1])
      : inOutCubic(span(now, OUT[0], OUT[1]));
    return { opacity: 1 - out };
  });
  /* What is on the ground comes up out of the dark, rather than being there at once. */
  const scene = useAnimatedStyle(() => ({
    opacity: reduced ? 1 : outCubic(span(t.get(), 0, FADE_IN)),
  }));

  /* The gleam: a soft band of light crossing the letters once the name is whole. */
  const gleam = useAnimatedStyle(() => {
    const v = reduced ? 0 : inOutCubic(span(t.get(), SHINE[0], SHINE[1]));
    return {
      opacity: v > 0 && v < 1 ? 1 : 0,
      transform: [
        { translateX: mix(-wordW * 0.45, wordW * 1.05, v) },
        { skewX: "-18deg" },
      ],
    };
  });

  /* The logo as one: settling a hair as the point lands, growing a hair on the way out. */
  const logo = useAnimatedStyle(() => {
    const now = t.get();
    const land = reduced ? 1 : span(now, POINT[0], POINT[1]);
    const out = reduced ? 0 : inOutCubic(span(now, OUT[0], OUT[1]));
    const settle = 1 + Math.sin(land * Math.PI) * 0.018;
    return { transform: [{ scale: settle * (1 + out * 0.06) }] };
  });

  /* The name, written behind the cards: a window opening left to right, its edge feathered. */
  const written = useAnimatedStyle(() => {
    const v = reduced ? 1 : inOutQuint(span(t.get(), PULL[0], PULL[1]));
    /* The soft edge sits inside what is written, always under the cards, never ahead of them. */
    return { width: textW * v };
  });
  const edge = useAnimatedStyle(() => {
    const v = reduced ? 1 : span(t.get(), PULL[0], PULL[1]);
    return { opacity: v > 0 && v < 1 ? 1 : 0 };
  });

  /* The point: there once the cards have become it, green, landing with a little give. */
  const point = useAnimatedStyle(() => {
    const v = reduced ? 1 : span(t.get(), POINT[0], POINT[1]);
    return {
      opacity: clamp01(v * 3),
      transform: [{ scale: v === 0 ? 0 : mix(0.2, 1, backOut(v)) }],
    };
  });

  const cardW = wordH * 0.64;
  const cardH = cardW * (560 / 680);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: GROUND, zIndex: 100, overflow: "hidden" },
        shell,
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, scene]}>
        <Animated.View
          style={[
            { position: "absolute", left, top, width: wordW, height: wordH },
            logo,
          ]}
        >
          {/* The name, white, without its point: the point is the cards' to make. */}
          <Animated.View
            style={[
              {
                position: "absolute",
                left: 0,
                top: 0,
                height: wordH,
                overflow: "hidden",
              },
              written,
            ]}
          >
            <Image
              source={WORD}
              style={{ width: wordW, height: wordH, opacity: 0.9 }}
              resizeMode="stretch"
            />
            <Animated.View
              style={[
                {
                  position: "absolute",
                  right: 0,
                  top: 0,
                  bottom: 0,
                  width: FEATHER,
                },
                edge,
              ]}
            >
              <LinearGradient
                colors={[`${GROUND}00`, GROUND]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={{ flex: 1 }}
              />
            </Animated.View>
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
                backgroundColor: POINT_COLOR,
              },
              point,
            ]}
          />

          {/* The gleam, only where the letters are. */}
          {!reduced && (
            <MaskedView
              pointerEvents="none"
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: wordW,
                height: wordH,
              }}
              maskElement={
                <Image
                  source={WORD}
                  style={{ width: wordW, height: wordH }}
                  resizeMode="stretch"
                />
              }
            >
              <Animated.View
                style={[
                  {
                    position: "absolute",
                    top: -wordH * 0.2,
                    width: wordW * 0.38,
                    height: wordH * 1.4,
                  },
                  gleam,
                ]}
              >
                <LinearGradient
                  colors={[
                    "rgba(255,255,255,0)",
                    "rgba(255,255,255,0.95)",
                    "rgba(255,255,255,0)",
                  ]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={{ flex: 1 }}
                />
              </Animated.View>
            </MaskedView>
          )}
        </Animated.View>

        {!reduced &&
          CARDS.map((src, i) => (
            <Card
              key={i}
              i={i}
              src={src}
              t={t}
              w={cardW}
              h={cardH}
              startX={left - cardW * 0.15}
              endX={left + textW - cardW * 0.15}
              midY={top + wordH * 0.48}
              dot={{ x: left + dot.x, y: top + dot.y, w: dot.w, h: dot.h }}
            />
          ))}
      </Animated.View>
    </Animated.View>
  );
}

/**
 * One card: up into the hand on a soft spring, along the line leaning into the run, then
 * drawn into the point — its turn and its size going at once.
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
  const offY = (1 - i) * h * 0.17;
  const turn = (i - 1) * 8;

  const style = useAnimatedStyle(() => {
    const now = t.get();
    const a = RISE[0] + i * RISE_GAP;
    const r = span(now, a, a + RISE_EACH);
    const rise = spring(r);
    /* The front card leads the run; the ones behind follow a beat later. */
    const p = span(now, PULL[0] + (2 - i) * LAG, PULL[1] + (2 - i) * LAG);
    const pull = inOutQuint(p);
    const m0 = MERGE[0] + (2 - i) * MERGE_GAP;
    const merge = inOutCubic(span(now, m0, m0 + (MERGE[1] - MERGE[0])));

    const x = mix(startX, endX, pull);
    /* Hopping as they run: three little jumps each, out of step with one another, none
       at the start or the end of the run. */
    const hop =
      -Math.abs(Math.sin(p * Math.PI * 3 + i * 0.7)) *
      h *
      0.42 *
      Math.sin(p * Math.PI) *
      (1 - merge);
    const yRun = midY - h / 2 + offY + mix(140, 0, rise) + hop;
    /* Leaning into the run: most at its fastest, upright at either end. */
    const lean = -Math.sin(p * Math.PI) * 7;
    const toX = dot.x + dot.w / 2 - w / 2;
    const toY = dot.y + dot.h / 2 - h / 2;
    const restScale = mix(0.82, 1, outCubic(r));
    return {
      opacity:
        clamp01(r * 2.4) * (1 - span(now, POINT[0] + 20, POINT[0] + 180)),
      transform: [
        { translateX: mix(x, toX, merge) },
        { translateY: mix(yRun, toY, merge) },
        { rotate: `${mix(mix(turn - 18, turn, rise) + lean, 0, merge)}deg` },
        { scale: mix(restScale, dot.h / h, merge) },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        { position: "absolute", left: 0, top: 0, width: w, height: h },
        style,
      ]}
    >
      <Image
        source={src}
        style={{ width: w, height: h }}
        resizeMode="stretch"
      />
    </Animated.View>
  );
}
