import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { isLight } from "~/theme/theme";

/**
 * Willo Insight — Signal V2.4, Adaptive Editorial.
 *
 * What Willo noticed, as part of the page rather than a card on it: the Signal (five rounded bars,
 * the middle one breathing), "willo / insight", the finding as a headline — light words and the
 * figure in bold — a line on why it matters, and "Conversar com Willo ↗". Lit from the top left by
 * a light of the page's own hue that dissolves into the ground; no border, no surface, no shadow.
 *
 * Reusable: the light's colour comes from the page (`glow`), the words and the action from it too.
 */

export interface InsightTitle {
  lead: string;
  strong: string;
  tail?: string;
  tone: "good" | "bad" | "neutral";
}

const DARK = { text: "#F3F5F4", soft: "#A5AFAC", good: "#83CF94", bad: "#E68B91", signal: "#D2DED8", action: "#D2DED8" };
const LIGHT = { text: "#202925", soft: "#56655E", good: "#28764C", bad: "#B8505D", signal: "#357451", action: "#357451" };

/* The bars of the Signal on a 40 × 40 grid: x, height, opacity. The middle one breathes. */
const BARS: [number, number, number][] = [
  [4, 10, 0.45],
  [11, 20, 0.75],
  [25, 20, 0.75],
  [32, 10, 0.45],
];

export function SignalMark({ size = 27, color }: { size?: number; color: string }) {
  const reduce = useReducedMotion();
  const breath = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    breath.set(withRepeat(withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }), -1, true));
  }, [breath, reduce]);
  const k = size / 40;
  const middle = useAnimatedStyle(() => ({
    opacity: 1 - 0.25 * breath.get(),
    transform: [{ scaleY: 1 - 0.14 * breath.get() }],
  }));
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 40 40">
        {BARS.map(([bx, h, o]) => (
          <Rect key={bx} x={bx} y={(40 - h) / 2} width={4} height={h} rx={2} fill={color} fillOpacity={o} />
        ))}
      </Svg>
      <Animated.View style={[{ position: "absolute", left: 18 * k, top: 3 * k, width: 4 * k, height: 34 * k, borderRadius: 2 * k, backgroundColor: color }, middle]} />
    </View>
  );
}

/** A thin diagonal arrow, 12 × 12. */
function Arrow({ color }: { color: string }) {
  return (
    <Svg width={12} height={12} viewBox="0 0 12 12">
      <Path d="M3 9 L9 3 M4.2 3 H9 V7.8" stroke={color} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function WilloInsight({ title, body, onTalk, glow }: { title: InsightTitle; body: string; onTalk: () => void; /** The page's light, as "r, g, b" — dark and light. */ glow: { dark: string; light: string } }) {
  const light = isLight();
  const c = light ? LIGHT : DARK;
  const [box, setBox] = useState({ w: 0, h: 0 });
  const lift = useSharedValue(0);
  const arrow = useAnimatedStyle(() => ({ transform: [{ translateX: 2 * lift.get() }, { translateY: -2 * lift.get() }] }));
  const strongColor = title.tone === "good" ? c.good : title.tone === "bad" ? c.bad : c.text;

  return (
    <View onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })} style={{ paddingVertical: 23, paddingHorizontal: 20 }}>
      {/* The page's own light, from the top left, gone long before the edges. */}
      {box.w > 0 && (
        <Svg pointerEvents="none" width={box.w} height={box.h} style={{ position: "absolute", left: 0, top: 0 }}>
          <Defs>
            <RadialGradient id="insight-glow" cx={box.w * 0.1} cy={0} rx={box.w * 0.85} ry={box.h * 0.7} fx={box.w * 0.1} fy={0} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={`rgb(${light ? glow.light : glow.dark})`} stopOpacity={0.12} />
              <Stop offset="0.9" stopColor={`rgb(${light ? glow.light : glow.dark})`} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={box.w} height={box.h} fill="url(#insight-glow)" />
        </Svg>
      )}

      {/* willo / insight */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
        <SignalMark color={c.signal} />
        <Text style={{ fontSize: 12, color: c.signal }}>
          willo / <Text style={{ fontWeight: "600" }}>insight</Text>
        </Text>
      </View>

      {/* The finding. */}
      <Text style={{ marginTop: 17, fontSize: 28, lineHeight: 33, letterSpacing: -1, fontWeight: light ? "400" : "300", color: c.text }}>
        {title.lead} <Text style={{ fontWeight: "700", color: strongColor }}>{title.strong}</Text>
        {title.tail ?? ""}
      </Text>

      {/* Why it matters. */}
      <Text style={{ marginTop: 12, fontSize: 13, lineHeight: 21.5, color: c.soft }}>{body}</Text>

      {/* Conversar com Willo ↗ */}
      <Pressable
        onPress={onTalk}
        onPressIn={() => lift.set(withTiming(1, { duration: 200 }))}
        onPressOut={() => lift.set(withTiming(0, { duration: 200 }))}
        hitSlop={14}
        accessibilityRole="button"
        accessibilityLabel="Conversar com Willo"
        style={{ marginTop: 18, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 7, minHeight: 24 }}
      >
        <Text style={{ fontSize: 12, fontWeight: "500", color: c.action }}>Conversar com Willo</Text>
        <Animated.View style={arrow}>
          <Arrow color={c.action} />
        </Animated.View>
      </Pressable>
    </View>
  );
}
