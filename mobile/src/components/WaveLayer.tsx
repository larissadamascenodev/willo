import { useEffect, useRef, useState, type ComponentRef } from "react";
import { View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Defs, Ellipse, LinearGradient, Mask, RadialGradient, Rect, Stop } from "react-native-svg";
import { onSheetLight } from "~/lib/sheetWave";

/**
 * Where the light of a payment going through is drawn: over the whole sheet, touching
 * nothing.
 *
 * Let go, the light that grew under the button carries on: a wide soft light — white, aqua,
 * mint, pale green, the Willo's own colours kept quiet — rising at once from the sheet's foot,
 * fast at first and easing as it goes, so there is no pause before it moves, and fading as it
 * leaves through the top: the money leaving the phone. Nothing stays behind. Only numbers
 * cross into the animated style.
 */

interface Run {
  id: number;
  w: number;
  h: number;
}

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
  const { w, h } = run;
  const GH = Math.min(420, Math.max(300, h * 0.7));
  /* From its bright part at the foot, where the button's light is, to wholly past the top. */
  const from = h - GH * 0.7;
  const to = -GH;
  const rise = useSharedValue(0);

  useEffect(() => {
    rise.set(withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }));
    const t = setTimeout(onGone, 760);
    return () => clearTimeout(t);
    // Runs once per light; the parent keys it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const band = useAnimatedStyle(() => {
    const v = rise.get();
    return {
      opacity: v < 0.45 ? 1 : Math.max(0, 1 - (v - 0.45) / 0.55),
      transform: [{ translateY: from + (to - from) * v }, { scaleY: 0.95 + 0.25 * v }],
    };
  });

  return (
    <Animated.View style={[{ position: "absolute", left: 0, top: 0, width: w, height: GH }, band]}>
      <Svg width={w} height={GH}>
        <Defs>
          <LinearGradient id="launch-tint" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#99F6E4" />
            <Stop offset="0.28" stopColor="#D1FAE5" />
            <Stop offset="0.5" stopColor="#FFFFFF" />
            <Stop offset="0.72" stopColor="#BBF7D0" />
            <Stop offset="1" stopColor="#A7F3D0" />
          </LinearGradient>
          <LinearGradient id="launch-rise" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#fff" stopOpacity={0} />
            <Stop offset="0.35" stopColor="#fff" stopOpacity={0.22} />
            <Stop offset="0.62" stopColor="#fff" stopOpacity={1} />
            <Stop offset="0.74" stopColor="#fff" stopOpacity={1} />
            <Stop offset="1" stopColor="#fff" stopOpacity={0} />
          </LinearGradient>
          <Mask id="launch-mask" x="0" y="0" width={w} height={GH} maskUnits="userSpaceOnUse">
            <Rect x={0} y={0} width={w} height={GH} fill="url(#launch-rise)" />
          </Mask>
          <RadialGradient id="launch-heart" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.6} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={w} height={GH} fill="url(#launch-tint)" opacity={0.5} mask="url(#launch-mask)" />
        <Ellipse cx={w * 0.5} cy={GH * 0.66} rx={w * 0.5} ry={GH * 0.2} fill="url(#launch-heart)" />
      </Svg>
    </Animated.View>
  );
}
