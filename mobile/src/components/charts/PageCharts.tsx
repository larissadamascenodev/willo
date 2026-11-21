import { useEffect, useState } from "react";
import { Platform, Pressable, Text, View, type TextStyle } from "react-native";
import Animated, { Easing, FadeIn, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from "react-native-reanimated";
import Svg, { Circle, Defs, Line, LinearGradient as SvgGradient, Path, Stop } from "react-native-svg";
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
export function DrawnPath({ d, stroke, strokeWidth }: { d: string; stroke: string; strokeWidth: number }) {
  const left = useSharedValue(DRAW);
  useEffect(() => {
    left.set(withTiming(0, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [left]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: left.get() }));
  return <AnimatedPath d={d} stroke={stroke} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={`${DRAW} ${DRAW}`} animatedProps={props} />;
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

/** A bar for each stretch, the one on show lit with its figure over it. */
export function Bars({ width, hex, bars, height = H }: { width: number; hex: string; bars: { label: string; value: number; on: boolean }[]; height?: number }) {
  const max = Math.max(1, ...bars.map((b) => b.value)) * 1.15;
  const n = Math.max(1, bars.length);
  const slot = (width - 36) / n;
  const bw = Math.min(46, slot * 0.6);
  const floor = 30;
  const room = height - floor - 26;
  return (
    <View style={{ height }}>
      {bars.map((b, i) => {
        const h = b.value > 0 ? Math.max(6, (b.value / max) * room) : 4;
        const cx = 18 + slot * i + slot / 2;
        return (
          <View key={i} pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
            <GrowBar left={cx - bw / 2} width={bw} height={h} bottom={floor} color={th(hex, "bg")} strong={b.on} delay={i * 55} />
            {b.on && b.value > 0 && (
              <Animated.Text entering={FadeIn.delay(300 + i * 55).duration(300)} style={[nums, { position: "absolute", left: cx - 50, width: 100, bottom: floor + h + 6, textAlign: "center", fontSize: 13, fontWeight: "700", color: th("#fff") }]}>
                {money(b.value)}
              </Animated.Text>
            )}
            <Text style={{ position: "absolute", left: cx - 24, width: 48, bottom: 6, textAlign: "center", fontSize: 13, fontWeight: b.on ? "700" : "400", color: th(b.on ? "#fff" : INK.soft) }}>{b.label}</Text>
          </View>
        );
      })}
    </View>
  );
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
