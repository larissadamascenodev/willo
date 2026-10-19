import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useFinanceData } from "@/hooks/useFinanceData";
import { categoryHex } from "@/lib/categoryData";
import type { FinanceEvent } from "@/types/finance";
import Room from "~/components/Room";
import BackButton from "~/components/BackButton";
import Surface from "~/components/Surface";
import { CalendarClock, ChevronLeft, ChevronRight, Clock } from "~/components/icons";
import { categoryIcon } from "~/lib/categoryIcon";
import { chipFill, chipInk } from "~/lib/chip";
import { money } from "~/lib/money";
import { GREEN, INK, RED } from "~/theme/tokens";
import { type as T } from "~/theme/type";

/**
 * What is coming, on a calendar and in order.
 *
 * The home screen can only show the next two or three; the question underneath them
 * — "is the money there when they land" — needs the whole month at once. So the
 * month is drawn as a month, each day marked with what falls on it, and under it the
 * same days written out, because a dot tells you something is there and a line tells
 * you what.
 */

const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];
const DAY_NAMES = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const isIncome = (e: FinanceEvent) => e.type === "receita" || e.status === "recebido";
const dayOf = (e: FinanceEvent) => Number((e.rawDate ?? "").slice(8, 10)) || 0;

export default function Eventos() {
  const insets = useSafeAreaInsets();
  const today = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [picked, setPicked] = useState<number | null>(null);

  const { data, loading } = useFinanceData(month, year);

  const events = useMemo(
    () => [...data.events].sort((a, b) => dayOf(a) - dayOf(b)),
    [data.events],
  );

  const pending = events.filter((e) => e.status !== "pago" && e.status !== "recebido");
  const aReceber = pending.filter(isIncome).reduce((s, e) => s + e.amount, 0);
  const aPagar = pending.filter((e) => !isIncome(e)).reduce((s, e) => s + e.amount, 0);

  /** Every day of the month, with what lands on it. */
  const grid = useMemo(() => {
    const first = new Date(year, month, 1);
    const days = new Date(year, month + 1, 0).getDate();
    const byDay = new Map<number, FinanceEvent[]>();
    for (const e of events) {
      const d = dayOf(e);
      if (!d) continue;
      byDay.set(d, [...(byDay.get(d) ?? []), e]);
    }
    return {
      lead: first.getDay(),
      byDay,
      cells: Array.from({ length: days }, (_, i) => i + 1),
    };
  }, [events, month, year]);

  const shown = picked ? events.filter((e) => dayOf(e) === picked) : events;

  const groups = useMemo(() => {
    const map = new Map<number, FinanceEvent[]>();
    for (const e of shown) {
      const d = dayOf(e);
      map.set(d, [...(map.get(d) ?? []), e]);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [shown]);

  const step = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setMonth(d.getMonth());
    setYear(d.getFullYear());
    setPicked(null);
  };

  const isThisMonth = month === today.getMonth() && year === today.getFullYear();
  const net = aReceber - aPagar;

  return (
    <Room>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ height: 44, justifyContent: "center" }}>
          <BackButton to="/" />
        </View>

        <View
          style={{
            marginTop: 8,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            paddingHorizontal: 4,
          }}
        >
          <Text style={T.title}>Próximos eventos</Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: INK.edge,
              backgroundColor: "rgba(255,255,255,0.046)",
              padding: 4,
            }}
          >
            <Pressable
              onPress={() => step(-1)}
              accessibilityLabel="Mês anterior"
              style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" }}
            >
              <ChevronLeft size={16} color="rgba(255,255,255,0.7)" />
            </Pressable>
            <Pressable
              onPress={() => step(1)}
              accessibilityLabel="Próximo mês"
              style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" }}
            >
              <ChevronRight size={16} color="rgba(255,255,255,0.7)" />
            </Pressable>
          </View>
        </View>

        {/* What the month still owes and still brings. */}
        <Animated.View
          entering={FadeInDown.duration(400)}
          style={{ marginTop: 20, flexDirection: "row", gap: 16, paddingHorizontal: 4 }}
        >
          <View style={{ flex: 1 }}>
            <Text style={T.eyebrow}>A receber</Text>
            <Text numberOfLines={1} style={{ marginTop: 4, fontSize: 24, fontWeight: "800", letterSpacing: -0.8, color: GREEN }}>
              {money(aReceber)}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={T.eyebrow}>A pagar</Text>
            <Text numberOfLines={1} style={{ marginTop: 4, fontSize: 24, fontWeight: "800", letterSpacing: -0.8, color: RED }}>
              {money(aPagar)}
            </Text>
          </View>
        </Animated.View>

        <Text style={{ marginTop: 10, paddingHorizontal: 4, fontSize: 12.5, color: INK.soft }}>
          {MONTHS[month]} de {year}
          <Text style={{ color: "rgba(255,255,255,0.2)" }}> · </Text>
          {pending.length === 0
            ? "nada pendente"
            : `${pending.length} ${pending.length === 1 ? "pendência" : "pendências"}`}
          {net !== 0 ? (
            <Text>
              <Text style={{ color: "rgba(255,255,255,0.2)" }}> · </Text>
              saldo {net > 0 ? "+" : "−"}
              {money(Math.abs(net))}
            </Text>
          ) : null}
        </Text>

        {/* ══ The month as a month ══ */}
        <Animated.View entering={FadeInDown.delay(70).duration(420)}>
        <Surface radius={24} style={{ marginTop: 20, padding: 16 }}>
          <View style={{ flexDirection: "row", marginBottom: 8 }}>
            {WEEKDAYS.map((d, i) => (
              <Text
                key={i}
                style={{ flex: 1, textAlign: "center", fontSize: 10.5, fontWeight: "600", color: INK.faint }}
              >
                {d}
              </Text>
            ))}
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {Array.from({ length: grid.lead }, (_, i) => (
              <View key={`lead${i}`} style={{ width: `${100 / 7}%`, height: 44 }} />
            ))}
            {grid.cells.map((d) => {
              const list = grid.byDay.get(d) ?? [];
              const isToday = isThisMonth && d === today.getDate();
              const selected = picked === d;
              const hasIn = list.some(isIncome);
              const hasOut = list.some((e) => !isIncome(e));
              return (
                <View key={d} style={{ width: `${100 / 7}%`, height: 44, padding: 2 }}>
                  <Pressable
                    onPress={() => setPicked(selected ? null : list.length ? d : null)}
                    style={{
                      flex: 1,
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 3,
                      borderRadius: 12,
                      backgroundColor: selected
                        ? "#fff"
                        : list.length
                          ? "rgba(255,255,255,0.05)"
                          : "transparent",
                      borderWidth: isToday && !selected ? 1 : 0,
                      borderColor: "rgba(255,255,255,0.4)",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12.5,
                        fontWeight: "600",
                        color: selected ? "#0B0B0B" : list.length ? "#fff" : "rgba(255,255,255,0.35)",
                      }}
                    >
                      {d}
                    </Text>
                    <View style={{ flexDirection: "row", gap: 3, height: 6, alignItems: "center" }}>
                      {hasIn && (
                        <View
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: selected ? "#0B0B0B" : GREEN,
                          }}
                        />
                      )}
                      {hasOut && (
                        <View
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: selected ? "rgba(11,11,11,0.6)" : RED,
                          }}
                        />
                      )}
                    </View>
                  </Pressable>
                </View>
              );
            })}
          </View>

          {picked && (
            <Pressable
              onPress={() => setPicked(null)}
              style={({ pressed }) => ({
                marginTop: 12,
                height: 38,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 999,
                borderWidth: 1,
                borderColor: INK.edge,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ fontSize: 12.5, fontWeight: "600", color: "rgba(255,255,255,0.75)" }}>
                Ver o mês inteiro
              </Text>
            </Pressable>
          )}
        </Surface>
        </Animated.View>

        {/* ══ The same days, written out ══ */}
        <View style={{ marginTop: 20, gap: 20 }}>
          {loading && events.length === 0 ? (
            <Surface style={{ height: 160 }}><View /></Surface>
          ) : groups.length === 0 ? (
            <View
              style={{
                borderRadius: 22,
                borderWidth: 1,
                borderStyle: "dashed",
                borderColor: "rgba(255,255,255,0.09)",
                paddingHorizontal: 16,
                paddingVertical: 40,
                alignItems: "center",
              }}
            >
              <CalendarClock size={24} color={INK.faint} />
              <Text style={{ marginTop: 8, fontSize: 13.5, color: INK.soft }}>
                Nada marcado para {MONTHS[month]}
              </Text>
            </View>
          ) : (
            groups.map(([day, list]) => {
              const date = new Date(year, month, day);
              const isToday = isThisMonth && day === today.getDate();
              const dayNet = list.reduce((s, e) => s + (isIncome(e) ? e.amount : -e.amount), 0);
              return (
                <View key={day}>
                  <View
                    style={{
                      marginBottom: 6,
                      flexDirection: "row",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                      gap: 12,
                      paddingHorizontal: 4,
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: 10.5,
                        fontWeight: "600",
                        letterSpacing: 1.5,
                        textTransform: "uppercase",
                        color: isToday ? "#fff" : INK.softer,
                      }}
                    >
                      {isToday ? "Hoje · " : ""}
                      {DAY_NAMES[date.getDay()]}, {day} de {MONTHS[month].slice(0, 3)}
                    </Text>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: dayNet >= 0 ? GREEN : INK.softer }}>
                      {dayNet >= 0 ? "+" : "−"}
                      {money(Math.abs(dayNet))}
                    </Text>
                  </View>

                  {list.map((e, i) => {
                    const income = isIncome(e);
                    const paid = e.status === "pago" || e.status === "recebido";
                    const hex = categoryHex(e.category);
                    const Icon = categoryIcon(e.category);
                    return (
                      <Animated.View
                        key={e.id}
                        entering={FadeInDown.delay(i * 30).duration(260)}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 14,
                          paddingHorizontal: 4,
                          paddingVertical: 14,
                          borderTopWidth: i > 0 ? 1 : 0,
                          borderTopColor: "rgba(255,255,255,0.055)",
                        }}
                      >
                        <View
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 22,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: chipFill(hex),
                          }}
                        >
                          <Icon size={18} color={chipInk(hex)} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text numberOfLines={1} style={T.rowName}>
                            {e.name}
                          </Text>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            {!paid && <Clock size={12} color="#F9CE4E" />}
                            <Text numberOfLines={1} style={{ fontSize: 12, color: INK.softer }}>
                              {paid ? (income ? "Recebido" : "Pago") : income ? "A receber" : "Pendente"}
                              <Text style={{ color: "rgba(255,255,255,0.2)" }}> · </Text>
                              {e.category}
                            </Text>
                          </View>
                        </View>
                        <Text style={[T.rowValue, income && { color: GREEN }]}>
                          {income ? "+" : "−"}
                          {money(e.amount)}
                        </Text>
                      </Animated.View>
                    );
                  })}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </Room>
  );
}
