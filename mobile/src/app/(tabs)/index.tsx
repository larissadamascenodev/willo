import { useCallback, useMemo, useState } from "react";
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
import OrbHero, { LINES_HERO_BODY, ORB_HERO_BODY, WilloGlow } from "~/components/home/OrbHero";
import { useHomeHero } from "~/lib/homeHero";
import WidgetBoard from "~/components/home/WidgetBoard";
import RadarShortcut from "~/components/home/RadarShortcut";
import EditBar from "~/components/home/EditBar";
import { renderHomeWidget, widgetIsEmpty } from "~/components/home/HomeWidgets";
import { useRecorrentes } from "@/hooks/useRecorrentes";
import { useEndedSubscriptions } from "~/lib/subscriptionCheck";
import { useAuth } from "~/lib/auth";
import { useNavChrome } from "~/lib/navChrome";
import { INK } from "~/theme/tokens";

import { th } from "~/theme/theme";
import { GroundInkProvider } from "~/theme/groundInk";
import { useLightSkyModel, usePhotoLook, useSkyModel, useSkyPhoto } from "~/lib/skyModel";
import { isLight } from "~/theme/theme";
/** How far the page travels before the block on top has gone. */
const LINES_TRAVEL = 190;
/** The robot is taller, so he takes longer to go. */
const ORB_TRAVEL = 270;

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
  const router = useRouter();

  const today = useMemo(() => new Date(), []);
  const month = today.getMonth();
  const year = today.getFullYear();

  const { data, refetch } = useFinanceData(month, year, { includeHistorical: false });
  const { profile, refetch: refetchProfile } = useProfile();
  /* Coming back from the profile, the photo and the name may have changed. */
  useFocusEffect(
    useCallback(() => {
      void refetchProfile();
    }, [refetchProfile]),
  );
  const { cards, invoices } = useCardsOverview();
  const { assinaturas, totalAssinaturas } = useRecorrentes();
  const { ended, keep: keepEnded, cancel: cancelEnded } = useEndedSubscriptions(user?.id);

  const name = profile?.display_name || user?.email?.split("@")[0] || "";
  const firstName = name.trim().split(" ")[0] ?? "";

  const [hero] = useHomeHero();

  /* On a photo of one's own, the words outside the cards follow its veil — black on a
     light one, white on a dark one — with a halo as strong as the veil is faint. */
  const [skyModel] = useSkyModel();
  const [lightSkyModel] = useLightSkyModel();
  const skyPhoto = useSkyPhoto();
  const photoLook = usePhotoLook(isLight() ? "light" : "dark");
  const onPhoto = !!skyPhoto && (isLight() ? lightSkyModel : skyModel) === "custom";
  const groundLook = useMemo(() => (onPhoto ? { tone: photoLook.tone, amount: photoLook.amount } : null), [onPhoto, photoLook.tone, photoLook.amount]);
  const orbHero = hero === "orb";
  const travel = orbHero ? ORB_TRAVEL : LINES_TRAVEL;

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
      assinaturas,
      totalAssinaturas,
      ended,
      keepEnded,
      cancelEnded,
    }),
    [data, month, assinaturas, totalAssinaturas, ended, keepEnded, cancelEnded],
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
  const pinnedHeight = pinnedTop + (orbHero ? ORB_HERO_BODY : LINES_HERO_BODY);

  return (
    <Room lit sky home>
      <GroundInkProvider look={groundLook}>
      {/* Willo's light, behind everything, so the cards rise through it. Editing is about the
          board, so the top stands down for it. */}
      {!editing && (
        <Animated.View pointerEvents="none" style={[{ position: "absolute", top: 0, left: 0, right: 0 }, glowStyle]}>
          <WilloGlow height={pinnedHeight + 220} />
        </Animated.View>
      )}

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
            tintColor={th(INK.softer)}
            progressViewOffset={insets.top + 40}
          />
        }
      >
        {/* Holds the room the pinned block would have taken, so the first card
            starts where it would have — and travels up over it from there. */}
        {/* Holds the room of the block on top, so the first card starts below it. */}
        <View style={{ height: editing ? insets.top + 86 : pinnedHeight }} pointerEvents="none" />

        {!editing && <RadarShortcut />}

        <WidgetBoard
          userId={user?.id}
          editing={editing}
          onEditingChange={setEditing}
          render={(id, size) => renderHomeWidget(id, size, widgetContext)}
          skip={skipWidget}
        />
      </Animated.ScrollView>

      {/* The sphere is above the page, not under it: the scroller would take the tap.
          Whatever it does not cover still reaches the page. */}
      {!editing && (
        <Animated.View
          pointerEvents={collapsed ? "none" : "box-none"}
          style={[{ position: "absolute", left: 0, right: 0, top: pinnedTop - 8, paddingHorizontal: 16 }, orbStyle]}
        >
          <OrbHero slides={slides} lines={!orbHero} />
        </Animated.View>
      )}

      {/* Above everything: the row that stays, and the band the page passes under. */}
      <ScrollEdge on={moved && !editing} />
      <HomeHeader
        name={name}
        avatarUrl={profile?.avatar_url}
        collapsed={collapsed && !editing}
        onProfile={() => router.push("/perfil" as never)}
      />
      <EditBar open={editing} onDone={() => setEditing(false)} />
      </GroundInkProvider>
    </Room>
  );
}
