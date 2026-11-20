import { useEffect, useRef, useState, type ComponentRef } from "react";
import { View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";
import { onSheetLight } from "~/lib/sheetWave";

/**
 * Where the light of a payment going through is drawn: over the whole sheet, touching
 * nothing.
 *
 * Let go, one veil of light the whole width of the sheet rises from its foot and leaves
 * through its top: the money leaving the phone. It is a single wash, not separate shapes —
 * soft above and below, its upper edge gently uneven — in quiet colours (lavender, sky, rose,
 * a breath of peach) that drift slowly against each other as it goes, so it feels alive
 * without filling the app with colour. It starts gently, keeps an even pace and dissolves as
 * it leaves; nothing stays behind. Only numbers cross into the animated styles.
 */

interface Run {
  id: number;
  w: number;
  h: number;
}

const DURATION = 1250;

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
      {run && <Veil key={run.id} run={run} onGone={() => setRun(null)} />}
    </View>
  );
}

function Veil({ run, onGone }: { run: Run; onGone: () => void }) {
  const { w, h } = run;
  /* Wider than the sheet, so its colours can drift without showing an end. */
  const W = w * 1.5;
  const H = Math.min(380, Math.max(280, h * 0.62));
  /* From its brightest just at the sheet's foot to wholly past its top. */
  const from = h - H * 0.62;
  const to = -H - 10;
  const p = useSharedValue(0);

  useEffect(() => {
    p.set(withTiming(1, { duration: DURATION, easing: Easing.bezier(0.32, 0, 0.22, 1) }));
    const t = setTimeout(onGone, DURATION + 80);
    return () => clearTimeout(t);
    // Runs once per light; the parent keys it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const veil = useAnimatedStyle(() => {
    const v = p.get();
    return {
      opacity: v < 0.12 ? v / 0.12 : v > 0.58 ? Math.max(0, (1 - v) / 0.42) : 1,
      transform: [{ translateY: from + (to - from) * v }, { scaleY: 0.92 + 0.2 * v }],
    };
  });
  /* The colours drift against each other: one layer one way, the other the other way. */
  const driftA = useAnimatedStyle(() => ({ transform: [{ translateX: -w * 0.08 * p.get() }] }));
  const driftB = useAnimatedStyle(() => ({ transform: [{ translateX: w * 0.08 * p.get() }] }));

  return (
    <Animated.View style={[{ position: "absolute", left: (w - W) / 2, top: 0, width: W, height: H }, veil]}>
      <Animated.View style={[{ position: "absolute", left: 0, top: 0, width: W, height: H }, driftA]}>
        <Svg width={W} height={H}>
          <Defs>
            <RadialGradient id="veil-lavender" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#C4B5FD" stopOpacity={0.5} />
              <Stop offset="0.6" stopColor="#C4B5FD" stopOpacity={0.2} />
              <Stop offset="1" stopColor="#C4B5FD" stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="veil-peach" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#FDBA74" stopOpacity={0.26} />
              <Stop offset="1" stopColor="#FDBA74" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={W * 0.36} cy={H * 0.58} rx={W * 0.42} ry={H * 0.34} fill="url(#veil-lavender)" />
          <Ellipse cx={W * 0.56} cy={H * 0.68} rx={W * 0.3} ry={H * 0.2} fill="url(#veil-peach)" />
        </Svg>
      </Animated.View>
      <Animated.View style={[{ position: "absolute", left: 0, top: 0, width: W, height: H }, driftB]}>
        <Svg width={W} height={H}>
          <Defs>
            <RadialGradient id="veil-sky" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#93C5FD" stopOpacity={0.46} />
              <Stop offset="0.6" stopColor="#93C5FD" stopOpacity={0.18} />
              <Stop offset="1" stopColor="#93C5FD" stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="veil-rose" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#F9A8D4" stopOpacity={0.4} />
              <Stop offset="0.6" stopColor="#F9A8D4" stopOpacity={0.15} />
              <Stop offset="1" stopColor="#F9A8D4" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={W * 0.64} cy={H * 0.52} rx={W * 0.42} ry={H * 0.34} fill="url(#veil-sky)" />
          <Ellipse cx={W * 0.48} cy={H * 0.62} rx={W * 0.36} ry={H * 0.26} fill="url(#veil-rose)" />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}
