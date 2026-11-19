import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { supabase } from "~/supabase/client";
import { useMonth } from "@/contexts/MonthContext";
import { buildCategorySummaries, type CategoryAnalytics } from "@/services/categoryAnalytics";
import { useCategoryAnalytics } from "~/lib/warmStart";
import { groupCategoryAmounts } from "@/lib/categoryGroups";
import { APP_GROUP_DEFS } from "~/lib/taxonomy";
import { MONTH_NAMES } from "@/lib/projectionRows";
import { categoryHex } from "@/lib/categoryData";
import Room from "~/components/Room";
import PageHeader from "~/components/PageHeader";
import Surface from "~/components/Surface";
import Bar from "~/components/Bar";
import BottomSheet from "~/components/BottomSheet";
import SegmentedTabs from "~/components/SegmentedTabs";
import SpendRing from "~/components/analytics/SpendRing";
import { CategoryRows, GroupCards, TopSpendRow, type OverviewCategory } from "~/components/analytics/CategoryViews";
import { categoryIcon } from "~/lib/categoryIcon";
import { groupIcon } from "~/lib/groupIcon";
import SpendModal, { groupOf, type SpendSubject } from "~/components/analytics/SpendModal";
import LimitSheet from "~/components/categorias/LimitSheet";
import { ChartPie, Plus, Trash2, X } from "~/components/icons";
import { money } from "~/lib/money";
import { useAuth } from "~/lib/auth";
import { AMBER, INK, RED } from "~/theme/tokens";
import { type as T } from "~/theme/type";

import { th, useThemeRedraw } from "~/theme/theme";
/**
 * Where the month went.
 *
 * The ring first, because the shape of a month — one big subject or ten small ones
 * — is read before any number is. Then the biggest single category, then the list,
 * which can be read as categories or as the handful of things those categories are
 * really about.
 *
 * Limits sit at the bottom rather than the top: a limit is something you set once
 * and then check, and what you came here for is to look.
 */

interface Limit {
  id: string;
  category: string;
  limit_amount: number;
}

/* No session is an answer, not a slow one — left null the screen sits on a
   skeleton that never resolves. */
const EMPTY: CategoryAnalytics = {
  transactions: [],
  prevTransactions: [],
  historical: {},
  installmentImpacts: {},
  customCats: [],
  userStartDate: null,
};

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function AnalyticsCategorias() {
  /* Drawn again in place when the theme changes. */
  useThemeRedraw();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { selectedMonth, selectedYear } = useMonth();

  /* What the home's card already read, at once; the fresh read replaces it under the eye. */
  const kept = useCategoryAnalytics(user?.id, selectedMonth, selectedYear);
  const data: CategoryAnalytics | null = user ? kept : EMPTY;
  const [limits, setLimits] = useState<Limit[]>([]);
  const [view, setView] = useState<"categorias" | "grupos">("categorias");
  const [sheet, setSheet] = useState<{ open: boolean; category: string | null }>({
    open: false,
    category: null,
  });

  const loadLimits = useCallback(async () => {
    if (!user) return;
    const { data: rows } = await supabase
      .from("category_limits")
      .select("id, category, limit_amount")
      .eq("user_id", user.id);
    setLimits(
      (rows ?? []).map((r: any) => ({
        id: r.id,
        category: r.category,
        limit_amount: Number(r.limit_amount),
      })),
    );
  }, [user]);

  useEffect(() => {
    void loadLimits();
    const onChange = () => void loadLimits();
    window.addEventListener("finance-data-changed", onChange);
    return () => window.removeEventListener("finance-data-changed", onChange);
  }, [loadLimits]);

  const summaries = useMemo(
    () => (data ? buildCategorySummaries(data.transactions) : []),
    [data],
  );

  /* The arithmetic is shared; the colour and the glyph are this app's. */
  const categories = useMemo<OverviewCategory[]>(
    () =>
      summaries.map((c) => ({
        name: c.name,
        amount: c.amount,
        percentage: c.percentage,
        hex: categoryHex(c.name, data?.customCats),
        icon: categoryIcon(c.name, data?.customCats),
      })),
    [summaries, data],
  );

  const groups = useMemo(() => groupCategoryAmounts(categories, APP_GROUP_DEFS), [categories]);
  const total = summaries.reduce((s, c) => s + c.amount, 0);
  const monthLabel = MONTH_NAMES[selectedMonth];

  /* A category or a group opens in a pane of glass over the page, not as a page of its own. */
  const [subject, setSubject] = useState<SpendSubject | null>(null);
  const openCategory = (name: string) => {
    const g = groupOf(name);
    setSubject({
      name,
      hex: categoryHex(name, data?.customCats),
      icon: categoryIcon(name, data?.customCats),
      categories: [name],
      group: g ? { name: g.name, hex: g.hex } : undefined,
    });
  };

  return (
    <Room>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <PageHeader title="Categorias" back="/" />

        {data === null ? (
          <View style={{ marginTop: 16, gap: 12 }}>
            <View style={{ height: 248, borderRadius: 124, alignSelf: "center", width: 248, backgroundColor: th("rgba(255,255,255,0.04)", "bg") }} />
            <View style={{ height: 80, borderRadius: 22, backgroundColor: th("rgba(255,255,255,0.04)", "bg") }} />
          </View>
        ) : categories.length === 0 ? (
          <Surface radius={22} style={{ marginTop: 20, paddingVertical: 40, alignItems: "center" }}>
            <ChartPie size={30} color={th(INK.faint)} strokeWidth={1.6} />
            <Text style={{ marginTop: 12, fontSize: 14, color: th(INK.soft) }}>
              Sem despesas em {monthLabel.toLocaleLowerCase("pt-BR")}
            </Text>
          </Surface>
        ) : (
          <>
            <Animated.View entering={FadeIn.duration(400)} style={{ marginTop: 8 }}>
              <SpendRing
                total={total}
                caption={`gastos em ${monthLabel.toLocaleLowerCase("pt-BR")}`}
                segments={
                  view === "categorias"
                    ? categories.map((c) => ({ key: c.name, hex: c.hex, amount: c.amount }))
                    : groups.map((g) => ({ key: g.def.name, hex: g.def.hex, amount: g.amount }))
                }
              />
            </Animated.View>

            {categories[0] && (
              <Animated.View entering={FadeInDown.delay(80).duration(400)} style={{ marginTop: 18 }}>
                <TopSpendRow category={categories[0]} monthLabel={monthLabel} onOpen={openCategory} />
              </Animated.View>
            )}

            <View style={{ marginTop: 14 }}>
              <SegmentedTabs
                value={view}
                onChange={setView}
                height={38}
                options={[
                  { key: "categorias" as const, label: "Categorias" },
                  { key: "grupos" as const, label: "Grupos" },
                ]}
              />
            </View>

            <View style={{ marginTop: 14 }}>
              {view === "categorias" ? (
                <CategoryRows categories={categories} onOpen={openCategory} />
              ) : (
                <GroupCards
                  groups={groups}
                  onOpen={(g) =>
                    setSubject({
                      name: g.def.name,
                      hex: g.def.hex,
                      icon: groupIcon(g.def.icon),
                      categories: g.categories.map((c) => c.name),
                    })
                  }
                />
              )}
            </View>

            {/* ══ What you said you would not go past ══ */}
            <Surface radius={22} style={{ marginTop: 20, padding: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 16, fontWeight: "600", color: th("#fff") }}>
                    Limites por categoria
                  </Text>
                  <Text style={{ marginTop: 2, fontSize: 12, color: th(INK.soft) }}>
                    Quanto você ainda pode gastar em cada uma
                  </Text>
                </View>
                <Pressable
                  onPress={() => setSheet({ open: true, category: null })}
                  style={({ pressed }) => ({
                    height: 34,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 5,
                    borderRadius: 999,
                    backgroundColor: th("#fff", "bg"),
                    paddingHorizontal: 12,
                    transform: [{ scale: pressed ? 0.95 : 1 }],
                  })}
                >
                  <Plus size={15} color={th("#0B0B0B")} strokeWidth={2.6} />
                  <Text style={{ fontSize: 13, fontWeight: "700", color: th("#0B0B0B") }}>Criar</Text>
                </Pressable>
              </View>

              {limits.length === 0 ? (
                <Text
                  style={{
                    marginTop: 16,
                    borderRadius: 16,
                    backgroundColor: th("rgba(255,255,255,0.04)", "bg"),
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    fontSize: 13,
                    lineHeight: 18,
                    color: th(INK.soft),
                  }}
                >
                  Nenhum limite ainda. Crie um para acompanhar quanto falta em cada categoria.
                </Text>
              ) : (
                <View style={{ marginTop: 16, gap: 14 }}>
                  {limits.map((lim, i) => {
                    const spent = summaries.find((c) => c.name === lim.category)?.amount ?? 0;
                    const ratio = lim.limit_amount > 0 ? spent / lim.limit_amount : 0;
                    const left = lim.limit_amount - spent;
                    const Icon = categoryIcon(lim.category, data.customCats);
                    const hex = categoryHex(lim.category, data.customCats);
                    const tone = left < 0 ? RED : ratio >= 0.8 ? AMBER : "rgba(255,255,255,0.74)";
                    return (
                      <Pressable
                        key={lim.id}
                        onPress={() => setSheet({ open: true, category: lim.category })}
                        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                          <View
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 18,
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor: th(`${hex}22`, "bg"),
                            }}
                          >
                            <Icon size={16} color={th(hex)} strokeWidth={2} />
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text numberOfLines={1} style={{ fontSize: 14, color: th("#fff") }}>
                              {lim.category}
                            </Text>
                            <Text style={{ marginTop: 1, fontSize: 11, color: th(INK.soft) }}>
                              {money(spent)} de {money(lim.limit_amount)}
                            </Text>
                          </View>
                          <Text style={{ fontSize: 13, fontWeight: "600", color: th(tone) }}>
                            {left < 0 ? `${money(-left)} acima` : `${money(left)} livre`}
                          </Text>
                        </View>
                        <View
                          style={{
                            marginLeft: 46,
                            marginTop: 6,
                            height: 6,
                            borderRadius: 999,
                            overflow: "hidden",
                            backgroundColor: th("rgba(255,255,255,0.08)", "bg"),
                          }}
                        >
                          <Bar
                            share={Math.min(ratio, 1)}
                            color={left < 0 ? RED : ratio >= 0.8 ? AMBER : "#fff"}
                            delay={0.1 + i * 0.05}
                          />
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </Surface>
          </>
        )}
      </ScrollView>

      <LimitSheet
        open={sheet.open}
        category={sheet.category}
        categories={summaries.map((c) => c.name)}
        current={limits.find((l) => l.category === sheet.category)?.limit_amount ?? null}
        onClose={() => setSheet({ open: false, category: null })}
        onSaved={() => {
          setSheet({ open: false, category: null });
          void loadLimits();
        }}
      />
      <SpendModal subject={subject} data={data} month={selectedMonth} year={selectedYear} onClose={() => setSubject(null)} />
    </Room>
  );
}
