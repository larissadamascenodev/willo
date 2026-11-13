import { useId } from "react";
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";

/**
 * Willo PRO's own mark: a small graphite tile, like an app icon, with a crown in the
 * Willo green. Drawn the same in both themes. `muted` is the plan not taken yet: the
 * crown is grey.
 */
export default function ProMark({ size = 36, muted = false }: { size?: number; muted?: boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const bg = `pm-bg-${id}`;
  const gold = `pm-crown-${id}`;
  const sheen = `pm-sheen-${id}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Defs>
        <LinearGradient id={bg} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#30333A" />
          <Stop offset="1" stopColor="#0C0D10" />
        </LinearGradient>
        <LinearGradient id={gold} x1="0.2" y1="0" x2="0.8" y2="1">
          <Stop offset="0" stopColor={muted ? "#D4D6DB" : "#D2F5D2"} />
          <Stop offset="0.5" stopColor={muted ? "#9A9DA4" : "#67CD67"} />
          <Stop offset="1" stopColor={muted ? "#5E6168" : "#3B9442"} />
        </LinearGradient>
        <LinearGradient id={sheen} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.13" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Rect x="0.5" y="0.5" width="47" height="47" rx="15" fill={`url(#${bg})`} stroke="rgba(255,255,255,0.16)" strokeWidth="1" />
      <Rect x="1" y="1" width="46" height="22" rx="14.5" fill={`url(#${sheen})`} />
      {/* The crown: three points, a band below. */}
      <Path d="M13 31.5 L11 18.5 L18.6 24.2 L24 14.5 L29.4 24.2 L37 18.5 L35 31.5 Z" fill={`url(#${gold})`} strokeLinejoin="round" stroke={`url(#${gold})`} strokeWidth="1.6" />
      <Rect x="13" y="33.5" width="22" height="3.4" rx="1.7" fill={`url(#${gold})`} />
      <Circle cx="11" cy="17.6" r="2.1" fill={`url(#${gold})`} />
      <Circle cx="24" cy="13.2" r="2.3" fill={`url(#${gold})`} />
      <Circle cx="37" cy="17.6" r="2.1" fill={`url(#${gold})`} />
      <Circle cx="24" cy="26" r="1.6" fill="#FFFFFF" opacity={muted ? 0.45 : 0.85} />
    </Svg>
  );
}
