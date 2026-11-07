import EmBreve from "~/components/EmBreve";
import { useThemeRedraw } from "~/theme/theme";

export default function Agentes() {
  /* Drawn again in place when the theme changes. */
  useThemeRedraw();
  return <EmBreve title="Agentes" />;
}
