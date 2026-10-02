import { useEffect, useRef } from "react";
import { Pressable, ScrollView, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { RISK, riskOf, useMoney } from "@/components/projecoes/shared";
import { Surface, Text, white } from "~/ui";

export interface TrendRow {
  month: number;
  year: number;
  balance: number;
  risk: string;
  empty: boolean;
  short: string;
  yearTag: string;
}

const EMPTY_HEX = "#94A3B8";
const BAR_WIDTH = 60;

function Bar({ height, color, on, delay }: { height: number; color: string; on: boolean; delay: number }) {
  const h = useSharedValue(0);
  useEffect(() => {
    h.value = withDelay(delay, withTiming(height, { duration: 500 }));
  }, [height, delay, h]);
  const style = useAnimatedStyle(() => ({ height: h.value }));
  return (
    <Animated.View
      style={[
        { width: "100%", borderRadius: 9, backgroundColor: on ? color : `${color}33`, borderWidth: on ? 2 : 1, borderColor: on ? "#fff" : white(0.06) },
        style,
      ]}
    />
  );
}

/** O saldo no fim de cada mês, uma barra por mês; tocar numa barra abre aquele mês abaixo. */
export function BalanceTrendChart({ rows, selectedIdx, onSelect, maxAbs }: {
  rows: TrendRow[];
  selectedIdx: number | null;
  onSelect: (i: number) => void;
  maxAbs: number;
}) {
  const { compact } = useMoney();
  const scroll = useRef<ScrollView>(null);

  useEffect(() => {
    if (selectedIdx === null) return;
    scroll.current?.scrollTo({ x: Math.max(0, selectedIdx * (BAR_WIDTH + 8) - 100), animated: true });
  }, [selectedIdx]);

  const legend = [
    { label: "Tranquilo", hex: RISK.positivo.hex },
    { label: "Atenção", hex: RISK.atencao.hex },
    { label: "Negativo", hex: "#F87171" },
    { label: "Sem lançamentos", hex: EMPTY_HEX },
  ];

  return (
    <Surface style={{ padding: 20 }}>
      <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, alignItems: "flex-end", minHeight: 130 }}>
        {rows.map((r, i) => {
          const risk = riskOf(r.risk);
          const on = i === selectedIdx;
          const color = r.empty ? EMPTY_HEX : r.balance < 0 ? "#F87171" : risk.hex;
          const barHeight = Math.max((Math.abs(r.balance) / maxAbs) * 84, 18);
          return (
            <Pressable key={`${r.year}-${r.month}`} onPress={() => onSelect(i)} style={{ width: BAR_WIDTH, alignItems: "center", gap: 6 }}>
              <Text size={10.5} weight="bold" tabular numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} color={on ? "#fff" : white(0.56)}>{compact(r.balance)}</Text>
              <View style={{ width: "100%", justifyContent: "flex-end" }}>
                <Bar height={barHeight} color={color} on={on} delay={i * 20} />
              </View>
              <Text size={11} weight="semibold" color={on ? "#fff" : white(0.56)}>
                {r.short}{r.yearTag ? <Text size={11} color={white(0.38)}>/{r.yearTag}</Text> : null}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={{ marginTop: 16, flexDirection: "row", flexWrap: "wrap", justifyContent: "center", columnGap: 16, rowGap: 6, borderTopWidth: 1, borderTopColor: white(0.06), paddingTop: 14 }}>
        {legend.map((l) => (
          <View key={l.label} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: l.hex }} />
            <Text size={11} color={white(0.62)}>{l.label}</Text>
          </View>
        ))}
      </View>
    </Surface>
  );
}
