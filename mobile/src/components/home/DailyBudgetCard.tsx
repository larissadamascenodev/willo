import { Platform, Text, View, type TextStyle } from "react-native";
import { useRouter } from "expo-router";
import Svg, { Circle } from "react-native-svg";
import Surface from "~/components/Surface";
import { useSpendable } from "~/lib/spendable";
import { money } from "~/lib/money";
import { GREEN, INK, RED } from "~/theme/tokens";
import { th } from "~/theme/theme";

/**
 * What can be spent today, under the balance.
 *
 * A ring of today's share — how much of it is already gone — and, beside it, the day in
 * a sentence: what is left for today, and what each day until the month ends can take.
 * When the month's bills already pass what comes in, it says by how much, in red.
 */

const nums: TextStyle = Platform.select({ ios: { fontVariant: ["tabular-nums"] }, default: {} }) as TextStyle;
const SIZE = 64;
const STROKE = 6;

export default function DailyBudgetCard({ hidden }: { hidden?: boolean }) {
  const router = useRouter();
  const s = useSpendable();
  const over = s.free < 0;
  const used = s.today > 0 ? Math.min(1, Math.max(0, s.spentToday / s.today)) : over ? 1 : 0;
  const pct = Math.round(used * 100);
  const tone = over || s.leftToday < 0 ? RED : GREEN;

  const r = (SIZE - STROKE) / 2;
  const c = 2 * Math.PI * r;
  const show = (v: number) => (hidden ? "R$ •••" : money(v));

  const title = over
    ? `Orçamento do mês excedido em ${show(-s.free)}`
    : s.leftToday >= 0
      ? `${show(s.leftToday)} livres para hoje`
      : `Hoje passou ${show(-s.leftToday)} da conta do dia`;
  const sub = over
    ? "As contas do mês passam do que entra. Toque para ver onde ajustar."
    : s.daysLeft > 1
      ? `${show(s.tomorrow)} por dia até o fim do mês · ${s.daysLeft - 1} ${s.daysLeft - 1 === 1 ? "dia" : "dias"}`
      : "Hoje fecha o mês: o que sobrar fica para o próximo.";

  return (
    <Surface onPress={() => router.push("/resumo" as never)} radius={26} style={{ paddingHorizontal: 16, paddingVertical: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16, opacity: s.loading ? 0.5 : 1 }}>
        <View style={{ width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" }}>
          <Svg width={SIZE} height={SIZE} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
            <Circle cx={SIZE / 2} cy={SIZE / 2} r={r} stroke={th("rgba(255,255,255,0.12)", "line")} strokeWidth={STROKE} fill="none" />
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={r}
              stroke={th(tone)}
              strokeWidth={STROKE}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${c} ${c}`}
              strokeDashoffset={c * (1 - Math.max(used, 0.02))}
            />
          </Svg>
          <Text style={[nums, { fontSize: 15, fontWeight: "700", color: th("#fff") }]}>{pct}%</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={2} style={[nums, { fontSize: 18, fontWeight: "700", letterSpacing: -0.3, color: th("#fff") }]}>
            {title}
          </Text>
          <Text numberOfLines={2} style={[nums, { marginTop: 4, fontSize: 14, lineHeight: 19, color: th(INK.soft) }]}>
            {sub}
          </Text>
        </View>
      </View>
    </Surface>
  );
}
