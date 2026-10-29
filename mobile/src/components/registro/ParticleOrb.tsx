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
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from "react-native-svg";

/**
 * Willo listening: a sphere of particles, turning.
 *
 * Fine points scattered at random over a sphere — random rather than even, so it
 * reads as dust and not as a lattice — are turned about a tilted axis and drawn in
 * three passes: the rim brightest, where the surface folds away from the eye and
 * the points crowd together, the face towards us softer, the far side faint. That
 * is what makes it read as a lit shell rather than a ball of dots.
 *
 * It idles slowly. Listening, it turns faster and breathes; working, it spins.
 * Every frame is worked out on the UI thread into one path per depth, so the
 * conversation can be busy on the JavaScript side without the sphere stuttering.
 *
 * With `onPress` it is something to touch. A finger on it turns it — the sphere
 * follows the drag, and keeps turning for a moment after a flick, slowing as if it
 * had weight — and a tap, which is a touch that did not travel, presses it in and
 * calls `onPress`. `expanded` is what a tap leads to: the sphere swells and settles
 * a little larger, so the thing that was pressed is visibly the thing that answers.
 */

export type OrbMode = "idle" | "listening" | "thinking";

const AnimatedPath = Animated.createAnimatedComponent(Path);

const SPEED: Record<OrbMode, number> = { idle: 0.32, listening: 0.95, thinking: 2.2 };
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
}: {
  size: number;
  mode?: OrbMode;
  /** How many points; by default enough for the size. */
  density?: number;
  /** Makes it touchable: drag to turn, tap to call this. */
  onPress?: () => void;
  /** Swollen, as when it has been tapped and is now listening. */
  expanded?: boolean;
}) {
  const reduce = useReducedMotion();
  const count = density ?? (size >= 180 ? 950 : size >= 60 ? 360 : 130);
  const points = useMemo(() => cloud(count), [count]);

  const angle = useSharedValue(0);
  const tilt = useSharedValue(TILT);
  const speed = useSharedValue(SPEED[mode]);
  const target = useSharedValue(SPEED[mode]);
  const clock = useSharedValue(0);
  const breath = useSharedValue(mode === "listening" ? 1 : 0);
  const breathTarget = useSharedValue(mode === "listening" ? 1 : 0);

  /* Touch: whether a finger is on it, what a flick left it spinning at, and how far
     it is pressed in. */
  const held = useSharedValue(0);
  const spin = useSharedValue(0);
  const press = useSharedValue(0);
  const swell = useSharedValue(expanded ? 1 : 0);

  useEffect(() => {
    target.set(reduce ? SPEED.idle * 0.3 : SPEED[mode]);
    breathTarget.set(mode === "listening" && !reduce ? 1 : mode === "thinking" && !reduce ? 0.35 : 0);
  }, [mode, reduce, target, breathTarget]);

  useEffect(() => {
    swell.set(withSpring(expanded ? 1 : 0, { duration: 620, dampingRatio: 0.66, reduceMotion: ReduceMotion.System }));
  }, [expanded, swell]);

  useFrameCallback((frame) => {
    const dt = Math.min(0.05, (frame.timeSincePreviousFrame ?? 16) / 1000);
    const ease = Math.min(1, dt * 3);
    speed.set(speed.get() + (target.get() - speed.get()) * ease);
    breath.set(breath.get() + (breathTarget.get() - breath.get()) * ease);
    clock.set(clock.get() + dt);

    if (held.get() === 0) {
      /* Let go: the flick carries on and fades, and the tilt settles back. */
      spin.set(spin.get() * Math.exp(-dt * 2.3));
      tilt.set(tilt.get() + (TILT - tilt.get()) * Math.min(1, dt * 2.6));
      angle.set(angle.get() + (speed.get() + spin.get()) * dt);
    }
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
    [angle, held, press, size, spin, tilt],
  );

  const half = size / 2;
  const radius = size * 0.42;
  const dot = Math.max(0.7, size / 250);

  /* One pass over the points per frame, written into three paths by depth. */
  const paths = useDerivedValue(() => {
    const a = angle.get();
    const t = clock.get();
    const pulse = 1 + breath.get() * (0.045 * Math.sin(t * 5.2) + 0.02 * Math.sin(t * 8.3));
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
      const px = half + x1 * r;
      const py = half + y2 * r;
      if (z2 > -0.42 && z2 < 0.42) {
        /* The rim. */
        const s = dot * 1.25;
        near += `M${px.toFixed(1)} ${py.toFixed(1)}h${s}v${s}h-${s}z`;
      } else if (z2 >= 0.42) {
        /* The face towards us. */
        const s = dot;
        mid += `M${px.toFixed(1)} ${py.toFixed(1)}h${s}v${s}h-${s}z`;
      } else {
        const s = dot * 0.8;
        far += `M${px.toFixed(1)} ${py.toFixed(1)}h${s}v${s}h-${s}z`;
      }
    }
    return { far: far || "M0 0", mid: mid || "M0 0", near: near || "M0 0" };
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
      <View style={{ width: size, height: size }} pointerEvents="none">
        <Svg width={size} height={size}>
          <Defs>
            <RadialGradient id="orb-glow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.07} />
              <Stop offset="0.55" stopColor="#FFFFFF" stopOpacity={0.03} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={half} cy={half} r={half} fill="url(#orb-glow)" />
          <AnimatedPath animatedProps={farProps} fill="#FFFFFF" fillOpacity={0.24} />
          <AnimatedPath animatedProps={midProps} fill="#FFFFFF" fillOpacity={0.45} />
          <AnimatedPath animatedProps={nearProps} fill="#FFFFFF" fillOpacity={0.92} />
        </Svg>
      </View>
    </Animated.View>
  );
}
