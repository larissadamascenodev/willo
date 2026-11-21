import { useRef } from "react";
import { Platform, Text, View, type LayoutRectangle, type TextStyle } from "react-native";
import GlassShape from "~/components/GlassShape";
import type { HomeLine } from "~/lib/homeLine";
import { useGroundTh } from "~/theme/groundInk";
import { GREEN, INK } from "~/theme/tokens";

/**
 * The top of the home, under the row with the photo and the bell: a few shortcuts as pills of
 * glass, then Willo's line — who is speaking, the words that matter lit in the brand's
 * colour, and one sentence under it.
 *
 * It sits fixed behind the page, on the background, and the cards scroll up over it. The
 * pills are touched through the page above them (see the home), so this only draws them and
 * says where each one is.
 */

const nums: TextStyle = Platform.select({ ios: { fontVariant: ["tabular-nums"] }, default: {} }) as TextStyle;

export interface HeroChip {
  key: string;
  label: string;
  /** A count beside the word, on a coloured dot. */
  badge?: number;
  badgeColor?: string;
  onPress: () => void;
}

export default function HomeHero({
  chips,
  pressed,
  line,
  onChipRects,
}: {
  chips: HeroChip[];
  /** The pill under a finger right now. */
  pressed: string | null;
  line: HomeLine;
  /** Where each pill sits, from the top left of this block. */
  onChipRects: (rects: Record<string, LayoutRectangle>) => void;
}) {
  const th = useGroundTh();
  const row = useRef<LayoutRectangle | null>(null);
  const own = useRef<Record<string, LayoutRectangle>>({});
  const report = () => {
    if (!row.current) return;
    const out: Record<string, LayoutRectangle> = {};
    for (const c of chips) {
      const r = own.current[c.key];
      if (r) out[c.key] = { x: row.current.x + r.x, y: row.current.y + r.y, width: r.width, height: r.height };
    }
    onChipRects(out);
  };

  return (
    <View style={{ paddingTop: 6, paddingBottom: 30 }}>
      <View
        onLayout={(e) => {
          row.current = e.nativeEvent.layout;
          report();
        }}
        style={{ flexDirection: "row", gap: 8 }}
      >
        {chips.map((c) => (
          <View
            key={c.key}
            onLayout={(e) => {
              own.current[c.key] = e.nativeEvent.layout;
              report();
            }}
            style={{ transform: [{ scale: pressed === c.key ? 0.94 : 1 }] }}
          >
            <GlassShape radius={18} style={{ height: 36 }}>
              <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 14 }}>
                <Text numberOfLines={1} style={{ fontSize: 13.5, fontWeight: "600", color: th("#fff") }}>
                  {c.label}
                </Text>
                {c.badge ? (
                  <View style={{ minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: th(c.badgeColor ?? GREEN, "bg") }}>
                    <Text style={[nums, { fontSize: 11.5, fontWeight: "800", color: "#111" }]}>{c.badge > 99 ? "99+" : c.badge}</Text>
                  </View>
                ) : null}
              </View>
            </GlassShape>
          </View>
        ))}
      </View>

      {/* Willo, speaking. */}
      <View style={{ marginTop: 34, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: th(GREEN, "bg"), shadowColor: GREEN, shadowOpacity: 0.9, shadowRadius: 5, shadowOffset: { width: 0, height: 0 } }} />
        <Text style={{ fontSize: 11.5, fontWeight: "700", letterSpacing: 1.6, color: th("rgba(255,255,255,0.72)") }}>WILLO · PARA VOCÊ, AGORA</Text>
      </View>
      <Text numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.75} style={[nums, { marginTop: 10, maxWidth: 330, fontSize: 31, lineHeight: 35, fontWeight: "800", letterSpacing: -0.9, color: th("#fff") }]}>
        {line.lead}
        <Text style={{ color: th("#C4B5FD") }}>{line.accent}</Text>
      </Text>
      <Text numberOfLines={2} style={[nums, { marginTop: 10, maxWidth: 320, fontSize: 14.5, lineHeight: 20, color: th(INK.soft) }]}>
        {line.say}
      </Text>
    </View>
  );
}
