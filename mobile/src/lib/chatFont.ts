import * as Font from "expo-font";
import type { TextStyle } from "react-native";
import { PlusJakartaSans_500Medium } from "@expo-google-fonts/plus-jakarta-sans/500Medium";
import { PlusJakartaSans_600SemiBold } from "@expo-google-fonts/plus-jakarta-sans/600SemiBold";
import { PlusJakartaSans_700Bold } from "@expo-google-fonts/plus-jakarta-sans/700Bold";
import { PlusJakartaSans_800ExtraBold } from "@expo-google-fonts/plus-jakarta-sans/800ExtraBold";

/**
 * The typeface of the conversation with Willo: Plus Jakarta Sans, the one the web's
 * headings already use. Only the weights in use are loaded. Until they are, or if they
 * could not be, the system face stands in at the same weight.
 */

const FACES = {
  500: "PlusJakartaSans_500Medium",
  600: "PlusJakartaSans_600SemiBold",
  700: "PlusJakartaSans_700Bold",
  800: "PlusJakartaSans_800ExtraBold",
} as const;

export function loadChatFonts() {
  return Font.loadAsync({
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  }).catch(() => undefined);
}

export function face(weight: keyof typeof FACES): TextStyle {
  const family = FACES[weight];
  return Font.isLoaded(family) ? { fontFamily: family } : { fontWeight: String(weight) as TextStyle["fontWeight"] };
}
