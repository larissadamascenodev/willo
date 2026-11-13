import { useState } from "react";
import { Text, View } from "react-native";
import { Image } from "expo-image";
import { knownSub, logoUrl } from "~/lib/subscriptionLogos";
import { th } from "~/theme/theme";

/**
 * A subscription's mark: the service's real logo on a white tile, the way it looks as an
 * app icon; anything unknown, or a logo that does not load, gets its first letter in a
 * colour of its own.
 */

const PALETTE = ["#B48CFF", "#7CC4FF", "#F5C26B", "#3FE0B8", "#FF8FA3", "#9EE493"];
const colourOf = (name: string) => PALETTE[[...name].reduce((t, c) => t + c.charCodeAt(0), 0) % PALETTE.length];

export default function SubLogo({ name, size = 40, ring = false, round = false }: { name: string; size?: number; ring?: boolean; /** A circle, for the lists whose marks are round. */ round?: boolean }) {
  const known = knownSub(name);
  const [failed, setFailed] = useState(false);
  const radius = round ? size / 2 : Math.round(size * 0.28);
  const border = ring ? { borderWidth: 2, borderColor: th("#121315", "line") } : null;

  if (known && !failed) {
    return (
      <View style={[{ width: size, height: size, borderRadius: radius, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" }, border]}>
        <Image
          source={{ uri: logoUrl(known.domain) }}
          cachePolicy="disk"
          contentFit="contain"
          onError={() => setFailed(true)}
          style={{ width: size * 0.7, height: size * 0.7 }}
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
