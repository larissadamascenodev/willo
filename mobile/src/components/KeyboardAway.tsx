import type { ReactNode } from "react";
import { Keyboard, Pressable, type StyleProp, type ViewStyle } from "react-native";

/**
 * A tap anywhere in it that is not on a field or a button puts the keyboard away.
 *
 * Every window with a field is wrapped in one, so the keyboard never sits over the
 * rest of the form: it goes when the person taps outside the field, and comes back
 * only when they tap a field again.
 */
export default function KeyboardAway({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable onPress={Keyboard.dismiss} accessible={false} style={style}>
      {children}
    </Pressable>
  );
}
