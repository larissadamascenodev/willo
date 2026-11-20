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
 * a moment, breathing, its tones turning slowly. It is the Willo icon's purple, the one that
 * sits best with the glass: deep violet to one side, a bluer indigo-violet to the other, lilac
 * between, and a pale lavender light at the very foot — one colour in its own shades, kept soft
 * over the black and spread across the whole width.
 * Saved, it stretches upward from its foot — the top reaching up while a fading gradient stays
 * below it — then lifts away whole and dissolves as it leaves through the top: the money leaving
 * the phone. No straight line moves up, it never stops on the way and nothing stays behind.
 * Only numbers cross into the animated styles.
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
  /* Breathing while it waits; stretching upward from its foot as it goes. */
  const breathe = useSharedValue(0.5);
  const stretch = useSharedValue(1);
  const widen = useSharedValue(1);
  const swirl = useSharedValue(0.5);

  useEffect(() => {
    if (mode === "charge") {
      o.set(withTiming(1, { duration: 360, easing: Easing.out(Easing.quad) }));
      y.set(withTiming(rest, { duration: 520, easing: Easing.out(Easing.cubic) }));
      swirl.set(withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }), -1, true));
      breathe.set(withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }), -1, true));
      return;
    }
    if (mode === "launch") {
      /* It does not jump up as a block: it stretches upward from its foot first, its top
         reaching up while its foot lingers as a fading gradient below, then the whole of it
         lifts away and leaves through the top, fading as it goes. No line, no pause. */
      cancelAnimation(breathe);
      cancelAnimation(y);
      breathe.set(withTiming(0.5, { duration: 300 }));
      stretch.set(withTiming(2.3, { duration: 640, easing: Easing.out(Easing.cubic) }));
      widen.set(withTiming(1.08, { duration: 640, easing: Easing.out(Easing.cubic) }));
      y.set(withTiming(out, { duration: 1000, easing: Easing.bezier(0.55, 0, 0.35, 1) }));
      o.set(withDelay(500, withTiming(0, { duration: 500, easing: Easing.in(Easing.quad) })));
      const t = setTimeout(onGone, 1060);
      return () => clearTimeout(t);
    }
    // onGone only ends it; rest and out follow the sheet measured when it began.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(
    () => () => {
      cancelAnimation(y);
      cancelAnimation(o);
      cancelAnimation(breathe);
      cancelAnimation(stretch);
      cancelAnimation(widen);
      cancelAnimation(swirl);
    },
    [y, o, breathe, stretch, widen, swirl],
  );

  /* Scaled about its foot, so stretching reaches upward and leaves the foot where it is. */
  const glow = useAnimatedStyle(() => {
    const b = breathe.get();
    return {
      opacity: o.get(),
      transform: [{ translateY: y.get() }, { scaleX: widen.get() * (0.99 + 0.03 * b) }, { scaleY: stretch.get() * (0.97 + 0.06 * b) }],
    };
  });
  /* Its colours turn against each other: one layer one way, the other the other way. */
  const layerA = useAnimatedStyle(() => ({ transform: [{ translateX: (swirl.get() - 0.5) * 28 }] }));
  const layerB = useAnimatedStyle(() => ({ transform: [{ translateX: (0.5 - swirl.get()) * 28 }] }));

  return (
    <Animated.View style={[{ position: "absolute", left: (w - W) / 2, top: 0, width: W, height: H, transformOrigin: "bottom" }, glow]}>
      <Animated.View style={[{ position: "absolute", left: 0, top: 0, width: W, height: H }, layerA]}>
        <Svg width={W} height={H}>
          <Defs>
            <RadialGradient id="glow-purple" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#9F67FA" stopOpacity={0.62} />
              <Stop offset="0.6" stopColor="#7C3AED" stopOpacity={0.24} />
              <Stop offset="1" stopColor="#7C3AED" stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="glow-indigo" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#818CF8" stopOpacity={0.55} />
              <Stop offset="0.6" stopColor="#6366F1" stopOpacity={0.2} />
              <Stop offset="1" stopColor="#6366F1" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={W * 0.3} cy={H * 0.6} rx={W * 0.34} ry={H * 0.36} fill="url(#glow-purple)" />
          <Ellipse cx={W * 0.7} cy={H * 0.58} rx={W * 0.34} ry={H * 0.36} fill="url(#glow-indigo)" />
        </Svg>
      </Animated.View>
      <Animated.View style={[{ position: "absolute", left: 0, top: 0, width: W, height: H }, layerB]}>
        <Svg width={W} height={H}>
          <Defs>
            <RadialGradient id="glow-lilac" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#C4B5FD" stopOpacity={0.55} />
              <Stop offset="0.6" stopColor="#A78BFA" stopOpacity={0.2} />
              <Stop offset="1" stopColor="#A78BFA" stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="glow-foot" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#EDE9FE" stopOpacity={0.42} />
              <Stop offset="0.6" stopColor="#C4B5FD" stopOpacity={0.14} />
              <Stop offset="1" stopColor="#C4B5FD" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={W * 0.5} cy={H * 0.62} rx={W * 0.28} ry={H * 0.32} fill="url(#glow-lilac)" />
          <Ellipse cx={W * 0.5} cy={H * 0.74} rx={W * 0.4} ry={H * 0.24} fill="url(#glow-foot)" />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}
