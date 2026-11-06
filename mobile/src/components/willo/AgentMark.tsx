import { View } from "react-native";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

import { th } from "~/theme/theme";
/**
 * A specialist's mark until the portraits arrive: a small sphere of light in the
 * agent's colour, with a halo — the same language as Willo's own sphere, smaller.
 */
export default function AgentMark({ hex, size = 36, dim = false }: { hex: string; size?: number; dim?: boolean }) {
  const id = `agent-${hex.replace("#", "")}-${size}`;
  return (
    <View style={{ width: size, height: size, opacity: dim ? 0.35 : 1 }}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={`${id}-halo`} cx="50%" cy="50%" r="50%">
            <Stop offset="0.55" stopColor={th(hex, "grad")} stopOpacity={0.35} />
            <Stop offset="1" stopColor={th(hex, "grad")} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={`${id}-core`} cx="38%" cy="34%" r="70%">
            <Stop offset="0" stopColor={th("#FFFFFF", "grad")} stopOpacity={0.95} />
            <Stop offset="0.35" stopColor={th(hex, "grad")} stopOpacity={0.95} />
            <Stop offset="1" stopColor={th("#0B0D12", "grad")} stopOpacity={1} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={th(`url(#${id}-halo)`)} />
        <Circle cx={size / 2} cy={size / 2} r={size * 0.32} fill={th(`url(#${id}-core)`)} />
      </Svg>
    </View>
  );
}
