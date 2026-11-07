import type { ReactNode } from "react";
import { Pressable, Text } from "react-native";
import Animated, { LinearTransition } from "react-native-reanimated";

/**
 * One of the two outside ways in.
 *
 * Open, it is a long button with its glyph and its words; folded, it is half of a
 * row, slimmer, with the glyph and the name alone. Quiet glass either way: no rim
 * brighter than the ground's own light. The same component in both, so moving between them is
 * the layout animating rather than one thing being swapped for another.
 */
export default function Provider({
  compact,
  label,
  short,
  onPress,
  children,
}: {
  compact: boolean;
  label: string;
  short: string;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Animated.View layout={LinearTransition.duration(340)} style={{ flex: compact ? 1 : undefined }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => ({
          height: compact ? 50 : 58,
          borderRadius: compact ? 25 : 29,
          borderCurve: "continuous",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: compact ? 8 : 12,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.06)",
          backgroundColor: pressed ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.06)",
          transform: [{ scale: pressed ? 0.985 : 1 }],
        })}
      >
        {children}
        <Text style={{ fontSize: compact ? 15 : 16.5, fontWeight: "600", color: "#fff" }}>{compact ? short : label}</Text>
      </Pressable>
    </Animated.View>
  );
}
