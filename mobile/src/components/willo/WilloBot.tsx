import { useEffect, useMemo, useRef } from "react";
import { Image, PanResponder, View } from "react-native";
import Animated, {
  ReduceMotion,
  useAnimatedProps,
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import Svg, { Defs, Ellipse, Path, RadialGradient, Stop } from "react-native-svg";
import type { OrbMode } from "~/components/registro/ParticleOrb";

/**
 * Willo the robot: a figure of neutral glass cut into four layers, head, body and two arms, all
 * drawn on the same square so they line up by themselves. He has no colour of his own: what is
 * in the picture is light and a little smoke, so whatever the background is shows through him.
 * The eyes and the mouth are not in the picture; they are drawn here, so they can move. Small,
 * he is only his head.
 *
 * He floats at his own pace and, left alone, finds something to do: waves, tilts his head, hops,
 * smiles, nods, peeks to each side, stretches. Listening, he follows the voice: his mouth opens
 * and the light behind him grows as you speak. Working, his eyes dart and his mouth goes small.
 * A finger on him and he looks where it goes; a tap and he hops.
 */

const BODY = require("../../../assets/images/bot/body.png");
const ARM = require("../../../assets/images/bot/arm.png");
const LEFT = require("../../../assets/images/bot/left.png");
const HEAD = require("../../../assets/images/bot/head.png");

/* Where things are on the square, as shares of its side. */
const EYES = [
  { x: 0.3647, y: 0.3247 },
  { x: 0.5659, y: 0.2847 },
];
const EYE_W = 0.072;
const EYE_H = 0.168;
const EYE_LEAN = "-8deg";
const NECK = { x: 0.46, y: 0.5 };
const SHOULDER = { x: 0.69, y: 0.6 };
const LEFT_SHOULDER = { x: 0.335, y: 0.641 };
/* The middle of the mouth, under and between the eyes, on the tilt of the face. */
const MOUTH = { x: 0.478, y: 0.378 };
const MOUTH_BOX = 0.2;
/* The head alone: its middle, and how much of the side it takes. */
const HEAD_ONLY = { x: 0.455, y: 0.29, span: 0.76 };
const FULL_BODY_FROM = 110;

const TAP_SLOP = 9;
const TAP_MS = 420;
const HOLD_MS = 320;

/* Used by the eyes' animation too, which runs on the UI thread: without this, the app dies. */
const clamp = (v: number, lo: number, hi: number) => {
  "worklet";
  return Math.min(Math.max(v, lo), hi);
};

/* What he does when left alone: 1 wave, 2 tilt, 3 hop, 4 smile, 5 nod, 6 peek, 7 stretch. */
const durationOf = (kind: number) => {
  "worklet";
  return kind === 1 ? 1.6 : kind === 3 ? 1 : kind === 5 ? 1.3 : kind === 6 ? 2.2 : 1.9;
};

const AnimatedPath = Animated.createAnimatedComponent(Path);

export default function WilloBot({
  size,
  mode = "idle",
  onPress,
  expanded = false,
  loudness,
  onHold,
  onHoldEnd,
}: {
  size: number;
  mode?: OrbMode;
  density?: number;
  onPress?: () => void;
  expanded?: boolean;
  loudness?: number;
  onHold?: () => void;
  onHoldEnd?: () => void;
}) {
  const reduce = useReducedMotion();
  const whole = size >= FULL_BODY_FROM;
  const side = whole ? size : size / HEAD_ONLY.span;
  const left = whole ? 0 : size / 2 - HEAD_ONLY.x * side;
  const top = whole ? 0 : size / 2 - HEAD_ONLY.y * side;

  const clock = useSharedValue(0);
  const still = useSharedValue(reduce ? 1 : 0);
  const working = useSharedValue(mode === "thinking" ? 1 : 0);
  const hearing = useSharedValue(mode === "listening" ? 1 : 0);
  const voice = useSharedValue(-1);
  const talk = useSharedValue(0);
  const look = useSharedValue({ x: 0, y: 0, tx: 0, ty: 0, next: 1 });
  const lid = useSharedValue({ shut: 0, from: -1, next: 2.4 });
  const finger = useSharedValue({ x: 0, y: 0 });
  const wave = useSharedValue({ on: 0, until: 2.6 });
  const act = useSharedValue({ kind: 0, from: 0, next: 5, sign: 1 });
  const tilt = useSharedValue(0);
  const hop = useSharedValue(0);
  const joy = useSharedValue(0);
  const nod = useSharedValue(0);
  const reach = useSharedValue(0);
  const small = useSharedValue(0);
  const poke = useSharedValue(0);
  const press = useSharedValue(0);
  const swell = useSharedValue(expanded ? 1 : 0);
  const heldNow = useSharedValue(0);

  useEffect(() => {
    working.set(mode === "thinking" ? 1 : 0);
    hearing.set(mode === "listening" ? 1 : 0);
    still.set(reduce ? 1 : 0);
  }, [mode, reduce, working, hearing, still]);
  useEffect(() => {
    voice.set(loudness ?? -1);
  }, [loudness, voice]);
  useEffect(() => {
    swell.set(withSpring(expanded ? 1 : 0, { duration: 620, dampingRatio: 0.66, reduceMotion: ReduceMotion.System }));
  }, [expanded, swell]);

  useFrameCallback((frame) => {
    const dt = Math.min(0.05, (frame.timeSincePreviousFrame ?? 16) / 1000);
    clock.set(clock.get() + dt);
    const t = clock.get();
    const calm = still.get() === 1;
    const busy = working.get() === 1;

    /* What he is up to. Only while nothing else is going on, except the hop a tap asks for. */
    const free = !calm && !busy && !hearing.get();
    const a = act.get();
    let { kind, from: began, next: nextAct, sign } = a;
    if (poke.get() === 1) {
      poke.set(0);
      kind = 3;
      began = t;
      nextAct = Math.max(nextAct, t + 5);
    }
    if (kind !== 0 && (t - began > durationOf(kind) || (!free && kind !== 3))) kind = 0;
    if (kind === 0 && free && t > nextAct) {
      kind = 1 + Math.floor(Math.random() * 7);
      began = t;
      sign = Math.random() < 0.5 ? -1 : 1;
      nextAct = t + durationOf(kind) + 4 + Math.random() * 7;
    }
    act.set({ kind, from: began, next: nextAct, sign });
    const p = kind === 0 ? 0 : Math.min(1, (t - began) / durationOf(kind));
    const env = Math.sin(p * Math.PI);
    const settle = Math.min(1, dt * 7);
    hop.set(kind === 3 ? Math.abs(Math.sin(p * Math.PI * 2)) * env : 0);
    tilt.set(tilt.get() + ((kind === 2 ? sign : 0) * Math.min(1, env * 2) - tilt.get()) * settle);
    joy.set(joy.get() + ((kind === 4 ? Math.min(1, env * 2) : kind === 3 ? env * 0.8 : kind === 1 ? env * 0.4 : 0) - joy.get()) * settle);
    nod.set(kind === 5 ? Math.sin(p * Math.PI * 4) * env : 0);
    reach.set(reach.get() + ((kind === 7 ? Math.min(1, env * 1.6) : 0) - reach.get()) * settle);
    small.set(small.get() + ((busy ? 1 : 0) - small.get()) * settle);

    const l = look.get();
    let { tx, ty, next } = l;
    if (kind === 6) {
      tx = sign * Math.sin(p * Math.PI * 2) * 1.1;
      ty = 0;
    } else if (kind === 2) {
      tx = sign * 0.7;
      ty = -0.5;
    } else if (t > next) {
      const span = calm ? 0.1 : busy ? 1 : 0.7;
      tx = (Math.random() * 2 - 1) * span;
      ty = (Math.random() * 2 - 1) * span * 0.6;
      next = t + (busy ? 0.35 + Math.random() * 0.5 : 1.4 + Math.random() * 2.8);
    }
    const eased = Math.min(1, dt * (busy ? 9 : 4));
    look.set({ x: l.x + (tx - l.x) * eased, y: l.y + (ty - l.y) * eased, tx, ty, next });

    const b = lid.get();
    let { from, next: nextLid } = b;
    if (t > nextLid && !calm) {
      from = t;
      nextLid = t + (Math.random() < 0.2 ? 0.26 : 2.2 + Math.random() * 3.6);
    }
    const since = t - from;
    lid.set({ shut: from >= 0 && since < 0.17 ? Math.sin((since / 0.17) * Math.PI) : 0, from, next: nextLid });

    /* With a voice to follow he follows it; otherwise, listening, he breathes. */
    const heard = hearing.get() ? (voice.get() >= 0 ? voice.get() : 0.45 + 0.3 * Math.sin(t * 5.2)) : busy ? 0.25 : 0;
    talk.set(talk.get() + (heard - talk.get()) * Math.min(1, dt * 12));

    /* Waves as he arrives, then whenever it comes up. */
    const w = wave.get();
    const until = kind === 1 ? Math.max(w.until, began + 1.5) : w.until;
    wave.set({ on: w.on + ((t < until && !calm ? 1 : 0) - w.on) * Math.min(1, dt * 6), until });

    if (heldNow.get() === 0) finger.set({ x: finger.get().x * Math.exp(-dt * 4), y: finger.get().y * Math.exp(-dt * 4) });
  });

  /* ---- the finger ---- */

  const touch = useRef({ travelled: 0, at: 0 });
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;
  const onHoldRef = useRef(onHold);
  onHoldRef.current = onHold;
  const onHoldEndRef = useRef(onHoldEnd);
  onHoldEndRef.current = onHoldEnd;
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holding = useRef(false);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !!onPressRef.current,
        onMoveShouldSetPanResponder: () => !!onPressRef.current,
        onPanResponderGrant: () => {
          touch.current = { travelled: 0, at: Date.now() };
          heldNow.set(1);
          press.set(withTiming(1, { duration: 140 }));
          holding.current = false;
          if (onHoldRef.current) {
            holdTimer.current = setTimeout(() => {
              holding.current = true;
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
              onHoldRef.current?.();
            }, HOLD_MS);
          }
        },
        onPanResponderMove: (_, g) => {
          touch.current.travelled = Math.max(touch.current.travelled, Math.hypot(g.dx, g.dy));
          /* Moving is looking: it is not a hold. */
          if (touch.current.travelled >= TAP_SLOP && holdTimer.current) clearTimeout(holdTimer.current);
          finger.set({ x: clamp(g.dx / (size * 0.45), -1, 1), y: clamp(g.dy / (size * 0.45), -1, 1) });
        },
        onPanResponderRelease: () => {
          heldNow.set(0);
          press.set(withTiming(0, { duration: 220 }));
          if (holdTimer.current) clearTimeout(holdTimer.current);
          if (holding.current) {
            holding.current = false;
            onHoldEndRef.current?.();
            return;
          }
          if (touch.current.travelled < TAP_SLOP && Date.now() - touch.current.at < TAP_MS) {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
            poke.set(1);
            onPressRef.current?.();
          }
        },
        onPanResponderTerminate: () => {
          if (holdTimer.current) clearTimeout(holdTimer.current);
          if (holding.current) {
            holding.current = false;
            onHoldEndRef.current?.();
          }
          heldNow.set(0);
          press.set(withTiming(0, { duration: 220 }));
        },
      }),
    [finger, heldNow, poke, press, size],
  );

  /* ---- how each part moves ---- */

  const figure = useAnimatedStyle(() => {
    const calm = still.get() === 1 ? 0 : 1;
    /* He arrives with a small spring, and squashes a little as he leaves the ground. */
    const arrived = Math.min(1, clock.get() / 0.55);
    const entrance = 0.84 + 0.16 * (1 - (1 - arrived) * (1 - arrived) * (1 - arrived));
    const up = hop.get();
    return {
      transform: [
        { translateY: calm * Math.sin(clock.get() * 1.15) * size * 0.016 - up * size * 0.09 - reach.get() * size * 0.012 },
        { scale: entrance * (1 + swell.get() * 0.1 - press.get() * 0.035 + talk.get() * 0.025) },
        { scaleY: 1 + up * 0.035 + reach.get() * 0.025 },
        { scaleX: 1 - up * 0.025 - reach.get() * 0.015 },
      ],
    };
  });

  const headMove = useAnimatedStyle(() => {
    const t = clock.get();
    const l = look.get();
    const f = finger.get();
    const calm = still.get() === 1 ? 0 : 1;
    return {
      transform: [
        { rotate: `${calm * Math.sin(t * 0.8) * 1.8 + (l.x + f.x) * 2.6 + talk.get() * 2 + tilt.get() * 9}deg` },
        { translateY: -talk.get() * side * 0.006 + nod.get() * side * 0.016 - reach.get() * side * 0.012 },
      ],
    };
  });

  const armMove = useAnimatedStyle(() => {
    const t = clock.get();
    const calm = still.get() === 1 ? 0 : 1;
    const w = wave.get().on;
    return { transform: [{ rotate: `${calm * (Math.sin(t * 1.15 + 0.6) * 2 + w * (Math.sin(t * 9) * 11 - 8) - hop.get() * 16 - reach.get() * 22 - joy.get() * 5)}deg` }] };
  });

  const leftMove = useAnimatedStyle(() => {
    const t = clock.get();
    const calm = still.get() === 1 ? 0 : 1;
    return { transform: [{ rotate: `${calm * (Math.sin(t * 1.15 + 2.2) * 2.4 + hop.get() * 15 + reach.get() * 24 + joy.get() * Math.sin(t * 11) * 4)}deg` }] };
  });

  const eyes = useAnimatedStyle(() => {
    const l = look.get();
    const f = finger.get();
    return {
      transform: [
        { translateX: clamp(l.x + f.x, -1, 1) * side * 0.022 },
        { translateY: clamp(l.y + f.y, -1, 1) * side * 0.014 },
        { scaleY: Math.max(0.1, (1 + talk.get() * 0.12) * (1 - lid.get().shut) * (1 - joy.get() * 0.42)) },
      ],
    };
  });

  /* The mouth is one shape with two edges: apart, it is a smile; further apart, a mouth open;
     close together and short, the small line he makes while he thinks. */
  const box = MOUTH_BOX * side;
  const mouthShape = () => {
    "worklet";
    const c = box / 2;
    const open = talk.get();
    const glad = joy.get();
    const thin = small.get();
    const half = side * (0.036 + glad * 0.014 - open * 0.008 - thin * 0.016);
    const top = side * (0.012 + glad * 0.006 - open * 0.042 - thin * 0.01);
    const low = side * (0.046 + glad * 0.03 + open * 0.05 - thin * 0.038);
    const y = c - low / 4;
    return `M${(c - half).toFixed(2)} ${y.toFixed(2)}Q${c.toFixed(2)} ${(y + top).toFixed(2)} ${(c + half).toFixed(2)} ${y.toFixed(2)}Q${c.toFixed(2)} ${(y + low).toFixed(2)} ${(c - half).toFixed(2)} ${y.toFixed(2)}Z`;
  };
  const mouthProps = useAnimatedProps(() => ({ d: mouthShape() }));
  const mouthGlow = useAnimatedProps(() => ({ d: mouthShape() }));
  const mouth = useAnimatedStyle(() => {
    const l = look.get();
    const f = finger.get();
    return {
      transform: [
        { translateX: clamp(l.x + f.x, -1, 1) * side * 0.018 + small.get() * Math.sin(clock.get() * 2.4) * side * 0.006 },
        { translateY: clamp(l.y + f.y, -1, 1) * side * 0.011 },
      ],
    };
  });

  const aura = useAnimatedStyle(() => ({ opacity: 0.55 + talk.get() * 0.45, transform: [{ scale: 1 + talk.get() * 0.14 }] }));

  const layer = { position: "absolute" as const, left: 0, top: 0, width: side, height: side };
  const pivot = (p: { x: number; y: number }) => ({ transformOrigin: [p.x * side, p.y * side, 0] as [number, number, number] });

  return (
    <Animated.View {...(onPress ? responder.panHandlers : {})} style={[{ width: size, height: size }, figure]} accessibilityRole={onPress ? "button" : undefined}>
      <View pointerEvents="none" style={{ width: size, height: size }}>
        <View style={{ position: "absolute", left, top, width: side, height: side }}>
          {/* The light he stands in. */}
          <Animated.View style={[layer, aura]}>
            <Svg width={side} height={side}>
              <Defs>
                <RadialGradient id="bot-aura" cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.12} />
                  <Stop offset="0.7" stopColor="#FFFFFF" stopOpacity={0.04} />
                  <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
                </RadialGradient>
                <RadialGradient id="bot-floor" cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.3} />
                  <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Ellipse cx={side * 0.47} cy={side * 0.46} rx={side * 0.5} ry={side * 0.5} fill="url(#bot-aura)" />
              {whole && <Ellipse cx={side * 0.47} cy={side * 0.965} rx={side * 0.3} ry={side * 0.028} fill="url(#bot-floor)" />}
            </Svg>
          </Animated.View>

          {whole && <Image source={BODY} style={layer} fadeDuration={0} />}
          {whole && <Animated.Image source={LEFT} style={[layer, pivot(LEFT_SHOULDER), leftMove]} fadeDuration={0} />}
          {whole && <Animated.Image source={ARM} style={[layer, pivot(SHOULDER), armMove]} fadeDuration={0} />}

          <Animated.View style={[layer, pivot(NECK), headMove]}>
            <Image source={HEAD} style={layer} fadeDuration={0} />
            {EYES.map((e) => (
              <Animated.View key={e.x} style={[{ position: "absolute", left: (e.x - EYE_W / 2) * side, top: (e.y - EYE_H / 2) * side, width: EYE_W * side, height: EYE_H * side, alignItems: "center", justifyContent: "center" }, eyes]}>
                <View style={{ width: EYE_W * side, height: EYE_H * side, alignItems: "center", justifyContent: "center", transform: [{ rotate: EYE_LEAN }] }}>
                  {/* A light's edge is soft: the glow fades out rather than stepping. */}
                  <Svg width={EYE_W * side * 2.6} height={EYE_H * side * 1.7} style={{ position: "absolute" }}>
                    <Defs>
                      <RadialGradient id="bot-eye" cx="50%" cy="50%" r="50%">
                        <Stop offset="0.35" stopColor="#FFFFFF" stopOpacity={0.42} />
                        <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
                      </RadialGradient>
                    </Defs>
                    <Ellipse cx={EYE_W * side * 1.3} cy={EYE_H * side * 0.85} rx={EYE_W * side * 1.3} ry={EYE_H * side * 0.85} fill="url(#bot-eye)" />
                  </Svg>
                  <View style={{ width: EYE_W * side, height: EYE_H * side, borderRadius: EYE_W * side, backgroundColor: "#FFFFFF" }} />
                </View>
              </Animated.View>
            ))}
            <Animated.View style={[{ position: "absolute", left: MOUTH.x * side - box / 2, top: MOUTH.y * side - box / 2, width: box, height: box, transform: [{ rotate: "-11deg" }] }, mouth]}>
              <Svg width={box} height={box}>
                <AnimatedPath animatedProps={mouthGlow} fill="#FFFFFF" fillOpacity={0.16} stroke="#FFFFFF" strokeOpacity={0.16} strokeWidth={side * 0.024} strokeLinejoin="round" />
                <AnimatedPath animatedProps={mouthProps} fill="#FFFFFF" stroke="#FFFFFF" strokeWidth={side * 0.005} strokeLinejoin="round" />
              </Svg>
            </Animated.View>
          </Animated.View>
        </View>
      </View>
    </Animated.View>
  );
}
