import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { categoryHex } from "@/lib/categoryData";
import type { ActiveInstallmentItem } from "@/lib/installmentProgress";
import {
  installmentByCategory,
  installmentProjection,
  installmentTotals,
  loadActiveInstallments,
  type CardBadge,
} from "@/services/activeInstallments";
import { getCustomCategories, type CustomCategory } from "@/services/categoryService";
import Room from "~/components/Room";
import BackButton from "~/components/BackButton";
import Surface from "~/components/Surface";
import Bar, { FlexBar } from "~/components/Bar";
import SegmentedTabs from "~/components/SegmentedTabs";
import InstallmentPurchaseCard from "~/components/installments/InstallmentPurchaseCard";
import { chipFill, chipInk } from "~/lib/chip";
import { categoryIcon } from "~/lib/categoryIcon";
import { CalendarClock } from "~/components/icons";
import { money } from "~/lib/money";
import { useAuth } from "~/lib/auth";
import { INK } from "~/theme/tokens";
import { type as T } from "~/theme/type";

/**
 * Everything being paid off in instalments.
 *
 * The question this screen answers is not how much is owed — it is when it stops.
 * So the figure it leads with is what the instalments take out of a month, and the
 * line under it is the date the last one clears. Everything below is that one
 * figure taken apart: how much of the debt is behind you, how the monthly amount
 * falls as purchases finish, which categories it is made of, and then the purchases
 * themselves.
 */

const CHART_HEIGHT = 110;

const shortMonth = (m: number) =>
  new Date(2000, m).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");

/** A bar in the months-ahead chart: a column that grows up from the floor. */
function Column({ value, max, lead, delay }: { value: number; max: number; lead: boolean; delay: number }) {
  const grow = useSharedValue(0);
  const target = Math.max((value / max) * CHART_HEIGHT, value > 0 ? 8 : 3);

  useEffect(() => {
    grow.value = withDelay(
      delay * 1000,
      withTiming(target, { duration: 450, easing: Easing.out(Easing.cubic) }),
    );
  }, [target, delay, grow]);

  const animated = useAnimatedStyle(() => ({ height: grow.value }));

  return (
    <Animated.View
      style={[
        { width: 32, borderRadius: 999, backgroundColor: lead ? "#fff" : "rgba(255,255,255,0.25)" },
        animated,
      ]}
    />
  );
}

export default function Parcelamentos() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [items, setItems] = useState<ActiveInstallmentItem[] | null>(null);
  const [customCats, setCustomCats] = useState<CustomCategory[]>([]);
  const [cardsById, setCardsById] = useState<Record<string, CardBadge>>({});
  const [methodFilter, setMethodFilter] = useState<"todos" | "cartao" | "conta">("todos");

  const load = useCallback(async () => {
    if (!user) {
      setItems([]);
      return;
    }
    try {
      const [active, cats] = await Promise.all([
        loadActiveInstallments(user.id),
        getCustomCategories(),
      ]);
      setItems(active.items);
      setCardsById(active.cardsById);
      setCustomCats(cats);
    } catch {
      setItems([]);
    }
  }, [user]);

  useEffect(() => {
    void load();
    const onChange = () => void load();
    window.addEventListener("finance-data-changed", onChange);
    return () => window.removeEventListener("finance-data-changed", onChange);
  }, [load]);

  const list = items ?? [];
  const stats = useMemo(() => installmentTotals(list), [list]);

  /* The colour of each month's parts is this app's to decide; the arithmetic is
     shared with the browser. */
  const projection = useMemo(
    () => installmentProjection(list, stats?.monthsUntilFree ?? 12),
    [list, stats],
  );
  const maxProjection = Math.max(...projection.map((p) => p.value), 1);

  const categoryData = useMemo(() => installmentByCategory(list), [list]);

  const visible = useMemo(
    () =>
      methodFilter === "todos"
        ? list
        : list.filter((i) =>
            methodFilter === "cartao" ? i.payment_method === "cartao" : i.payment_method !== "cartao",
          ),
    [list, methodFilter],
  );

  const paidPct = stats && stats.totalGeral > 0 ? (stats.totalJaPago / stats.totalGeral) * 100 : 0;

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
          <BackButton to="/" />
        </View>

        {items === null ? (
          <View style={{ marginTop: 16, gap: 12 }}>
            <View style={{ height: 160, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.04)" }} />
            <View style={{ height: 220, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.04)" }} />
          </View>
        ) : !stats ? (
          <>
            <Text style={[T.title, { marginTop: 8, paddingHorizontal: 4 }]}>Parcelamentos</Text>
            <View style={{ marginTop: 32, alignItems: "center", paddingHorizontal: 32 }}>
              <View
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: INK.edge,
                  backgroundColor: "rgba(255,255,255,0.05)",
                }}
              >
                <CalendarClock size={32} color={INK.soft} strokeWidth={1.8} />
              </View>
              <Text style={{ marginTop: 20, fontSize: 18, fontWeight: "700", color: "#fff" }}>
                Nenhum parcelamento ativo
              </Text>
              <Text style={{ marginTop: 4, textAlign: "center", fontSize: 14, lineHeight: 19, color: INK.soft }}>
                Compras parceladas aparecem aqui com o progresso de cada uma.
              </Text>
            </View>
          </>
        ) : (
          <>
            {/* ══ What they take, and when they stop ══ */}
            <Animated.View entering={FadeInDown.duration(400)} style={{ paddingHorizontal: 4 }}>
              <Text style={[T.title, { marginTop: 8 }]}>Parcelamentos</Text>
              <Text style={{ marginTop: 2, fontSize: 14, color: INK.soft }}>
                {list.length} {list.length === 1 ? "compra parcelada" : "compras parceladas"} · cartão e conta
              </Text>

              <Text style={{ marginTop: 24, fontSize: 15, color: INK.soft }}>Comprometido por mês</Text>
              <Text numberOfLines={1} style={[T.figureBig, { marginTop: 2 }]}>
                {money(stats.totalMensal)}
              </Text>
              <Text style={{ marginTop: 2, fontSize: 14, color: INK.soft }}>
                {stats.monthsUntilFree > 0
                  ? `Livre em ${stats.monthsUntilFree} ${stats.monthsUntilFree === 1 ? "mês" : "meses"} · ${stats.lastEndDate
                      .toLocaleDateString("pt-BR", { month: "short", year: "numeric" })
                      .replace(".", "")}`
                  : "Última parcela este mês"}
              </Text>
            </Animated.View>

            {/* ══ How much is already behind you ══ */}
            <Animated.View entering={FadeInDown.delay(60).duration(420)}>
              <Surface radius={24} style={{ marginTop: 24, padding: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 14, color: "rgba(255,255,255,0.74)" }}>Progresso geral</Text>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: "#fff" }}>
                    {Math.round(paidPct)}% pago
                  </Text>
                </View>
                <View
                  style={{
                    marginTop: 12,
                    height: 12,
                    borderRadius: 999,
                    overflow: "hidden",
                    backgroundColor: "rgba(255,255,255,0.08)",
                  }}
                >
                  <Bar share={paidPct / 100} color="#fff" delay={0.1} />
                </View>

                <View
                  style={{
                    marginTop: 16,
                    flexDirection: "row",
                    borderTopWidth: 1,
                    borderTopColor: INK.edge,
                    paddingTop: 14,
                  }}
                >
                  <View style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                    <Text style={{ fontSize: 12, color: INK.soft }}>Já pago</Text>
                    <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 17, fontWeight: "700", color: "#fff" }}>
                      {money(stats.totalJaPago)}
                    </Text>
                  </View>
                  <View
                    style={{
                      flex: 1,
                      minWidth: 0,
                      borderLeftWidth: 1,
                      borderLeftColor: INK.edge,
                      paddingLeft: 16,
                    }}
                  >
                    <Text style={{ fontSize: 12, color: INK.soft }}>Falta pagar</Text>
                    <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 17, fontWeight: "700", color: "#fff" }}>
                      {money(stats.totalRestante)}
                    </Text>
                  </View>
                </View>
              </Surface>
            </Animated.View>

            {/* ══ The monthly figure, falling ══ */}
            {projection.length > 1 && (
              <Animated.View entering={FadeInDown.delay(110).duration(420)}>
                <Surface radius={24} style={{ marginTop: 12, paddingVertical: 16 }}>
                  <View style={{ paddingHorizontal: 16 }}>
                    <Text style={{ fontSize: 16, fontWeight: "600", color: "#fff" }}>Próximos meses</Text>
                    <Text style={{ marginTop: 2, fontSize: 12, color: INK.soft }}>
                      O valor cai conforme as parcelas terminam
                    </Text>
                  </View>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, gap: 10 }}
                  >
                    {projection.map((p, i) => (
                      <View key={p.key} style={{ width: 44, alignItems: "center" }}>
                        <Text style={{ marginBottom: 6, fontSize: 10, color: i === 0 ? "#fff" : INK.soft }}>
                          {p.value >= 1000 ? `${(p.value / 1000).toFixed(1)}k` : p.value.toFixed(0)}
                        </Text>
                        <View style={{ height: CHART_HEIGHT, justifyContent: "flex-end" }}>
                          <Column value={p.value} max={maxProjection} lead={i === 0} delay={i * 0.03} />
                        </View>
                        <Text
                          style={{
                            marginTop: 8,
                            fontSize: 12,
                            textTransform: "capitalize",
                            fontWeight: i === 0 ? "600" : "400",
                            color: i === 0 ? "#fff" : INK.soft,
                          }}
                        >
                          {shortMonth(p.month)}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                </Surface>
              </Animated.View>
            )}

            {/* ══ What the monthly figure is made of ══ */}
            {categoryData.length > 1 && (
              <Animated.View entering={FadeInDown.delay(160).duration(420)}>
                <Surface radius={24} style={{ marginTop: 12, padding: 16 }}>
                  <Text style={{ fontSize: 16, fontWeight: "600", color: "#fff" }}>Por categoria</Text>

                  <View style={{ marginTop: 12, flexDirection: "row", height: 10, gap: 3 }}>
                    {categoryData.map((cat, i) => (
                      <FlexBar
                        key={cat.category}
                        share={cat.amount / stats.totalMensal}
                        color={categoryHex(cat.category, customCats)}
                        delay={0.1 + i * 0.05}
                      />
                    ))}
                  </View>

                  <View style={{ marginTop: 12, gap: 10 }}>
                    {categoryData.map((cat) => {
                      const Icon = categoryIcon(cat.category, customCats);
                      const hex = categoryHex(cat.category, customCats);
                      return (
                        <View key={cat.category} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
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
                          <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, fontSize: 14, color: "#fff" }}>
                            {cat.category}
                          </Text>
                          <Text style={{ fontSize: 13, color: INK.soft }}>
                            {Math.round((cat.amount / stats.totalMensal) * 100)}%
                          </Text>
                          <Text style={{ width: 92, textAlign: "right", fontSize: 14, fontWeight: "600", color: "#fff" }}>
                            {money(cat.amount)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </Surface>
              </Animated.View>
            )}

            {/* ══ The purchases ══ */}
            <Animated.View
              entering={FadeInDown.delay(210).duration(420)}
              style={{ marginTop: 28, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}
            >
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#fff" }}>Compras</Text>
              <View style={{ flex: 1, minWidth: 0, maxWidth: 232 }}>
                <SegmentedTabs
                  value={methodFilter}
                  onChange={setMethodFilter}
                  height={28}
                  compact
                  options={[
                    { key: "todos" as const, label: "Todos" },
                    { key: "cartao" as const, label: "Cartão" },
                    { key: "conta" as const, label: "Conta" },
                  ]}
                />
              </View>
            </Animated.View>

            <View style={{ marginTop: 12, gap: 8 }}>
              {visible.length === 0 ? (
                <Text style={{ paddingVertical: 24, textAlign: "center", fontSize: 14, color: INK.softer }}>
                  Nenhuma compra neste filtro
                </Text>
              ) : (
                visible.map((item, i) => (
                  <InstallmentPurchaseCard
                    key={item.id}
                    item={item}
                    index={i}
                    customCats={customCats}
                    card={item.credit_card_id ? cardsById[item.credit_card_id] : undefined}
                  />
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </Room>
  );
}
