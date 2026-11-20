import { useEffect, useRef, useState, type ComponentRef } from "react";
import { View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from "react-native-reanimated";
import Svg, { Circle, Defs, LinearGradient, Mask, RadialGradient, Rect, Stop } from "react-native-svg";
import { onSheetWave } from "~/lib/sheetWave";

/**
 * Where the success wave is drawn: over the whole sheet, touching nothing.
 *
 * A soft band of iridescent light — violet, cyan, white, pink — rises from below the foot of
 * the sheet and sweeps up through it, as if the money were leaving the phone; it is blurred
 * light, not a drawn line, and fades as it passes the top. As it goes the same colours gather
 * along the sheet's edges, brightest at the foot, with a fine rim, and then slowly go. Only
 * numbers cross into the animated styles.
 */

interface Run {
  id: number;
  w: number;
  h: number;
  ox: number;
  oy: number;
}

export default function WaveLayer() {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const [run, setRun] = useState<Run | null>(null);

  useEffect(
    () =>
      onSheetWave((wave) => {
        ref.current?.measureInWindow((x, y, w, h) => {
          if (w <= 0 || h <= 0) return;
          setRun({ id: wave.id, w, h, ox: wave.x - x, oy: wave.y - y });
        });
      }),
    [],
  );

  return (
    <View ref={ref} collapsable={false} pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
      {run && <Wave key={run.id} run={run} onEnd={() => setRun(null)} />}
    </View>
  );
}

function Wave({ run, onEnd }: { run: Run; onEnd: () => void }) {
  const { w, h, ox, oy } = run;
  const ring = useSharedValue(0);
  const edges = useSharedValue(0);
  /* Big enough that the band is past the farthest corner when it ends. */
  const R = Math.hypot(Math.max(ox, w - ox), Math.max(oy, h - oy)) * 1.12;
  const D = R * 2;

  useEffect(() => {
    ring.set(withTiming(1, { duration: 1400, easing: Easing.out(Easing.cubic) }));
    edges.set(withSequence(withDelay(260, withTiming(1, { duration: 420, easing: Easing.out(Easing.quad) })), withTiming(0, { duration: 1700, easing: Easing.in(Easing.quad) })));
    const t = setTimeout(onEnd, 2600);
    return () => clearTimeout(t);
    // Runs once per wave; the parent keys it by the wave's id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ringStyle = useAnimatedStyle(() => {
    const v = ring.get();
    return {
      opacity: v < 0.6 ? 1 : Math.max(0, 1 - (v - 0.6) / 0.4),
      transform: [{ scale: 0.04 + v * 0.96 }],
    };
  });
  const edgeStyle = useAnimatedStyle(() => ({ opacity: edges.get() }));
  const side = Math.min(64, w * 0.16);
  const foot = h * 0.34;
  const top = Math.min(46, h * 0.08);

  return (
    <>
      <Animated.View style={[{ position: "absolute", left: ox - R, top: oy - R, width: D, height: D }, ringStyle]}>
        <Svg width={D} height={D}>
          <Defs>
            <RadialGradient id="sheet-wave-ring" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#8B7BFF" stopOpacity={0} />
              <Stop offset="0.54" stopColor="#8B7BFF" stopOpacity={0} />
              <Stop offset="0.66" stopColor="#7B6CFF" stopOpacity={0.22} />
              <Stop offset="0.74" stopColor="#7DD3FC" stopOpacity={0.5} />
              <Stop offset="0.8" stopColor="#FFFFFF" stopOpacity={0.85} />
              <Stop offset="0.86" stopColor="#FF8AD8" stopOpacity={0.6} />
              <Stop offset="0.93" stopColor="#A78BFA" stopOpacity={0.3} />
              <Stop offset="1" stopColor="#A78BFA" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={R} cy={R} r={R} fill="url(#sheet-wave-ring)" />
        </Svg>
      </Animated.View>

      <Animated.View style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }, edgeStyle]}>
        <Svg width={w} height={h}>
          <Defs>
            {/* The colours, running round the sheet. */}
            <LinearGradient id="sheet-wave-iris" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#FFD98A" />
              <Stop offset="0.28" stopColor="#FF8AD8" />
              <Stop offset="0.52" stopColor="#A78BFA" />
              <Stop offset="0.76" stopColor="#7DD3FC" />
              <Stop offset="1" stopColor="#C7F9E5" />
            </LinearGradient>
            {/* Where they show: along the edges, fading inward. */}
            <LinearGradient id="sheet-wave-l" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#fff" stopOpacity={1} />
              <Stop offset="1" stopColor="#fff" stopOpacity={0} />
            </LinearGradient>
            <LinearGradient id="sheet-wave-r" x1="1" y1="0" x2="0" y2="0">
              <Stop offset="0" stopColor="#fff" stopOpacity={1} />
              <Stop offset="1" stopColor="#fff" stopOpacity={0} />
            </LinearGradient>
            <LinearGradient id="sheet-wave-b" x1="0" y1="1" x2="0" y2="0">
              <Stop offset="0" stopColor="#fff" stopOpacity={1} />
              <Stop offset="1" stopColor="#fff" stopOpacity={0} />
            </LinearGradient>
            <LinearGradient id="sheet-wave-t" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#fff" stopOpacity={0.7} />
              <Stop offset="1" stopColor="#fff" stopOpacity={0} />
            </LinearGradient>
            <Mask id="sheet-wave-frame" x="0" y="0" width={w} height={h} maskUnits="userSpaceOnUse">
              <Rect x={0} y={0} width={side} height={h} fill="url(#sheet-wave-l)" />
              <Rect x={w - side} y={0} width={side} height={h} fill="url(#sheet-wave-r)" />
              <Rect x={0} y={h - foot} width={w} height={foot} fill="url(#sheet-wave-b)" />
              <Rect x={0} y={0} width={w} height={top} fill="url(#sheet-wave-t)" />
            </Mask>
          </Defs>
          <Rect x={0} y={0} width={w} height={h} fill="url(#sheet-wave-iris)" opacity={0.7} mask="url(#sheet-wave-frame)" />
          <Rect x={1} y={1} width={w - 2} height={h - 2} rx={30} ry={30} fill="none" stroke="url(#sheet-wave-iris)" strokeWidth={2.5} />
        </Svg>
      </Animated.View>
    </>
  );
}
