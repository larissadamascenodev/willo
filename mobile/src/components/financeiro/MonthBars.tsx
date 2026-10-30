import { useRef, type ComponentRef } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { INK, GREEN, RED } from "~/theme/tokens";

/**
 * Months as bars, the strip the invoices use.
 *
 * One bar per month, tall for its figure, green above zero and red below; the months ahead
 * a lighter shade of the same, the ones already lived fainter still, and the picked one at
 * full strength. It opens with this month at the left edge and the months ahead to its
 * right; the ones behind are a pull away. Tapping a bar picks that month — what it says is
 * written out by whoever draws the strip, under it.
 */

const SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const BAR_W = 44;
const GAP = 8;
const TRACK = 110;

export interface MonthBar {
  month: number;
  year: number;
  value: number;
}

export default function MonthBars({
  bars,
  todayIndex,
  selected,
  onSelect,
}: {
  bars: MonthBar[];
  todayIndex: number;
  selected: number;
  onSelect: (i: number) => void;
}) {
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const parked = useRef(false);
  const max = Math.max(...bars.map((b) => Math.abs(b.value)), 1);

  return (
    <ScrollView
      ref={scroller}
      horizontal
      showsHorizontalScrollIndicator={false}
      onContentSizeChange={() => {
        if (parked.current) return;
        scroller.current?.scrollTo({ x: Math.max(todayIndex, 0) * (BAR_W + GAP), animated: false });
        parked.current = true;
      }}
      contentContainerStyle={{ gap: GAP, alignItems: "flex-end", paddingHorizontal: 4, paddingRight: 18 }}
    >
      {bars.map((b, i) => {
        const on = i === selected;
        const past = i < todayIndex;
        const ahead = i > todayIndex;
        const color = b.value < 0 ? RED : GREEN;
        const height = b.value !== 0 ? Math.max(12, (Math.abs(b.value) / max) * TRACK) : 5;
        return (
          <Pressable key={`${b.year}-${b.month}`} onPress={() => onSelect(i)} accessibilityRole="button" style={{ width: BAR_W, alignItems: "center", gap: 8 }}>
            <View style={{ height: TRACK, width: "100%", justifyContent: "flex-end" }}>
              <View
                style={{
                  height,
                  width: "100%",
                  borderRadius: 10,
                  backgroundColor: ahead ? `${color}99` : color,
                  opacity: on ? 1 : past ? 0.3 : 0.55,
                }}
              />
            </View>
            <Text style={{ fontSize: 11, fontWeight: on ? "700" : "500", color: on ? "#fff" : past ? INK.faint : INK.soft }}>
              {i === todayIndex ? "Hoje" : SHORT[b.month]}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
