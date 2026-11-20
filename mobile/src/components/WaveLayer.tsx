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
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";
import { onSheetLight, type SheetLight } from "~/lib/sheetWave";

/**
 * Where the light of a payment going through is drawn: over the whole sheet, touching
 * nothing.
 *
 * As in Larissa's reference: let go, a wide glow comes up at the sheet's foot and stays there
 * a moment, breathing, its colours turning slowly. The colours are the Willo icon's own, so the
 * light belongs to the app: its purple card to one side, its amber-orange card to the other, its
 * teal card between, and at the very foot the pale blue-white of the robot's eyes — kept soft
 * over the black and spread across the whole width.
 * Saved, it rises in one smooth movement, gathering pace and then easing, and dissolves as it
 * leaves through the top: the money leaving the phone. It never stops on the way and nothing
 * stays behind. Only numbers cross into the animated styles.
 */

interface Box {
  w: number;
  h: number;
}

export default function WaveLayer() {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [mode, setMode] = useState<SheetLight>("off");
  const [id, setId] = useState(0);

  useEffect(
    () =>
      onSheetLight((cmd) => {
        if (cmd !== "charge") return setMode(cmd);
        ref.current?.measureInWindow((_x, _y, w, h) => {
          if (w <= 0 || h <= 0) return;
          setBox({ w, h });
          setId((n) => n + 1);
          setMode("charge");
        });
      }),
    [],
  );

  return (
    <View ref={ref} collapsable={false} pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, overflow: "hidden" }}>
      {box && mode !== "off" && <Glow key={id} box={box} mode={mode} onGone={() => setMode("off")} />}
    </View>
  );
}

function Glow({ box, mode, onGone }: { box: Box; mode: SheetLight; onGone: () => void }) {
  const { w, h } = box;
  /* Wider than the sheet, so its colours can turn without showing an end. */
  const W = w * 1.5;
  const H = Math.min(400, Math.max(300, h * 0.66));
  /* Resting: the pale light at its foot just under the sheet's foot, its colours over the
     lower third of the sheet. Gone: wholly past the top. */
  const rest = h - H * 0.8;
  const out = -H - 10;

  const y = useSharedValue(h + 10);
  const o = useSharedValue(0);
  const grow = useSharedValue(0.96);
  const swirl = useSharedValue(0.5);

  useEffect(() => {
    if (mode === "charge") {
      o.set(withTiming(1, { duration: 360, easing: Easing.out(Easing.quad) }));
      y.set(withTiming(rest, { duration: 520, easing: Easing.out(Easing.cubic) }));
      swirl.set(withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }), -1, true));
      grow.set(withRepeat(withTiming(1.03, { duration: 900, easing: Easing.inOut(Easing.sin) }), -1, true));
      return;
    }
    if (mode === "launch") {
      /* From wherever it is, without a pause: up and out, fading as it leaves. */
      cancelAnimation(grow);
      cancelAnimation(y);
      grow.set(withTiming(1.12, { duration: 760, easing: Easing.out(Easing.quad) }));
      y.set(withTiming(out, { duration: 780, easing: Easing.bezier(0.45, 0, 0.25, 1) }));
      o.set(withDelay(360, withTiming(0, { duration: 420, easing: Easing.in(Easing.quad) })));
      const t = setTimeout(onGone, 820);
      return () => clearTimeout(t);
    }
    // onGone only ends it; rest and out follow the sheet measured when it began.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(
    () => () => {
      cancelAnimation(y);
      cancelAnimation(o);
      cancelAnimation(grow);
      cancelAnimation(swirl);
    },
    [y, o, grow, swirl],
  );

  const glow = useAnimatedStyle(() => ({ opacity: o.get(), transform: [{ translateY: y.get() }, { scale: grow.get() }] }));
  /* Its colours turn against each other: one layer one way, the other the other way. */
  const layerA = useAnimatedStyle(() => ({ transform: [{ translateX: (swirl.get() - 0.5) * 28 }] }));
  const layerB = useAnimatedStyle(() => ({ transform: [{ translateX: (0.5 - swirl.get()) * 28 }] }));

  return (
    <Animated.View style={[{ position: "absolute", left: (w - W) / 2, top: 0, width: W, height: H }, glow]}>
      <Animated.View style={[{ position: "absolute", left: 0, top: 0, width: W, height: H }, layerA]}>
        <Svg width={W} height={H}>
          <Defs>
            <RadialGradient id="glow-purple" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#9F67FA" stopOpacity={0.6} />
              <Stop offset="0.6" stopColor="#7C3AED" stopOpacity={0.22} />
              <Stop offset="1" stopColor="#7C3AED" stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="glow-amber" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#FBA94C" stopOpacity={0.52} />
              <Stop offset="0.6" stopColor="#F97316" stopOpacity={0.18} />
              <Stop offset="1" stopColor="#F97316" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={W * 0.29} cy={H * 0.6} rx={W * 0.31} ry={H * 0.36} fill="url(#glow-purple)" />
          <Ellipse cx={W * 0.71} cy={H * 0.58} rx={W * 0.31} ry={H * 0.36} fill="url(#glow-amber)" />
        </Svg>
      </Animated.View>
      <Animated.View style={[{ position: "absolute", left: 0, top: 0, width: W, height: H }, layerB]}>
        <Svg width={W} height={H}>
          <Defs>
            <RadialGradient id="glow-teal" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#3EE0C0" stopOpacity={0.48} />
              <Stop offset="0.6" stopColor="#14B8A6" stopOpacity={0.16} />
              <Stop offset="1" stopColor="#14B8A6" stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="glow-eyes" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#E0E7FF" stopOpacity={0.6} />
              <Stop offset="0.6" stopColor="#A5B4FC" stopOpacity={0.2} />
              <Stop offset="1" stopColor="#A5B4FC" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={W * 0.5} cy={H * 0.64} rx={W * 0.22} ry={H * 0.3} fill="url(#glow-teal)" />
          <Ellipse cx={W * 0.5} cy={H * 0.8} rx={W * 0.42} ry={H * 0.14} fill="url(#glow-eyes)" />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}
