import { Text, View } from "react-native";
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
              <View
                style={{
                  height: "100%",
                  borderRadius: 999,
                  backgroundColor: inflow ? GREEN : RED,
                  width: `${Math.max((value / scale) * 100, value > 0 ? 3 : 0)}%`,
                }}
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
  const tabs = [
    { key: "todos" as const, label: "Todas" },
    { key: "receita" as const, label: "Receitas" },
    { key: "despesa" as const, label: "Despesas" },
  ];

  return (
    <View
      style={{
        flexDirection: "row",
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.06)",
        backgroundColor: "rgba(255,255,255,0.035)",
        padding: 4,
      }}
    >
      {tabs.map((tab) => {
        const on = value === tab.key;
        return (
          <Text
            key={tab.key}
            onPress={() => onChange(tab.key)}
            style={{
              flex: 1,
              height: 38,
              lineHeight: 38,
              textAlign: "center",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: "600",
              overflow: "hidden",
              backgroundColor: on ? "#fff" : "transparent",
              color: on ? "#0B0B0B" : INK.soft,
            }}
          >
            {tab.label}
          </Text>
        );
      })}
    </View>
  );
}
