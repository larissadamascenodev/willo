import { useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, Text, View, type TextStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn } from "react-native-reanimated";
import { useMonth } from "@/contexts/MonthContext";
import { useFinanceData } from "@/hooks/useFinanceData";
import { categoryHex } from "@/lib/categoryData";
import type { FinanceEvent } from "@/types/finance";
import Room from "~/components/Room";
import BackButton from "~/components/BackButton";
import Glass from "~/components/Glass";
import Surface from "~/components/Surface";
import SegmentedTabs from "~/components/SegmentedTabs";
import MonthCalendar from "~/components/eventos/MonthCalendar";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "~/components/icons";
import { categoryIcon } from "~/lib/categoryIcon";
import { chipFill, chipInk } from "~/lib/chip";
import {
  dateOf,
  dayOfMonth,
  daysFrom,
  dueLabel,
  isIncome,
  isOverdue,
  isSettled,
  monthShort,
  stillToHappen,
  weekdayShort,
} from "~/lib/events";
import { money } from "~/lib/money";
import { useAuth } from "~/lib/auth";
import { AMBER, GREEN, INK, RED } from "~/theme/tokens";
import { type as T } from "~/theme/type";

/**
 * What is still to come this month — and whether the money is there when it does.
 *
 * It opens on the two figures side by side — what is still to come in, what is
 * still to go out — each in its own half of one card with a hairline between them,
 * set at a size that leaves a long amount room and shrinks it rather than letting
 * it run into its neighbour. Under them, across the card, the balance the month
 * ends on if all of it happens.
 *
 * Then one switch, Todos, A pagar or A receber, which narrows both the month and
 * the list beneath it; the month drawn as a month, each day carrying a dot for what
 * falls on it; and the list in the order things need doing — late first, then what
 * is coming day by day, and last what has been paid, folded away. Each line says
 * where it stands in plain words: "Vence hoje", "Recebe amanhã", "Atrasado há 6
 * dias".
 */

const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

type Kind = "todos" | "pagar" | "receber";

const RULE = "rgba(255,255,255,0.08)";

const nums: TextStyle = Platform.select({
  ios: { fontVariant: ["tabular-nums"] },
  default: {},
}) as TextStyle;

const capitalise = (s: string) => s.charAt(0).toLocaleUpperCase("pt-BR") + s.slice(1);

export default function Eventos() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { selectedMonth: month, selectedYear: year, setMonth } = useMonth();
  const [day, setDay] = useState<number | null>(null);
  const [kind, setKind] = useState<Kind>("todos");
  const [showSettled, setShowSettled] = useState(false);
  const today = useMemo(() => new Date(), []);

  const { data, loading } = useFinanceData(month, year);

  const all = useMemo(
    () => [...data.events].sort((a, b) => dateOf(a).getTime() - dateOf(b).getTime()),
    [data.events],
  );
  const { aReceber, aPagar } = useMemo(() => stillToHappen(all), [all]);

  /* The switch narrows the month and the list; the statement above stays whole. */
  const events = useMemo(
    () => (kind === "todos" ? all : all.filter((e) => (kind === "receber" ? isIncome(e) : !isIncome(e)))),
    [all, kind],
  );

  const late = events.filter((e) => isOverdue(e, today));
  const coming = events.filter((e) => !isSettled(e) && !isOverdue(e, today));
  const settled = events.filter(isSettled);
  const onDay = day === null ? [] : events.filter((e) => dayOfMonth(e) === day);

  const comingByDay = useMemo(() => {
    const map = new Map<string, FinanceEvent[]>();
    for (const e of coming) {
      const key = (e.rawDate || e.date).slice(0, 10);
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return [...map.entries()];
  }, [coming]);

  const step = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setMonth(d.getMonth(), d.getFullYear());
    setDay(null);
    setShowSettled(false);
  };

  const isPastMonth = year < today.getFullYear() || (year === today.getFullYear() && month < today.getMonth());
  const ending = data.saldoPrevisto;
  const waiting = loading && !!user;
  const nothing = kind === "receber" ? "Nada a receber" : kind === "pagar" ? "Nada a pagar" : "Nada marcado";

  return (
    /* The sky behind, as on the home and the wallet. */
    <Room lit sky>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ══ The way out, and which month ══ */}
        <View style={{ height: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <BackButton to="/" />
          <Glass interactive style={{ flexDirection: "row", alignItems: "center", padding: 3 }}>
            <Pressable
              accessibilityLabel="Mês anterior"
              onPress={() => step(-1)}
              hitSlop={6}
              style={({ pressed }) => ({
                width: 34,
                height: 34,
                borderRadius: 17,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.5 : 1,
              })}
            >
              <ChevronLeft size={17} color="#fff" />
            </Pressable>
            <Text style={{ minWidth: 84, textAlign: "center", fontSize: 14, fontWeight: "600", color: "#fff" }}>
              {capitalise(MONTHS[month])}
              {year !== today.getFullYear() ? ` ${String(year).slice(2)}` : ""}
            </Text>
            <Pressable
              accessibilityLabel="Próximo mês"
              onPress={() => step(1)}
              hitSlop={6}
              style={({ pressed }) => ({
                width: 34,
                height: 34,
                borderRadius: 17,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.5 : 1,
              })}
            >
              <ChevronRight size={17} color="#fff" />
            </Pressable>
          </Glass>
        </View>

        <Text style={[T.title, { marginTop: 14, paddingHorizontal: 4 }]}>Próximos eventos</Text>

        {/* ══ The month in three lines ══ */}
        <Surface radius={22} style={{ marginTop: 18 }}>
          <View style={{ flexDirection: "row" }}>
            <Figure dot={GREEN} label="A receber" value={waiting ? null : money(aReceber)} />
            <View style={{ width: 1, marginVertical: 14, backgroundColor: RULE }} />
            <Figure dot={AMBER} label="A pagar" value={waiting ? null : money(aPagar)} />
          </View>
          <View
            style={{
              marginHorizontal: 16,
              paddingVertical: 12,
              borderTopWidth: 1,
              borderTopColor: RULE,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: INK.soft }}>
              {isPastMonth ? `Saldo no fim de ${MONTHS[month]}` : `Se tudo acontecer, fim de ${MONTHS[month]}`}
            </Text>
            {waiting ? (
              <View style={{ height: 16, width: 90, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.07)" }} />
            ) : (
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                style={[nums, { flexShrink: 1, fontSize: 16, fontWeight: "700", color: ending < 0 ? RED : "#fff" }]}
              >
                {ending < 0 ? "−" : ""}
                {money(Math.abs(ending))}
              </Text>
            )}
          </View>
        </Surface>

        {/* ══ Which side to look at ══ */}
        <View style={{ marginTop: 22 }}>
          <SegmentedTabs
            value={kind}
            onChange={(k) => {
              setKind(k);
              setDay(null);
            }}
            height={34}
            options={[
              { key: "todos" as const, label: "Todos" },
              { key: "pagar" as const, label: "A pagar" },
              { key: "receber" as const, label: "A receber" },
            ]}
          />
        </View>

        {/* ══ The month as a month ══ */}
        <View style={{ marginTop: 20 }}>
          <MonthCalendar month={month} year={year} events={events} selectedDay={day} onSelectDay={setDay} />
        </View>

        {/* ══ What falls when ══ */}
        {waiting ? (
          <View style={{ marginTop: 24, height: 180, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.03)" }} />
        ) : day !== null ? (
          <Animated.View key={`dia-${day}-${kind}`} entering={FadeIn.duration(180)} style={{ marginTop: 20 }}>
            <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
              <Text style={{ fontSize: 17, fontWeight: "600", color: "#fff" }}>
                {capitalise(weekdayShort(new Date(year, month, day)))}, {day} de {MONTHS[month]}
              </Text>
              <Pressable onPress={() => setDay(null)} hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
                <Text style={{ fontSize: 14, color: INK.soft }}>Ver o mês todo</Text>
              </Pressable>
            </View>
            <View style={{ marginTop: 6 }}>
              {onDay.length === 0 ? (
                <Text style={{ paddingVertical: 18, fontSize: 14, color: INK.softer }}>{nothing} neste dia.</Text>
              ) : (
                onDay.map((e) => <EventRow key={e.id} event={e} today={today} />)
              )}
            </View>
          </Animated.View>
        ) : events.length === 0 ? (
          <Text style={{ marginTop: 24, paddingHorizontal: 4, fontSize: 14, color: INK.softer }}>
            {nothing} em {MONTHS[month]}.
          </Text>
        ) : (
          <View style={{ marginTop: 14 }}>
            {late.length > 0 && (
              <Section dot={RED} title="Atrasados" count={late.length}>
                {late.map((e) => (
                  <EventRow key={e.id} event={e} today={today} />
                ))}
              </Section>
            )}

            {comingByDay.length > 0 && (
              <Section title="Próximos" count={coming.length}>
                {comingByDay.map(([key, list]) => (
                  <View key={key}>
                    <DayHeader event={list[0]} today={today} list={list} />
                    {list.map((e) => (
                      <EventRow key={e.id} event={e} today={today} />
                    ))}
                  </View>
                ))}
              </Section>
            )}

            {settled.length > 0 && (
              <View style={{ marginTop: 22 }}>
                <Pressable
                  onPress={() => setShowSettled((v) => !v)}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingVertical: 12,
                    borderTopWidth: 1,
                    borderTopColor: RULE,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Text style={{ fontSize: 15, color: INK.soft }}>
                    Já pagos e recebidos <Text style={{ color: INK.faint }}>{settled.length}</Text>
                  </Text>
                  {showSettled ? <ChevronUp size={16} color={INK.soft} /> : <ChevronDown size={16} color={INK.soft} />}
                </Pressable>
                {showSettled && (
                  <Animated.View entering={FadeIn.duration(180)}>
                    {settled.map((e) => (
                      <EventRow key={e.id} event={e} today={today} />
                    ))}
                  </Animated.View>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </Room>
  );
}

/** One of the two figures at the top, in its half of the card. */
function Figure({ dot, label, value }: { dot: string; label: string; value: string | null }) {
  return (
    <View style={{ flex: 1, minWidth: 0, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: dot }} />
        <Text style={{ fontSize: 13, color: INK.soft }}>{label}</Text>
      </View>
      {value === null ? (
        <View style={{ marginTop: 8, height: 22, width: "80%", borderRadius: 7, backgroundColor: "rgba(255,255,255,0.06)" }} />
      ) : (
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          style={[nums, { marginTop: 5, fontSize: 22, fontWeight: "700", letterSpacing: -0.6, color: "#fff" }]}
        >
          {value}
        </Text>
      )}
    </View>
  );
}

function Section({
  title,
  count,
  dot,
  children,
}: {
  title: string;
  count: number;
  dot?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginTop: 18 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingBottom: 2 }}>
        {dot && <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: dot }} />}
        <Text style={{ fontSize: 17, fontWeight: "600", letterSpacing: -0.2, color: "#fff" }}>{title}</Text>
        <Text style={{ fontSize: 14, color: INK.faint }}>{count}</Text>
      </View>
      {children}
    </View>
  );
}

/** A day in the list: in words when it is near, with what the day adds up to. */
function DayHeader({ event, today, list }: { event: FinanceEvent; today: Date; list: FinanceEvent[] }) {
  const d = dateOf(event);
  const n = daysFrom(event, today);
  const label = n === 0 ? "Hoje" : n === 1 ? "Amanhã" : capitalise(`${weekdayShort(d)}, ${d.getDate()} ${monthShort(d)}`);
  const net = list.reduce((s, e) => s + (isIncome(e) ? e.amount : -e.amount), 0);
  return (
    <View style={{ marginTop: 12, flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
      <Text style={{ fontSize: 13, fontWeight: "600", color: n <= 1 ? "#fff" : INK.soft }}>
        {label}
        {n <= 1 ? (
          <Text style={{ fontWeight: "400", color: INK.softer }}>
            {"  "}
            {weekdayShort(d)}, {d.getDate()} {monthShort(d)}
          </Text>
        ) : null}
      </Text>
      <Text style={[nums, { fontSize: 12.5, color: INK.softer }]}>
        {net < 0 ? "−" : "+"}
        {money(Math.abs(net))}
      </Text>
    </View>
  );
}

/** One thing that falls this month. */
function EventRow({ event: e, today }: { event: FinanceEvent; today: Date }) {
  const Icon = categoryIcon(e.category);
  const hex = categoryHex(e.category);
  const done = isSettled(e);
  const lateNow = isOverdue(e, today);
  const income = isIncome(e);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: RULE,
        opacity: done ? 0.6 : 1,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: chipFill(hex),
        }}
      >
        <Icon size={18} color={chipInk(hex)} strokeWidth={2} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: 15.5, fontWeight: "500", color: "#fff" }}>
          {e.name}
        </Text>
        <View style={{ marginTop: 2, flexDirection: "row", alignItems: "center", gap: 6 }}>
          {!done && (
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: lateNow ? RED : income ? GREEN : AMBER,
              }}
            />
          )}
          <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: lateNow ? RED : INK.soft }}>
            {dueLabel(e, today)} · {e.category}
          </Text>
        </View>
      </View>
      <Text numberOfLines={1} style={[nums, { flexShrink: 0, fontSize: 15.5, fontWeight: "600", color: "#fff" }]}>
        {income ? "+" : ""}
        {money(e.amount)}
      </Text>
    </View>
  );
}
