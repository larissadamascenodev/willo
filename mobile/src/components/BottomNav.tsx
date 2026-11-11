import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Glass from "~/components/Glass";
import ParticleOrb from "~/components/registro/ParticleOrb";
import { ArrowLeftRight, House } from "~/components/icons";

import { th } from "~/theme/theme";

/**
 * The row at the foot of the screen.
 *
 * One long piece of glass holding the places — Início, Transações — and, apart from
 * it, a round one with Willo's sphere. The place you are is a lit capsule inside the
 * long glass, with its glyph and its name; the others show their name alone. Moving
 * between them, the capsule slides across to the new one.
 *
 * Willo's screen sits over the tabs rather than among them, because it has a bar of
 * its own to type into and two bars at the foot would be one too many.
 */

const SIZE = 58;
const INSET = 5;
const GAP = 10;

const PLACES = [
  { name: "index", label: "Início", icon: House },
  { name: "transacoes", label: "Transações", icon: ArrowLeftRight },
] as const;

/* Only the two things the bar actually reads. Typed here rather than imported,
   because the navigator ships inside expo-router and its package is not a dependency
   of ours to reach into. Since SDK 58 the navigator moves between tabs by a route's
   key rather than its name, so the bar looks the key up from the name it knows. */
interface TabBarProps {
  state: { index: number; routes: { key: string; name: string }[] };
  navigateToTab: (routeKey: string) => void;
}

export default function BottomNav({ state, navigateToTab }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const active = state.routes[state.index]?.name ?? "index";
  const at = Math.max(0, PLACES.findIndex((p) => p.name === active));

  /* How wide one place is, once the glass has been laid out; the capsule is that wide. */
  const [slot, setSlot] = useState(0);
  const x = useSharedValue(0);
  useEffect(() => {
    x.set(withSpring(at * slot, { duration: 460, dampingRatio: 0.82, reduceMotion: ReduceMotion.System }));
  }, [at, slot, x]);
  const capsule = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

  const open = (name: string) => {
    void Haptics.selectionAsync().catch(() => undefined);
    const key = state.routes.find((r) => r.name === name)?.key;
    if (key && name !== active) navigateToTab(key);
  };

  const lit = th("rgba(255,255,255,0.16)", "bg");
  const rim = th("rgba(255,255,255,0.22)", "line");
  const ink = th("#fff");
  const soft = th("rgba(255,255,255,0.62)");

  return (
    <View
      pointerEvents="box-none"
      style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingBottom: insets.bottom + 12 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: GAP }}>
        {/* The places. */}
        <Glass radius={SIZE / 2} style={{ flex: 1, height: SIZE, padding: INSET }}>
          <View style={{ flex: 1, flexDirection: "row" }} onLayout={(e) => setSlot(e.nativeEvent.layout.width / PLACES.length)}>
            {slot > 0 && (
              <Animated.View
                pointerEvents="none"
                style={[
                  {
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: 0,
                    width: slot,
                    borderRadius: (SIZE - INSET * 2) / 2,
                    borderCurve: "continuous",
                    borderWidth: 1,
                    borderColor: rim,
                    backgroundColor: lit,
                  },
                  capsule,
                ]}
              />
            )}
            {PLACES.map(({ name, label, icon: Icon }) => {
              const on = name === active;
              return (
                <Pressable
                  key={name}
                  onPress={() => open(name)}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityState={{ selected: on }}
                  style={({ pressed }) => ({
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 7,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  {on && <Icon size={19} color={ink} strokeWidth={2.4} />}
                  <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: on ? "700" : "600", letterSpacing: -0.2, color: on ? ink : soft }}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Glass>

        {/* Willo, apart. */}
        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
            router.push("/registro" as never);
          }}
          accessibilityRole="button"
          accessibilityLabel="Converse com o Willo"
          style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.94 : 1 }] })}
        >
          <Glass radius={SIZE / 2} style={{ width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" }}>
            <View style={{ width: SIZE - 10, height: SIZE - 10, borderRadius: (SIZE - 10) / 2, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
              <ParticleOrb size={SIZE - 14} density={160} />
            </View>
          </Glass>
        </Pressable>
      </View>
    </View>
  );
}
