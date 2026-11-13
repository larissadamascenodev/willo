import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import Surface from "~/components/Surface";
import { ChevronRight } from "~/components/icons";
import { useSpendable } from "~/lib/spendable";
import { money } from "~/lib/money";
import { AMBER, GREEN, INK } from "~/theme/tokens";
import { th } from "~/theme/theme";

/**
 * One thin line under the balance: what can still be spent today, and what that does to
 * tomorrow. A tap opens the month's whole picture.
 */
export default function SpendTodayCard() {
  const router = useRouter();
  const s = useSpendable();
  if (s.loading && s.today === 0) return <Surface style={{ height: 64 }}>{null}</Surface>;

  const over = s.leftToday < 0;
  const tight = s.free <= 0;
  const shown = tight ? 0 : Math.max(0, s.leftToday);
  const used = s.today > 0 ? Math.min(1, s.spentToday / s.today) : tight ? 1 : 0;
  const line = tight
    ? "O mês já está no limite. Cada gasto agora sai da sobra."
    : over
      ? `Passou ${money(-s.leftToday)} do de hoje · amanhã ${money(s.tomorrow)}/dia`
      : s.spentToday > 0
        ? `Já gastou ${money(s.spentToday)} · amanhã ${money(s.tomorrow)}/dia`
        : `Gastando menos hoje, amanhã sobra mais`;
  const tone = tight || over ? AMBER : INK.soft;

  return (
    <Surface onPress={() => router.push("/resumo" as never)} style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 12.5, color: th(INK.soft) }}>Hoje dá para gastar</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ marginTop: 1, fontSize: 21, fontWeight: "800", letterSpacing: -0.6, color: th(tight || over ? AMBER : "#fff"), fontVariant: ["tabular-nums"] }}>
            {money(shown)}
          </Text>
        </View>
        <ChevronRight size={16} color={th(INK.faint)} />
      </View>
      {/* Today's share, filling as it is spent. */}
      <View style={{ marginTop: 9, height: 4, borderRadius: 2, backgroundColor: th("rgba(255,255,255,0.08)", "bg") }}>
        <View style={{ width: `${Math.round(used * 100)}%`, height: 4, borderRadius: 2, backgroundColor: th(over || tight ? AMBER : GREEN, "bg") }} />
      </View>
      <Text numberOfLines={1} style={{ marginTop: 7, fontSize: 12, fontWeight: over || tight ? "600" : "400", color: th(tone) }}>
        {line}
      </Text>
    </Surface>
  );
}
