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
const H = 210;

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
  return <Animated.View style={[{ position: "absolute", left, width, bottom, borderRadius: Math.min(12, width / 2), backgroundColor: color, opacity: strong ? 1 : 0.4 }, style]} />;
}

/**
 * A bar for each stretch. The one chosen is lit and its figure reads in a pill at the top of the
 * chart — the latest at first; a touch on another bar reads that one.
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
  /** `title`, when given, is what the pill names the bar by ("Quarta, 19 de nov"); the label otherwise. */
  bars: { label: string; value: number; on: boolean; title?: string }[];
  height?: number;
  hidden?: boolean;
}) {
  const max = Math.max(1, ...bars.map((b) => b.value)) * 1.08;
  const n = Math.max(1, bars.length);
  const slot = (width - 36) / n;
  const bw = Math.min(40, slot * 0.56);
  const floor = 30;
  const room = height - floor - 58;
  const initial = Math.max(0, bars.findIndex((b) => b.on));
  const [sel, setSel] = useState(initial);
  useEffect(() => setSel(initial), [initial, bars.length]);
  const choose = useCallback((i: number) => {
    setSel(i);
    void Haptics.selectionAsync().catch(() => undefined);
  }, []);
  const tap = useMemo(
    () =>
      Gesture.Tap()
        .maxDistance(14)
        .onEnd((e) => {
          const i = Math.max(0, Math.min(n - 1, Math.floor((e.x - 18) / slot)));
          runOnJS(choose)(i);
        }),
    [n, slot, choose],
  );
  const picked = bars[sel];
  return (
    <GestureDetector gesture={tap}>
      <View style={{ height }}>
        {bars.map((b, i) => {
          const h = b.value > 0 ? Math.max(6, (b.value / max) * room) : 4;
          const cx = 18 + slot * i + slot / 2;
          const on = i === sel;
          return (
            <View key={i} pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
              <GrowBar left={cx - bw / 2} width={bw} height={h} bottom={floor} color={th(hex, "bg")} strong={on} delay={i * 55} />
              <Text style={{ position: "absolute", left: cx - 24, width: 48, bottom: 6, textAlign: "center", fontSize: 12.5, fontWeight: on ? "700" : "400", color: th(on ? "#fff" : INK.soft) }}>{b.label}</Text>
            </View>
          );
        })}
        {picked && <ReadPill x={18 + slot * sel + slot / 2} width={width} title={picked.title ?? picked.label} rows={[{ color: th(hex), value: hidden ? "R$ •••" : money(picked.value) }]} />}
      </View>
    </GestureDetector>
  );
}

/** The figure a finger is on, in a small pill at the top of a chart. */
function ReadPill({ x, width, title, rows }: { x: number; width: number; title: string; rows: { color: string; value: string; name?: string }[] }) {
  const W = 176;
  const left = Math.max(8, Math.min(width - W - 8, x - W / 2));
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left, width: W, alignItems: "center" }}>
      <View style={{ minWidth: 112, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, borderCurve: "continuous", backgroundColor: th("rgba(28,30,34,0.94)", "bg"), borderWidth: 1, borderColor: th("rgba(255,255,255,0.12)", "line") }}>
        <Text numberOfLines={1} style={{ textAlign: "center", fontSize: 11.5, fontWeight: "600", color: th(INK.soft) }}>
          {title}
        </Text>
        {rows.map((r, i) => (
          <View key={i} style={{ marginTop: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: r.color }} />
            {r.name ? <Text style={{ fontSize: 12, color: th(INK.soft) }}>{r.name}</Text> : null}
            <Text numberOfLines={1} style={[nums, { fontSize: 14, fontWeight: "700", color: th("#fff") }]}>
              {r.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
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
}: {
  width: number;
  height?: number;
  /** The last point the axis holds (the month's last day). */
  span: number;
  series: LineSeries[];
  labels: { at: number; text: string }[];
  /** What the pill calls a point ("19 de nov"). */
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
                {solid ? <DrawnPath d={solid} stroke={s.color} strokeWidth={9} opacity={0.14} /> : null}
                {solid ? <DrawnPath d={solid} stroke={s.color} strokeWidth={2.8} /> : null}
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
        {/* The points under the finger. */}
        {pick !== null &&
          series.map((s, k) =>
            pick < s.values.length ? (
              <View key={k} pointerEvents="none" style={{ position: "absolute", left: pts[k][pick].x - 6, top: pts[k][pick].y - 6, width: 12, height: 12, borderRadius: 6, borderWidth: 2.5, borderColor: s.color, backgroundColor: th("#fff", "bg") }} />
            ) : null,
          )}
        {pick !== null && (
          <ReadPill
            x={x(pick)}
            width={width}
            title={dayName(pick)}
            rows={series.filter((s) => pick < s.values.length).map((s) => ({ color: s.color, name: series.length > 1 ? s.name : undefined, value: hidden ? "R$ •••" : money(s.values[pick]) }))}
          />
        )}
        {/* The days. */}
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: 4, height: 18 }}>
          {labels.map((l) => (
            <Text key={`${l.at}-${l.text}`} style={[nums, { position: "absolute", left: x(l.at) - 20, width: 40, textAlign: "center", fontSize: 12.5, color: th(INK.soft) }]}>
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
