import { useEffect } from "react";
import { Text, View } from "react-native";
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Line, LinearGradient, Path, Polygon, RadialGradient, Stop, Text as SvgText } from "react-native-svg";
import { LinearGradient as Shine } from "expo-linear-gradient";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming, type SharedValue } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { MEDAL_ICON } from "~/components/desafios/parts";
import { Lock } from "~/components/icons";
import type { MedalIcon } from "~/lib/challenges";
import { longDate, type Medal } from "~/lib/medals";

/**
 * A medal you could hold.
 *
 * Struck metal — bronze, silver, gold, rose platinum, diamond by its place in the
 * collection, gold for one won once. A milled edge round a polished rim whose light
 * runs in bands the way it does on real metal; a groove, a bevelled lip, and in the
 * middle a field of glossy enamel in the collection's colour, with its glyph raised
 * out of it in the same metal, lit from the top left and shadowed below. A metal band
 * across the foot carries the medal's number, struck in. One not won yet is the same
 * medal in plain steel, with a lock.
 *
 * Opened, it can be turned with a finger: it has thickness — its edge shows as it
 * turns — light slides across its face, and the back is plain metal engraved with its
 * name and the day it was won.
 */

/* Each collection's enamel: light, middle, deep. */
const HUE: Record<MedalIcon, [string, string, string]> = {
  pen: ["#7FB8F5", "#2F6FC0", "#123566"],
  flame: ["#FF8FB4", "#D93468", "#6E1232"],
  check: ["#8EDB8E", "#2F9A3F", "#11481A"],
  card: ["#B79BFA", "#6D3FD6", "#2F1475"],
  piggy: ["#F7A3C8", "#C9447F", "#661A3D"],
  flag: ["#FFB577", "#D9681A", "#6B2C05"],
  sun: ["#FFE07A", "#D9A114", "#6B4B03"],
  calendar: ["#7FDCDC", "#1E9696", "#0A4448"],
  vault: ["#F2D27A", "#B8861C", "#5A3F06"],
  sunrise: ["#FFAE8A", "#D9552A", "#6B2208"],
  note: ["#A5A8FA", "#4B4ED6", "#1C1D6E"],
  layers: ["#D3A5FA", "#8D3FD6", "#3F1270"],
  wallet: ["#86DCC0", "#1E9670", "#0A4634"],
  tag: ["#C4EA7A", "#64A614", "#2C4D06"],
  trending: ["#8EDBAA", "#1EA04A", "#0A4A20"],
  income: ["#A5DE8A", "#47A02A", "#1D4A0A"],
  fire: ["#FFA58A", "#D9431E", "#6B1A06"],
  bike: ["#FF9C8F", "#D63A28", "#6B1208"],
  bag: ["#F59ADB", "#B8308A", "#5A0E40"],
  eye: ["#86CFF5", "#2088C9", "#0A3E66"],
  crown: ["#FFE07A", "#D4A006", "#6B4E02"],
  gem: ["#86E8F5", "#14A8C9", "#064A5C"],
};

/* The metal by place in the collection: highlight, light, middle, shade, deep. */
type Metal = [string, string, string, string, string];
const METALS: Metal[] = [
  ["#FFF8DC", "#F5D77A", "#D4A63A", "#9A7220", "#5E4410"], // won once: gold
  ["#FFE9D6", "#E8B48A", "#B87A4A", "#83502A", "#4E2E14"], // bronze
  ["#FFFFFF", "#E9EDF2", "#B9C1CC", "#8790A0", "#4E5562"], // silver
  ["#FFF8DC", "#F5D77A", "#D4A63A", "#9A7220", "#5E4410"], // gold
  ["#FFF4F7", "#F2D3DD", "#CFA3B3", "#9A6E7E", "#5E3E4A"], // rose platinum
  ["#FFFFFF", "#D8F8FF", "#9ADFF0", "#5AA6C4", "#2A5E78"], // diamond
];
const STEEL: Metal = ["#FFFFFF", "#E2E4E8", "#B8BCC4", "#8C9099", "#555A63"];
const STEEL_ENAMEL: [string, string, string] = ["#C9CDD4", "#9CA1AA", "#5F646D"];

export const medalHue = (m: Pick<Medal, "icon">) => HUE[m.icon][1];
const metalOf = (m: Medal): Metal => (m.earned ? METALS[Math.min(m.level, 5)] : STEEL);

function Face({ m, size, back = false }: { m: Medal; size: number; back?: boolean }) {
  const on = m.earned;
  const metal = metalOf(m);
  const enamel = on ? HUE[m.icon] : STEEL_ENAMEL;
  const id = `${m.id}-${back ? "b" : "f"}-${on ? 1 : 0}`.replace(/[^a-z0-9-]/gi, "_");
  const Icon = MEDAL_ICON[m.icon];
  const icon = size * 0.36;
  const depth = Math.max(1.5, size * 0.016);
  const knurls = size > 90 ? 120 : 60;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 200 200" style={{ position: "absolute" }}>
        <Defs>
          {/* Polished metal: the light falls in bands, not one smooth slope. */}
          <LinearGradient id={`${id}-rim`} x1="0.1" y1="0" x2="0.9" y2="1">
            <Stop offset="0" stopColor={metal[1]} />
            <Stop offset="0.18" stopColor={metal[0]} />
            <Stop offset="0.34" stopColor={metal[2]} />
            <Stop offset="0.5" stopColor={metal[3]} />
            <Stop offset="0.62" stopColor={metal[1]} />
            <Stop offset="0.8" stopColor={metal[3]} />
            <Stop offset="1" stopColor={metal[4]} />
          </LinearGradient>
          <LinearGradient id={`${id}-lip`} x1="0.1" y1="0" x2="0.9" y2="1">
            <Stop offset="0" stopColor={metal[4]} />
            <Stop offset="0.45" stopColor={metal[3]} />
            <Stop offset="0.8" stopColor={metal[1]} />
            <Stop offset="1" stopColor={metal[0]} />
          </LinearGradient>
          <RadialGradient id={`${id}-enamel`} cx="0.38" cy="0.3" r="0.85">
            <Stop offset="0" stopColor={enamel[0]} />
            <Stop offset="0.5" stopColor={enamel[1]} />
            <Stop offset="1" stopColor={enamel[2]} />
          </RadialGradient>
          <RadialGradient id={`${id}-plain`} cx="0.4" cy="0.32" r="0.8">
            <Stop offset="0" stopColor={metal[0]} />
            <Stop offset="0.5" stopColor={metal[2]} />
            <Stop offset="1" stopColor={metal[3]} />
          </RadialGradient>
          <LinearGradient id={`${id}-band`} x1="0" y1="0" x2="1" y2="0.4">
            <Stop offset="0" stopColor={metal[3]} />
            <Stop offset="0.3" stopColor={metal[1]} />
            <Stop offset="0.55" stopColor={metal[0]} />
            <Stop offset="0.8" stopColor={metal[2]} />
            <Stop offset="1" stopColor={metal[3]} />
          </LinearGradient>
          <LinearGradient id={`${id}-gloss`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.55} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
          <ClipPath id={`${id}-clip`}>
            <Circle cx={100} cy={100} r={72} />
          </ClipPath>
        </Defs>

        {/* The milled edge, then the polished rim. */}
        <Circle cx={100} cy={100} r={99} fill={metal[4]} />
        <Circle cx={100} cy={100} r={97.5} fill={`url(#${id}-rim)`} />
        <G opacity={0.4}>
          {Array.from({ length: knurls }).map((_, i) => {
            const a = (i / knurls) * Math.PI * 2;
            return <Line key={i} x1={100 + Math.cos(a) * 92.5} y1={100 + Math.sin(a) * 92.5} x2={100 + Math.cos(a) * 97.5} y2={100 + Math.sin(a) * 97.5} stroke={metal[4]} strokeWidth={1} />;
          })}
        </G>
        {/* A groove, and the lip that falls in to the field. */}
        <Circle cx={100} cy={100} r={88} fill="none" stroke={metal[4]} strokeWidth={2.2} opacity={0.55} />
        <Circle cx={100} cy={100} r={86.6} fill="none" stroke={metal[0]} strokeWidth={1} opacity={0.8} />
        <Circle cx={100} cy={100} r={84} fill={`url(#${id}-lip)`} />
        <Circle cx={100} cy={100} r={75} fill={metal[4]} opacity={0.7} />

        {back ? (
          <>
            <Circle cx={100} cy={100} r={73} fill={`url(#${id}-plain)`} />
            {/* Brushed: fine rings in the metal. */}
            {[18, 30, 42, 54, 66].map((r) => (
              <Circle key={r} cx={100} cy={100} r={r} fill="none" stroke={metal[0]} strokeWidth={0.6} opacity={0.35} />
            ))}
            {/* Engraved: each line cut in, a shadow above and light below. */}
            {[
              { t: "WILLO", y: 64, f: 12, w: "800", ls: 4 },
              { t: m.name, y: 98, f: m.name.length > 14 ? 16 : 20, w: "800", ls: 0 },
              ...(m.level > 0 ? [{ t: m.title.length > 22 ? `${m.title.slice(0, 21)}…` : m.title, y: 120, f: 13, w: "700", ls: 0 }] : []),
              { t: m.earned ? (m.earnedOn ? longDate(m.earnedOn) : "Conquistada") : "Ainda não conquistada", y: 146, f: 11, w: "700", ls: 0 },
            ].map((l, i) => (
              <G key={i}>
                <SvgText fontFamily="Helvetica" x={100} y={l.y + 0.9} fill={metal[0]} fontSize={l.f} fontWeight={l.w} letterSpacing={l.ls} textAnchor="middle" opacity={0.9}>
                  {l.t}
                </SvgText>
                <SvgText fontFamily="Helvetica" x={100} y={l.y} fill={metal[4]} fontSize={l.f} fontWeight={l.w} letterSpacing={l.ls} textAnchor="middle">
                  {l.t}
                </SvgText>
              </G>
            ))}
          </>
        ) : (
          <>
            {/* The enamel field, sunk a little: its top edge in shade. */}
            <Circle cx={100} cy={100} r={73} fill={`url(#${id}-enamel)`} />
            <Circle cx={100} cy={98} r={72} fill="none" stroke="#000" strokeWidth={4} opacity={0.22} />
            <G clipPath={`url(#${id}-clip)`}>
              {/* The metal band across the foot. */}
              <Path d="M0 138 L200 118 L200 200 L0 200 Z" fill={metal[4]} opacity={0.6} />
              <Path d="M0 141 L200 121 L200 200 L0 200 Z" fill={`url(#${id}-band)`} />
              <Path d="M0 141 L200 121" stroke={metal[0]} strokeWidth={1.4} />
              {/* Gloss on the enamel. */}
              <Ellipse cx={82} cy={62} rx={52} ry={26} fill={`url(#${id}-gloss)`} transform="rotate(-24 82 62)" />
            </G>
            {/* The number, struck into the band. */}
            {!on ? null : m.level > 0 ? (
              <G transform="rotate(-5.7 100 160)">
                <SvgText fontFamily="Helvetica" x={100} y={170.2} fill={metal[0]} fontSize={30} fontWeight="900" textAnchor="middle">
                  {String(m.level)}
                </SvgText>
                <SvgText fontFamily="Helvetica" x={100} y={168.6} fill={metal[4]} fontSize={30} fontWeight="900" textAnchor="middle">
                  {String(m.level)}
                </SvgText>
              </G>
            ) : (
              <G transform="rotate(-5.7 100 158)">
                <Polygon points="100,145 104.5,155 115,156 107,163 109.5,173 100,167.5 90.5,173 93,163 85,156 95.5,155" fill={metal[0]} transform="translate(0.6 0.9)" />
                <Polygon points="100,145 104.5,155 115,156 107,163 109.5,173 100,167.5 90.5,173 93,163 85,156 95.5,155" fill={metal[4]} />
              </G>
            )}
          </>
        )}

        {/* Light caught on the rim, and a glint or two. */}
        <Path d="M22 74 A82 82 0 0 1 112 9" stroke="#FFFFFF" strokeWidth={3.5} strokeLinecap="round" fill="none" opacity={0.75} />
        <Path d="M178 128 A82 82 0 0 1 140 180" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" fill="none" opacity={0.35} />
        {on && (
          <>
            <Polygon points="40,46 42.5,54 50,56 42.5,58 40,66 37.5,58 30,56 37.5,54" fill="#FFFFFF" opacity={0.95} />
            <Polygon points="166,150 167.6,155 172,156.5 167.6,158 166,163 164.4,158 160,156.5 164.4,155" fill="#FFFFFF" opacity={0.8} />
          </>
        )}
      </Svg>

      {/* The glyph, raised out of the enamel in the medal's metal: its shadow below, its body, the light on its top edge. */}
      {!back && (
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: size * 0.24, alignItems: "center", zIndex: 1 }}>
          {m.hidden ? (
            <Text style={{ fontSize: size * 0.34, fontWeight: "900", color: metal[1], textShadowColor: "rgba(0,0,0,0.45)", textShadowOffset: { width: 1, height: 2 }, textShadowRadius: 0 }}>?</Text>
          ) : (
            <View style={{ width: icon + depth * 2, height: icon + depth * 2 }}>
              <View style={{ position: "absolute", left: depth * 1.4, top: depth * 1.8, opacity: 0.5 }}>
                <Icon size={icon} color="#000000" strokeWidth={3.2} />
              </View>
              <View style={{ position: "absolute", left: depth * 0.7, top: depth * 0.9 }}>
                <Icon size={icon} color={metal[4]} strokeWidth={3.2} />
              </View>
              <View style={{ position: "absolute", left: 0, top: 0 }}>
                <Icon size={icon} color={metal[2]} strokeWidth={3} />
              </View>
              <View style={{ position: "absolute", left: -0.7, top: -0.8 }}>
                <Icon size={icon} color={metal[0]} strokeWidth={1.1} />
              </View>
            </View>
          )}
        </View>
      )}
      {!back && !on && !m.hidden && (
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: size * 0.765, alignItems: "center", zIndex: 1 }}>
          <Lock size={size * 0.09} color={STEEL[4]} strokeWidth={2.8} />
        </View>
      )}
    </View>
  );
}

/** The medal as it sits in the collection. */
export function MedalArt({ m, size }: { m: Medal; size: number }) {
  return (
    <View style={{ width: size, height: size }}>
      <View style={{ position: "absolute", left: size * 0.2, right: size * 0.2, bottom: -size * 0.02, height: size * 0.05, borderRadius: size, backgroundColor: "rgba(0,0,0,0.12)" }} />
      <Face m={m} size={size} />
    </View>
  );
}

/* Its thickness, as discs stacked from back to front. */
const EDGE_LAYERS = 9;

function EdgeDisc({ angle, z, size, color, ring }: { angle: SharedValue<number>; z: number; size: number; color: string; ring: string }) {
  const style = useAnimatedStyle(() => {
    const rad = (angle.get() * Math.PI) / 180;
    return { transform: [{ perspective: 900 }, { translateX: z * Math.sin(rad) }, { rotateY: `${angle.get()}deg` }] };
  });
  return <Animated.View style={[{ position: "absolute", width: size, height: size, borderRadius: size / 2, backgroundColor: color, borderWidth: 1, borderColor: ring }, style]} />;
}

/**
 * The medal, opened: turned round with a finger, its edge showing as it turns and light
 * sliding over its face, the back at the half turn, coming to rest face up. It makes one
 * slow turn as it opens, to show it can.
 */
export function SpinningMedal({ m, size }: { m: Medal; size: number }) {
  const angle = useSharedValue(-360);
  const from = useSharedValue(0);
  const metal = metalOf(m);
  const half = size * 0.045;

  useEffect(() => {
    angle.set(-360);
    angle.set(withTiming(0, { duration: 1800, easing: Easing.out(Easing.cubic) }));
  }, [angle, m.id]);

  const pan = Gesture.Pan()
    .onBegin(() => {
      from.set(angle.get());
    })
    .onUpdate((e) => {
      angle.set(from.get() + e.translationX * 0.7);
    })
    .onEnd((e) => {
      /* Flung, it turns on a little; it always settles face up. */
      const ahead = angle.get() + e.velocityX * 0.12;
      angle.set(withSpring(Math.round(ahead / 360) * 360, { damping: 16, stiffness: 70, velocity: e.velocityX * 0.5 }));
    });

  const front = useAnimatedStyle(() => {
    const rad = (angle.get() * Math.PI) / 180;
    return { transform: [{ perspective: 900 }, { translateX: half * Math.sin(rad) }, { rotateY: `${angle.get()}deg` }] };
  });
  const backSide = useAnimatedStyle(() => {
    const rad = (angle.get() * Math.PI) / 180;
    return { transform: [{ perspective: 900 }, { translateX: -half * Math.sin(rad) }, { rotateY: `${angle.get() + 180}deg` }] };
  });
  /* Light sliding across the face as it turns. */
  const sheen = useAnimatedStyle(() => {
    const turn = ((angle.get() % 360) + 360) % 360;
    return { transform: [{ translateX: (turn / 360) * size * 2.4 - size * 1.2 }, { rotate: "20deg" }], opacity: 0.55 };
  });

  return (
    <GestureDetector gesture={pan}>
      <View style={{ width: size, height: size }}>
        {Array.from({ length: EDGE_LAYERS }).map((_, i) => (
          <EdgeDisc key={i} angle={angle} z={-half + (i * 2 * half) / (EDGE_LAYERS - 1)} size={size} color={i % 2 ? metal[3] : metal[2]} ring={metal[4]} />
        ))}
        <Animated.View style={[{ position: "absolute", width: size, height: size, backfaceVisibility: "hidden" }, backSide]}>
          <Face m={m} size={size} back />
        </Animated.View>
        <Animated.View style={[{ position: "absolute", width: size, height: size, backfaceVisibility: "hidden" }, front]}>
          <Face m={m} size={size} />
          <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, width: size, height: size, borderRadius: size / 2, overflow: "hidden", zIndex: 2 }}>
            <Animated.View style={[{ position: "absolute", top: -size * 0.2, width: size * 0.35, height: size * 1.4 }, sheen]}>
              <Shine colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.7)", "rgba(255,255,255,0)"]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
            </Animated.View>
          </View>
        </Animated.View>
      </View>
    </GestureDetector>
  );
}
