import { useEffect, useRef, useState, type ReactNode } from "react";
import { Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { X } from "~/components/icons";
import { INK } from "~/theme/tokens";

/**
 * A pane of glass lifted off the page into the middle of the screen.
 *
 * For reading the whole of something the page only shows the start of — every
 * category, every month — without the page itself growing to hold it. It rises a
 * little and settles as it arrives, and the page behind goes soft rather than away,
 * so it stays plain where you came from. Tap outside, or the cross, to put it back.
 */

const AnimatedBlur = Animated.createAnimatedComponent(BlurView);
const EXIT_MS = 180;

export default function CenterModal({
  open,
  onClose,
  title,
  subtitle,
  actions,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** Buttons that sit beside the cross — a menu of what can be done to what is shown. */
  actions?: ReactNode;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  /* Stays mounted through the way out, so it can leave instead of vanishing. */
  const [mounted, setMounted] = useState(open);
  const shown = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (open) {
      setMounted(true);
      shown.set(withSpring(1, { duration: 380, dampingRatio: 0.9, reduceMotion: ReduceMotion.System }));
    } else {
      shown.set(withTiming(0, { duration: EXIT_MS, easing: Easing.in(Easing.quad), reduceMotion: ReduceMotion.System }));
      timer.current = setTimeout(() => setMounted(false), EXIT_MS + 20);
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [open, shown]);

  const blurProps = useAnimatedProps(() => ({ intensity: Math.max(0, shown.get()) * 32 }));
  const dim = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, shown.get())) }));
  const card = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, shown.get() * 1.4)),
    transform: [{ translateY: (1 - shown.get()) * 24 }, { scale: 0.96 + shown.get() * 0.04 }],
  }));

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Fechar">
        <AnimatedBlur tint="dark" animatedProps={blurProps} style={{ position: "absolute", inset: 0 }} />
        <Animated.View style={[{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.62)" }, dim]} />
      </Pressable>

      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          inset: 0,
          justifyContent: "center",
          paddingHorizontal: 16,
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 16,
        }}
      >
        <Animated.View
          style={[
            {
              maxHeight: Math.min(height * 0.78, height - insets.top - insets.bottom - 32),
              borderRadius: 28,
              borderCurve: "continuous",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.16)",
              overflow: "hidden",
            },
            card,
          ]}
        >
          {/* Glass, not a grey card: the page shows through, softened. */}
          <BlurView intensity={80} tint="dark" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
          <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(18,20,26,0.62)" }} />
          <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, backgroundColor: "rgba(255,255,255,0.22)" }} />
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 6 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 19, fontWeight: "700", letterSpacing: -0.3, color: "#fff" }}>{title}</Text>
              {subtitle ? <Text style={{ marginTop: 3, fontSize: 13.5, color: INK.soft }}>{subtitle}</Text> : null}
            </View>
            {actions}
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Fechar"
              style={({ pressed }) => ({
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(255,255,255,0.08)",
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <X size={16} color="rgba(255,255,255,0.8)" strokeWidth={2.2} />
            </Pressable>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 }}
          >
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
