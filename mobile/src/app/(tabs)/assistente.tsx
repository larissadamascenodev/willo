import { Redirect } from "expo-router";
import { useThemeRedraw } from "~/theme/theme";

/* Willo lives in one place: the conversation screen. */
export default function Assistente() {
  /* Drawn again in place when the theme changes. */
  useThemeRedraw();
  return <Redirect href={"/registro" as never} />;
}
