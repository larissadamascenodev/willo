import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { useMonth } from "@/contexts/MonthContext";
import { useFinanceData } from "@/hooks/useFinanceData";
import { getCustomCategories, type CustomCategory } from "@/services/categoryService";
import {
  loadMonthlyHistory,
  loadTypeDetail,
  trendBetween,
  type TypeDetailInvoice,
  type TypeDetailTransaction,
} from "@/services/typeDetail";
import { categoryHex } from "@/lib/categoryData";
import { cardHex } from "@/hooks/useCardsOverview";
import Room from "~/components/Room";
import BackButton from "~/components/BackButton";
import Surface, { Hairline } from "~/components/Surface";
import Bar from "~/components/Bar";
import { categoryIcon } from "~/lib/categoryIcon";
import { chipFill, chipInk } from "~/lib/chip";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  Receipt,
  Wallet,
} from "~/components/icons";
import { money } from "~/lib/money";
import { useAuth } from "~/lib/auth";
import { AMBER, GREEN, INK, RED } from "~/theme/tokens";
import { type as T } from "~/theme/type";

/**
 * One side of the month: everything that came in, or everything that went out.
 *
 * The figure at the top is the month's total, and the rule under it is how much of
 * that total has actually moved — the difference between a bill that exists and a
 * bill that is paid is the whole reason this screen is not just a list. Then six
 * months of the same figure, so this one has something to be bigger or smaller
 * than, and then the two lists: what is still owed, and what is settled.
 */

const MONTH_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const CHART_HEIGHT = 84;
const PREVIEW = 5;

const compact = (v: number) =>
  `R$ ${Math.abs(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;

type ListItem =
  | { kind: "tx"; tx: TypeDetailTransaction }
  | { kind: "invoice"; inv: TypeDetailInvoice };

/** A month in the six-month strip. */
function HistoryBar({
  value,
  max,
  current,
  accent,
  delay,
}: {
  value: number;
  max: number;
  current: boolean;
  accent: string;
  delay: number;
}) {
  const grow = useSharedValue(0);
  const target = Math.max((value / max) * CHART_HEIGHT, 6);

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
          maxWidth: 28,
          borderRadius: 8,
          backgroundColor: current ? accent : `${accent}44`,
        },
        animated,
      ]}
    />
  );
}

export default function ReceitasDespesasDetalhe() {
  const { tipo } = useLocalSearchParams<{ tipo: string }>();
  const isReceita = tipo === "receitas";
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { selectedMonth, selectedYear } = useMonth();
  const { data } = useFinanceData(selectedMonth, selectedYear, { includeHistorical: false });

  const [transactions, setTransactions] = useState<TypeDetailTransaction[]>([]);
  const [invoices, setInvoices] = useState<TypeDetailInvoice[]>([]);
  const [customCats, setCustomCats] = useState<CustomCategory[]>([]);
  const [history, setHistory] = useState<{ month: number; year: number; value: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    void (async () => {
      const [detail, cats] = await Promise.all([
        loadTypeDetail({ userId: user.id, month: selectedMonth, year: selectedYear, isReceita }),
        getCustomCategories(),
      ]);
      if (!alive) return;
      setTransactions(detail.transactions);
      setInvoices(detail.invoices);
      setCustomCats(cats);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [user, selectedMonth, selectedYear, isReceita]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    void (async () => {
      const months = await loadMonthlyHistory({
        userId: user.id,
        isReceita,
        month: selectedMonth,
        year: selectedYear,
      });
      if (alive) setHistory(months);
    })();
    return () => {
      alive = false;
    };
  }, [user, selectedMonth, selectedYear, isReceita]);

  const total = isReceita ? data.receitas : data.despesas;
  const paid = isReceita ? data.receitasRecebidas : data.despesasPagas;
  const pending = isReceita ? data.receitasPendentes : data.despesasPendentes;
  const paidPct = total > 0 ? Math.round((paid / total) * 100) : 0;

  const trend = useMemo(
    () => trendBetween(history, user?.created_at, selectedMonth, selectedYear),
    [history, user, selectedMonth, selectedYear],
  );

  const allPending = useMemo<ListItem[]>(() => {
    const items: ListItem[] = transactions
      .filter((t) => t.status !== "pago")
      .map((tx) => ({ kind: "tx" as const, tx }));
    invoices.filter((inv) => !inv.is_paid).forEach((inv) => items.push({ kind: "invoice" as const, inv }));
    return items;
  }, [transactions, invoices]);

  const allPaid = useMemo<ListItem[]>(() => {
    const items: ListItem[] = transactions
      .filter((t) => t.status === "pago")
      .map((tx) => ({ kind: "tx" as const, tx }));
    invoices.filter((inv) => inv.is_paid).forEach((inv) => items.push({ kind: "invoice" as const, inv }));
    return items;
  }, [transactions, invoices]);

  const accent = isReceita ? GREEN : RED;
  const HeroIcon = isReceita ? Wallet : Receipt;
  const trendPositive = isReceita ? trend > 0 : trend < 0;
  const maxHistory = Math.max(...history.map((h) => h.value), 1);

  const shownPending = showAll ? allPending : allPending.slice(0, PREVIEW);
  const shownPaid = showAll ? allPaid : allPaid.slice(0, PREVIEW);
  const hasMore = allPending.length > PREVIEW || allPaid.length > PREVIEW;

  /** One movement, or one invoice standing in for a card's whole month. */
  const renderItem = (item: ListItem, i: number, isPendingList: boolean) => {
    if (item.kind === "invoice") {
      const inv = item.inv;
      const hex = cardHex(inv.card_color);
      const tone = isPendingList ? AMBER : RED;
      return (
        <View key={inv.id}>
          {i > 0 && <Hairline />}
          <Pressable
            onPress={() => router.push(`/fatura/${inv.credit_card_id}` as never)}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingVertical: 12,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: chipFill(hex),
              }}
            >
              <CreditCard size={18} color={chipInk(hex)} strokeWidth={2} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: "600", color: "#fff" }}>
                Fatura {inv.card_name}
              </Text>
              <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12, color: INK.soft }}>
                {MONTH_SHORT[inv.month - 1]}/{inv.year}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: tone }}>
                −{money(inv.total_amount)}
              </Text>
              <Text style={{ marginTop: 1, fontSize: 10.5, fontWeight: "500", color: tone, opacity: 0.65 }}>
                {isPendingList ? "Pendente" : "Paga"}
              </Text>
            </View>
          </Pressable>
        </View>
      );
    }

    const tx = item.tx;
    const Icon = categoryIcon(tx.category, customCats);
    const hex = categoryHex(tx.category, customCats);
    const tone = isPendingList ? AMBER : isReceita ? GREEN : RED;
    return (
      <View key={tx.id}>
        {i > 0 && <Hairline />}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: chipFill(hex),
            }}
          >
            <Icon size={18} color={chipInk(hex)} strokeWidth={2} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: "600", color: "#fff" }}>
              {tx.name}
            </Text>
            <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12, color: INK.soft }}>
              {tx.category} ·{" "}
              {new Date(`${tx.date.slice(0, 10)}T12:00:00`)
                .toLocaleDateString("pt-BR", { day: "numeric", month: "short" })
                .replace(".", "")}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: tone }}>
              {isReceita ? "+" : "−"}
              {money(tx.amount)}
            </Text>
            <Text style={{ marginTop: 1, fontSize: 10.5, fontWeight: "500", color: tone, opacity: 0.65 }}>
              {isPendingList
                ? isReceita
                  ? "A receber"
                  : "Pendente"
                : isReceita
                  ? "Recebido"
                  : "Pago"}
            </Text>
          </View>
        </View>
      </View>
    );
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
        <View style={{ height: 44, justifyContent: "center" }}>
          <BackButton to="/" />
        </View>

        {/* ══ The month's total, and how much of it has moved ══ */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <Surface radius={28} style={{ marginTop: 10, padding: 18 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: `${accent}22`,
                }}
              >
                <HeroIcon size={18} color={accent} strokeWidth={2} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 13, color: INK.soft }}>
                  Total {isReceita ? "de receitas" : "de despesas"}
                </Text>
                <Text numberOfLines={1} style={[T.figure, { marginTop: 1 }]}>
                  {money(total)}
                </Text>
              </View>
              {trend !== 0 && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    borderRadius: 999,
                    backgroundColor: "rgba(255,255,255,0.08)",
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                  }}
                >
                  {trendPositive ? (
                    <ChevronUp size={14} color={GREEN} strokeWidth={2.6} />
                  ) : (
                    <ChevronDown size={14} color={RED} strokeWidth={2.6} />
                  )}
                  <Text style={{ fontSize: 12, fontWeight: "600", color: trendPositive ? GREEN : RED }}>
                    {trend > 0 ? "+" : ""}
                    {trend}%
                  </Text>
                </View>
              )}
            </View>

            <View
              style={{
                marginTop: 16,
                height: 8,
                borderRadius: 999,
                overflow: "hidden",
                backgroundColor: "rgba(255,255,255,0.07)",
              }}
            >
              <Bar share={Math.min(paidPct, 100) / 100} color={accent} delay={0.1} />
            </View>

            <View style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Check size={13} color={accent} strokeWidth={3} />
                <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.74)" }}>
                  {isReceita ? "Recebido" : "Pago"}{" "}
                  <Text style={{ fontWeight: "600", color: "#fff" }}>{money(paid)}</Text>
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Clock size={13} color={AMBER} />
                <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.74)" }}>
                  Pendente <Text style={{ fontWeight: "600", color: "#fff" }}>{money(pending)}</Text>
                </Text>
              </View>
            </View>
          </Surface>
        </Animated.View>

        {/* ══ The same figure, six months back ══ */}
        {history.length > 0 && (
          <Animated.View entering={FadeInDown.delay(60).duration(420)}>
            <Text style={[T.eyebrow, { marginTop: 24, paddingHorizontal: 4 }]}>Evolução mensal</Text>
            <Surface radius={22} style={{ marginTop: 10, padding: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 12 }}>
                {history.map((h, i) => {
                  const current = i === history.length - 1;
                  return (
                    <View key={`${h.year}-${h.month}`} style={{ flex: 1, alignItems: "center", gap: 6 }}>
                      <Text
                        numberOfLines={1}
                        style={{ fontSize: 10, fontWeight: "700", color: current ? "#fff" : INK.soft }}
                      >
                        {h.value > 0 ? compact(h.value) : "—"}
                      </Text>
                      <View style={{ width: "100%", height: CHART_HEIGHT, justifyContent: "flex-end", alignItems: "center" }}>
                        <HistoryBar
                          value={h.value}
                          max={maxHistory}
                          current={current}
                          accent={accent}
                          delay={i * 0.03}
                        />
                      </View>
                      <Text style={{ fontSize: 11, fontWeight: current ? "600" : "400", color: current ? "#fff" : INK.soft }}>
                        {MONTH_SHORT[h.month]}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </Surface>
          </Animated.View>
        )}

        {/* ══ What is still owed ══ */}
        {allPending.length > 0 && (
          <Animated.View entering={FadeInDown.delay(110).duration(420)}>
            <View
              style={{
                marginTop: 24,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 4,
              }}
            >
              <Text style={T.eyebrow}>{isReceita ? "A receber" : "Pendentes"}</Text>
              <Text style={{ fontSize: 12, fontWeight: "700", color: "rgba(252,211,77,0.70)" }}>
                {allPending.length}
              </Text>
            </View>
            <Surface radius={22} style={{ marginTop: 10, paddingHorizontal: 14 }}>
              {shownPending.map((item, i) => renderItem(item, i, true))}
            </Surface>
          </Animated.View>
        )}

        {/* ══ What is settled ══ */}
        {allPaid.length > 0 && (
          <Animated.View entering={FadeInDown.delay(150).duration(420)}>
            <View
              style={{
                marginTop: 24,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 4,
              }}
            >
              <Text style={T.eyebrow}>{isReceita ? "Recebidas" : "Pagas"}</Text>
              <Text style={{ fontSize: 12, fontWeight: "700", color: accent, opacity: 0.7 }}>
                {allPaid.length}
              </Text>
            </View>
            <Surface radius={22} style={{ marginTop: 10, paddingHorizontal: 14 }}>
              {shownPaid.map((item, i) => renderItem(item, i, false))}
            </Surface>
          </Animated.View>
        )}

        {hasMore && (
          <Pressable
            onPress={() => setShowAll((v) => !v)}
            style={({ pressed }) => ({
              marginTop: 14,
              height: 46,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.06)",
              opacity: pressed ? 0.7 : 1,
            })}
          >
            {showAll ? <ChevronUp size={16} color="#fff" /> : <ChevronDown size={16} color="#fff" />}
            <Text style={{ fontSize: 13, fontWeight: "600", color: "#fff" }}>
              {showAll ? "Ver menos" : "Ver todos"}
            </Text>
          </Pressable>
        )}

        {loading && transactions.length === 0 && (
          <Text style={{ paddingVertical: 48, textAlign: "center", fontSize: 14, color: INK.soft }}>
            Carregando...
          </Text>
        )}

        {!loading && allPending.length === 0 && allPaid.length === 0 && (
          <Text style={{ paddingVertical: 48, textAlign: "center", fontSize: 14, color: INK.softer }}>
            {isReceita ? "Nenhuma receita neste mês." : "Nenhuma despesa neste mês."}
          </Text>
        )}
      </ScrollView>
    </Room>
  );
}
