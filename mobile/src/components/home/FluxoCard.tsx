import { useEffect, useMemo, useState } from "react";
import { Platform, Text, View, type TextStyle } from "react-native";
import { useRouter } from "expo-router";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import Surface from "~/components/Surface";
import { COMPACT_H } from "~/components/home/WidgetBoard";
import { money } from "~/lib/money";
import { GREEN, INK, RED } from "~/theme/tokens";
import { th } from "~/theme/theme";

/**
 * Fluxo do mês, on the home (Implementação 007, Hybrid Optimized V4.1).
 *
 * In this order: the title; "Saldo do mês" and the balance — what came in less what went out, the
 * one figure that stands out; a bar of segments, red for the share of what came in that has gone
 * out and green for what is left; the two percentages; a fine rule; then Entrou and Saiu, smaller.
 * The money is the home's own (the Fluxo de caixa page's), which a touch opens.
 *
 * Compact (half the board): Entrou and Saiu as two rows, a dot, the name on the left and the figure
 * on the right. Expanded (the whole width): the two side by side, the name over the figure. One
 * component for both; the sizes follow the card's own width.
 *
 * When more went out than came in, the bar is all red and nothing is shown as left; with nothing
 * in and nothing out, the bar is empty and the balance neutral.
 */

const nums: TextStyle = Platform.select({ ios: { fontVariant: ["tabular-nums"] }, default: {} }) as TextStyle;

const SPEC = {
  half: { radius: 19, pad: 12, title: 11, label: 10, value: 24, track: -1.1, segs: 24, segH: 14, segGap: 2, segR: 2, barTop: 13, barBottom: 6, legend: 9, rule: 11 },
  full: { radius: 21, pad: 16, title: 13, label: 11, value: 35, track: -1.5, segs: 40, segH: 19, segGap: 3, segR: 3, barTop: 17, barBottom: 7, legend: 11, rule: 15 },
} as const;

/* "R$ 1.234,56" → "1.234,56": the symbol is drawn on its own, smaller. */
const figure = (v: number) => money(Math.abs(v)).replace(/^R\$\s?/, "");

export default function FluxoCard({ size, receitas, despesas, hidden }: { size: "half" | "full"; receitas: number; despesas: number; hidden?: boolean }) {
  const router = useRouter();
  const half = size === "half";
  const s = SPEC[size];
  const [width, setWidth] = useState(0);

  const net = receitas - despesas;
  const nothing = receitas <= 0 && despesas <= 0;
  const deficit = net < 0;
  /* The share of what came in that has gone out; with nothing in, any spending is all of it. */
  const used = receitas > 0 ? despesas / receitas : despesas > 0 ? 1 : 0;
  const spentPct = receitas > 0 ? Math.round(used * 100) : null;
  const freePct = spentPct === null ? null : Math.max(0, 100 - spentPct);
  const spentSegs = nothing ? 0 : Math.min(s.segs, Math.round(Math.min(1, used) * s.segs));

  const tone = hidden ? "#fff" : net > 0 ? GREEN : net < 0 ? RED : "#fff";
  const sign = net < 0 && !hidden ? "−" : "";
  /* The balance as large as the card allows: its size follows the card's width and the digits. */
  const shown = hidden ? "•••" : figure(net);
  const fits = (fs: number) => (sign.length + shown.length) * fs * 0.6 + 2.4 * fs * 0.56 + fs * 0.3;
  const room = width - s.pad * 2;
  let valueSize: number = s.value;
  if (room > 0) while (valueSize > 14 && fits(valueSize) > room) valueSize -= 1;
  const symbolSize = Math.round(valueSize * 0.56);

  return (
    <Surface
      onPress={() => router.push("/fluxo-de-caixa" as never)}
      radius={s.radius}
      style={{ height: half ? COMPACT_H : undefined, padding: s.pad }}
    >
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width + s.pad * 2)} style={{ flex: half ? 1 : undefined }}>
        <Text numberOfLines={1} style={{ fontSize: s.title, fontWeight: "600", color: th(INK.soft) }}>
          Fluxo do mês
        </Text>

        {/* The balance: what is set to be left this month. */}
        <Text numberOfLines={1} style={{ marginTop: half ? 6 : 8, fontSize: s.label, color: th(INK.softer) }}>
          Saldo do mês
        </Text>
        <Text numberOfLines={1} accessibilityLabel={`Saldo do mês ${hidden ? "oculto" : `${sign}${money(Math.abs(net))}`}`} style={[nums, { marginTop: 1, color: th(tone) }]}>
          <Text style={{ fontSize: symbolSize, fontWeight: "600" }}>
            {sign}R${" "}
          </Text>
          <Text style={{ fontSize: valueSize, fontWeight: "600", letterSpacing: s.track }}>{shown}</Text>
        </Text>

        {/* What came in, as segments: red what has gone out of it, green what is left. */}
        <View style={{ marginTop: s.barTop }}>
          <Segments count={s.segs} red={spentSegs} empty={nothing} height={s.segH} gap={s.segGap} radius={s.segR} />
        </View>
        <View style={{ marginTop: s.barBottom, flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
          <Text numberOfLines={1} style={[nums, { fontSize: s.legend, color: th(INK.soft) }]}>
            {spentPct === null ? (nothing ? "Sem movimentações" : "Nada entrou ainda") : `${spentPct}% gasto`}
          </Text>
          <Text numberOfLines={1} style={[nums, { fontSize: s.legend, color: th(INK.soft) }]}>
            {deficit ? "Sem sobra" : freePct === null ? "" : `${freePct}% ${half ? "livre" : "restante"}`}
          </Text>
        </View>

        {/* A fine rule, then what came in and what went out — smaller than the balance. */}
        <View style={{ marginTop: s.rule, marginBottom: half ? 11 : 12, height: 1, backgroundColor: th("rgba(255,255,255,0.08)", "line") }} />
        {half ? (
          <View style={{ gap: 8 }}>
            <Row dot={GREEN} label="Entrou" value={hidden ? "R$ •••" : money(receitas)} tone="#fff" />
            <Row dot={RED} label="Saiu" value={hidden ? "R$ •••" : money(despesas)} tone={RED} />
          </View>
        ) : (
          <View style={{ flexDirection: "row", gap: 16 }}>
            <Column dot={GREEN} label="Entrou" value={hidden ? "•••" : figure(receitas)} tone="#fff" />
            <Column dot={RED} label="Saiu" value={hidden ? "•••" : figure(despesas)} tone={RED} />
          </View>
        )}
      </View>
    </Surface>
  );
}

/** Compact: a dot, the name on the left, the figure on the right — every figure on the same right edge. */
function Row({ dot, label, value, tone }: { dot: string; label: string; value: string; tone: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: th(dot, "bg") }} />
      <Text style={{ marginLeft: 5, flex: 1, fontSize: 10, color: th(INK.soft) }}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[nums, { fontSize: 11, fontWeight: "500", color: th(tone) }]}>
        {value}
      </Text>
    </View>
  );
}

/** Expanded: the name over the figure, the symbol small. */
function Column({ dot, label, value, tone }: { dot: string; label: string; value: string; tone: string }) {
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: th(dot, "bg") }} />
        <Text style={{ fontSize: 11, color: th(INK.soft) }}>{label}</Text>
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[nums, { marginTop: 6, color: th(tone) }]}>
        <Text style={{ fontSize: 12, fontWeight: "500" }}>R$ </Text>
        <Text style={{ fontSize: 19, fontWeight: "500", letterSpacing: -0.4 }}>{value}</Text>
      </Text>
    </View>
  );
}

/**
 * The bar of segments, filling from the base one after another (450 ms each, 9 ms apart). It plays
 * when what it shows changes, not on every redraw, and is simply there with reduced motion.
 */
function Segments({ count, red, empty, height, gap, radius }: { count: number; red: number; empty: boolean; height: number; gap: number; radius: number }) {
  const reduce = useReducedMotion();
  const clock = useSharedValue(reduce ? 1 : 0);
  const total = 450 + 9 * (count - 1);
  useEffect(() => {
    if (reduce) {
      clock.set(1);
      return;
    }
    clock.set(0);
    clock.set(withTiming(1, { duration: total, easing: Easing.linear }));
  }, [clock, red, empty, count, reduce, total]);
  /* Colours worked out here, never inside the animation. */
  const colors = useMemo(() => {
    const spent = th(RED, "bg");
    const left = th(GREEN, "bg");
    const none = th("rgba(255,255,255,0.08)", "bg");
    return Array.from({ length: count }, (_, i) => (empty ? none : i < red ? spent : left));
  }, [count, red, empty]);
  return (
    <View style={{ flexDirection: "row", gap, height }}>
      {colors.map((c, i) => (
        <Segment key={i} color={c} radius={radius} clock={clock} start={(9 * i) / total} span={450 / total} />
      ))}
    </View>
  );
}

function Segment({ color, radius, clock, start, span }: { color: string; radius: number; clock: SharedValue<number>; start: number; span: number }) {
  const style = useAnimatedStyle(() => {
    const t = Math.min(1, Math.max(0, (clock.get() - start) / span));
    const e = 1 - Math.pow(1 - t, 3);
    return { opacity: 0.25 + 0.75 * e, transform: [{ scaleY: 0.15 + 0.85 * e }] };
  });
  return <Animated.View style={[{ flex: 1, borderRadius: radius, backgroundColor: color, transformOrigin: "bottom" }, style]} />;
}
