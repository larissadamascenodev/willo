import { Platform, Text, View, type TextStyle } from "react-native";
import { useRouter } from "expo-router";
import Surface from "~/components/Surface";
import Bar from "~/components/Bar";
import { ChevronRight } from "~/components/icons";
import { money } from "~/lib/money";
import { GREEN, INK } from "~/theme/tokens";
import { type as T } from "~/theme/type";

import { th } from "~/theme/theme";
/* The red of money going out, at full strength: the softer one reads grey on the dark. */
const LIVE_RED = "#FF4D4D";

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
 * Called Fluxo de caixa: only money that came into and went out of the accounts (a card
 * purchase counts when its invoice is paid). The balance is on its own page, a touch away.
 *
 * Colour is in the bars only. The figures are white, the outgoing one carrying its
 * minus sign in red.
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
  const scale = Math.max(receitas, despesas, 1);

  return (
    <Surface
      onPress={() => router.push("/fluxo-de-caixa" as never)}
      style={{ paddingHorizontal: 18, paddingTop: 16, paddingBottom: 18 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Text numberOfLines={1} style={[T.cardLabel, { flex: 1 }]}>
          Fluxo de caixa <Text style={{ color: th(INK.faint) }}>·</Text> {isCurrentMonth ? "este mês" : "no mês"}
        </Text>
        <ChevronRight size={16} color={th(INK.faint)} />
      </View>

      <View style={{ marginTop: 16, gap: 16 }}>
        <Flow label="Entrada" amount={receitas} scale={scale} inflow delay={0.05} />
        <Flow label="Saída" amount={despesas} scale={scale} delay={0.12} />
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
        <Text style={{ fontSize: 17, fontWeight: "700", letterSpacing: -0.2, color: th("#fff") }}>{label}</Text>
        <Text style={[nums, { fontSize: 16, fontWeight: "700", letterSpacing: -0.3, color: th(inflow ? "#fff" : LIVE_RED) }]}>
          {inflow ? "" : "−"}
          {money(amount)}
        </Text>
      </View>
      <View style={{ marginTop: 10, height: 7, borderRadius: 999, backgroundColor: th("rgba(255,255,255,0.06)", "bg"), overflow: "hidden" }}>
        <Bar share={Math.max(amount / scale, amount > 0 ? 0.03 : 0)} color={inflow ? GREEN : LIVE_RED} delay={delay} />
      </View>
    </View>
  );
}
