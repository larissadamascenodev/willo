import { useEffect, useRef, useState, type ReactNode } from "react";
import { Keyboard, Modal, Platform, Pressable, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import SparkleLayer from "~/components/SparkleLayer";
import ToastHost from "~/components/ToastHost";
import Animated, {
  Easing,
  ReduceMotion,
  runOnJS,
  useAnimatedProps,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { isLight, th } from "~/theme/theme";
/**
 * A panel that comes up from the foot of the screen.
 *
 * For a place you go to, rather than something you do to what is under your thumb —
 * that is the anchored menu. It is glass: the page stays faintly there behind it,
 * softened, and the panel is a blur with a dark film over it rather than a slab of one
 * grey. It rises straight from the bottom edge as the page behind it dims and blurs,
 * and stays mounted through the way out so it can leave the same way.
 *
 * It rides up with the keyboard. A sheet with a field in it that the keyboard then
 * covers is a sheet whose field cannot be seen being typed in. Riding up, it gets no
 * taller than the room left above the keyboard, so all of it can still be scrolled to.
 *
 * It goes away the way it came: pulled down — by the handle, or anywhere on it once its
 * content is at the top — it follows the finger, and let go far enough or fast enough
 * it slides off; otherwise it springs back.
 */

const EXIT_MS = 240;
/** How far, or how fast, a pull has to go to send the sheet away. */
const DISMISS_DISTANCE = 110;
const DISMISS_VELOCITY = 900;
const AnimatedBlur = Animated.createAnimatedComponent(BlurView);

export default function BottomSheet({
  open,
  onClose,
  children,
  full = false,
  above,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Takes most of the screen instead of only what it needs. */
  full?: boolean;
  /** Stands just above the sheet's top edge, covering none of it. */
  above?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [lift, setLift] = useState(0);
  const [tall, setTall] = useState(0);
  const [mounted, setMounted] = useState(open);
  const shown = useSharedValue(0);
  /* The pull: how far the finger has taken the sheet down, and where the content is. */
  const drag = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const anchor = useSharedValue(-1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (open) {
      setMounted(true);
      drag.set(0);
      shown.set(withSpring(1, { duration: 520, dampingRatio: 0.94, reduceMotion: ReduceMotion.System }));
    } else {
      shown.set(withTiming(0, { duration: EXIT_MS, easing: Easing.in(Easing.cubic), reduceMotion: ReduceMotion.System }));
      timer.current = setTimeout(() => setMounted(false), EXIT_MS + 20);
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [open, shown, drag]);

  useEffect(() => {
    if (!open) {
      setLift(0);
      return;
    }
    const ios = Platform.OS === "ios";
    const show = Keyboard.addListener(ios ? "keyboardWillChangeFrame" : "keyboardDidShow", (e) => {
      /* The keyboard's height already runs to the foot of the screen, home bar and all. */
      setLift(Math.max(0, e.endCoordinates.height));
    });
    const hide = Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", () => setLift(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [open, insets.bottom]);

  /* In the light, a dark shape behind (the robot) shows through a thin veil, so the
     page behind is blurred harder and the sheet itself is more opaque. Worked out
     here, not in the animation. */
  const backBlur = isLight() ? 44 : 18;
  const blurProps = useAnimatedProps(() => ({ intensity: Math.max(0, Math.min(1, shown.get())) * backBlur }));
  const dim = useAnimatedStyle(() => ({ opacity: Math.max(0, Math.min(1, shown.get())) }));
  const rise = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - Math.min(1, shown.get())) * (height * 0.7) + drag.get() }],
  }));

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.set(e.contentOffset.y);
  });
  const native = Gesture.Native();
  const pull = Gesture.Pan()
    .simultaneousWithExternalGesture(native)
    .activeOffsetY([-8, 8])
    .onStart(() => {
      anchor.set(-1);
    })
    .onUpdate((e) => {
      /* The sheet only moves once the content has nothing left to show above. */
      if (scrollY.get() > 0.5 && drag.get() === 0) return;
      if (anchor.get() < 0) anchor.set(e.translationY);
      drag.set(Math.max(0, e.translationY - anchor.get()));
    })
    .onEnd((e) => {
      if (drag.get() > DISMISS_DISTANCE || (drag.get() > 0 && e.velocityY > DISMISS_VELOCITY)) {
        drag.set(withTiming(height, { duration: 220, easing: Easing.out(Easing.cubic) }));
        runOnJS(onClose)();
      } else {
        drag.set(withSpring(0, { duration: 380, dampingRatio: 0.9 }));
      }
    });

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <GestureHandlerRootView style={{ flex: 1 }}>
      <Pressable style={{ flex: 1 }} onPress={onClose}>
        <AnimatedBlur tint={th("dark", "tint")} animatedProps={blurProps} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
        <Animated.View style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: th("rgba(0,0,0,0.4)", "bg") }, dim]} />
      </Pressable>

      <GestureDetector gesture={pull}>
      <Animated.View
        onLayout={(e) => setTall(e.nativeEvent.layout.height)}
        style={[
          {
            position: "absolute",
            left: 0,
            right: 0,
            bottom: lift,
            /* Never up under the status bar, however tall the content. */
            maxHeight: Math.min(full ? height * 0.92 : height * 0.72, height - insets.top - 16 - lift),
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            borderCurve: "continuous",
            overflow: "hidden",
            paddingTop: 10,
            paddingBottom: lift > 0 ? 12 : insets.bottom + 16,
          },
          rise,
        ]}
      >
        <BlurView intensity={isLight() ? 90 : 60} tint={th("dark", "tint")} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
        <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: isLight() ? "rgba(246,247,249,0.78)" : "rgba(18,20,26,0.38)" }} />

        {/* The grab handle, which says which way this came from. */}
        <View
          style={{
            alignSelf: "center",
            width: 38,
            height: 4,
            borderRadius: 999,
            backgroundColor: th("rgba(255,255,255,0.22)", "bg"),
            marginBottom: 12,
          }}
        />
        <GestureDetector gesture={native}>
          <Animated.ScrollView
            onScroll={onScroll}
            scrollEventThrottle={16}
            bounces={false}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            {children}
          </Animated.ScrollView>
        </GestureDetector>
      </Animated.View>
      </GestureDetector>

      {above ? (
        <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: lift + tall + 8, alignItems: "center" }}>
          {above}
        </View>
      ) : null}

      {/* Over the sheet: what lands while it is open is seen at once, not after it closes. */}
      <SparkleLayer />
      <ToastHost quiet />
      </GestureHandlerRootView>
    </Modal>
  );
}
