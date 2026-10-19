import { Text, View } from "react-native";
import Bar from "~/components/Bar";
import SegmentedTabs from "~/components/SegmentedTabs";
import { money } from "~/lib/money";
import { GREEN, INK, RED } from "~/theme/tokens";
import { type as T } from "~/theme/type";

/**
 * The month, read out on the page itself.
 *
 * There is no card around it: a figure this size is already the loudest thing on the
 * screen, and a panel behind it only adds an edge for the eye to stop at. The two
 * flows sit under it on one shared scale, so which side is bigger is answered before
 * either number is read.
 */
export default function TransactionsSummary({
  saldoAtual,
  saldoPrevisto,
  receitas,
  despesas,
}: {
  saldoAtual: number;
  saldoPrevisto: number;
  receitas: number;
  despesas: number;
}) {
  const scale = Math.max(receitas, despesas, 1);

  return (
    <View style={{ paddingHorizontal: 4 }}>
      <Text style={[T.eyebrow, { fontSize: 11 }]}>Saldo em contas</Text>
      <Text
        numberOfLines={1}
        style={[T.figureBig, { marginTop: 6 }, saldoAtual < 0 && { color: RED }]}
      >
        {money(saldoAtual)}
      </Text>

      {saldoPrevisto !== saldoAtual && (
        <Text numberOfLines={1} style={[T.note, { marginTop: 10 }]}>
          Previsto no fim do mês:{" "}
          <Text style={{ fontWeight: "600", color: "rgba(255,255,255,0.8)" }}>
            {money(saldoPrevisto)}
          </Text>
        </Text>
      )}

      <View style={{ marginTop: 20, gap: 14 }}>
        {[
          { label: "Entrada", value: receitas, inflow: true },
          { label: "Saída", value: despesas, inflow: false },
        ].map(({ label, value, inflow }) => (
          <View key={label}>
            <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
              <Text style={{ fontSize: 13, color: INK.soft }}>{label}</Text>
              <Text style={{ fontSize: 14.5, fontWeight: "700", color: inflow ? "#fff" : RED }}>
                {inflow ? "" : "−"}
                {money(value)}
              </Text>
            </View>
            <View
              style={{
                marginTop: 8,
                height: 5,
                borderRadius: 999,
                backgroundColor: "rgba(255,255,255,0.07)",
                overflow: "hidden",
              }}
            >
              <Bar
                share={Math.max(value / scale, value > 0 ? 0.03 : 0)}
                color={inflow ? GREEN : RED}
                delay={inflow ? 0.05 : 0.12}
              />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Todas / Receitas / Despesas. */
export function TransactionTabs({
  value,
  onChange,
}: {
  value: "todos" | "receita" | "despesa";
  onChange: (v: "todos" | "receita" | "despesa") => void;
}) {
  return (
    <SegmentedTabs
      value={value}
      onChange={onChange}
      options={[
        { key: "todos", label: "Todas" },
        { key: "receita", label: "Receitas" },
        { key: "despesa", label: "Despesas" },
      ]}
    />
  );
}
