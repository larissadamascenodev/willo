import { useEffect, useMemo } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedProps,
  useDerivedValue,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
} from "react-native-reanimated";
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
 */

export type OrbMode = "idle" | "listening" | "thinking";

const AnimatedPath = Animated.createAnimatedComponent(Path);

const SPEED: Record<OrbMode, number> = { idle: 0.32, listening: 0.95, thinking: 2.2 };
const TILT = 0.38;

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

export default function ParticleOrb({
  size,
  mode = "idle",
  density,
}: {
  size: number;
  mode?: OrbMode;
  /** How many points; by default enough for the size. */
  density?: number;
}) {
  const reduce = useReducedMotion();
  const count = density ?? (size >= 180 ? 950 : size >= 60 ? 360 : 130);
  const points = useMemo(() => cloud(count), [count]);

  const angle = useSharedValue(0);
  const speed = useSharedValue(SPEED[mode]);
  const target = useSharedValue(SPEED[mode]);
  const clock = useSharedValue(0);
  const breath = useSharedValue(mode === "listening" ? 1 : 0);
  const breathTarget = useSharedValue(mode === "listening" ? 1 : 0);

  useEffect(() => {
    target.set(reduce ? SPEED.idle * 0.3 : SPEED[mode]);
    breathTarget.set(mode === "listening" && !reduce ? 1 : mode === "thinking" && !reduce ? 0.35 : 0);
  }, [mode, reduce, target, breathTarget]);

  useFrameCallback((frame) => {
    const dt = Math.min(0.05, (frame.timeSincePreviousFrame ?? 16) / 1000);
    const ease = Math.min(1, dt * 3);
    speed.set(speed.get() + (target.get() - speed.get()) * ease);
    breath.set(breath.get() + (breathTarget.get() - breath.get()) * ease);
    angle.set(angle.get() + speed.get() * dt);
    clock.set(clock.get() + dt);
  });

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
    const ct = Math.cos(TILT);
    const st = Math.sin(TILT);
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

  return (
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
  );
}
