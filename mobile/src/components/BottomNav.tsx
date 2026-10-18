import { Pressable, Text, View, useWindowDimensions } from "react-native";
import Animated, { LinearTransition, FadeIn, FadeOut } from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BotMark from "~/components/BotMark";
import { ArrowLeftRight, House, Mic, Sparkles, Zap } from "~/components/icons";
import { useNavChrome } from "~/lib/navChrome";
import { GREEN, INK } from "~/theme/tokens";

/**
 * The row at the foot of the screen.
 *
 * Three separate things, the way the web has them: Início on one end, Willo on the
 * other, and the invitation between — its own piece of glass rather than a slot
 * carved out of one long bar. Above them, while the page is still at rest, the same
 * invitation spread across the full width.
 *
 * The row is a budget. Open, the ends can afford to be big and the icons grow to
 * fill the pill edge to edge; folded, the invitation needs the middle, so the two
 * ends give up height and width to pay for it.
 */

const ITEMS = [
  { name: "index", label: "Início", icon: House },
  { name: "transacoes", label: "Transações", icon: ArrowLeftRight },
  { name: "agentes", label: "Agentes", icon: Sparkles },
];

const FLOAT = {
  backgroundColor: "rgba(34,34,36,0.82)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.08)",
} as const;

/* Only the three things the bar actually reads. Typed here rather than imported,
   because the navigator ships inside expo-router and its package is not a dependency
   of ours to reach into. */
interface TabBarProps {
  state: { index: number; routes: { name: string }[] };
  navigation: { navigate: (name: never) => void };
}

export default function BottomNav({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { collapsed, holdOpen } = useNavChrome();

  const active = state.routes[state.index]?.name ?? "index";
  const shown = collapsed ? ITEMS.slice(0, 1) : ITEMS;

  const end = collapsed ? 50 : 58;
  /* Open, the nav takes everything the other two leave: Willo's end and both gaps. */
  const navWidth = collapsed ? end : width - 40 - end - 20;

  const go = (name: string) => {
    if (name === active) {
      holdOpen();
      return;
    }
    navigation.navigate(name as never);
  };

  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 20,
        paddingBottom: insets.bottom + 14,
      }}
      pointerEvents="box-none"
    >
      {!collapsed && (
        <Animated.View entering={FadeIn.duration(260)} exiting={FadeOut.duration(200)}>
          <Pressable
            style={[
              FLOAT,
              {
                height: 46,
                marginBottom: 10,
                borderRadius: 999,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingLeft: 14,
                paddingRight: 16,
                overflow: "hidden",
              },
            ]}
          >
            <Zap size={19} color={GREEN} />
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 14.5, color: INK.soft }}>
              Registro rápido
            </Text>
            <Mic size={17} color={INK.faint} />
          </Pressable>
        </Animated.View>
      )}

      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Animated.View
          layout={LinearTransition.duration(420)}
          style={[
            FLOAT,
            { width: navWidth, height: end, borderRadius: 999, overflow: "hidden" },
          ]}
        >
          <BlurView intensity={26} tint="dark" style={{ flex: 1 }}>
            <View
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-around",
                paddingHorizontal: 6,
              }}
            >
              {shown.map((item) => {
                const on = item.name === active;
                const Icon = item.icon;
                return (
                  <Pressable
                    key={item.name}
                    onPress={() => go(item.name)}
                    accessibilityLabel={item.label}
                    style={{
                      flex: collapsed ? 1 : undefined,
                      height: collapsed ? "100%" : 44,
                      width: collapsed ? "100%" : undefined,
                      flexGrow: collapsed ? 1 : 1,
                      marginHorizontal: 2,
                      borderRadius: 999,
                      alignItems: "center",
                      justifyContent: "center",
                      /* A highlight behind the icon only while the nav is a long pill.
                         Folded, the nav IS a circle, so a circle inside it would be a
                         second ring around the same thing. */
                      backgroundColor: on && !collapsed ? "rgba(255,255,255,0.10)" : "transparent",
                    }}
                  >
                    <Icon
                      size={collapsed ? 21 : 23}
                      color={on ? GREEN : "rgba(255,255,255,0.45)"}
                      strokeWidth={on ? 2.25 : 2}
                    />
                  </Pressable>
                );
              })}
            </View>
          </BlurView>
        </Animated.View>

        {collapsed && (
          <Animated.View
            entering={FadeIn.duration(300)}
            exiting={FadeOut.duration(160)}
            layout={LinearTransition.duration(420)}
            style={{ flex: 1 }}
          >
            <Pressable
              style={[
                FLOAT,
                {
                  height: 50,
                  borderRadius: 999,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  paddingLeft: 14,
                  paddingRight: 16,
                  overflow: "hidden",
                },
              ]}
            >
              <Zap size={17} color={GREEN} />
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 13.5, color: INK.soft }}>
                Registro rápido
              </Text>
              <Mic size={15} color={INK.faint} />
            </Pressable>
          </Animated.View>
        )}

        <Pressable
          onPress={() => navigation.navigate("assistente" as never)}
          accessibilityLabel="Willo"
          style={({ pressed }) => ({
            width: end,
            height: end,
            alignItems: "center",
            justifyContent: "center",
            transform: [{ scale: pressed ? 0.95 : 1 }],
          })}
        >
          <BotMark size={end} />
        </Pressable>
      </View>
    </View>
  );
}
