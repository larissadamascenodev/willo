import { useEffect, useRef, useState, type ComponentRef } from "react";
import { View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from "react-native-reanimated";
import Svg, { Defs, Ellipse, LinearGradient, Mask, RadialGradient, Rect, Stop } from "react-native-svg";
import { ArrowUp } from "~/components/icons";
import { onSheetLight } from "~/lib/sheetWave";

/**
 * Where the light of a payment going through is drawn: over the whole sheet, touching
 * nothing.
 *
 * Let go, a wide soft light — white, aqua, mint, pale green, the Willo's own colours kept
 * quiet — rises at once from the sheet's foot with an arrow in it, fast at first and easing as
 * it goes, so there is no pause before it moves: the money leaving the phone. As it passes the
 * middle it fades and the same light closes round the sheet's edges, a fine bright rim with a
 * glow inside it; the rim holds a moment and then settles away. Only numbers cross into the
 * animated styles.
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
  /* From its bright part at the foot to wholly past the middle-top. */
  const from = h - GH * 0.7;
  const to = -GH * 0.55;
  const rise = useSharedValue(0);
  const rim = useSharedValue(0);

  useEffect(() => {
    rise.set(withTiming(1, { duration: 640, easing: Easing.out(Easing.cubic) }));
    rim.set(withSequence(withDelay(300, withTiming(1, { duration: 300, easing: Easing.out(Easing.quad) })), withDelay(800, withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.quad) }))));
    const t = setTimeout(onGone, 2900);
    return () => clearTimeout(t);
    // Runs once per light; the parent keys it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const band = useAnimatedStyle(() => {
    const v = rise.get();
    return {
      opacity: v < 0.5 ? 1 : Math.max(0, 1 - (v - 0.5) / 0.5),
      transform: [{ translateY: from + (to - from) * v }, { scaleY: 0.9 + 0.35 * v }],
    };
  });
  const arrow = useAnimatedStyle(() => {
    const v = rise.get();
    return { opacity: v < 0.08 ? v / 0.08 : v < 0.6 ? 1 : Math.max(0, 1 - (v - 0.6) / 0.3) };
  });
  const edges = useAnimatedStyle(() => ({ opacity: rim.get() }));
  const side = Math.min(54, w * 0.14);
  const foot = Math.min(150, h * 0.22);
  const top = Math.min(54, h * 0.09);

  return (
    <>
      {/* The rising light, an arrow at its brightest. */}
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
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.7} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={w} height={GH} fill="url(#launch-tint)" opacity={0.5} mask="url(#launch-mask)" />
          <Ellipse cx={w * 0.5} cy={GH * 0.66} rx={w * 0.5} ry={GH * 0.2} fill="url(#launch-heart)" />
        </Svg>
        <Animated.View style={[{ position: "absolute", left: 0, right: 0, top: GH * 0.66 - 26, alignItems: "center" }, arrow]}>
          <View style={{ shadowColor: "#FFFFFF", shadowOpacity: 0.9, shadowRadius: 14, shadowOffset: { width: 0, height: 0 } }}>
            <ArrowUp size={52} color="#FFFFFF" strokeWidth={2.6} />
          </View>
        </Animated.View>
      </Animated.View>

      {/* The same light, closed round the sheet's edges. */}
      <Animated.View style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }, edges]}>
        <Svg width={w} height={h}>
          <Defs>
            <LinearGradient id="rim-tint" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#99F6E4" />
              <Stop offset="0.35" stopColor="#FFFFFF" />
              <Stop offset="0.65" stopColor="#A7F3D0" />
              <Stop offset="1" stopColor="#7DD3FC" />
            </LinearGradient>
            <LinearGradient id="rim-l" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#fff" stopOpacity={1} />
              <Stop offset="1" stopColor="#fff" stopOpacity={0} />
            </LinearGradient>
            <LinearGradient id="rim-r" x1="1" y1="0" x2="0" y2="0">
              <Stop offset="0" stopColor="#fff" stopOpacity={1} />
              <Stop offset="1" stopColor="#fff" stopOpacity={0} />
            </LinearGradient>
            <LinearGradient id="rim-b" x1="0" y1="1" x2="0" y2="0">
              <Stop offset="0" stopColor="#fff" stopOpacity={1} />
              <Stop offset="1" stopColor="#fff" stopOpacity={0} />
            </LinearGradient>
            <LinearGradient id="rim-t" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#fff" stopOpacity={0.9} />
              <Stop offset="1" stopColor="#fff" stopOpacity={0} />
            </LinearGradient>
            <Mask id="rim-frame" x="0" y="0" width={w} height={h} maskUnits="userSpaceOnUse">
              <Rect x={0} y={0} width={side} height={h} fill="url(#rim-l)" />
              <Rect x={w - side} y={0} width={side} height={h} fill="url(#rim-r)" />
              <Rect x={0} y={h - foot} width={w} height={foot} fill="url(#rim-b)" />
              <Rect x={0} y={0} width={w} height={top} fill="url(#rim-t)" />
            </Mask>
          </Defs>
          <Rect x={0} y={0} width={w} height={h} fill="url(#rim-tint)" opacity={0.45} mask="url(#rim-frame)" />
          <Rect x={1.25} y={1.25} width={w - 2.5} height={h - 2.5} rx={30} ry={30} fill="none" stroke="url(#rim-tint)" strokeWidth={2.5} opacity={0.9} />
        </Svg>
      </Animated.View>
    </>
  );
}
