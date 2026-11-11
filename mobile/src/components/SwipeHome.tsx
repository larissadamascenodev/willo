import { useCallback, type ReactNode } from "react";
import { useWindowDimensions } from "react-native";
import { useFocusEffect } from "expo-router";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

/**
 * Back to the start with a sideways pull from the screen's edge.
 *
 * Transações sits to the right of the start, so it is pulled from its left edge
 * towards the right; Willo's screen the other way, from its right edge towards the
 * left. Only a pull that begins at the edge counts, so a row that scrolls sideways
 * keeps its own swipe. The screen follows the finger; let go past a third of the way,
 * or quickly, and it slides off and the start comes up; otherwise it springs back.
 */

const EDGE = 36;

export default function SwipeHome({ from, onLeave, children }: { from: "left" | "right"; onLeave: () => void; children: ReactNode }) {
  const { width } = useWindowDimensions();
  const x = useSharedValue(0);
  const sign = from === "left" ? 1 : -1;

  /* Coming back to the screen, it is where it belongs. */
  useFocusEffect(
    useCallback(() => {
      x.set(0);
    }, [x]),
  );

  const leave = useCallback(() => {
    void Haptics.selectionAsync().catch(() => undefined);
    onLeave();
  }, [onLeave]);

  const pull = Gesture.Pan()
    .hitSlop(from === "left" ? { left: 0, width: EDGE } : { right: 0, width: EDGE })
    .activeOffsetX(from === "left" ? 10 : -10)
    .failOffsetY([-16, 16])
    .onUpdate((e) => {
      x.set(Math.max(0, e.translationX * sign));
    })
    .onEnd((e) => {
      if (x.get() > width / 3 || e.velocityX * sign > 700) {
        x.set(
          withTiming(width, { duration: 200, easing: Easing.out(Easing.cubic) }, (done) => {
            if (done) runOnJS(leave)();
          }),
        );
      } else {
        x.set(withSpring(0, { duration: 320, dampingRatio: 0.9 }));
      }
    });

  const follow = useAnimatedStyle(() => ({
    flex: 1,
    opacity: 1 - (x.get() / width) * 0.5,
    transform: [{ translateX: x.get() * sign }],
  }));

  return (
    <GestureDetector gesture={pull}>
      <Animated.View style={follow}>{children}</Animated.View>
    </GestureDetector>
  );
}
