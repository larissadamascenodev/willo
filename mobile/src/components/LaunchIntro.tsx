import { useEffect } from "react";
import { Image, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { GROUND } from "~/theme/tokens";

/**
 * What plays when the app opens, over the app while it gets ready underneath.
 *
 * Three points of light — orange, teal, violet — spin close together in the middle of
 * the dark screen, and as they open out the name writes itself out between them, from
 * the left. They circle the name, each with a comet's tail, closer and faster, until
 * the name gives way and they meet. Where they meet, the
 * three cards rise, opened like a hand of cards. The wallet comes up from below and the
 * cards drop into it one after another, back card first, the wallet giving a little as
 * it takes each one. Willo rises out of it, his eyes come on, he looks to one side and
 * the other and blinks, and the name is printed on the wallet. Then the screen fades
 * and the app is there.
 *
 * Every piece is cut from the icon itself — the tile, each card, Willo's head and eyes,
 * the wallet and the name — and placed where it is in the artwork, so the last frame is
 * the icon. Positions are in the artwork's own pixels (934 × 960) and scaled to the
 * screen. Everything runs on one clock, so each step is a window of it and the order
 * reads straight off the table below. With reduced motion it is the finished icon, a
 * moment, and a fade.
 */

const SPIN = [0, 1100] as const; // the points appear, spinning close together in the middle
const WRITE = [950, 1900] as const; // the name writes itself out as they open around it
const SPREAD = [950, 1700] as const; // they open out round the name
const CLOSE = [2150, 3150] as const; // and circle it, closing in
const NAME_OUT = [2750, 3100] as const; // the name gives way to them
const MEET = 3100; // where they meet, the cards rise
const FAN = [3100, 580, 100] as const; // start, length, gap: each card into a fan
const POCKET = [3750, 4350] as const; // the wallet comes up
const DROP = [4080, 500, 180] as const; // start, length, gap: each card into the wallet
const PEEK = [5000, 5420] as const; // Willo rises out of it
const EYES_ON = [5350, 5600] as const; // his eyes come on
const PRINT = [5480, 6020] as const; // the name on the wallet
const LOOK = [5650, 6350] as const; // a look to each side
const BLINK = [6420, 6620] as const;
const OUT = [7000, 7550] as const; // the screen fades onto the app
export const LAUNCH_INTRO_MS = OUT[1] + 20;
const QUICK = [800, 1150] as const;

/* The artwork, in its own pixels. */
const U = 934;
const UH = 960;
const CARDS = [
  { src: require("../../assets/images/intro/card-orange.png"), x: 476.3, y: 400.7, w: 656, h: 560, rot: -5.86 },
  { src: require("../../assets/images/intro/card-green.png"), x: 486.7, y: 473.0, w: 690, h: 560, rot: -5.85 },
  { src: require("../../assets/images/intro/card-purple.png"), x: 491.1, y: 550.0, w: 679, h: 560, rot: -5.89 },
] as const;
const HEAD = { src: require("../../assets/images/intro/head.png"), x: 255, y: 321, w: 428, h: 223 };
const EYES = { src: require("../../assets/images/intro/eyes.png"), x: 347, y: 385, w: 250, h: 137 };
const TILE = require("../../assets/images/intro/tile.png");
const POCKET_IMG = { src: require("../../assets/images/intro/front-clean.png"), x: 0, y: 409, w: 934, h: 551 };
const WORD = require("../../assets/images/intro/wordmark.png"); // 725 × 222
const NAME_IMG = { src: require("../../assets/images/intro/text.png"), x: 249, y: 596, w: 490, h: 166 };

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

  /* The icon, about three fifths of the screen's width; the name, a little wider. */
  const T = Math.min(width * 0.6, 270);
  const k = T / U;
  const IH = UH * k;
  const left = (width - T) / 2;
  const top = (height - IH) / 2 - height * 0.02;
  const cx = left + T / 2;
  const cy = top + IH / 2;
  const wordW = Math.min(width * 0.56, 240);
  const wordH = (wordW * 222) / 725;

  useEffect(() => {
    const end = reduced ? QUICK[1] : LAUNCH_INTRO_MS;
    t.set(withTiming(end, { duration: end, easing: Easing.linear }));
    const tap = (style: Haptics.ImpactFeedbackStyle) => () => void Haptics.impactAsync(style).catch(() => undefined);
    const timers = reduced
      ? []
      : [
          setTimeout(tap(Haptics.ImpactFeedbackStyle.Medium), MEET + 20),
          setTimeout(tap(Haptics.ImpactFeedbackStyle.Soft), POCKET[0] + 260),
          ...[0, 1, 2].map((i) => setTimeout(tap(Haptics.ImpactFeedbackStyle.Light), landing(i) - 30)),
        ];
    const done = setTimeout(onDone, end + 30);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(done);
    };
    // The intro plays once, as it mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* The whole of it fades, and the app is there. */
  const shell = useAnimatedStyle(() => {
    const now = t.get();
    const out = reduced ? span(now, QUICK[0], QUICK[1]) : span(now, OUT[0], OUT[1]);
    return { opacity: 1 - inOutCubic(out) };
  });

  /* The name: written out from the left as the points open round it, then drawn in
     and gone as they meet. */
  const wordClip = useAnimatedStyle(() => {
    const v = inOutCubic(span(reduced ? 0 : t.get(), WRITE[0], WRITE[1]));
    return { width: wordW * v };
  });
  const word = useAnimatedStyle(() => {
    const now = reduced ? 0 : t.get();
    const inn = span(now, WRITE[0], WRITE[0] + 260);
    const out = inCubic(span(now, NAME_OUT[0], NAME_OUT[1]));
    return { opacity: inn * (1 - out), transform: [{ scale: mix(1, 0.7, out) }] };
  });

  /* The tile and the wallet come up from below together, and give as each card lands. */
  const pocket = useAnimatedStyle(() => {
    const now = reduced ? 99999 : t.get();
    const v = span(now, POCKET[0], POCKET[1]);
    let give = 0;
    for (let i = 0; i < 3; i++) {
      const p = (now - landing(i) + 30) / 260;
      if (p > 0 && p < 1) give += Math.sin(Math.PI * p) * (1 - p * 0.4);
    }
    return {
      opacity: outCubic(clamp01(v * 1.8)),
      transform: [{ translateY: (1 - backOut(v, 1.15)) * height * 0.5 + give * 9 * k }, { scaleX: 1 + give * 0.01 }, { scaleY: 1 - give * 0.018 }],
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

  /* The name, printed on the wallet from left to right. */
  const nameClip = useAnimatedStyle(() => {
    const v = outCubic(span(reduced ? 99999 : t.get(), PRINT[0], PRINT[1]));
    return { width: NAME_IMG.w * k * v };
  });
  const nameInk = useAnimatedStyle(() => {
    const v = span(reduced ? 99999 : t.get(), PRINT[0], PRINT[1]);
    return { opacity: clamp01(v * 2.2), transform: [{ translateY: (1 - outCubic(v)) * 6 * k }] };
  });

  const at = (b: { x: number; y: number; w: number; h: number }) => ({ position: "absolute" as const, left: b.x * k, top: b.y * k, width: b.w * k, height: b.h * k });

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: GROUND, zIndex: 100, overflow: "hidden" }, shell]}>
      {/* The name, alone, first. */}
      <Animated.View style={[{ position: "absolute", left: cx - wordW / 2, top: cy - wordH / 2, width: wordW, height: wordH }, word]}>
        <Animated.View style={[{ height: wordH, overflow: "hidden" }, wordClip]}>
          <Image source={WORD} style={{ width: wordW, height: wordH }} resizeMode="contain" />
        </Animated.View>
      </Animated.View>

      {/* The points of light around it, with their tails. */}
      {!reduced &&
        SPARKS.map((s, i) =>
          Array.from({ length: TAIL }).map((_, j) => <Spark key={`${i}-${j}`} i={i} lag={j} color={s.color} core={s.core} t={t} cx={cx} cy={cy} rx={wordW * 0.66} ry={wordH * 1.5} />),
        )}

      {/* The icon and what goes in it, in the artwork's own frame. */}
      <View style={{ position: "absolute", left, top, width: T, height: IH }}>
        {/* The tile, behind everything; it comes up with the wallet. */}
        <Animated.View style={[{ position: "absolute", left: 0, top: 0, width: T, height: IH }, pocket]}>
          <Image source={TILE} style={{ width: T, height: IH }} />
        </Animated.View>

        {CARDS.map((c, i) => (
          <Card key={i} i={i} c={c} k={k} t={t} reduced={reduced} cx={T / 2} cy={IH / 2} />
        ))}

        <Animated.View style={[at(HEAD), head]}>
          <Image source={HEAD.src} style={{ width: HEAD.w * k, height: HEAD.h * k }} />
          <Animated.View style={[{ position: "absolute", left: (EYES.x - HEAD.x) * k, top: (EYES.y - HEAD.y) * k, width: EYES.w * k, height: EYES.h * k }, eyes]}>
            <Image source={EYES.src} style={{ width: EYES.w * k, height: EYES.h * k }} />
          </Animated.View>
        </Animated.View>

        {/* The wallet's front, which the cards go behind, and the name on it. */}
        <Animated.View style={[{ position: "absolute", left: 0, top: 0, width: T, height: IH }, pocket]}>
          <Image source={POCKET_IMG.src} style={at(POCKET_IMG)} />
          <Animated.View style={[{ position: "absolute", left: NAME_IMG.x * k, top: NAME_IMG.y * k, height: NAME_IMG.h * k, overflow: "hidden" }, nameClip]}>
            <Animated.View style={nameInk}>
              <Image source={NAME_IMG.src} style={{ width: NAME_IMG.w * k, height: NAME_IMG.h * k }} />
            </Animated.View>
          </Animated.View>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

/**
 * One point of light, or one step of its tail: the tail is the same point a little
 * behind on the same path, smaller and fainter, so it reads as a comet.
 */
function Spark({ i, lag, color, core, t, cx, cy, rx, ry }: { i: number; lag: number; color: string; core: string; t: SharedValue<number>; cx: number; cy: number; rx: number; ry: number }) {
  const size = lag === 0 ? 10 : Math.max(2.5, 8 - lag * 0.8);
  const style = useAnimatedStyle(() => {
    const now = t.get() - lag * 16;
    /* One continuous turning, quick at first, steadier as they circle the name. */
    const angle = (i * 2 * Math.PI) / 3 + (now / 1000) * Math.PI * 2.1 * (1 + 0.6 * span(now, CLOSE[0], CLOSE[1])) - Math.PI / 2;
    /* Close together in the middle, opened out round the name, then closing in. */
    const tight = rx * 0.16;
    const open = inOutCubic(span(now, SPREAD[0], SPREAD[1]));
    const close = 1 - inCubic(span(now, CLOSE[0], CLOSE[1]));
    const ax = mix(tight, rx, open) * close;
    const ay = mix(tight, ry, open) * close;
    const appear = outCubic(span(t.get(), SPIN[0] + 60 + i * 100, SPIN[0] + 460 + i * 100));
    const gone = span(t.get(), MEET - 40, MEET + 60);
    return {
      opacity: appear * (1 - gone) * (lag === 0 ? 1 : 0.6 - lag * 0.065),
      transform: [{ translateX: Math.cos(angle) * ax }, { translateY: Math.sin(angle) * ay }],
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
          borderWidth: lag === 0 ? 2.5 : 0,
          borderColor: color,
        },
        style,
      ]}
    />
  );
}

/** One of the three cards: from where the points met into the fan, then dropped into the wallet. */
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

    /* From where the points met: from the middle to its place in the fan. */
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
      <Image source={c.src} style={{ width: w, height: h }} />
    </Animated.View>
  );
}
