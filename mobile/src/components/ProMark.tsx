import { useId } from "react";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";

/**
 * Willo PRO's own mark: a small graphite tile, like an app icon, with a spark of the
 * Willo green in the middle and a glint of white at its corner. Drawn the same in both
 * themes. `muted` is the plan not taken yet: the spark is grey.
 */
export default function ProMark({ size = 44, muted = false }: { size?: number; muted?: boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const bg = `pm-bg-${id}`;
  const gem = `pm-gem-${id}`;
  const sheen = `pm-sheen-${id}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Defs>
        <LinearGradient id={bg} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#30333A" />
          <Stop offset="1" stopColor="#0C0D10" />
        </LinearGradient>
        <LinearGradient id={gem} x1="0.2" y1="0" x2="0.8" y2="1">
          <Stop offset="0" stopColor={muted ? "#D4D6DB" : "#D2F5D2"} />
          <Stop offset="0.45" stopColor={muted ? "#9A9DA4" : "#67CD67"} />
          <Stop offset="1" stopColor={muted ? "#5E6168" : "#3B9442"} />
        </LinearGradient>
        <LinearGradient id={sheen} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.13" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Rect x="0.5" y="0.5" width="47" height="47" rx="14" fill={`url(#${bg})`} stroke="rgba(255,255,255,0.16)" strokeWidth="1" />
      <Rect x="1" y="1" width="46" height="22" rx="13.5" fill={`url(#${sheen})`} />
      <Path d="M23.5 11 C24.7 19.6 28 22.9 36.5 24.1 C28 25.3 24.7 28.6 23.5 37.2 C22.3 28.6 19 25.3 10.5 24.1 C19 22.9 22.3 19.6 23.5 11 Z" fill={`url(#${gem})`} />
      <Path d="M35 8.8 C35.4 11.9 36.4 12.9 39.4 13.3 C36.4 13.7 35.4 14.7 35 17.8 C34.6 14.7 33.6 13.7 30.6 13.3 C33.6 12.9 34.6 11.9 35 8.8 Z" fill="#FFFFFF" opacity={muted ? 0.5 : 0.92} />
    </Svg>
  );
}
