import { useEffect } from "react";
import { View, type ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";

/**
 * A rule that grows into its reading.
 *
 * Every figure in this app comes with one, and on the web every one of them runs
 * out from nothing when the card arrives. It is not decoration: a bar that is
 * already full when you first see it is a picture, and a bar that fills is a
 * measurement being taken. The eye follows the end of it and lands on the number.
 *
 * Same curve and the same six tenths of a second the web uses, so a card and its
 * twin in the browser move alike.
 */

export default function Bar({
  share,
  color,
  delay = 0,
  minWidth = 0,
  style,
}: {
  /** 0–1 of the track it sits in. */
  share: number;
  color: string;
  /** Seconds to wait, for bars that arrive one after another. */
  delay?: number;
  minWidth?: number;
  style?: ViewStyle;
}) {
  const grow = useSharedValue(0);
  const target = Math.max(0, Math.min(share, 1));

  useEffect(() => {
    grow.value = withDelay(
      delay * 1000,
      withTiming(target, { duration: 600, easing: Easing.out(Easing.cubic) }),
    );
  }, [target, delay, grow]);

  const animated = useAnimatedStyle(() => ({ width: `${grow.value * 100}%` }));

  return (
    <Animated.View
      style={[{ height: "100%", borderRadius: 999, backgroundColor: color, minWidth }, style, animated]}
    />
  );
}

/**
 * The same, for a bar that shares its track with others and is measured in flex
 * rather than in per cent — a total split between four accounts, say.
 */
export function FlexBar({
  share,
  color,
  delay = 0,
  minWidth = 6,
}: {
  share: number;
  color: string;
  delay?: number;
  minWidth?: number;
}) {
  const grow = useSharedValue(0);

  useEffect(() => {
    grow.value = withDelay(
      delay * 1000,
      withTiming(Math.max(share, 0), { duration: 600, easing: Easing.out(Easing.cubic) }),
    );
  }, [share, delay, grow]);

  const animated = useAnimatedStyle(() => ({ flexGrow: grow.value }));

  return (
    <Animated.View
      style={[{ flexBasis: 0, minWidth, borderRadius: 999, backgroundColor: color }, animated]}
    />
  );
}

/** The track a bar runs in. */
export function Track({ height = 7, children, style }: { height?: number; children?: React.ReactNode; style?: ViewStyle }) {
  return (
    <View
      style={[
        { height, flexDirection: "row", gap: 3, borderRadius: 999, overflow: "hidden" },
        style,
      ]}
    >
      {children}
    </View>
  );
}
