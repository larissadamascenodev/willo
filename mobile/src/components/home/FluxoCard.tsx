import { useEffect } from "react";
import { Platform, Text, View, type TextStyle } from "react-native";
import { useRouter } from "expo-router";
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import Surface from "~/components/Surface";
import { COMPACT_H } from "~/components/home/WidgetBoard";
import { money } from "~/lib/money";
import { GREEN, INK, RED } from "~/theme/tokens";
import { type as T } from "~/theme/type";
import { th } from "~/theme/theme";

/**
 * Fluxo do mês, on the home: one bar, split.
 *
 * What came in and what went out, each with its figure, then a single bar that is everything
 * that came in: the red part, from the left, is what has already gone out of it, the green that
 * is left is what remains, and a white mark stands where one turns into the other. Under it, how
 * much of what came in has gone, and what was left (or, once more went out than came in, the bar
 * all red and what was lacking). The money counted is the Fluxo de caixa page's own, which a
 * touch opens.
 *
 * Large, the two figures side by side; compact, one over the other.
 */

const nums: TextStyle = Platform.select({ ios: { fontVariant: ["tabular-nums"] }, default: {} }) as TextStyle;

export default function FluxoCard({ size, receitas, despesas, hidden }: { size: "half" | "full"; receitas: number; despesas: number; hidden?: boolean }) {
  const router = useRouter();
  const half = size === "half";
  const show = (v: number) => (hidden ? "R$ •••" : money(v));
  const net = receitas - despesas;
  const used = receitas > 0 ? despesas / receitas : despesas > 0 ? 1 : 0;
  const pct = receitas > 0 ? Math.round(used * 100) : null;
  const over = net < 0;

  return (
    <Surface
      onPress={() => router.push("/fluxo-de-caixa" as never)}
      style={{ height: half ? COMPACT_H : undefined, paddingHorizontal: half ? 14 : 18, paddingTop: half ? 15 : 18, paddingBottom: half ? 14 : 18 }}
    >
      <Text numberOfLines={1} style={[T.eyebrow, { color: th(INK.soft) }]}>
        Fluxo do mês
      </Text>

      {/* What came in and what went out. */}
      {half ? (
        <View style={{ marginTop: 10, gap: 8 }}>
          <Figure label="Entrou" value={show(receitas)} color={GREEN} size={19} />
          <Figure label="Saiu" value={hidden ? "R$ •••" : `−${money(despesas)}`} color={RED} size={19} />
        </View>
      ) : (
        <View style={{ marginTop: 14, flexDirection: "row", gap: 16 }}>
          <View style={{ flex: 1 }}>
            <Figure label="Entrou" value={show(receitas)} color={GREEN} size={22} />
          </View>
          <View style={{ flex: 1 }}>
            <Figure label="Saiu" value={hidden ? "R$ •••" : `−${money(despesas)}`} color={RED} size={22} />
          </View>
        </View>
      )}

      {/* Everything that came in, as one bar: what has gone out of it in red, what is left in green. */}
      <View style={{ marginTop: half ? "auto" : 20 }}>
        <SplitBar used={Math.min(1, used)} empty={receitas <= 0 && despesas <= 0} height={half ? 8 : 10} />
        <View style={{ marginTop: half ? 8 : 10, flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
          <Text numberOfLines={1} style={[nums, { flexShrink: 1, fontSize: half ? 11.5 : 13, color: th(INK.soft) }]}>
            {pct === null ? (
              "nada entrou ainda"
            ) : (
              <>
                <Text style={{ fontWeight: "700", color: th(over ? RED : "#fff") }}>{pct}%</Text>
                {half ? " já saiu" : " do que entrou já saiu"}
              </>
            )}
          </Text>
          {(receitas > 0 || despesas > 0) && (
            <Text numberOfLines={1} style={[nums, { fontSize: half ? 11.5 : 13, color: th(INK.soft) }]}>
              {half ? "" : over ? "faltou " : "sobrou "}
              <Text style={{ fontWeight: "700", color: th(over ? RED : GREEN) }}>{hidden ? "R$ •••" : `${over ? "−" : "+"}${money(Math.abs(net))}`}</Text>
            </Text>
          )}
        </View>
      </View>
    </Surface>
  );
}

/** One side of the month: a mark of its colour and its name, the figure under them. */
function Figure({ label, value, color, size }: { label: string; value: string; color: string; size: number }) {
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View style={{ width: 3, height: 11, borderRadius: 1.5, backgroundColor: th(color, "bg") }} />
        <Text style={{ fontSize: size > 20 ? 13.5 : 12.5, color: th(INK.soft) }}>{label}</Text>
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} style={[nums, { marginTop: 2, fontSize: size, fontWeight: "800", letterSpacing: -size * 0.03, color: th(color === RED ? RED : "#fff") }]}>
        {value}
      </Text>
    </View>
  );
}

/**
 * The bar: green all along (what came in), red growing from the left to the share that has gone
 * out, a white mark at its edge.
 */
function SplitBar({ used, empty, height }: { used: number; empty: boolean; height: number }) {
  const grow = useSharedValue(0);
  useEffect(() => {
    grow.set(withDelay(120, withTiming(used, { duration: 800, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System })));
  }, [grow, used]);
  const fill = useAnimatedStyle(() => ({ width: `${grow.get() * 100}%` }));
  const red = th(RED, "bg");
  const mark = th("#FFFFFF", "bg");
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: th(empty ? "rgba(255,255,255,0.08)" : GREEN, "bg") }}>
      {!empty && (
        <Animated.View style={[{ position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: height / 2, backgroundColor: red }, fill]}>
          {used > 0 && used < 1 && <View style={{ position: "absolute", right: -1.5, top: -3, bottom: -3, width: 3, borderRadius: 1.5, backgroundColor: mark }} />}
        </Animated.View>
      )}
    </View>
  );
}
