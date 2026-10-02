import { Image } from "expo-image";

const IMAGES = {
  feliz: require("@/assets/mascot/willo-feliz.png"),
  pensando: require("@/assets/mascot/willo-pensando.png"),
  conquistando: require("@/assets/mascot/willo-conquistando.png"),
  comemorando: require("@/assets/mascot/willo-comemorando.png"),
  economizando: require("@/assets/mascot/willo-economizando.png"),
  planejando: require("@/assets/mascot/willo-planejando.png"),
  alerta: require("@/assets/mascot/willo-alerta.png"),
} as const;

export type MascotVariant = keyof typeof IMAGES;

/** O esquilo Willo em uma das sete poses. */
export function Mascot({ variant = "feliz", size = 120 }: { variant?: MascotVariant; size?: number }) {
  return <Image source={IMAGES[variant]} contentFit="contain" accessibilityLabel="Willo, o esquilo mascote" style={{ width: size, height: size }} />;
}
