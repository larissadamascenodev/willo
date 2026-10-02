import { View } from "react-native";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react-native";
import { useMoney } from "@/components/projecoes/shared";
import { Glass, Text, colors, white } from "~/ui";

/** O saldo do mês e, embaixo, o que entrou e o que saiu (o cabeçalho de Transações). */
export function TransactionsSummary({ saldoAtual, saldoPrevisto, receitas, despesas }: { saldoAtual: number; saldoPrevisto: number; receitas: number; despesas: number }) {
  const { fmt, compact } = useMoney();
  const columns = [
    { label: "Receitas", value: receitas, hex: colors.green, Icon: ArrowDownLeft },
    { label: "Despesas", value: despesas, hex: colors.red, Icon: ArrowUpRight },
  ];
  return (
    <Glass radius={24} style={{ padding: 16 }}>
      <Text size={13} color={white(0.66)}>Saldo disponível</Text>
      <Text weight="extrabold" size={30} tabular numberOfLines={1} style={{ marginTop: 4, letterSpacing: -0.8 }}>{fmt(saldoAtual)}</Text>
      <Text size={12.5} color={white(0.6)} style={{ marginTop: 4 }}>Previsto no fim do mês: <Text size={12.5} weight="semibold" color={white(0.8)} tabular>{compact(saldoPrevisto)}</Text></Text>
      <View style={{ marginTop: 14, flexDirection: "row", borderTopWidth: 1, borderTopColor: white(0.12), paddingTop: 14 }}>
        {columns.map(({ label, value, hex, Icon }, i) => (
          <View key={label} style={[{ flex: 1, minWidth: 0 }, i === 1 ? { borderLeftWidth: 1, borderLeftColor: white(0.12), paddingLeft: 16 } : { paddingRight: 16 }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Icon size={13} color={hex} strokeWidth={2.6} />
              <Text size={12.5} color={white(0.66)}>{label}</Text>
            </View>
            <Text weight="extrabold" size={18} tabular numberOfLines={1} style={{ marginTop: 4 }}>{fmt(value)}</Text>
          </View>
        ))}
      </View>
    </Glass>
  );
}
