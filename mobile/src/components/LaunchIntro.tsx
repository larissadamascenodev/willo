import { useEffect } from "react";
import { Image, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { LinearGradient as ExpoLinearGradient } from "expo-linear-gradient";
import { GROUND } from "~/theme/tokens";

/**
 * What plays when the app opens, over the app while it gets ready underneath.
 *
 * The name comes first, alone. It folds away into three cards, the three of the
 * icon, which float in a soft wave as if waiting to be put away. Then the wallet comes
 * up, the cards travel over it in an arc and settle in one after another, Willo peeks out over the
 * edge, the name is printed on the wallet, and the drawing gives way to the icon
 * itself, with its relief and shine. A light passes over it, Willo blinks, and after
 * a moment with it the whole of it fades into the app.
 *
 * Everything is driven by one clock, so each step is a window of it and the order
 * can be read straight off the table below. Positions come from the icon, measured
 * in a 925-unit tile and scaled to the screen.
 *
 * With reduced motion it is the finished icon, a moment, and a fade.
 */

const WORD_IN = [0, 450] as const;
const WORD_OUT = [800, 1060] as const;
const EMERGE = [990, 520, 60] as const; // start, length, gap between cards: out of the name into a row
const FLOAT = [1300, 2300, 640] as const; // start, end, period of the wave
const GATHER = [2150, 560, 80] as const; // start, length, gap: in an arc to over the wallet
const WALLET = [2300, 2750] as const;
const DROP = [2780, 460, 110] as const; // start, length, gap between cards
const PEEK = [3220, 3580] as const;
const BRAND = [3320, 3680] as const;
const REAL = [3560, 3960] as const; // the drawn icon gives way to the icon itself
const SHEEN = [3900, 4700] as const;
const BLINK = [4500, 4660] as const;
const OUT = [6200, 6560] as const; // a moment with the icon after the blink
export const LAUNCH_INTRO_MS = OUT[1];

const QUICK_OUT = [700, 1000] as const;

/* The icon, in units of a 925-wide tile. */
const U = 934;
const CARD = { w: 660, h: 520, r: 72 };
const CARDS = [
  { x: 454, y: 382, rot: -4.5, from: "#F2542D", to: "#FFB21F" },
  { x: 467, y: 469, rot: -4.5, from: "#14C98A", to: "#62F2C8" },
  { x: 467, y: 552, rot: -3, from: "#3A1FD9", to: "#A35BFF" },
] as const;
const POCKET = { x: 72, y: 427, w: 795, h: 430 };
const HEAD = { x: 262, y: 322, w: 415, h: 300, r: 112 };
const EYES = [388, 556];
const EYE = { y: 454, w: 46, h: 100 };
const WORD = { x: 258, y: 606, w: 471 };
/* The icon itself, cut from the artwork: the tile without its eyes, and the eyes
   with their glow on their own so that they can blink. */
const ICON = require("../../assets/images/intro/icon.png");
const ICON_EYES = require("../../assets/images/intro/eyes.png");
const ICON_EYES_BOX = { x: 345, y: 383, w: 254, h: 142 };
/* The moment the build is complete, for reduced motion to show. */
const BUILT = REAL[1] + 100;
const LOGO = require("../../assets/images/willo-logo-white.png");
const LOGO_RATIO = 222 / 725;

/* Cards in their row, before they are put away: small, side by side, mid-tile. */
const ROW_SCALE = 0.3;
const ROW_GAP = 240;
const LIFT = 390;
const FLOAT_RISE = 70;
const ARC = 80;

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
function backOut(v: number, s = 1.6) {
  "worklet";
  const c = s + 1;
  return 1 + c * (v - 1) ** 3 + s * (v - 1) ** 2;
}
function smooth(v: number) {
  "worklet";
  return v * v * (3 - 2 * v);
}
function mix(a: number, b: number, v: number) {
  "worklet";
  return a + (b - a) * v;
}

export default function LaunchIntro({ onDone }: { onDone: () => void }) {
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const T = Math.min(width * 0.64, 270);
  const k = T / U;
  const t = useSharedValue(0);

  useEffect(() => {
    const end = reduced ? QUICK_OUT[1] : LAUNCH_INTRO_MS;
    t.set(withTiming(end, { duration: end, easing: Easing.linear }));
    const landed = reduced ? undefined : setTimeout(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined), DROP[0] + DROP[1] * 0.55 + DROP[2] * 2);
    const done = setTimeout(onDone, end + 30);
    return () => {
      if (landed) clearTimeout(landed);
      clearTimeout(done);
    };
    // The intro plays once, as it mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* With reduced motion the clock is read as if it were already past the build. */
  const at = (v: number) => {
    "worklet";
    return reduced ? BUILT : v;
  };

  const shell = useAnimatedStyle(() => {
    const out = reduced ? span(t.get(), QUICK_OUT[0], QUICK_OUT[1]) : span(t.get(), OUT[0], OUT[1]);
    return { opacity: 1 - outCubic(out), transform: [{ scale: 1 + 0.05 * inCubic(out) }] };
  });

  const word = useAnimatedStyle(() => {
    const now = at(t.get());
    const inn = outCubic(span(now, WORD_IN[0], WORD_IN[1]));
    const out = inCubic(span(now, WORD_OUT[0], WORD_OUT[1]));
    return {
      opacity: inn * (1 - out),
      transform: [{ translateY: (1 - inn) * 10 }, { scale: mix(0.94, 1, inn) * mix(1, 0.5, out) }],
    };
  });

  const wallet = useAnimatedStyle(() => {
    const v = span(at(t.get()), WALLET[0], WALLET[1]);
    return { opacity: outCubic(clamp01(v * 1.8)), transform: [{ translateY: (1 - backOut(v, 1.2)) * 0.14 * T }, { scale: mix(0.9, 1, backOut(v, 1.2)) }] };
  });
  const tile = useAnimatedStyle(() => {
    const v = span(at(t.get()), WALLET[0], WALLET[1] + 150);
    return { opacity: outCubic(v), transform: [{ scale: mix(0.86, 1, outCubic(v)) }] };
  });
  const head = useAnimatedStyle(() => {
    const v = span(at(t.get()), PEEK[0], PEEK[1]);
    return { opacity: v > 0 ? 1 : 0, transform: [{ translateY: (1 - backOut(v, 1.8)) * 0.24 * T }] };
  });
  const eyes = useAnimatedStyle(() => {
    const b = span(at(t.get()), BLINK[0], BLINK[1]);
    return { transform: [{ scaleY: 1 - 0.9 * Math.sin(Math.PI * b) }] };
  });
  const real = useAnimatedStyle(() => {
    const v = smooth(span(at(t.get()), REAL[0], REAL[1]));
    return { opacity: v };
  });
  /* A light passing once across the finished icon, corner to corner. */
  const sheen = useAnimatedStyle(() => {
    const v = span(at(t.get()), SHEEN[0], SHEEN[1]);
    const e = inOutCubic(v);
    return { opacity: Math.sin(Math.PI * v), transform: [{ translateX: mix(-1.1, 1.1, e) * T }, { rotate: "18deg" }] };
  });
  const brand = useAnimatedStyle(() => {
    const v = span(at(t.get()), BRAND[0], BRAND[1]);
    return { opacity: outCubic(v), transform: [{ scale: mix(0.86, 1, backOut(v, 1.4)) }] };
  });

  return (
    <Animated.View pointerEvents="auto" style={[StyleSheet.absoluteFill, { backgroundColor: GROUND, alignItems: "center", justifyContent: "center", zIndex: 100 }]}>
      <Animated.View style={[{ width: T, height: T }, shell]}>
        {/* The name, alone. */}
        <Animated.View style={[{ position: "absolute", left: T * 0.19, top: T / 2 - (T * 0.62 * LOGO_RATIO) / 2, width: T * 0.62 }, word]}>
          <Image source={LOGO} tintColor="#fff" style={{ width: T * 0.62, height: T * 0.62 * LOGO_RATIO }} resizeMode="contain" />
        </Animated.View>

        {/* The icon's tile. */}
        <Animated.View style={[{ position: "absolute", left: 0, top: 0, width: T, height: T }, tile]}>
          <Svg width={T} height={T}>
            <Defs>
              <LinearGradient id="tile" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#1B1C21" />
                <Stop offset="1" stopColor="#0E0F12" />
              </LinearGradient>
            </Defs>
            <Rect x={0.5} y={0.5} width={T - 1} height={T - 1} rx={T * 0.23} fill="url(#tile)" stroke="rgba(255,255,255,0.07)" />
          </Svg>
        </Animated.View>

        {CARDS.map((c, i) => (
          <IntroCard key={i} index={i} card={c} k={k} T={T} t={t} reduced={reduced} />
        ))}

        {/* Willo, peeking out over the edge. */}
        <Animated.View style={[{ position: "absolute", left: HEAD.x * k, top: HEAD.y * k, width: HEAD.w * k, height: HEAD.h * k }, head]}>
          <Svg width={HEAD.w * k} height={HEAD.h * k}>
            <Defs>
              <LinearGradient id="head" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#262A33" />
                <Stop offset="0.45" stopColor="#0B0D12" />
                <Stop offset="1" stopColor="#050608" />
              </LinearGradient>
            </Defs>
            <Rect x={2} y={2} width={HEAD.w * k - 4} height={HEAD.h * k - 4} rx={HEAD.r * k} fill="url(#head)" stroke="rgba(150,175,230,0.38)" strokeWidth={Math.max(1.5, 7 * k)} />
          </Svg>
          <View style={StyleSheet.absoluteFill}>
            {EYES.map((x) => (
              <View
                key={x}
                style={{
                  position: "absolute",
                  left: (x - HEAD.x - EYE.w / 2) * k,
                  top: (EYE.y - HEAD.y - EYE.h / 2) * k,
                  width: EYE.w * k,
                  height: EYE.h * k,
                  borderRadius: (EYE.w * k) / 2,
                  backgroundColor: "#EEF6FF",
                  shadowColor: "#6FA8E8",
                  shadowOpacity: 0.95,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 0 },
                }}
              />
            ))}
          </View>
        </Animated.View>

        {/* The wallet's front, which the cards drop behind. */}
        <Animated.View style={[{ position: "absolute", left: POCKET.x * k, top: POCKET.y * k, width: POCKET.w * k, height: POCKET.h * k }, wallet]}>
          <Svg width={POCKET.w * k} height={POCKET.h * k}>
            <Defs>
              <LinearGradient id="pocket" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#2C2D33" />
                <Stop offset="0.5" stopColor="#1B1C21" />
                <Stop offset="1" stopColor="#121317" />
              </LinearGradient>
            </Defs>
            <Path d={pocketPath(POCKET.w * k, POCKET.h * k, k)} fill="url(#pocket)" stroke="rgba(255,255,255,0.10)" strokeWidth={1.2} />
          </Svg>
          <Animated.View style={[{ position: "absolute", left: (WORD.x - POCKET.x) * k, top: (WORD.y - POCKET.y) * k }, brand]}>
            <Image source={LOGO} tintColor="#F4F5F7" style={{ width: WORD.w * k, height: WORD.w * k * LOGO_RATIO }} resizeMode="contain" />
          </Animated.View>
        </Animated.View>

        {/* The icon itself, as drawn: the build gives way to it once it is complete. */}
        <Animated.View pointerEvents="none" style={[{ position: "absolute", left: 0, top: 0, width: T, height: T }, real]}>
          <Image source={ICON} style={{ width: T, height: T }} />
          <Animated.View
            style={[
              { position: "absolute", left: ICON_EYES_BOX.x * k, top: ICON_EYES_BOX.y * k, width: ICON_EYES_BOX.w * k, height: ICON_EYES_BOX.h * k },
              eyes,
            ]}
          >
            <Image source={ICON_EYES} style={{ width: ICON_EYES_BOX.w * k, height: ICON_EYES_BOX.h * k }} />
          </Animated.View>
          <View style={{ position: "absolute", left: 0, top: 0, width: T, height: T, borderRadius: T * 0.215, overflow: "hidden" }}>
            <Animated.View style={[{ position: "absolute", top: -T * 0.3, left: T * 0.3, width: T * 0.32, height: T * 1.6 }, sheen]}>
              <ExpoLinearGradient
                colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.16)", "rgba(255,255,255,0)"]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={{ flex: 1 }}
              />
            </Animated.View>
          </View>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

/** The wallet's front: shoulders at the sides, a dip in the middle for what peeks out. */
function pocketPath(w: number, h: number, k: number) {
  const r = 62 * k;
  const R = 120 * k;
  const dip = 66 * k;
  return [
    `M 0 ${r}`,
    `Q 0 0 ${r} 0`,
    `L ${0.2 * w} 0`,
    `C ${0.265 * w} 0 ${0.245 * w} ${dip} ${0.31 * w} ${dip}`,
    `L ${0.69 * w} ${dip}`,
    `C ${0.755 * w} ${dip} ${0.735 * w} 0 ${0.8 * w} 0`,
    `L ${w - r} 0`,
    `Q ${w} 0 ${w} ${r}`,
    `L ${w} ${h - R}`,
    `C ${w} ${h - R * 0.45} ${w - R * 0.45} ${h} ${w - R} ${h}`,
    `L ${R} ${h}`,
    `C ${R * 0.45} ${h} 0 ${h - R * 0.45} 0 ${h - R}`,
    "Z",
  ].join(" ");
}

function IntroCard({
  index: i,
  card: c,
  k,
  T,
  t,
  reduced,
}: {
  index: number;
  card: (typeof CARDS)[number];
  k: number;
  T: number;
  t: { get: () => number };
  reduced: boolean;
}) {
  const w = CARD.w * k;
  const h = CARD.h * k;

  const style = useAnimatedStyle(() => {
    const now = reduced ? BUILT : t.get();

    /* Out of the name: from its middle, small, opening into a row. */
    const eStart = EMERGE[0] + i * EMERGE[2];
    const e = span(now, eStart, eStart + EMERGE[1]);
    const out = backOut(e, 0.9);
    const rowX = mix(U / 2, U / 2 + (i - 1) * ROW_GAP, out);
    const rowY = U / 2;

    /* Floating in the row: one soft wave passing along it, rising and settling
       without a jolt at either end. */
    const env = smooth(span(now, FLOAT[0], FLOAT[0] + 320)) * (1 - smooth(span(now, FLOAT[1] - 380, FLOAT[1])));
    const phase = ((now - FLOAT[0]) / FLOAT[2]) * Math.PI * 2 - i * 0.95;
    const floatY = -Math.max(0, Math.sin(phase)) * FLOAT_RISE * env;
    const floatRot = Math.cos(phase) * 5 * env * (i === 1 ? -1 : 1);

    /* Over the wallet in an arc, the back card first, growing to full size. */
    const gStart = GATHER[0] + i * GATHER[2];
    const g = inOutCubic(span(now, gStart, gStart + GATHER[1]));
    const arc = -Math.sin(Math.PI * g) * ARC;

    /* Into the wallet, settling without a bounce. */
    const dStart = DROP[0] + i * DROP[2];
    const d = backOut(span(now, dStart, dStart + DROP[1]), 0.6);

    const x = mix(rowX, c.x, g);
    const y = mix(rowY + floatY, c.y - LIFT, g) + arc + LIFT * d;
    const rot = mix(floatRot, c.rot, g) + (1 - d) * g * (i - 1) * 2.5;
    const s = mix(mix(0.12, ROW_SCALE, out), 1, g);
    const pop = e;

    return {
      opacity: outCubic(clamp01(pop * 2.2)),
      transform: [
        { translateX: (x - c.x) * k },
        { translateY: (y - c.y) * k },
        { rotate: `${rot}deg` },
        { scale: s },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: c.x * k - w / 2,
          top: c.y * k - h / 2,
          width: w,
          height: h,
          borderRadius: CARD.r * k,
          shadowColor: "#000",
          shadowOpacity: 0.4,
          shadowRadius: 14 * k * 2,
          shadowOffset: { width: 0, height: 10 * k * 2 },
        },
        style,
      ]}
    >
      <Svg width={w} height={h}>
        <Defs>
          <LinearGradient id={`card${i}`} x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0" stopColor={c.from} />
            <Stop offset="1" stopColor={c.to} />
          </LinearGradient>
          <LinearGradient id={`gloss${i}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.28} />
            <Stop offset="0.25" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={w} height={h} rx={CARD.r * k} fill={`url(#card${i})`} />
        <Rect x={0} y={0} width={w} height={h} rx={CARD.r * k} fill={`url(#gloss${i})`} />
      </Svg>
    </Animated.View>
  );
}
