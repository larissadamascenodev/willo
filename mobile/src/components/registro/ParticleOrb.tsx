import { useEffect, useMemo, useRef } from "react";
import { PanResponder, View } from "react-native";
import Animated, {
  ReduceMotion,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import Svg, { Circle, Defs, Ellipse, Path, RadialGradient, Stop } from "react-native-svg";

/**
 * Willo himself: a still shell of fine particles with two large eyes in its clear middle.
 *
 * The points are scattered at random over a sphere and drawn in three passes: the rim
 * brightest, where the surface folds away from the eye and the points crowd together, the
 * rest soft. Nothing fills it, so the screen shows through, and no point crosses the
 * middle, so the eyes sit on nothing. The sphere does not turn by itself; the points only
 * drift a little. It is the eyes that make him alive: he blinks, he looks around, he leans.
 *
 * Listening, his eyes grow taller and the shell breathes. Working, his eyes dart and sparks
 * rise off the top. Everything is worked out on the UI thread, so the conversation can be
 * busy without him stuttering.
 *
 * With `onPress` he is something to touch. A finger on him turns the shell, and he looks
 * where the finger goes; a flick keeps turning for a moment, slowing as if it had weight;
 * and a tap, a touch that did not travel, presses him in and calls `onPress`. `expanded`
 * is what a tap leads to: he swells and settles a little larger.
 */

export type OrbMode = "idle" | "listening" | "thinking";

const AnimatedPath = Animated.createAnimatedComponent(Path);

const SPARKS = 34;
const TILT = 0.38;
/** How far a drag turns it: radians per point, at the size the orb is drawn. */
const DRAG = 0.0135;
/** A touch that travels less than this is a tap. */
const TAP_SLOP = 9;
const TAP_MS = 420;

/** Points at random on a unit sphere, a few a little inside it for depth. */
function cloud(count: number, seed = 7): number[] {
  let s = seed;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const y = rand() * 2 - 1;
    const r = Math.sqrt(1 - y * y);
    const theta = rand() * Math.PI * 2;
    const depth = rand() < 0.85 ? 0.97 + rand() * 0.03 : 0.8 + rand() * 0.17;
    out.push(Math.cos(theta) * r * depth, y * depth, Math.sin(theta) * r * depth);
  }
  return out;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

export default function ParticleOrb({
  size,
  mode = "idle",
  density,
  onPress,
  expanded = false,
  loudness,
}: {
  size: number;
  mode?: OrbMode;
  /** How many points; by default enough for the size. */
  density?: number;
  /** Makes it touchable: drag to turn, tap to call this. */
  onPress?: () => void;
  /** Swollen, as when it has been tapped and is now listening. */
  expanded?: boolean;
  /** How loud the voice is right now, 0 to 1: he moves with it, and is still when it is quiet. */
  loudness?: number;
}) {
  const reduce = useReducedMotion();
  const count = density ?? (size >= 180 ? 1500 : size >= 60 ? 650 : 260);
  const points = useMemo(() => cloud(count), [count]);

  const angle = useSharedValue(0);
  const tilt = useSharedValue(TILT);
  const clock = useSharedValue(0);
  const drawnAt = useSharedValue(0);
  const breath = useSharedValue(mode === "listening" ? 1 : 0);
  const breathTarget = useSharedValue(mode === "listening" ? 1 : 0);

  /* Touch: whether a finger is on it, what a flick left it spinning at, and how far
     it is pressed in. */
  const held = useSharedValue(0);
  const spin = useSharedValue(0);
  const press = useSharedValue(0);
  const swell = useSharedValue(expanded ? 1 : 0);

  /* The face: where he is looking, whether his eyes are shut, how open he is, how much
     he is shedding. */
  const look = useSharedValue({ x: 0, y: 0, tx: 0, ty: 0, next: 1 });
  const lid = useSharedValue({ shut: 0, from: -1, next: 2.2 });
  const open = useSharedValue(0);
  const sparks = useSharedValue(0);
  const burstUntil = useSharedValue(0);
  const nextBurst = useSharedValue(5);
  const working = useSharedValue(mode === "thinking" ? 1 : 0);
  const hearing = useSharedValue(mode === "listening" ? 1 : 0);
  const finger = useSharedValue({ x: 0, y: 0 });
  const talking = useSharedValue(0);
  const loud = useSharedValue(-1);
  useEffect(() => {
    loud.set(loudness ?? -1);
  }, [loudness, loud]);
  const still = useSharedValue(reduce ? 1 : 0);

  useEffect(() => {
    breathTarget.set(mode === "listening" && !reduce ? 1 : mode === "thinking" && !reduce ? 0.35 : 0);
    working.set(mode === "thinking" ? 1 : 0);
    hearing.set(mode === "listening" ? 1 : 0);
    still.set(reduce ? 1 : 0);
  }, [mode, reduce, breathTarget, working, hearing, still]);

  useEffect(() => {
    swell.set(withSpring(expanded ? 1 : 0, { duration: 620, dampingRatio: 0.66, reduceMotion: ReduceMotion.System }));
  }, [expanded, swell]);

  useFrameCallback((frame) => {
    const dt = Math.min(0.05, (frame.timeSincePreviousFrame ?? 16) / 1000);
    const ease = Math.min(1, dt * 3);
    breath.set(breath.get() + (breathTarget.get() - breath.get()) * ease);
    clock.set(clock.get() + dt);
    /* The points drift slowly: redrawing them a few times a second is enough, and leaves
       the frame free for whatever else is on the screen. Faster while it breathes. */
    if (clock.get() - drawnAt.get() > (breath.get() > 0.02 || talking.get() > 0.02 ? 0.05 : 0.14)) {
      drawnAt.set(clock.get());
    }

    if (held.get() === 0) {
      /* Let go: the flick carries on and fades, and the tilt settles back. */
      spin.set(spin.get() * Math.exp(-dt * 2.3));
      tilt.set(tilt.get() + (TILT - tilt.get()) * Math.min(1, dt * 2.6));
      angle.set(angle.get() + spin.get() * dt);
      finger.set({ x: finger.get().x * Math.exp(-dt * 4), y: finger.get().y * Math.exp(-dt * 4) });
    }

    const t = clock.get();
    const busy = working.get() === 1;
    const calm = still.get() === 1;

    /* Where he looks next: often and far when working, at his own pace otherwise. */
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

    /* A blink is a sixth of a second; one in five comes as a pair. */
    const b = lid.get();
    let { from, next: nextLid } = b;
    if (t > nextLid && !calm) {
      from = t;
      nextLid = t + (Math.random() < 0.2 ? 0.26 : 2.2 + Math.random() * 3.6);
    }
    const since = t - from;
    lid.set({ shut: from >= 0 && since < 0.17 ? Math.sin((since / 0.17) * Math.PI) : 0, from, next: nextLid });

    /* With a voice to follow he follows it; otherwise he moves as if talking. */
    const wantsTalk = hearing.get() && loud.get() >= 0 ? loud.get() : Math.max(working.get(), hearing.get()) * (0.5 + 0.5 * Math.sin(t * 7.5) * Math.sin(t * 3.1));
    talking.set(talking.get() + (wantsTalk - talking.get()) * Math.min(1, dt * 12));
    open.set(open.get() + ((hearing.get() ? 1 : 0) - open.get()) * Math.min(1, dt * 6));

    /* Sparks: all the time at work, a little when listening, every so often idle. */
    if (t > nextBurst.get() && !calm) {
      burstUntil.set(t + 1.5);
      nextBurst.set(t + 7 + Math.random() * 6);
    }
    const wanted = calm ? 0 : busy ? 1 : hearing.get() ? 0.45 : t < burstUntil.get() ? 0.55 : 0;
    sparks.set(sparks.get() + (wanted - sparks.get()) * Math.min(1, dt * 2.6));
  });

  /* ---- the finger ---- */

  const touch = useRef({ x: 0, y: 0, travelled: 0, at: 0 });
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !!onPressRef.current,
        onMoveShouldSetPanResponder: () => !!onPressRef.current,
        onPanResponderGrant: () => {
          touch.current = { x: 0, y: 0, travelled: 0, at: Date.now() };
          held.set(1);
          spin.set(0);
          press.set(withTiming(1, { duration: 140 }));
        },
        onPanResponderMove: (_, g) => {
          const dx = g.dx - touch.current.x;
          const dy = g.dy - touch.current.y;
          touch.current.x = g.dx;
          touch.current.y = g.dy;
          touch.current.travelled = Math.max(touch.current.travelled, Math.hypot(g.dx, g.dy));
          /* The sphere follows the finger: across turns it about the vertical axis,
             down and up tips it. */
          angle.set(angle.get() + dx * DRAG * (300 / Math.max(size, 120)));
          tilt.set(clamp(tilt.get() + dy * 0.007, -0.35, 1.2));
          /* He looks where the finger goes. */
          finger.set({ x: clamp(g.dx / (size * 0.45), -1, 1), y: clamp(g.dy / (size * 0.45), -1, 1) });
        },
        onPanResponderRelease: (_, g) => {
          held.set(0);
          press.set(withTiming(0, { duration: 220 }));
          const tapped = touch.current.travelled < TAP_SLOP && Date.now() - touch.current.at < TAP_MS;
          if (tapped) {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
            onPressRef.current?.();
          } else {
            /* A flick keeps going. g.vx is points per millisecond. */
            spin.set(clamp(g.vx * 1000 * DRAG * (300 / Math.max(size, 120)), -10, 10));
          }
        },
        onPanResponderTerminate: () => {
          held.set(0);
          press.set(withTiming(0, { duration: 220 }));
        },
      }),
    [angle, finger, held, press, size, spin, tilt],
  );

  const half = size / 2;
  const radius = size * 0.45;
  const dot = Math.max(0.7, size / 300);
  const eyeW = Math.max(1.8, size * 0.052);
  const eyeH = size * 0.2;
  /* Past this the shell begins: the eyes have the middle to themselves. */
  const clearing = radius * 0.58;

  /* One pass over the points per frame, written into three paths by depth. */
  const paths = useDerivedValue(() => {
    const a = angle.get();
    const t = drawnAt.get();
    const pulse = loud.get() >= 0 && hearing.get() ? 1 + talking.get() * 0.07 : 1 + breath.get() * (0.045 * Math.sin(t * 5.2) + 0.02 * Math.sin(t * 8.3));
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const tl = tilt.get();
    const ct = Math.cos(tl);
    const st = Math.sin(tl);
    const r = radius * pulse;
    let far = "";
    let mid = "";
    let near = "";
    for (let i = 0; i < points.length; i += 3) {
      const x0 = points[i];
      const y0 = points[i + 1];
      const z0 = points[i + 2];
      /* About the vertical axis, then tipped towards the viewer. */
      const x1 = x0 * ca + z0 * sa;
      const z1 = -x0 * sa + z0 * ca;
      const y2 = y0 * ct - z1 * st;
      const z2 = y0 * st + z1 * ct;
      /* Each point drifts a little on its own, instead of the whole sphere turning. */
      const px = half + x1 * r + Math.sin(t * 0.5 + i) * size * 0.003;
      const py = half + y2 * r + Math.cos(t * 0.42 + i * 1.3) * size * 0.003;
      if (Math.hypot(px - half, py - half) < clearing) continue;
      if (z2 > -0.42 && z2 < 0.42) {
        /* The rim. */
        const s = dot;
        near += `M${px.toFixed(1)} ${py.toFixed(1)}h${s}v${s}h-${s}z`;
      } else if (z2 >= 0.42) {
        /* The face towards us. */
        const s = dot;
        mid += `M${px.toFixed(1)} ${py.toFixed(1)}h${s}v${s}h-${s}z`;
      } else {
        const s = dot;
        far += `M${px.toFixed(1)} ${py.toFixed(1)}h${s}v${s}h-${s}z`;
      }
    }
    return { far: far || "M0 0", mid: mid || "M0 0", near: near || "M0 0" };
  });

  /* What he sheds, rising off the top of the sphere and going out as it goes. */
  const sparkProps = useAnimatedProps(() => {
    const amount = sparks.get();
    const t = clock.get();
    let d = "";
    const shown = Math.floor(SPARKS * amount);
    for (let i = 0; i < shown; i++) {
      const seed = (i * 2.399963) % (Math.PI * 2);
      const life = (t * (0.32 + (i % 5) * 0.04) + i / SPARKS) % 1;
      const across = Math.cos(seed) * (0.55 + 0.25 * Math.sin(i)) * (1 - life * 0.3);
      const px = half + radius * (across + 0.05 * Math.sin(t * 2 + i));
      const py = half - radius * (0.28 + life * 0.95);
      const s = Math.max(0.5, dot * 1.9 * (1 - life));
      d += `M${px.toFixed(1)} ${Math.max(0, py).toFixed(1)}h${s.toFixed(1)}v${s.toFixed(1)}h-${s.toFixed(1)}z`;
    }
    return { d: d || "M0 0" };
  });

  /* He floats, and leans into where he is looking. */
  const face = useAnimatedStyle(() => {
    const t = clock.get();
    const l = look.get();
    const f = finger.get();
    const calm = still.get() === 1 ? 0 : 1;
    const o = open.get();
    const x = (l.x + f.x) * size * 0.05;
    const y = (l.y + f.y) * size * 0.04 + calm * Math.sin(t * 1.25) * size * 0.012;
    return {
      transform: [
        { translateX: x },
        { translateY: y },
        { rotate: `${calm * Math.sin(t * 0.8) * 2.6 + l.x * 5}deg` },
        { scaleX: 1 + o * 0.08 + calm * 0.015 * Math.sin(t * 1.7) },
        { scaleY: 1 + o * 0.04 + talking.get() * 0.06 - calm * 0.015 * Math.sin(t * 1.7) },
      ],
    };
  });

  /* The eyes travel further than the band, which is what makes it a look. */
  const eyes = useAnimatedStyle(() => {
    const l = look.get();
    const f = finger.get();
    return {
      transform: [
        { translateX: (l.x + f.x) * size * 0.035 },
        { translateY: (l.y + f.y) * size * 0.015 },
        { scaleY: Math.max(0.12, (1 + open.get() * 0.22) * (1 - lid.get().shut)) },
      ],
    };
  });

  const farProps = useAnimatedProps(() => ({ d: paths.get().far }));
  const midProps = useAnimatedProps(() => ({ d: paths.get().mid }));
  const nearProps = useAnimatedProps(() => ({ d: paths.get().near }));

  /* Pressed in under a finger; swollen once it has been tapped. */
  const body = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + swell.get() * 0.17 - press.get() * 0.035 }],
  }));

  return (
    <Animated.View
      {...(onPress ? responder.panHandlers : {})}
      style={[{ width: size, height: size }, body]}
      accessibilityRole={onPress ? "button" : undefined}
    >
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }} pointerEvents="none">
        {/* The sphere: only its points, with the screen showing through */}
        <Svg width={size} height={size} style={{ position: "absolute" }}>
          <Defs>
            <RadialGradient id="orb-glow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.07} />
              <Stop offset="0.55" stopColor="#FFFFFF" stopOpacity={0.03} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={half} cy={half} r={half} fill="url(#orb-glow)" />
          <AnimatedPath animatedProps={farProps} fill="#FFFFFF" fillOpacity={0.22} />
          <AnimatedPath animatedProps={midProps} fill="#FFFFFF" fillOpacity={0.22} />
          <AnimatedPath animatedProps={nearProps} fill="#FFFFFF" fillOpacity={0.7} />
          <AnimatedPath animatedProps={sparkProps} fill="#FFFFFF" fillOpacity={0.7} />
        </Svg>

        {/* The eyes */}
        <Animated.View style={[{ alignItems: "center", justifyContent: "center" }, face]}>
          <Animated.View style={[{ flexDirection: "row", gap: size * 0.17 }, eyes]}>
            {[0, 1].map((n) => (
              <View key={n} style={{ width: eyeW, height: eyeH, alignItems: "center", justifyContent: "center" }}>
                {/* A light's edge is soft: the glow fades out rather than stepping. */}
                <Svg width={size * 0.16} height={size * 0.28} style={{ position: "absolute" }}>
                  <Defs>
                    <RadialGradient id="orb-eye" cx="50%" cy="50%" r="50%">
                      <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.55} />
                      <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
                    </RadialGradient>
                  </Defs>
                  <Ellipse cx={size * 0.08} cy={size * 0.14} rx={size * 0.08} ry={size * 0.14} fill="url(#orb-eye)" />
                </Svg>
                <View style={{ width: eyeW, height: eyeH, borderRadius: eyeW, backgroundColor: "#FFFFFF" }} />
              </View>
            ))}
          </Animated.View>
        </Animated.View>
      </View>
    </Animated.View>
  );
}
