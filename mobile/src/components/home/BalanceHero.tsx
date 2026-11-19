import { useMemo } from "react";
import { Platform, Pressable, Text, View, useWindowDimensions, type TextStyle } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";
import type { Transaction } from "@/types/finance";
import { ArrowDown, ArrowUp } from "~/components/icons";
import { money } from "~/lib/money";
import { useGroundTh } from "~/theme/groundInk";
import { INK } from "~/theme/tokens";

/**
 * The top of the home: the balance, large, and how it got here this month.
 *
 * The figure is what is in the accounts now. Under it, where it should end the month. Under
 * that, a line across the whole width: the balance at the end of each day so far — flat
 * while nothing moves, stepping where money came in or went out — and, from today, a dashed
 * line to where the month is expected to end. No robot, no card around it: the number and
 * its line, the way the phone's own apps put the one figure that matters on top.
 */

const nums: TextStyle = Platform.select({ ios: { fontVariant: ["tabular-nums"] }, default: {} }) as TextStyle;
const CHART_H = 132;

export default function BalanceHero({
  saldoAtual,
  saldoPrevisto,
  transactions,
  month,
  year,
  hidden,
  loading,
  onPress,
}: {
  saldoAtual: number;
  saldoPrevisto: number;
  transactions: Transaction[];
  month: number;
  year: number;
  hidden?: boolean;
  loading?: boolean;
  onPress?: () => void;
}) {
  const th = useGroundTh();
  const { width } = useWindowDimensions();
  const ink = th("#fff");
  const up = saldoPrevisto >= saldoAtual;

  /* The balance at the end of each day: worked back from today's, undoing what moved after. */
  const series = useMemo(() => {
    const now = new Date();
    const today = now.getFullYear() === year && now.getMonth() === month ? now.getDate() : new Date(year, month + 1, 0).getDate();
    const byDay = new Array<number>(today + 1).fill(0);
    for (const t of transactions) {
      if (t.status && t.status !== "pago") continue;
      const iso = t.rawDate ?? "";
      const [y, m, d] = iso.split("-").map(Number);
      if (y !== year || m !== month + 1 || !d || d > today) continue;
      byDay[d] += t.type === "receita" ? Number(t.amount) : -Number(t.amount);
    }
    const points: number[] = new Array(today + 1);
    points[today] = saldoAtual;
    for (let d = today; d >= 1; d--) points[d - 1] = points[d] - byDay[d];
    return { points, today, last: new Date(year, month + 1, 0).getDate() };
  }, [transactions, saldoAtual, month, year]);

  const chart = useMemo(() => {
    const W = width;
    const { points, today, last } = series;
    const values = [...points, saldoPrevisto];
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (max - min < 1) {
      max += 1;
      min -= 1;
    }
    const pad = (max - min) * 0.18;
    min -= pad;
    max += pad;
    const top = 10;
    const bottom = CHART_H - 14;
    const x = (d: number) => (d / last) * (W - 2) + 1;
    const y = (v: number) => bottom - ((v - min) / (max - min)) * (bottom - top);

    /* Flat while nothing moves, a soft step where it does. */
    const step = Math.min(((W - 2) / last) * 0.7, 16);
    let line = `M ${x(0)} ${y(points[0])}`;
    for (let d = 1; d <= today; d++) {
      const from = y(points[d - 1]);
      const to = y(points[d]);
      const xd = x(d);
      if (Math.abs(to - from) < 0.5) {
        line += ` L ${xd} ${to}`;
        continue;
      }
      line += ` L ${xd - step} ${from} C ${xd - step / 2} ${from} ${xd - step / 2} ${to} ${xd} ${to}`;
    }
    const area = `${line} L ${x(today)} ${CHART_H} L ${x(0)} ${CHART_H} Z`;
    const ahead = today < last ? `M ${x(today)} ${y(points[today])} L ${x(last)} ${y(saldoPrevisto)}` : null;
    return { line, area, ahead, dot: { x: x(today), y: y(points[today]) } };
  }, [series, saldoPrevisto, width]);

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={hidden ? "Saldo em contas" : `Saldo em contas, ${money(saldoAtual)}`}>
      <View style={{ alignItems: "center", paddingTop: 22 }}>
        <Text style={{ fontSize: 16, fontWeight: "500", color: th(INK.soft) }}>Saldo em contas</Text>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          style={[nums, { marginTop: 6, fontSize: 54, fontWeight: "600", letterSpacing: -2, color: ink, opacity: loading ? 0.5 : 1 }]}
        >
          {hidden ? "R$ ••••••" : money(saldoAtual)}
        </Text>
        {!hidden && Math.abs(saldoPrevisto - saldoAtual) >= 0.01 && (
          <View style={{ marginTop: 6, flexDirection: "row", alignItems: "center", gap: 5 }}>
            {up ? <ArrowUp size={15} color={th(INK.soft)} strokeWidth={2.2} /> : <ArrowDown size={15} color={th(INK.soft)} strokeWidth={2.2} />}
            <Text style={[nums, { fontSize: 15, color: th(INK.soft) }]}>{`${money(saldoPrevisto)} previsto no fim do mês`}</Text>
          </View>
        )}
      </View>

      {/* Across the whole width, past the page's margins. */}
      <Animated.View entering={FadeIn.duration(420)} style={{ marginTop: 22, marginHorizontal: -16, height: CHART_H }}>
        <Svg width={width} height={CHART_H}>
          <Defs>
            <LinearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={ink} stopOpacity={0.16} />
              <Stop offset="1" stopColor={ink} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path d={chart.area} fill="url(#balanceFill)" />
          <Path d={chart.line} stroke={ink} strokeWidth={2.4} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          {chart.ahead && <Path d={chart.ahead} stroke={ink} strokeOpacity={0.45} strokeWidth={2} strokeDasharray="5 6" fill="none" strokeLinecap="round" />}
          <Circle cx={chart.dot.x} cy={chart.dot.y} r={9} fill={ink} fillOpacity={0.14} />
          <Circle cx={chart.dot.x} cy={chart.dot.y} r={4} fill={ink} />
        </Svg>
      </Animated.View>
    </Pressable>
  );
}
