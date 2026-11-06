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

import { th } from "~/theme/theme";
/**
 * Willo the robot: graphite, dark metal and a mirrored black visor, lit along his edges in silver
 * and cold blue, with no colour of his own to fight whatever the background is. He is cut into six
 * layers, head, body, two arms and two legs, all on the same square so they line up by themselves.
 * The eyes and the mouth are not in the picture; they are drawn here, so they can move. Small, he
 * is only his head.
 *
 * He floats all the time, blinks, and looks around. Every other expression answers to something:
 * he waves as he arrives; listening, his mouth follows the voice; thinking, his head tilts and his
 * eyes dart; speaking, his mouth moves and now and then a hand explains. Left alone he has a small
 * repertoire: a smile with his eyes shut, a tilt of the head, a look of surprise, a wave. A tap and
 * he hops. Whatever he does, he comes back to where he was.
 */

const BODY = require("../../../assets/images/bot/body.png");
const ARM_LEFT = require("../../../assets/images/bot/arm_left.png");
const ARM_RIGHT = require("../../../assets/images/bot/arm_right.png");
const LEG_LEFT = require("../../../assets/images/bot/leg_left.png");
const LEG_RIGHT = require("../../../assets/images/bot/leg_right.png");
const HEAD = require("../../../assets/images/bot/head.png");

/* Where things are on the square, as shares of its side. */
const EYES = [
  { x: 0.388, y: 0.3013 },
  { x: 0.6146, y: 0.3013 },
];
const EYE_W = 0.06;
const EYE_H = 0.119;
const MOUTH = { x: 0.5025, y: 0.3684 };
const MOUTH_BOX = 0.24;
const NECK = { x: 0.5, y: 0.51 };
/* Inside the torso: the arms go behind it, so they come out from behind at any angle and the
   torso keeps its shape. */
const SHOULDER_LEFT = { x: 0.3608, y: 0.6051 };
const SHOULDER_RIGHT = { x: 0.6392, y: 0.6051 };
const HIP_LEFT = { x: 0.3987, y: 0.833 };
const HIP_RIGHT = { x: 0.6013, y: 0.833 };
/* The head alone: its middle, and how much of the side it takes. */
const HEAD_ONLY = { x: 0.5, y: 0.263, span: 0.74 };
const FULL_BODY_FROM = 110;

const WHITE = "#EEF6FF";
const COLD = "#6FA8E8";

const TAP_SLOP = 9;
const TAP_MS = 420;
const HOLD_MS = 320;

/* What runs on the UI thread must say so: without "worklet", the app dies on opening. */
const clamp = (v: number, lo: number, hi: number) => {
  "worklet";
  return Math.min(Math.max(v, lo), hi);
};

const WAVE = 1;
const TILT = 2;
const HOP = 3;
const SMILE = 4;
const SURPRISE = 5;
const EXPLAIN = 6;

const durationOf = (kind: number) => {
  "worklet";
  return kind === WAVE ? 1.8 : kind === HOP ? 0.9 : kind === SURPRISE ? 1.4 : kind === EXPLAIN ? 2.4 : 2.2;
};

/* Left alone, a smile or a tilt more often than anything louder. */
const idleKind = (roll: number) => {
  "worklet";
  return roll < 0.38 ? SMILE : roll < 0.7 ? TILT : roll < 0.87 ? WAVE : SURPRISE;
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
  const speaking = useSharedValue(mode === "speaking" ? 1 : 0);
  const voice = useSharedValue(-1);
  const talk = useSharedValue(0);
  const look = useSharedValue({ x: 0, y: 0, tx: 0, ty: 0, next: 1 });
  const lid = useSharedValue({ shut: 0, from: -1, next: 2.4 });
  const finger = useSharedValue({ x: 0, y: 0 });
  /* He arrives with a wave, on the side he holds up first. */
  const act = useSharedValue({ kind: reduce ? 0 : WAVE, from: 0.5, next: 9, sign: 1 });
  const wave = useSharedValue(0);
  const tilt = useSharedValue(0);
  const hop = useSharedValue(0);
  const joy = useSharedValue(0);
  const wow = useSharedValue(0);
  const hand = useSharedValue(0);
  const small = useSharedValue(0);
  const poke = useSharedValue(0);
  const press = useSharedValue(0);
  const swell = useSharedValue(expanded ? 1 : 0);
  const heldNow = useSharedValue(0);

  useEffect(() => {
    working.set(mode === "thinking" ? 1 : 0);
    hearing.set(mode === "listening" ? 1 : 0);
    speaking.set(mode === "speaking" ? 1 : 0);
    still.set(reduce ? 1 : 0);
  }, [mode, reduce, working, hearing, speaking, still]);
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
    const saying = speaking.get() === 1;
    const free = !calm && !busy && !hearing.get() && !saying;

    /* What he is up to. */
    const a = act.get();
    let { kind, from: began, next: nextAct, sign } = a;
    if (poke.get() === 1) {
      poke.set(0);
      kind = HOP;
      began = t;
      nextAct = Math.max(nextAct, t + 6);
    }
    /* What he is doing ends with its time, or sooner when the moment changes. */
    const fits = free || kind === HOP || (saying && kind === EXPLAIN);
    if (kind !== 0 && (t - began > durationOf(kind) || !fits)) kind = 0;
    if (kind === 0 && t > nextAct) {
      if (free) {
        kind = idleKind(Math.random());
        began = t;
        sign = Math.random() < 0.5 ? -1 : 1;
        nextAct = t + durationOf(kind) + 6 + Math.random() * 8;
      } else if (saying) {
        kind = EXPLAIN;
        began = t;
        sign = Math.random() < 0.5 ? -1 : 1;
        nextAct = t + durationOf(kind) + 2 + Math.random() * 4;
      }
    }
    act.set({ kind, from: began, next: nextAct, sign });

    const started = kind !== 0 && t >= began;
    const p = started ? Math.min(1, (t - began) / durationOf(kind)) : 0;
    const env = Math.sin(p * Math.PI);
    /* In, a long hold, and out: not the swell and fall of a breath. */
    const held = Math.min(1, env * 2.4);
    const settle = Math.min(1, dt * 8);
    const toward = (value: number, target: number) => {
      "worklet";
      return value + (target - value) * settle;
    };

    hop.set(kind === HOP ? Math.abs(Math.sin(p * Math.PI * 2)) * env : 0);
    wave.set(toward(wave.get(), kind === WAVE ? held : 0));
    joy.set(toward(joy.get(), kind === SMILE || kind === HOP ? held : 0));
    wow.set(toward(wow.get(), kind === SURPRISE ? held : 0));
    hand.set(toward(hand.get(), kind === EXPLAIN ? held : 0));
    /* Thinking, he tilts his head as well as narrowing his mouth. */
    tilt.set(toward(tilt.get(), kind === TILT ? sign * held : kind === EXPLAIN ? sign * held * 0.35 : kind === WAVE ? -sign * held * 0.35 : busy ? 0.7 : 0));
    small.set(toward(small.get(), busy ? 1 : 0));

    const l = look.get();
    let { tx, ty, next } = l;
    if (kind === TILT) {
      tx = sign * 0.6;
      ty = -0.4;
    } else if (t > next) {
      const span = calm ? 0.1 : busy ? 1 : 0.55;
      tx = (Math.random() * 2 - 1) * span;
      ty = (Math.random() * 2 - 1) * span * 0.6;
      next = t + (busy ? 0.35 + Math.random() * 0.5 : 1.8 + Math.random() * 3);
    }
    const eased = Math.min(1, dt * (busy ? 9 : 4));
    look.set({ x: l.x + (tx - l.x) * eased, y: l.y + (ty - l.y) * eased, tx, ty, next });

    const b = lid.get();
    let { from, next: nextLid } = b;
    if (t > nextLid && !calm) {
      from = t;
      nextLid = t + (Math.random() < 0.2 ? 0.26 : 2.4 + Math.random() * 3.6);
    }
    const since = t - from;
    lid.set({ shut: from >= 0 && since < 0.17 ? Math.sin((since / 0.17) * Math.PI) : 0, from, next: nextLid });

    /* With a voice to follow he follows it; speaking, the mouth goes with no fixed beat. */
    const words = 0.42 + 0.34 * Math.sin(t * 11) * Math.sin(t * 3.7);
    const heard = hearing.get() ? (voice.get() >= 0 ? voice.get() : 0.45 + 0.3 * Math.sin(t * 5.2)) : saying || kind === EXPLAIN ? words : 0;
    talk.set(talk.get() + (heard - talk.get()) * Math.min(1, dt * 14));

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
    /* He arrives with a small spring, and stretches a little as he leaves the ground. */
    const arrived = Math.min(1, clock.get() / 0.55);
    const entrance = 0.86 + 0.14 * (1 - (1 - arrived) * (1 - arrived) * (1 - arrived));
    const up = hop.get();
    return {
      transform: [
        { translateY: calm * Math.sin(clock.get() * 1.15) * size * 0.016 - up * size * 0.08 - wow.get() * size * 0.018 },
        { scale: entrance * (1 + swell.get() * 0.1 - press.get() * 0.035 + (hearing.get() ? talk.get() * 0.025 : 0)) },
        { scaleY: 1 + up * 0.03 },
        { scaleX: 1 - up * 0.02 },
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
        { rotate: `${calm * Math.sin(t * 0.8) * 1.4 + (l.x + f.x) * 2.2 + tilt.get() * 12}deg` },
        { translateY: -wow.get() * side * 0.008 + (speaking.get() ? Math.sin(clock.get() * 5) * side * 0.002 : 0) },
      ],
    };
  });

  /* The sign says which arm answers: this one, whose hand is left of its shoulder, goes up by
     turning to the right. The other mirrors it. */
  const armAngle = (t: number, phase: number, mine: number) => {
    "worklet";
    const on = act.get().sign === mine ? 1 : 0;
    return (
      Math.sin(t * 1.15 + phase) * 2.2 +
      on * wave.get() * (92 + Math.sin(t * 9) * 9) +
      on * hand.get() * (46 + Math.sin(t * 3.4) * 7) +
      hop.get() * 26 +
      wow.get() * 16 +
      joy.get() * 7
    );
  };
  const armLeft = useAnimatedStyle(() => {
    const calm = still.get() === 1 ? 0 : 1;
    return { transform: [{ rotate: `${calm * armAngle(clock.get(), 0.6, 1)}deg` }] };
  });
  const armRight = useAnimatedStyle(() => {
    const calm = still.get() === 1 ? 0 : 1;
    return { transform: [{ rotate: `${-calm * armAngle(clock.get(), 2.2, -1)}deg` }] };
  });

  /* The legs hang and swing a little, out of step, and kick as he leaves the ground. */
  const legLeft = useAnimatedStyle(() => {
    const calm = still.get() === 1 ? 0 : 1;
    return { transform: [{ rotate: `${calm * (Math.sin(clock.get() * 1.3) * 2.2 + hop.get() * 9)}deg` }] };
  });
  const legRight = useAnimatedStyle(() => {
    const calm = still.get() === 1 ? 0 : 1;
    return { transform: [{ rotate: `${calm * (Math.sin(clock.get() * 1.3 + 1.7) * 2.2 - hop.get() * 9)}deg` }] };
  });

  const eyes = useAnimatedStyle(() => {
    const l = look.get();
    const f = finger.get();
    const big = 1 + wow.get() * 0.14;
    return {
      transform: [
        { translateX: clamp(l.x + f.x, -1, 1) * side * 0.02 },
        { translateY: clamp(l.y + f.y, -1, 1) * side * 0.012 },
        { scaleX: big },
        { scaleY: big * Math.max(0.1, (1 - lid.get().shut) * (1 - joy.get() * 0.7)) },
      ],
    };
  });
  /* The eyes shut in a smile: the pills go flat, and arcs take their place. */
  const pill = useAnimatedStyle(() => ({ opacity: clamp(2 - joy.get() * 3, 0, 1) }));
  const arc = useAnimatedStyle(() => ({ opacity: clamp(joy.get() * 3 - 0.6, 0, 1) }));

  /* The mouth is one shape with two edges: apart, it is a smile; further apart, a mouth open;
     short and round, surprise; close together, the small line he makes while he thinks. */
  const box = MOUTH_BOX * side;
  const mouthShape = (open: number, glad: number, thin: number, oh: number) => {
    "worklet";
    const c = box / 2;
    const half = side * (0.044 + glad * 0.01 - open * 0.012 - thin * 0.024 - oh * 0.026);
    const upper = side * (0.014 + glad * 0.004 - open * 0.05 - thin * 0.008 - oh * 0.05);
    const lower = side * (0.082 + glad * 0.02 + open * 0.03 - thin * 0.07 - oh * 0.05);
    const y = c - lower / 4;
    return `M${(c - half).toFixed(2)} ${y.toFixed(2)}Q${c.toFixed(2)} ${(y + upper).toFixed(2)} ${(c + half).toFixed(2)} ${y.toFixed(2)}Q${c.toFixed(2)} ${(y + lower).toFixed(2)} ${(c - half).toFixed(2)} ${y.toFixed(2)}Z`;
  };
  /* Read here, not inside the shape: only what the updater itself reads makes it run again. */
  const mouthProps = useAnimatedProps(() => ({ d: mouthShape(talk.get(), joy.get(), small.get(), wow.get()) }));
  const mouthGlow = useAnimatedProps(() => ({ d: mouthShape(talk.get(), joy.get(), small.get(), wow.get()) }));
  const mouth = useAnimatedStyle(() => {
    const l = look.get();
    const f = finger.get();
    return {
      transform: [
        { translateX: clamp(l.x + f.x, -1, 1) * side * 0.016 + small.get() * Math.sin(clock.get() * 2.4) * side * 0.006 },
        { translateY: clamp(l.y + f.y, -1, 1) * side * 0.01 },
      ],
    };
  });

  const aura = useAnimatedStyle(() => {
    const lit = hearing.get() ? talk.get() : 0;
    return { opacity: 0.6 + lit * 0.4, transform: [{ scale: 1 + lit * 0.14 }] };
  });

  const layer = { position: "absolute" as const, left: 0, top: 0, width: side, height: side };
  const pivot = (p: { x: number; y: number }) => ({ transformOrigin: [p.x * side, p.y * side, 0] as [number, number, number] });
  const w = EYE_W * side;
  const h = EYE_H * side;

  return (
    <Animated.View {...(onPress ? responder.panHandlers : {})} style={[{ width: size, height: size }, figure]} accessibilityRole={onPress ? "button" : undefined}>
      <View pointerEvents="none" style={{ width: size, height: size }}>
        <View style={{ position: "absolute", left, top, width: side, height: side }}>
          {/* The light he stands in, cold and faint. */}
          <Animated.View style={[layer, aura]}>
            <Svg width={side} height={side}>
              <Defs>
                <RadialGradient id="bot-aura" cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor={th(COLD, "grad")} stopOpacity={0.2} />
                  <Stop offset="0.7" stopColor={th(COLD, "grad")} stopOpacity={0.06} />
                  <Stop offset="1" stopColor={th(COLD, "grad")} stopOpacity={0} />
                </RadialGradient>
                <RadialGradient id="bot-floor" cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor={th(COLD, "grad")} stopOpacity={0.4} />
                  <Stop offset="1" stopColor={th(COLD, "grad")} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Ellipse cx={side * 0.5} cy={side * 0.46} rx={side * 0.5} ry={side * 0.5} fill="url(#bot-aura)" />
              {whole && <Ellipse cx={side * 0.5} cy={side * 0.982} rx={side * 0.3} ry={side * 0.016} fill="url(#bot-floor)" />}
            </Svg>
          </Animated.View>

          {whole && <Animated.Image source={LEG_LEFT} style={[layer, pivot(HIP_LEFT), legLeft]} fadeDuration={0} />}
          {whole && <Animated.Image source={LEG_RIGHT} style={[layer, pivot(HIP_RIGHT), legRight]} fadeDuration={0} />}
          {whole && <Animated.Image source={ARM_LEFT} style={[layer, pivot(SHOULDER_LEFT), armLeft]} fadeDuration={0} />}
          {whole && <Animated.Image source={ARM_RIGHT} style={[layer, pivot(SHOULDER_RIGHT), armRight]} fadeDuration={0} />}
          {whole && <Image source={BODY} style={layer} fadeDuration={0} />}

          <Animated.View style={[layer, pivot(NECK), headMove]}>
            <Image source={HEAD} style={layer} fadeDuration={0} />
            {EYES.map((e) => (
              <Animated.View key={e.x} style={[{ position: "absolute", left: e.x * side - w / 2, top: e.y * side - h / 2, width: w, height: h, alignItems: "center", justifyContent: "center" }, eyes]}>
                <Animated.View style={[{ width: w, height: h, alignItems: "center", justifyContent: "center" }, pill]}>
                  {/* A light's edge is soft: the glow fades out rather than stepping. */}
                  <Svg width={w * 2.4} height={h * 1.6} style={{ position: "absolute" }}>
                    <Defs>
                      <RadialGradient id="bot-eye" cx="50%" cy="50%" r="50%">
                        <Stop offset="0.35" stopColor={th(COLD, "grad")} stopOpacity={0.5} />
                        <Stop offset="1" stopColor={th(COLD, "grad")} stopOpacity={0} />
                      </RadialGradient>
                    </Defs>
                    <Ellipse cx={w * 1.2} cy={h * 0.8} rx={w * 1.2} ry={h * 0.8} fill="url(#bot-eye)" />
                  </Svg>
                  <View style={{ width: w, height: h, borderRadius: w, backgroundColor: th(WHITE, "bg") }} />
                </Animated.View>
              </Animated.View>
            ))}
            {/* Eyes shut in a smile. They do not take the pills' squash: they replace it. */}
            {EYES.map((e) => (
              <Animated.View key={`arc-${e.x}`} style={[{ position: "absolute", left: e.x * side - w * 1.1, top: e.y * side - w * 0.7, width: w * 2.2, height: w * 1.4 }, arc]}>
                <Svg width={w * 2.2} height={w * 1.4}>
                  <Path d={`M${w * 0.3} ${w * 1.05}Q${w * 1.1} ${-w * 0.35} ${w * 1.9} ${w * 1.05}`} stroke={th(COLD)} strokeOpacity={0.3} strokeWidth={w * 0.72} strokeLinecap="round" fill="none" />
                  <Path d={`M${w * 0.3} ${w * 1.05}Q${w * 1.1} ${-w * 0.35} ${w * 1.9} ${w * 1.05}`} stroke={th(WHITE)} strokeWidth={w * 0.42} strokeLinecap="round" fill="none" />
                </Svg>
              </Animated.View>
            ))}
            <Animated.View style={[{ position: "absolute", left: MOUTH.x * side - box / 2, top: MOUTH.y * side - box / 2, width: box, height: box }, mouth]}>
              <Svg width={box} height={box}>
                <AnimatedPath animatedProps={mouthGlow} fill={COLD} fillOpacity={0.24} stroke={COLD} strokeOpacity={0.24} strokeWidth={side * 0.03} strokeLinejoin="round" />
                <AnimatedPath animatedProps={mouthProps} fill={WHITE} stroke={WHITE} strokeWidth={side * 0.007} strokeLinejoin="round" />
              </Svg>
            </Animated.View>
          </Animated.View>

        </View>
      </View>
    </Animated.View>
  );
}
