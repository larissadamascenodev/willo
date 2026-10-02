import { Image } from "expo-image";

const RATIO = 704 / 251;

/** O logotipo do Willo em branco, na altura pedida. */
export function Logo({ height = 28 }: { height?: number }) {
  return (
    <Image
      source={require("@/assets/logo/willo-wordmark-light.png")}
      tintColor="#fff"
      contentFit="contain"
      accessibilityLabel="Willo"
      style={{ height, width: height * RATIO }}
    />
  );
}
