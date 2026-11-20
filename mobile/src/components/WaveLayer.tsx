import { useEffect, useRef, useState, type ComponentRef } from "react";
import { View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, Ellipse, LinearGradient, Mask, RadialGradient, Rect, Stop } from "react-native-svg";
import { onSheetLight, type SheetLight } from "~/lib/sheetWave";

/**
 * Where the light of a payment going through is drawn: over the whole sheet, touching
 * nothing.
 *
 * While it is saved a wide glow gathers along the sheet's foot, the whole width of it — soft
 * white with aqua, mint and pale green, the Willo's own colours kept quiet — and breathes there.
 * Saved, it rises in one unbroken movement up through the sheet and out of the top, fading as
 * it leaves, never stopping on the way: the money leaving the phone. Nothing stays behind.
 * Only numbers cross into the animated style.
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
  /* A wide wash, the whole width of the sheet: soft above and below, brightest a little above its foot. */
  const GH = Math.min(440, Math.max(300, h * 0.72));
  /* Resting while it gathers: its bright foot right at the sheet's foot. */
  const rest = h - GH * 0.72;
  /* Gone: wholly past the top. */
  const out = -GH - 12;

  const y = useSharedValue(h + 12);
  const o = useSharedValue(0);
  const grow = useSharedValue(1);
  const breathe = useSharedValue(0.5);

  useEffect(() => {
    if (mode === "charge") {
      o.set(withTiming(1, { duration: 520, easing: Easing.out(Easing.quad) }));
      y.set(withTiming(rest, { duration: 820, easing: Easing.out(Easing.cubic) }));
      breathe.set(withRepeat(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.sin) }), -1, true));
      return;
    }
    if (mode === "launch") {
      /* One unbroken movement from wherever it is: up and out, fading as it leaves, never
         stopping at the top. */
      cancelAnimation(breathe);
      cancelAnimation(y);
      breathe.set(withTiming(0.5, { duration: 500, easing: Easing.out(Easing.quad) }));
      y.set(withTiming(out, { duration: 820, easing: Easing.bezier(0.45, 0, 0.25, 1) }));
      grow.set(withTiming(1.18, { duration: 820, easing: Easing.out(Easing.quad) }));
      o.set(withDelay(300, withTiming(0, { duration: 520, easing: Easing.in(Easing.quad) })));
      const t = setTimeout(onGone, 880);
      return () => clearTimeout(t);
    }
    // onGone only ends it; rest and out follow the sheet measured when it began.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(
    () => () => {
      cancelAnimation(breathe);
      cancelAnimation(y);
      cancelAnimation(o);
      cancelAnimation(grow);
    },
    [breathe, y, o, grow],
  );

  const style = useAnimatedStyle(() => {
    const b = breathe.get();
    return {
      opacity: o.get(),
      transform: [{ translateY: y.get() }, { scaleX: 1.02 + 0.03 * b }, { scaleY: grow.get() * (0.95 + 0.09 * b) }],
    };
  });

  return (
    <Animated.View style={[{ position: "absolute", left: 0, top: 0, width: w, height: GH }, style]}>
      <Svg width={w} height={GH}>
        <Defs>
          {/* Across the light: aqua, pale mint, white, pale green, mint — the Willo's own, softly. */}
          <LinearGradient id="glow-tint" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#99F6E4" />
            <Stop offset="0.28" stopColor="#D1FAE5" />
            <Stop offset="0.5" stopColor="#FFFFFF" />
            <Stop offset="0.72" stopColor="#BBF7D0" />
            <Stop offset="1" stopColor="#A7F3D0" />
          </LinearGradient>
          {/* Up the light: nothing at its top, most near its foot. */}
          <LinearGradient id="glow-rise" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#fff" stopOpacity={0} />
            <Stop offset="0.35" stopColor="#fff" stopOpacity={0.22} />
            <Stop offset="0.62" stopColor="#fff" stopOpacity={1} />
            <Stop offset="0.74" stopColor="#fff" stopOpacity={1} />
            <Stop offset="1" stopColor="#fff" stopOpacity={0} />
          </LinearGradient>
          <Mask id="glow-mask" x="0" y="0" width={w} height={GH} maskUnits="userSpaceOnUse">
            <Rect x={0} y={0} width={w} height={GH} fill="url(#glow-rise)" />
          </Mask>
          <RadialGradient id="glow-aqua" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#5EEAD4" stopOpacity={0.34} />
            <Stop offset="1" stopColor="#5EEAD4" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="glow-white" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.6} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="glow-green" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#86EFAC" stopOpacity={0.34} />
            <Stop offset="1" stopColor="#86EFAC" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={w} height={GH} fill="url(#glow-tint)" opacity={0.5} mask="url(#glow-mask)" />
        <Ellipse cx={w * 0.15} cy={GH * 0.66} rx={w * 0.45} ry={GH * 0.3} fill="url(#glow-aqua)" />
        <Ellipse cx={w * 0.5} cy={GH * 0.68} rx={w * 0.52} ry={GH * 0.2} fill="url(#glow-white)" />
        <Ellipse cx={w * 0.85} cy={GH * 0.66} rx={w * 0.45} ry={GH * 0.3} fill="url(#glow-green)" />
      </Svg>
    </Animated.View>
  );
}
