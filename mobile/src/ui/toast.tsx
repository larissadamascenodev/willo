import { useEffect, useState } from "react";
import { View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CheckCircle2, Info, XCircle } from "lucide-react-native";
import { Glass } from "./Glass";
import { Text } from "./Text";
import { colors } from "./theme";

type Kind = "success" | "error" | "info";
interface Item {
  id: number;
  kind: Kind;
  message: string;
}

let nextId = 1;
const listeners = new Set<(item: Item) => void>();
const show = (kind: Kind, message: string) => listeners.forEach((fn) => fn({ id: nextId++, kind, message }));

/** Avisos curtos no topo da tela, com a mesma chamada do `toast` do site (toast.success("…")). */
export const toast = {
  success: (message: string) => show("success", message),
  error: (message: string) => show("error", message),
  info: (message: string) => show("info", message),
};

const ICONS = { success: CheckCircle2, error: XCircle, info: Info } as const;
const TINTS = { success: colors.green, error: colors.red, info: colors.sky } as const;

/** Montado uma vez na raiz do app. */
export function ToastHost() {
  const insets = useSafeAreaInsets();
  const [item, setItem] = useState<Item | null>(null);

  useEffect(() => {
    const on = (next: Item) => setItem(next);
    listeners.add(on);
    return () => {
      listeners.delete(on);
    };
  }, []);

  useEffect(() => {
    if (!item) return;
    const id = setTimeout(() => setItem((cur) => (cur?.id === item.id ? null : cur)), 3000);
    return () => clearTimeout(id);
  }, [item]);

  if (!item) return null;
  const Icon = ICONS[item.kind];

  return (
    <View pointerEvents="none" style={{ position: "absolute", top: insets.top + 8, left: 16, right: 16, alignItems: "center", zIndex: 1000 }}>
      <Animated.View key={item.id} entering={FadeInUp.duration(220)} exiting={FadeOutUp.duration(180)}>
        <Glass strong radius={20} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 12, maxWidth: 420 }}>
          <Icon size={20} color={TINTS[item.kind]} />
          <Text weight="semibold" size={14} style={{ flexShrink: 1 }}>
            {item.message}
          </Text>
        </Glass>
      </Animated.View>
    </View>
  );
}
