import { useCallback, useEffect, useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Glass } from "./Glass";
import { white } from "./theme";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** "auto" acompanha o conteúdo; "full" ocupa quase a tela toda, como uma folha nativa. */
  size?: "auto" | "full";
  /** Rodapé fixo (a ação principal), acima do indicador de início do iPhone. */
  footer?: ReactNode;
}

const DURATION = 260;

/**
 * Folha que sobe de baixo: escurece a tela, tem uma alça no topo e fecha tocando fora ou
 * arrastando a alça para baixo. O conteúdo continua montado durante a animação de saída.
 */
export function BottomSheet({ open, onClose, children, size = "auto", footer }: BottomSheetProps) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(open);
  const progress = useSharedValue(0); // 0 = fora da tela, 1 = aberta
  const drag = useSharedValue(0);

  useEffect(() => {
    if (open) {
      setMounted(true);
      drag.value = 0;
      progress.value = withTiming(1, { duration: DURATION, easing: Easing.out(Easing.cubic) });
    } else if (mounted) {
      progress.value = withTiming(0, { duration: DURATION, easing: Easing.in(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = useCallback(() => onClose(), [onClose]);

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      drag.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > 120 || e.velocityY > 600) runOnJS(close)();
      else drag.value = withTiming(0, { duration: 180 });
    });

  const backdrop = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheet = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * height + drag.value }],
  }));

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.7)" }, backdrop]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fechar" />
        </Animated.View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "flex-end" }} pointerEvents="box-none">
          <Animated.View style={[sheet, { maxHeight: height * 0.94, height: size === "full" ? height * 0.94 : undefined }]}>
            <Glass strong radius={32} style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, flex: size === "full" ? 1 : undefined }}>
              <GestureDetector gesture={pan}>
                <View style={{ alignItems: "center", paddingTop: 10, paddingBottom: 8 }}>
                  <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: white(0.28) }} />
                </View>
              </GestureDetector>
              <View style={{ flexShrink: 1, flex: size === "full" ? 1 : undefined }}>{children}</View>
              {footer ? <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 12 }}>{footer}</View> : <View style={{ height: insets.bottom }} />}
            </Glass>
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}
