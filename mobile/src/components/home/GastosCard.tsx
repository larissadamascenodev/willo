import { useMemo, useState } from "react";
import { Platform, Text, View, type TextStyle } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { catColor } from "~/components/home/GastosPorCategoria";
import type { AnalyticsTransaction } from "@/services/categoryAnalytics";
import Surface from "~/components/Surface";
import { PileChart } from "~/components/charts/PageCharts";
import { COMPACT_H } from "~/components/home/WidgetBoard";
import { ArrowDown, ArrowUp, ChevronRight } from "~/components/icons";
import { useAuth } from "~/lib/auth";
import { money } from "~/lib/money";
import { useCategoryAnalytics } from "~/lib/warmStart";
import { GREEN, INK, RED } from "~/theme/tokens";
import { type as T } from "~/theme/type";
import { th } from "~/theme/theme";

/**
 * Gastos do mês, on the home: what the month has cost so far, how it compares with the same
 * days of last month (the change in green when it went down, in red when it went up), and its
 * line adding up day by day in the one green with last month a grey dashed line behind it, as on
 * its page, which a touch opens. Compact, after Larissa's reference: the name in small spaced
 * capitals, the figure, the comparison, a rule of little bars with each of the three biggest
 * categories' share in its colour (the rest in grey), and those three named with what they took.
 */

const nums: TextStyle = Platform.select({ ios: { fontVariant: ["tabular-nums"] }, default: {} }) as TextStyle;
/* The line in the one green, last month a grey dashed line behind it. */
const HEX = GREEN;
const BEFORE = "rgba(255,255,255,0.38)";

const spent = (list: AnalyticsTransaction[]) => list.filter((t) => t.type === "despesa");
/* The compact card's rule: thin bars, evenly spaced across its width. */
const TICK_W = 3;
const TICK_GAP = 3.5;

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
    const last = new Date(year, month + 1, 0).getDate();
    const prevLast = new Date(year, month, 0).getDate();
    const run = (list: AnalyticsTransaction[], days: number, upTo: number) => {
      const per = new Array<number>(days + 1).fill(0);
      for (const t of list) {
        const d = Math.min(days, Math.max(1, Number((t.date ?? "").slice(8, 10)) || 1));
        per[d] += Number(t.amount) || 0;
      }
      const out = [0];
      for (let d = 1; d <= upTo; d++) out.push(out[d - 1] + per[d]);
      return out;
    };
    const mine = spent(data?.transactions ?? []);
    const cur = run(mine, last, today);
    const prev = run(spent(data?.prevTransactions ?? []), prevLast, prevLast);
    /* The month's total is the categories' own (what is scheduled for later in the month
       included); the comparison is fair only day for day, so it uses the days so far. */
    const total = mine.reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const toDate = cur[today];
    const same = prev[Math.min(today, prevLast)];
    /* The categories that took the most, for the compact card's rule and lines. */
    const byCat = new Map<string, number>();
    for (const t of mine) byCat.set(t.category || "Outros", (byCat.get(t.category || "Outros") ?? 0) + (Number(t.amount) || 0));
    const cats = [...byCat.entries()].map(([name, amount]) => ({ name, amount })).filter((c) => c.amount > 0).sort((a, b) => b.amount - a.amount);
    return { cur, prev, total, toDate, same, span: last, cats };
  }, [data, now, month, year]);

  const show = (v: number) => (hidden ? "R$ •••" : money(v));
  const up = view.toDate > view.same;
  const pct = view.same > 0 ? `${Math.abs(((view.toDate - view.same) / view.same) * 100).toFixed(1).replace(".", ",")}%` : null;
  const half = size === "half";

  if (half) {
    /* The three biggest, each with its colour; the rest of the month in grey. */
    const top = view.cats.slice(0, 3).map((c, i) => ({ ...c, color: catColor(c.name, i, data?.customCats) }));
    const count = w > 0 ? Math.max(12, Math.floor((w + TICK_GAP) / (TICK_W + TICK_GAP))) : 0;
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
      <Surface onPress={() => router.push("/gastos" as never)} style={{ height: COMPACT_H, paddingHorizontal: 14, paddingTop: 15, paddingBottom: 14 }}>
        <Text numberOfLines={1} style={[T.eyebrow, { color: th(INK.soft) }]}>
          Gastos do mês
        </Text>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[T.figure, { marginTop: 6, fontSize: 24, letterSpacing: -0.8, opacity: data ? 1 : 0.4 }]}>
          {show(view.total)}
        </Text>
        {pct && (
          <View style={{ marginTop: 2, flexDirection: "row", alignItems: "center", gap: 3 }}>
            {up ? <ArrowUp size={12} color={th(RED)} strokeWidth={2.4} /> : <ArrowDown size={12} color={th(GREEN)} strokeWidth={2.4} />}
            <Text numberOfLines={1} style={[nums, { flexShrink: 1, fontSize: 12, color: th(INK.soft) }]}>
              <Text style={{ fontWeight: "700", color: th(up ? RED : GREEN) }}>{pct}</Text> vs mês anterior
            </Text>
          </View>
        )}

        {/* The month as a rule of little bars, each category's share in its colour. */}
        <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ marginTop: 12, height: 18, flexDirection: "row", justifyContent: "space-between" }}>
          {ticks.map((c, i) => (
            <Animated.View
              key={i}
              entering={FadeIn.delay(80 + i * 16).duration(240)}
              style={{ width: TICK_W, height: 18, borderRadius: TICK_W / 2, backgroundColor: th(c ?? "rgba(255,255,255,0.16)", "bg") }}
            />
          ))}
        </View>

        {/* The three that took the most. */}
        <View style={{ marginTop: "auto", gap: 6 }}>
          {top.length === 0 ? (
            <Text style={{ fontSize: 12.5, color: th(INK.soft) }}>Nenhum gasto ainda</Text>
          ) : (
            top.map((c) => (
              <View key={c.name} style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                <View style={{ width: 3, height: 12, borderRadius: 1.5, backgroundColor: th(c.color, "bg") }} />
                <Text numberOfLines={1} style={{ flex: 1, fontSize: 12.5, fontWeight: "500", color: th("#fff") }}>
                  {c.name}
                </Text>
                {/* The figure without "R$", as the total above already says it: more room for the name. */}
                <Text style={[nums, { fontSize: 12.5, fontWeight: "700", color: th("#fff") }]}>{hidden ? "•••" : money(c.amount).replace(/^R\$\s*/, "")}</Text>
              </View>
            ))
          )}
        </View>
      </Surface>
    );
  }

  return (
    <Surface onPress={() => router.push("/gastos" as never)} style={{ height: half ? COMPACT_H : undefined, paddingHorizontal: half ? 14 : 16, paddingTop: 14, paddingBottom: half ? 12 : 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <Text numberOfLines={1} style={[T.cardLabel, { flex: 1 }]}>
          Gastos do mês
        </Text>
        <ChevronRight size={16} color={th(INK.faint)} />
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[T.figure, { marginTop: 4, fontSize: half ? 22 : 30, opacity: data ? 1 : 0.4 }]}>
        {show(view.total)}
      </Text>
      {pct && (
        <View style={{ marginTop: 4, flexDirection: "row", alignItems: "center", gap: 4 }}>
          {up ? <ArrowUp size={13} color={th(RED)} strokeWidth={2.4} /> : <ArrowDown size={13} color={th(GREEN)} strokeWidth={2.4} />}
          <Text numberOfLines={1} style={[nums, { flexShrink: 1, fontSize: half ? 12 : 13.5, color: th(INK.soft) }]}>
            <Text style={{ fontWeight: "700", color: th(up ? RED : GREEN) }}>{pct}</Text>
            {half ? " vs mês anterior" : ` vs ${show(view.same)} no mesmo período do mês anterior`}
          </Text>
        </View>
      )}
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ marginTop: half ? "auto" : 6, marginHorizontal: half ? -14 : -16 }}>
        {w > 0 && <PileChart width={w} hex={th(HEX)} cur={view.cur} prev={view.prev} prevColor={th(BEFORE, "line")} span={view.span} labels={[]} height={half ? 92 : 120} />}
      </View>
    </Surface>
  );
}
