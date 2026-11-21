import { useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, Text, View, useWindowDimensions, type TextStyle } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, interpolate, Extrapolation } from "react-native-reanimated";
import Svg, { Circle, Defs, LinearGradient, Line, Path, Rect, Stop, Text as SvgText } from "react-native-svg";
import type { AnalyticsTransaction, HistoricalMap } from "@/services/categoryAnalytics";
import type { CustomCategory } from "@/services/categoryService";
import { setHiddenValues, useHiddenValues } from "@/hooks/useHiddenValues";
import Room from "~/components/Room";
import BackButton from "~/components/BackButton";
import RaisedButton from "~/components/RaisedButton";
import Surface from "~/components/Surface";
import SegmentedTabs from "~/components/SegmentedTabs";
import ScrollEdge from "~/components/ScrollEdge";
import { ArrowDown, ArrowUp, ChevronRight, Eye, EyeOff } from "~/components/icons";
import { catColor } from "~/components/home/GastosPorCategoria";
import { categoryIcon } from "~/lib/categoryIcon";
import { useAuth } from "~/lib/auth";
import { money } from "~/lib/money";
import { useCategoryAnalytics } from "~/lib/warmStart";
import { GREEN, INK, RED } from "~/theme/tokens";
import { th, useThemeRedraw } from "~/theme/theme";

/**
 * Gastos: what the month has cost, and where it went.
 *
 * The total for the period chosen (a week, the month, six months, a year), how it compares
 * with the same stretch before, and a line of it piling up day by day with the period before
 * dashed behind it — or, over months, a bar a month. Under it the places money went most
 * often (the week and the month only, where each purchase is known) and the categories that
 * took the most, with the way to all of them.
 *
 * As the page scrolls, the total moves up into the top row beside the way back.
 */

type Period = "1s" | "1m" | "6m" | "1a";
const nums: TextStyle = Platform.select({ ios: { fontVariant: ["tabular-nums"] }, default: {} }) as TextStyle;
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const WEEK = ["D", "S", "T", "Q", "Q", "S", "S"];
const CHART_H = 190;

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dayOf = (t: AnalyticsTransaction) => (t.date ?? "").slice(0, 10);
const spent = (list: AnalyticsTransaction[]) => list.filter((t) => t.type === "despesa");
const sum = (list: AnalyticsTransaction[]) => list.reduce((s, t) => s + (Number(t.amount) || 0), 0);

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

    if (period === "1m") {
      const last = new Date(year, month + 1, 0).getDate();
      const prevLast = new Date(year, month, 0).getDate();
      const byDay = (list: AnalyticsTransaction[], days: number) => {
        const out = new Array<number>(days + 1).fill(0);
        for (const t of list) {
          const d = Number(dayOf(t).slice(8, 10));
          if (d >= 1 && d <= days) out[d] += Number(t.amount) || 0;
        }
        for (let d = 1; d <= days; d++) out[d] += out[d - 1];
        return out;
      };
      const line = byDay(cur, last).slice(0, today + 1);
      const before = byDay(prev, prevLast);
      const total = line[today];
      const same = before[Math.min(today, prevLast)];
      return {
        title: `Gastos em ${MONTHS[month]}`,
        total,
        compare: same > 0 ? { pct: ((total - same) / same) * 100, base: same, label: `até o dia ${today} de ${SHORT[(month + 11) % 12]}` } : null,
        kind: "line" as const,
        line,
        before,
        span: Math.max(last, prevLast),
        labels: [
          { at: 1, text: "01" },
          { at: Math.min(8, today), text: "08" },
          { at: today, text: String(today).padStart(2, "0") },
        ].filter((l, i, a) => a.findIndex((x) => x.at === l.at) === i),
        list: cur,
        months: null as number[] | null,
      };
    }

    if (period === "1s") {
      const all = [...cur, ...prev];
      const days: string[] = [];
      for (let i = 13; i >= 0; i--) days.push(iso(new Date(year, month, today - i)));
      const per = days.map((d) => sum(all.filter((t) => dayOf(t) === d)));
      const cum = (from: number) => {
        const out = [0];
        for (let i = 0; i < 7; i++) out.push(out[i] + per[from + i]);
        return out;
      };
      const line = cum(7);
      const before = cum(0);
      const week = days.slice(7);
      return {
        title: "Gastos nos últimos 7 dias",
        total: line[7],
        compare: before[7] > 0 ? { pct: ((line[7] - before[7]) / before[7]) * 100, base: before[7], label: "nos 7 dias antes" } : null,
        kind: "line" as const,
        line,
        before,
        span: 7,
        labels: week.map((d, i) => ({ at: i + 1, text: WEEK[new Date(`${d}T12:00:00`).getDay()] })),
        list: all.filter((t) => week.includes(dayOf(t))),
        months: null as number[] | null,
      };
    }

    const n = period === "6m" ? 6 : 12;
    const months = Array.from({ length: n }, (_, i) => {
      const d = new Date(year, month - (n - 1) + i, 1);
      return { month: d.getMonth() + 1, year: d.getFullYear() };
    });
    const totals = monthTotals([data?.historical, older?.historical], months);
    const total = totals.reduce((s, v) => s + v, 0);
    return {
      title: `Gastos nos últimos ${n} meses`,
      total,
      compare: null,
      average: total / n,
      kind: "bars" as const,
      line: [] as number[],
      before: [] as number[],
      span: n,
      labels: months.map((m, i) => ({ at: i, text: SHORT[m.month - 1] })),
      list: [] as AnalyticsTransaction[],
      months: totals,
    };
  }, [data, older, period, now, month, year]);

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
    if (view.kind === "line") {
      for (const t of view.list) map.set(t.category, (map.get(t.category) ?? 0) + (Number(t.amount) || 0));
    } else {
      const n = view.span;
      const keys = Array.from({ length: n }, (_, i) => {
        const d = new Date(year, month - (n - 1) + i, 1);
        return `${d.getMonth() + 1}-${d.getFullYear()}`;
      });
      for (const map0 of [data?.historical, older?.historical]) {
        if (!map0) continue;
        for (const [cat, list] of Object.entries(map0)) for (const e of list) if (keys.includes(`${e.month}-${e.year}`)) map.set(cat, (map.get(cat) ?? 0) + e.amount);
      }
    }
    const total = [...map.values()].reduce((s, v) => s + v, 0);
    return [...map.entries()]
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name, amount], i) => ({ name, amount, share: total > 0 ? amount / total : 0, color: catColor(name, i, custom) }));
  }, [view, data, older, month, year, custom]);

  /* ── The top row takes the total once the big one has scrolled away ── */
  const y = useSharedValue(0);
  const [moved, setMoved] = useState(false);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      y.set(e.contentOffset.y);
    },
  });
  const small = useAnimatedStyle(() => ({ opacity: interpolate(y.get(), [70, 110], [0, 1], Extrapolation.CLAMP), transform: [{ translateY: interpolate(y.get(), [70, 110], [6, 0], Extrapolation.CLAMP) }] }));
  const big = useAnimatedStyle(() => ({ opacity: interpolate(y.get(), [20, 90], [1, 0], Extrapolation.CLAMP) }));

  const W = width - 32;
  const up = view.compare ? view.compare.pct > 0 : false;

  return (
    <Room lit sky>
      <Animated.ScrollView
        onScroll={onScroll}
        onScrollEndDrag={(e) => setMoved(e.nativeEvent.contentOffset.y > 8)}
        onMomentumScrollEnd={(e) => setMoved(e.nativeEvent.contentOffset.y > 8)}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 64, paddingBottom: insets.bottom + 48, paddingHorizontal: 16 }}
      >
        {/* The total, large. */}
        <Animated.View style={big}>
          <Text style={{ fontSize: 15, color: th(INK.soft) }}>{view.title}</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[nums, { marginTop: 4, fontSize: 42, fontWeight: "800", letterSpacing: -1.4, color: th("#fff") }]}>
            {show(view.total)}
          </Text>
          {view.compare ? (
            <View style={{ marginTop: 6, flexDirection: "row", alignItems: "center", gap: 4 }}>
              {up ? <ArrowUp size={15} color={th(RED)} strokeWidth={2.4} /> : <ArrowDown size={15} color={th(GREEN)} strokeWidth={2.4} />}
              <Text style={[nums, { fontSize: 14, fontWeight: "700", color: th(up ? RED : GREEN) }]}>{`${Math.abs(view.compare.pct).toFixed(1).replace(".", ",")}%`}</Text>
              <Text numberOfLines={1} style={[nums, { flexShrink: 1, fontSize: 14, color: th(INK.soft) }]}>{` vs ${show(view.compare.base)} ${view.compare.label}`}</Text>
            </View>
          ) : "average" in view && view.average ? (
            <Text style={[nums, { marginTop: 6, fontSize: 14, color: th(INK.soft) }]}>{`Média de ${show(view.average)} por mês`}</Text>
          ) : null}
        </Animated.View>

        {/* The period, drawn. */}
        <View style={{ marginTop: 26 }}>
          {view.kind === "line" ? <PileChart width={W} line={view.line} before={view.before} span={view.span} labels={view.labels} /> : <MonthBars width={W} totals={view.months ?? []} labels={view.labels} />}
        </View>

        <View style={{ marginTop: 18 }}>
          <SegmentedTabs
            glass
            value={period}
            onChange={setPeriod}
            options={[
              { key: "1s" as const, label: "1s" },
              { key: "1m" as const, label: "1m" },
              { key: "6m" as const, label: "6m" },
              { key: "1a" as const, label: "1a" },
            ]}
          />
        </View>

        {/* Where it went most often. */}
        {view.kind === "line" && places.length > 0 && (
          <>
            <Text style={{ marginTop: 30, marginLeft: 4, fontSize: 15, color: th(INK.soft) }}>Principais estabelecimentos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12, marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
              {places.map((p, i) => {
                const color = catColor(p.category, i, custom);
                const Icon = categoryIcon(p.category, custom);
                return (
                  <Surface key={p.name} radius={22} style={{ width: 136, paddingVertical: 16, paddingHorizontal: 12, alignItems: "center" }}>
                    <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: th(color, "bg") }}>
                      <Icon size={20} color="#FFFFFF" strokeWidth={2.2} />
                    </View>
                    <Text numberOfLines={1} style={{ marginTop: 12, fontSize: 13, fontWeight: "500", color: th(INK.soft) }}>
                      {p.name}
                    </Text>
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[nums, { marginTop: 6, fontSize: 16, fontWeight: "800", color: th("#fff") }]}>
                      {show(p.amount)}
                    </Text>
                    <Text style={{ marginTop: 3, fontSize: 12.5, color: th(INK.softer) }}>{p.count === 1 ? "1 vez" : `${p.count} vezes`}</Text>
                  </Surface>
                );
              })}
            </ScrollView>
          </>
        )}

        {/* The categories that took the most. */}
        {cats.length > 0 && (
          <>
            <Text style={{ marginTop: 30, marginLeft: 4, fontSize: 15, color: th(INK.soft) }}>Principais gastos por categoria</Text>
            <Surface radius={24} style={{ marginTop: 12, paddingHorizontal: 14, paddingVertical: 4 }}>
              {cats.map((c, i) => {
                const Icon = categoryIcon(c.name, custom);
                return (
                  <Pressable
                    key={c.name}
                    onPress={() => router.push(`/analytics/categoria/${encodeURIComponent(c.name)}` as never)}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      paddingVertical: 12,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: th("rgba(255,255,255,0.06)", "line"),
                      opacity: pressed ? 0.6 : 1,
                    })}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: th(c.color, "bg") }}>
                      <Icon size={18} color="#FFFFFF" strokeWidth={2.2} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{ fontSize: 15.5, fontWeight: "600", color: th("#fff") }}>
                        {c.name}
                      </Text>
                      <Text style={[nums, { marginTop: 2, fontSize: 13, color: th(INK.softer) }]}>{`${(c.share * 100).toFixed(1).replace(".", ",")}% do período`}</Text>
                    </View>
                    <Text style={[nums, { fontSize: 15.5, fontWeight: "700", color: th("#fff") }]}>{show(c.amount)}</Text>
                  </Pressable>
                );
              })}
            </Surface>
            <Pressable
              onPress={() => router.push("/analytics/categorias" as never)}
              style={({ pressed }) => ({
                marginTop: 14,
                height: 52,
                borderRadius: 26,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                borderWidth: 1,
                borderColor: th("rgba(255,255,255,0.12)", "line"),
                backgroundColor: th("rgba(255,255,255,0.07)", "bg"),
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ fontSize: 15, fontWeight: "600", color: th("#fff") }}>Ver gastos por categoria</Text>
              <ChevronRight size={16} color={th(INK.soft)} />
            </Pressable>
          </>
        )}

        {!data && <Text style={{ marginTop: 30, textAlign: "center", fontSize: 14, color: th(INK.softer) }}>Carregando seus gastos…</Text>}
      </Animated.ScrollView>

      {/* The top row: the way back, the total once scrolled, the eye. */}
      <ScrollEdge on={moved} />
      <View pointerEvents="box-none" style={{ position: "absolute", top: insets.top + 8, left: 16, right: 16, zIndex: 30, height: 44, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <BackButton to="/" />
        <Animated.Text numberOfLines={1} style={[nums, small, { flex: 1, fontSize: 19, fontWeight: "800", letterSpacing: -0.4, color: th("#fff") }]}>
          {show(view.total)}
        </Animated.Text>
        <RaisedButton label={hidden ? "Mostrar valores" : "Esconder valores"} onPress={() => setHiddenValues(!hidden)} size={44}>
          {hidden ? <EyeOff size={20} color={th("#fff")} /> : <Eye size={20} color={th("#fff")} />}
        </RaisedButton>
      </View>
    </Room>
  );
}

/* A curve through the points that never swings past them. */
function smooth(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return pts.length ? `M ${pts[0].x} ${pts[0].y}` : "";
  const n = pts.length;
  const s: number[] = [];
  for (let i = 0; i < n - 1; i++) s[i] = (pts[i + 1].y - pts[i].y) / (pts[i + 1].x - pts[i].x || 1);
  const t = new Array<number>(n).fill(0);
  t[0] = s[0];
  t[n - 1] = s[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = s[i - 1] * s[i] <= 0 ? 0 : (s[i - 1] + s[i]) / 2;
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = pts[i + 1].x - pts[i].x;
    d += ` C ${(pts[i].x + h / 3).toFixed(1)} ${(pts[i].y + (t[i] * h) / 3).toFixed(1)} ${(pts[i + 1].x - h / 3).toFixed(1)} ${(pts[i + 1].y - (t[i + 1] * h) / 3).toFixed(1)} ${pts[i + 1].x.toFixed(1)} ${pts[i + 1].y.toFixed(1)}`;
  }
  return d;
}

/** The period piling up day by day in the one green, the same stretch before dashed behind it. */
function PileChart({ width, line, before, span, labels }: { width: number; line: number[]; before: number[]; span: number; labels: { at: number; text: string }[] }) {
  const max = Math.max(1, ...line, ...before) * 1.08;
  const top = 12;
  const bottom = CHART_H - 26;
  const x = (i: number) => 6 + (i / Math.max(1, span)) * (width - 12);
  const yv = (v: number) => bottom - (v / max) * (bottom - top);
  const cur = line.map((v, i) => ({ x: x(i), y: yv(v) }));
  const prev = before.map((v, i) => ({ x: x(i), y: yv(v) }));
  const path = smooth(cur);
  const end = cur[cur.length - 1];
  const green = th(GREEN);
  return (
    <Svg width={width} height={CHART_H}>
      <Defs>
        <LinearGradient id="gastos-fill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={green} stopOpacity={0.32} />
          <Stop offset="1" stopColor={green} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      {prev.length > 1 && <Path d={smooth(prev)} stroke={th("rgba(255,255,255,0.35)", "line")} strokeWidth={1.6} strokeDasharray="5 6" fill="none" />}
      {cur.length > 1 && <Path d={`${path} L ${end.x.toFixed(1)} ${bottom} L ${cur[0].x.toFixed(1)} ${bottom} Z`} fill="url(#gastos-fill)" />}
      {cur.length > 1 && <Path d={path} stroke={green} strokeWidth={2.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
      {end && <Circle cx={end.x} cy={end.y} r={9} fill={green} fillOpacity={0.22} />}
      {end && <Circle cx={end.x} cy={end.y} r={5} fill={green} />}
      <Line x1={0} x2={width} y1={bottom + 1} y2={bottom + 1} stroke={th("rgba(255,255,255,0.1)", "line")} strokeWidth={1} />
      {labels.map((l) => (
        <SvgLabel key={`${l.at}-${l.text}`} x={x(l.at)} y={CHART_H - 6} text={l.text} />
      ))}
    </Svg>
  );
}

/** A bar a month, the current one lit. */
function MonthBars({ width, totals, labels }: { width: number; totals: number[]; labels: { at: number; text: string }[] }) {
  const max = Math.max(1, ...totals) * 1.08;
  const bottom = CHART_H - 26;
  const n = totals.length;
  const slot = width / Math.max(1, n);
  const bw = Math.min(26, slot * 0.56);
  const green = th(GREEN);
  return (
    <Svg width={width} height={CHART_H}>
      <Defs>
        <LinearGradient id="gastos-bar" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={green} stopOpacity={1} />
          <Stop offset="1" stopColor={green} stopOpacity={0.55} />
        </LinearGradient>
      </Defs>
      {totals.map((v, i) => {
        const h = Math.max(4, (v / max) * (bottom - 12));
        const cx = slot * i + slot / 2;
        const lit = i === n - 1;
        return <Rect key={i} x={cx - bw / 2} y={bottom - h} width={bw} height={h} rx={Math.min(8, bw / 2)} fill={lit ? "url(#gastos-bar)" : th("rgba(255,255,255,0.22)", "bg")} />;
      })}
      {labels.map((l) => (
        <SvgLabel key={`${l.at}-${l.text}`} x={slot * l.at + slot / 2} y={CHART_H - 6} text={l.text} />
      ))}
    </Svg>
  );
}

function SvgLabel({ x, y, text }: { x: number; y: number; text: string }) {
  return (
    <SvgText x={x} y={y} fontSize={11.5} fill={th(INK.softer)} textAnchor="middle">
      {text}
    </SvgText>
  );
}
