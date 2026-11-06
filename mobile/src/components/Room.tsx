import { type ReactNode } from "react";
import { View, type ViewStyle } from "react-native";
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { Image } from "expo-image";
import Sky from "~/components/Sky";
import { useLightSkyModel, useSkyModel, useSkyPhoto, useSkyPhotoBlur, type LightSkyModel, type SkyModel } from "~/lib/skyModel";
import { GROUND, GROUND_LIT } from "~/theme/tokens";
import { BACKDROPS, LIGHT_BACKDROPS, STARS, type BackdropKey, type LightBackdropKey } from "~/lib/backdrops";

import { LIGHT_GROUND, isLight, th } from "~/theme/theme";
/**
 * The second sky: the hour as a picture.
 *
 * The first is eleven radial lights, a mask and a vignette drawn live, and a phone did
 * not draw them the way the web does: the welcome looked one way in the browser and
 * another in the hand. This is that same drawing, taken once from the web and fixed,
 * so every phone shows the same sky, with its brightest part held back a little so
 * cards passing over the glow do not change under it. It already carries its own
 * vignette, which is why it is drawn without the one the first sky needs.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const HOUR = require("../../assets/sky.png") as number;

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
 * Every screen wears the home's ground: one picture across the whole app, so moving
 * between screens never changes the room. `lit` and `sky` stay as props only so a screen
 * can opt out of it; none does.
 */

const LIGHTS = [
  { cx: 0.5, cy: 0.02, rx: 0.62, ry: 0.28, rgb: "rgb(156,165,184)", alpha: 0.1, fade: 0.64 },
  { cx: 0.5, cy: 0.3, rx: 0.48, ry: 0.22, rgb: "rgb(132,142,164)", alpha: 0.055, fade: 0.68 },
  { cx: 0.5, cy: 0.62, rx: 0.42, ry: 0.19, rgb: "rgb(120,130,152)", alpha: 0.03, fade: 0.7 },
];

export default function Room({
  lit = true,
  sky: wantsSky = true,
  preview,
  children,
  style,
}: {
  lit?: boolean;
  /** Shows this background instead of the chosen one: the profile's previews. */
  preview?: SkyModel | LightSkyModel;
  /** The home, the wallet and the accounts screen get the hour instead of the lights. */
  sky?: boolean;
  children?: ReactNode;
  style?: ViewStyle;
}) {
  /* Turned down is not a different picture, only a quieter one. */
  const strength = lit ? 1 : 0.45;
  const [chosen] = useSkyModel();
  const [chosenLight] = useLightSkyModel();
  const model = (preview as SkyModel | undefined) ?? chosen;
  const photo = useSkyPhoto();
  const [blurPhoto] = useSkyPhotoBlur();
  /* A soft photo: the cards over it stay the thing that is read. */
  const photoBlur = blurPhoto ? 28 : 0;
  /* "plain" is the room without its sky: the soft lights on the dark ground. */
  const sky = wantsSky && model !== "plain";
  const own = sky && model === "custom" && !!photo;
  const picture = sky && (model === "2" || own);
  const drawn = sky ? (BACKDROPS[model as BackdropKey] ?? null) : null;

  /* Several rooms can be on one page (the profile's previews), and on the web their
     gradients share one document, so each name carries the background it belongs to. */
  const id = (name: string) => `${name}-${sky ? model : "room"}`;

  /* In the light, its own backgrounds: a light ground with soft colour pooled near
     the top for the glass to pick up, or the person's photo under a pale veil. */
  if (isLight()) {
    const lightModel = (preview as LightSkyModel | undefined) ?? chosenLight;
    const ownLight = lightModel === "custom" && !!photo;
    const pale = LIGHT_BACKDROPS[lightModel as LightBackdropKey] ?? LIGHT_BACKDROPS["aurora-clara"];
    const lid = (name: string) => `${name}-light-${lightModel}`;
    return (
      <View style={[{ flex: 1, backgroundColor: ownLight ? LIGHT_GROUND : pale.ground }, style]}>
        {ownLight ? (
          <>
            <Image source={{ uri: photo! }} contentFit="cover" transition={200} blurRadius={photoBlur} pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
            <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(245,245,247,0.55)" }} />
          </>
        ) : (
          <Svg width="100%" height="100%" pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
            <Defs>
              {pale.lights.map((l, i) => (
                <RadialGradient key={i} id={lid(`glow${i}`)} cx={String(l.cx)} cy={String(l.cy)} rx={String(l.rx)} ry={String(l.ry)}>
                  <Stop offset="0" stopColor={`rgb(${l.rgb})`} stopOpacity={l.a} />
                  <Stop offset={String(l.fade ?? 1)} stopColor={`rgb(${l.rgb})`} stopOpacity={0} />
                </RadialGradient>
              ))}
              <RadialGradient id={lid("edge")} cx="0.5" cy="0.45" rx="0.75" ry="0.6">
                <Stop offset="0.55" stopColor="rgb(30,34,44)" stopOpacity={0} />
                <Stop offset="1" stopColor="rgb(30,34,44)" stopOpacity={0.05} />
              </RadialGradient>
            </Defs>
            {pale.lights.map((_, i) => (
              <Rect key={i} x="0" y="0" width="100%" height="100%" fill={`url(#${lid(`glow${i}`)})`} />
            ))}
            <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${lid("edge")})`} />
          </Svg>
        )}
        {children}
      </View>
    );
  }

  if (drawn) {
    return (
      <View style={[{ flex: 1, backgroundColor: th(drawn.ground, "bg") }, style]}>
        <Svg width="100%" height="100%" pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
          <Defs>
            {drawn.lights.map((l, i) => (
              <RadialGradient key={i} id={id(`glow${i}`)} cx={String(l.cx)} cy={String(l.cy)} rx={String(l.rx)} ry={String(l.ry)}>
                <Stop offset="0" stopColor={th(`rgb(${l.rgb})`, "grad")} stopOpacity={l.a} />
                <Stop offset={String(l.fade ?? 1)} stopColor={th(`rgb(${l.rgb})`, "grad")} stopOpacity={0} />
              </RadialGradient>
            ))}
            <RadialGradient id={id("edge")} cx="0.5" cy="0.44" rx="0.7" ry="0.5">
              <Stop offset="0.42" stopColor={th("#000", "grad")} stopOpacity={0} />
              <Stop offset="1" stopColor={th("#000", "grad")} stopOpacity={0.55} />
            </RadialGradient>
          </Defs>
          {drawn.lights.map((_, i) => (
            <Rect key={i} x="0" y="0" width="100%" height="100%" fill={th(`url(#${id(`glow${i}`)})`)} />
          ))}
          {drawn.stars && STARS.map((st, i) => <Circle key={i} cx={`${st.x * 100}%`} cy={`${st.y * 100}%`} r={st.r} fill={th("#fff")} fillOpacity={st.o} />)}
          <Rect x="0" y="0" width="100%" height="100%" fill={th(`url(#${id("edge")})`)} />
        </Svg>
        {children}
      </View>
    );
  }

  return (
    <View style={[{ flex: 1, backgroundColor: th(lit ? GROUND_LIT : GROUND, "bg") }, style]}>
      {sky && !picture && <Sky />}
      {picture && !own && <Image source={HOUR} contentFit="fill" pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />}
      {/* The person's own photo, held down so the cards and the figures over it stay
          the brightest thing on the screen, and closed at the edges like the hour. */}
      {own && (
        <>
          <Image source={{ uri: photo! }} contentFit="cover" transition={200} blurRadius={photoBlur} pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
          <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: th("rgba(6,7,9,0.5)", "bg") }} />
          <Svg width="100%" height="100%" pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
            <Defs>
              <RadialGradient id="ownVignette" cx="0.5" cy="0.42" rx="0.75" ry="0.55">
                <Stop offset="0.35" stopColor={th("#000", "grad")} stopOpacity={0} />
                <Stop offset="1" stopColor={th("#000", "grad")} stopOpacity={0.6} />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#ownVignette)" />
          </Svg>
        </>
      )}

      {/* Both the box and the drawing have to be told to fill: left to itself the
          canvas takes its intrinsic size and the light stops partway down. */}
      {!picture && (
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
                id={id(`light${i}`)}
                cx={String(l.cx)}
                cy={String(l.cy)}
                rx={String(l.rx)}
                ry={String(l.ry)}
              >
                <Stop offset="0" stopColor={th(l.rgb, "grad")} stopOpacity={l.alpha * strength} />
                <Stop offset={String(l.fade)} stopColor={th(l.rgb, "grad")} stopOpacity={0} />
                <Stop offset="1" stopColor={th(l.rgb, "grad")} stopOpacity={0} />
              </RadialGradient>
            ))}

          {/* The sky closes its corners harder and from further in than the room does. */}
          <RadialGradient
            id={id("vignette")}
            cx="0.5"
            cy={sky ? "0.46" : "0.44"}
            rx={sky ? "0.68" : "0.66"}
            ry={sky ? "0.44" : "0.43"}
          >
            <Stop offset={sky ? "0.44" : "0.32"} stopColor={th("#000", "grad")} stopOpacity={0} />
            <Stop offset={sky ? "0.82" : "0.78"} stopColor={th("#000", "grad")} stopOpacity={(sky ? 0.4 : 0.5) * (sky ? 1 : strength)} />
            <Stop offset="1" stopColor={th("#000", "grad")} stopOpacity={(sky ? 0.66 : 0.72) * (sky ? 1 : strength)} />
          </RadialGradient>
        </Defs>

        {!sky &&
          LIGHTS.map((_, i) => (
            <Rect key={i} x="0" y="0" width="100%" height="100%" fill={th(`url(#${id(`light${i}`)})`)} />
          ))}
        <Rect x="0" y="0" width="100%" height="100%" fill={th(`url(#${id("vignette")})`)} />
      </Svg>
      )}

      {children}
    </View>
  );
}
