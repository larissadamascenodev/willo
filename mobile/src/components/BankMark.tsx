import { Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { bankFor, initials } from "@/lib/banks";
import { catalogFor } from "~/lib/bankCatalog";
import { Wallet } from "~/components/icons";
import { inkOn, shade } from "@/lib/tone";

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
  const radius = Math.round(size * 0.32);

  if (known?.id === "wallet") {
    return (
      <LinearGradient
        colors={[shade(known.hex, 0.22), known.hex, shade(known.hex, -0.2)]}
        locations={[0, 0.55, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={{ width: size, height: size, borderRadius: radius, overflow: "hidden", alignItems: "center", justifyContent: "center" }}
      >
        <Wallet size={size * 0.48} color="#0B0B0B" strokeWidth={2.2} />
      </LinearGradient>
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
          style={known.bleed ? { width: size, height: size } : { width: size * 0.74, height: size * 0.74 }}
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
