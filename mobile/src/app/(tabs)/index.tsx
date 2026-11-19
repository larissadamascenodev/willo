import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { Pressable, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { LinearTransition, runOnJS, useAnimatedProps, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { useFinanceData } from "@/hooks/useFinanceData";
import { useProfile } from "@/hooks/useProfile";
import { useHiddenValues } from "@/hooks/useHiddenValues";
import Room from "~/components/Room";
import ScrollEdge from "~/components/ScrollEdge";
import HomeHeader from "~/components/home/HomeHeader";
import BalanceHero from "~/components/home/BalanceHero";
import DailyBudgetCard from "~/components/home/DailyBudgetCard";
import CategoryStrip from "~/components/home/CategoryStrip";
import FluxoCard from "~/components/home/FluxoCard";
import HomeNotices, { type HomeNotice } from "~/components/home/HomeNotices";
import { useCopilot } from "~/lib/copilot";
import WidgetBoard from "~/components/home/WidgetBoard";
import EditBar from "~/components/home/EditBar";
import { renderHomeWidget, widgetIsEmpty } from "~/components/home/HomeWidgets";
import { useRecorrentes } from "@/hooks/useRecorrentes";
import { useEndedSubscriptions } from "~/lib/subscriptionCheck";
import { useAuth } from "~/lib/auth";
import { asCategoryExpenses, keepDashboard, seedDashboard, useCategoryAnalytics } from "~/lib/warmStart";
import { useNavChrome } from "~/lib/navChrome";
import { INK } from "~/theme/tokens";
import { money } from "~/lib/money";

import { th, useThemeRedraw } from "~/theme/theme";
import { GroundInkProvider } from "~/theme/groundInk";
import { useLightSkyModel, usePhotoLook, useSkyModel, useSkyPhoto } from "~/lib/skyModel";
import { isLight } from "~/theme/theme";
import { countUnread, generateNotifications } from "@/services/notificationService";
import { fetchGoals, type Goal } from "@/services/goalService";
import { keptValue } from "~/lib/warmStart";
/** The balance's room before it is measured: its label, figure, line under it and its chart. */
const HERO_GUESS = 300;
/** The space between the balance and the first card under it. */
const HERO_GAP = 18;
const AnimatedBlur = Animated.createAnimatedComponent(BlurView);

/**
 * The home.
 *
 * On top, the balance, large, with the month's line under it across the whole width: what
 * is in the accounts now and how it got here, dashed on to where the month should end. Under
 * it, what can be spent today; then the month by category, as a row of cards; then the
 * board of cards the person arranges. The row with the profile and the bell stays put as
 * two drops of glass; once the balance has scrolled under it, the balance takes its middle.
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
  const { assinaturas, totalAssinaturas, loading: assinaturasLoading } = useRecorrentes();
  const { ended, keep: keepEnded, cancel: cancelEnded } = useEndedSubscriptions(user?.id);
  /* What the Willo has to tell, under the balance: for now, purchases the Copilot caught. */
  const { items: copilotItems } = useCopilot();
  const notices = useMemo<HomeNotice[]>(() => {
    const list: HomeNotice[] = [];
    const n = copilotItems?.length ?? 0;
    if (n > 0) {
      const first = copilotItems![0];
      list.push({
        key: "copilot",
        from: "Willo Copilot",
        title: n === 1 ? `${first.name} · ${hidden ? "R$ •••" : money(Number(first.amount))}` : `${n} compras para confirmar`,
        text: n === 1 ? "Captada do seu banco. Toque para confirmar." : "Captadas dos seus bancos. Toque para revisar.",
        badge: String(n),
        onPress: () => router.push("/copilot" as never),
      });
    }
    return list;
  }, [copilotItems, hidden, router]);
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
  /* The balance stays where it is, behind the page: the cards scroll up over it and it goes
     soft and quiet as they do, the way the home always moved. */
  const [heroH, setHeroH] = useState(HERO_GUESS);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.set(e.contentOffset.y);
      runOnJS(report)(e.contentOffset.y);
      /* The name takes over up top once the cards have covered most of the balance. */
      runOnJS(setCollapsed)(e.contentOffset.y > heroH * 0.6);
    },
  });
  /* It does not move. What the cards have covered is cut away from below, at the top edge
     of the first card, so none of it shows through their glass; what is still uncovered
     softens as the cards rise. */
  const heroClip = useAnimatedStyle(() => ({ height: Math.max(0, heroH + HERO_GAP - Math.max(0, scrollY.get())) }));
  const heroStyle = useAnimatedStyle(() => {
    const p = Math.min(Math.max(scrollY.get() / heroH, 0), 1);
    return { opacity: 1 - p * 0.5 };
  });
  const heroBlur = useAnimatedProps(() => ({ intensity: Math.min(Math.max(scrollY.get() / heroH, 0), 1) * 24 }));

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
      {/* The balance, fixed behind the page. Editing is about the board, so it stands down then. */}
      {!editing && (
        <Animated.View pointerEvents="none" style={[{ position: "absolute", top: insets.top + 60, left: 0, right: 0, overflow: "hidden" }, heroClip]}>
        <Animated.View style={[{ paddingHorizontal: 16 }, heroStyle]}>
          <View onLayout={(e) => setHeroH(Math.max(200, Math.round(e.nativeEvent.layout.height)))}>
            <BalanceHero
              saldoAtual={data.saldoAtual}
              saldoPrevisto={data.saldoPrevisto}
              transactions={data.transactions ?? []}
              month={month}
              year={year}
              hidden={hidden}
              loading={loading}
            />
          </View>
          <AnimatedBlur tint={th("dark", "tint")} animatedProps={heroBlur} style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }} />
        </Animated.View>
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
        <View style={{ height: insets.top + 60 }} pointerEvents="none" />

        {!editing && (
          <View style={{ gap: HERO_GAP, marginBottom: 26 }}>
            {/* The balance's place in the page: a tap on it opens the accounts. */}
            <Pressable accessibilityRole="button" accessibilityLabel="Saldo em contas" onPress={() => router.push("/gestao" as never)} style={{ height: heroH }} />
            <HomeNotices notices={notices} />
            <Animated.View layout={LinearTransition.duration(320)}>
              <DailyBudgetCard hidden={hidden} />
            </Animated.View>
            <Animated.View layout={LinearTransition.duration(320)}>
              <FluxoCard receitas={data.receitas} despesas={data.despesas} month={month} isCurrentMonth />
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
