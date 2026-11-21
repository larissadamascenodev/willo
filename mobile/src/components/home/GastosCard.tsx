import { useMemo, useState } from "react";
import { Platform, Text, View, type TextStyle } from "react-native";
import { useRouter } from "expo-router";
import type { AnalyticsTransaction } from "@/services/categoryAnalytics";
import Surface from "~/components/Surface";
import { PileChart } from "~/components/charts/PageCharts";
import { COMPACT_H } from "~/components/home/WidgetBoard";
import { ArrowDown, ArrowUp, ChevronRight } from "~/components/icons";
import { useAuth } from "~/lib/auth";
import { money } from "~/lib/money";
import { useCategoryAnalytics } from "~/lib/warmStart";
import { INK } from "~/theme/tokens";
import { type as T } from "~/theme/type";
import { th } from "~/theme/theme";

/**
 * Gastos do mês, on the home: what the month has cost so far, how it compares with the same
 * days of last month, and its line adding up day by day with last month faint behind it — in
 * Willo's violet, as on its page, which a touch opens. Compact, the figure and the comparison
 * with a smaller line under them.
 */

const nums: TextStyle = Platform.select({ ios: { fontVariant: ["tabular-nums"] }, default: {} }) as TextStyle;
const HEX = "#8B5CF6";

const spent = (list: AnalyticsTransaction[]) => list.filter((t) => t.type === "despesa");

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
    return { cur, prev, total, toDate, same, span: last };
  }, [data, now, month, year]);

  const show = (v: number) => (hidden ? "R$ •••" : money(v));
  const up = view.toDate > view.same;
  const pct = view.same > 0 ? `${Math.abs(((view.toDate - view.same) / view.same) * 100).toFixed(1).replace(".", ",")}%` : null;
  const half = size === "half";

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
          {up ? <ArrowUp size={13} color={th(INK.soft)} strokeWidth={2.2} /> : <ArrowDown size={13} color={th(INK.soft)} strokeWidth={2.2} />}
          <Text numberOfLines={1} style={[nums, { flexShrink: 1, fontSize: half ? 12 : 13.5, color: th(INK.soft) }]}>
            {half ? `${pct} até hoje vs mês anterior` : `${pct} até hoje vs o mesmo período do mês anterior`}
          </Text>
        </View>
      )}
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ marginTop: half ? "auto" : 6, marginHorizontal: half ? -14 : -16 }}>
        {w > 0 && <PileChart width={w} hex={th(HEX)} cur={view.cur} prev={view.prev} span={view.span} labels={[]} height={half ? 92 : 120} />}
      </View>
    </Surface>
  );
}
