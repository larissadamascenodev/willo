import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, View, useWindowDimensions } from "react-native";
import { Stack } from "expo-router";
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { StatusBar } from "expo-status-bar";
import Svg, { ClipPath, Defs, Image as SvgImage, Path, Rect } from "react-native-svg";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { installShims, hydrateShims } from "~/lib/shims";
import { loadChatFonts } from "~/lib/chatFont";
import { warmWilloBot } from "~/components/willo/WilloBot";
import { AuthProvider, useAuth } from "~/lib/auth";
import { useApplyOnboarding } from "~/lib/onboarding";
import { MonthProvider } from "@/contexts/MonthContext";
import ToastHost from "~/components/ToastHost";
import LaunchIntro from "~/components/LaunchIntro";
import { markIntroDone } from "~/lib/launchIntro";
import NotificationBridge from "~/lib/NotificationBridge";
import { GREEN, GROUND } from "~/theme/tokens";
import { COVER_GROW_MS, LIGHT_GROUND, endThemeReveal, liftThemeCover, markShotReady, setActiveTheme, takeReturnRoute, th, useThemeCover, useThemePref, useThemeReveal, useThemeShot } from "~/theme/theme";

/* Before any shared module is imported for real, the handful of browser things it
   expects have to exist. */
installShims();

/**
 * The shell.
 *
 * It is a door. Without a session the only screens that exist are the welcome, the
 * questions for someone new, and sign-in; with one, the app. The two sets are never
 * both reachable, so a person who signs out is taken back to the welcome and one
 * who signs in is taken into the app, without any screen having to ask which it is.
 *
 * Nothing draws until the stored keys are in memory, because the shared code reads
 * them without waiting and would otherwise see a brand-new app on every launch — and
 * not until the stored session has been read, or a signed-in person would see the
 * welcome flash by on every launch.
 */
/* Once per launch: coming back to the app from the background does not replay it. */
let introPlayed = false;

export default function RootLayout() {
  const [intro, setIntro] = useState(!introPlayed);

  return (
    <View style={{ flex: 1, backgroundColor: th(GROUND, "bg") }}>
      <Shell />
      {intro && (
        <LaunchIntro
          onDone={() => {
            introPlayed = true;
            markIntroDone();
            setIntro(false);
          }}
        />
      )}
    </View>
  );
}

/* The app gets itself ready under the intro, so by the time it fades the first
   screen is already there. */
function Shell() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void loadChatFonts();
    /* Willo's pictures, both themes, ready before he is first drawn. */
    void warmWilloBot();
    hydrateShims().finally(() => setReady(true));
  }, []);

  if (!ready) return <Splash />;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: th(GROUND, "bg") }}>
      <SafeAreaProvider>
        <AuthProvider>
          {/* Which month the screens are reading. Shared with the web, which has no
              browser in it — just the month and a way to change it. */}
          <MonthProvider>
            <Door />
            <ToastHost />
          </MonthProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Splash() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: th(GROUND, "bg") }}>
      <ActivityIndicator color={th(GREEN)} />
    </View>
  );
}

const AnimatedPath = Animated.createAnimatedComponent(Path);


function Door() {
  const { session, loading } = useAuth();
  useApplyOnboarding();

  /* Light only inside the app: the welcome, sign-in and sign-up are always dark. Set
     before anything below draws, so every colour is read for the right theme. */
  const [pref] = useThemePref();
  const mode = !loading && session ? pref : "dark";
  setActiveTheme(mode);

  /* Changing the theme: the moment a theme is tapped, a circle in its ground grows from
     the finger until it covers the screen (on the UI thread, so nothing delays it); the
     screens are drawn again under it; then it clears off them. The person is put back
     on the profile, where the choice was made. */
  const coverTo = useThemeCover();
  const first = useRef(true);
  const { width: W, height: H } = useWindowDimensions();
  const grow = useSharedValue(0);
  const clear = useSharedValue(1);
  useLayoutEffect(() => {
    if (!coverTo) return;
    clear.set(1);
    grow.set(0);
    grow.set(withTiming(1, { duration: COVER_GROW_MS, easing: Easing.inOut(Easing.cubic) }));
  }, [coverTo, grow, clear]);
  /* The photograph's hole, growing from the finger. */
  const themeShot = useThemeShot();
  const revealAt = useThemeReveal();
  const hole = useSharedValue(0);
  const holeX = useSharedValue(W / 2);
  const holeY = useSharedValue(H / 2);
  /* The reveal starts the moment the photograph is up — at the touch — not once the
     screens have been drawn again: under the first, slow part of the opening the circle
     is still small, and the screens are drawn in the new theme in that time. It ends once
     both the opening is done and the screens are drawn. */
  const swappedRef = useRef(false);
  /* Until the screens are drawn in the new theme, the opening shows its ground. */
  const [awaitingSwap, setAwaitingSwap] = useState(false);
  const openedRef = useRef(false);
  const finishReveal = () => {
    if (!swappedRef.current || !openedRef.current) return;
    swappedRef.current = false;
    openedRef.current = false;
    endThemeReveal();
    hole.set(0);
  };
  useLayoutEffect(() => {
    if (!revealAt) return;
    setAwaitingSwap(true);
    swappedRef.current = false;
    openedRef.current = false;
    holeX.set(revealAt.x);
    holeY.set(revealAt.y);
    hole.set(0);
    const reachOut = Math.hypot(Math.max(revealAt.x, W - revealAt.x), Math.max(revealAt.y, H - revealAt.y)) + 8;
    /* Unhurried: it starts softly from the finger, opens, and settles. */
    hole.set(withTiming(reachOut, { duration: 950, easing: Easing.bezier(0.42, 0, 0.25, 1) }));
    const id = setTimeout(() => {
      openedRef.current = true;
      finishReveal();
    }, 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealAt]);
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (revealAt) {
      /* The screens are drawn in the new theme under the opening photograph. */
      swappedRef.current = true;
      setAwaitingSwap(false);
      finishReveal();
    } else {
      /* The screens are drawn again in place under the circle; a frame, then it clears off them. */
      requestAnimationFrame(() => {
        clear.set(withTiming(0, { duration: 260, easing: Easing.out(Easing.quad) }));
        setTimeout(liftThemeCover, 280);
      });
    }
    /* The screens stay where they are now (drawn again in place), so nothing is reopened. */
    takeReturnRoute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);
  const circleStyle = useAnimatedStyle(() => ({ opacity: clear.get(), transform: [{ scale: Math.max(0.001, grow.get()) }] }));
  /* The whole screen, less a circle: drawn with the even-odd rule, the circle is a hole. */
  const holeProps = useAnimatedProps(() => {
    const r = hole.get();
    const x = holeX.get();
    const y = holeY.get();
    return { d: `M0 0H${W}V${H}H0Z M${x - r} ${y} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0Z` };
  });
  /* Far enough from the finger to reach the farthest corner. */
  const cx = coverTo?.x ?? W / 2;
  const cy = coverTo?.y ?? H / 2;
  const reach = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) + 12;

  if (loading) return <Splash />;
  const signedIn = !!session;

  return (
    <>
    <StatusBar style={mode === "light" ? "dark" : "light"} />
    <NotificationBridge userId={signedIn ? (session?.user?.id ?? null) : null} />
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: th(GROUND, "bg") },
      }}
    >
      <Stack.Protected guard={signedIn} redirectTo="/bem-vindo">
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="eventos" />
        <Stack.Screen name="cartoes" />
        <Stack.Screen name="fatura/[cardId]" />
        <Stack.Screen name="gestao" />
        <Stack.Screen name="parcelamentos" />
        <Stack.Screen name="conta/[accountId]" />
        <Stack.Screen name="detalhe/[tipo]" />
        <Stack.Screen name="categorias" />
        <Stack.Screen name="metas/[goalId]" />
        <Stack.Screen name="fluxo-de-caixa" />
        <Stack.Screen name="analytics/categorias" />
        <Stack.Screen name="analytics/categoria/[nome]" />
        <Stack.Screen name="perfil" />
        <Stack.Screen name="fundo-foto" options={{ animation: "slide_from_bottom" }} />
        <Stack.Screen name="notificacoes" />
        <Stack.Screen name="notificacoes-ajustes" />
        <Stack.Screen name="desafios" />
        <Stack.Screen name="conquistas" />
        <Stack.Screen name="radar" />
        <Stack.Screen name="desafio/[id]" />
        {/* Comes up from the foot of the screen, but as a screen rather than a card:
            the modal presentation insets its own content, which on a form that is
            already full width shows up as a left edge cut off. */}
        <Stack.Screen name="novo" options={{ animation: "slide_from_bottom" }} />
        {/* Registro rápido and the receipt camera come up the same way: they are
            where the add button leads, and both hand over to the form. */}
        {/* Willo comes in the way Início and Transações change places: a short dissolve, its content rising into it. */}
        <Stack.Screen name="registro" options={{ animation: "fade", animationDuration: 260 }} />
        <Stack.Screen name="rapido" options={{ presentation: "transparentModal", animation: "none", contentStyle: { backgroundColor: "transparent" } }} />
        <Stack.Screen name="manual" options={{ presentation: "transparentModal", animation: "none", contentStyle: { backgroundColor: "transparent" } }} />
        <Stack.Screen name="scanner" options={{ animation: "fade", contentStyle: { backgroundColor: th("#000", "bg") } }} />
      </Stack.Protected>

      <Stack.Protected guard={!signedIn} redirectTo="/">
        <Stack.Screen name="bem-vindo" options={{ animation: "fade" }} />
        <Stack.Screen name="comecar" />
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
    {/* The photograph waiting for the next change: loaded out of sight, so it is ready at the touch. */}
    {themeShot.uri && themeShot.uri !== themeShot.ready && (
      <Image source={{ uri: themeShot.uri }} fadeDuration={0} onLoad={() => markShotReady(themeShot.uri as string)} style={{ position: "absolute", width: 1, height: 1, opacity: 0 }} />
    )}
    {/* Kept mounted (and so decoded) while it waits, unseen; shown at the touch. */}
    {themeShot.ready && (
      /* Drawn as one picture: the photograph, clipped to the screen less a circle. The
         clip is redrawn on every frame of the animation, so the circle opens smoothly. */
      /* In front of everything, explicitly: without it the native screens can be drawn
         over it, and a dark screen, being opaque, hid the change entirely. */
      <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, width: W, height: H, zIndex: 9999, elevation: 9999, opacity: revealAt ? 1 : 0 }}>
        <Svg width={W} height={H}>
          <Defs>
            <ClipPath id="theme-hole">
              <AnimatedPath animatedProps={holeProps} clipRule="evenodd" />
            </ClipPath>
          </Defs>
          {/* The new theme's ground, in the opening, for the moment before its screens are drawn. */}
          {awaitingSwap && revealAt && <Rect x={0} y={0} width={W} height={H} fill={revealAt.to === "light" ? LIGHT_GROUND : GROUND} />}
          <SvgImage href={{ uri: themeShot.ready }} x={0} y={0} width={W} height={H} preserveAspectRatio="xMidYMid slice" clipPath="url(#theme-hole)" />
        </Svg>
      </View>
    )}
    {coverTo && (
      <Animated.View
        pointerEvents="none"
        style={[
          { position: "absolute", left: cx - reach, top: cy - reach, width: reach * 2, height: reach * 2, borderRadius: reach, zIndex: 9999, elevation: 9999, backgroundColor: coverTo.to === "light" ? LIGHT_GROUND : GROUND },
          circleStyle,
        ]}
      />
    )}
    </>
  );
}
