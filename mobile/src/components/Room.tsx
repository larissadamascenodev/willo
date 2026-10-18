import { type ReactNode } from "react";
import { View, type ViewStyle } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import Sky from "~/components/Sky";
import { GROUND, GROUND_LIT } from "~/theme/tokens";

/**
 * The ground everything sits on.
 *
 * On the web this is four stacked radial gradients on a pinned pseudo-element:
 * one broad light across the upper middle, two fainter ones under it, and a vignette
 * closing the corners. It reads as a room rather than as a gradient, which is the
 * whole point of it.
 *
 * Each one is a full-bleed rectangle filled with a radial gradient, not an ellipse.
 * An ellipse stops existing at its own rim, so the vignette drew a dark ring across
 * the middle of the screen and left the corners untouched — exactly backwards. A
 * rectangle lets the gradient run past its last stop, the way CSS does.
 *
 * A screen wearing the sky does not also wear the room's lights. On the web the sky
 * replaces that layer outright and brings a vignette of its own, which is why the
 * home there reads as one picture: drawing both stacked a second set of lights over
 * the hour and turned it to haze.
 *
 * `lit` is the difference between the app's two grounds: the home, the wallet and
 * the accounts screen keep the full light, and everywhere else it is turned down,
 * because those screens are mostly lists and the room only competes with them.
 */

const LIGHTS = [
  { cx: 0.5, cy: 0.02, rx: 0.62, ry: 0.28, rgb: "rgb(156,165,184)", alpha: 0.1, fade: 0.64 },
  { cx: 0.5, cy: 0.3, rx: 0.48, ry: 0.22, rgb: "rgb(132,142,164)", alpha: 0.055, fade: 0.68 },
  { cx: 0.5, cy: 0.62, rx: 0.42, ry: 0.19, rgb: "rgb(120,130,152)", alpha: 0.03, fade: 0.7 },
];

export default function Room({
  lit = false,
  sky = false,
  children,
  style,
}: {
  lit?: boolean;
  /** The home, the wallet and the accounts screen get the hour instead of the lights. */
  sky?: boolean;
  children?: ReactNode;
  style?: ViewStyle;
}) {
  /* Turned down is not a different picture, only a quieter one. */
  const strength = lit ? 1 : 0.45;

  return (
    <View style={[{ flex: 1, backgroundColor: lit ? GROUND_LIT : GROUND }, style]}>
      {sky && <Sky />}

      {/* Both the box and the drawing have to be told to fill: left to itself the
          canvas takes its intrinsic size and the light stops partway down. */}
      <Svg
        width="100%"
        height="100%"
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        pointerEvents="none"
      >
        <Defs>
          {!sky &&
            LIGHTS.map((l, i) => (
              <RadialGradient
                key={i}
                id={`light${i}`}
                cx={String(l.cx)}
                cy={String(l.cy)}
                rx={String(l.rx)}
                ry={String(l.ry)}
              >
                <Stop offset="0" stopColor={l.rgb} stopOpacity={l.alpha * strength} />
                <Stop offset={String(l.fade)} stopColor={l.rgb} stopOpacity={0} />
                <Stop offset="1" stopColor={l.rgb} stopOpacity={0} />
              </RadialGradient>
            ))}

          {/* The sky closes its corners harder and from further in than the room does. */}
          <RadialGradient
            id="vignette"
            cx="0.5"
            cy={sky ? "0.46" : "0.44"}
            rx={sky ? "0.68" : "0.66"}
            ry={sky ? "0.44" : "0.43"}
          >
            <Stop offset={sky ? "0.44" : "0.32"} stopColor="#000" stopOpacity={0} />
            <Stop offset={sky ? "0.82" : "0.78"} stopColor="#000" stopOpacity={(sky ? 0.4 : 0.5) * (sky ? 1 : strength)} />
            <Stop offset="1" stopColor="#000" stopOpacity={(sky ? 0.66 : 0.72) * (sky ? 1 : strength)} />
          </RadialGradient>
        </Defs>

        {!sky &&
          LIGHTS.map((_, i) => (
            <Rect key={i} x="0" y="0" width="100%" height="100%" fill={`url(#light${i})`} />
          ))}
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#vignette)" />
      </Svg>

      {children}
    </View>
  );
}
