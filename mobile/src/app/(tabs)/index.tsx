import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { Pressable, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { runOnJS, useAnimatedProps, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
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
import MonthFlowCard from "~/components/home/MonthFlowCard";
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
/** The balance's room before it is measured: its label, figure, line under it and its chart. */
const HERO_GUESS = 300;
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
  const heroStyle = useAnimatedStyle(() => {
    const p = Math.min(Math.max(scrollY.get() / heroH, 0), 1);
    return {
      opacity: 1 - p * 0.8,
      transform: [{ translateY: -Math.max(0, scrollY.get()) * 0.18 }, { scale: 1 - p * 0.04 }],
    };
  });
  const heroBlur = useAnimatedProps(() => ({ intensity: Math.min(Math.max(scrollY.get() / heroH, 0), 1) * 32 }));

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
    }),
    [data, categories, month, assinaturas, assinaturasLoading, totalAssinaturas, ended, keepEnded, cancelEnded],
  );

  /* The balance, the month's in and out and the categories now live above the board, drawn their new way. */
  const skipWidget = useCallback((id: string) => id === "saldo" || id === "categorias" || id === "fluxo" || widgetIsEmpty(id, widgetContext), [widgetContext]);

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
        <Animated.View pointerEvents="none" style={[{ position: "absolute", top: insets.top + 60, left: 16, right: 16 }, heroStyle]}>
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
          <AnimatedBlur tint={th("dark", "tint")} animatedProps={heroBlur} style={{ position: "absolute", top: -20, bottom: -20, left: -16, right: -16 }} />
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
          <View style={{ gap: 18, marginBottom: 26 }}>
            {/* The balance's place in the page: a tap on it opens the accounts. */}
            <Pressable accessibilityRole="button" accessibilityLabel="Saldo em contas" onPress={() => router.push("/gestao" as never)} style={{ height: heroH }} />
            <DailyBudgetCard hidden={hidden} />
            <MonthFlowCard
              month={month}
              receitas={data.receitas}
              recebidas={data.receitasRecebidas}
              despesas={data.despesas}
              pagas={data.despesasPagas}
              hidden={hidden}
            />
            <View style={{ marginTop: 10 }}>
              <CategoryStrip categories={categories} counts={counts} month={month} hidden={hidden} />
            </View>
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
