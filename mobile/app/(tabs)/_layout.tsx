import { Tabs } from "expo-router";
import { AddMenu } from "~/features/nav/AddMenu";
import { FloatingTabBar } from "~/features/nav/FloatingTabBar";

export default function TabsLayout() {
  return (
    <>
      <Tabs tabBar={(props) => <FloatingTabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: "#0A1220" } }}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="transacoes" />
      </Tabs>
      <AddMenu />
    </>
  );
}
