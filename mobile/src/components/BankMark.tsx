import { Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { bankFor, initials } from "@/lib/banks";
import { inkOn, shade } from "@/lib/tone";

/**
 * The bank, as a mark.
 *
 * Not the bank's own logo: those are trademarks, and shipping them means shipping
 * someone else's artwork inside the app. This is the next most recognisable thing —
 * the bank's initials on a tile in the bank's own colour, which is how you pick your
 * card out of a wallet anyway, by colour first and letters second.
 *
 * A card with no bank behind it (a store card, a "cartão da obra") gets the initials
 * of whatever it was called, so every card has a face.
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
  const letters = initials(bank?.name ?? name) || "••";

  return (
    <LinearGradient
      colors={[shade(hex, 0.18), hex, shade(hex, -0.26)]}
      locations={[0, 0.58, 1]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius: 14,
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
          borderTopLeftRadius: 14,
          borderTopRightRadius: 14,
        }}
      />
      <Text style={{ fontSize: 14, fontWeight: "800", letterSpacing: -0.3, color: inkOn(hex) }}>
        {letters}
      </Text>
    </LinearGradient>
  );
}
