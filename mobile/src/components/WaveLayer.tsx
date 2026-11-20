import { useEffect, useRef, useState, type ComponentRef } from "react";
import { View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { onSheetWave } from "~/lib/sheetWave";

/**
 * Where the success wave is drawn: over the whole sheet, touching nothing.
 *
 * A soft ring of green light grows from the check mark through the sheet, thick and
 * blurred rather than a drawn line, and fades as it passes the far edges; as it reaches
 * them the light pools at the sheet's foot and runs up its sides, with a bright rim along
 * the edge, and then slowly goes. Only numbers cross into the animated styles.
 */

const G = "103,205,103";

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
  const R = Math.hypot(Math.max(ox, w - ox), Math.max(oy, h - oy)) * 1.15;
  const D = R * 2;

  useEffect(() => {
    ring.set(withTiming(1, { duration: 1150, easing: Easing.out(Easing.cubic) }));
    edges.set(withSequence(withDelay(400, withTiming(1, { duration: 380, easing: Easing.out(Easing.quad) })), withTiming(0, { duration: 1600, easing: Easing.in(Easing.quad) })));
    const t = setTimeout(onEnd, 2500);
    return () => clearTimeout(t);
    // Runs once per wave; the parent keys it by the wave's id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ringStyle = useAnimatedStyle(() => {
    const v = ring.get();
    return {
      opacity: v < 0.55 ? 1 : Math.max(0, 1 - (v - 0.55) / 0.45),
      transform: [{ scale: 0.03 + v * 0.97 }],
    };
  });
  const edgeStyle = useAnimatedStyle(() => ({ opacity: edges.get() }));
  const side = Math.min(70, w * 0.18);

  return (
    <>
      <Animated.View style={[{ position: "absolute", left: ox - R, top: oy - R, width: D, height: D }, ringStyle]}>
        <Svg width={D} height={D}>
          <Defs>
            <RadialGradient id="sheet-wave" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#67CD67" stopOpacity={0} />
              <Stop offset="0.5" stopColor="#67CD67" stopOpacity={0} />
              <Stop offset="0.7" stopColor="#67CD67" stopOpacity={0.28} />
              <Stop offset="0.82" stopColor="#D6FFD6" stopOpacity={0.85} />
              <Stop offset="0.9" stopColor="#67CD67" stopOpacity={0.5} />
              <Stop offset="1" stopColor="#67CD67" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={R} cy={R} r={R} fill="url(#sheet-wave)" />
        </Svg>
      </Animated.View>

      <Animated.View style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }, edgeStyle]}>
        <LinearGradient colors={[`rgba(${G},0)`, `rgba(${G},0.3)`, `rgba(${G},0.8)`]} locations={[0, 0.55, 1]} style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: h * 0.4 }} />
        <LinearGradient start={{ x: 1, y: 0 }} end={{ x: 0, y: 0 }} colors={[`rgba(${G},0)`, `rgba(${G},0.6)`]} style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: side }} />
        <LinearGradient start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} colors={[`rgba(${G},0)`, `rgba(${G},0.6)`]} style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: side }} />
        <LinearGradient colors={[`rgba(${G},0.45)`, `rgba(${G},0)`]} style={{ position: "absolute", left: 0, right: 0, top: 0, height: Math.min(60, h * 0.08) }} />
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            borderWidth: 2,
            borderColor: "rgba(170,255,170,0.95)",
            shadowColor: "#67CD67",
            shadowOpacity: 1,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 0 },
          }}
        />
      </Animated.View>
    </>
  );
}
