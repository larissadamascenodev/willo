import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react-native";
import { Background, Button, Glass, Logo, Text, colors, white } from "~/ui";

/** Uma amostra do cartão de saldo do app, com valores ilustrativos. */
function PreviewCard() {
  const rows = [
    { label: "Receitas", value: "R$ 6.450,00", hex: colors.green, Icon: ArrowDownLeft },
    { label: "Despesas", value: "R$ 3.215,80", hex: colors.red, Icon: ArrowUpRight },
  ];
  return (
    <Glass radius={28} style={{ padding: 20 }}>
      <Text size={13} color={white(0.66)}>Saldo disponível</Text>
      <Text weight="extrabold" size={36} tabular style={{ marginTop: 8, letterSpacing: -1 }}>R$ 8.420,50</Text>
      <Text size={13} color={white(0.6)} style={{ marginTop: 10 }}>
        Previsto no fim do mês: <Text size={13} weight="semibold" color={white(0.85)} tabular>R$ 9.120,30</Text>
      </Text>
      <View style={{ marginTop: 16, flexDirection: "row", borderTopWidth: 1, borderTopColor: white(0.12), paddingTop: 16 }}>
        {rows.map(({ label, value, hex, Icon }, i) => (
          <View key={label} style={[{ flex: 1 }, i === 1 && { borderLeftWidth: 1, borderLeftColor: white(0.12), paddingLeft: 16 }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Icon size={14} color={hex} strokeWidth={2.5} />
              <Text size={12} color={white(0.66)}>{label}</Text>
            </View>
            <Text weight="bold" size={16} tabular style={{ marginTop: 4 }}>{value}</Text>
          </View>
        ))}
      </View>
    </Glass>
  );
}

export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: "#0A1220" }}>
      <Background />
      <View style={{ flex: 1, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16, paddingHorizontal: 20 }}>
        <Animated.View entering={FadeIn.duration(500)} style={{ alignItems: "center" }}>
          <Logo height={26} />
        </Animated.View>

        <Animated.View entering={FadeIn.delay(150).duration(600)} style={{ flex: 1, justifyContent: "center" }}>
          <PreviewCard />
          <Text size={11} color={white(0.45)} align="center" style={{ marginTop: 10 }}>Demonstração · valores ilustrativos</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(500)}>
          <View style={{ alignItems: "center" }}>
            <Text display weight="extrabold" size={27} align="center" style={{ letterSpacing: -0.4 }}>
              Gaste melhor, guarde mais.
            </Text>
            <Text size={15} color={white(0.66)} align="center" style={{ marginTop: 4 }}>
              Tudo calculado pro seu bolso.
            </Text>
          </View>
          <View style={{ marginTop: 28 }}>
            <Button label="Começar agora" onPress={() => router.push({ pathname: "/auth", params: { mode: "signup" } })} />
          </View>
          <Pressable onPress={() => router.push({ pathname: "/auth", params: { mode: "login" } })} style={{ marginTop: 16, paddingVertical: 8 }}>
            <Text size={14} color={white(0.66)} align="center">Já tenho conta</Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}
