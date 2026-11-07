import { useEffect } from "react";
import { Image, Platform, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { GROUND } from "~/theme/tokens";
import { loadIntroSound } from "~/lib/introSounds";

/**
 * What plays when the app opens, over the app while it gets ready underneath.
 *
 * Three points of light — orange, teal, violet — come out of the dark, each with a
 * comet's tail, and circle the middle faster and closer until they meet. Where they
 * meet there is a burst of light, and out of it the three cards rise, opened like a
 * hand of cards, glowing. The wallet comes up from below with a spring, and the cards
 * drop into it one after another, back card first, the wallet giving a little as it
 * takes each one. Willo rises out of the wallet; his eyes come on like a screen being
 * switched on, he looks to one side, to the other, back at you, and blinks. "willo."
 * appears on the wallet and a light passes over the whole of it. Then a circle opens
 * from his eyes and the app is there behind it.
 *
 * Every piece is cut from the icon itself — each card, Willo's head and eyes, the
 * wallet and the name — and placed where it is in the artwork, so the last frame is
 * the icon. Positions are in the artwork's own pixels (934 × 960) and scaled to the
 * screen. Everything runs on one clock, so each step is a window of it and the order
 * reads straight off the table below. With reduced motion it is the finished wallet,
 * a moment, and a fade.
 */

const ORBIT = [0, 1150] as const; // the points circle in
const BURST = [1080, 1560] as const; // they meet: light
const FAN = [1180, 470, 80] as const; // start, length, gap: each card out of the light, into a fan
const POCKET = [1700, 2200] as const; // the wallet comes up
const DROP = [1980, 400, 150] as const; // start, length, gap: each card into the wallet
const PEEK = [2720, 3080] as const; // Willo rises out of it
const EYES_ON = [3020, 3260] as const; // his eyes come on
const LOOK = [3300, 3880] as const; // a look to each side
const BLINK = [3940, 4100] as const;
const NAME = [3200, 3640] as const; // the name on the wallet
const SHEEN = [3560, 4220] as const;
const IRIS = [4300, 4950] as const; // a circle opens from his eyes onto the app
export const LAUNCH_INTRO_MS = IRIS[1] + 20;
const QUICK = [800, 1150] as const;

/* The artwork, in its own pixels. */
const U = 934;
const UH = 960;
const CARDS = [
  { src: require("../../assets/images/intro/card-orange.png"), x: 476.3, y: 400.7, w: 656, h: 560, rot: -5.86, glow: "#FF8A3D" },
  { src: require("../../assets/images/intro/card-green.png"), x: 486.7, y: 473.0, w: 690, h: 560, rot: -5.85, glow: "#3FE0B8" },
  { src: require("../../assets/images/intro/card-purple.png"), x: 491.1, y: 550.0, w: 679, h: 560, rot: -5.89, glow: "#9B5CFF" },
] as const;
const HEAD = { src: require("../../assets/images/intro/head.png"), x: 255, y: 321, w: 428, h: 223 };
const EYES = { src: require("../../assets/images/intro/eyes.png"), x: 347, y: 385, w: 250, h: 137 };
const POCKET_IMG = { src: require("../../assets/images/intro/pocket.png"), x: 0, y: 409, w: 934, h: 551 };
const NAME_IMG = { src: require("../../assets/images/intro/text.png"), x: 249, y: 596, w: 490, h: 166 };
/* Where his eyes are: the circle opens from there. */
const EYE_C = { x: EYES.x + EYES.w / 2, y: EYES.y + EYES.h / 2 };

/* The fan the cards open into, out of the light: a hand of cards about a point below. */
const FAN_PIVOT = { x: U / 2, y: 980 };
const FAN_R = 640;
const FAN_ANGLE = 17;
const FAN_SCALE = 0.9;

const SPARKS = [
  { color: "#FF9A3C", core: "#FFE2C2" },
  { color: "#3FE0B8", core: "#D2FFF3" },
  { color: "#A066FF", core: "#E9DDFF" },
] as const;
const TAIL = 8;

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
function outExpo(v: number) {
  "worklet";
  return v >= 1 ? 1 : 1 - 2 ** (-10 * v);
}
function backOut(v: number, s = 1.6) {
  "worklet";
  const c = s + 1;
  return 1 + c * (v - 1) ** 3 + s * (v - 1) ** 2;
}
function mix(a: number, b: number, v: number) {
  "worklet";
  return a + (b - a) * v;
}
/* When card i lands in the wallet. */
function landing(i: number) {
  "worklet";
  return DROP[0] + i * DROP[2] + DROP[1];
}

export default function LaunchIntro({ onDone }: { onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const t = useSharedValue(0);

  /* The wallet, about three fifths of the screen's width. */
  const T = Math.min(width * 0.6, 270);
  const k = T / U;
  const IH = UH * k;
  const left = (width - T) / 2;
  const top = (height - IH) / 2 - height * 0.02;
  const cx = left + T / 2;
  const cy = top + IH / 2;
  const eyeX = left + EYE_C.x * k;
  const eyeY = top + EYE_C.y * k;
  /* Far enough to clear the farthest corner from his eyes. */
  const reach = Math.hypot(Math.max(eyeX, width - eyeX), Math.max(eyeY, height - eyeY)) + 4;

  useEffect(() => {
    const end = reduced ? QUICK[1] : LAUNCH_INTRO_MS;
    t.set(withTiming(end, { duration: end, easing: Easing.linear }));
    const sound = reduced ? null : loadIntroSound();
    const tap = (style: Haptics.ImpactFeedbackStyle) => () => void Haptics.impactAsync(style).catch(() => undefined);
    const timers = reduced
      ? []
      : [
          setTimeout(tap(Haptics.ImpactFeedbackStyle.Medium), BURST[0] + 30),
          setTimeout(tap(Haptics.ImpactFeedbackStyle.Soft), POCKET[0] + 260),
          ...[0, 1, 2].map((i) => setTimeout(tap(Haptics.ImpactFeedbackStyle.Light), landing(i) - 30)),
          ...(sound ? [setTimeout(sound.play, BLINK[0])] : []),
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

  /* The dark ground, as a ring whose hole opens from Willo's eyes at the end. */
  const B = reach + 40;
  const iris = useAnimatedStyle(() => {
    const now = t.get();
    const r = reduced ? 0 : reach * inOutCubic(span(now, IRIS[0], IRIS[1]));
    return { left: eyeX - r - B, top: eyeY - r - B, width: (r + B) * 2, height: (r + B) * 2, borderRadius: r + B, opacity: reduced ? 1 - span(now, QUICK[0], QUICK[1]) : 1 };
  });

  /* Everything on the ground: in the end it lifts towards you as the circle opens. */
  const stage = useAnimatedStyle(() => {
    const now = t.get();
    const out = reduced ? span(now, QUICK[0], QUICK[1]) : span(now, IRIS[0], IRIS[0] + 420);
    return { opacity: 1 - outCubic(out), transform: [{ scale: 1 + 0.12 * inCubic(out) }] };
  });

  /* A soft light of the brand's colours behind the wallet, lit by the burst, breathing. */
  const aura = useAnimatedStyle(() => {
    const now = reduced ? POCKET[1] : t.get();
    const on = outCubic(span(now, BURST[0], BURST[0] + 500));
    const breathe = 1 + 0.04 * Math.sin(now / 420);
    return { opacity: 0.85 * on, transform: [{ scale: mix(0.4, 1, on) * breathe }] };
  });

  /* The burst: a flash, and a thin ring going out. */
  const flash = useAnimatedStyle(() => {
    const v = span(reduced ? 0 : t.get(), BURST[0], BURST[1]);
    return { opacity: v > 0 ? (1 - outCubic(v)) * 0.95 : 0, transform: [{ scale: mix(0.2, 2.2, outExpo(v)) }] };
  });
  const ring = useAnimatedStyle(() => {
    const v = span(reduced ? 0 : t.get(), BURST[0], BURST[1] + 150);
    return { opacity: v > 0 ? (1 - v) * 0.7 : 0, transform: [{ scale: mix(0.1, 3.4, outExpo(v)) }] };
  });

  /* The wallet comes up from below, and gives a little as each card lands. */
  const pocket = useAnimatedStyle(() => {
    const now = reduced ? 99999 : t.get();
    const v = span(now, POCKET[0], POCKET[1]);
    let give = 0;
    for (let i = 0; i < 3; i++) {
      const p = (now - landing(i) + 30) / 260;
      if (p > 0 && p < 1) give += Math.sin(Math.PI * p) * (1 - p * 0.4);
    }
    return {
      opacity: v > 0 ? 1 : 0,
      transform: [{ translateY: (1 - backOut(v, 1.2)) * height * 0.55 + give * 10 * k }, { scaleX: 1 + give * 0.012 }, { scaleY: 1 - give * 0.02 }],
    };
  });

  /* Willo, rising out of the wallet. */
  const head = useAnimatedStyle(() => {
    const v = span(reduced ? 99999 : t.get(), PEEK[0], PEEK[1]);
    return { opacity: v > 0 ? 1 : 0, transform: [{ translateY: (1 - backOut(v, 1.7)) * 210 * k }] };
  });
  /* His eyes: switched on with a flicker, a look to each side, a blink. */
  const eyes = useAnimatedStyle(() => {
    const now = reduced ? 99999 : t.get();
    const on = span(now, EYES_ON[0], EYES_ON[1]);
    const flicker = on <= 0 ? 0 : on < 0.25 ? 1 : on < 0.4 ? 0.25 : on < 0.55 ? 1 : on < 0.65 ? 0.5 : 1;
    const l = span(now, LOOK[0], LOOK[1]);
    /* Left, hold, right, hold, back. */
    const look = l <= 0 || l >= 1 ? 0 : l < 0.2 ? -outCubic(l / 0.2) : l < 0.4 ? -1 : l < 0.65 ? mix(-1, 1, inOutCubic((l - 0.4) / 0.25)) : l < 0.82 ? 1 : 1 - inOutCubic((l - 0.82) / 0.18);
    const b = span(now, BLINK[0], BLINK[1]);
    const lid = b > 0 && b < 1 ? 1 - 0.9 * Math.sin(Math.PI * b) : 1;
    return { opacity: flicker, transform: [{ translateX: look * 16 * k }, { scaleY: lid }] };
  });
  const glow = useAnimatedStyle(() => {
    const now = reduced ? 99999 : t.get();
    const on = span(now, EYES_ON[0], EYES_ON[1] + 300);
    return { opacity: on > 0 ? Math.sin(Math.PI * on) * 0.9 : 0, transform: [{ scale: mix(0.6, 1.4, on) }] };
  });

  /* The name, printed on the wallet from left to right. */
  const nameClip = useAnimatedStyle(() => {
    const v = outCubic(span(reduced ? 99999 : t.get(), NAME[0], NAME[1]));
    return { width: NAME_IMG.w * k * v };
  });
  const nameInk = useAnimatedStyle(() => {
    const v = span(reduced ? 99999 : t.get(), NAME[0], NAME[1]);
    return { opacity: clamp01(v * 2.2), transform: [{ translateY: (1 - outCubic(v)) * 6 * k }] };
  });

  /* A light passing once over the whole wallet. */
  const sheen = useAnimatedStyle(() => {
    const v = span(reduced ? 0 : t.get(), SHEEN[0], SHEEN[1]);
    return { opacity: v > 0 && v < 1 ? Math.sin(Math.PI * v) : 0, transform: [{ translateX: mix(-0.9, 1.1, inOutCubic(v)) * T }, { rotate: "20deg" }] };
  });

  const at = (b: { x: number; y: number; w: number; h: number }) => ({ position: "absolute" as const, left: b.x * k, top: b.y * k, width: b.w * k, height: b.h * k });

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 100, overflow: "hidden" }]}>
      {/* The ground, a ring around a hole that opens at the end. */}
      <Animated.View style={[{ position: "absolute", borderWidth: B, borderColor: GROUND }, iris]} />

      <Animated.View style={[StyleSheet.absoluteFill, stage]}>
        {/* The brand's light behind it all. */}
        <Animated.View style={[{ position: "absolute", left: cx - T * 1.1, top: cy - T * 1.1, width: T * 2.2, height: T * 2.2 }, aura]}>
          <Svg width="100%" height="100%">
            <Defs>
              <RadialGradient id="intro-aura" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor="#7C4DFF" stopOpacity={0.34} />
                <Stop offset="0.45" stopColor="#2FB8A0" stopOpacity={0.12} />
                <Stop offset="1" stopColor="#08090A" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx="50%" cy="50%" r="50%" fill="url(#intro-aura)" />
          </Svg>
        </Animated.View>

        {/* The points of light, with their tails. */}
        {!reduced &&
          SPARKS.map((s, i) =>
            Array.from({ length: TAIL }).map((_, j) => <Spark key={`${i}-${j}`} i={i} lag={j} color={s.color} core={s.core} t={t} cx={cx} cy={cy} T={T} />),
          )}

        {/* The burst. */}
        <Animated.View style={[{ position: "absolute", left: cx - T * 0.5, top: cy - T * 0.5, width: T, height: T }, flash]}>
          <Svg width="100%" height="100%">
            <Defs>
              <RadialGradient id="intro-flash" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity={1} />
                <Stop offset="0.25" stopColor="#E7DBFF" stopOpacity={0.7} />
                <Stop offset="0.6" stopColor="#8F6BFF" stopOpacity={0.18} />
                <Stop offset="1" stopColor="#8F6BFF" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx="50%" cy="50%" r="50%" fill="url(#intro-flash)" />
          </Svg>
        </Animated.View>
        <Animated.View style={[{ position: "absolute", left: cx - T * 0.3, top: cy - T * 0.3, width: T * 0.6, height: T * 0.6, borderRadius: T * 0.3, borderWidth: 1.5, borderColor: "rgba(230,220,255,0.9)" }, ring]} />

        {/* The wallet and what goes in it, in the artwork's own frame. */}
        <View style={{ position: "absolute", left, top, width: T, height: IH }}>
          {CARDS.map((c, i) => (
            <Card key={i} i={i} c={c} k={k} t={t} reduced={reduced} cx={T / 2} cy={IH / 2} />
          ))}

          <Animated.View style={[at(HEAD), head]}>
            <Image source={HEAD.src} style={{ width: HEAD.w * k, height: HEAD.h * k }} />
            {/* The glow as his eyes come on. */}
            <Animated.View style={[{ position: "absolute", left: (EYES.x - HEAD.x - 60) * k, top: (EYES.y - HEAD.y - 50) * k, width: (EYES.w + 120) * k, height: (EYES.h + 100) * k }, glow]}>
              <Svg width="100%" height="100%">
                <Defs>
                  <RadialGradient id="intro-eyeglow" cx="50%" cy="50%" r="50%">
                    <Stop offset="0" stopColor="#9CC8FF" stopOpacity={0.55} />
                    <Stop offset="1" stopColor="#9CC8FF" stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Circle cx="50%" cy="50%" r="50%" fill="url(#intro-eyeglow)" />
              </Svg>
            </Animated.View>
            <Animated.View style={[{ position: "absolute", left: (EYES.x - HEAD.x) * k, top: (EYES.y - HEAD.y) * k, width: EYES.w * k, height: EYES.h * k }, eyes]}>
              <Image source={EYES.src} style={{ width: EYES.w * k, height: EYES.h * k }} />
            </Animated.View>
          </Animated.View>

          <Animated.View style={[{ position: "absolute", left: 0, top: 0, width: T, height: IH }, pocket]}>
            <Image source={POCKET_IMG.src} style={at(POCKET_IMG)} />
            <Animated.View style={[{ position: "absolute", left: NAME_IMG.x * k, top: NAME_IMG.y * k, height: NAME_IMG.h * k, overflow: "hidden" }, nameClip]}>
              <Animated.View style={nameInk}>
                <Image source={NAME_IMG.src} style={{ width: NAME_IMG.w * k, height: NAME_IMG.h * k }} />
              </Animated.View>
            </Animated.View>
          </Animated.View>

          {/* A light passing over the whole wallet. */}
          <View style={{ position: "absolute", left: 0, top: 0, width: T, height: IH, overflow: "hidden", borderRadius: T * 0.12 }}>
            <Animated.View style={[{ position: "absolute", top: -T * 0.3, left: T * 0.34, width: T * 0.26, height: T * 1.8 }, sheen]}>
              <LinearGradient colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.16)", "rgba(255,255,255,0)"]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
            </Animated.View>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

/**
 * One point of light, or one step of its tail: the tail is the same point a little
 * behind on the same path, smaller and fainter, so it reads as a comet.
 */
function Spark({ i, lag, color, core, t, cx, cy, T }: { i: number; lag: number; color: string; core: string; t: SharedValue<number>; cx: number; cy: number; T: number }) {
  const size = lag === 0 ? 11 : Math.max(2.5, 9 - lag * 0.9);
  const style = useAnimatedStyle(() => {
    const now = t.get() - lag * 15;
    const v = span(now, ORBIT[0], ORBIT[1]);
    /* Faster and closer as they go: two and a half turns, the radius closing in. */
    const turn = inCubic(v) * 0.55 + v * 0.45;
    const angle = (i * 2 * Math.PI) / 3 + turn * Math.PI * 5 - Math.PI / 2;
    const r = T * 0.42 * (1 - inCubic(v)) + 2;
    const appear = outCubic(span(t.get(), 80 + i * 110, 480 + i * 110));
    const gone = span(t.get(), BURST[0] - 40, BURST[0] + 60);
    return {
      opacity: appear * (1 - gone) * (lag === 0 ? 1 : 0.6 - lag * 0.065),
      transform: [{ translateX: Math.cos(angle) * r }, { translateY: Math.sin(angle) * r * 0.82 }],
    };
  });
  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: cx - size / 2,
          top: cy - size / 2,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: lag === 0 ? core : color,
          ...(Platform.OS === "web" ? {} : { shadowColor: color, shadowOpacity: 1, shadowRadius: lag === 0 ? 10 : 6, shadowOffset: { width: 0, height: 0 } }),
          borderWidth: lag === 0 ? 2.5 : 0,
          borderColor: color,
        },
        style,
      ]}
    />
  );
}

/** One of the three cards: out of the light into the fan, then dropped into the wallet. */
function Card({
  i,
  c,
  k,
  t,
  reduced,
  cx,
  cy,
}: {
  i: number;
  c: (typeof CARDS)[number];
  k: number;
  t: SharedValue<number>;
  reduced: boolean;
  cx: number;
  cy: number;
}) {
  const w = c.w * k;
  const h = c.h * k;
  const style = useAnimatedStyle(() => {
    const now = reduced ? 99999 : t.get();

    /* Out of the light: from a point in the middle to its place in the fan. */
    const fs = FAN[0] + i * FAN[2];
    const f = span(now, fs, fs + FAN[1]);
    const fb = backOut(f, 1.25);
    const theta = (i - 1) * FAN_ANGLE;
    const rad = (theta * Math.PI) / 180;
    const fanX = FAN_PIVOT.x + Math.sin(rad) * FAN_R;
    const fanY = FAN_PIVOT.y - Math.cos(rad) * FAN_R - 120;
    const startX = cx / k;
    const startY = cy / k;

    /* Into the wallet: down in an arc, turning to its angle, a little bigger on the way. */
    const ds = DROP[0] + i * DROP[2];
    const d = inOutCubic(span(now, ds, ds + DROP[1]));
    const x = mix(mix(startX, fanX, fb), c.x, d);
    const y = mix(mix(startY, fanY, fb), c.y, d) - Math.sin(Math.PI * d) * 60;
    const rot = mix(theta, c.rot, d);
    const s = mix(mix(0.05, FAN_SCALE, fb), 1, d);
    return {
      opacity: f > 0 ? clamp01(f * 4) : 0,
      transform: [{ translateX: (x - c.x) * k }, { translateY: (y - c.y) * k }, { rotate: `${rot}deg` }, { scale: s }],
    };
  });
  /* Its glow, strong as it comes out of the light, gone once it is in the wallet. */
  const halo = useAnimatedStyle(() => {
    const now = reduced ? 99999 : t.get();
    const fs = FAN[0] + i * FAN[2];
    const on = span(now, fs, fs + FAN[1]);
    const off = span(now, DROP[0] + i * DROP[2], DROP[0] + i * DROP[2] + DROP[1]);
    return { shadowOpacity: on * (1 - off) * 0.9 };
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
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          { width: w, height: h, borderRadius: 118 * k },
          Platform.OS === "web" ? null : { shadowColor: c.glow, shadowRadius: 24 * k + 8, shadowOffset: { width: 0, height: 0 } },
          Platform.OS === "web" ? null : halo,
        ]}
      >
        <Image source={c.src} style={{ width: w, height: h }} />
      </Animated.View>
    </Animated.View>
  );
}
