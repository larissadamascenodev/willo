import { Pressable, Text, View } from "react-native";
import { chipInk } from "@/lib/chipColor";
import { ChevronRight } from "~/components/icons";
import { INK } from "~/theme/tokens";

/**
 * The summary tile.
 *
 * A dashboard of nothing but full-width cards reads as one long column with no shape
 * to it, so the summaries that are really a figure and a word sit two to a row and
 * let the cards that need the width keep it.
 *
 * It leads with its name, the way the balance card does. A large glyph in the corner
 * was decoration standing where the subject should be: you cannot read a disc, and
 * on a tile half a screen wide it took the room the caption needed. The colour
 * survives as the rule along the bottom edge, which is enough to tell four apart.
 */
export default function StatTile({
  label,
  value,
  caption,
  accent,
  progress,
  empty = false,
  onPress,
}: {
  label: string;
  value: string;
  caption?: string;
  /** Hex. Draws the rule along the bottom; the figure stays white. */
  accent: string;
  /** 0–1. Drawn full-bleed along the bottom edge when the tile tracks something. */
  progress?: number;
  /** Nothing to report yet. The tile stays, quieter: a hole in the row is worse
      than a tile saying there is nothing, and the row has to stay a row. */
  empty?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 150,
        justifyContent: "space-between",
        overflow: "hidden",
        borderRadius: 22,
        borderWidth: 1,
        borderColor: INK.edge,
        backgroundColor: "rgba(255,255,255,0.046)",
        padding: 16,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, fontWeight: "500", color: INK.soft }}>
          {label}
        </Text>
        <ChevronRight size={16} color="rgba(255,255,255,0.25)" />
      </View>

      <View style={{ marginTop: 16 }}>
        <Text
          numberOfLines={1}
          style={{
            fontSize: 23,
            fontWeight: "800",
            letterSpacing: -0.8,
            color: empty ? INK.faint : "#fff",
          }}
        >
          {value}
        </Text>
        {/* Two lines, not one truncated: "0 assinaturas ativas · por mês" says
            nothing useful when it is cut after the third word. */}
        {caption ? (
          <Text numberOfLines={2} style={{ marginTop: 4, fontSize: 12, lineHeight: 16, color: INK.softer }}>
            {caption}
          </Text>
        ) : null}
      </View>

      {progress !== undefined && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 3,
            backgroundColor: "rgba(255,255,255,0.06)",
          }}
        >
          <View
            style={{
              height: "100%",
              backgroundColor: chipInk(accent),
              width: `${Math.min(Math.max(progress, 0), 1) * 100}%`,
            }}
          />
        </View>
      )}
    </Pressable>
  );
}
