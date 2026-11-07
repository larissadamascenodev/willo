import { useEffect } from "react";
import { Image, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { GROUND } from "~/theme/tokens";

/**
 * What plays when the app opens, over the app while it gets ready underneath.
 *
 * Nine small points of light — orange, teal, violet — come up in a ring in the middle
 * of the dark screen, spin, and close into a knot. The knot moves along and lets out
 * the name a letter at a time: each one comes out of it, the letters spaced wide at
 * first and drawing together as the name fills in. With the name whole, the knot opens
 * into a ring round it and the points circle it, each with a comet's tail, until they
 * close in, the name gives way, and they meet. Where they meet, the three cards rise,
 * opened like a hand of cards. The wallet comes up from below and the cards drop into
 * it one after another, back card first, the wallet giving a little as it takes each
 * one. Willo rises out of it, his eyes come on, he looks to one side and the other and
 * blinks, and the name is printed on the wallet. Then the screen fades and the app is
 * there.
 *
 * Every piece is cut from the icon itself — the tile, each card, Willo's head and eyes,
 * the wallet and the name — and placed where it is in the artwork, so the last frame is
 * the icon. Positions are in the artwork's own pixels (934 × 960) and scaled to the
 * screen. Everything runs on one clock, so each step is a window of it and the order
 * reads straight off the table below. With reduced motion it is the finished icon, a
 * moment, and a fade.
 */

const CONTRACT = [380, 1300] as const; // the ring of points closes into a knot
const WRITE = [1300, 270, 380] as const; // start, gap, length: each letter out of the knot
const TIGHT = [1300, 2950] as const; // the letters, spaced wide, draw together
const OPEN = [2820, 3480] as const; // the knot opens into a ring round the name
const CLOSE = [3620, 4520] as const; // and circles it, closing in
const NAME_OUT = [4170, 4500] as const; // the name gives way to them
const MEET = 4500; // where they meet, the cards rise
const FAN = [MEET, 580, 100] as const; // start, length, gap: each card into a fan
const POCKET = [MEET + 650, MEET + 1250] as const; // the wallet comes up
const DROP = [MEET + 980, 500, 180] as const; // start, length, gap: each card into the wallet
const PEEK = [MEET + 1900, MEET + 2320] as const; // Willo rises out of it
const EYES_ON = [MEET + 2250, MEET + 2500] as const; // his eyes come on
const PRINT = [MEET + 2380, MEET + 2920] as const; // the name on the wallet
const LOOK = [MEET + 2550, MEET + 3250] as const; // a look to each side
const BLINK = [MEET + 3320, MEET + 3520] as const;
const OUT = [MEET + 3900, MEET + 4450] as const; // the screen fades onto the app
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
const DOTS = 9;
const TAIL = 5;
/* The ring they come up in, and the knot it closes into, in points. */
const RING_R = 36;
const KNOT = 11;
const KNOT_GAP = 8;

/* The name's letters, cut from the wordmark at the gaps between them, in its own pixels. */
const WORD_PX = 725;
const LETTERS = [
  [0, 255],
  [255, 325],
  [325, 400],
  [400, 471],
  [471, 725],
] as const;
/* How wide the letters are spaced as they come out, against how they end. */
const SPACED = 1.7;

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
/** How far letter j is out of the knot, 0..1. */
function emerged(now: number, j: number) {
  "worklet";
  const a = WRITE[0] + j * WRITE[1];
  return span(now, a, a + WRITE[2]);
}
/**
 * Where the name and the knot stand at a moment. The letters out so far and the knot
 * after them are kept centred on the screen as the name grows, as one line; the
 * spacing draws in as it fills; once the knot opens, the name alone is centred.
 */
function lineUp(now: number, cx: number, wordW: number) {
  "worklet";
  const u = wordW / WORD_PX;
  const sp = mix(SPACED, 1, outCubic(span(now, TIGHT[0], TIGHT[1])));
  const c0 = ((LETTERS[0][0] + LETTERS[0][1]) / 2) * u;
  let right = 0;
  for (let j = 0; j < LETTERS.length; j++) {
    const cen = c0 + (((LETTERS[j][0] + LETTERS[j][1]) / 2) * u - c0) * sp;
    const half = ((LETTERS[j][1] - LETTERS[j][0]) / 2) * u;
    right = mix(right, cen + half, outCubic(emerged(now, j)));
  }
  const o = inOutCubic(span(now, OPEN[0], OPEN[1]));
  const left = cx - (right + (KNOT_GAP + KNOT * 2) * (1 - o)) / 2;
  return { sp, c0, left, knot: left + right + KNOT_GAP + KNOT, o };
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

  /* The name, as a whole, gives way as the points meet. */
  const word = useAnimatedStyle(() => {
    const out = inCubic(span(reduced ? 0 : t.get(), NAME_OUT[0], NAME_OUT[1]));
    return { opacity: 1 - out, transform: [{ scale: mix(1, 0.7, out) }] };
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
      {/* The name, a letter at a time out of the knot. */}
      <Animated.View style={[{ position: "absolute", left: 0, top: cy - wordH / 2, width, height: wordH }, word]}>
        {LETTERS.map((_, j) => (
          <Letter key={j} j={j} t={t} cx={cx} wordW={wordW} wordH={wordH} reduced={reduced} />
        ))}
      </Animated.View>

      {/* The points of light: a ring, a knot, a ring round the name, with their tails. */}
      {!reduced &&
        Array.from({ length: DOTS }).map((_, i) =>
          Array.from({ length: TAIL }).map((__, j) => (
            <Spark key={`${i}-${j}`} i={i} lag={j} color={SPARKS[i % 3].color} core={SPARKS[i % 3].core} t={t} cx={cx} cy={cy} rx={wordW * 0.66} ry={wordH * 1.5} wordW={wordW} />
          )),
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
 * behind on the same path, smaller and fainter, so it reads as a comet. The tails only
 * show once the points circle the name.
 */
function Spark({ i, lag, color, core, t, cx, cy, rx, ry, wordW }: { i: number; lag: number; color: string; core: string; t: SharedValue<number>; cx: number; cy: number; rx: number; ry: number; wordW: number }) {
  const size = lag === 0 ? 9 : Math.max(2.5, 7 - lag * 0.9);
  const style = useAnimatedStyle(() => {
    const real = t.get();
    const now = real - lag * 18;
    /* One turning throughout: a little quicker as the ring closes, and again as they close in on the name. */
    const turns = (now / 1000) * 0.95 + 0.45 * outCubic(span(now, CONTRACT[0], CONTRACT[1])) + 1.1 * inCubic(span(now, CLOSE[0], CLOSE[1]));
    const angle = (i * 2 * Math.PI) / DOTS - Math.PI / 2 + turns * 2 * Math.PI;
    const line = lineUp(now, cx, wordW);
    /* A ring closing into the knot; the knot carried after the letters; opened round the name; closed in. */
    const r = mix(RING_R, KNOT, inOutCubic(span(now, CONTRACT[0], CONTRACT[1])));
    const close = 1 - inCubic(span(now, CLOSE[0], CLOSE[1]));
    const ax = mix(r, rx, line.o) * close;
    const ay = mix(r, ry, line.o) * close;
    const x0 = mix(line.knot, cx, line.o);
    const appear = outCubic(span(real, i * 30, 480 + i * 30));
    const gone = span(real, MEET - 40, MEET + 60);
    const tail = lag === 0 ? 1 : (0.55 - lag * 0.08) * span(now, OPEN[0], OPEN[1]);
    return {
      opacity: appear * (1 - gone) * tail,
      transform: [{ translateX: x0 - cx + Math.cos(angle) * ax }, { translateY: Math.sin(angle) * ay }],
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

/** One letter of the name: out of the knot, small, to its place in the line. */
function Letter({ j, t, cx, wordW, wordH, reduced }: { j: number; t: SharedValue<number>; cx: number; wordW: number; wordH: number; reduced: boolean }) {
  const u = wordW / WORD_PX;
  const a = LETTERS[j][0];
  const b = LETTERS[j][1];
  const w = (b - a) * u;
  const style = useAnimatedStyle(() => {
    const now = reduced ? 0 : t.get();
    const line = lineUp(now, cx, wordW);
    const place = line.left + line.c0 + (((a + b) / 2) * u - line.c0) * line.sp;
    const e = emerged(now, j);
    const v = outCubic(e);
    return {
      opacity: clamp01(e * 2.4),
      transform: [{ translateX: mix(line.knot, place, v) - w / 2 }, { scale: mix(0.35, 1, v) }],
    };
  });
  return (
    <Animated.View style={[{ position: "absolute", left: 0, top: 0, width: w, height: wordH, overflow: "hidden" }, style]}>
      <Image source={WORD} style={{ position: "absolute", left: -a * u, top: 0, width: wordW, height: wordH }} resizeMode="contain" />
    </Animated.View>
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
