import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

/**
 * An iPhone, drawn as close to the real one as the screen allows, front or back.
 *
 * The titanium band catches the light at its edges; the side buttons stand out of it.
 * From the front: the black border, the Dynamic Island, the status bar and glass over
 * the screen. From the back: frosted glass, and the camera plateau with its three
 * lenses — each a metal ring, deep glass and a coloured reflection — the flash and the
 * sensor. Everything scales from one width, keeping the real proportions.
 */

const RATIO = 2.06;
const TITANIUM = ["#D9DCE0", "#7B7F86", "#B3B7BD", "#4E5258", "#9EA2A8", "#E3E6E9"] as const;

function Buttons({ w, h, back }: { w: number; h: number; back: boolean }) {
  const k = w / 206;
  const side = { position: "absolute" as const, width: 3.2 * k, borderRadius: 2 * k };
  const near = back ? { right: -2 * k } : { left: -2 * k };
  const far = back ? { left: -2 * k } : { right: -2 * k };
  const metal = ["#C7CBD0", "#6D7178"] as const;
  return (
    <>
      <LinearGradient colors={metal} style={[side, near, { top: h * 0.21, height: 22 * k }]} />
      <LinearGradient colors={metal} style={[side, near, { top: h * 0.3, height: 42 * k }]} />
      <LinearGradient colors={metal} style={[side, near, { top: h * 0.41, height: 42 * k }]} />
      <LinearGradient colors={metal} style={[side, far, { top: h * 0.33, height: 66 * k }]} />
    </>
  );
}

function Band({ w, h, children }: { w: number; h: number; children: ReactNode }) {
  const k = w / 206;
  return (
    <LinearGradient colors={TITANIUM} locations={[0, 0.18, 0.42, 0.66, 0.86, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: w, height: h, borderRadius: 50 * k, borderCurve: "continuous", padding: 3.2 * k }}>
      {children}
    </LinearGradient>
  );
}

/** The front: the screen, with whatever is passed shown on it. */
export function PhoneFront({ width, children, time = "9:41" }: { width: number; children?: ReactNode; time?: string }) {
  const w = width;
  const h = w * RATIO;
  const k = w / 206;
  const R = 50 * k;
  return (
    <View style={{ width: w, height: h, shadowColor: "#000", shadowOpacity: 0.7, shadowRadius: 30 * k, shadowOffset: { width: 0, height: 18 * k } }}>
      <Buttons w={w} h={h} back={false} />
      <Band w={w} h={h}>
        <View style={{ flex: 1, borderRadius: R - 3.2 * k, borderCurve: "continuous", backgroundColor: "#000", padding: 6 * k }}>
          <View style={{ flex: 1, borderRadius: R - 9.2 * k, borderCurve: "continuous", overflow: "hidden", backgroundColor: "#0B0C0F" }}>
            {children}
            <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, height: 34 * k, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 22 * k }}>
              <Text style={{ fontSize: 11 * k, fontWeight: "700", color: "#fff" }}>{time}</Text>
              <View style={{ flexDirection: "row", gap: 2 * k, alignItems: "flex-end" }}>
                {[4, 5.5, 7, 8.5].map((b) => (
                  <View key={b} style={{ width: 2.5 * k, height: b * k, borderRadius: 1, backgroundColor: "#fff" }} />
                ))}
                <View style={{ marginLeft: 4 * k, width: 17 * k, height: 8.5 * k, borderRadius: 3 * k, borderWidth: 1, borderColor: "rgba(255,255,255,0.6)", padding: 1 }}>
                  <View style={{ flex: 1, width: "80%", borderRadius: 1.5, backgroundColor: "#fff" }} />
                </View>
              </View>
            </View>
            <View pointerEvents="none" style={{ position: "absolute", top: 9 * k, alignSelf: "center", width: 62 * k, height: 18 * k, borderRadius: 9 * k, backgroundColor: "#000" }} />
            <LinearGradient pointerEvents="none" colors={["rgba(255,255,255,0.1)", "rgba(255,255,255,0)", "rgba(255,255,255,0)"]} locations={[0, 0.4, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} />
          </View>
        </View>
      </Band>
    </View>
  );
}

/** One lens: a metal ring, deep glass, a coloured reflection and a point of light. */
function Lens({ d }: { d: number }) {
  const id = `lens-${Math.round(d)}`;
  return (
    <View style={{ width: d, height: d, borderRadius: d / 2, shadowColor: "#000", shadowOpacity: 0.6, shadowRadius: d * 0.12, shadowOffset: { width: 0, height: d * 0.06 } }}>
      <LinearGradient colors={["#9EA2A8", "#3B3E43", "#6B6F75"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: d, height: d, borderRadius: d / 2, alignItems: "center", justifyContent: "center" }}>
        <View style={{ width: d * 0.8, height: d * 0.8, borderRadius: d * 0.4, backgroundColor: "#0A0B0D", alignItems: "center", justifyContent: "center", borderWidth: d * 0.04, borderColor: "#1C1E22" }}>
          <Svg width={d * 0.62} height={d * 0.62}>
            <Defs>
              <RadialGradient id={id} cx="0.4" cy="0.38" r="0.6">
                <Stop offset="0" stopColor="#3D4F7A" stopOpacity={0.95} />
                <Stop offset="0.45" stopColor="#1A1F35" stopOpacity={1} />
                <Stop offset="1" stopColor="#050608" stopOpacity={1} />
              </RadialGradient>
            </Defs>
            <Circle cx={d * 0.31} cy={d * 0.31} r={d * 0.31} fill={`url(#${id})`} />
            <Circle cx={d * 0.22} cy={d * 0.21} r={d * 0.06} fill="rgba(255,255,255,0.75)" />
            <Circle cx={d * 0.4} cy={d * 0.42} r={d * 0.03} fill="rgba(170,140,255,0.6)" />
          </Svg>
        </View>
      </LinearGradient>
    </View>
  );
}

/** The back: frosted glass, the camera plateau, and any light passed over it. */
export function PhoneBack({ width, children }: { width: number; children?: ReactNode }) {
  const w = width;
  const h = w * RATIO;
  const k = w / 206;
  const R = 50 * k;
  const plate = 92 * k;
  const lens = 38 * k;
  return (
    <View style={{ width: w, height: h, shadowColor: "#000", shadowOpacity: 0.7, shadowRadius: 30 * k, shadowOffset: { width: 0, height: 18 * k } }}>
      <Buttons w={w} h={h} back />
      <Band w={w} h={h}>
        <LinearGradient colors={["#45474D", "#34363B", "#2A2C30"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, borderRadius: R - 3.2 * k, borderCurve: "continuous", overflow: "hidden" }}>
          <LinearGradient pointerEvents="none" colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.07)", "rgba(255,255,255,0)"]} locations={[0.2, 0.42, 0.62]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} />
          {/* The camera plateau. */}
          <View style={{ position: "absolute", left: 11 * k, top: 11 * k, width: plate, height: plate, borderRadius: 24 * k, borderCurve: "continuous", shadowColor: "#000", shadowOpacity: 0.55, shadowRadius: 6 * k, shadowOffset: { width: 0, height: 3 * k } }}>
            <LinearGradient colors={["#55585E", "#36383D"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, borderRadius: 24 * k, borderCurve: "continuous", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)" }}>
              <View style={{ position: "absolute", left: 5 * k, top: 5 * k }}>
                <Lens d={lens} />
              </View>
              <View style={{ position: "absolute", left: 5 * k, top: plate - lens - 5 * k }}>
                <Lens d={lens} />
              </View>
              <View style={{ position: "absolute", left: plate - lens - 5 * k, top: (plate - lens) / 2 }}>
                <Lens d={lens} />
              </View>
              <View style={{ position: "absolute", left: plate - 26 * k, top: 7 * k, width: 13 * k, height: 13 * k, borderRadius: 7 * k, backgroundColor: "#E8E1CC", borderWidth: 2 * k, borderColor: "#5E6167" }} />
              <View style={{ position: "absolute", left: plate - 25 * k, top: plate - 22 * k, width: 11 * k, height: 11 * k, borderRadius: 6 * k, backgroundColor: "#0B0C0E", borderWidth: 2 * k, borderColor: "#4E5157" }} />
              <View style={{ position: "absolute", left: plate - 12 * k, top: plate / 2 + 22 * k, width: 3.5 * k, height: 3.5 * k, borderRadius: 2 * k, backgroundColor: "#111" }} />
            </LinearGradient>
          </View>
          {children}
        </LinearGradient>
      </Band>
    </View>
  );
}
