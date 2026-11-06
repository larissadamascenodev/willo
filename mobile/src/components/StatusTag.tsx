import { type ComponentType } from "react";
import { Text, View, type TextStyle } from "react-native";
import { isLight } from "~/theme/theme";

/**
 * A short status in its colour: Aberta, Fechada, Paga, Vencida, Pendente, Falta a
 * forma de pagamento.
 *
 * The same tag wherever a status is shown, so an invoice reads the same on the
 * wallet and on its own page. On the dark ground the colour carries it. On the light
 * one the soft colours (the amber, the sky blue) wash out, so the letters keep their
 * colour and get a fine dark outline, and the tint behind them is a little stronger.
 */

export function outlinedInk(tone: string): TextStyle {
  if (!isLight()) return { color: tone };
  return {
    color: tone,
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 1.4,
  };
}

function tint(hex: string, alpha: number) {
  const h = hex.replace("#", "");
  if (h.length !== 6) return `rgba(255,255,255,${alpha})`;
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

export const TAG_TONES = {
  open: "#8FC7FF",
  closed: "#F5C26B",
  paid: "#67CD67",
  overdue: "#F87171",
  warn: "#F9CE4E",
} as const;

export default function StatusTag({
  label,
  tone,
  Icon,
  small = false,
}: {
  label: string;
  /** A #rrggbb colour. */
  tone: string;
  Icon?: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  small?: boolean;
}) {
  const light = isLight();
  const h = small ? 24 : 28;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        gap: 6,
        height: h,
        paddingLeft: Icon ? 4 : 10,
        paddingRight: small ? 9 : 11,
        borderRadius: h / 2,
        backgroundColor: tint(tone, light ? 0.24 : 0.12),
        borderWidth: light ? 1 : 0,
        borderColor: tint(tone, 0.55),
      }}
    >
      {Icon && (
        <View style={{ width: h - 8, height: h - 8, borderRadius: (h - 8) / 2, alignItems: "center", justifyContent: "center", backgroundColor: tone }}>
          <Icon size={small ? 10 : 11} color="#0B0B0B" strokeWidth={3} />
        </View>
      )}
      <Text style={[{ fontSize: small ? 11 : 12.5, fontWeight: "700" }, outlinedInk(tone)]}>{label}</Text>
    </View>
  );
}
