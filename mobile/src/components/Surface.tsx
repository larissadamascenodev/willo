import { type ReactNode } from "react";
import { Pressable, View, type ViewStyle } from "react-native";
import { INK } from "~/theme/tokens";

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
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: SURFACE_FILL,
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
  return <View style={[{ height: 1, backgroundColor: "rgba(255,255,255,0.06)" }, style]} />;
}
