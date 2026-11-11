import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, { Easing, useAnimatedProps, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import Svg, { Circle, G } from "react-native-svg";
import { INK } from "~/theme/tokens";

import { th } from "~/theme/theme";
/**
 * The month as a ring.
 *
 * A list of categories answers "how much did each take"; the ring answers the
 * question before it — whether the month had one subject or ten. The gap between
 * arcs is what makes that readable: without it a ring of similar colours is a
 * smear, and with it you can count the shares.
 *
 * The arcs are scaled to close the circle after the gaps are cut out of it, so the
 * ring always reads as a whole month rather than a month with a piece missing.
 */

/* The categories page's own size; the home's compact card draws the same ring smaller. */
const SIZE = 248;
const STROKE = 22;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface RingSegment {
  key: string;
  hex: string;
  amount: number;
}

function Arc({
  hex,
  dash,
  offset,
  round,
  delay,
  size,
  stroke,
}: {
  hex: string;
  dash: number;
  offset: number;
  round: boolean;
  delay: number;
  size: number;
  stroke: number;
}) {
  const R = (size - stroke) / 2;
  const C = 2 * Math.PI * R;
  const drawn = useSharedValue(0);

  useEffect(() => {
    drawn.value = withDelay(
      delay * 1000,
      withTiming(dash, { duration: 600, easing: Easing.out(Easing.cubic) }),
    );
  }, [dash, delay, drawn]);

  const animated = useAnimatedProps(() => ({ strokeDasharray: [drawn.value, C] }));

  return (
    <AnimatedCircle
      cx={size / 2}
      cy={size / 2}
      r={R}
      fill="none"
      stroke={hex}
      strokeWidth={stroke}
      strokeLinecap={round ? "round" : "butt"}
      strokeDashoffset={-offset}
      animatedProps={animated}
    />
  );
}

export default function SpendRing({
  segments,
  total,
  caption,
  size = SIZE,
  stroke = STROKE,
  labelSize = 30,
}: {
  segments: RingSegment[];
  total: number;
  /** Under the figure; left out on the home's small card. */
  caption?: string;
  size?: number;
  stroke?: number;
  labelSize?: number;
}) {
  const R = (size - stroke) / 2;
  const C = 2 * Math.PI * R;
  const many = segments.length > 1;
  /* The gap between arcs keeps its proportion to the ring at any size. */
  const gap = many ? stroke + 10 * (size / SIZE) : 0;

  let running = 0;
  const arcs = segments.map((seg) => {
    const len = Math.max((seg.amount / (total || 1)) * C, gap + 2);
    const arc = { seg, start: running, dash: Math.max(len - gap, 0.1) };
    running += len;
    return arc;
  });
  /* The minimum slice pushes the total past a full circle; this pulls it back. */
  const fit = running > 0 ? C / running : 1;

  const label =
    total >= 1000
      ? `R$ ${new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(total)}`
      : total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <View style={{ width: size, height: size, alignSelf: "center" }}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          {segments.length === 0 && (
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={R}
              fill="none"
              stroke={th("rgba(255,255,255,0.08)")}
              strokeWidth={stroke}
            />
          )}
          {arcs.map(({ seg, start, dash }, i) => (
            <Arc
              key={seg.key}
              hex={seg.hex}
              dash={many ? dash * fit : C}
              offset={start * fit + gap / 2}
              round={many}
              delay={i * 0.06}
              size={size}
              stroke={stroke}
            />
          ))}
        </G>
      </Svg>

      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text numberOfLines={1} style={{ fontSize: labelSize, fontWeight: "800", letterSpacing: -labelSize / 30, color: th("#fff") }}>
          {label}
        </Text>
        {caption ? <Text style={{ marginTop: 2, fontSize: 14, color: th(INK.soft) }}>{caption}</Text> : null}
      </View>
    </View>
  );
}
