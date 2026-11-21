import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, Text, View, type TextStyle } from "react-native";
import { useRouter } from "expo-router";
import Svg, { Circle } from "react-native-svg";
import { getCustomCategories, type CustomCategory } from "@/services/categoryService";
import type { CategoryExpense } from "@/types/finance";
import Surface from "~/components/Surface";
import { ChevronRight } from "~/components/icons";
import { catColor } from "~/components/home/GastosPorCategoria";
import { categoryIcon } from "~/lib/categoryIcon";
import { money } from "~/lib/money";
import { useGroundTh } from "~/theme/groundInk";
import { INK } from "~/theme/tokens";
import { th } from "~/theme/theme";

/**
 * The month by category, as the home now shows it.
 *
 * Not one card holding a list: a heading on the page — the month, its total and the line in
 * the categories' colours — and under it a row of cards, one per category, that the thumb
 * slides through. Each says its name, what it took and its share of the month, the share
 * drawn as a ring round its colour.
 */

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const nums: TextStyle = Platform.select({ ios: { fontVariant: ["tabular-nums"] }, default: {} }) as TextStyle;
const CARD_W = 142;
const ICON = 42;

export default function CategoryStrip({
  categories,
  counts,
  month,
  hidden,
}: {
  categories: CategoryExpense[];
  /** How many charges each category had, when known. */
  counts?: Record<string, number>;
  month: number;
  hidden?: boolean;
}) {
  const router = useRouter();
  const gth = useGroundTh();
  const [customCats, setCustomCats] = useState<CustomCategory[]>([]);
  useEffect(() => {
    let alive = true;
    getCustomCategories()
      .then((c) => alive && setCustomCats(c))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const sorted = useMemo(() => [...categories].filter((c) => c.amount > 0).sort((a, b) => b.amount - a.amount), [categories]);
  const total = sorted.reduce((s, c) => s + c.amount, 0);
  const open = () => router.push("/analytics/categorias" as never);

  return (
    <View>
      {/* The heading lives on the page, not in a card. */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4 }}>
        <Text style={{ fontSize: 20, fontWeight: "700", letterSpacing: -0.4, color: gth("#fff") }}>
          Gastos <Text style={{ color: gth(INK.faint) }}>·</Text> {MONTHS[month][0].toUpperCase() + MONTHS[month].slice(1)}
        </Text>
        <Pressable onPress={open} hitSlop={8} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 2, opacity: pressed ? 0.6 : 1 })}>
          <Text style={{ fontSize: 16, fontWeight: "600", color: gth("#fff") }}>Todas</Text>
          <ChevronRight size={18} color={gth("#fff")} strokeWidth={2.2} />
        </Pressable>
      </View>
      <View style={{ marginTop: 4, paddingHorizontal: 4, flexDirection: "row", alignItems: "baseline", gap: 8 }}>
        <Text style={[nums, { fontSize: 15, color: gth(INK.soft) }]}>
          {hidden ? "R$ •••" : money(total)} no mês
        </Text>
      </View>

      {/* The month's line, in the categories' colours. */}
      <View style={{ marginTop: 12, marginHorizontal: 4, flexDirection: "row", height: 8, gap: 3 }}>
        {sorted.length === 0 ? (
          <View style={{ flex: 1, borderRadius: 999, backgroundColor: gth("rgba(255,255,255,0.10)", "bg") }} />
        ) : (
          sorted.slice(0, 8).map((cat, i) => {
            const pct = total > 0 ? (cat.amount / total) * 100 : 0;
            if (pct < 0.5) return null;
            return <View key={cat.name} style={{ flexGrow: pct, flexBasis: 0, minWidth: 6, borderRadius: 999, backgroundColor: th(catColor(cat.name, i, customCats), "bg") }} />;
          })
        )}
      </View>

      {sorted.length === 0 ? (
        <Text style={{ marginTop: 14, paddingHorizontal: 4, fontSize: 14, color: gth(INK.soft) }}>Nenhum gasto registrado em {MONTHS[month]}.</Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={CARD_W + 12}
          style={{ marginTop: 16, marginHorizontal: -16 }}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
        >
          {sorted.map((cat, i) => {
            const color = catColor(cat.name, i, customCats);
            const Icon = categoryIcon(cat.name, customCats);
            const share = total > 0 ? cat.amount / total : 0;
            const n = counts?.[cat.name];
            const r = (ICON + 8) / 2 - 2;
            const c = 2 * Math.PI * r;
            return (
              <Surface key={cat.name} onPress={() => router.push(`/analytics/categoria/${encodeURIComponent(cat.name)}` as never)} radius={22} style={{ width: CARD_W, paddingHorizontal: 13, paddingTop: 13, paddingBottom: 13 }}>
                <View style={{ width: ICON + 8, height: ICON + 8, alignItems: "center", justifyContent: "center" }}>
                  <Svg width={ICON + 8} height={ICON + 8} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
                    <Circle cx={(ICON + 8) / 2} cy={(ICON + 8) / 2} r={r} stroke={th(color, "line")} strokeOpacity={0.22} strokeWidth={3} fill="none" />
                    <Circle
                      cx={(ICON + 8) / 2}
                      cy={(ICON + 8) / 2}
                      r={r}
                      stroke={th(color, "line")}
                      strokeWidth={3}
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={`${c} ${c}`}
                      strokeDashoffset={c * (1 - Math.max(share, 0.03))}
                    />
                  </Svg>
                  <View style={{ width: ICON - 4, height: ICON - 4, borderRadius: (ICON - 4) / 2, alignItems: "center", justifyContent: "center", backgroundColor: th(color, "bg") }}>
                    <Icon size={18} color="#FFFFFF" strokeWidth={2.2} />
                  </View>
                </View>
                <Text numberOfLines={1} style={{ marginTop: 10, fontSize: 14.5, fontWeight: "600", color: th("#fff") }}>
                  {cat.name}
                </Text>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[nums, { marginTop: 10, fontSize: 17, fontWeight: "700", letterSpacing: -0.4, color: th("#fff") }]}>
                  {hidden ? "R$ •••" : money(cat.amount)}
                </Text>
                <Text numberOfLines={1} style={[nums, { marginTop: 2, fontSize: 12.5, color: th(INK.soft) }]}>
                  {`${Math.round(share * 100)}%${n ? ` · ${n} ${n === 1 ? "gasto" : "gastos"}` : " do mês"}`}
                </Text>
              </Surface>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
