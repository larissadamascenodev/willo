import { useMemo, useState } from "react";
import { Platform, Text, View, type TextStyle } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { catColor } from "~/components/home/GastosPorCategoria";
import type { AnalyticsTransaction } from "@/services/categoryAnalytics";
import Surface from "~/components/Surface";
import { COMPACT_H } from "~/components/home/WidgetBoard";
import { ArrowDown, ArrowUp } from "~/components/icons";
import { useAuth } from "~/lib/auth";
import { money } from "~/lib/money";
import { useCategoryAnalytics } from "~/lib/warmStart";
import { GREEN, INK, RED } from "~/theme/tokens";
import { type as T } from "~/theme/type";
import { th } from "~/theme/theme";

/**
 * Gastos do mês, on the home, after Larissa's reference in the app's glass: the name in small
 * spaced capitals, what the month has cost, how it compares with the same days of last month
 * (green when it went down, red when it went up), a rule of thin bars across the card with each
 * of the biggest categories' share in its colour and the rest in grey, and those categories named
 * with what they took. A touch opens its page.
 *
 * Large, the comparison sits beside the figure with what last month had cost by the same day,
 * the rule is taller and four categories are named; compact, the comparison goes under the
 * figure, three are named and their figures drop the "R$" the total already says.
 */

const nums: TextStyle = Platform.select({ ios: { fontVariant: ["tabular-nums"] }, default: {} }) as TextStyle;
const spent = (list: AnalyticsTransaction[]) => list.filter((t) => t.type === "despesa");
const REST = "rgba(255,255,255,0.16)";

export default function GastosCard({ size, hidden }: { size: "half" | "full"; hidden?: boolean }) {
  const router = useRouter();
  const { user } = useAuth();
  const now = useMemo(() => new Date(), []);
  const month = now.getMonth();
  const year = now.getFullYear();
  const data = useCategoryAnalytics(user?.id, month, year);
  const [w, setW] = useState(0);

  const view = useMemo(() => {
    const today = now.getDate();
    const prevLast = new Date(year, month, 0).getDate();
    const mine = spent(data?.transactions ?? []);
    /* The month's total is the categories' own (what is scheduled for later in the month
       included), set against how last month closed — as its page does. */
    const total = mine.reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const toDate = total;
    const same = spent(data?.prevTransactions ?? []).reduce((s, t) => s + (Number(t.amount) || 0), 0);
    /* The categories that took the most. */
    const byCat = new Map<string, number>();
    for (const t of mine) byCat.set(t.category || "Outros", (byCat.get(t.category || "Outros") ?? 0) + (Number(t.amount) || 0));
    const cats = [...byCat.entries()].map(([name, amount]) => ({ name, amount })).filter((c) => c.amount > 0).sort((a, b) => b.amount - a.amount);
    return { total, toDate, same, cats };
  }, [data, now, month, year]);

  const half = size === "half";
  const show = (v: number) => (hidden ? "R$ •••" : money(v));
  const up = view.toDate > view.same;
  const pct = view.same > 0 ? `${Math.abs(((view.toDate - view.same) / view.same) * 100).toFixed(1).replace(".", ",")}%` : null;
  const Arrow = up ? ArrowUp : ArrowDown;
  const tone = up ? RED : GREEN;

  /* The biggest, each with its colour; the rest of the month in grey. */
  const top = view.cats.slice(0, half ? 3 : 4).map((c, i) => ({ ...c, color: catColor(c.name, i, data?.customCats) }));
  const tickW = half ? 3 : 3.5;
  const tickGap = half ? 3.5 : 4.5;
  const count = w > 0 ? Math.max(12, Math.floor((w + tickGap) / (tickW + tickGap))) : 0;
  const ticks = Array.from({ length: count }, (_, i) => {
    const at = ((i + 0.5) / count) * view.total;
    let run = 0;
    for (const c of top) {
      run += c.amount;
      if (at <= run) return c.color;
    }
    return null;
  });

  return (
    <Surface
      onPress={() => router.push("/gastos" as never)}
      style={{ height: half ? COMPACT_H : undefined, paddingHorizontal: half ? 14 : 18, paddingTop: half ? 15 : 18, paddingBottom: half ? 14 : 18 }}
    >
      <Text numberOfLines={1} style={[T.eyebrow, { color: th(INK.soft) }]}>
        Gastos do mês
      </Text>

      {half ? (
        <>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[T.figure, { marginTop: 6, fontSize: 24, letterSpacing: -0.8, opacity: data ? 1 : 0.4 }]}>
            {show(view.total)}
          </Text>
          {pct && (
            <View style={{ marginTop: 2, flexDirection: "row", alignItems: "center", gap: 3 }}>
              <Arrow size={12} color={th(tone)} strokeWidth={2.4} />
              <Text numberOfLines={1} style={[nums, { flexShrink: 1, fontSize: 12, color: th(INK.soft) }]}>
                <Text style={{ fontWeight: "700", color: th(tone) }}>{pct}</Text> vs mês anterior
              </Text>
            </View>
          )}
        </>
      ) : (
        /* The figure, and across from it how the same days of last month compare. */
        <View style={{ marginTop: 8, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[T.figure, { flexShrink: 1, fontSize: 30, letterSpacing: -1, opacity: data ? 1 : 0.4 }]}>
            {show(view.total)}
          </Text>
          {pct && (
            <View style={{ alignItems: "flex-end", paddingBottom: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <Arrow size={13} color={th(tone)} strokeWidth={2.4} />
                <Text style={[nums, { fontSize: 15, fontWeight: "700", color: th(tone) }]}>{pct}</Text>
              </View>
              <Text numberOfLines={1} style={[nums, { marginTop: 1, fontSize: 12, color: th(INK.soft) }]}>
                vs {show(view.same)}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* The month as a rule of thin bars, each category's share in its colour. */}
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ marginTop: half ? 12 : 16, height: half ? 18 : 22, flexDirection: "row", justifyContent: "space-between" }}>
        {ticks.map((c, i) => (
          <Animated.View
            key={i}
            entering={FadeIn.delay(80 + i * (half ? 16 : 12)).duration(240)}
            style={{ width: tickW, height: "100%", borderRadius: tickW / 2, backgroundColor: th(c ?? REST, "bg") }}
          />
        ))}
      </View>

      {/* The categories that took the most. */}
      <View style={{ marginTop: half ? "auto" : 16, gap: half ? 6 : 8 }}>
        {top.length === 0 ? (
          <Text style={{ fontSize: half ? 12.5 : 14, color: th(INK.soft) }}>Nenhum gasto ainda</Text>
        ) : (
          top.map((c) => (
            <View key={c.name} style={{ flexDirection: "row", alignItems: "center", gap: half ? 7 : 8 }}>
              <View style={{ width: 3, height: half ? 12 : 13, borderRadius: 1.5, backgroundColor: th(c.color, "bg") }} />
              <Text numberOfLines={1} style={{ flex: 1, fontSize: half ? 12.5 : 13.5, fontWeight: "500", color: th("#fff") }}>
                {c.name}
              </Text>
              {/* Compact, the figure without "R$" — the total above already says it — for room for the name. */}
              <Text style={[nums, { fontSize: half ? 12.5 : 13.5, fontWeight: "700", color: th("#fff") }]}>
                {half ? (hidden ? "•••" : money(c.amount).replace(/^R\$\s*/, "")) : show(c.amount)}
              </Text>
            </View>
          ))
        )}
      </View>
    </Surface>
  );
}
