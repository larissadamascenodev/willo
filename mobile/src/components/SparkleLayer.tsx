import { useCallback, useEffect, useMemo, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import { onSparkle, type SparkleShower } from "~/lib/sparkles";
import { GREEN } from "~/theme/tokens";

/**
 * Where the sparkles are drawn: over everything, touching nothing.
 *
 * A burst throws them out from the middle of the screen, where the receipt's seal is,
 * and lets them drift down slowly, twinkling; rain lets them fall from the top. Every
 * piece is worked out from the shower's seed and the time since it began, so two layers
 * drawing the same shower draw the same thing at the same moment.
 */

const COUNT = { burst: 54, rain: 40 } as const;
const LENGTH_S = { burst: 4.4, rain: 3.6 } as const;
const COLORS = ["#FFFFFF", "#FFFFFF", GREEN, "#E8FFD0", "rgba(255,255,255,0.7)"];

interface Piece {
  x0: number;
  y0: number;
  vx: number;
  vy: number;
  drag: number;
  fall: number;
  delay: number;
  life: number;
  size: number;
  long: boolean;
  color: string;
  spin: number;
  phase: number;
  twinkle: number;
}

/** The same numbers from the same seed, on any layer. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function piecesOf(shower: SparkleShower, w: number, h: number): Piece[] {
  const r = seeded(shower.seed);
  return Array.from({ length: COUNT[shower.kind] }, () => {
    const common = {
      size: 2 + r() * 3,
      long: r() < 0.35,
      color: COLORS[Math.floor(r() * COLORS.length)],
      spin: (r() - 0.5) * 720,
      phase: r() * Math.PI * 2,
      twinkle: 5 + r() * 9,
    };
    if (shower.kind === "burst") {
      const angle = r() * Math.PI * 2;
      const speed = 140 + r() * 460;
      return { ...common, x0: w / 2 + (r() - 0.5) * 50, y0: h * 0.3 + (r() - 0.5) * 40, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 110, drag: 1.7, fall: 210, delay: r() * 0.12, life: 2.6 + r() * 1.7 };
    }
    return { ...common, x0: r() * w, y0: -16 - r() * h * 0.3, vx: (r() - 0.5) * 50, vy: 70 + r() * 110, drag: 0.6, fall: 150, delay: r() * 0.7, life: 2.3 + r() * 0.6 };
  });
}

function Bit({ p, clock }: { p: Piece; clock: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const t = clock.get() - p.delay;
    if (t <= 0 || t >= p.life) return { opacity: 0 };
    const e = Math.exp(-p.drag * t);
    const x = p.x0 + (p.vx * (1 - e)) / p.drag + Math.sin(t * 2.2 + p.phase) * 7;
    const y = p.y0 + (p.vy * (1 - e)) / p.drag + (p.fall / p.drag) * (t - (1 - e) / p.drag);
    const fadeIn = Math.min(1, t / 0.08);
    const fadeOut = Math.min(1, (p.life - t) / (p.life * 0.35));
    const glint = 0.62 + 0.38 * Math.sin(t * p.twinkle + p.phase);
    return {
      opacity: fadeIn * fadeOut * glint,
      transform: [{ translateX: x }, { translateY: y }, { rotate: `${p.spin * t}deg` }],
    };
  });
  const w = p.long ? p.size * 1.9 : p.size;
  const h = p.long ? p.size * 0.7 : p.size;
  return (
    <Animated.View
      style={[
        { position: "absolute", left: 0, top: 0, width: w, height: h, borderRadius: p.long ? 1 : h / 2, backgroundColor: p.color, shadowColor: p.color, shadowOpacity: 0.9, shadowRadius: 3, shadowOffset: { width: 0, height: 0 } },
        style,
      ]}
    />
  );
}

function Shower({ shower, w, h, onDone }: { shower: SparkleShower; w: number; h: number; onDone: (id: number) => void }) {
  const pieces = useMemo(() => piecesOf(shower, w, h), [shower, w, h]);
  const length = LENGTH_S[shower.kind];
  const clock = useSharedValue(0);

  useEffect(() => {
    /* Heard of late — a layer that mounts as the sheet closes — it starts where the others are. */
    const since = Math.min(length, Math.max(0, (Date.now() - shower.at) / 1000));
    clock.set(since);
    clock.set(withTiming(length, { duration: (length - since) * 1000, easing: Easing.linear }));
    const t = setTimeout(() => onDone(shower.id), (length - since) * 1000 + 60);
    return () => clearTimeout(t);
  }, [clock, length, shower, onDone]);

  return (
    <>
      {pieces.map((p, i) => (
        <Bit key={i} p={p} clock={clock} />
      ))}
    </>
  );
}

export default function SparkleLayer() {
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const [showers, setShowers] = useState<SparkleShower[]>([]);

  useEffect(() => onSparkle((s) => setShowers((list) => [...list, s])), []);
  const done = useCallback((id: number) => setShowers((list) => list.filter((s) => s.id !== id)), []);

  if (reduced || showers.length === 0) return null;
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }}>
      {showers.map((s) => (
        <Shower key={s.id} shower={s} w={width} h={height} onDone={done} />
      ))}
    </View>
  );
}
