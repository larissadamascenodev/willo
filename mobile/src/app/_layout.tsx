import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { installShims, hydrateShims } from "~/lib/shims";
import { loadChatFonts } from "~/lib/chatFont";
import { AuthProvider, useAuth } from "~/lib/auth";
import { useApplyOnboarding } from "~/lib/onboarding";
import { MonthProvider } from "@/contexts/MonthContext";
import ToastHost from "~/components/ToastHost";
import LaunchIntro from "~/components/LaunchIntro";
import { markIntroDone } from "~/lib/launchIntro";
import NotificationBridge from "~/lib/NotificationBridge";
import { GREEN, GROUND } from "~/theme/tokens";
import { LIGHT_GROUND, setActiveTheme, takeReturnRoute, th, useThemePref } from "~/theme/theme";

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

function Door() {
  const { session, loading } = useAuth();
  useApplyOnboarding();

  /* Light only inside the app: the welcome, sign-in and sign-up are always dark. Set
     before anything below draws, so every colour is read for the right theme. */
  const [pref] = useThemePref();
  const mode = !loading && session ? pref : "dark";
  setActiveTheme(mode);

  /* Changing the theme draws the screens again from scratch. A veil in the new
     ground covers the swap, and the person is put back on the profile, where the
     choice was made. */
  const router = useRouter();
  const veil = useSharedValue(0);
  const first = useRef(true);
  const [quiet, setQuiet] = useState(false);
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    veil.set(1);
    veil.set(withDelay(260, withTiming(0, { duration: 460, easing: Easing.out(Easing.cubic) })));
    const back = takeReturnRoute();
    if (back) {
      setQuiet(true);
      requestAnimationFrame(() => router.push(back as never));
      const id = setTimeout(() => setQuiet(false), 700);
      return () => clearTimeout(id);
    }
  }, [mode, veil, router]);
  const veilStyle = useAnimatedStyle(() => ({ opacity: veil.get() }));

  if (loading) return <Splash />;
  const signedIn = !!session;

  return (
    <>
    <StatusBar style={mode === "light" ? "dark" : "light"} />
    <NotificationBridge userId={signedIn ? (session?.user?.id ?? null) : null} />
    <Stack
      key={mode}
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
        <Stack.Screen name="perfil" options={{ animation: quiet ? "none" : "default" }} />
        <Stack.Screen name="fundo-foto" options={{ animation: "slide_from_bottom" }} />
        <Stack.Screen name="notificacoes" />
        <Stack.Screen name="notificacoes-ajustes" />
        <Stack.Screen name="desafios" />
        <Stack.Screen name="radar" />
        <Stack.Screen name="desafio/[id]" />
        {/* Comes up from the foot of the screen, but as a screen rather than a card:
            the modal presentation insets its own content, which on a form that is
            already full width shows up as a left edge cut off. */}
        <Stack.Screen name="novo" options={{ animation: "slide_from_bottom" }} />
        {/* Registro rápido and the receipt camera come up the same way: they are
            where the add button leads, and both hand over to the form. */}
        <Stack.Screen name="registro" options={{ animation: "slide_from_bottom" }} />
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
    <Animated.View
      pointerEvents="none"
      style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: mode === "light" ? LIGHT_GROUND : GROUND }, veilStyle]}
    />
    </>
  );
}
