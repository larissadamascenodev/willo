import { useId } from "react";
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";

/**
 * Willo PRO's crown, in the Willo green, set before the word PRO. `muted` is the plan
 * not taken yet: the crown is grey.
 */
export default function ProCrown({ size = 16, muted = false }: { size?: number; muted?: boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const fill = `pc-${id}`;
  return (
    <Svg width={size} height={size} viewBox="9 11 30 28">
      <Defs>
        <LinearGradient id={fill} x1="0.2" y1="0" x2="0.8" y2="1">
          <Stop offset="0" stopColor={muted ? "#C4C6CC" : "#9BE39B"} />
          <Stop offset="0.5" stopColor={muted ? "#9A9DA4" : "#67CD67"} />
          <Stop offset="1" stopColor={muted ? "#6E7178" : "#3B9442"} />
        </LinearGradient>
      </Defs>
      {/* Three points, a band below. */}
      <Path d="M13 31.5 L11 18.5 L18.6 24.2 L24 14.5 L29.4 24.2 L37 18.5 L35 31.5 Z" fill={`url(#${fill})`} strokeLinejoin="round" stroke={`url(#${fill})`} strokeWidth="1.6" />
      <Rect x="13" y="33.5" width="22" height="3.4" rx="1.7" fill={`url(#${fill})`} />
      <Circle cx="11" cy="17.6" r="2.1" fill={`url(#${fill})`} />
      <Circle cx="24" cy="13.2" r="2.3" fill={`url(#${fill})`} />
      <Circle cx="37" cy="17.6" r="2.1" fill={`url(#${fill})`} />
      <Circle cx="24" cy="26" r="1.6" fill="#FFFFFF" opacity={muted ? 0.45 : 0.85} />
    </Svg>
  );
}
