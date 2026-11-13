import { useState } from "react";
import { Text, View } from "react-native";
import { Image } from "expo-image";
import { knownSub, logoUrl } from "~/lib/subscriptionLogos";
import Svg, { Circle, Line, Path, Polygon, Rect, Text as SvgText } from "react-native-svg";
import { th } from "~/theme/theme";

/**
 * A known shop's or service's mark: its real logo filling the whole mark, on its own colour; anything unknown, or a logo that does not load, gets its first letter in a
 * colour of its own.
 */

const PALETTE = ["#B48CFF", "#7CC4FF", "#F5C26B", "#3FE0B8", "#FF8FA3", "#9EE493"];
const colourOf = (name: string) => PALETTE[[...name].reduce((t, c) => t + c.charCodeAt(0), 0) % PALETTE.length];

export default function SubLogo({ name, size = 40, ring = false, round = false }: { name: string; size?: number; ring?: boolean; /** A circle, for the lists whose marks are round. */ round?: boolean }) {
  const known = knownSub(name);
  const [failed, setFailed] = useState(false);
  const radius = round ? size / 2 : Math.round(size * 0.28);
  const border = ring ? { borderWidth: 2, borderColor: th("#121315", "line") } : null;

  if (known?.mark) {
    return (
      <View style={[{ width: size, height: size, borderRadius: radius, overflow: "hidden", backgroundColor: known.hex }, border]} accessibilityLabel={known.name}>
        <BrandMark mark={known.mark} size={size} />
      </View>
    );
  }

  if (known && !failed) {
    return (
      /* The logo fills the whole mark, on the brand's own colour — no white tile behind it. */
      <View style={[{ width: size, height: size, borderRadius: radius, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: known.hex }, border]}>
        <Image
          source={{ uri: known.logo ?? logoUrl(known.domain) }}
          cachePolicy="disk"
          contentFit="cover"
          onError={() => setFailed(true)}
          style={{ width: size, height: size }}
          accessibilityLabel={known.name}
        />
      </View>
    );
  }

  const hex = known?.hex ?? colourOf(name);
  return (
    <View style={[{ width: size, height: size, borderRadius: radius, alignItems: "center", justifyContent: "center", backgroundColor: th(`${hex}2E`, "bg") }, border]}>
      <Text style={{ fontSize: size * 0.42, fontWeight: "800", color: th(hex) }}>{(name.trim()[0] ?? "?").toUpperCase()}</Text>
    </View>
  );
}

/** The few marks drawn by hand: crisp at any size, filling the tile on the brand's colour. */
function BrandMark({ mark, size }: { mark: "netflix" | "spotify" | "youtube" | "max" | "claude"; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {mark === "netflix" && (
        <>
          <Rect x={31} y={20} width={12} height={60} fill="#B1060F" />
          <Rect x={57} y={20} width={12} height={60} fill="#B1060F" />
          <Polygon points="31,20 43,20 69,80 57,80" fill="#E50914" />
        </>
      )}
      {mark === "spotify" && (
        <>
          <Path d="M25 39 Q51 29 77 42" stroke="#121212" strokeWidth={8} strokeLinecap="round" fill="none" />
          <Path d="M28 53 Q50 45 72 56" stroke="#121212" strokeWidth={6.5} strokeLinecap="round" fill="none" />
          <Path d="M31 66 Q49 60 67 68" stroke="#121212" strokeWidth={5.5} strokeLinecap="round" fill="none" />
        </>
      )}
      {mark === "youtube" && <Polygon points="40,32 40,68 71,50" fill="#FFFFFF" />}
      {mark === "max" && (
        <SvgText x={50} y={61} fontSize={34} fontWeight="800" fontFamily="Helvetica Neue, Helvetica, Arial, sans-serif" fill="#FFFFFF" textAnchor="middle" letterSpacing={-1}>
          max
        </SvgText>
      )}
      {mark === "claude" && (
        <>
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg, i) => {
            const a = (deg * Math.PI) / 180;
            const r = [30, 24, 28, 22, 30, 25, 27, 23, 29, 24, 28, 22][i];
            return <Line key={deg} x1={50 + Math.cos(a) * 9} y1={50 + Math.sin(a) * 9} x2={50 + Math.cos(a) * r} y2={50 + Math.sin(a) * r} stroke="#FFFFFF" strokeWidth={6} strokeLinecap="round" />;
          })}
          <Circle cx={50} cy={50} r={7} fill="#FFFFFF" />
        </>
      )}
    </Svg>
  );
}
