import { Text, View } from "react-native";
import Bar from "~/components/Bar";
import SegmentedTabs from "~/components/SegmentedTabs";
import { money } from "~/lib/money";
import { GREEN, INK, RED } from "~/theme/tokens";
import { type as T } from "~/theme/type";

import { th } from "~/theme/theme";
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/**
 * The month, read out on the page itself.
 *
 * There is no card around it: a figure this size is already the loudest thing on the
 * screen, and a panel behind it only adds an edge for the eye to stop at. The two
 * flows sit under it on one shared scale, so which side is bigger is answered before
 * either number is read.
 *
 * What the big figure is depends on where the month stands:
 * - a month gone by shows what was left at its end;
 * - this month shows the money in the accounts now, with where it is heading;
 * - a month to come shows what it should end with — what it will bring in and pay
 *   out, on top of what this month is expected to hand over — and says how much of
 *   that comes from the month before.
 */
export default function TransactionsSummary({
  month,
  kind,
  saldoAtual,
  saldoPrevisto,
  abertura,
  balanco,
  receitas,
  despesas,
}: {
  month: number;
  kind: "past" | "current" | "future";
  saldoAtual: number;
  saldoPrevisto: number;
  /** What the month started with. */
  abertura: number;
  /** What actually happened in the month, in minus out. */
  balanco: number;
  receitas: number;
  despesas: number;
}) {
  const scale = Math.max(receitas, despesas, 1);
  const before = MONTHS[(month + 11) % 12];
  const big = kind === "past" ? abertura + balanco : kind === "future" ? saldoPrevisto : saldoAtual;
  const label = kind === "past" ? "Saldo ao fim do mês" : kind === "future" ? "Saldo previsto" : "Saldo em contas";
  const note =
    kind === "current"
      ? saldoPrevisto !== saldoAtual
        ? { text: "Previsto no fim do mês:", value: saldoPrevisto }
        : null
      : kind === "future"
        ? { text: `Vem de ${before}:`, value: abertura }
        : null;

  return (
    <View style={{ paddingHorizontal: 4 }}>
      <Text style={[T.eyebrow, { fontSize: 11 }]}>{label}</Text>
      <Text
        numberOfLines={1}
        style={[T.figureBig, { marginTop: 6 }, big < 0 && { color: th(RED) }]}
      >
        {money(big)}
      </Text>

      {note && (
        <Text numberOfLines={1} style={[T.note, { marginTop: 10 }]}>
          {note.text}{" "}
          <Text style={{ fontWeight: "600", color: th("rgba(255,255,255,0.8)") }}>
            {money(note.value)}
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
              <Text style={{ fontSize: 13, color: th(INK.soft) }}>{label}</Text>
              <Text style={{ fontSize: 14.5, fontWeight: "700", color: th(inflow ? "#fff" : RED) }}>
                {inflow ? "" : "−"}
                {money(value)}
              </Text>
            </View>
            <View
              style={{
                marginTop: 8,
                height: 5,
                borderRadius: 999,
                backgroundColor: th("rgba(255,255,255,0.07)", "bg"),
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
