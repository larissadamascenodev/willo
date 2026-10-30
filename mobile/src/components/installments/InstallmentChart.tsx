import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import type { ProjectionMonth } from "@/services/activeInstallments";
import { Check } from "~/components/icons";
import { money } from "~/lib/money";
import { INK } from "~/theme/tokens";

/**
 * The monthly figure, month by month, until it reaches nothing.
 *
 * Wide columns in white, so the page's colour stays with the figures that carry it:
 * this month solid, the months after softer. The chosen month's figure is the one
 * the page writes under the chart, so the columns carry none of their own.
 *
 * It is also the page's month picker: tapping a column chooses the month the rest
 * of the page reads. When a month is chosen from elsewhere the strip brings it into
 * view; a tap never moves it, so it is not pulled out from under the finger.
 */

const MONTH_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const BAR_W = 46;
const GAP = 8;
const TRACK = 96;
/* This month in blue; the months ahead in white, so the one being lived stands out. */
const NOW = "#5AA9FF";
const LATER = "#ECECEF";

export default function InstallmentChart({
  projection,
  selected,
  onSelect,
}: {
  projection: ProjectionMonth[];
  selected: number;
  onSelect: (index: number) => void;
}) {
  const max = Math.max(...projection.map((p) => p.value), 1);
  const last = [...projection].reverse().find((p) => p.value > 0);

  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const tapped = useRef(false);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (tapped.current) {
      tapped.current = false;
      return;
    }
    if (!width) return;
    const x = selected * (BAR_W + GAP) - (width - BAR_W) / 2;
    scroller.current?.scrollTo({ x: Math.max(0, x), animated: true });
  }, [selected, width]);

  return (
    <View style={{ paddingHorizontal: 4 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
        <Text style={{ fontSize: 12, fontWeight: "600", letterSpacing: 1.4, textTransform: "uppercase", color: INK.soft }}>
          Próximos meses
        </Text>
        {last && (
          <Text style={{ textAlign: "right", fontSize: 11.5, lineHeight: 14, color: INK.faint }}>
            última parcela{"\n"}em {MONTH_SHORT[last.month]}/{String(last.year).slice(2)}
          </Text>
        )}
      </View>

      <ScrollView
        ref={scroller}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: GAP, alignItems: "flex-end", paddingBottom: 4, paddingRight: 18 }}
        style={{ marginTop: 16 }}
      >
        {projection.map((p, i) => {
          const on = i === selected;
          const ends = p.parts.some((x) => x.number === x.total);
          return (
            <Pressable
              key={p.key}
              onPress={() => {
                if (on) return;
                tapped.current = true;
                void Haptics.selectionAsync();
                onSelect(i);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${MONTH_SHORT[p.month]} de ${p.year}, ${money(p.value)}`}
              accessibilityState={{ selected: on }}
              style={{ width: BAR_W, alignItems: "center", gap: 6 }}
            >
              <View style={{ height: TRACK, width: "100%", justifyContent: "flex-end" }}>
                <Column
                  value={p.value}
                  max={max}
                  color={i === 0 ? NOW : LATER}
                  on={on}
                  delay={Math.min(i, 10) * 0.035}
                />
              </View>

              <Text style={{ fontSize: 11, fontWeight: on ? "700" : "400", color: on ? "#fff" : INK.soft }}>
                {MONTH_SHORT[p.month]}
              </Text>
              {/* The year, once, where it turns. */}
              <Text style={{ marginTop: -4, height: 13, fontSize: 10, color: INK.faint }}>
                {p.month === 0 ? p.year : ""}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center", flexWrap: "wrap", columnGap: 16, rowGap: 6 }}>
        <Legend color={NOW} label="Este mês" />
        <Legend color={LATER} label="Próximos" />
      </View>
    </View>
  );
}

/** A month's column, growing up from the floor; the chosen one at full strength. */
function Column({ value, max, color, on, delay }: { value: number; max: number; color: string; on: boolean; delay: number }) {
  const grow = useSharedValue(0);
  const lit = useSharedValue(on ? 1 : 0);
  const target = value > 0 ? Math.max(16, (value / max) * TRACK) : 5;

  useEffect(() => {
    grow.set(
      withDelay(
        delay * 1000,
        withTiming(target, { duration: 520, easing: Easing.bezier(0.23, 1, 0.32, 1), reduceMotion: ReduceMotion.System }),
      ),
    );
  }, [target, delay, grow]);

  useEffect(() => {
    lit.set(withTiming(on ? 1 : 0, { duration: 200, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.System }));
  }, [on, lit]);

  const animated = useAnimatedStyle(() => ({ height: grow.get(), opacity: 0.82 + lit.get() * 0.18 }));

  return (
    <Animated.View
      style={[{ width: "100%", borderRadius: 9, borderCurve: "continuous", backgroundColor: value > 0 ? color : "rgba(255,255,255,0.10)" }, animated]}
    />
  );
}

function Legend({ color, label, tick }: { color: string; label: string; tick?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View
        style={{
          width: tick ? 12 : 10,
          height: tick ? 12 : 10,
          borderRadius: tick ? 6 : 3,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: tick ? "rgba(255,255,255,0.14)" : color,
        }}
      >
        {tick && <Check size={8} color="#fff" strokeWidth={4} />}
      </View>
      <Text style={{ fontSize: 11, color: INK.softer }}>{label}</Text>
    </View>
  );
}
