import { useEffect } from "react";
import { Platform, Text, View, type TextStyle } from "react-native";
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { money } from "~/lib/money";
import { AMBER, GREEN, INK } from "~/theme/tokens";
import { th } from "~/theme/theme";

/**
 * The top of Transações, kept small: the month's Receitas and Despesas side by side — the whole
 * month, scheduled included. Each: its name with its dot, the figure, a thin bar in two pieces
 * (settled in its colour, pending in amber) and, under it, what is still pending with an amber
 * dot. Just enough that the page does not open on nothing.
 */

const nums: TextStyle = Platform.select({ ios: { fontVariant: ["tabular-nums"] }, default: {} }) as TextStyle;
/* The red of money going out, at full strength: the softer one reads grey on the dark. */
const LIVE_RED = "#FF4D4D";

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
  return (
    <View style={{ flexDirection: "row", gap: 22 }}>
      <Half color={GREEN} label="Receitas" total={receitas} done={recebido} waitLabel="a receber" show={show} delay={0} />
      <Half color={LIVE_RED} label="Despesas" total={despesas} done={pago} waitLabel="a pagar" show={show} delay={90} red />
    </View>
  );
}

function Half({ color, label, total, done, waitLabel, show, delay, red }: { color: string; label: string; total: number; done: number; waitLabel: string; show: (v: number) => string; delay: number; red?: boolean }) {
  const settled = Math.max(0, Math.min(done, total));
  const waiting = Math.max(0, total - settled);
  const share = total > 0 ? settled / total : 0;
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: th(color, "bg") }} />
        <Text style={{ fontSize: 13, color: th(INK.soft) }}>{label}</Text>
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[nums, { marginTop: 3, fontSize: 19, fontWeight: "800", letterSpacing: -0.5, color: th(red ? LIVE_RED : "#fff") }]}>
        {show(total)}
      </Text>
      <Split share={share} color={color} empty={total <= 0} delay={delay} />
      <View style={{ marginTop: 6, flexDirection: "row", alignItems: "center", gap: 5, opacity: waiting < 0.005 ? 0.5 : 1 }}>
        <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: th(AMBER, "bg") }} />
        <Text numberOfLines={1} style={[nums, { flexShrink: 1, fontSize: 12, color: th(INK.soft) }]}>
          {show(waiting)} {waitLabel}
        </Text>
      </View>
    </View>
  );
}

/** One thin bar: settled in its colour, the rest — pending — in amber, a hair apart. */
function Split({ share, color, empty, delay }: { share: number; color: string; empty: boolean; delay: number }) {
  const grow = useSharedValue(0);
  useEffect(() => {
    grow.set(withDelay(delay, withTiming(Math.max(0, Math.min(1, share)), { duration: 600, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System })));
  }, [grow, share, delay]);
  const done = useAnimatedStyle(() => ({ flexGrow: grow.get(), flexBasis: 0 }));
  const rest = useAnimatedStyle(() => ({ flexGrow: 1 - grow.get(), flexBasis: 0 }));
  return (
    <View style={{ marginTop: 8, height: 5, flexDirection: "row", gap: share > 0.001 && share < 0.999 ? 2 : 0, borderRadius: 999, overflow: "hidden", backgroundColor: th("rgba(255,255,255,0.07)", "bg") }}>
      {!empty && <Animated.View style={[{ height: "100%", borderRadius: 999, backgroundColor: th(color, "bg") }, done]} />}
      {!empty && <Animated.View style={[{ height: "100%", borderRadius: 999, backgroundColor: th(AMBER, "bg") }, rest]} />}
    </View>
  );
}
