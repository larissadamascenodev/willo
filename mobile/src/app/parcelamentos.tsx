import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, Text, View, type TextStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
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
 * So it leads with what the instalments take out of a month and, right under it,
 * when that ends. Then the same figure taken apart, each part as a reading rather
 * than a box: how much of the debt is behind you, how the monthly amount falls
 * month by month — tap a month to see what is in it and what ends there, which is
 * why it falls — what categories it is made of, and the purchases themselves, each
 * paid off one tick at a time.
 */

const CHART_HEIGHT = 120;
const RULE = "rgba(255,255,255,0.07)";

const nums: TextStyle = Platform.select({
  ios: { fontVariant: ["tabular-nums"] },
  default: {},
}) as TextStyle;

const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const shortMonth = (m: number) => MONTHS[m].slice(0, 3);
const monthYear = (d: Date) =>
  d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" }).replace(".", "").replace(" de ", " ");

export default function Parcelamentos() {
  const { user } = useAuth();
  const [items, setItems] = useState<ActiveInstallmentItem[] | null>(null);
  const [customCats, setCustomCats] = useState<CustomCategory[]>([]);
  const [cardsById, setCardsById] = useState<Record<string, CardBadge>>({});

  const load = useCallback(async () => {
    if (!user) {
      setItems([]);
      return;
    }
    try {
      const [active, cats] = await Promise.all([loadActiveInstallments(user.id), getCustomCategories()]);
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

  return <ParcelamentosView items={items} customCats={customCats} cardsById={cardsById} />;
}

/** The page itself, drawn from what it is handed. */
export function ParcelamentosView({
  items,
  customCats,
  cardsById,
}: {
  items: ActiveInstallmentItem[] | null;
  customCats: CustomCategory[];
  cardsById: Record<string, CardBadge>;
}) {
  const insets = useSafeAreaInsets();
  const [methodFilter, setMethodFilter] = useState<"todos" | "cartao" | "conta">("todos");
  const [month, setMonth] = useState(0);

  const list = items ?? [];
  const stats = useMemo(() => installmentTotals(list), [list]);
  const projection = useMemo(() => installmentProjection(list, stats?.monthsUntilFree ?? 12), [list, stats]);
  const maxProjection = Math.max(...projection.map((p) => p.value), 1);
  const categoryData = useMemo(() => installmentByCategory(list), [list]);

  const onCard = list.filter((i) => i.payment_method === "cartao").length;
  const visible = useMemo(
    () =>
      methodFilter === "todos"
        ? list
        : list.filter((i) => (methodFilter === "cartao" ? i.payment_method === "cartao" : i.payment_method !== "cartao")),
    [list, methodFilter],
  );

  const picked = projection[Math.min(month, projection.length - 1)];
  /* What ends in the month being read — the reason the line falls after it. */
  const ending = picked ? picked.parts.filter((p) => p.number === p.total) : [];

  return (
    <Room lit sky>
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
          <View style={{ marginTop: 16, gap: 14, paddingHorizontal: 4 }}>
            <View style={{ height: 28, width: 200, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.06)" }} />
            <View style={{ height: 52, width: 240, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.06)" }} />
            <View style={{ marginTop: 10, height: 220, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.03)" }} />
          </View>
        ) : !stats ? (
          <>
            <Text style={[T.title, { marginTop: 8, paddingHorizontal: 4 }]}>Parcelamentos</Text>
            <View style={{ marginTop: 40, alignItems: "center", paddingHorizontal: 32 }}>
              <CalendarClock size={30} color={INK.softer} strokeWidth={1.6} />
              <Text style={{ marginTop: 16, fontSize: 17, fontWeight: "600", color: "#fff" }}>Nenhum parcelamento ativo</Text>
              <Text style={{ marginTop: 6, textAlign: "center", fontSize: 14, lineHeight: 20, color: INK.soft }}>
                Compras parceladas aparecem aqui, com cada parcela marcada conforme é paga.
              </Text>
            </View>
          </>
        ) : (
          <>
            {/* ══ What they take, and when they stop ══ */}
            <View style={{ paddingHorizontal: 4 }}>
              <Text style={[T.title, { marginTop: 8 }]}>Parcelamentos</Text>
              <Text style={{ marginTop: 2, fontSize: 14, color: INK.soft }}>
                {list.length} {list.length === 1 ? "compra" : "compras"}
                {onCard > 0 && onCard < list.length
                  ? `, ${onCard} no cartão e ${list.length - onCard} na conta`
                  : onCard === list.length
                    ? ", todas no cartão"
                    : ", todas na conta"}
              </Text>

              <Text style={{ marginTop: 26, fontSize: 15, color: INK.soft }}>Comprometido por mês</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit style={[nums, { marginTop: 4, fontSize: 42, fontWeight: "700", letterSpacing: -1.6, color: "#fff" }]}>
                {money(stats.totalMensal)}
              </Text>
              <Text style={{ marginTop: 4, fontSize: 14.5, color: INK.soft }}>
                {stats.monthsUntilFree > 0 ? (
                  <>
                    Livre em <Text style={{ fontWeight: "700", color: "#fff" }}>{stats.monthsUntilFree} {stats.monthsUntilFree === 1 ? "mês" : "meses"}</Text>, em {monthYear(stats.lastEndDate)}
                  </>
                ) : (
                  "A última parcela é deste mês"
                )}
              </Text>
            </View>

            {/* ══ How much of the debt is behind you ══ */}
            <View style={{ marginTop: 28, paddingHorizontal: 4 }}>
              <View style={{ height: 8, borderRadius: 999, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.10)" }}>
                <Bar share={stats.totalGeral > 0 ? stats.totalJaPago / stats.totalGeral : 0} color="#fff" delay={0.12} />
              </View>
              <View style={{ marginTop: 12, flexDirection: "row", gap: 16 }}>
                <Figure swatch="#fff" label="Já pago" value={money(stats.totalJaPago)} />
                <Figure swatch="rgba(255,255,255,0.18)" label="Falta pagar" value={money(stats.totalRestante)} />
              </View>
              <Text style={{ marginTop: 10, fontSize: 12.5, color: INK.softer }}>
                {Math.round(stats.totalGeral > 0 ? (stats.totalJaPago / stats.totalGeral) * 100 : 0)}% de{" "}
                {money(stats.totalGeral)} em compras parceladas já foi pago.
              </Text>
            </View>

            {/* ══ The monthly figure, falling ══ */}
            {projection.length > 1 && picked && (
              <View style={{ marginTop: 34 }}>
                <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12, paddingHorizontal: 4 }}>
                  <Text style={{ fontSize: 17, fontWeight: "600", letterSpacing: -0.2, color: "#fff" }}>Próximos meses</Text>
                  <Text style={{ fontSize: 13, color: INK.softer }}>toque num mês</Text>
                </View>

                {/* What the chosen month holds. */}
                <View style={{ marginTop: 12, paddingHorizontal: 4 }}>
                  <Text style={{ fontSize: 13.5, color: INK.soft }}>
                    {month === 0 ? "Este mês" : `Em ${MONTHS[picked.month]}${picked.year !== new Date().getFullYear() ? ` de ${picked.year}` : ""}`}
                    {" · "}
                    {picked.parts.length} {picked.parts.length === 1 ? "parcela" : "parcelas"}
                  </Text>
                  <Text style={[nums, { marginTop: 2, fontSize: 22, fontWeight: "700", letterSpacing: -0.5, color: "#fff" }]}>
                    {money(picked.value)}
                  </Text>
                  <Text numberOfLines={2} style={{ marginTop: 2, minHeight: 18, fontSize: 12.5, color: INK.softer }}>
                    {ending.length > 0
                      ? `Última parcela de ${ending.map((p) => p.name).join(", ")}`
                      : "Nenhuma compra termina neste mês"}
                  </Text>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 4, paddingTop: 14, gap: 8 }}
                >
                  {projection.map((p, i) => (
                    <Pressable
                      key={p.key}
                      onPress={() => {
                        if (i === month) return;
                        void Haptics.selectionAsync();
                        setMonth(i);
                      }}
                      style={{ width: 40, alignItems: "center" }}
                    >
                      <View style={{ height: CHART_HEIGHT, justifyContent: "flex-end" }}>
                        <Column value={p.value} max={maxProjection} on={i === month} delay={i * 0.03} />
                      </View>
                      <Text
                        style={{
                          marginTop: 8,
                          fontSize: 12,
                          textTransform: "capitalize",
                          fontWeight: i === month ? "700" : "400",
                          color: i === month ? "#fff" : INK.softer,
                        }}
                      >
                        {shortMonth(p.month)}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* ══ What the monthly figure is made of ══ */}
            {categoryData.length > 1 && (
              <View style={{ marginTop: 34, paddingHorizontal: 4 }}>
                <Text style={{ fontSize: 17, fontWeight: "600", letterSpacing: -0.2, color: "#fff" }}>Por categoria</Text>
                <View style={{ marginTop: 12, flexDirection: "row", height: 8, gap: 3 }}>
                  {categoryData.map((cat, i) => (
                    <FlexBar
                      key={cat.category}
                      share={cat.amount / stats.totalMensal}
                      color={categoryHex(cat.category, customCats)}
                      delay={0.1 + i * 0.05}
                    />
                  ))}
                </View>
                <View style={{ marginTop: 8 }}>
                  {categoryData.map((cat, i) => {
                    const Icon = categoryIcon(cat.category, customCats);
                    const hex = categoryHex(cat.category, customCats);
                    return (
                      <View
                        key={cat.category}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 12,
                          paddingVertical: 11,
                          borderTopWidth: i > 0 ? 1 : 0,
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
                        <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, fontSize: 14.5, color: "#fff" }}>
                          {cat.category}
                        </Text>
                        <Text style={[nums, { fontSize: 13, color: INK.softer }]}>
                          {Math.round((cat.amount / stats.totalMensal) * 100)}%
                        </Text>
                        <Text style={[nums, { width: 96, textAlign: "right", fontSize: 14.5, fontWeight: "600", color: "#fff" }]}>
                          {money(cat.amount)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* ══ The purchases ══ */}
            <View style={{ marginTop: 34, paddingHorizontal: 4, flexDirection: "row", alignItems: "baseline", gap: 8 }}>
              <Text style={{ fontSize: 17, fontWeight: "600", letterSpacing: -0.2, color: "#fff" }}>Compras</Text>
              <Text style={{ fontSize: 14, color: INK.faint }}>{visible.length}</Text>
            </View>
            <View style={{ marginTop: 12 }}>
              <SegmentedTabs
                value={methodFilter}
                onChange={setMethodFilter}
                height={32}
                compact
                options={[
                  { key: "todos" as const, label: "Todas" },
                  { key: "cartao" as const, label: "No cartão" },
                  { key: "conta" as const, label: "Na conta" },
                ]}
              />
            </View>

            <View style={{ marginTop: 12, gap: 10 }}>
              {visible.length === 0 ? (
                <Text style={{ paddingVertical: 24, textAlign: "center", fontSize: 14, color: INK.softer }}>
                  Nenhuma compra parcelada {methodFilter === "cartao" ? "no cartão" : "na conta"}.
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

/** One of the two figures under the paid bar. */
function Figure({ swatch, label, value }: { swatch: string; label: string; value: string }) {
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
        <View style={{ width: 8, height: 8, borderRadius: 3, backgroundColor: swatch }} />
        <Text style={{ fontSize: 12.5, color: INK.soft }}>{label}</Text>
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[nums, { marginTop: 4, fontSize: 18, fontWeight: "700", color: "#fff" }]}>
        {value}
      </Text>
    </View>
  );
}

/** A month's column, growing up from the floor; the chosen one lit. */
function Column({ value, max, on, delay }: { value: number; max: number; on: boolean; delay: number }) {
  const grow = useSharedValue(0);
  const target = Math.max((value / max) * CHART_HEIGHT, value > 0 ? 8 : 3);

  useEffect(() => {
    grow.set(withDelay(delay * 1000, withTiming(target, { duration: 480, easing: Easing.bezier(0.23, 1, 0.32, 1) })));
  }, [target, delay, grow]);

  const animated = useAnimatedStyle(() => ({ height: grow.get() }));

  return (
    <Animated.View
      style={[
        {
          width: 28,
          borderRadius: 9,
          borderCurve: "continuous",
          backgroundColor: on ? "#fff" : "rgba(255,255,255,0.20)",
        },
        animated,
      ]}
    />
  );
}
