import { useEffect } from "react";
import { Image, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { GROUND } from "~/theme/tokens";

/**
 * What plays when the app opens, over the app while it gets ready underneath.
 *
 * The name comes first, alone. It gives way to a small deck of the icon's three cards,
 * which opens into a fan like a hand being shown, and the cards turn over one after
 * another. The fan closes, the wallet comes up, the cards rise over it at full size
 * and dive in one at a time — each lifting a touch before it goes, the wallet giving
 * a little as it takes each one. Willo peeks out over the edge, the name is printed
 * on the wallet, a light passes over it, Willo blinks, and after a moment the whole
 * of it fades into the app.
 *
 * Every piece is cut from the icon itself — the tile, each card, Willo's head, his
 * eyes, the wallet's front and the name — so the last frame is the icon exactly,
 * with no drawing that gives way to a picture. Positions are in the artwork's own
 * pixels (934 wide) and scaled to the screen.
 *
 * Everything runs on one clock, so each step is a window of it and the order can be
 * read straight off the table below. With reduced motion it is the finished icon, a
 * moment, and a fade.
 */

const WORD_IN = [0, 450] as const;
const WORD_OUT = [800, 1060] as const;
const DECK = [950, 1380] as const; // the deck comes out of the name
const FAN = [1380, 1880] as const; // and opens
const FLIP = [1820, 460, 130] as const; // start, length, gap: each card turns over
const CLOSE = [2520, 560, 70] as const; // start, length, gap: the fan closes and rises over the wallet
const WALLET = [2580, 3040] as const;
const DIVE = [3060, 430, 170] as const; // start, length, gap: into the wallet
const PEEK = [3720, 4120] as const;
const TEXT = [3860, 4260] as const;
const SHEEN = [4260, 5060] as const;
const BLINK = [4680, 4840] as const;
const OUT = [6200, 6560] as const; // a moment with the icon after the blink
export const LAUNCH_INTRO_MS = OUT[1];
const QUICK_OUT = [700, 1000] as const;
/* The moment the build is complete, for reduced motion to show. */
const BUILT = TEXT[1] + 50;

/* The icon, in its own pixels. */
const U = 934;
const UH = 960;
const CARDS = [
  { src: require("../../assets/images/intro/card-orange.png"), x: 476.3, y: 400.7, w: 656, h: 560, rot: -5.86 },
  { src: require("../../assets/images/intro/card-green.png"), x: 486.7, y: 473.0, w: 690, h: 560, rot: -5.85 },
  { src: require("../../assets/images/intro/card-purple.png"), x: 491.1, y: 550.0, w: 679, h: 560, rot: -5.89 },
] as const;
const CARD_R = 118;
const TILE = require("../../assets/images/intro/tile.png");
const FRONT = { src: require("../../assets/images/intro/front.png"), x: 0, y: 409, w: 934, h: 551 };
const HEAD = { src: require("../../assets/images/intro/head.png"), x: 255, y: 321, w: 428, h: 223 };
const EYES = { src: require("../../assets/images/intro/eyes.png"), x: 347, y: 385, w: 250, h: 137 };
const TEXT_IMG = { src: require("../../assets/images/intro/text.png"), x: 249, y: 596, w: 490, h: 166 };
const LOGO = require("../../assets/images/willo-logo-white.png");
const LOGO_RATIO = 222 / 725;

/* The deck while it is shown: small, mid-tile, and the fan's pivot below it. */
const DECK_SCALE = 0.4;
const FAN_ANGLE = 21;
const FAN_RADIUS = 760; // distance from a card's centre to the pivot, at full size
const LIFT = 380;
const ANTICIPATE = 34;

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
/* When card i lands in the wallet. */
function landing(i: number) {
  "worklet";
  return DIVE[0] + i * DIVE[2] + DIVE[1];
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
    const taps = reduced
      ? []
      : [0, 1, 2].map((i) => setTimeout(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined), landing(i)));
    const done = setTimeout(onDone, end + 30);
    return () => {
      taps.forEach(clearTimeout);
      clearTimeout(done);
    };
    // The intro plays once, as it mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shell = useAnimatedStyle(() => {
    const out = reduced ? span(t.get(), QUICK_OUT[0], QUICK_OUT[1]) : span(t.get(), OUT[0], OUT[1]);
    return { opacity: 1 - outCubic(out), transform: [{ scale: 1 + 0.05 * inCubic(out) }] };
  });

  const word = useAnimatedStyle(() => {
    const now = reduced ? BUILT : t.get();
    const inn = outCubic(span(now, WORD_IN[0], WORD_IN[1]));
    const out = inCubic(span(now, WORD_OUT[0], WORD_OUT[1]));
    return {
      opacity: inn * (1 - out),
      transform: [{ translateY: (1 - inn) * 10 }, { scale: mix(0.94, 1, inn) * mix(1, 0.6, out) }],
    };
  });

  /* The tile and the wallet's front come up together and give a little as each
     card lands. */
  const base = useAnimatedStyle(() => {
    const now = reduced ? BUILT : t.get();
    const v = span(now, WALLET[0], WALLET[1]);
    let give = 0;
    for (let i = 0; i < 3; i++) {
      const p = (now - landing(i)) / 260;
      if (p > 0 && p < 1) give += Math.sin(Math.PI * p) * (1 - p * 0.4);
    }
    return {
      opacity: outCubic(clamp01(v * 1.6)),
      transform: [
        { translateY: (1 - backOut(v, 1.1)) * 0.12 * T + give * 10 * k },
        { scale: mix(0.92, 1, backOut(v, 1.1)) },
        { scaleY: 1 - give * 0.018 },
      ],
    };
  });

  const head = useAnimatedStyle(() => {
    const v = span(reduced ? BUILT : t.get(), PEEK[0], PEEK[1]);
    return { opacity: v > 0 ? 1 : 0, transform: [{ translateY: (1 - backOut(v, 1.5)) * 230 * k }] };
  });
  const eyes = useAnimatedStyle(() => {
    const b = span(reduced ? BUILT : t.get(), BLINK[0], BLINK[1]);
    return { transform: [{ scaleY: 1 - 0.92 * Math.sin(Math.PI * b) }] };
  });
  const text = useAnimatedStyle(() => {
    const v = span(reduced ? BUILT : t.get(), TEXT[0], TEXT[1]);
    return { opacity: outCubic(v), transform: [{ scale: mix(0.88, 1, backOut(v, 1.3)) }] };
  });
  const sheen = useAnimatedStyle(() => {
    const v = span(reduced ? BUILT : t.get(), SHEEN[0], SHEEN[1]);
    return { opacity: Math.sin(Math.PI * v), transform: [{ translateX: mix(-1.1, 1.1, inOutCubic(v)) * T }, { rotate: "18deg" }] };
  });

  const H = UH * k;
  const at = (b: { x: number; y: number; w: number; h: number }) => ({ position: "absolute" as const, left: b.x * k, top: b.y * k, width: b.w * k, height: b.h * k });

  return (
    <Animated.View pointerEvents="auto" style={[StyleSheet.absoluteFill, { backgroundColor: GROUND, alignItems: "center", justifyContent: "center", zIndex: 100 }]}>
      <Animated.View style={[{ width: T, height: H }, shell]}>
        {/* The name, alone. */}
        <Animated.View style={[{ position: "absolute", left: T * 0.19, top: (U / 2) * k - (T * 0.62 * LOGO_RATIO) / 2, width: T * 0.62 }, word]}>
          <Image source={LOGO} tintColor="#fff" style={{ width: T * 0.62, height: T * 0.62 * LOGO_RATIO }} resizeMode="contain" />
        </Animated.View>

        {/* The tile, behind everything. It moves with the wallet's front. */}
        <Animated.View style={[{ position: "absolute", left: 0, top: 0, width: T, height: H }, base]}>
          <Image source={TILE} style={{ width: T, height: H }} />
        </Animated.View>

        {CARDS.map((c, i) => (
          <IntroCard key={i} index={i} card={c} k={k} t={t} reduced={reduced} />
        ))}

        <Animated.View style={[at(HEAD), head]}>
          <Image source={HEAD.src} style={{ width: HEAD.w * k, height: HEAD.h * k }} />
          <Animated.View style={[{ position: "absolute", left: (EYES.x - HEAD.x) * k, top: (EYES.y - HEAD.y) * k, width: EYES.w * k, height: EYES.h * k }, eyes]}>
            <Image source={EYES.src} style={{ width: EYES.w * k, height: EYES.h * k }} />
          </Animated.View>
        </Animated.View>

        {/* The wallet's front, which the cards dive behind, and the name on it. */}
        <Animated.View pointerEvents="none" style={[{ position: "absolute", left: 0, top: 0, width: T, height: H }, base]}>
          <Image source={FRONT.src} style={at(FRONT)} />
          <Animated.View style={[at(TEXT_IMG), text]}>
            <Image source={TEXT_IMG.src} style={{ width: TEXT_IMG.w * k, height: TEXT_IMG.h * k }} />
          </Animated.View>
          {/* A light passing once across the finished icon. */}
          <View style={{ position: "absolute", left: 0, top: 0, width: T, height: H, borderRadius: T * 0.25, overflow: "hidden" }}>
            <Animated.View style={[{ position: "absolute", top: -T * 0.3, left: T * 0.34, width: T * 0.3, height: T * 1.7 }, sheen]}>
              <LinearGradient
                colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.13)", "rgba(255,255,255,0)"]}
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

function IntroCard({
  index: i,
  card: c,
  k,
  t,
  reduced,
}: {
  index: number;
  card: (typeof CARDS)[number];
  k: number;
  t: SharedValue<number>;
  reduced: boolean;
}) {
  const w = c.w * k;
  const h = c.h * k;

  const style = useAnimatedStyle(() => {
    const now = reduced ? BUILT : t.get();

    /* The deck: out of the middle of the name, small and square to the screen. */
    const d = span(now, DECK[0] + i * 40, DECK[1] + i * 40);
    const deckIn = backOut(d, 1.2);
    const deckX = U / 2;
    const deckY = U / 2 + (1 - deckIn) * 60 + (i - 1) * 10;

    /* The fan: each card turns about a pivot below the deck. */
    const f = backOut(span(now, FAN[0], FAN[1]), 1.15);
    const fs = CLOSE[0] + i * CLOSE[2];
    const close = inOutCubic(span(now, fs, fs + CLOSE[1]));
    const theta = (i - 1) * FAN_ANGLE * f * (1 - close);
    const rad = (theta * Math.PI) / 180;
    const r = FAN_RADIUS * DECK_SCALE;
    const fanX = Math.sin(rad) * r;
    const fanY = (1 - Math.cos(rad)) * r;

    /* Turning over, one after another. */
    const fl = inOutCubic(span(now, FLIP[0] + i * FLIP[2], FLIP[0] + i * FLIP[2] + FLIP[1]));
    const flip = fl * 360;
    const flipLift = Math.sin(Math.PI * fl) * 26;

    /* Over the wallet at full size, then into it: a small lift, then the dive. */
    const aboveX = c.x;
    const aboveY = c.y - LIFT - (2 - i) * 18;
    const ds = DIVE[0] + i * DIVE[2];
    const dv = span(now, ds, ds + DIVE[1]);
    const lift = dv < 0.32 ? outCubic(dv / 0.32) : 1 - inCubic((dv - 0.32) / 0.68);
    const dive = dv < 0.32 ? 0 : inCubic((dv - 0.32) / 0.68);

    const x = mix(deckX + fanX, aboveX, close);
    const y = mix(deckY + fanY - flipLift, aboveY, close) + (LIFT + (2 - i) * 18) * dive - ANTICIPATE * lift * (1 - dive);
    const rot = mix(theta, c.rot, close) + (dv > 0 && dv < 1 ? Math.sin(Math.PI * dv) * (i - 1) * 2 : 0);
    const s = mix(DECK_SCALE * deckIn, 1, close);

    return {
      opacity: smooth(clamp01(d * 2.5)),
      transform: [
        { translateX: (x - c.x) * k },
        { translateY: (y - c.y) * k },
        { perspective: 900 },
        { rotate: `${rot}deg` },
        { rotateY: `${flip}deg` },
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
          borderRadius: CARD_R * k,
          shadowColor: "#000",
          shadowOpacity: 0.55,
          shadowRadius: 9 * k * 3,
          shadowOffset: { width: 0, height: -2 * k * 3 },
        },
        style,
      ]}
    >
      <Image source={c.src} style={{ width: w, height: h }} />
    </Animated.View>
  );
}
