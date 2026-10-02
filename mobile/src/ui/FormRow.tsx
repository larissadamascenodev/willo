import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { Text } from "./Text";
import { white } from "./theme";

/** Linha de formulário no estilo de ajustes: ícone e rótulo à esquerda, o controle à direita. */
export function FormRow({ icon: Icon, label, children, onPress }: { icon: LucideIcon; label: string; children?: ReactNode; onPress?: () => void }) {
  const body = (
    <View style={{ minHeight: 56, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10 }}>
      <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: white(0.06) }}>
        <Icon size={16} color={white(0.82)} />
      </View>
      <Text size={15}>{label}</Text>
      <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>{children}</View>
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => ({ backgroundColor: pressed ? white(0.03) : "transparent" })}>
      {body}
    </Pressable>
  ) : (
    body
  );
}

/** Um chip de escolha (Hoje / Ontem / Outra data…): branco quando ativo. */
export function Chip({ label, on, onPress, disabled, icon }: { label: string; on: boolean; onPress: () => void; disabled?: boolean; icon?: ReactNode }) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={{ height: 36, flexShrink: 0, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 16, borderRadius: 999, backgroundColor: on ? "#fff" : white(0.06), opacity: disabled ? 0.35 : 1 }}
    >
      {icon}
      <Text size={13} weight="semibold" color={on ? "#0B0B0B" : white(0.74)}>{label}</Text>
    </Pressable>
  );
}
