import { useEffect, useRef, useState, type ReactNode } from "react";
import { Modal, Pressable, Text, View, useWindowDimensions } from "react-native";
import { BlurView } from "expo-blur";
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { Trash2 } from "~/components/icons";
import { INK, RED } from "~/theme/tokens";

import { th } from "~/theme/theme";
/**
 * Are you sure, in glass.
 *
 * A small pane in the middle of the screen with the page softened behind it: what is
 * about to happen, what it costs, and two ways out — the one that backs off is the
 * quieter of the two, and the one that goes ahead is tinted for what it is.
 */

const EXIT_MS = 180;

export default function ConfirmGlass({
  open,
  title,
  children,
  confirmLabel,
  busy = false,
  icon,
  busyLabel = "Excluindo…",
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  busy?: boolean;
  /** In place of the bin, when what is about to happen is not a deletion. */
  icon?: ReactNode;
  busyLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { width } = useWindowDimensions();
  const [mounted, setMounted] = useState(open);
  const shown = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (open) {
      setMounted(true);
      shown.set(withSpring(1, { duration: 360, dampingRatio: 0.9, reduceMotion: ReduceMotion.System }));
    } else {
      shown.set(withTiming(0, { duration: EXIT_MS, easing: Easing.in(Easing.quad), reduceMotion: ReduceMotion.System }));
      timer.current = setTimeout(() => setMounted(false), EXIT_MS + 20);
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [open, shown]);

  const dim = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, shown.get())) }));
  const card = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, shown.get() * 1.4)),
    transform: [{ scale: 0.92 + shown.get() * 0.08 }],
  }));

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={busy ? undefined : onClose} statusBarTranslucent>
      <Pressable style={{ flex: 1 }} onPress={busy ? undefined : onClose}>
        <BlurView intensity={16} tint={th("dark", "tint")} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
        <Animated.View style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: th("rgba(0,0,0,0.5)", "bg") }, dim]} />
      </Pressable>

      <View pointerEvents="box-none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
        <Animated.View
          style={[
            {
              width: Math.min(340, width - 48),
              borderRadius: 30,
              borderCurve: "continuous",
              borderWidth: 1,
              borderColor: th("rgba(255,255,255,0.16)", "line"),
              overflow: "hidden",
            },
            card,
          ]}
        >
          <BlurView intensity={70} tint={th("dark", "tint")} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: th("rgba(18,20,26,0.5)", "bg") }} />
          <View style={{ position: "absolute", top: 0, left: 30, right: 30, height: 1, backgroundColor: th("rgba(255,255,255,0.24)", "bg") }} />

          <View style={{ alignItems: "center", paddingHorizontal: 22, paddingTop: 26, paddingBottom: 18 }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: th("rgba(248,113,113,0.16)", "bg") }}>
              {icon ?? <Trash2 size={22} color={th(RED)} strokeWidth={2} />}
            </View>
            <Text style={{ marginTop: 16, textAlign: "center", fontSize: 19, fontWeight: "700", letterSpacing: -0.3, color: th("#fff") }}>{title}</Text>
            <View style={{ marginTop: 8 }}>
              <Text style={{ textAlign: "center", fontSize: 14, lineHeight: 20, color: th(INK.soft) }}>{children}</Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingBottom: 16 }}>
            <Pressable
              onPress={onClose}
              disabled={busy}
              style={({ pressed }) => ({
                flex: 1,
                height: 48,
                borderRadius: 24,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: th("rgba(255,255,255,0.09)", "bg"),
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ fontSize: 15.5, fontWeight: "600", color: th("#fff") }}>Cancelar</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={busy}
              style={({ pressed }) => ({
                flex: 1,
                height: 48,
                borderRadius: 24,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: th("rgba(248,113,113,0.2)", "bg"),
                borderWidth: 1,
                borderColor: th("rgba(248,113,113,0.36)", "line"),
                opacity: busy ? 0.6 : pressed ? 0.75 : 1,
              })}
            >
              <Text style={{ fontSize: 15.5, fontWeight: "700", color: th(RED) }}>{busy ? busyLabel : confirmLabel}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
