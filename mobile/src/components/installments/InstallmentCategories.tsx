import { useMemo, useState } from "react";
import { Platform, Pressable, Text, View, type TextStyle } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { categoryHex } from "@/lib/categoryData";
import type { ActiveInstallmentItem } from "@/lib/installmentProgress";
import type { CardBadge, ProjectionPart } from "@/services/activeInstallments";
import type { CustomCategory } from "@/services/categoryService";
import { cardHex } from "@/hooks/useCardsOverview";
import Surface from "~/components/Surface";
import CenterModal from "~/components/CenterModal";
import { FlexBar } from "~/components/Bar";
import { ChevronDown, ChevronRight } from "~/components/icons";
import { categoryIcon } from "~/lib/categoryIcon";
import { money } from "~/lib/money";
import { GREEN, INK } from "~/theme/tokens";
import { EXPAND } from "~/lib/expand";

/**
 * What the chosen month's instalments are made of.
 *
 * Drawn as the dashboard draws the month's spending: the total, one bar in the
 * categories' own colours, and the three biggest named under it, each with its
 * glyph in its colour, its figure and its share. Tapping one — or "Ver todas" —
 * lifts the whole list into the middle of the screen, where every category opens
 * to the purchases inside it: which of them, which instalment, on which card.
 */

const SHOWN = 3;
const RULE = "rgba(255,255,255,0.06)";

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
  /** "este mês", "novembro". */
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

  if (categories.length === 0 || total <= 0) return null;

  const show = (category: string | null) => {
    setExpanded(category);
    setOpen(true);
  };

  return (
    <>
      <Surface>
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, padding: 14 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 12, color: INK.soft }}>Por categoria · {monthLabel}</Text>
            <Text numberOfLines={1} style={[nums, { marginTop: 6, fontSize: 26, fontWeight: "800", letterSpacing: -0.9, color: "#fff" }]}>
              {money(total)}
            </Text>
          </View>
          <Pressable
            onPress={() => show(null)}
            hitSlop={8}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 2, marginTop: 2, opacity: pressed ? 0.6 : 1 })}
          >
            <Text style={{ fontSize: 12, fontWeight: "600", color: INK.soft }}>
              {categories.length > SHOWN ? `Ver todas (${categories.length})` : "Detalhes"}
            </Text>
            <ChevronRight size={14} color={INK.soft} />
          </Pressable>
        </View>

        <Split categories={categories} total={total} customCats={customCats} />

        <View style={{ marginTop: 14, paddingHorizontal: 14, paddingBottom: 6 }}>
          {categories.slice(0, SHOWN).map((c, i) => (
            <Animated.View key={c.category} entering={FadeIn.delay(i * 30).duration(240)}>
              <CategoryRow share={c} total={total} customCats={customCats} first={i === 0} onPress={() => show(c.category)} />
            </Animated.View>
          ))}
        </View>
      </Surface>

      <CenterModal
        open={open}
        onClose={() => setOpen(false)}
        title="Por categoria"
        subtitle={`${monthLabel[0].toUpperCase()}${monthLabel.slice(1)} · ${money(total)} em ${categories.length} ${categories.length === 1 ? "categoria" : "categorias"}`}
      >
        <View style={{ marginHorizontal: -14 }}>
          <Split categories={categories} total={total} customCats={customCats} />
        </View>
        <View style={{ marginTop: 10 }}>
          {categories.map((c, i) => {
            const isOpen = expanded === c.category;
            return (
              <Animated.View
                key={c.category}
                layout={EXPAND}
                style={{ borderTopWidth: i > 0 ? 1 : 0, borderTopColor: RULE }}
              >
                <CategoryRow
                  share={c}
                  total={total}
                  customCats={customCats}
                  first
                  withCount
                  open={isOpen}
                  onPress={() => setExpanded(isOpen ? null : c.category)}
                />
                {isOpen && (
                  <Animated.View
                    entering={FadeIn.delay(80).duration(360)}
                    style={{
                      marginBottom: 12,
                      paddingHorizontal: 12,
                      paddingVertical: 4,
                      borderRadius: 16,
                      borderCurve: "continuous",
                      backgroundColor: "rgba(255,255,255,0.04)",
                    }}
                  >
                    {c.parts.map((p, j) => {
                      const item = byId.get(p.id);
                      const card = item?.credit_card_id ? cardsById[item.credit_card_id] : undefined;
                      const isCard = item?.payment_method === "cartao";
                      const where = isCard ? (card?.name ?? "Cartão") : "Conta";
                      const last = p.number === p.total;
                      return (
                        <View
                          key={p.id}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 10,
                            paddingVertical: 10,
                            borderTopWidth: j > 0 ? 1 : 0,
                            borderTopColor: "rgba(255,255,255,0.05)",
                          }}
                        >
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "600", color: "#fff" }}>
                              {p.name}
                            </Text>
                            <View style={{ marginTop: 2, flexDirection: "row", alignItems: "center", gap: 6 }}>
                              <View
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: 3,
                                  backgroundColor: last ? GREEN : isCard ? cardHex(card?.color ?? null) : "rgba(255,255,255,0.35)",
                                }}
                              />
                              <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: INK.softer }}>
                                Parcela {p.number} de {p.total} · {where}
                              </Text>
                            </View>
                          </View>
                          <Text style={[nums, { fontSize: 13.5, fontWeight: "600", color: "#fff" }]}>{money(p.amount)}</Text>
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

/** The stacked bar, in the categories' own colours. */
function Split({ categories, total, customCats }: { categories: CategoryShare[]; total: number; customCats: CustomCategory[] }) {
  return (
    <View style={{ paddingHorizontal: 14, flexDirection: "row", height: 8, gap: 3 }}>
      {categories.map((c, i) => (
        <FlexBar key={c.category} share={c.amount / total} color={categoryHex(c.category, customCats)} delay={0.1 + i * 0.04} minWidth={6} />
      ))}
    </View>
  );
}

/** A category as the dashboard writes it: glyph in its colour, name, figure and share. */
function CategoryRow({
  share: c,
  total,
  customCats,
  first,
  withCount = false,
  open,
  onPress,
}: {
  share: CategoryShare;
  total: number;
  customCats: CustomCategory[];
  first: boolean;
  withCount?: boolean;
  /** In the full list: whether it is opened. Left out, the row leads to the full list. */
  open?: boolean;
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
      accessibilityState={open === undefined ? undefined : { expanded: open }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 10,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: RULE,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View style={{ width: 22, alignItems: "center" }}>
        <Icon size={17} color={hex} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: 13.5, fontWeight: "600", color: "#fff" }}>
          {c.category}
        </Text>
        {withCount && (
          <Text style={{ marginTop: 1, fontSize: 11.5, color: INK.softer }}>
            {count} {count === 1 ? "parcela" : "parcelas"}
          </Text>
        )}
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={[nums, { fontSize: 13.5, fontWeight: "700", color: "#fff" }]}>{money(c.amount)}</Text>
        <Text style={[nums, { fontSize: 10.5, color: INK.softer }]}>{pct}%</Text>
      </View>
      {open !== undefined && (
        <ChevronDown size={15} color={INK.softer} style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }} />
      )}
    </Pressable>
  );
}
