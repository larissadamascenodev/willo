import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { useMonth } from "@/contexts/MonthContext";
import {
  buildCategorySummaries,
  buildHabitMap,
  buildScoreMap,
  enrichInstallmentImpacts,
  loadCategoryAnalytics,
  type CategoryAnalytics,
} from "@/services/categoryAnalytics";
import { MONTH_NAMES, MONTH_SHORT } from "@/lib/projectionRows";
import { categoryHex } from "@/lib/categoryData";
import Room from "~/components/Room";
import BackButton from "~/components/BackButton";
import Surface, { Hairline } from "~/components/Surface";
import Bar from "~/components/Bar";
import { categoryIcon } from "~/lib/categoryIcon";
import { chipFill, chipInk } from "~/lib/chip";
import { ChevronDown, ChevronUp, Repeat } from "~/components/icons";
import { compact, money } from "~/lib/money";
import { useAuth } from "~/lib/auth";
import { AMBER, GREEN, INK, RED } from "~/theme/tokens";
import { type as T } from "~/theme/type";

/**
 * One category, up close.
 *
 * The figure is what it took this month; everything under it is context for that
 * one number. Six months of the same category, because a category only means
 * something against itself. How much of it is instalments of something bought
 * earlier — money you cannot stop spending this month even if you wanted to. And
 * then every charge, because the list is what makes the number believable.
 */

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

const CHART_HEIGHT = 96;

const SCORE = {
  saudavel: { label: "Saudável", hex: GREEN },
  atencao: { label: "Atenção", hex: AMBER },
  exagerado: { label: "Exagerado", hex: RED },
} as const;

/** One month in the six-month strip. */
function HistoryBar({
  value,
  max,
  current,
  hex,
  delay,
}: {
  value: number;
  max: number;
  current: boolean;
  hex: string;
  delay: number;
}) {
  const grow = useSharedValue(0);
  const target = Math.max((value / max) * CHART_HEIGHT, value > 0 ? 6 : 3);

  useEffect(() => {
    grow.value = withDelay(
      delay * 1000,
      withTiming(target, { duration: 500, easing: Easing.out(Easing.cubic) }),
    );
  }, [target, delay, grow]);

  const animated = useAnimatedStyle(() => ({ height: grow.value }));

  return (
    <Animated.View
      style={[
        {
          width: "100%",
          maxWidth: 30,
          borderRadius: 8,
          backgroundColor: current ? hex : `${hex}44`,
        },
        animated,
      ]}
    />
  );
}

export default function CategoriaDetalhe() {
  const { nome } = useLocalSearchParams<{ nome: string }>();
  const category = decodeURIComponent(nome ?? "");
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { selectedMonth, selectedYear } = useMonth();

  const [data, setData] = useState<CategoryAnalytics | null>(null);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setData(EMPTY);
      return;
    }
    setData(await loadCategoryAnalytics({ userId: user.id, month: selectedMonth, year: selectedYear }));
  }, [user, selectedMonth, selectedYear]);

  useEffect(() => {
    void load();
    const onChange = () => void load();
    window.addEventListener("finance-data-changed", onChange);
    return () => window.removeEventListener("finance-data-changed", onChange);
  }, [load]);

  const summaries = useMemo(() => (data ? buildCategorySummaries(data.transactions) : []), [data]);
  const summary = summaries.find((c) => c.name === category);

  const scores = useMemo(
    () => (data ? buildScoreMap(summaries, buildCategorySummaries(data.prevTransactions)) : {}),
    [summaries, data],
  );
  const habits = useMemo(
    () => (data ? buildHabitMap(data.transactions, selectedMonth, selectedYear) : {}),
    [data, selectedMonth, selectedYear],
  );
  const impact = useMemo(
    () =>
      data
        ? enrichInstallmentImpacts(data.installmentImpacts, summaries).find((i) => i.category === category)
        : undefined,
    [data, summaries, category],
  );

  const history = data?.historical[category] ?? [];
  const maxHistory = Math.max(...history.map((h) => h.amount), 1);
  const hex = categoryHex(category, data?.customCats);
  const Icon = categoryIcon(category, data?.customCats);
  const score = scores[category];
  const habit = habits[category];
  const monthLabel = MONTH_NAMES[selectedMonth];

  const charges = useMemo(
    () =>
      (data?.transactions ?? [])
        .filter((t) => t.type === "despesa" && t.category === category)
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [data, category],
  );
  const shown = showAll ? charges : charges.slice(0, 8);

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
        <View style={{ height: 44, justifyContent: "center" }}>
          <BackButton />
        </View>

        {!data ? (
          <View style={{ marginTop: 16, gap: 12 }}>
            <View style={{ height: 140, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.04)" }} />
            <View style={{ height: 180, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.04)" }} />
          </View>
        ) : !summary ? (
          <Text style={{ marginTop: 40, textAlign: "center", fontSize: 14, color: INK.soft }}>
            Nada gasto em {category} em {monthLabel.toLocaleLowerCase("pt-BR")}.
          </Text>
        ) : (
          <>
            {/* ══ What it took ══ */}
            <Animated.View entering={FadeInDown.duration(400)} style={{ paddingHorizontal: 4, paddingTop: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: chipFill(hex),
                  }}
                >
                  <Icon size={20} color={chipInk(hex)} strokeWidth={2} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontSize: 17, fontWeight: "700", color: "#fff" }}>
                    {category}
                  </Text>
                  <Text style={{ marginTop: 1, fontSize: 12.5, color: INK.soft }}>
                    {monthLabel} · {summary.txCount} {summary.txCount === 1 ? "lançamento" : "lançamentos"}
                  </Text>
                </View>
                {score && (
                  <Text
                    style={{
                      overflow: "hidden",
                      borderRadius: 999,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      fontSize: 11,
                      fontWeight: "700",
                      backgroundColor: `${SCORE[score.score].hex}1F`,
                      color: SCORE[score.score].hex,
                    }}
                  >
                    {SCORE[score.score].label}
                  </Text>
                )}
              </View>

              <Text numberOfLines={1} style={[T.figureBig, { marginTop: 18 }]}>
                {money(summary.amount)}
              </Text>
              <Text style={{ marginTop: 4, fontSize: 13.5, color: INK.soft }}>
                {summary.percentage}% do mês
                {score?.variation !== null && score?.variation !== undefined
                  ? ` · ${score.variation > 0 ? "+" : ""}${score.variation}% vs. o mês passado`
                  : ""}
              </Text>
              <Text style={{ marginTop: 2, fontSize: 12.5, color: INK.softer }}>
                {money(summary.avgPerTx)} por lançamento
                {habit ? ` · ${money(habit.dailyCost)} por dia` : ""}
              </Text>
            </Animated.View>

            {/* ══ The same category, six months back ══ */}
            {history.length > 1 && (
              <Animated.View entering={FadeInDown.delay(60).duration(420)}>
                <Text style={[T.eyebrow, { marginTop: 26, paddingHorizontal: 4 }]}>Evolução</Text>
                <Surface radius={22} style={{ marginTop: 10, padding: 16 }}>
                  <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10 }}>
                    {history.map((h, i) => {
                      const current = i === history.length - 1;
                      return (
                        <View key={`${h.year}-${h.month}`} style={{ flex: 1, alignItems: "center", gap: 6 }}>
                          <Text
                            numberOfLines={1}
                            style={{ fontSize: 10, fontWeight: "700", color: current ? "#fff" : INK.soft }}
                          >
                            {h.amount > 0 ? compact(h.amount) : "—"}
                          </Text>
                          <View
                            style={{
                              width: "100%",
                              height: CHART_HEIGHT,
                              justifyContent: "flex-end",
                              alignItems: "center",
                            }}
                          >
                            <HistoryBar
                              value={h.amount}
                              max={maxHistory}
                              current={current}
                              hex={hex}
                              delay={i * 0.04}
                            />
                          </View>
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: current ? "600" : "400",
                              textTransform: "capitalize",
                              color: current ? "#fff" : INK.soft,
                            }}
                          >
                            {MONTH_SHORT[h.month]}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </Surface>
              </Animated.View>
            )}

            {/* ══ What you cannot stop spending ══ */}
            {impact && (
              <Animated.View entering={FadeInDown.delay(110).duration(420)}>
                <Text style={[T.eyebrow, { marginTop: 26, paddingHorizontal: 4 }]}>Parcelas nesta categoria</Text>
                <Surface radius={22} style={{ marginTop: 10, padding: 16 }}>
                  <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                    <Text style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: INK.soft }}>
                      {impact.impactPct}% do que você gastou aqui já estava comprometido
                    </Text>
                    <Text style={{ fontSize: 17, fontWeight: "700", color: "#fff" }}>
                      {money(impact.monthlyAmount)}
                    </Text>
                  </View>
                  <View
                    style={{
                      marginTop: 12,
                      height: 6,
                      borderRadius: 999,
                      overflow: "hidden",
                      backgroundColor: "rgba(255,255,255,0.08)",
                    }}
                  >
                    <Bar share={Math.min(impact.impactPct / 100, 1)} color={hex} delay={0.12} />
                  </View>
                  <Text style={{ marginTop: 8, fontSize: 12, color: INK.softer }}>
                    {money(impact.totalRemaining)} restantes · acaba em {impact.monthsRemaining}{" "}
                    {impact.monthsRemaining === 1 ? "mês" : "meses"}
                  </Text>

                  <View style={{ marginTop: 14, gap: 10 }}>
                    {impact.items.map((item) => (
                      <View key={item.name} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <Repeat size={14} color={INK.softer} />
                        <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: "#fff" }}>
                          {item.name}
                        </Text>
                        <Text style={{ fontSize: 12, color: INK.soft }}>
                          {item.paidInstallments}/{item.total}
                        </Text>
                        <Text style={{ fontSize: 13.5, fontWeight: "600", color: "#fff" }}>
                          {money(item.amount)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </Surface>
              </Animated.View>
            )}

            {habit?.topMerchant && (
              <Animated.View entering={FadeInDown.delay(150).duration(420)}>
                <Surface radius={18} style={{ marginTop: 12, paddingHorizontal: 16, paddingVertical: 14 }}>
                  <Text style={{ fontSize: 13, lineHeight: 18, color: INK.soft }}>
                    {habit.isHabit ? "Virou rotina: " : ""}
                    <Text style={{ fontWeight: "600", color: "#fff" }}>{habit.topMerchant.name}</Text> aparece{" "}
                    {habit.topMerchant.count} vezes neste mês.
                  </Text>
                </Surface>
              </Animated.View>
            )}

            {/* ══ Every charge ══ */}
            <Animated.View entering={FadeInDown.delay(190).duration(420)}>
              <Text style={[T.eyebrow, { marginTop: 26, paddingHorizontal: 4 }]}>
                Lançamentos · {charges.length}
              </Text>
              <Surface radius={22} style={{ marginTop: 10, paddingHorizontal: 14 }}>
                {shown.map((tx, i) => (
                  <View key={tx.id}>
                    {i > 0 && <Hairline />}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 }}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: "600", color: "#fff" }}>
                          {tx.name}
                        </Text>
                        <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 11.5, color: INK.softer }}>
                          {new Date(`${tx.date.slice(0, 10)}T12:00:00`)
                            .toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
                            .replace(".", "")}
                          {tx.installments && tx.installment_current
                            ? ` · ${tx.installment_current}/${tx.installments}x`
                            : ""}
                          {tx.payment_method === "cartao" ? " · cartão" : ""}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 14.5, fontWeight: "700", color: "#fff" }}>
                        {money(tx.amount)}
                      </Text>
                    </View>
                  </View>
                ))}

                {charges.length > 8 && (
                  <View
                    style={{
                      borderTopWidth: 1,
                      borderTopColor: "rgba(255,255,255,0.06)",
                      alignItems: "center",
                    }}
                  >
                    <Text
                      onPress={() => setShowAll((v) => !v)}
                      style={{ paddingVertical: 13, fontSize: 12.5, fontWeight: "600", color: INK.soft }}
                    >
                      {showAll ? "Mostrar menos" : `Ver todos os ${charges.length}`}
                    </Text>
                  </View>
                )}
              </Surface>
            </Animated.View>
          </>
        )}
      </ScrollView>
    </Room>
  );
}
