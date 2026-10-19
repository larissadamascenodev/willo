import { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGreeting } from "@/lib/greeting";
import { buildInsights } from "@/lib/insights";
import { useFinanceData } from "@/hooks/useFinanceData";
import { useProfile } from "@/hooks/useProfile";
import { useHiddenValues } from "@/hooks/useHiddenValues";
import { useCardsOverview, invoiceDueDate } from "@/hooks/useCardsOverview";
import Room from "~/components/Room";
import ScrollEdge from "~/components/ScrollEdge";
import HomeHeader from "~/components/home/HomeHeader";
import Stories from "~/components/home/Stories";
import WidgetBoard from "~/components/home/WidgetBoard";
import EditBar from "~/components/home/EditBar";
import { renderHomeWidget } from "~/components/home/HomeWidgets";
import { useAuth } from "~/lib/auth";
import { useNavChrome } from "~/lib/navChrome";
import { INK } from "~/theme/tokens";

/**
 * The home.
 *
 * It gets the lit ground and the hour over it, like the wallet and the accounts
 * screen — it is a place you arrive at rather than work in, and the cards sit badly
 * on flat charcoal.
 *
 * The greeting is not a heading here: it is the first of the readings at the top,
 * which is where the web puts it too. Everything under them belongs to the board,
 * which decides what is shown, in what order and at what width — this screen only
 * says what each widget is made of.
 */
export default function Home() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { onScroll, moved } = useNavChrome();
  const { greeting, dateStr } = useGreeting();
  const hidden = useHiddenValues();
  const [refreshing, setRefreshing] = useState(false);
  /* Held here, not in the board: the bar that says it is being edited has to stay
     put while the board scrolls under it. */
  const [editing, setEditing] = useState(false);

  const today = useMemo(() => new Date(), []);
  const month = today.getMonth();
  const year = today.getFullYear();

  const { data, refetch } = useFinanceData(month, year, { includeHistorical: false });
  const { profile } = useProfile();
  const { cards, invoices } = useCardsOverview();

  const name = profile?.display_name || user?.email?.split("@")[0] || "";
  const firstName = name.trim().split(" ")[0] ?? "";

  /* The one reading this screen has to work out for itself: which invoice is next. */
  const invoice = useMemo(() => {
    const now = new Date();
    const pending = cards
      .map((card) => {
        const rolls = now.getDate() > card.closingDay ? 1 : 0;
        const i = now.getFullYear() * 12 + now.getMonth() + rolls;
        const found = invoices.find(
          (x) => x.cardId === card.id && x.month === (i % 12) + 1 && x.year === Math.floor(i / 12),
        );
        return { card, invoice: found, due: invoiceDueDate(card, Math.floor(i / 12), (i % 12) + 1) };
      })
      .filter((x) => x.invoice && !x.invoice.isPaid && x.invoice.total > 0)
      .sort((a, b) => a.due.getTime() - b.due.getTime())[0];
    if (!pending) return null;
    return {
      cardName: pending.card.name,
      total: pending.invoice!.total,
      days: Math.round(
        (new Date(pending.due).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000,
      ),
    };
  }, [cards, invoices]);

  const slides = useMemo(
    () =>
      buildInsights({
        greeting,
        dateStr,
        firstName,
        receitas: data.receitas,
        despesas: data.despesas,
        saldoPrevisto: data.saldoPrevisto,
        saldoAtual: data.saldoAtual,
        categories: data.categories ?? [],
        events: data.events ?? [],
        transactions: data.transactions ?? [],
        month,
        isCurrentMonth: true,
        invoice,
        hidden,
      }),
    [greeting, dateStr, firstName, data, month, invoice, hidden],
  );

  const widgetContext = useMemo(
    () => ({
      receitas: data.receitas,
      despesas: data.despesas,
      saldoPrevisto: data.saldoPrevisto,
      categories: data.categories ?? [],
      events: data.events ?? [],
      transactions: data.transactions ?? [],
      month,
      isCurrentMonth: true,
    }),
    [data, month],
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  return (
    <Room lit sky>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: 150,
          paddingHorizontal: 16,
        }}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={32}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={INK.softer} />
        }
      >
        <HomeHeader name={name} avatarUrl={profile?.avatar_url} />

        <View style={{ marginTop: 14 }}>
          <Stories slides={slides} />
        </View>

        <View style={{ marginTop: 20 }}>
          <WidgetBoard
            userId={user?.id}
            editing={editing}
            onEditingChange={setEditing}
            render={(id, size) => renderHomeWidget(id, size, widgetContext)}
          />
        </View>
      </ScrollView>

      {/* Only this screen pins a header for content to dissolve under. */}
      <ScrollEdge on={moved && !editing} />
      <EditBar open={editing} onDone={() => setEditing(false)} />
    </Room>
  );
}
