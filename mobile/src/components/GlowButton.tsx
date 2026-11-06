import { useEffect, useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { th } from "~/theme/theme";
/**
 * The web's primary button, on the phone: a black pill with a beam of light that
 * keeps circling its border, white and grey only.
 *
 * The web draws the beam with a conic gradient; here it is a fan of thin wedges,
 * brightening towards the leading edge, on a square that turns behind the pill's
 * ring, so only the ring shows it. Disabled, the ring is still and dim.
 */

const H = 56;
const RING = 1.5;
const TURN_MS = 3600;

/* The beam: wedges from the centre, each a little brighter, ending in a short tail. */
const STEPS = [0.04, 0.08, 0.14, 0.22, 0.34, 0.5, 0.72, 1, 0.45, 0.15];
const SPAN = 9; // degrees per wedge

function wedge(c: number, r: number, from: number, to: number) {
  const p = (deg: number) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return `${(c + r * Math.cos(a)).toFixed(2)} ${(c + r * Math.sin(a)).toFixed(2)}`;
  };
  return `M ${c} ${c} L ${p(from)} A ${r} ${r} 0 0 1 ${p(to)} Z`;
}

export default function GlowButton({
  label,
  icon,
  onPress,
  disabled = false,
}: {
  label: string;
  icon?: ReactNode;
  onPress: () => void;
  disabled?: boolean;
}) {
  const reduce = useReducedMotion();
  const [w, setW] = useState(0);
  const spin = useSharedValue(0);

  useEffect(() => {
    if (disabled || reduce) {
      cancelAnimation(spin);
      return;
    }
    spin.set(withRepeat(withTiming(360, { duration: TURN_MS, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(spin);
  }, [disabled, reduce, spin]);

  const turning = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.get()}deg` }] }));
  const side = Math.ceil(Math.sqrt(w * w + H * H)) + 4;
  const c = side / 2;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.985 : 1 }] })}
    >
      <View style={{ height: H + RING * 2, borderRadius: (H + RING * 2) / 2, overflow: "hidden", padding: RING, backgroundColor: th(disabled ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.16)", "bg") }}>
        {!disabled && w > 0 && (
          <Animated.View pointerEvents="none" style={[{ position: "absolute", left: w / 2 + RING - c, top: (H + RING * 2) / 2 - c, width: side, height: side }, turning]}>
            <Svg width={side} height={side}>
              {STEPS.map((a, i) => (
                <Path key={i} d={wedge(c, c, i * SPAN, (i + 1) * SPAN + 0.5)} fill={th("#FFFFFF")} fillOpacity={a} />
              ))}
            </Svg>
          </Animated.View>
        )}
        <View style={{ height: H, borderRadius: H / 2, backgroundColor: th("#0B0B0B", "bg"), flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 }}>
          {icon}
          <Text style={{ fontSize: 14, fontWeight: "700", letterSpacing: 3, textTransform: "uppercase", color: th(disabled ? "rgba(255,255,255,0.45)" : "#fff") }}>{label}</Text>
        </View>
      </View>
    </Pressable>
  );
}
