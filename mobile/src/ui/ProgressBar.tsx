import { useEffect } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { white } from "./theme";

interface ProgressBarProps {
  /** 0 a 1. */
  ratio: number;
  color: string;
  height?: number;
  /** Cor do trilho vazio. */
  track?: string;
  delay?: number;
}

/** Barra de progresso que cresce até o valor, como as do site. */
export function ProgressBar({ ratio, color, height = 6, track = white(0.06), delay = 0 }: ProgressBarProps) {
  const width = useSharedValue(0);
  useEffect(() => {
    width.value = withDelay(delay, withTiming(Math.max(0, Math.min(ratio, 1)), { duration: 600 }));
  }, [ratio, delay, width]);
  const style = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));

  return (
    <View style={{ height, borderRadius: height / 2, overflow: "hidden", backgroundColor: track }}>
      <Animated.View style={[{ height, borderRadius: height / 2, backgroundColor: color }, style]} />
    </View>
  );
}
