import { View, useWindowDimensions } from "react-native";
import Svg, {
  Defs,
  G,
  LinearGradient,
  Mask,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";

/**
 * The hour the home arrives at.
 *
 * A storm closing the top, a break of fire under it, and water below catching what
 * gets through — eleven lights over one vertical gradient, faded out before it
 * reaches the cards so they sit on the room rather than on the picture. It is the
 * same set of gradients the web paints, drawn here as rectangles because React
 * Native has no radial gradient of its own.
 *
 * The fade is applied to all of it at once rather than to each layer. Masking them
 * one by one compounds: every layer gets faded, and wherever two overlap the fade
 * multiplies, so the whole picture came out washed and flat — which is exactly what
 * it looked like.
 *
 * Only three screens wear it: the home, the wallet and the accounts screen. They are
 * places you arrive at rather than work in, and the cards sit badly on flat charcoal.
 */

/** cx, cy, rx, ry as fractions of the band; CSS states width and height, so these halve. */
const LIGHTS: { cx: number; cy: number; rx: number; ry: number; rgb: string; a: number }[] = [
  /* cloud edges catching the light */
  { cx: 0.31, cy: 0.11, rx: 0.29, ry: 0.025, rgb: "255,182,104", a: 0.54 },
  { cx: 0.73, cy: 0.08, rx: 0.21, ry: 0.02, rgb: "255,134,52", a: 0.48 },
  { cx: 0.54, cy: 0.16, rx: 0.34, ry: 0.02, rgb: "255,104,38", a: 0.34 },
  { cx: 0.17, cy: 0.21, rx: 0.18, ry: 0.015, rgb: "255,156,76", a: 0.26 },
  /* the break of fire they sit on */
  { cx: 0.47, cy: 0.13, rx: 0.44, ry: 0.065, rgb: "255,112,38", a: 0.42 },
  /* water below, lit where the sky breaks */
  { cx: 0.64, cy: 0.34, rx: 0.24, ry: 0.04, rgb: "128,214,220", a: 0.3 },
  { cx: 0.26, cy: 0.43, rx: 0.2, ry: 0.035, rgb: "84,182,202", a: 0.28 },
  { cx: 0.58, cy: 0.5, rx: 0.28, ry: 0.045, rgb: "96,190,206", a: 0.22 },
  { cx: 0.48, cy: 0.42, rx: 0.34, ry: 0.1, rgb: "38,118,156", a: 0.46 },
  /* the storm that closes the top */
  { cx: 0.5, cy: 0, rx: 0.6, ry: 0.085, rgb: "8,12,22", a: 0.9 },
];

export default function Sky({ strong = false }: { strong?: boolean }) {
  const { height } = useWindowDimensions();
  /* Strong holds the picture longer before it gives way to the room: the way the
     welcome screen shows it, where nothing stands over it. */
  const band = height * (strong ? 0.74 : 0.62);

  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", top: 0, left: 0, right: 0, height: band }}
    >
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="sky-base" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#080d18" />
            <Stop offset="0.14" stopColor="#16233c" />
            <Stop offset="0.32" stopColor="#123048" />
            <Stop offset="0.46" stopColor="#114058" />
            <Stop offset="0.62" stopColor="#0e2a3a" />
            <Stop offset="0.84" stopColor="#0D0E10" stopOpacity={0.88} />
            <Stop offset="1" stopColor="#0D0E10" />
          </LinearGradient>

          {LIGHTS.map((l, i) => (
            <RadialGradient
              key={i}
              id={`sky${i}`}
              cx={String(l.cx)}
              cy={String(l.cy)}
              rx={String(l.rx)}
              ry={String(l.ry)}
            >
              <Stop offset="0" stopColor={`rgb(${l.rgb})`} stopOpacity={l.a} />
              <Stop offset="1" stopColor={`rgb(${l.rgb})`} stopOpacity={0} />
            </RadialGradient>
          ))}

          {/* It has to be gone before the cards start, or they read as sitting on a
              photograph rather than in a room. */}
          <LinearGradient id="sky-fade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#fff" stopOpacity={1} />
            <Stop offset={strong ? "0.66" : "0.5"} stopColor="#fff" stopOpacity={1} />
            <Stop offset={strong ? "0.86" : "0.74"} stopColor="#fff" stopOpacity={strong ? 0.55 : 0.42} />
            <Stop offset="1" stopColor="#fff" stopOpacity={0} />
          </LinearGradient>
          <Mask id="sky-mask">
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#sky-fade)" />
          </Mask>
        </Defs>

        <G mask="url(#sky-mask)">
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#sky-base)" />
          {LIGHTS.map((_, i) => (
            <Rect key={i} x="0" y="0" width="100%" height="100%" fill={`url(#sky${i})`} />
          ))}
        </G>
      </Svg>
    </View>
  );
}
