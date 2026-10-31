import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { onToast } from "~/lib/toast";

/**
 * The notice, in the shape of the phone's own.
 *
 * Glass over whatever is behind it, the app's mark on the left, its name and a
 * sentence. It glides in a short way from the top while it fades up, with no bounce,
 * stays long enough to be read, and leaves the same way, softly. It can be sent away early: a flick up, or a tap. While a finger is on it the
 * clock stops — a notice you are holding should not leave your hand.
 *
 * Where it sits is one constant: the top here, and the bottom is a change of this line.
 */

const PLACE: "top" | "bottom" = "top";
const DIR = PLACE === "top" ? -1 : 1;
/** Long enough for a short sentence to be read twice; a longer one is given more. */
const BASE_MS = 3600;
const PER_CHAR_MS = 40;
/** After a finger lets go without sending it away. */
const RESUME_MS = 2200;
/* In and out are slow enough to be seen and short enough in distance not to feel like a drop. */
const IN_MS = 720;
const WAY_MS = 620;
const TRAVEL = 12;
const OFFSCREEN = 130;
const SOFT = Easing.bezier(0.22, 1, 0.36, 1);
const SOFT_OUT = Easing.bezier(0.33, 0, 0.67, 1);

// eslint-disable-next-line @typescript-eslint/no-require-imports
const MARK = require("../../assets/willo-icon.png") as number;

/**
 * `quiet`: the copy drawn inside an open sheet. A sheet is its own window, over the app's,
 * so a notice drawn only at the root would wait behind it; both copies show the same
 * notice at the same moment, and only the root's taps the phone.
 */
export default function ToastHost({ quiet = false }: { quiet?: boolean }) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState<string | null>(null);
  /* 0 is away, 1 is in place; the spring lets it pass 1 a little. */
  const shown = useSharedValue(0);
  /* What a finger has done to it on top of that. */
  const drag = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
  };

  const finish = useCallback(() => {
    setText(null);
    shown.set(0);
    drag.set(0);
  }, [shown, drag]);

  const leave = useCallback(() => {
    stop();
    shown.set(withTiming(0, { duration: WAY_MS, easing: SOFT_OUT, reduceMotion: ReduceMotion.System }));
    clear.current = setTimeout(finish, WAY_MS + 30);
  }, [shown, finish]);

  const arm = useCallback(
    (ms: number) => {
      stop();
      timer.current = setTimeout(leave, ms);
    },
    [leave],
  );

  /* Flicked away: it carries on in the direction it was thrown, from where it is. */
  const flung = useCallback(() => {
    stop();
    if (clear.current) clearTimeout(clear.current);
    clear.current = setTimeout(finish, 220);
  }, [finish]);

  useEffect(() => {
    const off = onToast((message) => {
      stop();
      if (clear.current) clearTimeout(clear.current);
      setText(message);
      if (!quiet) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      drag.set(0);
      shown.set(0);
      shown.set(withTiming(1, { duration: IN_MS, easing: SOFT, reduceMotion: ReduceMotion.System }));
      arm(BASE_MS + Math.max(0, message.length - 24) * PER_CHAR_MS);
    });
    return () => {
      off();
      stop();
      if (clear.current) clearTimeout(clear.current);
    };
  }, [arm, shown, drag, quiet]);

  const pan = Gesture.Pan()
    .activeOffsetY([-6, 6])
    .onBegin(() => {
      runOnJS(stop)();
    })
    .onUpdate((e) => {
      /* Toward the edge it came from it follows the finger; the other way it resists. */
      drag.set(e.translationY * DIR > 0 ? e.translationY : e.translationY * 0.18);
    })
    .onEnd((e) => {
      const thrown = e.translationY * DIR > 26 || e.velocityY * DIR > 420;
      if (thrown) {
        drag.set(withTiming(DIR * (OFFSCREEN + insets.top), { duration: 200, easing: Easing.in(Easing.quad) }));
        runOnJS(flung)();
      } else {
        drag.set(withSpring(0, { damping: 18, stiffness: 240 }));
        runOnJS(arm)(RESUME_MS);
      }
    });

  const motion = useAnimatedStyle(() => ({
    opacity: shown.get() * Math.max(0, 1 - Math.abs(drag.get()) / 220),
    transform: [
      { translateY: (1 - shown.get()) * DIR * TRAVEL + drag.get() },
      { scale: 0.985 + shown.get() * 0.015 },
    ],
  }));

  if (text === null) return null;

  return (
    <GestureDetector gesture={pan}>
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
          onPress={leave}
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
    </GestureDetector>
  );
}
