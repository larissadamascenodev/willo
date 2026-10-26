import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Platform, Pressable, ScrollView, Text, View, type TextStyle } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  interpolateColor,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import type { ProjectionMonth } from "@/services/activeInstallments";
import Surface from "~/components/Surface";
import { money } from "~/lib/money";
import { GREEN, INK } from "~/theme/tokens";

/**
 * The monthly figure, month by month, until it reaches nothing.
 *
 * Each month is a column you can tap; the one you chose lights and its reading
 * sits above the chart — what it takes, from how many instalments, and how much
 * less that is than now, which is the number a person is actually waiting on. A
 * small green mark under a month says something ends there. The cards under the
 * chart all read the chosen month, so this is the page's month picker too — and
 * when a month is chosen from elsewhere, the chart brings it into view.
 */

const HEIGHT = 112;
const COLUMN = 34;
const BAR = 24;
const OFF = "rgba(255,255,255,0.16)";

const nums: TextStyle = Platform.select({
  ios: { fontVariant: ["tabular-nums"] },
  default: {},
}) as TextStyle;

const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

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
  const picked = projection[Math.min(selected, projection.length - 1)];
  const now = projection[0];
  const thisYear = now.year;
  const less = now.value - picked.value;

  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!width) return;
    const x = 12 + selected * COLUMN - (width - COLUMN) / 2;
    scroller.current?.scrollTo({ x: Math.max(0, x), animated: true });
  }, [selected, width]);

  return (
    <Surface>
      <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <Text style={{ fontSize: 16, fontWeight: "600", letterSpacing: -0.2, color: "#fff" }}>Próximos meses</Text>
          <Text style={{ fontSize: 12.5, color: INK.softer }}>toque num mês</Text>
        </View>

        {/* The chosen month's reading. */}
        <Animated.View key={picked.key} entering={FadeIn.duration(180)} style={{ marginTop: 12, minHeight: 66 }}>
          <Text style={{ fontSize: 13, color: INK.soft }}>
            {selected === 0
              ? "Este mês"
              : `${MONTHS[picked.month][0].toUpperCase()}${MONTHS[picked.month].slice(1)}${picked.year !== thisYear ? ` de ${picked.year}` : ""}`}
          </Text>
          <Text style={[nums, { marginTop: 2, fontSize: 24, fontWeight: "700", letterSpacing: -0.6, color: "#fff" }]}>
            {money(picked.value)}
          </Text>
          <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12.5, color: INK.soft }}>
            {picked.parts.length} {picked.parts.length === 1 ? "parcela" : "parcelas"}
            {selected > 0 && less > 0.005 ? (
              <>
                {" · "}
                <Text style={{ color: "#fff", fontWeight: "600" }}>{money(less)}</Text> a menos que hoje
              </>
            ) : null}
          </Text>
        </Animated.View>
      </View>

      <ScrollView
        ref={scroller}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 14, paddingBottom: 4 }}
      >
        {projection.map((p, i) => {
          const ends = p.parts.some((x) => x.number === x.total);
          const on = i === selected;
          return (
            <Pressable
              key={p.key}
              onPress={() => {
                if (on) return;
                void Haptics.selectionAsync();
                onSelect(i);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${MONTHS[p.month]} de ${p.year}, ${money(p.value)}`}
              accessibilityState={{ selected: on }}
              style={{ width: COLUMN, alignItems: "center" }}
            >
              <View style={{ height: HEIGHT, justifyContent: "flex-end" }}>
                <Column value={p.value} max={max} on={on} delay={Math.min(i, 12) * 0.035} />
              </View>
              {/* Something ends this month. */}
              <View
                style={{
                  marginTop: 7,
                  width: 5,
                  height: 5,
                  borderRadius: 3,
                  backgroundColor: ends ? GREEN : "transparent",
                }}
              />
              <Text
                style={{
                  marginTop: 5,
                  fontSize: 12,
                  textTransform: "capitalize",
                  fontWeight: on ? "700" : "400",
                  color: on ? "#fff" : INK.softer,
                }}
              >
                {MONTHS[p.month].slice(0, 3)}
              </Text>
              {/* The year, once, where it turns. */}
              <Text style={{ height: 14, fontSize: 10.5, color: INK.faint }}>
                {p.month === 0 && p.year !== thisYear ? p.year : ""}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 14 }}>
        <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: GREEN }} />
        <Text style={{ fontSize: 12, color: INK.softer }}>mês em que alguma compra termina</Text>
      </View>
    </Surface>
  );
}

/** A month's column, growing up from the floor; the chosen one lights. */
function Column({ value, max, on, delay }: { value: number; max: number; on: boolean; delay: number }) {
  const grow = useSharedValue(0);
  const lit = useSharedValue(on ? 1 : 0);
  const target = Math.max((value / max) * HEIGHT, value > 0 ? 8 : 3);

  useEffect(() => {
    grow.set(
      withDelay(
        delay * 1000,
        withTiming(target, { duration: 520, easing: Easing.bezier(0.23, 1, 0.32, 1), reduceMotion: ReduceMotion.System }),
      ),
    );
  }, [target, delay, grow]);

  useEffect(() => {
    lit.set(withTiming(on ? 1 : 0, { duration: 220, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.System }));
  }, [on, lit]);

  const animated = useAnimatedStyle(() => ({
    height: grow.get(),
    backgroundColor: interpolateColor(lit.get(), [0, 1], [OFF, "#ffffff"]),
  }));

  return <Animated.View style={[{ width: BAR, borderRadius: 8, borderCurve: "continuous" }, animated]} />;
}
