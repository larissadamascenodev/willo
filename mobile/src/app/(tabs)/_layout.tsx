import { Tabs } from "expo-router";
import { Platform, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { ArrowLeftRight, House, Plus, Sparkles } from "~/components/icons";
import { INK } from "~/theme/tokens";

/**
 * The three places the app goes, and the one thing it does.
 *
 * Same three as the web — Início, Transações, Agentes — with the arch in the middle
 * for a new entry. The bar itself keeps a real blur: unlike a card, what passes
 * behind it is the page's own content scrolling by.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: "transparent" },
        tabBarActiveTintColor: "#fff",
        tabBarInactiveTintColor: INK.faint,
        tabBarStyle: {
          position: "absolute",
          borderTopWidth: 1,
          borderTopColor: "rgba(255,255,255,0.07)",
          backgroundColor: Platform.OS === "ios" ? "transparent" : "rgba(10,11,13,0.96)",
          elevation: 0,
          height: 84,
          paddingTop: 8,
        },
        tabBarBackground: () =>
          Platform.OS === "ios" ? (
            <BlurView intensity={34} tint="dark" style={{ flex: 1 }} />
          ) : null,
        tabBarLabelStyle: { fontSize: 10.5, fontWeight: "600", marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Início",
          tabBarIcon: ({ color }) => <House size={21} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="transacoes"
        options={{
          title: "Transações",
          tabBarIcon: ({ color }) => <ArrowLeftRight size={21} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="novo"
        options={{
          title: "",
          tabBarIcon: () => (
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#fff",
                marginTop: 2,
              }}
            >
              <Plus size={24} color="#0B0B0B" strokeWidth={2.6} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="agentes"
        options={{
          title: "Agentes",
          tabBarIcon: ({ color }) => <Sparkles size={21} color={color} strokeWidth={2} />,
        }}
      />
    </Tabs>
  );
}
