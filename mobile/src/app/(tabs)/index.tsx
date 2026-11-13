import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { RefreshControl, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from "react-native-reanimated";
import { useGreeting } from "@/lib/greeting";
import { buildInsights } from "@/lib/insights";
import { useFinanceData } from "@/hooks/useFinanceData";
import { useProfile } from "@/hooks/useProfile";
import { useHiddenValues } from "@/hooks/useHiddenValues";
import { useCardsOverview, invoiceDueDate } from "@/hooks/useCardsOverview";
import Room from "~/components/Room";
import ScrollEdge from "~/components/ScrollEdge";
import HomeHeader from "~/components/home/HomeHeader";
import OrbHero, { ORB_HERO_BODY, WilloGlow } from "~/components/home/OrbHero";
import WidgetBoard from "~/components/home/WidgetBoard";
import EditBar from "~/components/home/EditBar";
import { renderHomeWidget, widgetIsEmpty } from "~/components/home/HomeWidgets";
import { useRecorrentes } from "@/hooks/useRecorrentes";
import { useEndedSubscriptions } from "~/lib/subscriptionCheck";
import { useAuth } from "~/lib/auth";
import { asCategoryExpenses, keepDashboard, seedDashboard, useCategoryAnalytics } from "~/lib/warmStart";
import { useNavChrome } from "~/lib/navChrome";
import { INK } from "~/theme/tokens";

import { th, useThemeRedraw } from "~/theme/theme";
import { GroundInkProvider } from "~/theme/groundInk";
import { useLightSkyModel, usePhotoLook, useSkyModel, useSkyPhoto } from "~/lib/skyModel";
import { isLight } from "~/theme/theme";
import { countUnread, generateNotifications } from "@/services/notificationService";
/** How far the page travels before the block on top has gone. */
/** The robot is taller, so he takes longer to go. */
const ORB_TRAVEL = 160;

/**
 * The home.
 *
 * The top of the screen does not scroll. It stays where it is and fades while the cards
 * travel up over it: a fixed row that says who is signed in, the block on top, and a scroller
 * that starts below both and passes over them.
 *
 * What is on top is one of two, chosen from the avatar's sheet: Willo floating and saying what
 * he has noticed, one line at a time, or the same lines centred with no robot, which answer to
 * the touch the way he does.
 *
 * The greeting is not a heading here: it is the first of the readings. The name
 * only appears in the row at the top once the block has receded far enough that
 * reading the greeting is no longer the point.
 */
export default function Home() {
  /* Drawn again in place when the theme changes. */
  useThemeRedraw();
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
  /* A card is being carried: the page holds still under it. */
  const [carrying, setCarrying] = useState(false);
  /* Cancelar: the board puts back how it was when editing began. */
  const [revert, setRevert] = useState(0);
  const router = useRouter();

  const today = useMemo(() => new Date(), []);
  const month = today.getMonth();
  const year = today.getFullYear();

  /* The month kept on the phone is drawn at once; the fresh one is asked for under it. */
  const seeded = useRef(false);
  if (!seeded.current && seedDashboard(user?.id, month, year)) seeded.current = true;
  const { data, loading, refetch } = useFinanceData(month, year, { includeHistorical: false });
  const askedFresh = useRef(false);
  useEffect(() => {
    if (seeded.current && user && !askedFresh.current) {
      askedFresh.current = true;
      void refetch();
    }
  }, [user, refetch]);
  useEffect(() => {
    /* An empty month from a failed read is not kept over a good one. */
    const something = data.transactions.length > 0 || data.events.length > 0 || data.receitas !== 0 || data.despesas !== 0;
    if (!loading && user && something) keepDashboard(user.id, month, year, data);
  }, [data, loading, user, month, year]);
  /* One count of the month's categories for the whole app: the card here says what the
     categories page says, because both read it from the same place. */
  const categoryData = useCategoryAnalytics(user?.id, month, year);
  const categories = useMemo(
    () => asCategoryExpenses(categoryData) ?? data.categories ?? [],
    [categoryData, data.categories],
  );
  const { profile, refetch: refetchProfile } = useProfile();
  /* Coming back from the profile, the photo and the name may have changed; and the
     bell's dot says whether there is something new, worked out as the web does. */
  const [unread, setUnread] = useState(0);
  useFocusEffect(
    useCallback(() => {
      void refetchProfile();
      if (!user) return;
      void generateNotifications(user.id)
        .catch(() => undefined)
        .then(() => countUnread(user.id))
        .then(setUnread)
        .catch(() => undefined);
    }, [refetchProfile, user]),
  );
  const { cards, invoices } = useCardsOverview();
  const { assinaturas, totalAssinaturas } = useRecorrentes();
  const { ended, keep: keepEnded, cancel: cancelEnded } = useEndedSubscriptions(user?.id);

  const name = profile?.display_name || user?.email?.split("@")[0] || "";
  const firstName = name.trim().split(" ")[0] ?? "";


  /* On a photo of one's own, the words outside the cards follow its veil — black on a
     light one, white on a dark one. */
  const [skyModel] = useSkyModel();
  const [lightSkyModel] = useLightSkyModel();
  const skyPhoto = useSkyPhoto();
  const photoLook = usePhotoLook(isLight() ? "light" : "dark");
  const onPhoto = !!skyPhoto && (isLight() ? lightSkyModel : skyModel) === "custom";
  /* The words on the photo follow its veil: always dark in the dark theme, either in the light. */
  const groundMode = onPhoto ? (isLight() ? photoLook.tone : "dark") : null;
  const travel = ORB_TRAVEL;

  /* ── How far into the recession we are, and everything that reads off it ── */
  const scrollY = useSharedValue(0);
  const progress = useDerivedValue(() => Math.min(Math.max(scrollY.value / travel, 0), 1));

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
      runOnJS(report)(e.contentOffset.y);
      /* The name takes over up top once the greeting has faded far enough. */
      runOnJS(setCollapsed)(e.contentOffset.y / travel > 0.55);
    },
  });

  /* The sphere sits above the page, so the cards cannot pass over it the way they do
     the stories; it is gone before they reach it instead. */
  const orbStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - progress.value * 1.7),
    transform: [{ translateY: -progress.value * 26 }, { scale: 1 - progress.value * 0.06 }],
  }));

  const glowStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.value * 0.6 }));

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
      cardId: pending.card.id,
      cardName: pending.card.name,
      /* What it still asks for: a payment made ahead has already left it. */
      total: Math.max(0, pending.invoice!.total - pending.invoice!.paid),
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
        categories,
        events: data.events ?? [],
        transactions: data.transactions ?? [],
        month,
        isCurrentMonth: true,
        invoice,
        hidden,
      }),
    [greeting, dateStr, firstName, data, categories, month, invoice, hidden],
  );

  const widgetContext = useMemo(
    () => ({
      receitas: data.receitas,
      despesas: data.despesas,
      saldoPrevisto: data.saldoPrevisto,
      categories,
      events: data.events ?? [],
      transactions: data.transactions ?? [],
      month,
      isCurrentMonth: true,
      assinaturas,
      totalAssinaturas,
      ended,
      keepEnded,
      cancelEnded,
    }),
    [data, categories, month, assinaturas, totalAssinaturas, ended, keepEnded, cancelEnded],
  );

  const skipWidget = useCallback((id: string) => widgetIsEmpty(id, widgetContext), [widgetContext]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  /* Where the readings sit, and therefore where the first card starts. */
  /* Under the header, so neither the sphere nor the readings touch its icons. */
  const pinnedTop = insets.top + 72;
  const pinnedHeight = pinnedTop + ORB_HERO_BODY;

  return (
    <Room lit sky home>
      <GroundInkProvider mode={groundMode}>
      {/* Willo's light, behind everything, so the cards rise through it. Editing is about the
          board, so the top stands down for it. */}
      {!editing && (
        <Animated.View pointerEvents="none" style={[{ position: "absolute", top: 0, left: 0, right: 0 }, glowStyle]}>
          <WilloGlow height={pinnedHeight + 160} cx="24%" />
        </Animated.View>
      )}

      <Animated.ScrollView
        scrollEnabled={!carrying}
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
            tintColor={th(INK.softer)}
            progressViewOffset={insets.top + 40}
          />
        }
      >
        {/* Holds the room of the block on top, so the first card starts below it. The same
            while editing: holding a card starts editing, and a board that moved up under the
            finger at that moment would drop the card somewhere else. */}
        <View style={{ height: pinnedHeight }} pointerEvents="none" />


        <WidgetBoard
          userId={user?.id}
          editing={editing}
          onEditingChange={setEditing}
          render={(id, size) => renderHomeWidget(id, size, widgetContext)}
          skip={skipWidget}
          onCarrying={setCarrying}
          revert={revert}
        />
      </Animated.ScrollView>

      {/* The sphere is above the page, not under it: the scroller would take the tap.
          Whatever it does not cover still reaches the page. */}
      {!editing && (
        <Animated.View
          pointerEvents={collapsed ? "none" : "box-none"}
          style={[{ position: "absolute", left: 0, right: 0, top: pinnedTop - 8, paddingHorizontal: 16 }, orbStyle]}
        >
          <OrbHero slides={slides} />
        </Animated.View>
      )}

      {/* Above everything: the row that stays, and the band the page passes under. */}
      <ScrollEdge on={moved && !editing} />
      <HomeHeader
        name={name}
        avatarUrl={profile?.avatar_url}
        collapsed={collapsed && !editing}
        onProfile={() => router.push("/perfil" as never)}
        unread={unread}
        onBell={() => router.push("/notificacoes" as never)}
      />
      <EditBar
        open={editing}
        onDone={() => setEditing(false)}
        onCancel={() => {
          setRevert((n) => n + 1);
          setEditing(false);
        }}
      />
      </GroundInkProvider>
    </Room>
  );
}
