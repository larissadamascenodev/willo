import { useEffect, useRef, useState, type ReactNode } from "react";
import { Keyboard, Modal, Platform, Pressable, Text, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  ReduceMotion,
  SlideInLeft,
  SlideInRight,
  SlideOutLeft,
  SlideOutRight,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Glass from "~/components/Glass";
import { ChevronLeft, X } from "~/components/icons";
import { INK } from "~/theme/tokens";

/**
 * A sheet that asks one thing at a time.
 *
 * It has a fixed size and never scrolls: what does not fit on one screen goes on the
 * next, and the page slides across to it. The bar at the top says how far along it is,
 * the button at the foot always says what happens next, and when the last answer is in
 * the sheet gives way to whatever `done` is — the moment the thing exists.
 *
 * It is glass over the page rather than a slab: the page stays faintly there behind it.
 */

const SLIDE = 300;
const EXIT_MS = 260;
const AnimatedBlur = Animated.createAnimatedComponent(BlurView);

export default function StepSheet({
  open,
  onClose,
  step,
  steps,
  onBack,
  onNext,
  nextLabel,
  nextDisabled = false,
  busy = false,
  done,
  children,
}: {
  open: boolean;
  onClose: () => void;
  step: number;
  steps: number;
  onBack: () => void;
  onNext: () => void;
  nextLabel: string;
  nextDisabled?: boolean;
  busy?: boolean;
  /** Shown in place of the steps once the thing has been made. */
  done?: ReactNode;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [lift, setLift] = useState(0);
  const before = useRef(step);
  const forward = step >= before.current;
  /* A page crosses over only when the step changes. The first one is simply there:
     sliding it in from the side as the panel rose made the whole thing arrive on a
     diagonal. */
  const crossing = step !== before.current;

  useEffect(() => {
    before.current = step;
  }, [step]);

  /* The panel rises from the bottom edge and the page behind softens, the same way
     the centred panes arrive; it stays mounted through the way out so it can leave. */
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
      timer.current = setTimeout(() => {
        setMounted(false);
        before.current = 0;
      }, EXIT_MS + 20);
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [open, shown]);

  const blurProps = useAnimatedProps(() => ({ intensity: Math.max(0, Math.min(1, shown.get())) * 18 }));
  const dim = useAnimatedStyle(() => ({ opacity: Math.max(0, Math.min(1, shown.get())) }));
  const rise = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - Math.min(1, shown.get())) * (height * 0.9) }],
  }));

  useEffect(() => {
    if (!open) {
      setLift(0);
      return;
    }
    const ios = Platform.OS === "ios";
    const show = Keyboard.addListener(ios ? "keyboardWillChangeFrame" : "keyboardDidShow", (e) => {
      setLift(Math.max(0, e.endCoordinates.height - (ios ? insets.bottom : 0)));
    });
    const hide = Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", () => setLift(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [open, insets.bottom]);

  const room = height - insets.top - 16;
  const panel = Math.min(Math.round(height * 0.8), 700, room - lift);

  const finished = done !== undefined && done !== null;

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={{ flex: 1 }} onPress={finished || busy ? undefined : onClose}>
        <AnimatedBlur tint="dark" animatedProps={blurProps} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
        <Animated.View style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.55)" }, dim]} />
      </Pressable>

      <Animated.View
        style={[
          {
            position: "absolute",
            left: 0,
            right: 0,
            bottom: lift,
            height: panel,
            borderTopLeftRadius: 34,
            borderTopRightRadius: 34,
            borderCurve: "continuous",
            overflow: "hidden",
            borderWidth: 1,
            borderBottomWidth: 0,
            borderColor: "rgba(255,255,255,0.13)",
          },
          rise,
        ]}
      >
        <BlurView intensity={70} tint="dark" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(16,17,20,0.74)" }} />
        {/* The light catching the glass's upper edge. */}
        <View style={{ position: "absolute", top: 0, left: 36, right: 36, height: 1, backgroundColor: "rgba(255,255,255,0.22)" }} />

        {finished ? (
          <Animated.View entering={FadeIn.duration(260)} style={{ flex: 1 }}>
            {done}
          </Animated.View>
        ) : (
          <View style={{ flex: 1, paddingTop: 14, paddingBottom: insets.bottom + 14 }}>
            {/* Back, how far along, and out. */}
            <View style={{ height: 40, flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 18 }}>
              <View style={{ width: 36, height: 36 }}>
                {step > 0 && (
                  <Animated.View entering={FadeIn.duration(180)}>
                    <Pressable accessibilityLabel="Voltar" onPress={onBack} hitSlop={8}>
                      <Glass interactive style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
                        <ChevronLeft size={18} color="#fff" strokeWidth={2.4} />
                      </Glass>
                    </Pressable>
                  </Animated.View>
                )}
              </View>

              <View style={{ flex: 1, flexDirection: "row", gap: 5 }}>
                {Array.from({ length: steps }, (_, i) => (
                  <Segment key={i} on={i <= step} />
                ))}
              </View>

              <Pressable accessibilityLabel="Fechar" onPress={onClose} hitSlop={8}>
                <Glass interactive style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
                  <X size={16} color={INK.soft} strokeWidth={2.4} />
                </Glass>
              </Pressable>
            </View>

            {/* One page at a time, crossing over from the side it came from. */}
            <View style={{ flex: 1, overflow: "hidden", marginTop: 10 }}>
              <Animated.View
                key={step}
                entering={crossing ? (forward ? SlideInRight : SlideInLeft).duration(SLIDE).easing(Easing.out(Easing.cubic)) : undefined}
                exiting={(forward ? SlideOutLeft : SlideOutRight).duration(SLIDE - 80).easing(Easing.in(Easing.cubic))}
                style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, paddingHorizontal: 22 }}
              >
                {children}
              </Animated.View>
            </View>

            <View style={{ paddingHorizontal: 22, paddingTop: 10 }}>
              <Pressable
                onPress={() => {
                  if (nextDisabled || busy) return;
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
                  Keyboard.dismiss();
                  onNext();
                }}
                accessibilityRole="button"
                style={({ pressed }) => ({
                  height: 54,
                  borderRadius: 27,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#fff",
                  opacity: nextDisabled ? 0.32 : busy ? 0.7 : 1,
                  transform: [{ scale: pressed && !nextDisabled ? 0.98 : 1 }],
                })}
              >
                <Text style={{ fontSize: 16.5, fontWeight: "700", letterSpacing: -0.2, color: "#0B0B0B" }}>
                  {busy ? "Só um instante…" : nextLabel}
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </Animated.View>
    </Modal>
  );
}

/** One notch of the bar: fills from the left when its step is reached. */
function Segment({ on }: { on: boolean }) {
  const fill = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    fill.set(withTiming(on ? 1 : 0, { duration: 320, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }));
  }, [on, fill]);
  const bar = useAnimatedStyle(() => ({ width: `${fill.get() * 100}%` }));
  return (
    <View style={{ flex: 1, height: 3, borderRadius: 2, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.14)" }}>
      <Animated.View style={[{ height: 3, borderRadius: 2, backgroundColor: "#fff" }, bar]} />
    </View>
  );
}

/** The question a page asks, and the line under it. */
export function Ask({ title, note }: { title: string; note?: string }) {
  return (
    <View style={{ paddingTop: 6 }}>
      <Text style={{ fontSize: 26, fontWeight: "800", letterSpacing: -0.9, lineHeight: 31, color: "#fff" }}>{title}</Text>
      {note ? <Text style={{ marginTop: 6, fontSize: 14, lineHeight: 19, color: INK.soft }}>{note}</Text> : null}
    </View>
  );
}
