import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { RefreshControl, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { runOnJS, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useFinanceData } from "@/hooks/useFinanceData";
import { useProfile } from "@/hooks/useProfile";
import { useHiddenValues } from "@/hooks/useHiddenValues";
import Room from "~/components/Room";
import ScrollEdge from "~/components/ScrollEdge";
import HomeHeader from "~/components/home/HomeHeader";
import HomeHero from "~/components/home/HomeHero";
import HomeShortcuts, { type Shortcut } from "~/components/home/HomeShortcuts";
import { paramsForLine } from "~/components/home/OrbHero";
import { CalendarClock, Flag, PiggyBank, Scale, Sun } from "~/components/icons";
import { isIncome, isSettled } from "~/lib/events";
import type { Greeting } from "~/lib/greeting";
import { useGreeting } from "@/lib/greeting";
import { buildInsights } from "@/lib/insights";
import { useCardsOverview, invoiceDueDate } from "@/hooks/useCardsOverview";
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
import { fetchGoals, type Goal } from "@/services/goalService";
import { keptValue } from "~/lib/warmStart";
import { cachedName, rememberName } from "~/lib/warmHome";
/** Willo's line's room before it is measured. */
const HERO_GUESS = 200;
/** The row with the photo and the capsule, under the status bar. */
const TOP_ROW = 74;
/** The row of shortcuts under it, which scrolls with the page. */
const SHORTCUTS_H = 46;
/** The space between the cards at the top. */
const CARD_GAP = 12;

/**
 * The home.
 *
 * On top, the row that stays: the photo, the name and the day, and one capsule of glass with
 * the eye and the bell (the name comes in beside the photo once the page scrolls). Under it a
 * row of shortcuts as pills of glass (Hoje, Contas a pagar, Balanço, Caixinhas, Jornada) that
 * scrolls with the page, and Willo speaking, fixed on the background (HomeHero): his lines in
 * turn, a touch opening the conversation on the one on show. The board scrolls up over him: the
 * balance in the accounts, Fluxo de caixa, Gastos do mês, the month by category, the cards, the
 * instalments, and whatever the person has switched on — each one held to move it, make it
 * compact or large, or take it off. (Hoje and Precisa da
 * sua atenção are built and wait in components/home until those features come in.)
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
  /* Willo calls the person by the name they gave, never by their e-mail: until the profile
     arrives, the one kept from last time, or the one on the account. */
  const meta = user?.user_metadata as { display_name?: string; full_name?: string } | undefined;
  const known = profile?.display_name || cachedName(user?.id) || meta?.display_name || meta?.full_name || "";
  useEffect(() => {
    if (user?.id && profile?.display_name) rememberName(user.id, profile.display_name);
  }, [user?.id, profile?.display_name]);
  const firstName = known.trim().split(" ")[0] ?? "";

  const events = useMemo(() => data.events ?? [], [data.events]);

  /* The shortcuts: what used to be a card of its own, now a touch away. */
  const billsOpen = useMemo(() => events.filter((e) => !isIncome(e) && !isSettled(e)).length, [events]);
  const shortcuts = useMemo<Shortcut[]>(
    () => [
      /* From now outwards: the day, what is due, the month, what is kept, the long run. */
      /* In the app's quiet colours: the marks white, only the count lit. */
      { key: "hoje", label: "Hoje", Icon: Sun, tone: "#FFFFFF", onPress: () => router.push("/resumo" as never) },
      { key: "contas", label: "Contas a pagar", Icon: CalendarClock, tone: "#FFFFFF", badge: billsOpen, onPress: () => router.push("/eventos" as never) },
      { key: "balanco", label: "Balanço", Icon: Scale, tone: "#FFFFFF", onPress: () => router.push("/balanco" as never) },
      { key: "caixinhas", label: "Caixinhas", Icon: PiggyBank, tone: "#FFFFFF", onPress: () => router.push("/caixinhas" as never) },
      { key: "jornada", label: "Jornada", Icon: Flag, tone: "#FFFFFF", onPress: () => router.push("/jornada" as never) },
    ],
    [billsOpen, router],
  );

  /* What Willo says up top: his hello, what he noticed in the numbers, what he can do. */
  const { greeting, dateStr } = useGreeting();
  const { cards, invoices } = useCardsOverview();
  /* The one reading this screen works out for itself: which invoice is next. */
  const invoice = useMemo(() => {
    const now = new Date();
    const pending = cards
      .map((card) => {
        const rolls = now.getDate() > card.closingDay ? 1 : 0;
        const i = now.getFullYear() * 12 + now.getMonth() + rolls;
        const found = invoices.find((x) => x.cardId === card.id && x.month === (i % 12) + 1 && x.year === Math.floor(i / 12));
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
      days: Math.round((new Date(pending.due).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000),
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
          events,
          transactions: data.transactions ?? [],
          month,
          isCurrentMonth: true,
          invoice,
          hidden,
        }),
    [greeting, dateStr, firstName, data, categories, events, month, invoice, hidden],
  );
  /* The line on show, for a touch on it to open the conversation there. */
  const lineOnShow = useRef<Greeting | null>(null);
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
  const [collapsed, setCollapsed] = useState(false);
  const scrollY = useSharedValue(0);
  const folded = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      const y = e.contentOffset.y;
      scrollY.set(y);
      runOnJS(report)(y);
      /* The name comes in up top once the cards have covered most of Willo — told only when it changes. */
      const now = y > heroH * 0.55 ? 1 : 0;
      if (now !== folded.get()) {
        folded.set(now);
        runOnJS(setCollapsed)(now === 1);
      }
    },
  });
  /* It does not move. What the cards have covered is cut away from below, at the top edge of
     the first card, so none of it shows through their glass: the window it is seen through
     rises with the cards while what is in it is held still — both by moving, never by
     resizing, so nothing is laid out again as the page scrolls. What is still uncovered fades. */
  const heroWindow = useAnimatedStyle(() => ({ transform: [{ translateY: -Math.min(heroH, Math.max(0, scrollY.get())) }] }));
  const heroHeld = useAnimatedStyle(() => {
    const y = Math.min(heroH, Math.max(0, scrollY.get()));
    return { transform: [{ translateY: y }], opacity: 1 - (y / heroH) * 0.6 };
  });

  /* Willo sits behind the page, so a touch on him is taken by the page over him: it opens
     the conversation on the line on show. */
  const talk = useCallback(() => {
    const line = lineOnShow.current;
    router.push(line ? paramsForLine(line) : ("/registro" as never));
  }, [router]);
  const heroTap = useMemo(
    () =>
      Gesture.Tap()
        .maxDistance(12)
        .onEnd((_e, ok) => {
          if (ok) runOnJS(talk)();
        }),
    [talk],
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
      hidden,
      counts,
    }),
    [data, categories, month, assinaturas, assinaturasLoading, totalAssinaturas, ended, keepEnded, cancelEnded, hasGoals, hidden, counts],
  );

  /* Every card is the board's; only those with nothing to say are left off. */
  const skipWidget = useCallback((id: string) => widgetIsEmpty(id, widgetContext), [widgetContext]);

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
      {/* Willo speaking, fixed behind the page. Editing is about the board, so he stands down then. */}
      {!editing && (
        <Animated.View pointerEvents="none" style={[{ position: "absolute", top: insets.top + TOP_ROW + SHORTCUTS_H, left: 0, right: 0, height: heroH, overflow: "hidden" }, heroWindow]}>
          <Animated.View style={[{ paddingHorizontal: 16 }, heroHeld]}>
            <View onLayout={(e) => setHeroH(Math.max(120, Math.round(e.nativeEvent.layout.height)))}>
              <HomeHero
                name={firstName || null}
                slides={slides}
                onLine={(line) => {
                  lineOnShow.current = line;
                }}
              />
            </View>
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
        <View style={{ height: insets.top + TOP_ROW }} pointerEvents="none" />

        {!editing && (
          <View style={{ gap: CARD_GAP, marginBottom: 26 }}>
            <View style={{ height: SHORTCUTS_H, marginBottom: -CARD_GAP }}>
              <HomeShortcuts items={shortcuts} />
            </View>
            {/* Willo's place in the page: a touch on him opens the conversation. */}
            <GestureDetector gesture={heroTap}>
              <View
                accessible
                accessibilityRole="button"
                accessibilityLabel="Falar com o Willo"
                onAccessibilityTap={talk}
                style={{ height: heroH, marginBottom: -CARD_GAP }}
              />
            </GestureDetector>
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

      {/* Above everything: the row that stays, and the soft band the page passes under. */}
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
