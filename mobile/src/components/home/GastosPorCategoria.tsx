import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { getCustomCategories, type CustomCategory } from "@/services/categoryService";
import { getCategoryColor } from "@/lib/categoryData";
import type { CategoryExpense } from "@/types/finance";
import Surface from "~/components/Surface";
import { ChevronRight } from "~/components/icons";
import { categoryIcon } from "~/lib/categoryIcon";
import { money } from "~/lib/money";
import { INK } from "~/theme/tokens";

/** A summary card: the full list belongs to the categories page. */
const INITIAL_COUNT = 3;

const FALLBACK_COLORS = [
  "330 80% 60%", "250 70% 65%", "35 90% 55%", "200 80% 55%",
  "0 70% 55%", "60 70% 50%", "280 60% 55%", "180 60% 45%", "15 80% 55%",
];

const MONTH_NAMES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** React Native has no hsl() in a colour string, so it is turned into one here. */
function hsl(spec: string): string {
  const [h, s, l] = spec.split(/\s+/);
  const H = Number(h);
  const S = Number(s.replace("%", "")) / 100;
  const L = Number(l.replace("%", "")) / 100;
  const c = (1 - Math.abs(2 * L - 1)) * S;
  const x = c * (1 - Math.abs(((H / 60) % 2) - 1));
  const m = L - c / 2;
  const [r, g, b] =
    H < 60 ? [c, x, 0] : H < 120 ? [x, c, 0] : H < 180 ? [0, c, x]
      : H < 240 ? [0, x, c] : H < 300 ? [x, 0, c] : [c, 0, x];
  const to = (v: number) => Math.round((v + m) * 255);
  return `rgb(${to(r)}, ${to(g)}, ${to(b)})`;
}

const catColor = (name: string, fallbackIdx: number, customCats?: CustomCategory[]) => {
  const c = getCategoryColor(name, customCats);
  return hsl(c !== "220 10% 55%" ? c : FALLBACK_COLORS[fallbackIdx % FALLBACK_COLORS.length]);
};

/**
 * The month repartido by category.
 *
 * One stacked bar answers the shape of it at a glance, and the three biggest are
 * named under it. Tapping one dims the others, so a share can be picked out of the
 * bar without reading a single figure.
 */
export default function GastosPorCategoria({
  categories,
  month,
}: {
  categories: CategoryExpense[];
  month: number;
}) {
  const [customCats, setCustomCats] = useState<CustomCategory[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getCustomCategories()
      .then((c) => alive && setCustomCats(c))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const sorted = useMemo(() => [...categories].sort((a, b) => b.amount - a.amount), [categories]);
  const total = useMemo(() => sorted.reduce((s, c) => s + c.amount, 0), [sorted]);
  const visible = sorted.slice(0, INITIAL_COUNT);
  const visibleTotal = visible.reduce((s, c) => s + c.amount, 0);
  const monthLabel = MONTH_NAMES[month];

  return (
    <Surface>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          paddingHorizontal: 14,
          paddingTop: 14,
          paddingBottom: 14,
        }}
      >
        <View style={{ minWidth: 0, flex: 1 }}>
          <Text style={{ fontSize: 12, color: INK.soft }}>
            Gastos por categoria · {monthLabel}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              marginTop: 6,
              fontSize: 26,
              fontWeight: "800",
              letterSpacing: -0.9,
              color: "#fff",
            }}
          >
            {money(total)}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 2, marginTop: 2 }}>
          <Text style={{ fontSize: 12, fontWeight: "600", color: INK.soft }}>Análise</Text>
          <ChevronRight size={14} color={INK.soft} />
        </View>
      </View>

      {sorted.length === 0 ? (
        <View style={{ paddingHorizontal: 14, paddingBottom: 16 }}>
          <View style={{ height: 10, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.06)" }} />
          <Text style={{ marginTop: 12, fontSize: 13, color: INK.soft }}>
            Nenhum gasto registrado em {monthLabel}.
          </Text>
        </View>
      ) : (
        <>
          {/* The stacked bar, in the categories' own colours. */}
          <View style={{ paddingHorizontal: 14, flexDirection: "row", height: 8, gap: 3 }}>
            {visible.map((cat, i) => {
              const pct = visibleTotal > 0 ? (cat.amount / visibleTotal) * 100 : 0;
              if (pct < 0.5) return null;
              const dimmed = selected !== null && selected !== cat.name;
              return (
                <Pressable
                  key={cat.name}
                  onPress={() => setSelected((p) => (p === cat.name ? null : cat.name))}
                  style={{
                    width: `${pct}%`,
                    minWidth: 6,
                    height: "100%",
                    borderRadius: 999,
                    backgroundColor: catColor(cat.name, sorted.indexOf(cat), customCats),
                    opacity: dimmed ? 0.25 : 1,
                  }}
                />
              );
            })}
          </View>

          <View style={{ marginTop: 14, paddingHorizontal: 14, paddingBottom: 14 }}>
            {visible.map((cat, index) => {
              const pct = total > 0 ? Math.round((cat.amount / total) * 100) : 0;
              const color = catColor(cat.name, sorted.indexOf(cat), customCats);
              const Icon = categoryIcon(cat.name, customCats);
              const dimmed = selected !== null && selected !== cat.name;

              return (
                <Animated.View key={cat.name} entering={FadeIn.delay(index * 30).duration(240)}>
                  <Pressable
                    onPress={() => setSelected((p) => (p === cat.name ? null : cat.name))}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      paddingVertical: 10,
                      borderTopWidth: index > 0 ? 1 : 0,
                      borderTopColor: "rgba(255,255,255,0.06)",
                      opacity: dimmed ? 0.35 : 1,
                    }}
                  >
                    <Icon size={17} color={color} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{ fontSize: 13.5, fontWeight: "600", color: "#fff" }}>
                        {cat.name}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={{ fontSize: 13.5, fontWeight: "700", color: "#fff" }}>
                        {money(cat.amount)}
                      </Text>
                      <Text style={{ fontSize: 10.5, color: INK.softer }}>{pct}%</Text>
                    </View>
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>
        </>
      )}
    </Surface>
  );
}
