import { Tabs } from "expo-router";
import BottomNav from "~/components/BottomNav";
import { NavChromeProvider } from "~/lib/navChrome";

/**
 * The three places the app goes, and the one thing it does.
 *
 * The bar itself is drawn rather than configured — the web's is a floating pill with
 * Willo beside it, not a row of tabs, and a tab bar cannot be talked into that shape.
 * The navigator still owns the routes and which one is current; the bar only reads it.
 */
export default function TabsLayout() {
  return (
    <NavChromeProvider>
      <Tabs
        tabBar={(props) => <BottomNav {...props} />}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: "transparent" },
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Início" }} />
        <Tabs.Screen name="transacoes" options={{ title: "Transações" }} />
        <Tabs.Screen name="agentes" options={{ title: "Agentes" }} />
        <Tabs.Screen name="assistente" options={{ title: "Willo" }} />
      </Tabs>
    </NavChromeProvider>
  );
}
