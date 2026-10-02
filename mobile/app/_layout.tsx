import { useEffect, useState } from "react";
import { Stack, useRouter, useSegments, useRootNavigationState } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold, useFonts } from "@expo-google-fonts/inter";
import { PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold } from "@expo-google-fonts/plus-jakarta-sans";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { MonthProvider } from "@/contexts/MonthContext";
import { ToastHost } from "~/ui";

SplashScreen.preventAutoHideAsync().catch(() => {});

/** Quem não entrou vai para a boas-vindas; quem já entrou não volta para ela. */
function SessionGate({ fontsReady }: { fontsReady: boolean }) {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const navigationReady = !!useRootNavigationState()?.key;

  useEffect(() => {
    if (!navigationReady || loading) return;
    const onPublicScreen = segments[0] === "welcome" || segments[0] === "auth";
    if (!user && !onPublicScreen) router.replace("/welcome");
    else if (user && onPublicScreen) router.replace("/");
  }, [navigationReady, loading, user, segments, router]);

  useEffect(() => {
    if (fontsReady && !loading) SplashScreen.hideAsync().catch(() => {});
  }, [fontsReady, loading]);

  return null;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  // Trocar a moeda "recarrega a página" no site; aqui remonta as telas.
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    const onReload = () => setReloadKey((k) => k + 1);
    (window as any).addEventListener("willo:reload", onReload);
    return () => (window as any).removeEventListener("willo:reload", onReload);
  }, []);

  const fontsReady = fontsLoaded || !!fontError;
  if (!fontsReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#0A1220" }}>
      <SafeAreaProvider>
        <AuthProvider>
          <MonthProvider>
            <StatusBar style="light" />
            <Stack key={reloadKey} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#0A1220" }, animation: "slide_from_right" }}>
              <Stack.Screen name="welcome" options={{ animation: "fade" }} />
              <Stack.Screen name="auth" />
              <Stack.Screen name="(tabs)" options={{ animation: "fade" }} />
              <Stack.Screen name="nova" options={{ presentation: "modal", animation: "slide_from_bottom", gestureEnabled: false }} />
            </Stack>
            <SessionGate fontsReady={fontsReady} />
            <ToastHost />
          </MonthProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
