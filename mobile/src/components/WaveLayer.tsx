import { useEffect, useRef, useState, type ComponentRef } from "react";
import { View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Mask, Rect, Stop } from "react-native-svg";
import { onSheetWave } from "~/lib/sheetWave";

/**
 * Where the success light is drawn: over the whole sheet, touching nothing.
 *
 * Light rising straight, the way it runs over an iPhone when two are touched together to
 * share: a bright white line across the whole sheet with a glow round it, and behind it a
 * trail of soft colour — rose, lavender, periwinkle, sky — fading away. It comes up from under
 * the foot of the sheet, passes over everything and leaves through the top: the money leaving
 * the phone. Nothing stays behind; once it is out, the sheet is as it was. Only numbers cross
 * into the animated style.
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
  /* The light's own height: the bright line at its front, the trail of colour behind. */
  const BH = Math.min(300, Math.max(200, h * 0.5));
  const EDGE = 34;
  /* From wholly under the sheet's foot to wholly past its top. */
  const from = h + 4;
  const to = -BH - 4;
  const p = useSharedValue(0);

  useEffect(() => {
    p.set(withTiming(1, { duration: 1150, easing: Easing.inOut(Easing.quad) }));
    const t = setTimeout(onEnd, 1300);
    return () => clearTimeout(t);
    // Runs once per wave; the parent keys it by the wave's id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => {
    const v = p.get();
    return {
      opacity: v > 0.82 ? Math.max(0, (1 - v) / 0.18) : 1,
      transform: [{ translateY: from + (to - from) * v }],
    };
  });

  return (
    <Animated.View style={[{ position: "absolute", left: 0, top: 0, width: w, height: BH }, style]}>
      <Svg width={w} height={BH}>
        <Defs>
          {/* The colour across the light: rose, lavender, periwinkle, sky. */}
          <LinearGradient id="light-iris" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#FBCFE8" />
            <Stop offset="0.35" stopColor="#C4B5FD" />
            <Stop offset="0.65" stopColor="#A5B4FC" />
            <Stop offset="1" stopColor="#BAE6FD" />
          </LinearGradient>
          {/* How strongly it shows, top to bottom: a little ahead of the line, most at it, fading behind. */}
          <LinearGradient id="light-fade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#fff" stopOpacity={0} />
            <Stop offset={String(EDGE / BH)} stopColor="#fff" stopOpacity={1} />
            <Stop offset={String((EDGE + 60) / BH)} stopColor="#fff" stopOpacity={0.5} />
            <Stop offset="1" stopColor="#fff" stopOpacity={0} />
          </LinearGradient>
          <Mask id="light-mask" x="0" y="0" width={w} height={BH} maskUnits="userSpaceOnUse">
            <Rect x={0} y={0} width={w} height={BH} fill="url(#light-fade)" />
          </Mask>
          {/* The glow round the line itself. */}
          <LinearGradient id="light-glow" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
            <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0.75} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
          {/* The line, brightest across the middle. */}
          <LinearGradient id="light-line" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.55} />
            <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={1} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0.55} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={w} height={BH} fill="url(#light-iris)" opacity={0.62} mask="url(#light-mask)" />
        <Rect x={0} y={EDGE - 16} width={w} height={32} fill="url(#light-glow)" opacity={0.85} />
        <Rect x={0} y={EDGE - 1.5} width={w} height={3} fill="url(#light-line)" />
      </Svg>
    </Animated.View>
  );
}
