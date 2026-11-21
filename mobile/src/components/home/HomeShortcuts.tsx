import type { ComponentType } from "react";
import { Platform, Pressable, ScrollView, Text, View, type TextStyle } from "react-native";
import GlassShape from "~/components/GlassShape";
import { useGroundTh } from "~/theme/groundInk";
import { GREEN } from "~/theme/tokens";

/**
 * The shortcuts at the top of the home: pills of glass in one row that slides sideways.
 *
 * What used to take a card of its own on the home and is better a touch away — the bills to
 * pay, today's plan, the balance, the caixinhas, the journey — so the home keeps only what is
 * read every day. They scroll with the page.
 */

const nums: TextStyle = Platform.select({ ios: { fontVariant: ["tabular-nums"] }, default: {} }) as TextStyle;

export interface Shortcut {
  key: string;
  label: string;
  Icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  /** The icon's colour. */
  tone: string;
  /** A count beside the word, on a dot of the icon's colour. */
  badge?: number;
  onPress: () => void;
}

export default function HomeShortcuts({ items }: { items: Shortcut[] }) {
  const th = useGroundTh();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -16, flexGrow: 0 }}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 4 }}
    >
      {items.map((s) => (
        <Pressable
          key={s.key}
          onPress={s.onPress}
          accessibilityRole="button"
          accessibilityLabel={s.badge ? `${s.label}, ${s.badge}` : s.label}
          style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.95 : 1 }] })}
        >
          <GlassShape radius={19} style={{ height: 38 }}>
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 7, paddingLeft: 12, paddingRight: 14 }}>
              <s.Icon size={15} color={th(s.tone)} strokeWidth={2.3} />
              <Text numberOfLines={1} style={{ fontSize: 13.5, fontWeight: "600", color: th("#fff") }}>
                {s.label}
              </Text>
              {s.badge ? (
                <View style={{ minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: th(s.tone ?? GREEN, "bg") }}>
                  <Text style={[nums, { fontSize: 11.5, fontWeight: "800", color: "#111" }]}>{s.badge > 99 ? "99+" : s.badge}</Text>
                </View>
              ) : null}
            </View>
          </GlassShape>
        </Pressable>
      ))}
    </ScrollView>
  );
}
