import { Tabs } from "expo-router";
import BottomNav from "~/components/BottomNav";
import { NavChromeProvider } from "~/lib/navChrome";

/**
 * The two places the bar goes, and the screen between them.
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
          /* One screen dissolves into the next instead of cutting to it. */
          animation: "fade",
          transitionSpec: { animation: "timing", config: { duration: 260 } },
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Início" }} />
        <Tabs.Screen name="transacoes" options={{ title: "Transações" }} />
        {/* Willo has a screen of its own over the tabs (Willo, in the app's root), so
            these two are not places the bar goes. */}
        <Tabs.Screen name="agentes" options={{ title: "Agentes", href: null }} />
        <Tabs.Screen name="assistente" options={{ title: "Willo", href: null }} />
      </Tabs>
    </NavChromeProvider>
  );
}
