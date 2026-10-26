import { useMemo } from "react";
import { Platform, Text, View, type TextStyle } from "react-native";
import { useRouter } from "expo-router";
import type { FinanceEvent } from "@/types/finance";
import Surface from "~/components/Surface";
import { ChevronRight } from "~/components/icons";
import { dateOf, daysFrom, dueLabel, isIncome, isOverdue, monthShort, stillToHappen, upcoming } from "~/lib/events";
import { money } from "~/lib/money";
import { AMBER, GREEN, INK, RED } from "~/theme/tokens";
import { type as T } from "~/theme/type";

/**
 * What is coming next.
 *
 * The list leads, because the list is what you open the card for: the next three
 * things still to settle, each with its day on a small tile the way the phone's own
 * calendar draws one — white when it is today, tinted red when it is late — and
 * where it stands in plain words: "Vence hoje", "Recebe amanhã", "Atrasado há 6
 * dias". The verb carries the direction, so nothing needs a second label.
 *
 * The two totals sit at the foot at the size of a line, so a large month still fits
 * on one row instead of pushing the card wide. What is already paid has happened
 * and is not "próximo"; the whole month is one tap away.
 */

const SHOWN = 3;

const nums: TextStyle = Platform.select({
  ios: { fontVariant: ["tabular-nums"] },
  default: {},
}) as TextStyle;

export default function ProximosEventos({ events }: { events: FinanceEvent[] }) {
  const router = useRouter();
  const today = useMemo(() => new Date(), []);

  const next = useMemo(() => upcoming(events, today), [events, today]);
  const { aReceber, aPagar } = useMemo(() => stillToHappen(events), [events]);
  const shown = next.slice(0, SHOWN);

  return (
    <Surface onPress={() => router.push("/eventos")} style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={[T.cardLabel, { flex: 1 }]}>Próximos eventos</Text>
        {next.length > 0 && (
          <Text style={{ fontSize: 12.5, color: INK.softer }}>
            {next.length} {next.length === 1 ? "pendente" : "pendentes"}
          </Text>
        )}
        <ChevronRight size={16} color={INK.faint} />
      </View>

      {/* ══ The next few ══ */}
      <View style={{ marginTop: 12, gap: 12 }}>
        {shown.length === 0 ? (
          <Text style={{ paddingVertical: 8, fontSize: 14, color: INK.soft }}>
            {events.length === 0 ? "Nenhum evento neste mês." : "Tudo em dia. Nada mais para pagar ou receber."}
          </Text>
        ) : (
          shown.map((e) => {
            const late = isOverdue(e, today);
            return (
              <View key={e.id} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <DateTile date={dateOf(e)} isToday={daysFrom(e, today) === 0} late={late} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "500", color: "#fff" }}>
                    {e.name}
                  </Text>
                  <View style={{ marginTop: 2, flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: late ? RED : isIncome(e) ? GREEN : AMBER,
                      }}
                    />
                    <Text numberOfLines={1} style={{ fontSize: 12.5, color: late ? RED : INK.soft }}>
                      {dueLabel(e, today)}
                    </Text>
                  </View>
                </View>
                <Text numberOfLines={1} style={[nums, { flexShrink: 0, fontSize: 15, fontWeight: "600", color: "#fff" }]}>
                  {isIncome(e) ? "+" : ""}
                  {money(e.amount)}
                </Text>
              </View>
            );
          })
        )}
      </View>

      {/* ══ What is still to come in, and still to go out ══ */}
      <View
        style={{
          marginTop: 14,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: "rgba(255,255,255,0.07)",
          flexDirection: "row",
          gap: 12,
        }}
      >
        <Total dot={GREEN} label="A receber" value={aReceber} />
        <Total dot={AMBER} label="A pagar" value={aPagar} />
      </View>
    </Surface>
  );
}

/** The day, on a tile the way the phone's calendar draws one. */
function DateTile({ date, isToday, late }: { date: Date; isToday: boolean; late: boolean }) {
  const ground = isToday ? "#FFFFFF" : late ? "rgba(248,113,113,0.14)" : "rgba(255,255,255,0.07)";
  const ink = isToday ? "#0B0B0B" : late ? RED : "#fff";
  return (
    <View
      style={{
        width: 44,
        height: 46,
        borderRadius: 12,
        borderCurve: "continuous",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: ground,
      }}
    >
      <Text style={[nums, { fontSize: 17, fontWeight: "700", lineHeight: 19, color: ink }]}>{date.getDate()}</Text>
      <Text style={{ fontSize: 10.5, fontWeight: "600", color: isToday ? "rgba(11,11,11,0.6)" : INK.softer }}>
        {monthShort(date)}
      </Text>
    </View>
  );
}

/** One of the two totals at the foot. */
function Total({ dot, label, value }: { dot: string; label: string; value: number }) {
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dot }} />
        <Text style={{ fontSize: 12, color: INK.soft }}>{label}</Text>
      </View>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        style={[nums, { marginTop: 3, fontSize: 15.5, fontWeight: "600", color: "#fff" }]}
      >
        {money(value)}
      </Text>
    </View>
  );
}
