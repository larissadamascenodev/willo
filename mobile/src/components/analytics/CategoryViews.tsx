import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import type { GroupedCategories } from "@/lib/categoryGroups";
import Surface, { Hairline } from "~/components/Surface";
import { groupIcon } from "~/lib/groupIcon";
import { chipFill, chipInk } from "~/lib/chip";
import { ChevronDown, ChevronRight } from "~/components/icons";
import { money } from "~/lib/money";
import { INK } from "~/theme/tokens";
import type { IconCmp } from "~/lib/categoryIconSlugs";
import { EXPAND } from "~/lib/expand";

/**
 * The two ways to read a month: by category, or by the handful of things those
 * categories are really about.
 *
 * Groups expand where they are instead of opening a screen, because the question a
 * group raises — which of these made it that big — is answered by three rows, and
 * three rows do not deserve a page.
 */

export interface OverviewCategory {
  name: string;
  amount: number;
  percentage: number;
  hex: string;
  icon: IconCmp;
}

/** The month's biggest, called out above the list. */
export function TopSpendRow({
  category,
  monthLabel,
  onOpen,
}: {
  category: OverviewCategory;
  monthLabel: string;
  onOpen: (name: string) => void;
}) {
  const Icon = category.icon;
  return (
    <Surface radius={22} onPress={() => onOpen(category.name)} style={{ padding: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: `${category.hex}26`,
          }}
        >
          <Icon size={20} color={category.hex} strokeWidth={2} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 12, color: INK.soft }}>Maior gasto em {monthLabel}</Text>
          <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 16, fontWeight: "600", color: "#fff" }}>
            {category.name}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontSize: 16, fontWeight: "600", color: "#fff" }}>{money(category.amount)}</Text>
          <Text style={{ marginTop: 1, fontSize: 12, color: INK.soft }}>{category.percentage}% do total</Text>
        </View>
      </View>
    </Surface>
  );
}

export function CategoryRows({
  categories,
  onOpen,
}: {
  categories: OverviewCategory[];
  onOpen: (name: string) => void;
}) {
  return (
    <View style={{ gap: 2 }}>
      {categories.map((cat, i) => {
        const Icon = cat.icon;
        return (
          <Animated.View key={cat.name} entering={FadeInDown.delay(i * 30).duration(320)}>
            <Pressable
              onPress={() => onOpen(cat.name)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
                borderRadius: 16,
                paddingHorizontal: 4,
                paddingVertical: 10,
                backgroundColor: pressed ? "rgba(255,255,255,0.04)" : "transparent",
              })}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: chipFill(cat.hex),
                }}
              >
                <Icon size={20} color={chipInk(cat.hex)} strokeWidth={2} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: "500", color: "#fff" }}>
                  {cat.name}
                </Text>
                <Text style={{ marginTop: 1, fontSize: 15, color: INK.soft }}>{cat.percentage}%</Text>
              </View>
              <Text style={{ fontSize: 16, fontWeight: "500", color: "#fff" }}>{money(cat.amount)}</Text>
              <ChevronRight size={16} color={INK.faint} />
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}

export function GroupCards({ groups }: { groups: GroupedCategories<OverviewCategory>[] }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <View style={{ gap: 10 }}>
      {groups.map((g, i) => {
        const Icon = groupIcon(g.def.icon);
        const isOpen = open === g.def.name;
        return (
          <Animated.View
            key={g.def.name}
            entering={FadeInDown.delay(i * 30).duration(320)}
            layout={EXPAND}
            style={{
              overflow: "hidden",
              borderRadius: 22,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.08)",
              backgroundColor: "rgba(255,255,255,0.046)",
            }}
          >
            <Pressable
              onPress={() => setOpen(isOpen ? null : g.def.name)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
                paddingHorizontal: 16,
                paddingVertical: 14,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: g.def.hex,
                }}
              >
                <Icon size={20} color="#fff" strokeWidth={2} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: "500", color: "#fff" }}>
                  {g.def.name}
                </Text>
                <Text style={{ marginTop: 1, fontSize: 15, color: INK.soft }}>{g.percentage}%</Text>
              </View>
              <Text style={{ fontSize: 16, fontWeight: "500", color: "#fff" }}>{money(g.amount)}</Text>
              <ChevronDown
                size={16}
                color="rgba(255,255,255,0.74)"
                style={{ transform: [{ rotate: isOpen ? "180deg" : "0deg" }] }}
              />
            </Pressable>

            {isOpen && (
              <Animated.View entering={FadeIn.duration(200)}>
                <Hairline style={{ marginHorizontal: 16 }} />
                <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12 }}>
                  {g.categories.map((cat) => {
                    const CatIcon = cat.icon;
                    const share = g.amount > 0 ? Math.round((cat.amount / g.amount) * 100) : 0;
                    return (
                      <View
                        key={cat.name}
                        style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 10 }}
                      >
                        <View
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 22,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: "rgba(255,255,255,0.06)",
                          }}
                        >
                          <CatIcon size={20} color={cat.hex} strokeWidth={2} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text numberOfLines={1} style={{ fontSize: 15, color: "#fff" }}>
                            {cat.name}
                          </Text>
                          {g.categories.length > 1 && (
                            <Text style={{ marginTop: 1, fontSize: 13, color: INK.soft }}>
                              {share}% do grupo
                            </Text>
                          )}
                        </View>
                        <Text style={{ fontSize: 15, color: "#fff" }}>{money(cat.amount)}</Text>
                      </View>
                    );
                  })}
                </View>
              </Animated.View>
            )}
          </Animated.View>
        );
      })}
    </View>
  );
}
