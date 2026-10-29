import { Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { bankFor, initials } from "@/lib/banks";
import { catalogFor } from "~/lib/bankCatalog";
import { inkOn, shade } from "@/lib/tone";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const WILLO_MARK = require("../../assets/willo-wallet.png") as number;

/**
 * The bank, as a mark.
 *
 * The bank's own logo where the app has one, on a tile the shape of an app icon; and
 * where it does not — a store card, a "cartão da obra", a bank whose logo is not in
 * the catalogue — the initials on a tile in the colour, which is how you pick your
 * card out of a wallet anyway, by colour first and letters second.
 */
export default function BankMark({
  name,
  hex,
  size = 44,
}: {
  name: string;
  /** The card's colour, already resolved. */
  hex: string;
  size?: number;
}) {
  const bank = bankFor(name);
  const known = catalogFor(name);
  const letters = initials(bank?.name ?? known?.name ?? name) || "••";
  const radius = size / 2;

  /* The wallet is Willo's own mark: the disc already has its shape, so it is drawn
     whole, with nothing behind it. */
  if (known?.id === "wallet") {
    return (
      <Image
        source={WILLO_MARK}
        contentFit="cover"
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }

  if (known?.logo) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          borderCurve: "continuous",
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: known.bleed ? known.hex : "#FFFFFF",
        }}
      >
        <Image
          source={known.logo}
          contentFit={known.bleed ? "cover" : "contain"}
          style={known.bleed ? { width: size, height: size } : { width: size * 0.62, height: size * 0.62 }}
        />
      </View>
    );
  }

  return (
    <LinearGradient
      colors={[shade(hex, 0.18), hex, shade(hex, -0.26)]}
      locations={[0, 0.58, 1]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* The inner highlight the web gets from an inset shadow. */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          backgroundColor: "rgba(255,255,255,0.3)",
          borderTopLeftRadius: radius,
          borderTopRightRadius: radius,
        }}
      />
      <Text style={{ fontSize: 14, fontWeight: "800", letterSpacing: -0.3, color: inkOn(hex) }}>
        {letters}
      </Text>
    </LinearGradient>
  );
}
