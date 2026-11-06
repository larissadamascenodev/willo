import { type ReactNode } from "react";
import { Pressable, View, type ViewStyle } from "react-native";
import { INK } from "~/theme/tokens";

import { isLight, th } from "~/theme/theme";
/**
 * A card, one step up from the ground.
 *
 * The web's `.willo-glass` is not a blur — over a flat ground a blur samples one
 * colour, costs a layer and buys nothing — it is a hairline border and white at
 * four and a half percent. So this is the same two values, and the glass look
 * survives the crossing without a BlurView anywhere near it. Only sheets and menus,
 * which sit over real content, get a true blur.
 */

/* A touch stronger than the web's four and a half percent. The browser renders on
   a backlit panel that never reaches black; an OLED phone does, and at that fill a
   card over the dark end of the ground stopped being a card at all. */
export const SURFACE_FILL = "rgba(255,255,255,0.062)";

export default function Surface({
  children,
  onPress,
  radius = 22,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  radius?: number;
  style?: ViewStyle;
}) {
  const skin: ViewStyle = {
    borderRadius: radius,
    borderWidth: 1,
    /* In the light a card is frosted white over the coloured ground, so the colour
       still shows through as the page scrolls; in the dark it is white at a whisper. */
    borderColor: isLight() ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.10)",
    backgroundColor: isLight() ? "rgba(255,255,255,0.62)" : SURFACE_FILL,
    overflow: "hidden",
  };

  if (!onPress) return <View style={[skin, style]}>{children}</View>;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [skin, style, pressed && { transform: [{ scale: 0.99 }] }]}
    >
      {children}
    </Pressable>
  );
}

/** The hairline that separates rows inside a card, and on the open page. */
export function Hairline({ style }: { style?: ViewStyle }) {
  return <View style={[{ height: 1, backgroundColor: th("rgba(255,255,255,0.06)", "bg") }, style]} />;
}
