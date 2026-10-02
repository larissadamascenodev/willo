import { Pressable, View } from "react-native";
import type { ComponentProps } from "react";
import { useRouter, type Tabs } from "expo-router";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeftRight, Home, ScanLine, Sparkles } from "lucide-react-native";
import { Glass, white } from "~/ui";

/** As propriedades que o navegador de abas entrega à barra. */
type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

const ITEMS = [
  { route: "index", label: "Início", Icon: Home },
  { route: "transacoes", label: "Transações", Icon: ArrowLeftRight },
  { route: "assistente", label: "Assistente", Icon: Sparkles, soon: true },
] as const;

/**
 * A barra flutuante do site: uma pílula de vidro com as abas e, ao lado, o botão redondo
 * do scanner. O "Assistente" aparece com o pontinho verde de "em breve" e ainda não abre.
 */
export function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const activeRoute = state.routes[state.index]?.name;

  return (
    <View
      pointerEvents="box-none"
      style={{ position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 20, paddingBottom: insets.bottom + 14 }}
    >
      <Glass radius={999} style={{ flex: 1, maxWidth: 250 }}>
        <View style={{ height: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingHorizontal: 6 }}>
          {ITEMS.map((item) => {
            const active = activeRoute === item.route;
            const soon = "soon" in item && item.soon;
            return (
              <Pressable
                key={item.route}
                accessibilityLabel={soon ? `${item.label} — em breve` : item.label}
                accessibilityState={{ selected: active }}
                onPress={() => {
                  if (soon || active) return;
                  Haptics.selectionAsync().catch(() => {});
                  navigation.navigate(item.route);
                }}
                style={{ flex: 1, height: 44, marginHorizontal: 2, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: active ? white(0.18) : "transparent" }}
              >
                <item.Icon size={20} color={active ? "#fff" : soon ? white(0.38) : white(0.62)} strokeWidth={active ? 2.25 : 2} />
                {soon && <View style={{ position: "absolute", top: 2, right: 8, width: 6, height: 6, borderRadius: 3, backgroundColor: "#C8F36D" }} />}
              </Pressable>
            );
          })}
        </View>
      </Glass>

      <Pressable accessibilityLabel="Escanear" onPress={() => router.push("/nova")} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
        <Glass radius={29} style={{ width: 58, height: 58, alignItems: "center", justifyContent: "center" }}>
          <ScanLine size={25} color="#fff" strokeWidth={2} />
        </Glass>
      </Pressable>
    </View>
  );
}
