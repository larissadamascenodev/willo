import { Platform, Text, View, type TextStyle } from "react-native";
import { compact } from "~/lib/money";
import { INK, RED } from "~/theme/tokens";

/**
 * The month as the two sums it actually is.
 *
 * What moved this month gives the leftover, and that plus what was left of last
 * month gives the close. The rules sit where an equals sign would, which is what
 * makes it read as a ledger rather than as a list of five rows.
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
    <View style={{ marginTop: 22 }}>
      <Line label="Entra" amount={row.income} />
      <Line label="Sai" amount={-row.expense} />

      {carry && (
        <>
          <View style={{ borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)" }}>
            <Line label="Sobra do mês" amount={row.sobra} strong />
          </View>
          <Line label={`Saldo de ${prevName.toLocaleLowerCase("pt-BR")}`} amount={row.prevBalance} />
        </>
      )}

      <View
        style={{
          marginTop: 4,
          flexDirection: "row",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 16,
          borderTopWidth: 1,
          borderTopColor: "rgba(255,255,255,0.18)",
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

function Line({ label, amount, strong = false }: { label: string; amount: number; strong?: boolean }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 16,
        paddingVertical: 11,
      }}
    >
      <Text
        numberOfLines={1}
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 14.5,
          fontWeight: strong ? "600" : "400",
          color: strong ? "#fff" : INK.soft,
        }}
      >
        {label}
      </Text>
      <Text
        style={[
          nums,
          {
            fontSize: 15,
            fontWeight: strong ? "700" : "500",
            color: strong && amount < 0 ? RED : "#fff",
          },
        ]}
      >
        {value(amount)}
      </Text>
    </View>
  );
}
