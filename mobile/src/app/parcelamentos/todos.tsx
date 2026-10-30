import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import type { ActiveInstallmentItem } from "@/lib/installmentProgress";
import { installmentProjection, installmentTotals, loadActiveInstallments, type CardBadge } from "@/services/activeInstallments";
import { getCustomCategories, type CustomCategory } from "@/services/categoryService";
import Room from "~/components/Room";
import BackButton from "~/components/BackButton";
import MonthStrip from "~/components/MonthStrip";
import SegmentedTabs from "~/components/SegmentedTabs";
import CountUp from "~/components/CountUp";
import { InstallmentDetail, InstallmentRow, type MonthPart } from "~/components/installments/InstallmentList";
import { Search } from "~/components/icons";
import { useAuth } from "~/lib/auth";
import { INK } from "~/theme/tokens";
import { type as T } from "~/theme/type";

/**
 * Every instalment of a month, the way a card's statement lists its lines.
 *
 * The month is chosen in the corner, as on the statement; under the title, what that
 * month's instalments add up to and how many there are, split between card and
 * account; then the pills to keep only one side, a search, and the list itself.
 */

const MONTH_NAMES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export default function TodosParcelamentos() {
  const { month: qMonth, year: qYear } = useLocalSearchParams<{ month?: string; year?: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const today = useMemo(() => new Date(), []);

  /* 0-based month, like the strip. */
  const [month, setMonth] = useState(qMonth != null ? Number(qMonth) : today.getMonth());
  const [year, setYear] = useState(Number(qYear) || today.getFullYear());
  const [items, setItems] = useState<ActiveInstallmentItem[]>([]);
  const [cardsById, setCardsById] = useState<Record<string, CardBadge>>({});
  const [customCats, setCustomCats] = useState<CustomCategory[]>([]);
  const [tab, setTab] = useState<"todos" | "cartao" | "conta">("todos");
  const [search, setSearch] = useState("");
  const [opened, setOpened] = useState<MonthPart | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const [active, cats] = await Promise.all([loadActiveInstallments(user.id), getCustomCategories()]);
    setItems(active.items);
    setCardsById(active.cardsById);
    setCustomCats(cats);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const entries = useMemo<MonthPart[]>(() => {
    const stats = installmentTotals(items);
    const ahead = Math.max(stats?.monthsUntilFree ?? 12, (year - today.getFullYear()) * 12 + (month - today.getMonth()));
    const found = installmentProjection(items, ahead).find((m) => m.month === month && m.year === year);
    return (found?.parts ?? [])
      .map((part) => ({ item: byId.get(part.id), number: part.number }))
      .filter((x): x is MonthPart => !!x.item);
  }, [items, byId, month, year, today]);

  const onCard = entries.filter((e) => e.item.payment_method === "cartao");
  const total = entries.reduce((s, e) => s + e.item.amount, 0);
  const cardTotal = onCard.reduce((s, e) => s + e.item.amount, 0);

  const shown = entries.filter(({ item }) => {
    if (tab === "cartao" && item.payment_method !== "cartao") return false;
    if (tab === "conta" && item.payment_method === "cartao") return false;
    if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <Room>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 40, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ height: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <BackButton to="/parcelamentos" />
          <MonthStrip
            month={month}
            year={year}
            onChange={(m, y) => {
              setMonth(m);
              setYear(y);
              setTab("todos");
              setSearch("");
            }}
          />
        </View>

        <Text style={[T.title, { marginTop: 8, paddingHorizontal: 4 }]}>Parcelamentos</Text>

        <View style={{ marginTop: 18, paddingHorizontal: 4 }}>
          <Text style={{ fontSize: 13, color: INK.soft }}>
            Parcelas de {MONTH_NAMES[month]} de {year}
          </Text>
          <CountUp value={total} numberOfLines={1} style={{ marginTop: 4, fontSize: 38, fontWeight: "800", letterSpacing: -1.5, color: "#fff", fontVariant: ["tabular-nums"] }} />
          <Text style={{ marginTop: 2, fontSize: 13, color: INK.softer }}>
            {entries.length} {entries.length === 1 ? "parcela" : "parcelas"}
          </Text>
        </View>

        <View style={{ marginTop: 18, flexDirection: "row", gap: 16, paddingHorizontal: 4 }}>
          <Split dot="#B9B0FF" label="No cartão" value={cardTotal} />
          <Split dot="#7CC4FF" label="Na conta" value={total - cardTotal} />
        </View>

        <View style={{ marginTop: 20 }}>
          <SegmentedTabs
            value={tab}
            onChange={setTab}
            options={[
              { key: "todos" as const, label: `Todas (${entries.length})` },
              { key: "cartao" as const, label: "No cartão" },
              { key: "conta" as const, label: "Na conta" },
            ]}
          />
        </View>

        <View
          style={{
            marginTop: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            height: 44,
            borderRadius: 999,
            paddingHorizontal: 16,
            backgroundColor: "rgba(255,255,255,0.05)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.06)",
          }}
        >
          <Search size={15} color={INK.softer} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar parcelamento..."
            placeholderTextColor={INK.faint}
            style={{ flex: 1, minWidth: 0, fontSize: 14.5, color: "#fff" }}
          />
        </View>

        <View style={{ marginTop: 10 }}>
          {shown.length === 0 ? (
            <Text style={{ paddingVertical: 32, textAlign: "center", fontSize: 14, color: INK.softer }}>Nenhuma parcela neste mês.</Text>
          ) : (
            shown.map((entry, i) => (
              <Animated.View key={entry.item.id} entering={FadeInDown.delay(Math.min(i, 10) * 25).duration(300)}>
                <InstallmentRow
                  entry={entry}
                  customCats={customCats}
                  card={entry.item.credit_card_id ? cardsById[entry.item.credit_card_id] : undefined}
                  onPress={() => setOpened(entry)}
                />
              </Animated.View>
            ))
          )}
        </View>
      </ScrollView>

      <InstallmentDetail
        entry={opened}
        customCats={customCats}
        card={opened?.item.credit_card_id ? cardsById[opened.item.credit_card_id] : undefined}
        onClose={() => setOpened(null)}
      />
    </Room>
  );
}

function Split({ dot, label, value }: { dot: string; label: string; value: number }) {
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: dot }} />
        <Text style={{ fontSize: 12, color: INK.softer }}>{label}</Text>
      </View>
      <CountUp value={value} numberOfLines={1} style={{ marginTop: 3, fontSize: 15.5, fontWeight: "700", letterSpacing: -0.3, color: "#fff", fontVariant: ["tabular-nums"] }} />
    </View>
  );
}
