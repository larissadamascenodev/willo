import { Tabs } from "expo-router";
import BottomNav from "~/components/BottomNav";
import { NavChromeProvider } from "~/lib/navChrome";
import { useThemeRedraw } from "~/theme/theme";

/**
 * The two places the bar goes, and the screen between them.
 *
 * The bar itself is drawn rather than configured — the web's is a floating pill with
 * Willo beside it, not a row of tabs, and a tab bar cannot be talked into that shape.
 * The navigator still owns the routes and which one is current; the bar only reads it.
 */
export default function TabsLayout() {
  /* Drawn again in place when the theme changes. */
  useThemeRedraw();
  return (
    <NavChromeProvider>
      <Tabs
        tabBar={(props) => <BottomNav {...props} />}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: "transparent" },
          /* One screen gives way to the next sideways — Transações from the right of
             Início, Início from the left — dissolving as it moves, on a spring. */
          animation: "shift",
          transitionSpec: { animation: "spring", config: { stiffness: 260, damping: 30, mass: 1 } },
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
