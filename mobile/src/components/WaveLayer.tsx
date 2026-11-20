import { useEffect, useRef, useState, type ComponentRef } from "react";
import { View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";
import { onSheetLight } from "~/lib/sheetWave";

/**
 * Where the light of a payment going through is drawn: over the whole sheet, touching
 * nothing.
 *
 * Let go, a few soft clouds of light — lavender, sky, rose, a breath of peach, all kept quiet
 * so the app does not fill with colour — rise from the sheet's foot together but not in step,
 * each swaying a little as it goes, and fade as they leave through the top: the money leaving
 * the phone. It starts gently, moves at an even pace and eases out; nothing stays behind. Only
 * numbers cross into the animated styles.
 */

interface Run {
  id: number;
  w: number;
  h: number;
}

/** One cloud: where across, how big, its colour and strength, how late it sets off, how it sways. */
interface Cloud {
  key: string;
  cx: number;
  wide: number;
  tall: number;
  color: string;
  strength: number;
  late: number;
  sway: number;
}

const CLOUDS: Cloud[] = [
  { key: "lavender", cx: 0.28, wide: 0.95, tall: 300, color: "#C4B5FD", strength: 0.58, late: 0, sway: 14 },
  { key: "sky", cx: 0.74, wide: 0.95, tall: 300, color: "#93C5FD", strength: 0.52, late: 0.05, sway: -16 },
  { key: "rose", cx: 0.5, wide: 0.8, tall: 260, color: "#F9A8D4", strength: 0.48, late: 0.1, sway: 10 },
  { key: "peach", cx: 0.42, wide: 0.6, tall: 200, color: "#FDBA74", strength: 0.3, late: 0.14, sway: -8 },
];

const DURATION = 1300;

export default function WaveLayer() {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const [run, setRun] = useState<Run | null>(null);
  const next = useRef(1);

  useEffect(
    () =>
      onSheetLight((cmd) => {
        if (cmd === "off") return setRun(null);
        ref.current?.measureInWindow((_x, _y, w, h) => {
          if (w <= 0 || h <= 0) return;
          setRun({ id: next.current++, w, h });
        });
      }),
    [],
  );

  return (
    <View ref={ref} collapsable={false} pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, overflow: "hidden" }}>
      {run && <Launch key={run.id} run={run} onGone={() => setRun(null)} />}
    </View>
  );
}

function Launch({ run, onGone }: { run: Run; onGone: () => void }) {
  const p = useSharedValue(0);

  useEffect(() => {
    p.set(withTiming(1, { duration: DURATION, easing: Easing.bezier(0.3, 0, 0.2, 1) }));
    const t = setTimeout(onGone, DURATION + 80);
    return () => clearTimeout(t);
    // Runs once per light; the parent keys it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {CLOUDS.map((c) => (
        <CloudOfLight key={c.key} cloud={c} run={run} p={p} />
      ))}
    </>
  );
}

function CloudOfLight({ cloud, run, p }: { cloud: Cloud; run: Run; p: SharedValue<number> }) {
  const { w, h } = run;
  const W = w * cloud.wide;
  const H = cloud.tall;
  /* From half under the sheet's foot to wholly past its top. */
  const from = h - H * 0.45;
  const to = -H - 10;
  const late = cloud.late;
  const sway = cloud.sway;

  const style = useAnimatedStyle(() => {
    const raw = (p.get() - late) / (1 - late);
    const v = raw < 0 ? 0 : raw > 1 ? 1 : raw;
    const o = raw <= 0 ? 0 : v < 0.15 ? v / 0.15 : v > 0.62 ? Math.max(0, (1 - v) / 0.38) : 1;
    return {
      opacity: o,
      transform: [{ translateX: Math.sin(v * Math.PI) * sway }, { translateY: from + (to - from) * v }, { scale: 0.9 + 0.25 * v }],
    };
  });

  const id = `cloud-${cloud.key}`;
  return (
    <Animated.View style={[{ position: "absolute", left: cloud.cx * w - W / 2, top: 0, width: W, height: H }, style]}>
      <Svg width={W} height={H}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={cloud.color} stopOpacity={cloud.strength} />
            <Stop offset="0.55" stopColor={cloud.color} stopOpacity={cloud.strength * 0.42} />
            <Stop offset="1" stopColor={cloud.color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={W / 2} cy={H / 2} rx={W / 2} ry={H / 2} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}
