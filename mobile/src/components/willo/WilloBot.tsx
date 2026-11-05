import { useEffect, useMemo, useRef } from "react";
import { Image, PanResponder, View } from "react-native";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";
import type { OrbMode } from "~/components/registro/ParticleOrb";

/**
 * Willo the robot: a glass figure cut into three layers, head, body and arm, all drawn on the
 * same square so they line up by themselves. The eyes are not in the picture; they are drawn
 * here, so he can blink and look around. Small, he is only his head.
 *
 * He floats and leans at his own pace and waves now and then. Listening, he follows the voice:
 * his eyes open and the light behind him grows as you speak, and he is still when you stop.
 * Working, his eyes dart. A finger on him and he looks where it goes.
 */

const BODY = require("../../../assets/images/bot/body.png");
const ARM = require("../../../assets/images/bot/arm.png");
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
  const wave = useSharedValue({ on: 0, until: 2.6, next: 12 });
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

    const l = look.get();
    let { tx, ty, next } = l;
    if (t > next) {
      const reach = calm ? 0.1 : busy ? 1 : 0.7;
      tx = (Math.random() * 2 - 1) * reach;
      ty = (Math.random() * 2 - 1) * reach * 0.6;
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

    /* Waves as he arrives, then every so often while nothing else is going on. */
    const w = wave.get();
    let { until, next: nextWave } = w;
    if (t > nextWave && !calm && !busy && !hearing.get()) {
      until = t + 1.5;
      nextWave = t + 14 + Math.random() * 14;
    }
    wave.set({ on: w.on + ((t < until && !calm ? 1 : 0) - w.on) * Math.min(1, dt * 6), until, next: nextWave });

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
    [finger, heldNow, press, size],
  );

  /* ---- how each part moves ---- */

  const figure = useAnimatedStyle(() => {
    const calm = still.get() === 1 ? 0 : 1;
    return {
      transform: [
        { translateY: calm * Math.sin(clock.get() * 1.15) * size * 0.016 },
        { scale: 1 + swell.get() * 0.1 - press.get() * 0.035 + talk.get() * 0.025 },
      ],
    };
  });

  const headMove = useAnimatedStyle(() => {
    const t = clock.get();
    const l = look.get();
    const f = finger.get();
    const calm = still.get() === 1 ? 0 : 1;
    return {
      transform: [{ rotate: `${calm * Math.sin(t * 0.8) * 1.8 + (l.x + f.x) * 2.6 + talk.get() * 2}deg` }, { translateY: -talk.get() * side * 0.006 }],
    };
  });

  const armMove = useAnimatedStyle(() => {
    const t = clock.get();
    const calm = still.get() === 1 ? 0 : 1;
    const w = wave.get().on;
    return { transform: [{ rotate: `${calm * (Math.sin(t * 1.15 + 0.6) * 2 + w * (Math.sin(t * 9) * 11 - 8))}deg` }] };
  });

  const eyes = useAnimatedStyle(() => {
    const l = look.get();
    const f = finger.get();
    return {
      transform: [
        { translateX: clamp(l.x + f.x, -1, 1) * side * 0.022 },
        { translateY: clamp(l.y + f.y, -1, 1) * side * 0.014 },
        { scaleY: Math.max(0.1, (1 + talk.get() * 0.12) * (1 - lid.get().shut)) },
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
                  <Stop offset="0" stopColor="#6B6BFF" stopOpacity={0.2} />
                  <Stop offset="0.7" stopColor="#3E8BFF" stopOpacity={0.07} />
                  <Stop offset="1" stopColor="#3E8BFF" stopOpacity={0} />
                </RadialGradient>
                <RadialGradient id="bot-floor" cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor="#7C6BFF" stopOpacity={0.55} />
                  <Stop offset="1" stopColor="#3E5BFF" stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Ellipse cx={side * 0.47} cy={side * 0.46} rx={side * 0.5} ry={side * 0.5} fill="url(#bot-aura)" />
              {whole && <Ellipse cx={side * 0.47} cy={side * 0.965} rx={side * 0.3} ry={side * 0.028} fill="url(#bot-floor)" />}
            </Svg>
          </Animated.View>

          {whole && <Image source={BODY} style={layer} fadeDuration={0} />}
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
                        <Stop offset="0.35" stopColor="#3E8BFF" stopOpacity={0.75} />
                        <Stop offset="1" stopColor="#2A5BFF" stopOpacity={0} />
                      </RadialGradient>
                    </Defs>
                    <Ellipse cx={EYE_W * side * 1.3} cy={EYE_H * side * 0.85} rx={EYE_W * side * 1.3} ry={EYE_H * side * 0.85} fill="url(#bot-eye)" />
                  </Svg>
                  <View style={{ width: EYE_W * side, height: EYE_H * side, borderRadius: EYE_W * side, backgroundColor: "#E4F2FF" }} />
                </View>
              </Animated.View>
            ))}
          </Animated.View>
        </View>
      </View>
    </Animated.View>
  );
}
