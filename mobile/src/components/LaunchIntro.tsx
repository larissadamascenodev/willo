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
import { loadIntroSounds } from "~/lib/introSounds";

/**
 * What plays when the app opens, over the app while it gets ready underneath.
 *
 * The name comes first, alone. It gives way to a small deck of the icon's three cards,
 * which opens into a fan like a hand being shown, and the cards turn over one after
 * another. The wallet comes up under the fan and the cards are dealt into it one at a
 * time, back card first, each in an arc, growing to its size on the way, the wallet
 * giving a little as it takes each one. Willo peeks out over the edge, the name is
 * printed on the wallet, a light passes over it, Willo blinks, and after a moment the
 * whole of it fades into the app.
 *
 * Every piece is cut from the icon itself — the tile, each card, Willo's head and
 * eyes, the wallet's front and the name — and once everything is in place the icon
 * itself settles over them, so the last frame is the artwork exactly. The pieces
 * already match it, so the handover does not show. Positions are in the artwork's
 * own pixels (934 wide) and scaled to the screen.
 *
 * Turning over is done flat, by narrowing the card and widening it again, rather
 * than in 3D: turned cards in 3D cross in depth and pass through each other.
 *
 * Everything runs on one clock, so each step is a window of it and the order can be
 * read straight off the table below. With reduced motion it is the finished icon, a
 * moment, and a fade.
 */

const WORD_IN = [0, 450] as const;
const WORD_OUT = [800, 1060] as const;
const DECK = [960, 1400] as const; // the deck comes out of the name
const FAN = [1360, 1860] as const; // and opens
const FLIP = [1820, 520, 150] as const; // start, length, gap: each card turns over
const WALLET = [2380, 2860] as const;
const DEAL = [2700, 620, 200] as const; // start, length, gap: each card into the wallet
const PEEK = [3860, 4240] as const;
const TEXT = [4000, 4380] as const;
const SETTLE = [4380, 4700] as const; // the icon itself over the pieces
const SHEEN = [4700, 5500] as const;
const BLINK = [5100, 5260] as const;
const OUT = [6700, 7060] as const; // a moment with the icon after the blink
export const LAUNCH_INTRO_MS = OUT[1];
const QUICK_OUT = [700, 1000] as const;
/* The moment the build is complete, for reduced motion to show. */
const BUILT = SETTLE[1] + 50;

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
const ICON = require("../../assets/images/intro/icon-full.png");
const FRONT = { src: require("../../assets/images/intro/front.png"), x: 0, y: 409, w: 934, h: 551 };
const HEAD = { src: require("../../assets/images/intro/head.png"), x: 255, y: 321, w: 428, h: 223 };
const EYES = { src: require("../../assets/images/intro/eyes.png"), x: 347, y: 385, w: 250, h: 137 };
const VISOR = { src: require("../../assets/images/intro/visor.png"), x: 339, y: 377, w: 266, h: 153 };
const TEXT_IMG = { src: require("../../assets/images/intro/text.png"), x: 249, y: 596, w: 490, h: 166 };
const LOGO = require("../../assets/images/willo-logo-white.png");
const LOGO_RATIO = 222 / 725;

/* The deck while it is shown: small, over where the wallet will be, and the fan's
   pivot below it. */
const DECK_SCALE = 0.4;
const DECK_Y = 255;
const FAN_ANGLE = 20;
const FAN_RADIUS = 760; // distance from a card's centre to the pivot, at full size
const ARC = 150;

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
function inOutSine(v: number) {
  "worklet";
  return -(Math.cos(Math.PI * v) - 1) / 2;
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
  return DEAL[0] + i * DEAL[2] + DEAL[1];
}

export default function LaunchIntro({ onDone }: { onDone: () => void }) {
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  /* About two fifths of the screen's width: an icon on a dark page, not a poster. */
  const T = Math.min(width * 0.44, 190);
  const k = T / U;
  const t = useSharedValue(0);

  useEffect(() => {
    const end = reduced ? QUICK_OUT[1] : LAUNCH_INTRO_MS;
    t.set(withTiming(end, { duration: end, easing: Easing.linear }));
    const sounds = reduced ? null : loadIntroSounds();
    const timers = sounds
      ? [
          setTimeout(sounds.fan, FAN[0]),
          ...[0, 1, 2].map((i) =>
            setTimeout(() => {
              sounds.tuck(i);
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
            }, landing(i) - 40),
          ),
          setTimeout(sounds.chord, SETTLE[0]),
        ]
      : [];
    const done = setTimeout(onDone, end + 30);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(done);
      /* After the last sound has had its time. */
      if (sounds) setTimeout(sounds.release, 3500);
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
      const p = (now - landing(i) + 40) / 300;
      if (p > 0 && p < 1) give += Math.sin(Math.PI * p) * (1 - p * 0.5);
    }
    return {
      opacity: outCubic(clamp01(v * 1.6)),
      transform: [{ translateY: (1 - backOut(v, 1.1)) * 0.12 * T + give * 9 * k }, { scale: mix(0.92, 1, backOut(v, 1.1)) }],
    };
  });

  const head = useAnimatedStyle(() => {
    const v = span(reduced ? BUILT : t.get(), PEEK[0], PEEK[1]);
    return { opacity: v > 0 ? 1 : 0, transform: [{ translateY: (1 - backOut(v, 1.5)) * 230 * k }] };
  });
  const text = useAnimatedStyle(() => {
    const v = span(reduced ? BUILT : t.get(), TEXT[0], TEXT[1]);
    return { opacity: outCubic(v), transform: [{ scale: mix(0.88, 1, backOut(v, 1.3)) }] };
  });
  const icon = useAnimatedStyle(() => ({ opacity: smooth(span(reduced ? BUILT : t.get(), SETTLE[0], SETTLE[1])) }));
  /* The blink, over the icon: the visor without eyes comes over them, and the eyes
     close and open on top of it. Outside the blink neither shows, and the icon's own
     eyes are what you see. */
  const visor = useAnimatedStyle(() => {
    const b = span(reduced ? BUILT : t.get(), BLINK[0] - 30, BLINK[1] + 30);
    return { opacity: b > 0 && b < 1 ? 1 : 0 };
  });
  const lids = useAnimatedStyle(() => {
    const b = span(reduced ? BUILT : t.get(), BLINK[0], BLINK[1]);
    return { opacity: b > 0 && b < 1 ? 1 : 0, transform: [{ scaleY: 1 - 0.92 * Math.sin(Math.PI * b) }] };
  });
  const sheen = useAnimatedStyle(() => {
    const v = span(reduced ? BUILT : t.get(), SHEEN[0], SHEEN[1]);
    return { opacity: Math.sin(Math.PI * v), transform: [{ translateX: mix(-1.1, 1.1, inOutCubic(v)) * T }, { rotate: "18deg" }] };
  });

  const H = UH * k;
  const at = (b: { x: number; y: number; w: number; h: number }) => ({ position: "absolute" as const, left: b.x * k, top: b.y * k, width: b.w * k, height: b.h * k });
  const full = { position: "absolute" as const, left: 0, top: 0, width: T, height: H };

  return (
    <Animated.View pointerEvents="auto" style={[StyleSheet.absoluteFill, { backgroundColor: GROUND, alignItems: "center", justifyContent: "center", zIndex: 100 }]}>
      <Animated.View style={[{ width: T, height: H }, shell]}>
        {/* The name, alone. */}
        <Animated.View style={[{ position: "absolute", left: T * 0.19, top: (U / 2) * k - (T * 0.62 * LOGO_RATIO) / 2, width: T * 0.62 }, word]}>
          <Image source={LOGO} tintColor="#fff" style={{ width: T * 0.62, height: T * 0.62 * LOGO_RATIO }} resizeMode="contain" />
        </Animated.View>

        {/* The tile, behind everything. It moves with the wallet's front. */}
        <Animated.View style={[full, base]}>
          <Image source={TILE} style={{ width: T, height: H }} />
        </Animated.View>

        {CARDS.map((c, i) => (
          <IntroCard key={i} index={i} card={c} k={k} t={t} reduced={reduced} />
        ))}

        <Animated.View style={[at(HEAD), head]}>
          <Image source={HEAD.src} style={{ width: HEAD.w * k, height: HEAD.h * k }} />
          <Image source={EYES.src} style={{ position: "absolute", left: (EYES.x - HEAD.x) * k, top: (EYES.y - HEAD.y) * k, width: EYES.w * k, height: EYES.h * k }} />
        </Animated.View>

        {/* The wallet's front, which the cards go behind, and the name on it. */}
        <Animated.View pointerEvents="none" style={[full, base]}>
          <Image source={FRONT.src} style={at(FRONT)} />
          <Animated.View style={[at(TEXT_IMG), text]}>
            <Image source={TEXT_IMG.src} style={{ width: TEXT_IMG.w * k, height: TEXT_IMG.h * k }} />
          </Animated.View>
        </Animated.View>

        {/* The icon itself, settling over the pieces once they are in place. */}
        <Animated.View pointerEvents="none" style={[full, icon]}>
          <Image source={ICON} style={{ width: T, height: H }} />
          <Animated.View style={[at(VISOR), visor]}>
            <Image source={VISOR.src} style={{ width: VISOR.w * k, height: VISOR.h * k }} />
          </Animated.View>
          <Animated.View style={[at(EYES), lids]}>
            <Image source={EYES.src} style={{ width: EYES.w * k, height: EYES.h * k }} />
          </Animated.View>
          {/* A light passing once across it. */}
          <View style={{ ...full, borderRadius: T * 0.25, overflow: "hidden" }}>
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
    const d = span(now, DECK[0], DECK[1]);
    const deckIn = backOut(d, 1.25);
    const deckX = U / 2;
    const deckY = DECK_Y + (1 - outCubic(d)) * 50 + (i - 1) * 8;

    /* The fan: each card turns about a pivot below the deck. */
    const f = backOut(span(now, FAN[0], FAN[1]), 1.1);
    const theta = (i - 1) * FAN_ANGLE * f;
    const rad = (theta * Math.PI) / 180;
    const r = FAN_RADIUS * DECK_SCALE;
    const fanX = deckX + Math.sin(rad) * r;
    const fanY = deckY + (1 - Math.cos(rad)) * r;

    /* Turning over, flat: narrowing to its edge and widening again, twice over. */
    const fs = FLIP[0] + i * FLIP[2];
    const fl = inOutSine(span(now, fs, fs + FLIP[1]));
    const turn = Math.cos(fl * Math.PI * 2);
    const turnLift = Math.sin(Math.PI * fl) * 30;

    /* Dealt into the wallet: an arc up and over, down into place, growing on the
       way; it slows as it goes in. */
    const ds = DEAL[0] + i * DEAL[2];
    const e = inOutCubic(span(now, ds, ds + DEAL[1]));
    const x = mix(fanX, c.x, e);
    const y = mix(fanY - turnLift, c.y, e) - Math.sin(Math.PI * e) * ARC;
    const rot = mix(theta, c.rot, e) + Math.sin(Math.PI * e) * (i - 1) * -6;
    const s = mix(DECK_SCALE * deckIn, 1, e);
    const sx = mix(turn, 1, e);

    return {
      opacity: d > 0 ? 1 : 0,
      transform: [
        { translateX: (x - c.x) * k },
        { translateY: (y - c.y) * k },
        { rotate: `${rot}deg` },
        { scaleX: s * (Math.abs(sx) < 0.04 ? 0.04 * Math.sign(sx || 1) : sx) },
        { scaleY: s },
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
          shadowOpacity: 0.5,
          shadowRadius: 22 * k,
          shadowOffset: { width: 0, height: -4 * k },
        },
        style,
      ]}
    >
      <Image source={c.src} style={{ width: w, height: h }} />
    </Animated.View>
  );
}
