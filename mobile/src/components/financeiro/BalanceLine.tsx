import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View, type LayoutChangeEvent } from "react-native";
import Animated, { Easing, useAnimatedProps, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from "react-native-svg";
import { INK, RED } from "~/theme/tokens";

/**
 * Where the balance goes, as one line.
 *
 * A projection is a trajectory, so it is drawn as one: a single white line through
 * the close of each month, with the ground under it faintly lit. The zero line only
 * appears when the path actually crosses it, dashed, because that is the one level
 * the eye needs to compare against — and a month that ends below it gets a red dot,
 * the only colour on the chart.
 *
 * The curve is monotone between points, so it never bulges past a month's real
 * figure: a smoothed line that dipped under zero between two positive months would
 * be drawing a problem that is not there.
 *
 * The line draws itself once, when it arrives. Touching it picks the nearest month.
 */

const AnimatedPath = Animated.createAnimatedComponent(Path);

const HEIGHT = 156;
const PAD_T = 16;
const PAD_B = 12;
const PAD_X = 13;

const SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Fritsch–Carlson: a cubic through every point that never overshoots it. */
function monotonePath(xs: number[], ys: number[]) {
  const n = xs.length;
  if (n === 0) return "";
  if (n === 1) return `M${xs[0]},${ys[0]}`;

  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(xs[i + 1] - xs[i]);
    m.push((ys[i + 1] - ys[i]) / dx[i]);
  }

  const t = new Array<number>(n);
  t[0] = m[0];
  t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;

  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / m[i];
    const b = t[i + 1] / m[i];
    const s = a * a + b * b;
    if (s > 9) {
      const tau = 3 / Math.sqrt(s);
      t[i] = tau * a * m[i];
      t[i + 1] = tau * b * m[i];
    }
  }

  let d = `M${xs[0]},${ys[0]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${xs[i] + h},${ys[i] + t[i] * h} ${xs[i + 1] - h},${ys[i + 1] - t[i + 1] * h} ${xs[i + 1]},${ys[i + 1]}`;
  }
  return d;
}

export default function BalanceLine({
  values,
  months,
  selected,
  onSelect,
}: {
  /** The close of each month, oldest first. */
  values: number[];
  /** The month index (0–11) of each value, for its label. */
  months: number[];
  selected: number;
  onSelect: (index: number) => void;
}) {
  const [width, setWidth] = useState(0);
  const drawn = useSharedValue(0);

  const geo = useMemo(() => {
    if (width === 0 || values.length === 0) return null;

    const lo0 = Math.min(0, ...values);
    const hi0 = Math.max(0, ...values);
    const span = hi0 - lo0 || 1;
    const lo = lo0 - span * 0.06;
    const hi = hi0 + span * 0.14;

    const inner = width - PAD_X * 2;
    const step = values.length > 1 ? inner / (values.length - 1) : 0;
    const xs = values.map((_, i) => PAD_X + i * step);
    const y = (v: number) => PAD_T + ((hi - v) / (hi - lo)) * (HEIGHT - PAD_T - PAD_B);
    const ys = values.map(y);

    const line = monotonePath(xs, ys);
    const floor = HEIGHT - PAD_B;
    const area = `${line} L${xs[xs.length - 1]},${floor} L${xs[0]},${floor} Z`;

    /* Long enough to cover the curve; a dash shorter than the path would leave a
       gap at its end. */
    let length = 0;
    for (let i = 1; i < xs.length; i++) length += Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
    length *= 1.3;

    return { xs, ys, line, area, length, zeroY: y(0), crossesZero: lo0 < 0, step };
  }, [width, values]);

  useEffect(() => {
    if (!geo) return;
    drawn.value = 0;
    drawn.value = withDelay(120, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [geo, drawn]);

  const animatedLine = useAnimatedProps(() => ({
    strokeDashoffset: (geo?.length ?? 0) * (1 - drawn.value),
  }));
  const animatedArea = useAnimatedProps(() => ({ opacity: drawn.value }));

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const pick = (x: number) => {
    if (!geo || values.length === 0) return;
    const i = geo.step > 0 ? Math.round((x - PAD_X) / geo.step) : 0;
    onSelect(Math.max(0, Math.min(values.length - 1, i)));
  };

  return (
    <View onLayout={onLayout}>
      <Pressable onPress={(e) => pick(e.nativeEvent.locationX)} style={{ height: HEIGHT }}>
        {geo && (
          <Svg width={width} height={HEIGHT}>
            <Defs>
              <LinearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.14} />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
              </LinearGradient>
            </Defs>

            <AnimatedPath d={geo.area} fill="url(#ground)" animatedProps={animatedArea} />

            {geo.crossesZero && (
              <Line
                x1={0}
                x2={width}
                y1={geo.zeroY}
                y2={geo.zeroY}
                stroke="rgba(255,255,255,0.28)"
                strokeWidth={1}
                strokeDasharray="3,5"
              />
            )}

            {/* The month being read, as a faint guide down to its label. */}
            <Line
              x1={geo.xs[selected]}
              x2={geo.xs[selected]}
              y1={geo.ys[selected]}
              y2={HEIGHT}
              stroke="rgba(255,255,255,0.14)"
              strokeWidth={1}
            />

            <AnimatedPath
              d={geo.line}
              fill="none"
              stroke="#FFFFFF"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={[geo.length, geo.length]}
              animatedProps={animatedLine}
            />

            {values.map((v, i) =>
              i === selected ? null : (
                <Circle
                  key={i}
                  cx={geo.xs[i]}
                  cy={geo.ys[i]}
                  r={v < 0 ? 3.2 : 2.4}
                  fill={v < 0 ? RED : "rgba(255,255,255,0.5)"}
                />
              ),
            )}

            <Circle cx={geo.xs[selected]} cy={geo.ys[selected]} r={9} fill="rgba(255,255,255,0.14)" />
            <Circle
              cx={geo.xs[selected]}
              cy={geo.ys[selected]}
              r={4.5}
              fill={values[selected] < 0 ? RED : "#FFFFFF"}
            />
          </Svg>
        )}
      </Pressable>

      {/* The months, each under its point. */}
      {geo && (
        <View style={{ height: 18, marginTop: 6 }}>
          {months.map((m, i) => (
            <Text
              key={i}
              onPress={() => onSelect(i)}
              style={{
                position: "absolute",
                left: geo.xs[i] - 15,
                width: 30,
                textAlign: "center",
                fontSize: 11,
                fontWeight: i === selected ? "700" : "400",
                color: i === selected ? "#fff" : INK.softer,
              }}
            >
              {SHORT[m]}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}
