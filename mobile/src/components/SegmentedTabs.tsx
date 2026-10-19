import { useEffect, useState } from "react";
import { Pressable, Text, View, type LayoutChangeEvent } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { INK } from "~/theme/tokens";

/**
 * Two or three choices, with the pill travelling between them.
 *
 * The web gives the pill a shared identity across the options, so switching moves
 * one object rather than turning one off and another on. That is the whole effect:
 * a thing that moves says the two choices are the same kind of thing, and a thing
 * that blinks says they are not.
 *
 * It measures its own width and slides on a spring, since the pill has to know how
 * far it is going and a layout animation cannot be told.
 */
export default function SegmentedTabs<T extends string>({
  value,
  options,
  onChange,
  height = 38,
  compact = false,
}: {
  value: T;
  options: { key: T; label: string }[];
  onChange: (next: T) => void;
  height?: number;
  /** Quieter, for a switch living inside a card. */
  compact?: boolean;
}) {
  const [width, setWidth] = useState(0);
  const x = useSharedValue(0);

  const index = Math.max(0, options.findIndex((o) => o.key === value));
  const slot = width > 0 ? width / options.length : 0;

  /* The pill follows wherever the chosen option now sits. Driven from an effect
     rather than from the render: a shared value written while rendering is a frame
     the animation never sees. */
  useEffect(() => {
    x.value = withSpring(index * slot, { damping: 22, stiffness: 240, mass: 0.6 });
  }, [index, slot, x]);

  const pill = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
    width: slot,
  }));

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View
      onLayout={onLayout}
      style={{
        flexDirection: "row",
        borderRadius: 999,
        borderWidth: compact ? 0 : 1,
        borderColor: "rgba(255,255,255,0.06)",
        backgroundColor: compact ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.035)",
        padding: 4,
      }}
    >
      {slot > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              top: 4,
              left: 4,
              height,
              borderRadius: 999,
              backgroundColor: "#fff",
            },
            pill,
          ]}
        />
      )}

      {options.map((option) => {
        const on = option.key === value;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            style={{ flex: 1, height, alignItems: "center", justifyContent: "center" }}
          >
            <Text
              numberOfLines={1}
              style={{
                fontSize: compact ? 12 : 13,
                fontWeight: "600",
                color: on ? "#0B0B0B" : INK.soft,
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
