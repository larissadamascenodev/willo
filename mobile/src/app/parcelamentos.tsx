import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, ScrollView, Text, View, type TextStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn } from "react-native-reanimated";
import type { ActiveInstallmentItem } from "@/lib/installmentProgress";
import {
  installmentProjection,
  installmentTotals,
  loadActiveInstallments,
  type CardBadge,
  type ProjectionMonth,
} from "@/services/activeInstallments";
import { getCustomCategories, type CustomCategory } from "@/services/categoryService";
import Room from "~/components/Room";
import BackButton from "~/components/BackButton";
import { FlexBar } from "~/components/Bar";
import SegmentedTabs from "~/components/SegmentedTabs";
import InstallmentPurchaseCard from "~/components/installments/InstallmentPurchaseCard";
import InstallmentChart from "~/components/installments/InstallmentChart";
import InstallmentPayoffs from "~/components/installments/InstallmentPayoffs";
import InstallmentCategories from "~/components/installments/InstallmentCategories";
import { CalendarClock } from "~/components/icons";
import { money } from "~/lib/money";
import { useAuth } from "~/lib/auth";
import { AMBER, GREEN, INK } from "~/theme/tokens";
import { type as T } from "~/theme/type";

/**
 * Everything being paid off in instalments.
 *
 * The question this screen answers is not how much is owed — it is when it stops.
 * So it leads with what the instalments take out of a month and, right under it,
 * when that ends; then, on the page itself, how much of the whole debt is behind you.
 *
 * The chart of the months ahead is the page's month picker. It opens on this month,
 * and everything under it reads whichever month is chosen: what you finish paying
 * in it, what categories it is made of, and the purchases with an instalment in
 * it — each with the tick of that month's instalment lit. Choose December and the
 * page under the chart is December.
 */

const nums: TextStyle = Platform.select({
  ios: { fontVariant: ["tabular-nums"] },
  default: {},
}) as TextStyle;

const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

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
  const byId = useMemo(() => new Map(list.map((i) => [i.id, i])), [list]);

  /* Month by month. This month is read from the purchases themselves rather than
     projected, so one that is running late still counts in it. */
  const months = useMemo<ProjectionMonth[]>(() => {
    const projection = installmentProjection(list, stats?.monthsUntilFree ?? 12);
    if (projection.length === 0) return projection;
    const parts = list
      .map((i) => ({ id: i.id, name: i.name, category: i.category, amount: i.amount, number: i.installment_current, total: i.installments }))
      .sort((a, b) => b.amount - a.amount);
    projection[0] = { ...projection[0], parts, value: parts.reduce((s, x) => s + x.amount, 0) };
    return projection;
  }, [list, stats]);

  const selected = Math.min(month, Math.max(months.length - 1, 0));
  const picked = months[selected];
  const thisYear = months[0]?.year;
  const monthName = picked ? `${MONTHS[picked.month]}${picked.year !== thisYear ? ` de ${picked.year}` : ""}` : "";

  const onCard = list.filter((i) => i.payment_method === "cartao").length;
  /* The purchases with an instalment in the chosen month, and which one it is. */
  const inMonth = useMemo(
    () =>
      (picked?.parts ?? [])
        .map((part) => ({ part, item: byId.get(part.id) }))
        .filter((x): x is { part: (typeof x)["part"]; item: ActiveInstallmentItem } => !!x.item),
    [picked, byId],
  );
  const visible = inMonth.filter(({ item }) =>
    methodFilter === "todos" ? true : methodFilter === "cartao" ? item.payment_method === "cartao" : item.payment_method !== "cartao",
  );

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
            <Paid paid={stats.totalJaPago} left={stats.totalRestante} total={stats.totalGeral} />

            {/* ══ The months ahead — and the page's month picker ══ */}
            {months.length > 1 && (
              <View style={{ marginTop: 34 }}>
                <InstallmentChart projection={months} selected={selected} onSelect={setMonth} />
              </View>
            )}

            {picked && (
              <Animated.View key={picked.key} entering={FadeIn.duration(240)}>
                {/* ══ The chosen month ══ */}
                <View style={{ marginTop: 30, paddingHorizontal: 4 }}>
                  <Text style={{ fontSize: 21, fontWeight: "700", letterSpacing: -0.4, color: "#fff" }}>
                    {selected === 0 ? "Este mês" : `Em ${monthName}`}
                  </Text>
                  <Text style={{ marginTop: 2, fontSize: 13.5, color: INK.soft }}>
                    {picked.parts.length} {picked.parts.length === 1 ? "parcela" : "parcelas"}
                    {selected > 0 && months[0].value - picked.value > 0.005 ? (
                      <>
                        {" · "}
                        <Text style={[nums, { fontWeight: "600", color: "#fff" }]}>{money(months[0].value - picked.value)}</Text> a
                        menos que este mês
                      </>
                    ) : null}
                  </Text>
                </View>

                <View style={{ marginTop: 14, gap: 12 }}>
                  <InstallmentPayoffs months={months} selected={selected} onSelect={setMonth} customCats={customCats} />
                  <InstallmentCategories
                    parts={picked.parts}
                    monthLabel={selected === 0 ? "este mês" : monthName}
                    byId={byId}
                    cardsById={cardsById}
                    customCats={customCats}
                  />
                </View>

                {/* ══ The purchases with an instalment in it ══ */}
            <View style={{ marginTop: 30, paddingHorizontal: 4, flexDirection: "row", alignItems: "baseline", gap: 8 }}>
              <Text style={{ fontSize: 17, fontWeight: "600", letterSpacing: -0.2, color: "#fff" }}>Parcelas {selected === 0 ? "do mês" : `de ${MONTHS[picked.month]}`}</Text>
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
                  Nenhuma parcela {methodFilter === "cartao" ? "no cartão" : "na conta"}{" "}
                  {selected === 0 ? "este mês" : `em ${monthName}`}.
                </Text>
              ) : (
                visible.map(({ item, part }, i) => (
                  <InstallmentPurchaseCard
                    key={item.id}
                    item={item}
                    index={i}
                    customCats={customCats}
                    card={item.credit_card_id ? cardsById[item.credit_card_id] : undefined}
                    focus={part.number}
                    monthLabel={monthName}
                  />
                ))
              )}
            </View>
              </Animated.View>
            )}
          </>
        )}
      </ScrollView>
    </Room>
  );
}

/**
 * How much of everything bought in instalments is already behind you, on the page
 * itself: one bar, green for what is paid and amber for what is still to come, and
 * the two figures side by side under it in the same two colours.
 */
function Paid({ paid, left, total }: { paid: number; left: number; total: number }) {
  const share = total > 0 ? paid / total : 0;
  return (
    <View style={{ marginTop: 28, paddingHorizontal: 4 }}>
      <View style={{ flexDirection: "row", height: 8, gap: 3 }}>
        {share > 0 && <FlexBar share={share} color={GREEN} delay={0.12} />}
        {share < 1 && <FlexBar share={1 - share} color={AMBER} delay={0.2} />}
      </View>
      <View style={{ marginTop: 14, flexDirection: "row", gap: 16 }}>
        <Figure swatch={GREEN} label="Já pago" value={money(paid)} />
        <Figure swatch={AMBER} label="Falta pagar" value={money(left)} />
      </View>
      <Text style={{ marginTop: 10, fontSize: 12.5, color: INK.softer }}>
        <Text style={{ fontWeight: "700", color: "#fff" }}>{Math.round(share * 100)}%</Text> de {money(total)} em compras
        parceladas já foi pago.
      </Text>
    </View>
  );
}

/** One of the two figures under the paid bar. */
function Figure({ swatch, label, value }: { swatch: string; label: string; value: string }) {
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: swatch }} />
        <Text style={{ fontSize: 12.5, color: INK.soft }}>{label}</Text>
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[nums, { marginTop: 4, fontSize: 19, fontWeight: "700", letterSpacing: -0.3, color: "#fff" }]}>
        {value}
      </Text>
    </View>
  );
}
