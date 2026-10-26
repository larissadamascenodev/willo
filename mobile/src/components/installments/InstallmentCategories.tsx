import { useMemo, useState } from "react";
import { Platform, Pressable, Text, View, type TextStyle } from "react-native";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";
import { categoryHex } from "@/lib/categoryData";
import type { ActiveInstallmentItem } from "@/lib/installmentProgress";
import type { CardBadge, ProjectionPart } from "@/services/activeInstallments";
import type { CustomCategory } from "@/services/categoryService";
import { cardHex } from "@/hooks/useCardsOverview";
import Surface from "~/components/Surface";
import CenterModal from "~/components/CenterModal";
import Bar, { FlexBar } from "~/components/Bar";
import { ChevronDown, ChevronRight } from "~/components/icons";
import { chipFill, chipInk } from "~/lib/chip";
import { categoryIcon } from "~/lib/categoryIcon";
import { money } from "~/lib/money";
import { GREEN, INK } from "~/theme/tokens";

/**
 * What the chosen month's instalments are made of.
 *
 * The page shows the three heaviest — usually most of it — and the bar above them
 * still carries every category, so nothing is hidden from the shape of it. Tapping
 * a category, or "Ver todas", lifts the whole list into the middle of the screen,
 * where each category opens to the purchases inside it: which of them, which
 * instalment, on which card.
 */

const SHOWN = 3;
const RULE = "rgba(255,255,255,0.07)";

const nums: TextStyle = Platform.select({
  ios: { fontVariant: ["tabular-nums"] },
  default: {},
}) as TextStyle;

interface CategoryShare {
  category: string;
  amount: number;
  parts: ProjectionPart[];
}

export default function InstallmentCategories({
  parts,
  monthLabel,
  byId,
  cardsById,
  customCats,
}: {
  parts: ProjectionPart[];
  /** "Este mês", "Novembro" — for the heading of the full list. */
  monthLabel: string;
  byId: Map<string, ActiveInstallmentItem>;
  cardsById: Record<string, CardBadge>;
  customCats: CustomCategory[];
}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const categories = useMemo(() => {
    const by = new Map<string, CategoryShare>();
    parts.forEach((p) => {
      const c = by.get(p.category) ?? { category: p.category, amount: 0, parts: [] };
      c.amount += p.amount;
      c.parts.push(p);
      by.set(p.category, c);
    });
    return [...by.values()]
      .map((c) => ({ ...c, parts: c.parts.sort((a, b) => b.amount - a.amount) }))
      .sort((a, b) => b.amount - a.amount);
  }, [parts]);
  const total = categories.reduce((s, c) => s + c.amount, 0);
  const rest = categories.slice(SHOWN);

  if (categories.length === 0 || total <= 0) return null;

  const show = (category: string | null) => {
    setExpanded(category);
    setOpen(true);
  };

  return (
    <>
      <Surface>
        <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: "600", letterSpacing: -0.2, color: "#fff" }}>Por categoria</Text>
            <Text style={{ fontSize: 12.5, color: INK.softer }}>
              {categories.length} {categories.length === 1 ? "categoria" : "categorias"}
            </Text>
          </View>

          <Split categories={categories} total={total} customCats={customCats} />

          <View style={{ marginTop: 4 }}>
            {categories.slice(0, SHOWN).map((c, i) => (
              <CategoryRow
                key={c.category}
                share={c}
                total={total}
                customCats={customCats}
                first={i === 0}
                trailing="open"
                onPress={() => show(c.category)}
              />
            ))}
          </View>
        </View>

        {rest.length > 0 ? (
          <Pressable
            onPress={() => show(null)}
            style={({ pressed }) => ({
              marginHorizontal: 16,
              paddingVertical: 12,
              borderTopWidth: 1,
              borderTopColor: RULE,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, fontSize: 13, color: INK.soft }}>
              Mais {rest.length} {rest.length === 1 ? "categoria" : "categorias"} ·{" "}
              {money(rest.reduce((s, c) => s + c.amount, 0))}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
              <Text style={{ fontSize: 13, fontWeight: "500", color: "rgba(255,255,255,0.82)" }}>Ver todas</Text>
              <ChevronRight size={15} color="rgba(255,255,255,0.82)" />
            </View>
          </Pressable>
        ) : (
          <View style={{ height: 6 }} />
        )}
      </Surface>

      <CenterModal
        open={open}
        onClose={() => setOpen(false)}
        title="Por categoria"
        subtitle={`${monthLabel} · ${money(total)} em ${categories.length} ${categories.length === 1 ? "categoria" : "categorias"}`}
      >
        <Split categories={categories} total={total} customCats={customCats} />
        <View style={{ marginTop: 4 }}>
          {categories.map((c, i) => {
            const isOpen = expanded === c.category;
            return (
              <Animated.View
                key={c.category}
                layout={LinearTransition.springify().damping(24).stiffness(220)}
                style={{ borderTopWidth: i > 0 ? 1 : 0, borderTopColor: RULE }}
              >
                <CategoryRow
                  share={c}
                  total={total}
                  customCats={customCats}
                  first
                  trailing={isOpen ? "up" : "down"}
                  onPress={() => setExpanded(isOpen ? null : c.category)}
                />
                {isOpen && (
                  <Animated.View entering={FadeIn.duration(200)} style={{ marginLeft: 48, paddingBottom: 8 }}>
                    {c.parts.map((p, j) => {
                      const item = byId.get(p.id);
                      const card = item?.credit_card_id ? cardsById[item.credit_card_id] : undefined;
                      const where = item?.payment_method === "cartao" ? (card?.name ?? "Cartão") : "Conta";
                      const last = p.number === p.total;
                      return (
                        <View
                          key={p.id}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 10,
                            paddingVertical: 9,
                            borderTopWidth: j > 0 ? 1 : 0,
                            borderTopColor: "rgba(255,255,255,0.05)",
                          }}
                        >
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text numberOfLines={1} style={{ fontSize: 14, color: "#fff" }}>
                              {p.name}
                            </Text>
                            <View style={{ marginTop: 2, flexDirection: "row", alignItems: "center", gap: 6 }}>
                              <View
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: 3,
                                  backgroundColor: last
                                    ? GREEN
                                    : item?.payment_method === "cartao"
                                      ? cardHex(card?.color ?? null)
                                      : "rgba(255,255,255,0.35)",
                                }}
                              />
                              <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, fontSize: 12, color: INK.softer }}>
                                {last ? "Última parcela" : `Parcela ${p.number} de ${p.total}`} · {where}
                              </Text>
                            </View>
                          </View>
                          <Text style={[nums, { fontSize: 14, fontWeight: "600", color: "#fff" }]}>{money(p.amount)}</Text>
                        </View>
                      );
                    })}
                  </Animated.View>
                )}
              </Animated.View>
            );
          })}
        </View>
      </CenterModal>
    </>
  );
}

/** Every category, side by side in one track. */
function Split({ categories, total, customCats }: { categories: CategoryShare[]; total: number; customCats: CustomCategory[] }) {
  return (
    <View style={{ marginTop: 12, flexDirection: "row", height: 6, gap: 3 }}>
      {categories.map((c, i) => (
        <FlexBar key={c.category} share={c.amount / total} color={categoryHex(c.category, customCats)} delay={0.1 + i * 0.04} minWidth={4} />
      ))}
    </View>
  );
}

/** A category: its name and figure, and under them its share as a rule of its own colour. */
function CategoryRow({
  share: c,
  total,
  customCats,
  first,
  trailing,
  onPress,
}: {
  share: CategoryShare;
  total: number;
  customCats: CustomCategory[];
  first: boolean;
  trailing: "open" | "down" | "up";
  onPress: () => void;
}) {
  const Icon = categoryIcon(c.category, customCats);
  const hex = categoryHex(c.category, customCats);
  const pct = Math.round((c.amount / total) * 100);
  const count = c.parts.length;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 11,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: RULE,
        opacity: pressed ? 0.65 : 1,
      })}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: chipFill(hex),
        }}
      >
        <Icon size={16} color={chipInk(hex)} strokeWidth={2} />
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
          <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, fontSize: 14.5, color: "#fff" }}>
            {c.category}
          </Text>
          <Text style={[nums, { fontSize: 14.5, fontWeight: "600", color: "#fff" }]}>{money(c.amount)}</Text>
        </View>
        <View style={{ marginTop: 7, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ flex: 1, height: 4, borderRadius: 999, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.07)" }}>
            <Bar share={c.amount / total} color={hex} delay={0.12} />
          </View>
          <Text style={[nums, { fontSize: 11.5, color: INK.soft }]}>
            {pct}% · {count} {count === 1 ? "parcela" : "parcelas"}
          </Text>
        </View>
      </View>

      {trailing === "open" ? (
        <ChevronRight size={15} color={INK.faint} />
      ) : (
        <ChevronDown size={15} color={INK.softer} style={{ transform: [{ rotate: trailing === "up" ? "180deg" : "0deg" }] }} />
      )}
    </Pressable>
  );
}
