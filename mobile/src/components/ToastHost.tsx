import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { onToast } from "~/lib/toast";

/**
 * The notice, in the shape of the phone's own.
 *
 * Glass over whatever is behind it, the app's mark on the left, its name and a
 * sentence. It drops in from the top the way a notification does and leaves the same
 * way after a moment, or when it is tapped. Where it sits is one constant: the top
 * here, and the bottom is a change of this line.
 */

const PLACE: "top" | "bottom" = "top";
const STAY_MS = 2800;
const WAY_MS = 260;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const MARK = require("../../assets/willo-icon.png") as number;

export default function ToastHost() {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState<string | null>(null);
  const shown = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    shown.set(withTiming(0, { duration: WAY_MS, easing: Easing.in(Easing.cubic), reduceMotion: ReduceMotion.System }));
    clear.current = setTimeout(() => setText(null), WAY_MS + 30);
  };

  useEffect(() => {
    const off = onToast((message) => {
      if (timer.current) clearTimeout(timer.current);
      if (clear.current) clearTimeout(clear.current);
      setText(message);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      shown.set(0);
      shown.set(withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }));
      timer.current = setTimeout(hide, STAY_MS);
    });
    return () => {
      off();
      if (timer.current) clearTimeout(timer.current);
      if (clear.current) clearTimeout(clear.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const motion = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, shown.get() * 1.3)),
    transform: [{ translateY: (1 - shown.get()) * (PLACE === "top" ? -90 : 90) }, { scale: 0.96 + shown.get() * 0.04 }],
  }));

  if (text === null) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        {
          position: "absolute",
          left: 12,
          right: 12,
          zIndex: 1000,
          ...(PLACE === "top" ? { top: insets.top + 6 } : { bottom: insets.bottom + 14 }),
        },
        motion,
      ]}
    >
      <Pressable
        onPress={hide}
        style={{
          borderRadius: 26,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.16)",
          overflow: "hidden",
        }}
      >
        <BlurView intensity={70} tint="dark" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(18,20,26,0.42)" }} />
        <View style={{ position: "absolute", top: 0, left: 24, right: 24, height: 1, backgroundColor: "rgba(255,255,255,0.24)" }} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12 }}>
          <Image source={MARK} contentFit="cover" style={{ width: 40, height: 40, borderRadius: 10 }} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: "#fff" }}>Willo</Text>
              <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>agora</Text>
            </View>
            <Text numberOfLines={2} style={{ marginTop: 1, fontSize: 14.5, color: "rgba(255,255,255,0.92)" }}>{text}</Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}
