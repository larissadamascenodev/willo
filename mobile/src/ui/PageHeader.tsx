import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { Text } from "./Text";
import { white } from "./theme";

/** Seta de voltar discreta, título grande e subtítulo opcional: o cabeçalho das telas internas. */
export function PageHeader({ title, subtitle, action, onBack }: { title: string; subtitle?: ReactNode; action?: ReactNode; onBack?: () => void }) {
  const router = useRouter();
  return (
    <View>
      <View style={{ height: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Pressable
          onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace("/")))}
          accessibilityLabel="Voltar"
          hitSlop={12}
          style={({ pressed }) => ({ marginLeft: -8, height: 40, justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
        >
          <ChevronLeft size={28} color={white(0.82)} strokeWidth={2.25} />
        </Pressable>
        {action}
      </View>
      <View style={{ marginTop: 4 }}>
        <Text display weight="extrabold" size={28} style={{ letterSpacing: -0.5 }}>
          {title}
        </Text>
        {subtitle ? (
          typeof subtitle === "string" ? <Text size={14} color={white(0.62)}>{subtitle}</Text> : subtitle
        ) : null}
      </View>
    </View>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <View style={{ marginTop: 28, marginBottom: 10, paddingHorizontal: 4, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Text display weight="bold" size={18}>
        {children}
      </Text>
      {action}
    </View>
  );
}
