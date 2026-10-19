import { View } from "react-native";
import Svg, { Path } from "react-native-svg";

/**
 * The handle in the corner a card is resized from.
 *
 * Drawn rather than iconographic: a thick light arc hugging the bottom-right
 * corner, the way a window's resize corner reads. A small dark circle with a glyph
 * in it — which is what was here — says "a button that does something", and what
 * this is, is an edge you pull.
 *
 * It sits half outside the card on purpose, so it reads as attached to the corner
 * rather than printed inside it.
 */
export default function ResizeGrip({ size = 46 }: { size?: number }) {
  /* A quarter ring, thick, with round ends: the corner of the card redrawn as
     something to take hold of. */
  const s = size;
  const r = s * 0.42;
  const w = s * 0.26;

  return (
    <View style={{ width: s, height: s }}>
      <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
        <Path
          d={`M ${s * 0.12} ${s * 0.6}
              A ${r} ${r} 0 0 0 ${s * 0.6} ${s * 0.12}`}
          stroke="#D4D4D4"
          strokeWidth={w}
          strokeLinecap="round"
          fill="none"
          transform={`rotate(180 ${s / 2} ${s / 2})`}
        />
      </Svg>
    </View>
  );
}
