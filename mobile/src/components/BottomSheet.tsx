import { useEffect, useRef, useState, type ReactNode } from "react";
import { Keyboard, Modal, Platform, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import SparkleLayer from "~/components/SparkleLayer";
import ToastHost from "~/components/ToastHost";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

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
 * covers is a sheet whose field cannot be seen being typed in.
 */

const EXIT_MS = 240;
const AnimatedBlur = Animated.createAnimatedComponent(BlurView);

export default function BottomSheet({
  open,
  onClose,
  children,
  full = false,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Takes most of the screen instead of only what it needs. */
  full?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [lift, setLift] = useState(0);
  const [mounted, setMounted] = useState(open);
  const shown = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (open) {
      setMounted(true);
      shown.set(withSpring(1, { duration: 520, dampingRatio: 0.94, reduceMotion: ReduceMotion.System }));
    } else {
      shown.set(withTiming(0, { duration: EXIT_MS, easing: Easing.in(Easing.cubic), reduceMotion: ReduceMotion.System }));
      timer.current = setTimeout(() => setMounted(false), EXIT_MS + 20);
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [open, shown]);

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

  const blurProps = useAnimatedProps(() => ({ intensity: Math.max(0, Math.min(1, shown.get())) * 18 }));
  const dim = useAnimatedStyle(() => ({ opacity: Math.max(0, Math.min(1, shown.get())) }));
  const rise = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - Math.min(1, shown.get())) * (height * 0.7) }],
  }));

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={{ flex: 1 }} onPress={onClose}>
        <AnimatedBlur tint="dark" animatedProps={blurProps} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
        <Animated.View style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)" }, dim]} />
      </Pressable>

      <Animated.View
        style={[
          {
            position: "absolute",
            left: 0,
            right: 0,
            bottom: lift,
            maxHeight: full ? "88%" : "72%",
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
        <BlurView intensity={60} tint="dark" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
        <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(18,20,26,0.38)" }} />

        {/* The grab handle, which says which way this came from. */}
        <View
          style={{
            alignSelf: "center",
            width: 38,
            height: 4,
            borderRadius: 999,
            backgroundColor: "rgba(255,255,255,0.22)",
            marginBottom: 12,
          }}
        />
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">{children}</ScrollView>
      </Animated.View>

      {/* Over the sheet: what lands while it is open is seen at once, not after it closes. */}
      <SparkleLayer />
      <ToastHost quiet />
    </Modal>
  );
}
