import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { Platform, RefreshControl, View, type LayoutRectangle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { LinearTransition, runOnJS, useAnimatedProps, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { useFinanceData } from "@/hooks/useFinanceData";
import { useProfile } from "@/hooks/useProfile";
import { useHiddenValues } from "@/hooks/useHiddenValues";
import Room from "~/components/Room";
import ScrollEdge from "~/components/ScrollEdge";
import HomeHeader from "~/components/home/HomeHeader";
import HomeHero, { type HeroChip } from "~/components/home/HomeHero";
import AttentionCard from "~/components/home/AttentionCard";
import HomeBalanceCard from "~/components/home/HomeBalanceCard";
import CategoryStrip from "~/components/home/CategoryStrip";
import { useCopilot } from "~/lib/copilot";
import { homeLine } from "~/lib/homeLine";
import { isIncome, isSettled } from "~/lib/events";
import { useSpendable } from "~/lib/spendable";
import WidgetBoard from "~/components/home/WidgetBoard";
import EditBar from "~/components/home/EditBar";
import { renderHomeWidget, widgetIsEmpty } from "~/components/home/HomeWidgets";
import { useRecorrentes } from "@/hooks/useRecorrentes";
import { useEndedSubscriptions } from "~/lib/subscriptionCheck";
import { useAuth } from "~/lib/auth";
import { asCategoryExpenses, keepDashboard, seedDashboard, useCategoryAnalytics } from "~/lib/warmStart";
import { useNavChrome } from "~/lib/navChrome";
import { AMBER, INK } from "~/theme/tokens";

import { th, useThemeRedraw } from "~/theme/theme";
import { GroundInkProvider } from "~/theme/groundInk";
import { useLightSkyModel, usePhotoLook, useSkyModel, useSkyPhoto } from "~/lib/skyModel";
import { isLight } from "~/theme/theme";
import { countUnread, generateNotifications } from "@/services/notificationService";
import { fetchGoals, type Goal } from "@/services/goalService";
import { keptValue } from "~/lib/warmStart";
/** The top's room before it is measured: the pills and Willo's line. */
const HERO_GUESS = 250;
/** The row with the photo and the capsule, under the status bar. */
const TOP_ROW = 74;
/** The space between the cards at the top. */
const CARD_GAP = 12;
const AnimatedBlur = Animated.createAnimatedComponent(BlurView);

/**
 * The home.
 *
 * On top, the row that stays: the photo, the name and the day, and one capsule of glass with
 * the eye and the bell. Under it, fixed on the background (HomeHero), a few shortcuts as pills
 * of glass and Willo's line for right now. The cards scroll up over it: what needs attention
 * (only when something does), the balance in the accounts with the month's in, out and end in
 * three lines, the month by category, then the board of cards the person arranges.
 */
/**
 * The home loads its widgets only once it has been on screen. Opened straight onto a page
 * on top of it — a notification, the Copilot, a link — the home underneath stays empty
 * until the person comes back to it, so the page asked for does not wait behind every
 * widget's queries. Coming back, the month is usually already loaded by that page.
 */
export default function Home() {
  const [seen, setSeen] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setSeen(true);
    }, []),
  );
  const { user } = useAuth();
  if (!seen) return <Room lit sky home>{null}</Room>;
  /* Built anew for each account: no card keeps the previous one's figures while loading. */
  return <HomeScreen key={user?.id ?? "none"} />;
}

function HomeScreen() {
  /* Drawn again in place when the theme changes. */
  useThemeRedraw();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { report, moved } = useNavChrome();
  const hidden = useHiddenValues();
  const [refreshing, setRefreshing] = useState(false);
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
  const { assinaturas, totalAssinaturas, loading: assinaturasLoading } = useRecorrentes();
  const { ended, keep: keepEnded, cancel: cancelEnded } = useEndedSubscriptions(user?.id);
  /* Purchases the Copilot caught, waiting for a yes: one of the things that need attention. */
  const { items: copilotItems } = useCopilot();
  /* Whether the caixinhas card has anything to say: money in one, or more than the reserve
     every account starts with. The last answer kept on the phone first. */
  const goalsWorth = (rows: Goal[] | null) => (rows ? rows.some((g) => Number(g.current_amount) > 0) || rows.length > 1 : null);
  const [hasGoals, setHasGoals] = useState<boolean | null>(() => goalsWorth(keptValue<Goal[]>("metas", user?.id)));
  useEffect(() => {
    if (!user) return;
    let alive = true;
    const load = () =>
      fetchGoals()
        .then((rows) => alive && setHasGoals(goalsWorth(rows as Goal[])))
        .catch(() => undefined);
    void load();
    window.addEventListener("finance-data-changed", load);
    return () => {
      alive = false;
      window.removeEventListener("finance-data-changed", load);
    };
  }, [user]);

  const name = profile?.display_name || user?.email?.split("@")[0] || "";
  const firstName = name.trim().split(" ")[0] ?? "";

  /* Willo's line for right now, and the shortcuts over it. */
  const spend = useSpendable();
  const events = useMemo(() => data.events ?? [], [data.events]);
  const line = useMemo(
    () => homeLine({ events, free: spend.free, leftToday: spend.leftToday, tomorrow: spend.tomorrow, daysLeft: spend.daysLeft, firstName, hidden }),
    [events, spend.free, spend.leftToday, spend.tomorrow, spend.daysLeft, firstName, hidden],
  );
  const billsOpen = useMemo(() => events.filter((e) => !isIncome(e) && !isSettled(e)).length, [events]);
  const chips = useMemo<HeroChip[]>(
    () => [
      { key: "contas", label: "Contas a pagar", badge: billsOpen, badgeColor: AMBER, onPress: () => router.push("/eventos" as never) },
      { key: "hoje", label: "Hoje", onPress: () => router.push("/resumo" as never) },
      { key: "cartoes", label: "Cartões", onPress: () => router.push("/cartoes" as never) },
    ],
    [billsOpen, router],
  );
  /* How many charges each category had this month, for the cards under the line. */
  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const t of categoryData?.transactions ?? []) if (t.type === "despesa") out[t.category] = (out[t.category] ?? 0) + 1;
    return out;
  }, [categoryData]);


  /* On a photo of one's own, the words outside the cards follow its veil — black on a
     light one, white on a dark one. */
  const [skyModel] = useSkyModel();
  const [lightSkyModel] = useLightSkyModel();
  const skyPhoto = useSkyPhoto();
  const photoLook = usePhotoLook(isLight() ? "light" : "dark");
  const onPhoto = !!skyPhoto && (isLight() ? lightSkyModel : skyModel) === "custom";
  /* The words on the photo follow its veil: always dark in the dark theme, either in the light. */
  const groundMode = onPhoto ? (isLight() ? photoLook.tone : "dark") : null;
  /* The top stays where it is, behind the page: the cards scroll up over it and it goes soft
     as they do, the way the home always moved. */
  const [heroH, setHeroH] = useState(HERO_GUESS);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.set(e.contentOffset.y);
      runOnJS(report)(e.contentOffset.y);
    },
  });
  /* It does not move. What the cards have covered is cut away from below, at the top edge
     of the first card, so none of it shows through their glass; what is still uncovered
     blurs as the cards rise. (No fading: the pills are glass, and glass fades flat.) */
  const heroClip = useAnimatedStyle(() => ({ height: Math.max(0, heroH - Math.max(0, scrollY.get())) }));
  const heroBlur = useAnimatedProps(() => ({ intensity: Math.min(Math.max(scrollY.get() / heroH, 0), 1) * 24 }));

  /* The pills sit behind the page, so a touch on them is taken by the page over them and
     matched to where each pill is drawn (the page has moved up by what it has scrolled). */
  const chipRects = useRef<Record<string, LayoutRectangle>>({});
  const [pressedChip, setPressedChip] = useState<string | null>(null);
  const chipAt = useCallback(
    (x: number, y: number) => {
      const at = y - scrollY.get();
      for (const [key, r] of Object.entries(chipRects.current)) {
        if (x >= r.x - 6 && x <= r.x + r.width + 6 && at >= r.y - 6 && at <= r.y + r.height + 6) return key;
      }
      return null;
    },
    [scrollY],
  );
  const pressAt = useCallback((x: number, y: number) => setPressedChip(chipAt(x, y)), [chipAt]);
  const tapAt = useCallback(
    (x: number, y: number) => {
      const key = chipAt(x, y);
      setPressedChip(null);
      chips.find((c) => c.key === key)?.onPress();
    },
    [chipAt, chips],
  );
  const letGo = useCallback(() => setPressedChip(null), []);
  const heroTap = useMemo(
    () =>
      Gesture.Tap()
        .maxDistance(12)
        .onBegin((e) => {
          runOnJS(pressAt)(e.x, e.y);
        })
        .onEnd((e, ok) => {
          if (ok) runOnJS(tapAt)(e.x, e.y);
        })
        .onFinalize(() => {
          runOnJS(letGo)();
        }),
    [pressAt, tapAt, letGo],
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
      assinaturasLoading,
      totalAssinaturas,
      ended,
      keepEnded,
      cancelEnded,
      hasGoals,
    }),
    [data, categories, month, assinaturas, assinaturasLoading, totalAssinaturas, ended, keepEnded, cancelEnded, hasGoals],
  );

  /* The balance, the month's in and out and the categories now live above the board, drawn their new way. */
  const skipWidget = useCallback((id: string) => id === "saldo" || id === "categorias" || id === "fluxo" || id === "copilot" || widgetIsEmpty(id, widgetContext), [widgetContext]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  return (
    <Room lit sky home>
      <GroundInkProvider mode={groundMode}>
      {/* The pills and Willo's line, fixed behind the page. Editing is about the board, so it stands down then. */}
      {!editing && (
        <Animated.View pointerEvents="none" style={[{ position: "absolute", top: insets.top + TOP_ROW, left: 0, right: 0, overflow: "hidden" }, heroClip]}>
          <View style={{ paddingHorizontal: 16 }}>
            <View onLayout={(e) => setHeroH(Math.max(160, Math.round(e.nativeEvent.layout.height)))}>
              <HomeHero
                chips={chips}
                pressed={pressedChip}
                line={line}
                onChipRects={(rects) => {
                  chipRects.current = rects;
                }}
              />
            </View>
            {/* On the web a blur at rest still tints what is under it, so it is the phone's only. */}
            {Platform.OS !== "web" && <AnimatedBlur tint={th("dark", "tint")} animatedProps={heroBlur} style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }} />}
          </View>
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
        {/* Under the row at the top. */}
        <View style={{ height: insets.top + TOP_ROW }} pointerEvents="none" />

        {!editing && (
          <View style={{ gap: CARD_GAP, marginBottom: 26 }}>
            {/* The top's place in the page: a touch on a pill goes to it. */}
            <GestureDetector gesture={heroTap}>
              <View style={{ height: heroH, marginBottom: -CARD_GAP }}>
                {chips.map((c) => (
                  <View key={c.key} accessible accessibilityRole="button" accessibilityLabel={c.badge ? `${c.label}, ${c.badge}` : c.label} onAccessibilityTap={c.onPress} style={{ position: "absolute", width: 1, height: 1, opacity: 0 }} />
                ))}
              </View>
            </GestureDetector>
            <AttentionCard events={events} categories={categories} copilot={copilotItems?.length ?? 0} hidden={hidden} />
            <Animated.View layout={LinearTransition.duration(320)}>
              <HomeBalanceCard receitas={data.receitas} despesas={data.despesas} saldoPrevisto={data.saldoPrevisto} hidden={hidden} />
            </Animated.View>
            <Animated.View layout={LinearTransition.duration(320)} style={{ marginTop: 10 }}>
              <CategoryStrip categories={categories} counts={counts} month={month} hidden={hidden} />
            </Animated.View>
          </View>
        )}

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

      {/* Above everything: the row that stays, and the band the page passes under. */}
      <ScrollEdge on={moved && !editing} />
      <HomeHeader
        name={name}
        userId={user?.id}
        avatarUrl={profile?.avatar_url}
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
