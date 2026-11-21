import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, Text, View, type TextStyle } from "react-native";
import Animated, { Easing, FadeIn, runOnJS, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Svg, { Circle, Defs, G, Line, LinearGradient as SvgGradient, Path, Stop } from "react-native-svg";
import { money } from "~/lib/money";
import { INK } from "~/theme/tokens";
import { th } from "~/theme/theme";

/**
 * The pieces the detail pages share — first drawn for a category's own page, which Larissa
 * chose as the pattern for every page after it: the period tabs with their sliding pill, the
 * line that draws itself in, the bars that rise from the floor, the legend, and the month
 * adding up day by day with the month before faintly behind it.
 */

const nums: TextStyle = Platform.select({ ios: { fontVariant: ["tabular-nums"] }, default: {} }) as TextStyle;
const H = 240;

/** Which stretch of time: equal slots, a pill sliding to the one chosen. */
export function PeriodTabs<T extends string>({ value, options, onChange }: { value: T; options: { key: T; label: string }[]; onChange: (p: T) => void }) {
  const [w, setW] = useState(0);
  const index = options.findIndex((p) => p.key === value);
  const x = useSharedValue(0);
  const slot = w > 0 ? (w - 8) / options.length : 0;
  useEffect(() => {
    x.set(withSpring(index * slot, { damping: 20, stiffness: 220, mass: 0.8 }));
  }, [index, slot, x]);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={{ flex: 1, flexDirection: "row", padding: 4, borderRadius: 26, borderWidth: 1, borderColor: th("rgba(255,255,255,0.10)", "line"), backgroundColor: th("rgba(255,255,255,0.05)", "bg") }}
    >
      {slot > 0 && <Animated.View pointerEvents="none" style={[{ position: "absolute", top: 4, left: 4, width: slot, height: 42, borderRadius: 21, backgroundColor: th("rgba(255,255,255,0.16)", "bg") }, pill]} />}
      {options.map((p) => {
        const on = value === p.key;
        return (
          <Pressable key={p.key} onPress={() => onChange(p.key)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={{ flex: 1, height: 42, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 16, fontWeight: on ? "700" : "500", color: th(on ? "#fff" : INK.soft) }}>{p.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const AnimatedPath = Animated.createAnimatedComponent(Path);
const DRAW = 4000;

/** A line drawing itself in, left to right. */
export function DrawnPath({ d, stroke, strokeWidth, opacity = 1 }: { d: string; stroke: string; strokeWidth: number; /** Under 1, a soft light rather than the line. */ opacity?: number }) {
  const left = useSharedValue(DRAW);
  useEffect(() => {
    left.set(withTiming(0, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [left]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: left.get() }));
  return <AnimatedPath d={d} stroke={stroke} strokeWidth={strokeWidth} strokeOpacity={opacity} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={`${DRAW} ${DRAW}`} animatedProps={props} />;
}

/** A bar that grows up from the floor, a beat after the one before it. */
export function GrowBar({ left, width, height, bottom, color, strong, delay }: { left: number; width: number; height: number; bottom: number; color: string; strong: boolean; delay: number }) {
  const h = useSharedValue(0);
  useEffect(() => {
    /* Eased, not sprung: it rises to its figure and stops there, never past the label above it. */
    h.set(withDelay(delay, withTiming(height, { duration: 620, easing: Easing.out(Easing.cubic) })));
  }, [h, height, delay]);
  const style = useAnimatedStyle(() => ({ height: Math.max(0, h.get()) }));
  return (
    <Animated.View style={[{ position: "absolute", left, width, bottom, borderRadius: width / 2, overflow: "hidden", backgroundColor: color, opacity: strong ? 1 : 0.4 }, style]}>
      {/* Lit from the left, deeper to the right: a capsule, not a flat block. */}
      <LinearGradient colors={["rgba(255,255,255,0.10)", "rgba(0,0,0,0)", "rgba(0,0,0,0.5)"]} locations={[0, 0.35, 1]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
    </Animated.View>
  );
}

/**
 * A bar for each stretch, after Larissa's reference: rounded capsules lit from the left in the
 * chart's colour (an empty stretch is a dot of the same colour), a quiet scale up the right side,
 * the stretch's name under each. The bars rise from the floor whenever the chart is drawn anew (a
 * new period). The one chosen — the latest at first — carries its figure in a small card of glass
 * floating beside it; a touch (or a finger slid along) chooses another.
 */
export function Bars({
  width,
  hex,
  bars,
  height = H,
  hidden,
}: {
  width: number;
  hex: string;
  /** `title`, when given, is what the card names the bar by ("Qua, 19 de nov"); the label otherwise. */
  bars: { label: string; value: number; on: boolean; title?: string }[];
  height?: number;
  hidden?: boolean;
}) {
  const AXIS = 48;
  const max = Math.max(1, ...bars.map((b) => b.value));
  const n = Math.max(1, bars.length);
  const left = 14;
  const slot = (width - left - AXIS) / n;
  const bw = Math.max(10, Math.min(34, slot * 0.5));
  const floor = 34;
  /* Room above the tallest bar for the card that reads it. */
  const room = height - floor - 58;
  /* The card opens on the latest stretch that had spending; on the one on show if none had. */
  let initial = -1;
  for (let i = bars.length - 1; i >= 0; i--) if (bars[i].value > 0) { initial = i; break; }
  if (initial < 0) initial = Math.max(0, bars.findIndex((b) => b.on));
  const [sel, setSel] = useState(initial);
  useEffect(() => setSel(initial), [initial, bars.length]);
  const lastIdx = useSharedValue(-1);
  const choose = useCallback((i: number) => {
    setSel(i);
    void Haptics.selectionAsync().catch(() => undefined);
  }, []);
  const gesture = useMemo(() => {
    const at = (px: number) => {
      "worklet";
      const i = Math.max(0, Math.min(n - 1, Math.floor((px - left) / slot)));
      if (i === lastIdx.get()) return;
      lastIdx.set(i);
      runOnJS(choose)(i);
    };
    const pan = Gesture.Pan()
      .activeOffsetX([-6, 6])
      .failOffsetY([-14, 14])
      .onStart((e) => {
        lastIdx.set(-1);
        at(e.x);
      })
      .onUpdate((e) => at(e.x));
    const tap = Gesture.Tap()
      .maxDistance(14)
      .onEnd((e) => {
        lastIdx.set(-1);
        at(e.x);
      });
    return Gesture.Exclusive(pan, tap);
  }, [n, slot, choose, lastIdx]);
  const heightOf = (v: number) => (v > 0 ? Math.max(bw, (v / max) * room) : bw);
  const picked = bars[sel];
  const pickedX = left + slot * sel + slot / 2;
  const scale = [max, max / 2, max / 4, 0];
  const fill = th(hex, "bg");
  return (
    <GestureDetector gesture={gesture}>
      <View style={{ height }}>
        {/* The scale, quiet, up the right side. */}
        {scale.map((v, i) => (
          <Text key={i} style={[nums, { position: "absolute", right: 6, width: AXIS - 6, textAlign: "right", bottom: floor + (v / max) * room - 9, fontSize: 12.5, color: th(INK.softer) }]}>
            {hidden && v > 0 ? "•••" : compact(v)}
          </Text>
        ))}
        {bars.map((b, i) => {
          const cx = left + slot * i + slot / 2;
          const on = i === sel;
          return (
            <View key={i} pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
              <GrowBar left={cx - bw / 2} width={bw} height={heightOf(b.value)} bottom={floor} color={fill} strong delay={i * 45} />
              <Text style={{ position: "absolute", left: cx - 30, width: 60, bottom: 6, textAlign: "center", fontSize: 13, fontWeight: on ? "700" : "500", color: th(on ? "#fff" : INK.soft) }}>{b.label}</Text>
            </View>
          );
        })}
        {picked && (
          <GlassTip
            key={sel}
            anchorX={pickedX}
            anchorY={height - floor - heightOf(picked.value)}
            gap={10}
            width={width - AXIS}
            title={picked.title ?? picked.label}
            rows={[{ color: fill, value: hidden ? "R$ •••" : money(picked.value) }]}
          />
        )}
      </View>
    </GestureDetector>
  );
}

/** A figure on a scale, short: 417, 1,2 mil. */
function compact(v: number) {
  if (v >= 10_000) return `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
  if (v >= 1000) return `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return String(Math.round(v));
}

/**
 * The figure a finger is on, after Larissa's reference: a small dark card set above the point
 * (above every line there), centred on it and kept inside the chart, so it never covers what
 * it reads. The day above, the figure under it — each line's, with its colour dot, side by side
 * on one row — never across a line break.
 */
function GlassTip({ anchorX, anchorY, gap, width, title, rows }: { anchorX: number; anchorY: number; gap: number; width: number; title: string; rows: { color: string; value: string; name?: string }[] }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  /* Measured first, unseen, at the left edge; then centred over the point. */
  const left = size.w === 0 ? 0 : Math.max(4, Math.min(width - size.w - 4, anchorX - size.w / 2));
  const top = Math.max(0, anchorY - gap - size.h);
  return (
    <Animated.View
      entering={FadeIn.duration(140)}
      pointerEvents="none"
      style={{ position: "absolute", left, top, opacity: size.w ? 1 : 0 }}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      <View style={{ paddingHorizontal: 13, paddingVertical: 8, borderRadius: 15, backgroundColor: th("rgba(26,27,31,0.96)", "bg"), borderWidth: 1, borderColor: th("rgba(255,255,255,0.10)", "line"), shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } }}>
        <Text numberOfLines={1} style={{ fontSize: 11.5, fontWeight: "500", color: th(INK.soft) }}>
          {title}
        </Text>
        <View style={{ marginTop: 2, flexDirection: "row", alignItems: "center", gap: 10 }}>
          {rows.map((r, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              {rows.length > 1 ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: r.color }} /> : null}
              <Text numberOfLines={1} style={[nums, { fontSize: rows.length > 1 ? 14 : 16, fontWeight: "700", letterSpacing: -0.3, color: th("#fff"), flexShrink: 0 }]}>
                {r.value}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

/* ───────── The line chart every page shares ───────── */

/** A curve through the points that never swings past them. */
export function curve(pts: { x: number; y: number }[], from = 0, to = pts.length - 1) {
  const n = pts.length;
  if (n === 0 || to <= from) return "";
  const sl: number[] = [];
  for (let i = 0; i < n - 1; i++) sl[i] = (pts[i + 1].y - pts[i].y) / (pts[i + 1].x - pts[i].x || 1);
  const t = new Array<number>(n).fill(0);
  if (n > 1) {
    t[0] = sl[0];
    t[n - 1] = sl[n - 2];
  }
  for (let i = 1; i < n - 1; i++) t[i] = sl[i - 1] * sl[i] <= 0 ? 0 : (sl[i - 1] + sl[i]) / 2;
  let d = `M ${pts[from].x.toFixed(1)} ${pts[from].y.toFixed(1)}`;
  for (let i = from; i < to; i++) {
    const h = pts[i + 1].x - pts[i].x;
    d += ` C ${(pts[i].x + h / 3).toFixed(1)} ${(pts[i].y + (t[i] * h) / 3).toFixed(1)} ${(pts[i + 1].x - h / 3).toFixed(1)} ${(pts[i + 1].y - (t[i + 1] * h) / 3).toFixed(1)} ${pts[i + 1].x.toFixed(1)} ${pts[i + 1].y.toFixed(1)}`;
  }
  return d;
}

export interface LineSeries {
  /** Running figures, one a point (a day), from the start; may stop before the axis ends. */
  values: number[];
  color: string;
  /** Its name in the pill ("Novembro", "Entradas"). */
  name: string;
  /** A soft fill of its colour under it. */
  fill?: boolean;
  /** Dashed all along — the month before, say. */
  dashed?: boolean;
  /** Solid up to this point, dashed after it (what is still to come). */
  split?: number;
  /** A point of light where it ends. */
  dot?: boolean;
}

const L_TOP = 60;
const L_FLOOR = 30;
const L_PAD = 18;

/**
 * The line chart of the app's pages, after Larissa's reference: smooth lines adding up point by
 * point over a soft fill, the stretch before dashed and quiet behind, a point of light where the
 * line is now, a thin floor with a few days under it. A touch on it — or a finger slid along —
 * reads the day under it in a pill at the top, each line's figure with its colour.
 */
export function LineChart({
  width,
  height = 240,
  span,
  series,
  labels,
  dayName,
  hidden,
  limit,
  tipValue,
}: {
  width: number;
  height?: number;
  /** When given, the card shows only this figure for the point touched (what was spent that
      day) instead of each line's running figure; null leaves the card off for that point. */
  tipValue?: (i: number) => number | null;
  /** The last point the axis holds (the month's last day). */
  span: number;
  series: LineSeries[];
  /** Kept for the callers; the axis now names the days that had movement. */
  labels?: { at: number; text: string }[];
  /** What the card calls a point ("19 de nov"). */
  dayName: (i: number) => string;
  hidden?: boolean;
  /** A dashed line across, for a limit. */
  limit?: number | null;
}) {
  const max = Math.max(1, ...series.flatMap((s) => s.values), limit ?? 0) * 1.1;
  const bottom = height - L_FLOOR;
  const inner = width - L_PAD * 2;
  const x = (i: number) => L_PAD + (i / Math.max(1, span)) * inner;
  const y = (v: number) => bottom - (v / max) * (bottom - L_TOP);
  const pts = series.map((s) => s.values.map((v, i) => ({ x: x(i), y: y(v) })));
  const longest = Math.max(1, ...series.map((s) => s.values.length));
  /* The line the card and the light follow: the one with a point of light (this month), or the first. */
  const mainK = Math.max(0, series.findIndex((s) => s.dot));
  const main = series[mainK];

  /* Under the floor, only the days something moved — the first, every day a figure changed (kept
     apart enough to read) and today. */
  const days = useMemo(() => {
    const at: number[] = [1];
    const n = Math.max(...series.filter((s) => !s.dashed).map((s) => s.values.length), 2);
    for (let i = 2; i < n; i++) if (series.some((s) => !s.dashed && i < s.values.length && Math.abs(s.values[i] - s.values[i - 1]) > 0.004)) at.push(i);
    const last = Math.min(n - 1, span);
    if (!at.includes(last)) at.push(last);
    const kept: number[] = [];
    for (const d of at) {
      const px = L_PAD + (d / Math.max(1, span)) * inner;
      const prev = kept.length ? L_PAD + (kept[kept.length - 1] / Math.max(1, span)) * inner : -99;
      if (px - prev >= 30) kept.push(d);
      else if (d === last) kept[kept.length - 1] = d;
    }
    return kept.map((d) => ({ at: d, text: String(d).padStart(2, "0") }));
  }, [series, span, inner]);

  /* Drawn anew (a new period, a new month), the chart rises from the floor. */
  const rise = useSharedValue(0);
  useEffect(() => {
    rise.set(withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }));
  }, [rise]);
  const rising = useAnimatedStyle(() => ({ opacity: 0.2 + rise.get() * 0.8, transform: [{ translateY: (1 - rise.get()) * 60 }, { scaleY: 0.35 + rise.get() * 0.65 }] }));

  const [pick, setPick] = useState<number | null>(null);
  const cx = useSharedValue(0);
  const shown = useSharedValue(0);
  const lastIdx = useSharedValue(-1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const choose = useCallback((i: number) => {
    if (timer.current) clearTimeout(timer.current);
    setPick(i);
    void Haptics.selectionAsync().catch(() => undefined);
  }, []);
  const release = useCallback((after: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setPick(null), after);
  }, []);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const gesture = useMemo(() => {
    const last = longest - 1;
    const go = (px: number) => {
      "worklet";
      const i = Math.max(0, Math.min(last, Math.round(((px - L_PAD) / inner) * span)));
      if (i === lastIdx.get()) return;
      lastIdx.set(i);
      cx.set(withTiming(L_PAD + (i / Math.max(1, span)) * inner, { duration: 90 }));
      runOnJS(choose)(i);
    };
    const pan = Gesture.Pan()
      .activeOffsetX([-6, 6])
      .failOffsetY([-14, 14])
      .onStart((e) => {
        lastIdx.set(-1);
        shown.set(withTiming(1, { duration: 140 }));
        go(e.x);
      })
      .onUpdate((e) => go(e.x))
      .onFinalize(() => {
        shown.set(withDelay(1200, withTiming(0, { duration: 400 })));
        runOnJS(release)(1600);
      });
    const tap = Gesture.Tap()
      .maxDistance(12)
      .onEnd((e) => {
        lastIdx.set(-1);
        shown.set(withTiming(1, { duration: 140 }));
        go(e.x);
        shown.set(withDelay(2400, withTiming(0, { duration: 400 })));
        runOnJS(release)(2800);
      });
    return Gesture.Exclusive(pan, tap);
  }, [inner, span, longest, cx, shown, lastIdx, choose, release]);
  const band = useAnimatedStyle(() => ({ opacity: shown.get(), transform: [{ translateX: cx.get() - 16 }] }));

  const floorInk = th("rgba(255,255,255,0.10)", "line");
  const gid = (k: number, c: string) => `lc-fill-${k}-${c.replace(/[^0-9a-z]/gi, "")}`;
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View entering={FadeIn.duration(360)} style={{ height }}>
        {/* The lit band under the finger. */}
        <Animated.View pointerEvents="none" style={[{ position: "absolute", top: L_TOP - 10, bottom: L_FLOOR, width: 32, borderRadius: 12, overflow: "hidden" }, band]}>
          <LinearGradient colors={["rgba(255,255,255,0.14)", "rgba(255,255,255,0.02)"]} style={{ flex: 1 }} />
        </Animated.View>
        <Animated.View style={[{ width, height, transformOrigin: "bottom" }, rising]}>
        <Svg width={width} height={height}>
          <Defs>
            {series.map((s, k) =>
              s.fill ? (
                <SvgGradient key={k} id={gid(k, s.color)} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={s.color} stopOpacity={0.28} />
                  <Stop offset="0.6" stopColor={s.color} stopOpacity={0.08} />
                  <Stop offset="1" stopColor={s.color} stopOpacity={0} />
                </SvgGradient>
              ) : null,
            )}
          </Defs>
          {/* The floor. */}
          <Line x1={0} x2={width} y1={bottom + 0.5} y2={bottom + 0.5} stroke={floorInk} strokeWidth={1} />
          {series.map((s, k) => {
            const p = pts[k];
            if (p.length < 2) return null;
            const split = s.split === undefined ? p.length - 1 : Math.max(0, Math.min(p.length - 1, s.split));
            const area = `${curve(p)} L ${p[p.length - 1].x.toFixed(1)} ${bottom} L ${p[0].x.toFixed(1)} ${bottom} Z`;
            const solid = s.dashed ? "" : curve(p, 0, split);
            const rest = s.dashed ? curve(p) : curve(p, split, p.length - 1);
            return (
              <G key={k}>
                {s.fill && <Path d={area} fill={`url(#${gid(k, s.color)})`} />}
                {rest ? <Path d={rest} stroke={s.color} strokeOpacity={s.dashed ? 0.55 : 0.7} strokeWidth={s.dashed ? 1.8 : 2.2} strokeDasharray="5 6" fill="none" strokeLinecap="round" /> : null}
                {solid ? <DrawnPath d={solid} stroke={s.color} strokeWidth={9} opacity={pick !== null ? 0.06 : 0.14} /> : null}
                {solid ? <DrawnPath d={solid} stroke={s.color} strokeWidth={2.8} opacity={pick !== null ? 0.35 : 1} /> : null}
                {/* Under the finger, the line is lit up to the day touched. */}
                {pick !== null && !s.dashed && pick > 0 ? <Path d={curve(p, 0, Math.min(pick, split))} stroke={s.color} strokeWidth={3} fill="none" strokeLinecap="round" /> : null}
              </G>
            );
          })}
          {limit != null && <Line x1={x(0)} x2={x(span)} y1={y(limit)} y2={y(limit)} stroke={th("#fff")} strokeOpacity={0.5} strokeWidth={1.4} strokeDasharray="6 6" />}
          {/* Where each line is now. */}
          {series.map((s, k) => {
            const p = pts[k];
            const end = p[s.split !== undefined ? Math.min(p.length - 1, s.split) : p.length - 1];
            if (!end) return null;
            if (s.dashed) return <Circle key={`d${k}`} cx={end.x} cy={end.y} r={4} fill={s.color} fillOpacity={0.7} />;
            if (!s.dot) return null;
            return (
              <G key={`d${k}`}>
                <Circle cx={end.x} cy={end.y} r={11} fill={s.color} fillOpacity={0.22} />
                <Circle cx={end.x} cy={end.y} r={5.5} fill={s.color} />
              </G>
            );
          })}
        </Svg>
        </Animated.View>
        {/* The points under the finger. */}
        {pick !== null &&
          series.map((s, k) =>
            pick < s.values.length ? (
              <View key={k} pointerEvents="none" style={{ position: "absolute", left: pts[k][pick].x - 6, top: pts[k][pick].y - 6, width: 12, height: 12, borderRadius: 6, borderWidth: 2.5, borderColor: s.color, backgroundColor: th("#fff", "bg") }} />
            ) : null,
          )}
        {pick !== null && (!tipValue || tipValue(pick) !== null) && (
          <GlassTip
            key={pick}
            anchorX={x(pick)}
            anchorY={Math.min(...series.filter((s) => pick < s.values.length).map((s) => y(s.values[pick])), bottom)}
            gap={12}
            width={width}
            title={dayName(pick)}
            rows={
              tipValue
                ? [{ color: main.color, value: hidden ? "R$ •••" : money(tipValue(pick) ?? 0) }]
                : series.filter((s) => pick < s.values.length).map((s) => ({ color: s.color, name: series.length > 1 ? s.name : undefined, value: hidden ? "R$ •••" : money(s.values[pick]) }))
            }
          />
        )}
        {/* The days. */}
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: 4, height: 18 }}>
          {days.map((l) => (
            <Text key={`${l.at}-${l.text}`} style={[nums, { position: "absolute", left: x(l.at) - 20, width: 40, textAlign: "center", fontSize: 12.5, color: th(l.at === pick ? "#fff" : INK.soft) }]}>
              {l.text}
            </Text>
          ))}
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

/** The days a month's axis names: the first of each week and the last, two digits each. */
export function monthLabels(last: number) {
  return [1, 8, 15, 22, last].filter((d, i, a) => a.indexOf(d) === i && (d === last || last - d >= 3)).map((d) => ({ at: d, text: String(d).padStart(2, "0") }));
}

export function Legend({ color, label, faint, dashed }: { color: string; label: string; faint?: boolean; dashed?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      {dashed ? (
        <View style={{ flexDirection: "row", gap: 3 }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ width: 6, height: 2.5, borderRadius: 2, backgroundColor: color }} />
          ))}
        </View>
      ) : (
        <View style={{ width: 22, height: 3, borderRadius: 2, backgroundColor: color, opacity: faint ? 0.4 : 1 }} />
      )}
      <Text style={{ fontSize: 14, color: th(INK.soft) }}>{label}</Text>
    </View>
  );
}

/**
 * A stretch adding up, point by point (a day, usually): its line drawing itself in over a
 * soft fill, the stretch before faintly behind it, a limit dashed over both if there is one.
 * `cur` and `prev` are running totals from 0; `span` is how many points the axis holds.
 */
export function PileChart({
  width,
  hex,
  cur,
  prev,
  span,
  labels,
  limit,
  height = H,
  prevColor,
}: {
  width: number;
  hex: string;
  cur: number[];
  prev?: number[] | null;
  /** The stretch before in its own quiet colour, dashed — grey on Gastos; the line's own, faint, when not given. */
  prevColor?: string;
  span: number;
  labels: { at: number; text: string }[];
  limit?: number | null;
  height?: number;
}) {
  const max = Math.max(1, ...cur, ...(prev ?? [0]), limit ?? 0) * 1.12;
  const top = 12;
  const bottom = height - 30;
  const x = (d: number) => 18 + (d / Math.max(1, span)) * (width - 36);
  const y = (v: number) => bottom - (v / max) * (bottom - top);
  const path = (pts: number[]) => {
    let p = `M ${x(0)} ${y(pts[0])}`;
    const step = Math.min(((width - 36) / Math.max(1, span)) * 0.8, 14);
    for (let d = 1; d < pts.length; d++) {
      const a = y(pts[d - 1]);
      const b = y(pts[d]);
      if (Math.abs(a - b) < 0.5) p += ` L ${x(d)} ${b}`;
      else p += ` L ${x(d) - step} ${a} C ${x(d) - step / 2} ${a} ${x(d) - step / 2} ${b} ${x(d)} ${b}`;
    }
    return p;
  };
  const line = path(cur);
  const area = `${line} L ${x(cur.length - 1)} ${bottom} L ${x(0)} ${bottom} Z`;
  const ink = th("#fff");
  const gid = `pile-${hex.replace(/[^0-9a-z]/gi, "")}`;
  return (
    <Animated.View entering={FadeIn.duration(360)}>
      <Svg width={width} height={height}>
        <Defs>
          <SvgGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={hex} stopOpacity={0.32} />
            <Stop offset="1" stopColor={hex} stopOpacity={0} />
          </SvgGradient>
        </Defs>
        {prev && prev.length > 1 && (prevColor ? <Path d={path(prev)} stroke={prevColor} strokeWidth={1.8} strokeDasharray="5 6" fill="none" strokeLinecap="round" /> : <Path d={path(prev)} stroke={hex} strokeOpacity={0.35} strokeWidth={2} fill="none" strokeLinecap="round" />)}
        <Path d={area} fill={`url(#${gid})`} />
        <DrawnPath d={line} stroke={hex} strokeWidth={3} />
        {limit != null && <Line x1={x(0)} x2={x(span)} y1={y(limit)} y2={y(limit)} stroke={ink} strokeOpacity={0.55} strokeWidth={1.6} strokeDasharray="6 6" />}
        <Circle cx={x(cur.length - 1)} cy={y(cur[cur.length - 1])} r={7} fill={ink} />
        <Circle cx={x(cur.length - 1)} cy={y(cur[cur.length - 1])} r={4} fill={hex} />
      </Svg>
      <View style={{ position: "absolute", left: 0, right: 0, top: height - 22, height: 20 }}>
        {labels.map((l) => (
          <Text key={`${l.at}-${l.text}`} style={[nums, { position: "absolute", left: x(l.at) - 14, width: 28, textAlign: "center", fontSize: 13, color: th(INK.soft) }]}>
            {l.text}
          </Text>
        ))}
      </View>
    </Animated.View>
  );
}
