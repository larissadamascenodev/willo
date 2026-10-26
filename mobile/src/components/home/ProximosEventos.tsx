import { useMemo } from "react";
import { Platform, Text, View, type TextStyle } from "react-native";
import { useRouter } from "expo-router";
import type { FinanceEvent } from "@/types/finance";
import Surface from "~/components/Surface";
import { ChevronRight } from "~/components/icons";
import {
  dateOf,
  isIncome,
  isOverdue,
  monthShort,
  stillToHappen,
  upcoming,
  whenLabel,
} from "~/lib/events";
import { money } from "~/lib/money";
import { AMBER, GREEN, INK, RED } from "~/theme/tokens";
import { type as T } from "~/theme/type";

/**
 * What is still to come this month.
 *
 * Two figures first — what is still to come in and what is still to go out —
 * because that is the question the card exists for: is the money there for what is
 * coming. Under them the next three things still to settle, each with its day in a
 * small calendar block and how far away it is in words, the overdue ones first and
 * in red, the only red on the card. What has already been paid has happened and is
 * not "próximo", so it is not here; the whole month is one tap away.
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
  const rest = next.length - shown.length;

  return (
    <Surface onPress={() => router.push("/eventos")} style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Text style={[T.cardLabel, { flex: 1 }]}>Próximos eventos</Text>
        <ChevronRight size={16} color={INK.faint} />
      </View>

      {/* ══ What is still to come in, and still to go out ══ */}
      <View style={{ marginTop: 12, flexDirection: "row", gap: 16 }}>
        <Figure dot={GREEN} label="A receber" value={money(aReceber)} />
        <Figure dot={AMBER} label="A pagar" value={money(aPagar)} />
      </View>

      {/* ══ The next few ══ */}
      <View style={{ marginTop: 14 }}>
        {shown.length === 0 ? (
          <Text
            style={{
              paddingVertical: 18,
              borderTopWidth: 1,
              borderTopColor: "rgba(255,255,255,0.07)",
              fontSize: 13.5,
              color: INK.soft,
            }}
          >
            {events.length === 0 ? "Nenhum evento neste mês." : "Tudo em dia. Nada mais para pagar ou receber este mês."}
          </Text>
        ) : (
          shown.map((e) => {
            const d = dateOf(e);
            const late = isOverdue(e, today);
            return (
              <View
                key={e.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingVertical: 11,
                  borderTopWidth: 1,
                  borderTopColor: "rgba(255,255,255,0.07)",
                }}
              >
                {/* The day, as a calendar would show it. */}
                <View style={{ width: 38, alignItems: "center" }}>
                  <Text style={[nums, { fontSize: 18, fontWeight: "700", lineHeight: 20, color: late ? RED : "#fff" }]}>
                    {d.getDate()}
                  </Text>
                  <Text style={{ fontSize: 10.5, fontWeight: "600", color: INK.softer }}>{monthShort(d)}</Text>
                </View>

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
                    <Text numberOfLines={1} style={{ fontSize: 12, color: late ? RED : INK.soft }}>
                      {isIncome(e) ? "a receber" : "a pagar"}, {whenLabel(e, today)}
                    </Text>
                  </View>
                </View>

                <Text style={[nums, { fontSize: 15, fontWeight: "600", color: "#fff" }]}>
                  {isIncome(e) ? "+" : ""}
                  {money(e.amount)}
                </Text>
              </View>
            );
          })
        )}

        {rest > 0 && (
          <Text
            style={{
              paddingVertical: 12,
              borderTopWidth: 1,
              borderTopColor: "rgba(255,255,255,0.07)",
              fontSize: 13,
              color: INK.soft,
            }}
          >
            E mais {rest} {rest === 1 ? "evento" : "eventos"} neste mês
          </Text>
        )}
      </View>
    </Surface>
  );
}

function Figure({ dot, label, value }: { dot: string; label: string; value: string }) {
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: dot }} />
        <Text style={{ fontSize: 12.5, color: INK.soft }}>{label}</Text>
      </View>
      <Text numberOfLines={1} style={[nums, { marginTop: 4, fontSize: 20, fontWeight: "700", letterSpacing: -0.5, color: "#fff" }]}>
        {value}
      </Text>
    </View>
  );
}
