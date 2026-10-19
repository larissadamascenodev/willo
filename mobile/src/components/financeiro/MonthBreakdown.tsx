import { Text, View } from "react-native";
import { compact } from "~/lib/money";
import { GREEN, INK, RED } from "~/theme/tokens";

/**
 * The month as the two sums it actually is.
 *
 * What moved this month gives the leftover, and that plus what was left of last
 * month gives the close. The rules sit where an equals sign would, which is what
 * makes it read as a ledger rather than as a list of five rows.
 */
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
  /** Off in Balanço, which reports a month on its own; Projeções chains them. */
  carry?: boolean;
}) {
  const total = carry ? row.fecha : row.sobra;
  const totalLabel = carry
    ? `Fecha ${row.name.toLocaleLowerCase("pt-BR")} com`
    : `Balanço de ${row.name.toLocaleLowerCase("pt-BR")}`;

  return (
    <View style={{ marginTop: 18 }}>
      <Line label="Entra" value={row.income} />
      <Line label="Sai" value={-row.expense} />

      {carry && (
        <>
          <View style={{ borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.09)", paddingTop: 2 }}>
            <Line label="Sobra do mês" value={row.sobra} strong result />
          </View>
          <View style={{ marginTop: 8 }}>
            <Line label={`Sobra de ${prevName.toLocaleLowerCase("pt-BR")}`} value={row.prevBalance} />
          </View>
        </>
      )}

      <View
        style={{
          marginTop: 2,
          flexDirection: "row",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 16,
          borderTopWidth: 1,
          borderTopColor: "rgba(255,255,255,0.16)",
          paddingTop: 14,
        }}
      >
        <Text style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: "600", color: "#fff" }}>
          {totalLabel}
        </Text>
        <Text
          numberOfLines={1}
          style={{ fontSize: 19, fontWeight: "800", letterSpacing: -0.4, color: total < 0 ? RED : GREEN }}
        >
          {total > 0 ? "+" : ""}
          {compact(total)}
        </Text>
      </View>
    </View>
  );
}

function Line({
  label,
  value,
  strong = false,
  result = false,
}: {
  label: string;
  value: number;
  strong?: boolean;
  result?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 16,
        paddingVertical: 9,
      }}
    >
      <Text
        numberOfLines={1}
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 13,
          fontWeight: strong ? "600" : "400",
          color: strong ? "#fff" : INK.soft,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: 14,
          fontWeight: strong ? "700" : "600",
          color: result ? (value < 0 ? RED : GREEN) : "#fff",
        }}
      >
        {value > 0 && result ? "+" : ""}
        {compact(value)}
      </Text>
    </View>
  );
}
