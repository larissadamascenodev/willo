import { Platform, Text, View, type TextStyle } from "react-native";
import { compact } from "~/lib/money";
import { GREEN, INK, RED } from "~/theme/tokens";

/**
 * The month as the two sums it actually is.
 *
 * What was left from the month before, what comes in and what goes out, in that order,
 * and under the rule the close. The rule sits where an equals sign would, which is what
 * makes it read as a ledger rather than as a list of rows.
 *
 * Every figure is white; one turns red only when it is below zero, because that is
 * the only thing in a ledger worth raising a voice for.
 */

const nums: TextStyle = Platform.select({
  ios: { fontVariant: ["tabular-nums"] },
  default: {},
}) as TextStyle;

const value = (v: number) => `${v < 0 ? "−" : ""}${compact(Math.abs(v))}`;

export default function MonthBreakdown({
  row,
  prevName,
  carry = true,
}: {
  row: {
    income: number;
    expense: number;
    sobra: number;
    prevBalance: number;
    fecha: number;
    name: string;
  };
  prevName: string;
  /** Off for a month reported on its own; on when months chain into each other. */
  carry?: boolean;
}) {
  const total = carry ? row.fecha : row.sobra;
  const totalLabel = carry
    ? `Saldo no fim de ${row.name.toLocaleLowerCase("pt-BR")}`
    : `Sobra de ${row.name.toLocaleLowerCase("pt-BR")}`;

  return (
    <View style={{ marginTop: 10 }}>
      {/* In the order the money arrives: what was left from the month before, then what
          comes in and goes out in this one. */}
      {carry && (
        <Line
          label={row.prevBalance < 0 ? `Faltou em ${prevName.toLocaleLowerCase("pt-BR")}` : `Sobra de ${prevName.toLocaleLowerCase("pt-BR")}`}
          amount={Math.abs(row.prevBalance)}
          tone={row.prevBalance < 0 ? RED : undefined}
        />
      )}
      <Line label="Entra" amount={row.income} sign="+" tone={GREEN} />
      <Line label="Sai" amount={row.expense} sign="−" />

      <View
        style={{
          flexDirection: "row",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 16,
          paddingTop: 14,
        }}
      >
        <Text style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: "600", color: "#fff" }}>{totalLabel}</Text>
        <Text
          numberOfLines={1}
          style={[nums, { fontSize: 20, fontWeight: "700", letterSpacing: -0.4, color: total < 0 ? RED : "#fff" }]}
        >
          {value(total)}
        </Text>
      </View>
    </View>
  );
}

function Line({ label, amount, sign = "", tone }: { label: string; amount: number; sign?: string; tone?: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(255,255,255,0.06)",
      }}
    >
      <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, fontSize: 15, color: INK.soft }}>
        {label}
      </Text>
      <Text style={[nums, { fontSize: 16, fontWeight: "600", color: tone ?? "#fff" }]}>
        {sign}
        {compact(Math.abs(amount))}
      </Text>
    </View>
  );
}
