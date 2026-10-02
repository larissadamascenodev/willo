import { Text as RNText, type TextProps as RNTextProps } from "react-native";
import { colors, fonts, type Weight } from "./theme";

export interface TextProps extends RNTextProps {
  size?: number;
  weight?: Weight;
  color?: string;
  /** Plus Jakarta Sans, a fonte dos títulos. */
  display?: boolean;
  /** Dígitos de largura fixa, para valores em coluna e contadores. */
  tabular?: boolean;
  align?: "left" | "center" | "right";
}

/**
 * O texto padrão: Inter, branco. No React Native a cor e a fonte não passam de um elemento
 * para o outro como no CSS, então todo texto do app sai daqui.
 */
export function Text({ size = 14, weight = "regular", color = colors.white, display, tabular, align, style, ...rest }: TextProps) {
  const family = display ? (weight === "extrabold" ? fonts.displayExtra : fonts.displayBold) : fonts[weight];
  return (
    <RNText
      {...rest}
      style={[
        { fontFamily: family, fontSize: size, color, textAlign: align },
        tabular && { fontVariant: ["tabular-nums"] },
        style,
      ]}
    />
  );
}
