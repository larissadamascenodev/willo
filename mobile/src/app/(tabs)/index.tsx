import { useCallback, useMemo, useState } from "react";
import { RefreshControl, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  runOnJS,
  useAnimatedProps,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
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

const AnimatedBlur = Animated.createAnimatedComponent(BlurView);

/** How far the page travels before the pinned block has fully receded. */
const PIN_TRAVEL = 190;
/** What the readings take, plus the room between them and the first card: the
    progress bar, its margin, the slide's own height, and a gap. Measured rather
    than guessed — the slack was showing as a band of empty screen. */
const PINNED_BODY = 2.5 + 18 + 200 + 24;

/**
 * The home.
 *
 * The top of the screen does not scroll. It stays where it is and recedes —
 * blurring, dimming and sinking slightly — while the cards travel up over it. That
 * is the whole arrangement: a fixed row that says who is signed in, a pinned block
 * holding what the app noticed, and a scroller that starts below both and passes
 * over them.
 *
 * The greeting is not a heading here: it is the first of the readings. The name
 * only appears in the row at the top once the block has receded far enough that
 * reading the greeting is no longer the point.
 */
export default function Home() {
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const { user } = useAuth();
  const { report, moved } = useNavChrome();
  const { greeting, dateStr } = useGreeting();
  const hidden = useHiddenValues();
  const [refreshing, setRefreshing] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
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

  /* ── How far into the recession we are, and everything that reads off it ── */
  const scrollY = useSharedValue(0);
  const progress = useDerivedValue(() => Math.min(Math.max(scrollY.value / PIN_TRAVEL, 0), 1));

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
      runOnJS(report)(e.contentOffset.y);
      /* The name takes over up top once the greeting has faded far enough. */
      runOnJS(setCollapsed)(e.contentOffset.y / PIN_TRAVEL > 0.55);
    },
  });

  const pinnedStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value * 0.78,
    transform: [{ scale: 1 - progress.value * 0.035 }],
  }));

  /* React Native has no filter: blur, so the blur is a layer over the block whose
     strength grows instead. */
  const blurProps = useAnimatedProps(() => ({ intensity: progress.value * 36 }));
  const blurStyle = useAnimatedStyle(() => ({ opacity: progress.value > 0.01 ? 1 : 0 }));

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

  /* Where the readings sit, and therefore where the first card starts. */
  const pinnedTop = insets.top + 72;
  const pinnedHeight = pinnedTop + PINNED_BODY;

  return (
    <Room lit sky>
      {/* Pinned. It does not scroll; it recedes. Once it has gone far enough it
          stops taking taps, since by then you cannot read what you would tap. */}
      <Animated.View
        pointerEvents="box-none"
        style={[
          { position: "absolute", left: 0, right: 0, top: pinnedTop, paddingHorizontal: 16 },
          pinnedStyle,
        ]}
      >
        <Stories slides={slides} />
      </Animated.View>

      <AnimatedBlur
        tint="dark"
        animatedProps={blurProps}
        pointerEvents="none"
        style={[
          { position: "absolute", left: 0, right: 0, top: 0, height: pinnedHeight },
          blurStyle,
        ]}
      />

      <Animated.ScrollView
        contentContainerStyle={{
          paddingBottom: 150,
          paddingHorizontal: 16,
        }}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={INK.softer}
            progressViewOffset={insets.top + 40}
          />
        }
      >
        {/* Holds the room the pinned block would have taken, so the first card
            starts where it would have — and travels up over it from there. */}
        <View style={{ height: pinnedHeight }} pointerEvents="none" />

        <WidgetBoard
          userId={user?.id}
          editing={editing}
          onEditingChange={setEditing}
          render={(id, size) => renderHomeWidget(id, size, widgetContext)}
        />
      </Animated.ScrollView>

      {/* Above everything: the row that stays, and the band the page passes under. */}
      <ScrollEdge on={moved && !editing} />
      <HomeHeader
        name={name}
        avatarUrl={profile?.avatar_url}
        collapsed={collapsed && !editing}
      />
      <EditBar open={editing} onDone={() => setEditing(false)} />
    </Room>
  );
}
