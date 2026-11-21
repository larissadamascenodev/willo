import { useEffect } from "react";
import { Platform, Text, View, type TextStyle } from "react-native";
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { money } from "~/lib/money";
import { AMBER, GREEN, INK } from "~/theme/tokens";
import { th } from "~/theme/theme";

/**
 * The top of Transações: the month's Receitas and Despesas — everything the month holds, what
 * has happened and what is scheduled — each split into what is already settled and what is
 * still pending.
 *
 * Loose on the page, no cards. Each one: its name with its dot (green in, red out) and the
 * month's whole figure; under it one bar in two pieces — the settled part in its colour, the
 * pending part in amber, a hair apart — both bars on one scale, so which is bigger is seen
 * before a figure is read; and under the bar the two parts named, a white dot for what is
 * settled (Recebido, Pago) and an amber one for what is pending (A receber, A pagar).
 */

const nums: TextStyle = Platform.select({ ios: { fontVariant: ["tabular-nums"] }, default: {} }) as TextStyle;
/* The red of money going out, at full strength: the softer one reads grey on the dark. */
const LIVE_RED = "#FF4D4D";

const SHADES = {
  in: ["#3FB34A", GREEN] as [string, string],
  out: ["#E0262B", LIVE_RED] as [string, string],
  wait: ["#E8B53A", AMBER] as [string, string],
};

export default function MonthFlows({
  receitas,
  recebido,
  despesas,
  pago,
  hidden,
}: {
  /** The month's whole income, received or still to come. */
  receitas: number;
  recebido: number;
  /** The month's whole spending, paid or still to pay. */
  despesas: number;
  pago: number;
  hidden?: boolean;
}) {
  const show = (v: number) => (hidden ? "R$ •••" : money(v));
  const scale = Math.max(receitas, despesas, 1);
  return (
    <View style={{ gap: 22 }}>
      <Flow kind="in" label="Receitas" total={receitas} done={recebido} doneLabel="Recebido" waitLabel="A receber" scale={scale} show={show} delay={0} />
      <View style={{ height: 1, backgroundColor: th("rgba(255,255,255,0.07)", "line") }} />
      <Flow kind="out" label="Despesas" total={despesas} done={pago} doneLabel="Pago" waitLabel="A pagar" scale={scale} show={show} delay={90} />
    </View>
  );
}

function Flow({
  kind,
  label,
  total,
  done,
  doneLabel,
  waitLabel,
  scale,
  show,
  delay,
}: {
  kind: "in" | "out";
  label: string;
  total: number;
  done: number;
  doneLabel: string;
  waitLabel: string;
  scale: number;
  show: (v: number) => string;
  delay: number;
}) {
  const settled = Math.max(0, Math.min(done, total));
  const waiting = Math.max(0, total - settled);
  const color = kind === "in" ? GREEN : LIVE_RED;
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
        <View style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: th(color, "bg") }} />
        <Text style={{ fontSize: 16, fontWeight: "600", color: th("#fff") }}>{label}</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[nums, { marginLeft: "auto", fontSize: 24, fontWeight: "800", letterSpacing: -0.7, color: th(kind === "out" ? LIVE_RED : "#fff") }]}>
          {show(total)}
        </Text>
      </View>

      {/* One bar in two pieces: settled in its colour, pending in amber. */}
      <View style={{ marginTop: 12, height: 10, flexDirection: "row", gap: 3, borderRadius: 999, overflow: "hidden", backgroundColor: th("rgba(255,255,255,0.06)", "bg") }}>
        <Piece share={settled / scale} shades={SHADES[kind]} delay={delay} />
        <Piece share={waiting / scale} shades={SHADES.wait} delay={delay + 120} />
      </View>

      {/* The two parts, named. */}
      <View style={{ marginTop: 11, flexDirection: "row", alignItems: "center", gap: 18 }}>
        <Part dot="#FFFFFF" label={doneLabel} value={show(settled)} />
        <Part dot={AMBER} label={waitLabel} value={show(waiting)} quiet={waiting < 0.005} />
      </View>
    </View>
  );
}

function Piece({ share, shades, delay }: { share: number; shades: [string, string]; delay: number }) {
  const grow = useSharedValue(0);
  useEffect(() => {
    grow.set(withDelay(delay, withTiming(Math.max(0, Math.min(1, share)), { duration: 650, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System })));
  }, [grow, share, delay]);
  const style = useAnimatedStyle(() => ({ width: `${grow.get() * 100}%` }));
  if (share <= 0.0005) return null;
  return (
    <Animated.View style={[{ height: "100%", borderRadius: 999, overflow: "hidden" }, style]}>
      <LinearGradient colors={th(shades, "grad")} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
    </Animated.View>
  );
}

function Part({ dot, label, value, quiet }: { dot: string; label: string; value: string; quiet?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 7, opacity: quiet ? 0.5 : 1 }}>
      <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: th(dot, "bg") }} />
      <Text style={{ fontSize: 13, color: th(INK.soft) }}>{label}</Text>
      <Text numberOfLines={1} style={[nums, { fontSize: 13.5, fontWeight: "700", color: th("#fff") }]}>
        {value}
      </Text>
    </View>
  );
}
