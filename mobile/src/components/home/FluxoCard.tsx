import { Platform, Text, View, type TextStyle } from "react-native";
import { useRouter } from "expo-router";
import Surface from "~/components/Surface";
import Bar from "~/components/Bar";
import { ChevronRight } from "~/components/icons";
import { money } from "~/lib/money";
import { GREEN, INK, RED } from "~/theme/tokens";
import { type as T } from "~/theme/type";

/* Figures line up in columns, so their digits have to be the same width. */
const nums: TextStyle = Platform.select({
  ios: { fontVariant: ["tabular-nums"] },
  default: {},
}) as TextStyle;

const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/**
 * The month as the two flows that make it.
 *
 * The two bars come first, straight under the title, because they are what the
 * card is: both on one scale, so their lengths answer which side is bigger before
 * a figure is read.
 *
 * What is left over closes the card on the right, where a total sits on a receipt
 * — one step larger than the rows above it, enough to read as the result and no
 * more, because the balance in the accounts is the headline figure of the home and
 * should not have a rival one card below. Under it, the sentence the bars cannot
 * draw: two near-equal lengths look fine until you are told they are 96%.
 *
 * Colour is in the bars only. The figures are white, the outgoing one carrying its
 * minus sign; the leftover turns red only when the month falls short.
 *
 * The whole card is one way in, to the cash-flow screen.
 */
export default function FluxoCard({
  receitas,
  despesas,
  month,
  isCurrentMonth = true,
}: {
  receitas: number;
  despesas: number;
  month: number;
  isCurrentMonth?: boolean;
}) {
  const router = useRouter();
  const balanco = receitas - despesas;
  const monthLabel = MONTHS[month];
  const pct = receitas > 0 ? Math.round((despesas / receitas) * 100) : 0;
  const scale = Math.max(receitas, despesas, 1);

  const verdict =
    receitas <= 0 && despesas <= 0
      ? `Nada entrou nem saiu em ${monthLabel} ainda.`
      : receitas <= 0
        ? `Saiu dinheiro em ${monthLabel} sem nenhuma entrada.`
        : balanco < 0
          ? `Você gastou mais do que entrou em ${monthLabel}.`
          : `Você gastou ${pct}% do que entrou em ${monthLabel}.`;

  const short = balanco < 0;

  return (
    <Surface
      onPress={() => router.push("/fluxo-de-caixa" as never)}
      style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Text numberOfLines={1} style={[T.cardLabel, { flex: 1 }]}>
          Receitas e despesas <Text style={{ color: INK.faint }}>·</Text>{" "}
          {isCurrentMonth ? "este mês" : "no mês"}
        </Text>
        <ChevronRight size={16} color={INK.faint} />
      </View>

      <View style={{ marginTop: 14, gap: 12 }}>
        <Flow label="Entrada" amount={receitas} scale={scale} inflow delay={0.05} />
        <Flow label="Saída" amount={despesas} scale={scale} delay={0.12} />
      </View>

      {/* The result, on the right, with what it means under it. */}
      <View
        style={{
          marginTop: 16,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: "rgba(255,255,255,0.07)",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <Text style={{ fontSize: 13, color: INK.soft }}>{short ? "Falta no mês" : "Sobra do mês"}</Text>
          <Text
            numberOfLines={1}
            style={[
              nums,
              {
                flexShrink: 1,
                fontSize: 18,
                fontWeight: "700",
                letterSpacing: -0.3,
                color: short ? RED : "#fff",
              },
            ]}
          >
            {money(Math.abs(balanco))}
          </Text>
        </View>
        <Text style={{ marginTop: 3, textAlign: "right", fontSize: 12, lineHeight: 16, color: INK.softer }}>
          {verdict}
        </Text>
      </View>
    </Surface>
  );
}

/** One of the two flows. */
function Flow({
  label,
  amount,
  scale,
  inflow,
  delay,
}: {
  label: string;
  amount: number;
  scale: number;
  inflow?: boolean;
  delay: number;
}) {
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <Text style={{ fontSize: 13.5, color: INK.soft }}>{label}</Text>
        <Text style={[nums, { fontSize: 14.5, fontWeight: "600", color: "#fff" }]}>
          {inflow ? "" : "−"}
          {money(amount)}
        </Text>
      </View>
      <View
        style={{
          marginTop: 7,
          height: 5,
          borderRadius: 999,
          backgroundColor: "rgba(255,255,255,0.06)",
          overflow: "hidden",
        }}
      >
        <Bar
          share={Math.max(amount / scale, amount > 0 ? 0.03 : 0)}
          color={inflow ? GREEN : RED}
          delay={delay}
        />
      </View>
    </View>
  );
}
