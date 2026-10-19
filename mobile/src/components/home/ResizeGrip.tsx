import { View } from "react-native";
import Svg, { Path } from "react-native-svg";

/**
 * The handle in the corner a card is resized from.
 *
 * It is the card's own corner, drawn again thicker and just outside it: the same
 * centre, the same direction of turn, one radius further out. Anything else reads as
 * a shape that happens to be near the corner rather than as the corner itself being
 * something you can take hold of — which is the whole idea.
 *
 * So the geometry is tied to the card's radius rather than chosen: the arc runs from
 * due east to due south about the point the corner curves around, and its inner edge
 * lands exactly on the card's edge.
 */

/** Matches the radius every card on the board is cut with. */
const CARD_RADIUS = 22;
const BAND = 12;

export default function ResizeGrip({ radius = CARD_RADIUS }: { radius?: number }) {
  /* The arc's own radius, measured to the middle of the band, so its inside edge
     sits on the card's edge. */
  const r = radius + BAND / 2;
  const box = r + BAND / 2 + 1;

  return (
    <View style={{ width: box, height: box }}>
      <Svg width={box} height={box} viewBox={`0 0 ${box} ${box}`}>
        {/* From east to south, turning the way the corner turns. */}
        <Path
          d={`M ${r} 0 A ${r} ${r} 0 0 1 0 ${r}`}
          stroke="#D4D4D4"
          strokeWidth={BAND}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}

/** How far the grip's box is pushed past the card, so its centre lands on the
    corner's centre. */
export const GRIP_OFFSET = CARD_RADIUS;
