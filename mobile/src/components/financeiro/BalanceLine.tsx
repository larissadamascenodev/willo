import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { Pressable, ScrollView, Text, View, type LayoutChangeEvent } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, {
  Easing,
  ReduceMotion,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import Glass from "~/components/Glass";
import { GREEN, INK, RED } from "~/theme/tokens";

/**
 * Where the balance has been and where it goes, six months at a time.
 *
 * The chart always shows six months. Drag it sideways to go back through the months
 * already lived or on through the year ahead — it settles on a month at a time, the
 * way a picker does, and stops a year out, because past that a forecast is guessing.
 * It is one continuous line from end to end: what separates the record from the
 * forecast is the dots — solid for a month lived, hollow for one forecast — and a
 * faint mark at today, so the line itself is never broken up.
 *
 * Its colour is its sign: lime above zero and red below, with the ground between
 * the line and zero tinted the same way, so a month in the red is red before any
 * figure is read. The zero line, a faint hairline, only appears when the path
 * crosses it.
 *
 * When the chart arrives, the visible stretch is drawn from left to right as a pen
 * would draw it — easing in and out — with a small glowing head leading it, each
 * month's dot appearing as the line reaches it, and the marker landing on this
 * month with one ripple. That is the one moment here that moves on its own. Tap a
 * month to read it: the marker glides along the curve itself to it and ripples
 * once on arrival, and a capsule of glass slides under its name.
 *
 *
 * Every animated piece reads its shared values directly in its own worklet. A value
 * read only through a helper is invisible to the animation's dependency tracking,
 * and the piece then never moves again after its first frame — which is how the
 * marker once stayed on the previous month while everything else moved on.
 *
 * The curve is monotone between points, so it never bulges past a month's real
 * figure: a smoothed line that dipped under zero between two positive months would
 * be drawing a problem that is not there.
 */

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedLine = Animated.createAnimatedComponent(Line);

const VISIBLE = 6;
const HEIGHT = 180;
const PAD_T = 18;
const PAD_B = 14;
const CAPSULE_W = 38;

const SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/* A finger chose it, so it settles on a spring; no overshoot past a month. */
const SPRING = { duration: 360, dampingRatio: 1, reduceMotion: ReduceMotion.System } as const;
/* Strong ease-out: fast while you are watching, gentle as it lands. */
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
/* A pen drawing across the screen eases in and out rather than rushing off. */
const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);

interface Geometry {
  xs: number[];
  ys: number[];
  /* Per segment, the cubic's y control points — so a worklet can find any point
     on the curve, not just the months. x is linear in t by construction. */
  c1: number[];
  c2: number[];
  step: number;
  line: string;
  area: string;
  zeroY: number;
  crossesZero: boolean;
}

/** Fritsch–Carlson: a cubic through every point that never overshoots it. */
function build(values: number[], step: number): Geometry | null {
  const n = values.length;
  if (step === 0 || n === 0) return null;

  const lo0 = Math.min(0, ...values);
  const hi0 = Math.max(0, ...values);
  const span = hi0 - lo0 || 1;
  const lo = lo0 - span * 0.06;
  const hi = hi0 + span * 0.14;

  /* Each month sits in the middle of its slot, so six slots fill the view. */
  const xs = values.map((_, i) => step * (i + 0.5));
  const y = (v: number) => PAD_T + ((hi - v) / (hi - lo)) * (HEIGHT - PAD_T - PAD_B);
  const ys = values.map(y);
  const zeroY = y(0);

  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) m.push((ys[i + 1] - ys[i]) / step);
  const t = new Array<number>(n).fill(0);
  if (n > 1) {
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
  }

  const h = step / 3;
  const c1: number[] = [];
  const c2: number[] = [];
  let line = `M${xs[0]},${ys[0]}`;
  for (let i = 0; i < n - 1; i++) {
    c1.push(ys[i] + t[i] * h);
    c2.push(ys[i + 1] - t[i + 1] * h);
    line += ` C${xs[i] + h},${c1[i]} ${xs[i + 1] - h},${c2[i]} ${xs[i + 1]},${ys[i + 1]}`;
  }

  /* Filled to zero rather than to the floor, so the tint above zero is the part
     above zero and the tint below it is the part below. */
  const area = `${line} L${xs[n - 1]},${zeroY} L${xs[0]},${zeroY} Z`;

  return { xs, ys, c1, c2, step, line, area, zeroY, crossesZero: lo0 < 0 };
}

/** A month's dot, appearing as the line reaches it — solid if lived, hollow if forecast. */
function MonthDot({
  x,
  y,
  below,
  forecast,
  reveal,
}: {
  x: number;
  y: number;
  below: boolean;
  forecast: boolean;
  reveal: SharedValue<number>;
}) {
  const tone = below ? RED : GREEN;
  const animated = useAnimatedProps(() => {
    const p = Math.min(Math.max((reveal.get() - x) / 18, 0), 1);
    return { r: (forecast ? 3.4 : below ? 3.2 : 2.8) * (0.5 + 0.5 * p), opacity: p };
  });
  return forecast ? (
    <AnimatedCircle cx={x} cy={y} fill="#0D0E10" stroke={tone} strokeWidth={1.6} animatedProps={animated} />
  ) : (
    <AnimatedCircle cx={x} cy={y} fill={tone} animatedProps={animated} />
  );
}

export default function BalanceLine({
  values,
  months,
  todayIndex,
  selected,
  onSelect,
}: {
  /** The close of each month, oldest first. Keep it stable between renders. */
  values: number[];
  /** The month index (0–11) of each value, for its label. */
  months: number[];
  /** Which value is this month; everything after it is forecast. */
  todayIndex: number;
  selected: number;
  onSelect: (index: number) => void;
}) {
  const reduced = useReducedMotion();
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const [viewport, setViewport] = useState(0);

  const n = values.length;
  const step = viewport / VISIBLE;
  const contentWidth = Math.max(n * step, viewport);
  const geo = useMemo(() => build(values, step), [values, step]);

  /* The window opens on last month, this one, and the four after it. */
  const start = useMemo(() => {
    if (!geo) return 0;
    return Math.min(Math.max((todayIndex - 1) * step, 0), Math.max(contentWidth - viewport, 0));
  }, [geo, todayIndex, step, contentWidth, viewport]);

  /* Where the wipe has reached, in pixels across the whole chart. */
  const reveal = useSharedValue(0);
  /* The month being read, as a float so the marker can travel between months. */
  const sel = useSharedValue(selected);
  /* One ring spreading out from the marker when it lands: 0 is the start, 1 gone. */
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (!geo) return;
    scroller.current?.scrollTo({ x: start, animated: false });
    /* Everything left of the window is in place from the start; only the stretch
       you are looking at draws itself, and then the rest is there to drag to. */
    reveal.set(start);
    if (reduced) {
      reveal.set(contentWidth);
      return;
    }
    reveal.set(
      withDelay(
        160,
        withTiming(start + viewport, { duration: 1050, easing: EASE_IN_OUT }, (done) => {
          if (!done) return;
          reveal.set(contentWidth);
          /* The marker lands on this month, once. */
          pulse.set(0);
          pulse.set(withTiming(1, { duration: 700, easing: EASE_OUT }));
        }),
      ),
    );
  }, [geo, start, viewport, contentWidth, reduced, reveal, pulse]);

  const first = useRef(true);
  useEffect(() => {
    sel.set(withSpring(selected, SPRING));
    /* On a month picked after the chart has drawn, ripple as the marker arrives. */
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduced) return;
    pulse.set(0);
    pulse.set(withDelay(220, withTiming(1, { duration: 650, easing: EASE_OUT })));
  }, [selected, sel, pulse, reduced]);

  const choose = useCallback(
    (i: number) => {
      const next = Math.max(0, Math.min(n - 1, i));
      if (next === selected) return;
      void Haptics.selectionAsync();
      onSelect(next);
    },
    [n, selected, onSelect],
  );

  /* The point on the curve for a float month index. */
  const pointAt = (f: number, g: Geometry) => {
    "worklet";
    if (g.xs.length < 2) return { x: g.xs[0] ?? 0, y: g.ys[0] ?? 0 };
    const i = Math.min(Math.max(Math.floor(f), 0), g.xs.length - 2);
    const t = Math.min(Math.max(f - i, 0), 1);
    const u = 1 - t;
    return {
      x: g.xs[i] + t * g.step,
      y: u * u * u * g.ys[i] + 3 * u * u * t * g.c1[i] + 3 * u * t * t * g.c2[i] + t * t * t * g.ys[i + 1],
    };
  };

  const clipProps = useAnimatedProps(() => ({ width: reveal.get() }));

  /* The glowing head that leads the line in, gone once it has arrived. */
  const penGlow = useAnimatedProps(() => {
    if (!geo) return { cx: 0, cy: 0, opacity: 0 };
    const x = Math.min(Math.max(reveal.get(), geo.xs[0]), geo.xs[geo.xs.length - 1]);
    const p = pointAt((x - geo.step / 2) / geo.step, geo);
    const o = interpolate(
      reveal.get(),
      [start, start + viewport * 0.04, start + viewport * 0.9, start + viewport],
      [0, 1, 1, 0],
      "clamp",
    );
    return { cx: p.x, cy: p.y, opacity: o };
  });

  /* The marker arrives with the end of the wipe and then follows the selection.
     It is lime above zero and red below, as the line is: two cores, one shown.
     The shared values are read here, in each piece's own worklet, and handed to
     the helper — read only inside the helper, they would not be tracked. */
  const marker = (part: 0 | 1 | 2 | 3, at: number, revealed: number) => {
    "worklet";
    if (!geo) return { cx: 0, cy: 0, opacity: 0 };
    const p = pointAt(at, geo);
    const arrived = interpolate(revealed, [start + viewport * 0.88, start + viewport], [0, 1], "clamp");
    const below = p.y > geo.zeroY;
    /* 0 and 1 are the halo and core above zero, 2 and 3 the pair below it. */
    const shown = part < 2 ? (below ? 0 : 1) : below ? 1 : 0;
    return { cx: p.x, cy: p.y, opacity: shown * arrived };
  };
  const haloProps = useAnimatedProps(() => marker(0, sel.get(), reveal.get()));
  const coreProps = useAnimatedProps(() => marker(1, sel.get(), reveal.get()));
  const haloBelowProps = useAnimatedProps(() => marker(2, sel.get(), reveal.get()));
  const coreBelowProps = useAnimatedProps(() => marker(3, sel.get(), reveal.get()));

  const rippleProps = useAnimatedProps(() => {
    if (!geo) return { cx: 0, cy: 0, r: 0, opacity: 0 };
    const p = pointAt(sel.get(), geo);
    const k = pulse.get();
    return { cx: p.x, cy: p.y, r: 7 + 16 * k, opacity: 0.55 * (1 - k) };
  });

  const guideProps = useAnimatedProps(() => {
    if (!geo) return { x1: 0, x2: 0, y1: 0, opacity: 0 };
    const p = pointAt(sel.get(), geo);
    const arrived = interpolate(reveal.get(), [start + viewport * 0.88, start + viewport], [0, 1], "clamp");
    return { x1: p.x, x2: p.x, y1: p.y, opacity: arrived };
  });

  const capsule = useAnimatedStyle(() => {
    if (!geo) return { transform: [{ translateX: 0 }] };
    return { transform: [{ translateX: pointAt(sel.get(), geo).x - CAPSULE_W / 2 }] };
  });

  const onLayout = (e: LayoutChangeEvent) => setViewport(e.nativeEvent.layout.width);

  const zeroOffset = geo ? Math.min(Math.max(geo.zeroY / HEIGHT, 0), 1) : 1;
  const todayX = geo ? geo.xs[Math.min(Math.max(todayIndex, 0), n - 1)] : 0;

  return (
    <View onLayout={onLayout}>
      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={step > 0 ? step : undefined}
        decelerationRate="fast"
        bounces
      >
        {geo && (
          <View style={{ width: contentWidth }}>
            <Pressable onPress={(e) => choose(Math.floor(e.nativeEvent.locationX / step))}>
              <Svg width={contentWidth} height={HEIGHT}>
                <Defs>
                  {/* Lime above zero, red below — the line's colour is its sign. */}
                  <LinearGradient id="tone" x1="0" y1="0" x2="0" y2={HEIGHT} gradientUnits="userSpaceOnUse">
                    <Stop offset={0} stopColor={GREEN} />
                    <Stop offset={zeroOffset} stopColor={GREEN} />
                    <Stop offset={zeroOffset} stopColor={RED} />
                    <Stop offset={1} stopColor={RED} />
                  </LinearGradient>
                  <LinearGradient id="ground" x1="0" y1="0" x2="0" y2={HEIGHT} gradientUnits="userSpaceOnUse">
                    <Stop offset={0} stopColor={GREEN} stopOpacity={0.34} />
                    <Stop offset={zeroOffset} stopColor={GREEN} stopOpacity={0.02} />
                    <Stop offset={zeroOffset} stopColor={RED} stopOpacity={0.02} />
                    <Stop offset={1} stopColor={RED} stopOpacity={0.28} />
                  </LinearGradient>
                  <ClipPath id="wipe">
                    <AnimatedRect x={0} y={0} height={HEIGHT} animatedProps={clipProps} />
                  </ClipPath>
                </Defs>

                {geo.crossesZero && (
                  <Line
                    x1={0}
                    x2={contentWidth}
                    y1={geo.zeroY}
                    y2={geo.zeroY}
                    stroke="rgba(255,255,255,0.16)"
                    strokeWidth={1}
                  />
                )}

                {/* Where the record ends and the forecast begins. */}
                {todayIndex > 0 && todayIndex < n && (
                  <>
                    <Line
                      x1={todayX}
                      x2={todayX}
                      y1={14}
                      y2={HEIGHT - PAD_B + 4}
                      stroke="rgba(255,255,255,0.07)"
                      strokeWidth={1}
                    />
                    <SvgText
                      x={todayX}
                      y={10}
                      fontSize={9.5}
                      fontWeight="600"
                      fill="rgba(255,255,255,0.45)"
                      textAnchor="middle"
                    >
                      hoje
                    </SvgText>
                  </>
                )}

                <AnimatedLine
                  y2={HEIGHT}
                  stroke="rgba(255,255,255,0.18)"
                  strokeWidth={1}
                  animatedProps={guideProps}
                />

                <G clipPath="url(#wipe)">
                  <Path d={geo.area} fill="url(#ground)" />
                  {/* A soft glow under the line, wide and faint. */}
                  <Path
                    d={geo.line}
                    fill="none"
                    stroke="url(#tone)"
                    strokeOpacity={0.12}
                    strokeWidth={14}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <Path
                    d={geo.line}
                    fill="none"
                    stroke="url(#tone)"
                    strokeWidth={2.75}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </G>

                {values.map((v, i) => (
                  <MonthDot
                    key={i}
                    x={geo.xs[i]}
                    y={geo.ys[i]}
                    below={v < 0}
                    forecast={i > todayIndex}
                    reveal={reveal}
                  />
                ))}

                <AnimatedCircle r={10} fill={GREEN} fillOpacity={0.28} animatedProps={penGlow} />

                <AnimatedCircle
                  cx={geo.xs[selected]}
                  cy={geo.ys[selected]}
                  r={7}
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth={1.5}
                  opacity={0}
                  animatedProps={rippleProps}
                />

                {/* Placed where the selection is to begin with, then moved by the
                    animated props — so it is in the right place even on a frame
                    the animation has not reached yet. */}
                <AnimatedCircle
                  cx={geo.xs[selected]}
                  cy={geo.ys[selected]}
                  r={14}
                  fill={GREEN}
                  fillOpacity={0.22}
                  animatedProps={haloProps}
                />
                <AnimatedCircle
                  cx={geo.xs[selected]}
                  cy={geo.ys[selected]}
                  r={14}
                  fill={RED}
                  fillOpacity={0.22}
                  animatedProps={haloBelowProps}
                />
                <AnimatedCircle
                  cx={geo.xs[selected]}
                  cy={geo.ys[selected]}
                  r={6}
                  fill={GREEN}
                  stroke="#FFFFFF"
                  strokeWidth={2.25}
                  animatedProps={coreProps}
                />
                <AnimatedCircle
                  cx={geo.xs[selected]}
                  cy={geo.ys[selected]}
                  r={6}
                  fill={RED}
                  stroke="#FFFFFF"
                  strokeWidth={2.25}
                  animatedProps={coreBelowProps}
                />
              </Svg>
            </Pressable>

            {/* The months, with a capsule of glass under the one being read. */}
            <View style={{ height: 26, marginTop: 6 }}>
              <Animated.View style={[{ position: "absolute", left: 0, top: 0 }, capsule]}>
                <Glass radius={999} style={{ width: CAPSULE_W, height: 26 }} />
              </Animated.View>
              {months.map((m, i) => (
                <Text
                  key={i}
                  onPress={() => choose(i)}
                  suppressHighlighting
                  style={{
                    position: "absolute",
                    left: geo.xs[i] - CAPSULE_W / 2,
                    width: CAPSULE_W,
                    lineHeight: 26,
                    textAlign: "center",
                    fontSize: 11,
                    fontWeight: i === selected ? "700" : "400",
                    color: i === selected ? "#fff" : i > todayIndex ? INK.softer : INK.soft,
                  }}
                >
                  {SHORT[m]}
                </Text>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
