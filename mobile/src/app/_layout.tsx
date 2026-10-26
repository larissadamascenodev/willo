import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { installShims, hydrateShims } from "~/lib/shims";
import { AuthProvider } from "~/lib/auth";
import { MonthProvider } from "@/contexts/MonthContext";
import { GREEN, GROUND } from "~/theme/tokens";

/* Before any shared module is imported for real, the handful of browser things it
   expects have to exist. */
installShims();

/**
 * The shell.
 *
 * It opens straight into the app. The sign-in screen is still here and still works,
 * but it is a place you can go rather than a gate you have to pass — while the
 * screens are being rebuilt, being stopped at the door on every reload costs more
 * than it protects. It goes back to being a gate when the app is whole.
 *
 * Nothing draws until the stored keys are in memory, because the shared code reads
 * them without waiting and would otherwise see a brand-new app on every launch.
 */
export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    hydrateShims().finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: GROUND }}>
        <ActivityIndicator color={GREEN} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: GROUND }}>
      <SafeAreaProvider>
        <AuthProvider>
          {/* Which month the screens are reading. Shared with the web, which has no
              browser in it — just the month and a way to change it. */}
          <MonthProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: GROUND },
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="login" options={{ presentation: "modal" }} />
            <Stack.Screen name="eventos" />
            <Stack.Screen name="cartoes" />
            <Stack.Screen name="fatura/[cardId]" />
            <Stack.Screen name="gestao" />
            <Stack.Screen name="parcelamentos" />
            <Stack.Screen name="conta/[accountId]" />
            <Stack.Screen name="detalhe/[tipo]" />
            <Stack.Screen name="categorias" />
            <Stack.Screen name="metas" />
            <Stack.Screen name="metas/[goalId]" />
            <Stack.Screen name="fluxo-de-caixa" />
            <Stack.Screen name="analytics/categorias" />
            <Stack.Screen name="analytics/categoria/[nome]" />
            {/* Comes up from the foot of the screen, but as a screen rather than a card:
                the modal presentation insets its own content, which on a form that is
                already full width shows up as a left edge cut off. */}
            <Stack.Screen name="novo" options={{ animation: "slide_from_bottom" }} />
            {/* Registro rápido and the receipt camera come up the same way: they are
                where the add button leads, and both hand over to the form. */}
            <Stack.Screen name="registro" options={{ animation: "slide_from_bottom" }} />
            <Stack.Screen name="scanner" options={{ animation: "fade", contentStyle: { backgroundColor: "#000" } }} />
          </Stack>
          </MonthProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
