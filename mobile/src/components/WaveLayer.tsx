import { useEffect, useRef, useState, type ComponentRef } from "react";
import { View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";
import { onSheetLight, type SheetLight } from "~/lib/sheetWave";

/**
 * Where the light of a payment going through is drawn: over the whole sheet, touching
 * nothing.
 *
 * While it is saved a glow gathers at the sheet's foot — violet to one side, warm orange to
 * the other, rose between and a white heat at its heart — and breathes there. Saved, it shoots
 * up through the sheet, growing as it goes, presses against the top and fades away there: the
 * money leaving the phone. Nothing stays behind. Only numbers cross into the animated style.
 */

interface Box {
  w: number;
  h: number;
}

export default function WaveLayer() {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [mode, setMode] = useState<SheetLight>("off");

  useEffect(
    () =>
      onSheetLight((cmd) => {
        if (cmd !== "charge") return setMode(cmd);
        ref.current?.measureInWindow((_x, _y, w, h) => {
          if (w <= 0 || h <= 0) return;
          setBox({ w, h });
          setMode("charge");
        });
      }),
    [],
  );

  return (
    <View ref={ref} collapsable={false} pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, overflow: "hidden" }}>
      {box && mode !== "off" && <Glow box={box} mode={mode} onGone={() => setMode("off")} />}
    </View>
  );
}

function Glow({ box, mode, onGone }: { box: Box; mode: SheetLight; onGone: () => void }) {
  const { w, h } = box;
  const GW = w * 1.4;
  const GH = Math.min(400, Math.max(260, h * 0.62));
  /* Where it rests while charging: its heart just under the foot of the sheet. */
  const rest = h - GH * 0.58;
  /* Where it ends: its heart pressed against the top. */
  const out = -GH * 0.62;

  const y = useSharedValue(h + 10);
  const o = useSharedValue(0);
  const s = useSharedValue(0.92);
  const drift = useSharedValue(0.5);
  /* Wide and low while it gathers at the foot; round once it shoots up. */
  const flat = useSharedValue(1);

  useEffect(() => {
    if (mode === "charge") {
      o.set(withTiming(1, { duration: 420 }));
      y.set(withTiming(rest, { duration: 700, easing: Easing.out(Easing.cubic) }));
      s.set(withRepeat(withSequence(withTiming(1.05, { duration: 900, easing: Easing.inOut(Easing.sin) }), withTiming(0.96, { duration: 900, easing: Easing.inOut(Easing.sin) })), -1, false));
      drift.set(withRepeat(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.sin) }), -1, true));
      return;
    }
    if (mode === "launch") {
      cancelAnimation(s);
      cancelAnimation(drift);
      drift.set(withTiming(0.5, { duration: 300 }));
      flat.set(withTiming(0, { duration: 320, easing: Easing.out(Easing.quad) }));
      s.set(withTiming(1.3, { duration: 420, easing: Easing.out(Easing.quad) }));
      y.set(withTiming(out, { duration: 430, easing: Easing.in(Easing.quad) }));
      o.set(withSequence(withTiming(1, { duration: 120 }), withDelay(300, withTiming(0, { duration: 650, easing: Easing.out(Easing.quad) }))));
      const t = setTimeout(onGone, 1150);
      return () => clearTimeout(t);
    }
    // onGone only ends it; rest and out follow the sheet measured when it began.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(
    () => () => {
      cancelAnimation(s);
      cancelAnimation(drift);
      cancelAnimation(y);
      cancelAnimation(o);
      cancelAnimation(flat);
    },
    [s, drift, y, o, flat],
  );

  const style = useAnimatedStyle(() => ({
    opacity: o.get(),
    transform: [
      { translateY: y.get() },
      { translateX: (drift.get() - 0.5) * 18 },
      { scaleX: s.get() * (1 + 0.1 * flat.get()) },
      { scaleY: s.get() * (1 - 0.24 * flat.get()) },
    ],
  }));

  return (
    <Animated.View style={[{ position: "absolute", left: (w - GW) / 2, top: 0, width: GW, height: GH }, style]}>
      <Svg width={GW} height={GH}>
        <Defs>
          <RadialGradient id="glow-violet" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#8B5CF6" stopOpacity={0.85} />
            <Stop offset="0.6" stopColor="#7C3AED" stopOpacity={0.32} />
            <Stop offset="1" stopColor="#7C3AED" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="glow-orange" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FDBA74" stopOpacity={0.9} />
            <Stop offset="0.6" stopColor="#FB923C" stopOpacity={0.32} />
            <Stop offset="1" stopColor="#FB923C" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="glow-rose" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#F9A8D4" stopOpacity={0.9} />
            <Stop offset="0.6" stopColor="#EC4899" stopOpacity={0.28} />
            <Stop offset="1" stopColor="#EC4899" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="glow-heart" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.95} />
            <Stop offset="0.5" stopColor="#FFE4F1" stopOpacity={0.6} />
            <Stop offset="1" stopColor="#FFE4F1" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={GW * 0.3} cy={GH * 0.6} rx={GW * 0.34} ry={GH * 0.42} fill="url(#glow-violet)" />
        <Ellipse cx={GW * 0.7} cy={GH * 0.56} rx={GW * 0.34} ry={GH * 0.42} fill="url(#glow-orange)" />
        <Ellipse cx={GW * 0.5} cy={GH * 0.58} rx={GW * 0.3} ry={GH * 0.38} fill="url(#glow-rose)" />
        <Ellipse cx={GW * 0.5} cy={GH * 0.62} rx={GW * 0.24} ry={GH * 0.26} fill="url(#glow-heart)" />
      </Svg>
    </Animated.View>
  );
}
