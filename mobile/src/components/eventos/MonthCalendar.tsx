import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, Text, View, type LayoutChangeEvent, type TextStyle } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import type { FinanceEvent } from "@/types/finance";
import { dayOfMonth, isIncome, isOverdue, isSettled } from "~/lib/events";
import { AMBER, GREEN, INK, RED } from "~/theme/tokens";

/**
 * The month as a month.
 *
 * A dot tells you something is there and the list below tells you what, so each
 * day carries only dots: green for money coming in, amber for a bill still to pay,
 * red for one that is late, and a faint one for something already settled. Today
 * wears a thin ring.
 *
 * Tapping a day narrows the list to it. The mark that says which day is chosen is
 * one object that slides from day to day rather than one that blinks out here and
 * in there, so you can see where the choice went; tapping the same day again lets
 * the whole month back.
 */

const ROW = 50;
const MARK = 34;
const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

const SPRING = { duration: 340, dampingRatio: 1, reduceMotion: ReduceMotion.System } as const;

const nums: TextStyle = Platform.select({
  ios: { fontVariant: ["tabular-nums"] },
  default: {},
}) as TextStyle;

const toneOf = (e: FinanceEvent, today: Date) =>
  isSettled(e) ? "rgba(255,255,255,0.35)" : isOverdue(e, today) ? RED : isIncome(e) ? GREEN : AMBER;

export default function MonthCalendar({
  month,
  year,
  events,
  selectedDay,
  onSelectDay,
}: {
  month: number;
  year: number;
  events: FinanceEvent[];
  selectedDay: number | null;
  onSelectDay: (day: number | null) => void;
}) {
  const [width, setWidth] = useState(0);
  const today = useMemo(() => new Date(), []);
  const cell = width / 7;

  const lead = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const rows = Math.ceil((lead + days) / 7);
  const isThisMonth = month === today.getMonth() && year === today.getFullYear();
  const isPastMonth = year < today.getFullYear() || (year === today.getFullYear() && month < today.getMonth());

  const byDay = useMemo(() => {
    const map = new Map<number, FinanceEvent[]>();
    for (const e of events) {
      const d = dayOfMonth(e);
      if (!d) continue;
      map.set(d, [...(map.get(d) ?? []), e]);
    }
    return map;
  }, [events]);

  const position = (day: number) => {
    const i = lead + day - 1;
    return { x: (i % 7) * cell + cell / 2 - MARK / 2, y: Math.floor(i / 7) * ROW + 6 };
  };

  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const shown = useSharedValue(0);
  const placed = useRef(false);

  useEffect(() => {
    if (cell === 0) return;
    if (selectedDay === null) {
      shown.set(withTiming(0, { duration: 150 }));
      placed.current = false;
      return;
    }
    const p = position(selectedDay);
    /* Appearing, it is placed; already showing, it travels. */
    if (!placed.current) {
      x.set(p.x);
      y.set(p.y);
      placed.current = true;
    } else {
      x.set(withSpring(p.x, SPRING));
      y.set(withSpring(p.y, SPRING));
    }
    shown.set(withTiming(1, { duration: 150 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDay, cell, lead]);

  const mark = useAnimatedStyle(() => ({
    opacity: shown.get(),
    transform: [{ translateX: x.get() }, { translateY: y.get() }, { scale: 0.9 + 0.1 * shown.get() }],
  }));

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const choose = (day: number) => {
    void Haptics.selectionAsync();
    onSelectDay(day === selectedDay ? null : day);
  };

  return (
    <View onLayout={onLayout}>
      <View style={{ flexDirection: "row", paddingBottom: 8 }}>
        {WEEKDAYS.map((w, i) => (
          <Text key={i} style={{ flex: 1, textAlign: "center", fontSize: 11, fontWeight: "600", color: INK.faint }}>
            {w}
          </Text>
        ))}
      </View>

      {cell > 0 && (
        <View style={{ height: rows * ROW }}>
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: "absolute",
                left: 0,
                top: 0,
                width: MARK,
                height: MARK,
                borderRadius: MARK / 2,
                backgroundColor: "#FFFFFF",
              },
              mark,
            ]}
          />

          {Array.from({ length: days }, (_, k) => {
            const day = k + 1;
            const i = lead + k;
            const list = byDay.get(day) ?? [];
            const isToday = isThisMonth && day === today.getDate();
            const isPast = isPastMonth || (isThisMonth && day < today.getDate());
            const on = day === selectedDay;
            return (
              <Pressable
                key={day}
                onPress={() => choose(day)}
                accessibilityLabel={`Dia ${day}${list.length ? `, ${list.length} ${list.length === 1 ? "evento" : "eventos"}` : ""}`}
                style={{
                  position: "absolute",
                  left: (i % 7) * cell,
                  top: Math.floor(i / 7) * ROW,
                  width: cell,
                  height: ROW,
                  alignItems: "center",
                }}
              >
                <View
                  style={{
                    marginTop: 6,
                    width: MARK,
                    height: MARK,
                    borderRadius: MARK / 2,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: isToday && !on ? 1 : 0,
                    borderColor: "rgba(255,255,255,0.45)",
                  }}
                >
                  <Text
                    style={[
                      nums,
                      {
                        fontSize: 15,
                        fontWeight: on || isToday ? "700" : list.length ? "600" : "400",
                        color: on ? "#0B0B0B" : isPast && !isToday ? INK.softer : "#fff",
                      },
                    ]}
                  >
                    {day}
                  </Text>
                </View>

                {/* What falls on it, as dots — never more than three. */}
                <View style={{ marginTop: 3, flexDirection: "row", gap: 3, height: 4 }}>
                  {list.slice(0, 3).map((e) => (
                    <View
                      key={e.id}
                      style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: toneOf(e, today) }}
                    />
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
