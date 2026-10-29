import { useMemo } from "react";
import { Platform, Text, View, type TextStyle } from "react-native";
import { useRouter } from "expo-router";
import type { FinanceEvent } from "@/types/finance";
import Surface from "~/components/Surface";
import { ChevronRight } from "~/components/icons";
import { dateOf, daysFrom, dueLabel, isIncome, isOverdue, monthShort, upcoming } from "~/lib/events";
import { money } from "~/lib/money";
import { AMBER, GREEN, INK, RED } from "~/theme/tokens";
import { type as T } from "~/theme/type";

/**
 * What is still to settle this month.
 *
 * Each event is a small card of its own inside the card — the day on a tile the way the
 * phone's calendar draws one (white when it is today, tinted red when it is late), what
 * it is, and where it stands in plain words: "Vence hoje", "Recebe amanhã", "Atrasado há
 * 6 dias". The verb says which way the money goes, and a small tag says it again, so
 * nothing needs a total.
 *
 * Only what is still pending is here. When the month has been settled there is nothing
 * to show, and the card is not drawn at all; it comes back with the next month's events.
 */

const SHOWN = 4;

const nums: TextStyle = Platform.select({
  ios: { fontVariant: ["tabular-nums"] },
  default: {},
}) as TextStyle;

export default function ProximosEventos({ events }: { events: FinanceEvent[] }) {
  const router = useRouter();
  const today = useMemo(() => new Date(), []);

  const next = useMemo(() => upcoming(events, today), [events, today]);
  if (next.length === 0) return null;

  const shown = next.slice(0, SHOWN);
  const rest = next.length - shown.length;

  return (
    <Surface onPress={() => router.push("/eventos")} style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={[T.cardLabel, { flex: 1 }]}>Próximos eventos</Text>
        <Text style={{ fontSize: 12.5, color: INK.softer }}>
          {next.length} {next.length === 1 ? "pendente" : "pendentes"}
        </Text>
        <ChevronRight size={16} color={INK.faint} />
      </View>

      <View style={{ marginTop: 12, gap: 8 }}>
        {shown.map((e) => {
          const late = isOverdue(e, today);
          const income = isIncome(e);
          const tone = late ? RED : income ? GREEN : AMBER;
          return (
            <View
              key={e.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                padding: 10,
                paddingRight: 14,
                borderRadius: 18,
                borderCurve: "continuous",
                borderWidth: 1,
                borderColor: late ? "rgba(248,113,113,0.22)" : "rgba(255,255,255,0.09)",
                backgroundColor: "rgba(255,255,255,0.05)",
              }}
            >
              <DateTile date={dateOf(e)} isToday={daysFrom(e, today) === 0} late={late} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "600", color: "#fff" }}>
                  {e.name}
                </Text>
                <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12.5, color: late ? RED : INK.soft }}>
                  {dueLabel(e, today)}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 4 }}>
                <Text numberOfLines={1} style={[nums, { flexShrink: 0, fontSize: 15, fontWeight: "700", color: "#fff" }]}>
                  {income ? "+" : ""}
                  {money(e.amount)}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tone }} />
                  <Text style={{ fontSize: 11.5, color: INK.softer }}>{income ? "A receber" : "A pagar"}</Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>

      {rest > 0 && (
        <Text style={{ marginTop: 12, textAlign: "center", fontSize: 13, fontWeight: "600", color: INK.soft }}>
          Ver mais {rest} {rest === 1 ? "evento" : "eventos"}
        </Text>
      )}
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
