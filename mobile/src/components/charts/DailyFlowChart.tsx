import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, Text, View, type TextStyle } from "react-native";
import Animated, { Easing, runOnJS, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Svg, { Circle, Defs, G, Line, LinearGradient as SvgGradient, Path, Stop } from "react-native-svg";
import { INK } from "~/theme/tokens";
import { isLight, th } from "~/theme/theme";

/**
 * Daily Precision (Update 007): the money that moved each day of the month — never added up — as
 * two fluid lines over a soft fill, green for what came in and red for what went out, on one shared
 * scale. Days already past with nothing are zero; days still to come are not drawn at all in a
 * month under way. The month before, when asked for, dashed and faint behind, without a fill.
 *
 * A finger on it (Glass Touch) reads the day under it: a dotted line, a dot on each curve, and a
 * small card of glass above the drawing — never over the lines — that goes when the finger lifts.
 * A light tap of the phone only when the day changes.
 */

const nums: TextStyle = Platform.select({ ios: { fontVariant: ["tabular-nums"] }, default: {} }) as TextStyle;
const TIP_W = 146;
const TOP = 62; // room above the drawing, for the card
const FLOOR = 26;
const PAD = 18;
const AnimatedPath = Animated.createAnimatedComponent(Path);
const DRAW = 4000;

/**
 * A soft line through the days: each step eases out of one day and into the next (level at every
 * point), so a day's figure rises and settles as a rounded hill — never past the figures it joins,
 * never below zero, no peak that is not in the data.
 */
function soft(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const mid = (b.x - a.x) * 0.5;
    d += ` C ${(a.x + mid).toFixed(1)} ${a.y.toFixed(1)} ${(b.x - mid).toFixed(1)} ${b.y.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
  }
  return d;
}

export interface DayLine {
  /** Cents per day, index 1..last (0 unused). */
  per: number[];
  color: string;
  name: string;
  /** The month before: dashed, faint, no fill. */
  past?: boolean;
}

function Drawn({ d, stroke, width, opacity, reduce }: { d: string; stroke: string; width: number; opacity: number; reduce: boolean }) {
  const left = useSharedValue(reduce ? 0 : DRAW);
  useEffect(() => {
    if (reduce) return;
    left.set(withTiming(0, { duration: 800, easing: Easing.out(Easing.cubic) }));
  }, [left, reduce]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: left.get() }));
  return <AnimatedPath d={d} stroke={stroke} strokeWidth={width} strokeOpacity={opacity} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={`${DRAW} ${DRAW}`} animatedProps={props} />;
}

export default function DailyFlowChart({
  width,
  height = 236,
  last,
  upto,
  today,
  lines,
  hidden,
  dayName,
  money,
}: {
  width: number;
  height?: number;
  /** The month's last day. */
  last: number;
  /** The last day drawn: today in a month under way, the last day of one that is over. */
  upto: number;
  /** Today's day, marked on the axis, in a month under way. */
  today: number | null;
  lines: DayLine[];
  hidden?: boolean;
  dayName: (d: number) => string;
  money: (cents: number) => string;
}) {
  const reduce = useReducedMotion();
  const light = isLight();
  const bottom = height - FLOOR;
  const inner = width - PAD * 2;
  const x = (d: number) => PAD + ((d - 1) / Math.max(1, last - 1)) * inner;
  /* One scale for everything on show, a little room on top. */
  const max = Math.max(100, ...lines.flatMap((l) => l.per.slice(1, (l.past ? l.per.length - 1 : upto) + 1))) * 1.15;
  const y = (c: number) => bottom - (c / max) * (bottom - TOP);
  const pts = lines.map((l) => {
    const end = l.past ? Math.min(last, l.per.length - 1) : upto;
    return Array.from({ length: Math.max(0, end) }, (_, i) => ({ x: x(i + 1), y: y(l.per[i + 1] ?? 0) }));
  });

  /* Glass Touch. */
  const [pick, setPick] = useState<number | null>(null);
  const shown = useSharedValue(0);
  const lastDay = useSharedValue(-1);
  const choose = useCallback((d: number) => {
    setPick(d);
    void Haptics.selectionAsync().catch(() => undefined);
  }, []);
  const clear = useCallback(() => setPick(null), []);
  const gesture = useMemo(() => {
    const at = (px: number) => {
      "worklet";
      const d = Math.max(1, Math.min(upto, Math.round(((px - PAD) / inner) * (last - 1)) + 1));
      if (d === lastDay.get()) return;
      lastDay.set(d);
      runOnJS(choose)(d);
    };
    const begin = (px: number) => {
      "worklet";
      lastDay.set(-1);
      shown.set(withTiming(1, { duration: reduce ? 0 : 90 }));
      at(px);
    };
    const end = () => {
      "worklet";
      shown.set(withTiming(0, { duration: reduce ? 0 : 160 }, (done) => {
        if (done) runOnJS(clear)();
      }));
    };
    const pan = Gesture.Pan()
      .activeOffsetX([-6, 6])
      .failOffsetY([-14, 14])
      .onStart((e) => begin(e.x))
      .onUpdate((e) => at(e.x))
      .onFinalize(() => end());
    const hold = Gesture.LongPress()
      .minDuration(120)
      .maxDistance(10)
      .onStart((e) => begin(e.x))
      .onFinalize(() => end());
    return Gesture.Race(pan, hold);
  }, [upto, last, inner, choose, clear, shown, lastDay, reduce]);
  const fade = useAnimatedStyle(() => ({ opacity: shown.get() }));

  const axis = useMemo(() => [1, 8, 15, 22, last].filter((d, i, a) => a.indexOf(d) === i && (d === last || last - d >= 3)), [last]);
  const floorInk = th("rgba(255,255,255,0.10)", "line");
  const gid = (k: number) => `dfc-${k}`;
  const tipLeft = pick === null ? 0 : Math.max(6, Math.min(width - TIP_W - 6, x(pick) - TIP_W / 2));
  const current = lines.filter((l) => !l.past);

  return (
    <GestureDetector gesture={gesture}>
      <View style={{ height }} accessible accessibilityLabel="Gráfico das movimentações de cada dia. Toque e deslize para ler um dia.">
        <Svg width={width} height={height}>
          <Defs>
            {lines.map((l, k) =>
              l.past ? null : (
                <SvgGradient key={k} id={gid(k)} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={l.color} stopOpacity={0.22} />
                  <Stop offset="0.7" stopColor={l.color} stopOpacity={0.05} />
                  <Stop offset="1" stopColor={l.color} stopOpacity={0} />
                </SvgGradient>
              ),
            )}
          </Defs>
          <Line x1={0} x2={width} y1={bottom + 0.5} y2={bottom + 0.5} stroke={floorInk} strokeWidth={1} />
          {lines.map((l, k) => {
            const p = pts[k];
            if (p.length < 2) return null;
            const d = soft(p);
            if (l.past) return <Path key={k} d={d} stroke={l.color} strokeOpacity={0.4} strokeWidth={1.6} strokeDasharray="4 5" fill="none" strokeLinecap="round" />;
            const area = `${d} L ${p[p.length - 1].x.toFixed(1)} ${bottom} L ${p[0].x.toFixed(1)} ${bottom} Z`;
            return (
              <G key={k}>
                <Path d={area} fill={`url(#${gid(k)})`} />
                {/* A light so faint it is felt more than seen. */}
                <Drawn d={d} stroke={l.color} width={7} opacity={pick !== null ? 0.04 : 0.08} reduce={reduce} />
                <Drawn d={d} stroke={l.color} width={2} opacity={1} reduce={reduce} />
              </G>
            );
          })}
          {/* The day under the finger. */}
          {pick !== null && <Line x1={x(pick)} x2={x(pick)} y1={TOP - 4} y2={bottom} stroke={th("#fff")} strokeOpacity={0.45} strokeWidth={1} strokeDasharray="2 4" />}
          {pick !== null &&
            current.map((l, k) => {
              const v = l.per[pick] ?? 0;
              return <Circle key={k} cx={x(pick)} cy={y(v)} r={3.5} fill={l.color} stroke={th("#fff", "bg")} strokeWidth={1.5} />;
            })}
        </Svg>

        {/* The days, spread over the month; today marked with a small dot. */}
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: 4, height: 18 }}>
          {axis.map((d) => (
            <Text key={d} style={[nums, { position: "absolute", left: x(d) - 20, width: 40, textAlign: "center", fontSize: 11, color: th(d === pick ? "#fff" : INK.softer) }]}>
              {String(d).padStart(2, "0")}
            </Text>
          ))}
          {today !== null && <View style={{ position: "absolute", left: x(today) - 2, top: -6, width: 4, height: 4, borderRadius: 2, backgroundColor: th(INK.soft, "bg") }} />}
        </View>

        {/* The card of glass, above the drawing. */}
        {pick !== null && (
          <Animated.View pointerEvents="none" style={[{ position: "absolute", top: 0, left: tipLeft, width: TIP_W }, fade]}>
            <View style={{ borderRadius: 13, overflow: "hidden", borderWidth: 0.75, borderColor: light ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.20)", shadowColor: "#000", shadowOpacity: light ? 0.06 : 0, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }}>
              <BlurView intensity={40} tint={light ? "light" : "dark"} style={{ paddingHorizontal: 10, paddingVertical: 8, backgroundColor: light ? "rgba(255,255,255,0.72)" : "transparent" }}>
                {!light && <LinearGradient colors={["rgba(255,255,255,0.15)", "rgba(255,255,255,0.04)"]} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} />}
                {/* A thin light along the top edge. */}
                <View style={{ position: "absolute", left: 10, right: 10, top: 0, height: 1, backgroundColor: light ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.35)" }} />
                <Text numberOfLines={1} style={{ fontSize: 10, fontWeight: "500", color: th(INK.soft) }}>
                  {dayName(pick)}
                </Text>
                {current.map((l) => (
                  <View key={l.name} style={{ marginTop: 3, flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: l.color }} />
                    <Text numberOfLines={1} style={{ flex: 1, fontSize: 10.5, color: th(INK.soft) }}>
                      {l.name}
                    </Text>
                    <Text numberOfLines={1} style={[nums, { fontSize: 11, fontWeight: "600", color: th("#fff") }]}>
                      {hidden ? "R$ •••" : money(l.per[pick] ?? 0)}
                    </Text>
                  </View>
                ))}
              </BlurView>
            </View>
          </Animated.View>
        )}
      </View>
    </GestureDetector>
  );
}
