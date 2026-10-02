import { useState, type ReactNode } from "react";
import { Pressable, TextInput, View, type TextInputProps } from "react-native";
import { Eye, EyeOff } from "lucide-react-native";
import { Text } from "./Text";
import { fonts, white } from "./theme";

interface FieldProps extends Omit<TextInputProps, "style"> {
  label: string;
  icon?: ReactNode;
  /** Mostra o olho para revelar o texto digitado (senhas). */
  secret?: boolean;
}

/** Campo de texto com rótulo pequeno em cima, como os campos do login do site. */
export function Field({ label, icon, secret, ...input }: FieldProps) {
  const [hidden, setHidden] = useState(!!secret);
  return (
    <View style={{ borderRadius: 22, borderWidth: 1, borderColor: white(0.1), backgroundColor: "#0B0B0B", paddingHorizontal: 20, paddingVertical: 14 }}>
      <Text size={11} weight="semibold" color={white(0.66)} style={{ letterSpacing: 2.2, textTransform: "uppercase" }}>
        {label}
      </Text>
      <View style={{ marginTop: 6, flexDirection: "row", alignItems: "center", gap: 12 }}>
        {icon}
        <TextInput
          {...input}
          secureTextEntry={hidden}
          placeholderTextColor={white(0.4)}
          selectionColor="#fff"
          style={{ flex: 1, minWidth: 0, padding: 0, color: "#fff", fontSize: 17, fontFamily: fonts.regular }}
        />
        {secret && (
          <Pressable onPress={() => setHidden((v) => !v)} hitSlop={10} accessibilityLabel={hidden ? "Mostrar senha" : "Ocultar senha"}>
            {hidden ? <Eye size={20} color={white(0.56)} /> : <EyeOff size={20} color={white(0.56)} />}
          </Pressable>
        )}
      </View>
    </View>
  );
}
