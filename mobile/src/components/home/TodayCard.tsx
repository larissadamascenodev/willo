import { useMemo } from "react";
import { Platform, Text, View, type TextStyle } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import type { FinanceEvent } from "@/types/finance";
import Surface from "~/components/Surface";
import Bar from "~/components/Bar";
import { ChevronRight } from "~/components/icons";
import { daysFrom, isIncome, isSettled } from "~/lib/events";
import { money } from "~/lib/money";
import { useSpendable } from "~/lib/spendable";
import { GREEN, INK, RED } from "~/theme/tokens";
import { isLight, th } from "~/theme/theme";

/**
 * Hoje: the day, on the home, above the balance.
 *
 * On the left the date on a tile, lit from its foot like the phone's calendar widget. Beside
 * it what can be spent today — today's share of what the month leaves free, less what has gone
 * today — with a bar for how much of it is used, and what each day after can take. Under them,
 * what falls today: a bill due, money coming in. A touch opens the day's page.
 */

const nums: TextStyle = Platform.select({ ios: { fontVariant: ["tabular-nums"] }, default: {} }) as TextStyle;
const WEEK = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const SHOWN = 2;

export default function TodayCard({ events, hidden }: { events: FinanceEvent[]; hidden?: boolean }) {
  const router = useRouter();
  const s = useSpendable();
  const now = useMemo(() => new Date(), []);
  const show = (v: number) => (hidden ? "R$ •••" : money(v));

  const today = useMemo(() => events.filter((e) => !isSettled(e) && daysFrom(e, now) === 0), [events, now]);
  const over = s.free < 0;
  const used = s.today > 0 ? Math.min(1, Math.max(0, s.spentToday / s.today)) : over ? 1 : 0;
  const left = Math.max(0, s.leftToday);

  const title = over ? "Mês acima do orçamento" : s.leftToday >= 0 ? "Dá para gastar hoje" : "Hoje passou do previsto";
  const figure = over ? show(-s.free) : s.leftToday >= 0 ? show(left) : show(-s.leftToday);
  const tone = over || s.leftToday < 0 ? RED : GREEN;
  const note = over
    ? "As contas do mês passam do que entra."
    : s.daysLeft > 1
      ? `Depois, ${show(s.tomorrow)} por dia até o fim do mês`
      : "Hoje fecha o mês: o que sobrar fica para o próximo.";

  return (
    <Surface onPress={() => router.push("/resumo" as never)} radius={26} style={{ padding: 14 }}>
      <View style={{ flexDirection: "row", gap: 14, opacity: s.loading ? 0.6 : 1 }}>
        {/* The date, lit from its foot. */}
        <View style={{ width: 74, borderRadius: 18, borderCurve: "continuous", overflow: "hidden", backgroundColor: isLight() ? "#15151A" : "#050507" }}>
          <LinearGradient
            colors={["rgba(5,5,7,0)", "rgba(76,92,255,0.35)", "rgba(140,160,255,0.95)"]}
            locations={[0.35, 0.78, 1]}
            style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
          />
          <View style={{ flex: 1, paddingHorizontal: 10, paddingTop: 10, paddingBottom: 9, justifyContent: "space-between" }}>
            <Text style={[nums, { fontSize: 30, fontWeight: "800", letterSpacing: -1, color: "#fff" }]}>{now.getDate()}</Text>
            <View>
              <Text style={{ fontSize: 12.5, fontWeight: "700", color: "#fff" }}>{WEEK[now.getDay()].slice(0, 3)}</Text>
              <Text style={{ fontSize: 11.5, fontWeight: "600", color: "rgba(255,255,255,0.82)" }}>{MONTHS[now.getMonth()]}</Text>
            </View>
          </View>
        </View>

        {/* What can be spent today. */}
        <View style={{ flex: 1, minWidth: 0, paddingVertical: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <Text style={{ fontSize: 11.5, fontWeight: "700", letterSpacing: 1.4, color: th(INK.softer) }}>HOJE</Text>
            <ChevronRight size={16} color={th(INK.faint)} />
          </View>
          <Text numberOfLines={1} style={{ marginTop: 4, fontSize: 13.5, color: th(INK.soft) }}>
            {title}
          </Text>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[nums, { marginTop: 1, fontSize: 28, fontWeight: "800", letterSpacing: -0.9, color: th(tone === RED ? RED : "#fff") }]}>
            {figure}
          </Text>
          <View style={{ marginTop: 8, height: 5, borderRadius: 999, overflow: "hidden", backgroundColor: th("rgba(255,255,255,0.08)", "bg") }}>
            <Bar share={Math.max(used, used > 0 ? 0.03 : 0)} color={tone} />
          </View>
          <Text numberOfLines={1} style={[nums, { marginTop: 7, fontSize: 12, color: th(INK.softer) }]}>
            {note}
          </Text>
        </View>
      </View>

      {/* What falls today. */}
      <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: th("rgba(255,255,255,0.07)", "line"), gap: 8 }}>
        {today.length === 0 ? (
          <Text style={{ fontSize: 13, color: th(INK.softer) }}>Nada vence nem entra hoje.</Text>
        ) : (
          <>
            {today.slice(0, SHOWN).map((e) => {
              const income = isIncome(e);
              const c = income ? GREEN : "#F9CE4E";
              return (
                <View key={e.id} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ width: 3, height: 30, borderRadius: 2, backgroundColor: th(c, "bg") }} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: "600", color: th("#fff") }}>
                      {e.name}
                    </Text>
                    <Text style={{ fontSize: 12, color: th(INK.softer) }}>{income ? "Entra hoje" : "Vence hoje"}</Text>
                  </View>
                  <Text numberOfLines={1} style={[nums, { fontSize: 14.5, fontWeight: "700", color: th(income ? GREEN : "#fff") }]}>
                    {income ? "+" : ""}
                    {show(e.amount)}
                  </Text>
                </View>
              );
            })}
            {today.length > SHOWN && <Text style={{ fontSize: 12.5, color: th(INK.softer) }}>{`E mais ${today.length - SHOWN} hoje`}</Text>}
          </>
        )}
      </View>
    </Surface>
  );
}
