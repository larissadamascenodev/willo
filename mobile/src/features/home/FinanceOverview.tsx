import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { ArrowDownLeft, ArrowUpRight, ChevronRight, Scale, TrendingUp } from "lucide-react-native";
import { useMoney } from "@/components/projecoes/shared";
import { ProgressBar, Surface, Text, colors, white } from "~/ui";
import { tint } from "~/lib/color";

interface Props {
  receitas: number;
  despesas: number;
  saldoPrevisto: number;
  nextMonthBalance: number;
}

/** O balanço do mês e para onde ele vai: abre as Projeções. */
export function FinanceOverview({ receitas, despesas, saldoPrevisto, nextMonthBalance }: Props) {
  const router = useRouter();
  const { compact } = useMoney();
  const balanco = receitas - despesas;
  const base = Math.max(receitas, despesas, 1);
  const delta = nextMonthBalance - saldoPrevisto;
  const up = delta >= 0;

  const columns = [
    { label: "Receitas", value: receitas, hex: colors.green, Icon: ArrowDownLeft },
    { label: "Despesas", value: despesas, hex: colors.red, Icon: ArrowUpRight },
  ];

  return (
    <Pressable onPress={() => router.push("/projecoes")} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      <Surface style={{ padding: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: tint("#60A5FA", 0.15) }}>
              <Scale size={18} color="#60A5FA" />
            </View>
            <Text weight="medium" size={13} color={white(0.74)}>Financeiro</Text>
          </View>
          <ChevronRight size={16} color={white(0.38)} />
        </View>

        <Text weight="extrabold" size={26} tabular numberOfLines={1} color={balanco < 0 ? colors.red : colors.green} style={{ marginTop: 12, letterSpacing: -0.6 }}>
          {balanco > 0 ? "+" : ""}{compact(balanco)}
        </Text>

        <View style={{ marginTop: 12, flexDirection: "row", gap: 12 }}>
          {columns.map(({ label, value, hex, Icon }, i) => (
            <View key={label} style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Icon size={12} color={hex} strokeWidth={2.5} />
                  <Text size={11} color={white(0.62)}>{label}</Text>
                </View>
                <Text weight="semibold" size={12} tabular numberOfLines={1}>{compact(value)}</Text>
              </View>
              <View style={{ marginTop: 4 }}><ProgressBar ratio={value / base} color={hex} delay={100 + i * 100} /></View>
            </View>
          ))}
        </View>

        <View style={{ marginTop: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, borderRadius: 16, backgroundColor: white(0.05), paddingHorizontal: 12, paddingVertical: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 }}>
            <TrendingUp size={14} color="#C084FC" />
            <Text size={12} color={white(0.7)} numberOfLines={1}>
              Fim do mês <Text size={12} weight="semibold" tabular>{compact(saldoPrevisto)}</Text>
            </Text>
          </View>
          <Text weight="semibold" size={11.5} tabular color={up ? colors.green : colors.red}>
            {up ? "▲" : "▼"} {compact(Math.abs(delta))}
          </Text>
        </View>
      </Surface>
    </Pressable>
  );
}
