import { useEffect } from "react";
import { Platform, Text, View, type TextStyle } from "react-native";
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { money } from "~/lib/money";
import { AMBER, GREEN, INK } from "~/theme/tokens";
import { th } from "~/theme/theme";

/**
 * The top of Transações: what came in, what went out, and what is still pending.
 *
 * Loose on the page, no cards: three lines, each its name with a dot of its colour on the
 * left and the figure on the right, and under it a lit bar — all three on one scale, so which
 * is bigger is seen before a figure is read. Only what has happened counts as in and out; the
 * scheduled and the unpaid wait under Pendente (what is still to pay, with what is still to come
 * in beside it when there is some). No balance and no forecast: this screen is the movements.
 */

const nums: TextStyle = Platform.select({ ios: { fontVariant: ["tabular-nums"] }, default: {} }) as TextStyle;
/* The red of money going out, at full strength: the softer one reads grey on the dark. */
const LIVE_RED = "#FF4D4D";

const SHADES: Record<string, [string, string]> = {
  in: ["#3FB34A", GREEN],
  out: ["#E0262B", LIVE_RED],
  wait: ["#E0A92E", AMBER],
};

export default function MonthFlows({
  entrou,
  saiu,
  aPagar,
  aReceber,
  hidden,
}: {
  entrou: number;
  saiu: number;
  aPagar: number;
  aReceber: number;
  hidden?: boolean;
}) {
  const show = (v: number) => (hidden ? "R$ •••" : money(v));
  const scale = Math.max(entrou, saiu, aPagar, 1);
  return (
    <View style={{ gap: 16 }}>
      <Line kind="in" color={GREEN} label="Entrou" value={show(entrou)} share={entrou / scale} delay={0} />
      <Line kind="out" color={LIVE_RED} label="Saiu" value={hidden ? "R$ •••" : `−${money(saiu)}`} share={saiu / scale} delay={80} />
      <Line kind="wait" color={AMBER} label="Pendente" note={aReceber > 0.004 ? `+${show(aReceber)} a receber` : "a pagar"} value={show(aPagar)} share={aPagar / scale} delay={160} />
    </View>
  );
}

function Line({ kind, color, label, note, value, share, delay }: { kind: keyof typeof SHADES; color: string; label: string; note?: string; value: string; share: number; delay: number }) {
  const grow = useSharedValue(0);
  useEffect(() => {
    grow.set(withDelay(delay, withTiming(Math.max(0, Math.min(1, share)), { duration: 650, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System })));
  }, [grow, share, delay]);
  const fill = useAnimatedStyle(() => ({ width: `${Math.max(grow.get() * 100, grow.get() > 0 ? 2 : 0)}%` }));
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: th(color, "bg") }} />
        <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 15, fontWeight: "600", color: th("#fff") }}>
          {label}
          {note ? <Text style={{ fontWeight: "400", color: th(INK.softer) }}>{`  ${note}`}</Text> : null}
        </Text>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[nums, { marginLeft: "auto", fontSize: 18, fontWeight: "800", letterSpacing: -0.4, color: th(kind === "out" ? LIVE_RED : "#fff") }]}>
          {value}
        </Text>
      </View>
      <View style={{ marginTop: 9, height: 6, borderRadius: 999, overflow: "hidden", backgroundColor: th("rgba(255,255,255,0.07)", "bg") }}>
        <Animated.View style={[{ height: "100%", borderRadius: 999, overflow: "hidden" }, fill]}>
          <LinearGradient colors={th(SHADES[kind], "grad")} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
        </Animated.View>
      </View>
    </View>
  );
}
