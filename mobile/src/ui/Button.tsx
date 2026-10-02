import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import { Glass } from "./Glass";
import { Text } from "./Text";
import { colors, white } from "./theme";

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "glass" | "danger";
  icon?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

/** O botão do Willo: pílula branca com texto preto (principal) ou vidro (secundário). */
export function Button({ label, onPress, variant = "primary", icon, disabled, loading, height = 56, style }: ButtonProps) {
  const off = disabled || loading;
  const primary = variant === "primary";
  const fg = primary ? colors.black : variant === "danger" ? colors.red : colors.white;

  const content = (
    <View style={{ height, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 24 }}>
      {loading ? <ActivityIndicator color={fg} /> : icon}
      <Text weight="bold" size={16} color={fg}>
        {label}
      </Text>
    </View>
  );

  return (
    <Pressable onPress={off ? undefined : onPress} accessibilityRole="button" style={({ pressed }) => [{ opacity: off ? 0.35 : pressed ? 0.8 : 1 }, style]}>
      {primary ? (
        <View
          style={{
            borderRadius: 999,
            backgroundColor: "#fff",
            shadowColor: "#fff",
            shadowOpacity: 0.28,
            shadowRadius: 17,
            shadowOffset: { width: 0, height: 5 },
          }}
        >
          {content}
        </View>
      ) : (
        <Glass radius={999} style={variant === "danger" ? { borderColor: "rgba(248,113,113,0.35)" } : undefined}>
          {content}
        </Glass>
      )}
    </Pressable>
  );
}

/** Botão redondo só com ícone (o olho, o sino, o scanner). */
export function IconButton({ children, onPress, label, size = 44 }: { children: ReactNode; onPress?: () => void; label: string; size?: number }) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      <Glass radius={size / 2} style={{ width: size, height: size, alignItems: "center", justifyContent: "center", borderColor: white(0.2) }}>
        {children}
      </Glass>
    </Pressable>
  );
}
