import { useEffect, useRef, useState, type ComponentRef } from "react";
import { View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";
import { onSheetWave } from "~/lib/sheetWave";

/**
 * Where the success light is drawn: over the whole sheet, touching nothing.
 *
 * A band of soft light — a white core in a haze of lavender, with rose to one side and sky
 * to the other, a breath of warm in the middle — comes up from under the foot of the sheet,
 * passes over everything and leaves through the top: the money leaving the phone. It does not
 * stay behind on the edges; once it is out, the sheet is as it was. Only numbers cross into
 * the animated style.
 */

interface Run {
  id: number;
  w: number;
  h: number;
}

export default function WaveLayer() {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const [run, setRun] = useState<Run | null>(null);

  useEffect(
    () =>
      onSheetWave((wave) => {
        ref.current?.measureInWindow((_x, _y, w, h) => {
          if (w <= 0 || h <= 0) return;
          setRun({ id: wave.id, w, h });
        });
      }),
    [],
  );

  return (
    <View ref={ref} collapsable={false} pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, overflow: "hidden" }}>
      {run && <Band key={run.id} run={run} onEnd={() => setRun(null)} />}
    </View>
  );
}

function Band({ run, onEnd }: { run: Run; onEnd: () => void }) {
  const { w, h } = run;
  /* Wider than the sheet, so it reaches the edges as it passes; tall enough to read as light. */
  const BW = w * 1.5;
  const BH = Math.min(340, Math.max(220, h * 0.6));
  const from = h + 10;
  const to = -BH - 10;
  const p = useSharedValue(0);

  useEffect(() => {
    p.set(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.cubic) }));
    const t = setTimeout(onEnd, 1450);
    return () => clearTimeout(t);
    // Runs once per wave; the parent keys it by the wave's id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => {
    const v = p.get();
    return {
      opacity: v < 0.12 ? v / 0.12 : v > 0.78 ? Math.max(0, (1 - v) / 0.22) : 1,
      transform: [{ translateY: from + (to - from) * v }],
    };
  });

  return (
    <Animated.View style={[{ position: "absolute", left: (w - BW) / 2, top: 0, width: BW, height: BH }, style]}>
      <Svg width={BW} height={BH}>
        <Defs>
          <RadialGradient id="wave-haze" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#EDE9FE" stopOpacity={0.5} />
            <Stop offset="0.45" stopColor="#C4B5FD" stopOpacity={0.3} />
            <Stop offset="0.75" stopColor="#A5B4FC" stopOpacity={0.1} />
            <Stop offset="1" stopColor="#A5B4FC" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="wave-rose" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FBCFE8" stopOpacity={0.5} />
            <Stop offset="1" stopColor="#FBCFE8" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="wave-sky" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#BAE6FD" stopOpacity={0.52} />
            <Stop offset="1" stopColor="#BAE6FD" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="wave-warm" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FDE68A" stopOpacity={0.22} />
            <Stop offset="1" stopColor="#FDE68A" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="wave-core" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.95} />
            <Stop offset="0.45" stopColor="#FFFFFF" stopOpacity={0.4} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={BW / 2} cy={BH / 2} rx={BW / 2} ry={BH / 2} fill="url(#wave-haze)" />
        <Ellipse cx={BW * 0.3} cy={BH * 0.55} rx={BW * 0.26} ry={BH * 0.3} fill="url(#wave-rose)" />
        <Ellipse cx={BW * 0.7} cy={BH * 0.45} rx={BW * 0.26} ry={BH * 0.3} fill="url(#wave-sky)" />
        <Ellipse cx={BW * 0.5} cy={BH * 0.6} rx={BW * 0.2} ry={BH * 0.22} fill="url(#wave-warm)" />
        <Ellipse cx={BW / 2} cy={BH * 0.5} rx={BW * 0.34} ry={BH * 0.085} fill="url(#wave-core)" />
      </Svg>
    </Animated.View>
  );
}
