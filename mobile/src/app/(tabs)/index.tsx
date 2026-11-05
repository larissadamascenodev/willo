import { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, RefreshControl, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
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
import ProfileSheet from "~/components/ProfileSheet";
import Stories from "~/components/home/Stories";
import OrbHero, { ORB_HERO_BODY, paramsForLine, WilloGlow } from "~/components/home/OrbHero";
import type { Greeting } from "~/lib/greeting";
import SaldoHero, { SALDO_HERO_BODY, SALDO_HERO_TOP } from "~/components/home/SaldoHero";
import { useHomeHero } from "~/lib/homeHero";
import WidgetBoard from "~/components/home/WidgetBoard";
import EditBar from "~/components/home/EditBar";
import { renderHomeWidget, widgetIsEmpty } from "~/components/home/HomeWidgets";
import { useRecorrentes } from "@/hooks/useRecorrentes";
import { useEndedSubscriptions } from "~/lib/subscriptionCheck";
import { useAuth } from "~/lib/auth";
import { useNavChrome } from "~/lib/navChrome";
import { INK } from "~/theme/tokens";

const AnimatedBlur = Animated.createAnimatedComponent(BlurView);

/** How far the page travels before the pinned block has fully receded. */
const PIN_TRAVEL = 190;
/** The sphere is taller, so it takes longer to go. */
const ORB_TRAVEL = 270;
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
 * What is pinned is one of three, to be tried against each other: the stories; the
 * robot — Willo floating, saying the same readings one at a time, and the quickest
 * way into Registro rápido; or the balance alone, written on the background with no
 * card around it, the card it replaces leaving the board so the others move up into
 * its place. Which is chosen from the avatar's sheet.
 *
 * The greeting is not a heading here: it is the first of the readings. The name
 * only appears in the row at the top once the block has receded far enough that
 * reading the greeting is no longer the point.
 */
export default function Home() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
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
  const [profileOpen, setProfileOpen] = useState(false);

  const today = useMemo(() => new Date(), []);
  const month = today.getMonth();
  const year = today.getFullYear();

  const { data, refetch } = useFinanceData(month, year, { includeHistorical: false });
  const { profile } = useProfile();
  const { cards, invoices } = useCardsOverview();
  const { assinaturas, totalAssinaturas } = useRecorrentes();
  const { ended, keep: keepEnded, cancel: cancelEnded } = useEndedSubscriptions(user?.id);

  const name = profile?.display_name || user?.email?.split("@")[0] || "";
  const firstName = name.trim().split(" ")[0] ?? "";

  const [hero] = useHomeHero();
  const orbHero = hero === "orb";
  const saldoHero = hero === "saldo";
  const lineOnShow = useRef<Greeting | null>(null);
  const travel = orbHero ? ORB_TRAVEL : PIN_TRAVEL;

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

  const pinnedStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value * 0.78,
    transform: [{ scale: 1 - progress.value * 0.035 }],
  }));

  /* The sphere sits above the page, so the cards cannot pass over it the way they do
     the stories; it is gone before they reach it instead. */
  const orbStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - progress.value * 1.7),
    transform: [{ translateY: -progress.value * 26 }, { scale: 1 - progress.value * 0.06 }],
  }));

  const glowStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.value * 0.6 }));

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

  /* With the balance on the background, its card would only say it twice. */
  const skipWidget = useCallback(
    (id: string) => (saldoHero && id === "saldo") || widgetIsEmpty(id, widgetContext),
    [widgetContext, saldoHero],
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
  /* Under the header, so neither the sphere nor the readings touch its icons. */
  const pinnedTop = insets.top + 72;
  const pinnedHeight = pinnedTop + (orbHero ? ORB_HERO_BODY : saldoHero ? SALDO_HERO_BODY : PINNED_BODY);

  return (
    <Room lit sky>
      {/* Pinned. It does not scroll; it recedes. Once it has gone far enough it
          stops taking taps, since by then you cannot read what you would tap. */}
      {/* Editing is about the board, so the readings stand down for it — leaving
          them pinned behind an opaque bar only means drawing them to be covered. */}
      {/* Willo's light, behind everything, so the same ground holds the robot and the
          balance and the cards rise through it. */}
      {!editing && (orbHero || saldoHero) && (
        <Animated.View pointerEvents="none" style={[{ position: "absolute", top: 0, left: 0, right: 0 }, glowStyle]}>
          <WilloGlow height={pinnedHeight + 220} />
        </Animated.View>
      )}

      {!editing && !orbHero && (
        <Animated.View
          pointerEvents="box-none"
          style={[
            { position: "absolute", left: 0, right: 0, top: pinnedTop, paddingHorizontal: 16 },
            pinnedStyle,
          ]}
        >
          {saldoHero ? <SaldoHero saldoPrevisto={data.saldoPrevisto} hidden={hidden} slides={slides} onLine={(line) => (lineOnShow.current = line)} /> : <Stories slides={slides} />}
        </Animated.View>
      )}

      {!editing && !orbHero && (
      <AnimatedBlur
        tint="dark"
        animatedProps={blurProps}
        pointerEvents="none"
        style={[
          { position: "absolute", left: 0, right: 0, top: 0, height: pinnedHeight },
          blurStyle,
        ]}
      />
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
            tintColor={INK.softer}
            progressViewOffset={insets.top + 40}
          />
        }
      >
        {/* Holds the room the pinned block would have taken, so the first card
            starts where it would have — and travels up over it from there. */}
        {/* The balance lies under the scroller, so its taps are taken here, in the room held
            for it: a drag that starts on it still moves the page. The figures open the
            accounts, and what he is saying opens the conversation about it. */}
        {saldoHero && !editing ? (
          <View style={{ height: pinnedHeight }}>
            <Pressable
              onPress={() => router.push("/gestao")}
              accessibilityRole="button"
              accessibilityLabel="Abrir contas"
              style={{ height: pinnedTop + SALDO_HERO_TOP }}
            />
            <Pressable
              onPress={() => lineOnShow.current && router.push(paramsForLine(lineOnShow.current))}
              accessibilityRole="button"
              accessibilityLabel="Conversar com o Willo sobre isso"
              style={{ flex: 1 }}
            />
          </View>
        ) : (
          <View style={{ height: editing ? insets.top + 86 : pinnedHeight }} pointerEvents="none" />
        )}

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
      {!editing && orbHero && (
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
        onProfile={() => setProfileOpen(true)}
      />
      <ProfileSheet open={profileOpen} onClose={() => setProfileOpen(false)} name={name} avatarUrl={profile?.avatar_url} />
      <EditBar open={editing} onDone={() => setEditing(false)} />
    </Room>
  );
}
