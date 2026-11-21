import { useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, Text, View, useWindowDimensions, type TextStyle } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, Extrapolation, FadeIn, FadeInDown, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import type { AnalyticsTransaction, HistoricalMap } from "@/services/categoryAnalytics";
import type { CustomCategory } from "@/services/categoryService";
import { setHiddenValues, useHiddenValues } from "@/hooks/useHiddenValues";
import Room from "~/components/Room";
import RaisedButton from "~/components/RaisedButton";
import Surface from "~/components/Surface";
import CountUp from "~/components/CountUp";
import { Bars, Legend, LineChart, PeriodTabs, monthLabels } from "~/components/charts/PageCharts";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Eye, EyeOff } from "~/components/icons";
import { catColor } from "~/components/home/GastosPorCategoria";
import { categoryIcon } from "~/lib/categoryIcon";
import { chipFill, chipInk } from "~/lib/chip";
import { toTitleCase } from "@/lib/textCase";
import { useAuth } from "~/lib/auth";
import { money } from "~/lib/money";
import { useCategoryAnalytics } from "~/lib/warmStart";
import { GREEN, INK, RED } from "~/theme/tokens";
import { type as T } from "~/theme/type";
import { th, useThemeRedraw } from "~/theme/theme";

/**
 * Gastos: what the month has cost, and where it went — drawn the way a category's own page
 * is, the pattern every detail page follows.
 *
 * In the app's own quiet colours. Under the way back and the page's name: what was spent in
 * the period, large, with the eye beside its name, and how it compares with the same stretch
 * before — the change in green when it went down, in red when it went up. Its line across the
 * whole width in the one green, adding up day by day, the stretch before a grey dashed line
 * behind it — or, over a week, six months or a year, a bar a day or a month. The period under
 * it. Then the places money went most often (the week and the month, where each purchase is
 * known; a touch opens every visit to one) and the categories that took the most, with the way
 * to all of them.
 */

type Period = "1s" | "1m" | "6m" | "1a";
const PERIODS: { key: Period; label: string }[] = [
  { key: "1s", label: "1s" },
  { key: "1m", label: "1m" },
  { key: "6m", label: "6m" },
  { key: "1a", label: "1a" },
];
const nums: TextStyle = Platform.select({ ios: { fontVariant: ["tabular-nums"] }, default: {} }) as TextStyle;
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const WEEK = ["D", "S", "T", "Q", "Q", "S", "S"];
const WEEKDAY = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
/** The line and the bars: the one green. The stretch before: a quiet grey. */
const HEX = GREEN;
const BEFORE = "rgba(255,255,255,0.38)";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dayOf = (t: AnalyticsTransaction) => (t.date ?? "").slice(0, 10);
const spent = (list: AnalyticsTransaction[]) => list.filter((t) => t.type === "despesa");
const sum = (list: AnalyticsTransaction[]) => list.reduce((s, t) => s + (Number(t.amount) || 0), 0);
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const pct = (a: number, b: number) => `${Math.abs(((a - b) / b) * 100).toFixed(1).replace(".", ",")}%`;

/** Each month's total over the categories, for the months asked, oldest first. */
function monthTotals(maps: (HistoricalMap | undefined)[], months: { month: number; year: number }[]) {
  return months.map(({ month, year }) => {
    let total = 0;
    for (const map of maps) {
      if (!map) continue;
      for (const list of Object.values(map)) for (const e of list) if (e.month === month && e.year === year) total += e.amount;
    }
    return total;
  });
}

export default function Gastos() {
  useThemeRedraw();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const hidden = useHiddenValues();
  const [period, setPeriod] = useState<Period>("1m");

  const now = useMemo(() => new Date(), []);
  const month = now.getMonth();
  const year = now.getFullYear();
  const data = useCategoryAnalytics(user?.id, month, year);
  /* Six months further back, for the year — read only when the year is asked for. */
  const back6 = new Date(year, month - 6, 1);
  const older = useCategoryAnalytics(period === "1a" ? user?.id : undefined, back6.getMonth(), back6.getFullYear());
  const custom = useMemo<CustomCategory[]>(() => data?.customCats ?? [], [data]);
  const show = (v: number) => (hidden ? "R$ •••" : money(v));

  const view = useMemo(() => {
    const cur = spent(data?.transactions ?? []);
    const prev = spent(data?.prevTransactions ?? []);
    const today = now.getDate();
    const prevIdx = (month + 11) % 12;
    const v = (n: number) => (hidden ? "R$ •••" : money(n));

    if (period === "1m") {
      const last = new Date(year, month + 1, 0).getDate();
      const prevLast = new Date(year, month, 0).getDate();
      const run = (list: AnalyticsTransaction[], days: number, upTo: number) => {
        const per = new Array<number>(days + 1).fill(0);
        for (const t of list) {
          const d = Math.min(days, Math.max(1, Number(dayOf(t).slice(8, 10)) || 1));
          per[d] += Number(t.amount) || 0;
        }
        const out = [0];
        for (let d = 1; d <= upTo; d++) out.push(out[d - 1] + per[d]);
        return out;
      };
      const line = run(cur, last, today);
      const before = run(prev, prevLast, prevLast);
      /* The month's total is the categories' own (scheduled spending included), set against
         how last month closed. */
      const total = sum(cur);
      const closed = before[prevLast];
      return {
        label: `Gastos em ${MONTHS[month]}`,
        total,
        compare: closed > 0 ? { arrow: total > closed ? ("up" as const) : ("down" as const), pct: pct(total, closed), text: ` vs ${v(closed)} mês anterior` } : null,
        line: { cur: line, prev: before, span: last, labels: monthLabels(last), dayName: (i: number) => (i === 0 ? `Início de ${SHORT[month]}` : `${i} de ${SHORT[month]}`), names: [cap(MONTHS[month]), cap(MONTHS[prevIdx])] },
        bars: null,
        legend: [cap(MONTHS[month]), cap(MONTHS[prevIdx])],
        list: cur,
      };
    }

    if (period === "1s") {
      const all = [...cur, ...prev];
      const days: string[] = [];
      for (let i = 13; i >= 0; i--) days.push(iso(new Date(year, month, today - i)));
      const per = days.map((d) => sum(all.filter((t) => dayOf(t) === d)));
      const week = days.slice(7);
      const total = per.slice(7).reduce((s, x) => s + x, 0);
      const before = per.slice(0, 7).reduce((s, x) => s + x, 0);
      return {
        label: "Gastos nos últimos 7 dias",
        total,
        compare: before > 0 ? { arrow: total > before ? ("up" as const) : ("down" as const), pct: pct(total, before), text: ` vs ${v(before)} nos 7 dias antes` } : null,
        line: null,
        bars: week.map((d, i) => {
          const day = new Date(`${d}T12:00:00`);
          return { label: WEEK[day.getDay()], title: `${i === 6 ? "Hoje" : WEEKDAY[day.getDay()]}, ${day.getDate()} de ${SHORT[day.getMonth()]}`, value: per[7 + i], on: i === 6 };
        }),
        legend: null,
        list: all.filter((t) => week.includes(dayOf(t))),
      };
    }

    const n = period === "6m" ? 6 : 12;
    const months = Array.from({ length: n }, (_, i) => {
      const d = new Date(year, month - (n - 1) + i, 1);
      return { month: d.getMonth() + 1, year: d.getFullYear() };
    });
    const totals = monthTotals([data?.historical, older?.historical], months);
    const total = totals.reduce((s, x) => s + x, 0);
    return {
      label: `Gastos nos últimos ${n} meses`,
      total,
      compare: { arrow: null, pct: "", text: `Média de ${v(total / n)} por mês` },
      line: null,
      bars: months.map((m, i) => ({ label: SHORT[m.month - 1], title: `${cap(MONTHS[m.month - 1])} de ${m.year}`, value: totals[i], on: i === n - 1 })),
      legend: null,
      list: [] as AnalyticsTransaction[],
    };
  }, [data, older, period, now, month, year, hidden]);

  /* Where the money went most often: the week and the month, where each purchase is known. */
  const places = useMemo(() => {
    const map = new Map<string, { name: string; amount: number; count: number; cats: Map<string, number> }>();
    for (const t of view.list) {
      const name = (t.name || t.category || "").trim();
      if (!name) continue;
      const key = name.toLowerCase();
      const g = map.get(key) ?? { name, amount: 0, count: 0, cats: new Map() };
      g.amount += Number(t.amount) || 0;
      g.count += 1;
      g.cats.set(t.category, (g.cats.get(t.category) ?? 0) + 1);
      map.set(key, g);
    }
    return [...map.values()]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8)
      .map((g) => ({ ...g, category: [...g.cats.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Outros" }));
  }, [view.list]);

  /* The categories that took the most in the period. */
  const cats = useMemo(() => {
    const map = new Map<string, number>();
    if (period === "1s" || period === "1m") {
      for (const t of view.list) map.set(t.category, (map.get(t.category) ?? 0) + (Number(t.amount) || 0));
    } else {
      const n = period === "6m" ? 6 : 12;
      const keys = Array.from({ length: n }, (_, i) => {
        const d = new Date(year, month - (n - 1) + i, 1);
        return `${d.getMonth() + 1}-${d.getFullYear()}`;
      });
      for (const map0 of [data?.historical, older?.historical]) {
        if (!map0) continue;
        for (const [cat, list] of Object.entries(map0)) for (const e of list) if (keys.includes(`${e.month}-${e.year}`)) map.set(cat, (map.get(cat) ?? 0) + e.amount);
      }
    }
    const total = [...map.values()].reduce((s, x) => s + x, 0);
    return [...map.entries()]
      .filter(([, x]) => x > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name, amount], i) => ({ name, amount, share: total > 0 ? amount / total : 0, color: catColor(name, i, custom) }));
  }, [view.list, period, data, older, month, year, custom]);

  /* Once the figure has scrolled away, it sits under the page's name in the top row. */
  const y = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      y.set(e.contentOffset.y);
    },
  });
  const small = useAnimatedStyle(() => ({ opacity: interpolate(y.get(), [70, 110], [0, 1], Extrapolation.CLAMP) }));

  return (
    <Room lit sky>

      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 74, paddingBottom: insets.bottom + 60, paddingHorizontal: 16 }}>
        {/* What was spent; the figure travels to the new one when the period changes. */}
        <View style={{ paddingHorizontal: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <Animated.Text key={view.label} entering={FadeIn.duration(260)} numberOfLines={1} style={{ flexShrink: 1, fontSize: 17, color: th(INK.soft) }}>
              {view.label}
            </Animated.Text>
            <Pressable onPress={() => setHiddenValues(!hidden)} hitSlop={12} accessibilityRole="button" accessibilityLabel={hidden ? "Mostrar valores" : "Esconder valores"} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
              {hidden ? <EyeOff size={19} color={th(INK.soft)} strokeWidth={2} /> : <Eye size={19} color={th(INK.soft)} strokeWidth={2} />}
            </Pressable>
          </View>
          {hidden ? (
            <Text style={[nums, { marginTop: 4, fontSize: 44, fontWeight: "700", letterSpacing: -1.6, color: th("#fff") }]}>R$ •••</Text>
          ) : (
            <CountUp value={view.total} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[nums, { marginTop: 4, fontSize: 44, fontWeight: "700", letterSpacing: -1.6, color: th("#fff") }]} />
          )}
          {view.compare && (
            <View style={{ marginTop: 4, flexDirection: "row", alignItems: "center", gap: 4 }}>
              {view.compare.arrow === "up" && <ArrowUp size={15} color={th(RED)} strokeWidth={2.4} />}
              {view.compare.arrow === "down" && <ArrowDown size={15} color={th(GREEN)} strokeWidth={2.4} />}
              <Text numberOfLines={2} style={[nums, { flexShrink: 1, fontSize: 14.5, color: th(INK.soft) }]}>
                {view.compare.pct ? <Text style={{ fontWeight: "700", color: th(view.compare.arrow === "up" ? RED : GREEN) }}>{view.compare.pct}</Text> : null}
                {view.compare.text}
              </Text>
            </View>
          )}
        </View>

        {/* The chart, across the whole width. */}
        <Animated.View key={period} entering={FadeInDown.duration(420).easing(Easing.out(Easing.cubic))} style={{ marginTop: 24, marginHorizontal: -16 }}>
          {view.line ? (
            <LineChart
              width={width}
              span={view.line.span}
              labels={view.line.labels}
              dayName={view.line.dayName}
              hidden={hidden}
              tipValue={(i) => {
                /* What was spent on the day touched — this month's only, not the running total. */
                const c = view.line!.cur;
                return i >= 1 && i < c.length ? c[i] - c[i - 1] : null;
              }}
              series={[
                { values: view.line.prev, color: th(BEFORE, "line"), name: view.line.names[1], dashed: true },
                { values: view.line.cur, color: th(HEX), name: view.line.names[0], fill: true, dot: true },
              ]}
            />
          ) : (
            <Bars width={width} hex={HEX} bars={view.bars ?? []} hidden={hidden} />
          )}
        </Animated.View>

        {view.legend && (
          <View style={{ marginTop: 10, flexDirection: "row", gap: 18, paddingHorizontal: 4 }}>
            <Legend color={th(HEX)} label={view.legend[0]} />
            <Legend color={th(BEFORE, "line")} dashed label={view.legend[1]} />
          </View>
        )}

        {/* Which stretch of time. */}
        <View style={{ marginTop: 18, flexDirection: "row" }}>
          <PeriodTabs value={period} options={PERIODS} onChange={setPeriod} />
        </View>

        {/* Where it went most often. */}
        {places.length > 0 && (
          <>
            <Text style={[T.eyebrow, { marginTop: 30, paddingHorizontal: 4 }]}>Principais estabelecimentos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12, marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
              {places.map((p, i) => {
                const color = catColor(p.category, i, custom);
                const Icon = categoryIcon(p.category, custom);
                return (
                  <Surface
                    key={p.name}
                    radius={22}
                    onPress={() => router.push({ pathname: "/estabelecimento", params: { nome: p.name, periodo: period } } as never)}
                    style={{ width: 128, paddingVertical: 14, paddingHorizontal: 12 }}
                  >
                    <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: th(chipFill(color), "bg") }}>
                      <Icon size={17} color={th(chipInk(color))} strokeWidth={2.2} />
                    </View>
                    <Text numberOfLines={2} style={{ marginTop: 10, minHeight: 34, fontSize: 13, lineHeight: 17, fontWeight: "600", color: th("#fff") }}>
                      {toTitleCase(p.name)}
                    </Text>
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[nums, { marginTop: 6, fontSize: 15.5, fontWeight: "700", color: th("#fff") }]}>
                      {show(p.amount)}
                    </Text>
                    <Text style={{ marginTop: 2, fontSize: 12, color: th(INK.softer) }}>{p.count === 1 ? "1 vez" : `${p.count} vezes`}</Text>
                  </Surface>
                );
              })}
            </ScrollView>
          </>
        )}

        {/* The categories that took the most. */}
        {cats.length > 0 && (
          <>
            <Text style={[T.eyebrow, { marginTop: 30, paddingHorizontal: 4 }]}>Principais gastos por categoria</Text>
            <View style={{ marginTop: 6 }}>
              {cats.map((c, i) => {
                const Icon = categoryIcon(c.name, custom);
                return (
                  <Animated.View key={c.name} entering={FadeInDown.delay(40 + i * 35).duration(260)}>
                    <Pressable
                      onPress={() => router.push(`/analytics/categoria/${encodeURIComponent(c.name)}` as never)}
                      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12, opacity: pressed ? 0.7 : 1 })}
                    >
                      <View style={{ width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: th(chipFill(c.color), "bg") }}>
                        <Icon size={20} color={th(chipInk(c.color))} strokeWidth={2} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} style={{ fontSize: 15.5, fontWeight: "600", color: th("#fff") }}>
                          {c.name}
                        </Text>
                        <View style={{ marginTop: 6, flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <View style={{ flex: 1, maxWidth: 120, height: 4, borderRadius: 2, backgroundColor: th("rgba(255,255,255,0.10)", "bg") }}>
                            <View style={{ width: `${Math.max(3, c.share * 100)}%`, height: 4, borderRadius: 2, backgroundColor: th(c.color, "bg") }} />
                          </View>
                          <Text style={[nums, { fontSize: 12, fontWeight: "600", color: th(INK.soft) }]}>{`${Math.round(c.share * 100)}%`}</Text>
                        </View>
                      </View>
                      <Text style={[nums, { fontSize: 15, fontWeight: "600", color: th("#fff") }]}>{show(c.amount)}</Text>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>
            <Pressable
              onPress={() => router.push("/analytics/categorias" as never)}
              style={({ pressed }) => ({
                marginTop: 14,
                height: 54,
                borderRadius: 27,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                borderWidth: 1,
                borderColor: th("rgba(255,255,255,0.10)", "line"),
                backgroundColor: th("rgba(255,255,255,0.05)", "bg"),
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ fontSize: 16, fontWeight: "600", color: th("#fff") }}>Ver gastos por categoria</Text>
              <ChevronRight size={17} color={th(INK.soft)} />
            </Pressable>
          </>
        )}

        {!data && <Text style={{ marginTop: 30, textAlign: "center", fontSize: 15, color: th(INK.soft) }}>Carregando seus gastos…</Text>}
      </Animated.ScrollView>

      {/* The top row: back, and the page's name (with the figure under it once scrolled). */}
      <View pointerEvents="box-none" style={{ position: "absolute", top: 0, left: 0, right: 0, paddingTop: insets.top + 10, paddingHorizontal: 16, flexDirection: "row", alignItems: "center" }}>
        <RaisedButton label="Voltar" onPress={() => (router.canGoBack() ? router.back() : router.replace("/" as never))} size={50}>
          <ChevronLeft size={24} color={th("#fff")} strokeWidth={2.4} />
        </RaisedButton>
        <View pointerEvents="none" style={{ flex: 1, marginHorizontal: 10, alignItems: "center" }}>
          <Text numberOfLines={1} style={{ fontSize: 19, fontWeight: "700", letterSpacing: -0.3, color: th("#fff") }}>
            Gastos do mês
          </Text>
          <Animated.Text numberOfLines={1} style={[nums, small, { marginTop: 1, fontSize: 13, fontWeight: "600", color: th(INK.soft) }]}>
            {show(view.total)}
          </Animated.Text>
        </View>
        <View style={{ width: 50 }} />
      </View>
    </Room>
  );
}
