import { View } from "react-native";
import Svg, { Defs, Mask, Rect, Text as SvgText } from "react-native-svg";

/**
 * Willo, drawn rather than photographed.
 *
 * The same mark the web draws, for the same reason: rendered artwork carries its own
 * near-black ground with the glow baked in, so it always arrives with a plate around
 * its head. Drawn as a line he has no ground at all and whatever is behind simply
 * shows through, which is what lets him sit in a piece of glass.
 *
 * The dollar in the right eye is knocked out rather than painted over, so it reads as
 * a cut in the eye the way it does in the artwork.
 */
export default function BotMark({ size = 34 }: { size?: number }) {
  const glyph = size * 0.66;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.18)",
        backgroundColor: "rgba(255,255,255,0.15)",
      }}
    >
      <Svg width={glyph} height={glyph} viewBox="0 0 32 32" fill="none">
        <Defs>
          {/* The dollar is a hole in the eye, not a mark on top of it. */}
          <Mask id="willo-eye">
            <Rect x="17.6" y="12.1" width="4.3" height="7.6" rx="2.15" fill="#fff" />
            <SvgText
              x="19.75"
              y="18.5"
              textAnchor="middle"
              fontSize="7"
              fontWeight="800"
              fill="#000"
            >
              $
            </SvgText>
          </Mask>
        </Defs>

        {/* The head, and nothing else: a rounded square with two eyes. */}
        <Rect x="3.4" y="6.6" width="25.2" height="19.2" rx="8.4" stroke="#fff" strokeWidth="2" />
        <Rect x="10.1" y="12.1" width="4.3" height="7.6" rx="2.15" fill="#fff" />
        <Rect
          x="17.6"
          y="12.1"
          width="4.3"
          height="7.6"
          rx="2.15"
          fill="#fff"
          mask="url(#willo-eye)"
        />
      </Svg>
    </View>
  );
}
