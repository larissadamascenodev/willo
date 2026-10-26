import { useMemo, useState } from "react";
import { Platform, Pressable, Text, View, type TextStyle } from "react-native";
import { categoryHex } from "@/lib/categoryData";
import type { ActiveInstallmentItem } from "@/lib/installmentProgress";
import type { CustomCategory } from "@/services/categoryService";
import Surface from "~/components/Surface";
import CenterModal from "~/components/CenterModal";
import { FlexBar } from "~/components/Bar";
import { ChevronRight } from "~/components/icons";
import { chipFill, chipInk } from "~/lib/chip";
import { categoryIcon } from "~/lib/categoryIcon";
import { money } from "~/lib/money";
import { INK } from "~/theme/tokens";

/**
 * What the monthly figure is made of.
 *
 * The page shows the three heaviest — usually most of it — and the bar above them
 * still carries every category, so nothing is hidden from the shape of it. The full
 * list opens in the middle of the screen when the card is tapped, so a person with
 * twelve categories does not get a page twelve rows longer.
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
  count: number;
}

export default function InstallmentCategories({
  items,
  customCats,
}: {
  items: ActiveInstallmentItem[];
  customCats: CustomCategory[];
}) {
  const [open, setOpen] = useState(false);

  const categories = useMemo(() => {
    const by = new Map<string, CategoryShare>();
    items.forEach((i) => {
      const c = by.get(i.category) ?? { category: i.category, amount: 0, count: 0 };
      c.amount += i.amount;
      c.count += 1;
      by.set(i.category, c);
    });
    return [...by.values()].sort((a, b) => b.amount - a.amount);
  }, [items]);
  const total = categories.reduce((s, c) => s + c.amount, 0);
  const more = categories.length > SHOWN;

  if (categories.length < 2 || total <= 0) return null;

  return (
    <>
      <Surface onPress={more ? () => setOpen(true) : undefined}>
        <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: "600", letterSpacing: -0.2, color: "#fff" }}>Por categoria</Text>
            <Text style={{ fontSize: 12.5, color: INK.softer }}>
              {categories.length} {categories.length === 1 ? "categoria" : "categorias"}
            </Text>
          </View>

          <Split categories={categories} total={total} customCats={customCats} />

          <View style={{ marginTop: 6 }}>
            {categories.slice(0, SHOWN).map((c, i) => (
              <CategoryRow key={c.category} share={c} total={total} customCats={customCats} first={i === 0} />
            ))}
          </View>
        </View>

        {more ? (
          <View
            style={{
              marginTop: 2,
              marginHorizontal: 16,
              paddingVertical: 12,
              borderTopWidth: 1,
              borderTopColor: RULE,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text style={{ fontSize: 13, color: INK.soft }}>
              Mais {categories.length - SHOWN} {categories.length - SHOWN === 1 ? "categoria" : "categorias"} ·{" "}
              {money(categories.slice(SHOWN).reduce((s, c) => s + c.amount, 0))}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
              <Text style={{ fontSize: 13, fontWeight: "500", color: "rgba(255,255,255,0.82)" }}>Ver todas</Text>
              <ChevronRight size={15} color="rgba(255,255,255,0.82)" />
            </View>
          </View>
        ) : (
          <View style={{ height: 6 }} />
        )}
      </Surface>

      <CenterModal
        open={open}
        onClose={() => setOpen(false)}
        title="Por categoria"
        subtitle={`${money(total)} por mês em ${categories.length} categorias`}
      >
        <Split categories={categories} total={total} customCats={customCats} />
        <View style={{ marginTop: 6 }}>
          {categories.map((c, i) => (
            <CategoryRow key={c.category} share={c} total={total} customCats={customCats} first={i === 0} withCount />
          ))}
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

function CategoryRow({
  share: c,
  total,
  customCats,
  first,
  withCount = false,
}: {
  share: CategoryShare;
  total: number;
  customCats: CustomCategory[];
  first: boolean;
  withCount?: boolean;
}) {
  const Icon = categoryIcon(c.category, customCats);
  const hex = categoryHex(c.category, customCats);
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 10,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: RULE,
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: chipFill(hex),
        }}
      >
        <Icon size={16} color={chipInk(hex)} strokeWidth={2} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: 14.5, color: "#fff" }}>
          {c.category}
        </Text>
        {withCount && (
          <Text style={{ marginTop: 1, fontSize: 12, color: INK.softer }}>
            {c.count} {c.count === 1 ? "compra" : "compras"}
          </Text>
        )}
      </View>
      <Text style={[nums, { fontSize: 12.5, color: INK.softer }]}>{Math.round((c.amount / total) * 100)}%</Text>
      <Text style={[nums, { minWidth: 88, textAlign: "right", fontSize: 14.5, fontWeight: "600", color: "#fff" }]}>
        {money(c.amount)}
      </Text>
    </View>
  );
}
