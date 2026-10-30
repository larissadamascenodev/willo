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

/**
 * The month as the two flows that make it.
 *
 * The two bars come first, straight under the title, because they are what the
 * card is: both on one scale, so their lengths answer which side is bigger before
 * a figure is read.
 *
 * What is left over closes the card as one row of a statement: its name on the
 * left with the sentence the bars cannot draw under it — two near-equal lengths look
 * fine until you are told they are 96% — and the figure on the right, centred on
 * the pair. The figure is one step larger than the rows above, enough to read as
 * the result and no more, because the balance in the accounts is the headline of
 * the home and should not have a rival one card below.
 *
 * Colour is in the bars only. The figures are white, the outgoing one carrying its
 * minus sign; the leftover turns red only when the month falls short.
 *
 * The whole card is one way in, to the cash-flow screen.
 */
export default function FluxoCard({
  receitas,
  despesas,
  isCurrentMonth = true,
}: {
  receitas: number;
  despesas: number;
  /** Kept for the callers; the title says which month, so the card no longer names it. */
  month?: number;
  isCurrentMonth?: boolean;
}) {
  const router = useRouter();
  const balanco = receitas - despesas;
  const pct = receitas > 0 ? Math.round((despesas / receitas) * 100) : 0;
  const scale = Math.max(receitas, despesas, 1);

  const verdict =
    receitas <= 0 && despesas <= 0
      ? "Nada entrou nem saiu ainda"
      : receitas <= 0
        ? "Saiu dinheiro sem nenhuma entrada"
        : balanco < 0
          ? "Você gastou mais do que entrou"
          : `Você gastou ${pct}% do que entrou`;

  const short = balanco < 0;

  return (
    <Surface
      onPress={() => router.push("/fluxo-de-caixa" as never)}
      style={{ paddingHorizontal: 18, paddingTop: 16, paddingBottom: 18 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Text numberOfLines={1} style={[T.cardLabel, { flex: 1 }]}>
          Receitas e despesas <Text style={{ color: INK.faint }}>·</Text>{" "}
          {isCurrentMonth ? "este mês" : "no mês"}
        </Text>
        <ChevronRight size={16} color={INK.faint} />
      </View>

      <View style={{ marginTop: 16, gap: 16 }}>
        <Flow label="Entrada" amount={receitas} scale={scale} inflow delay={0.05} />
        <Flow label="Saída" amount={despesas} scale={scale} delay={0.12} />
      </View>

      {/* What is left of the month, as the last line of a statement. */}
      <View
        style={{
          marginTop: 18,
          paddingTop: 16,
          borderTopWidth: 1,
          borderTopColor: "rgba(255,255,255,0.07)",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <Text style={{ fontSize: 17, fontWeight: "700", letterSpacing: -0.2, color: "#fff" }}>Fluxo de caixa</Text>
        <Text numberOfLines={1} style={[nums, { flexShrink: 0, fontSize: 17, fontWeight: "500", color: short ? RED : "#fff" }]}>
          {short ? "−" : ""}
          {money(Math.abs(balanco))}
        </Text>
      </View>
    </Surface>
  );
}

/** One of the two flows: its name in bold, the figure plain, and a thick bar under them. */
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
        <Text style={{ fontSize: 17, fontWeight: "700", letterSpacing: -0.2, color: "#fff" }}>{label}</Text>
        <Text style={[nums, { fontSize: 16, fontWeight: "400", color: inflow ? "#fff" : RED }]}>
          {inflow ? "" : "−"}
          {money(amount)}
        </Text>
      </View>
      <View style={{ marginTop: 10, height: 10, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
        <Bar share={Math.max(amount / scale, amount > 0 ? 0.03 : 0)} color={inflow ? GREEN : RED} delay={delay} />
      </View>
    </View>
  );
}
