import { useEffect, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Glass from "~/components/Glass";
import ParticleOrb from "~/components/registro/ParticleOrb";
import { ArrowLeftRight, House, Plus } from "~/components/icons";

import { th } from "~/theme/theme";
/**
 * The row at the foot of the screen.
 *
 * Two pieces of glass, side by side in the middle: a long one with Início,
 * Transações and a plus that opens Adicionar manualmente in its sheet, and a round
 * one, apart, with Willo's sphere.
 *
 * The place you are is a lit capsule inside the long glass. Moving between Início and
 * Transações the capsule slides across on a spring, stretching a little on the way,
 * and the glyph it arrives at firms up and pops while the one it left goes soft.
 *
 * Willo's screen sits over the tabs rather than among them, because it has a bar of
 * its own to type into and two bars at the foot would be one too many.
 */

const SIZE = 50;
const INSET = 3;
const INNER = SIZE - INSET * 2;
/** One button in the long glass, and the space between two of them. */
const SLOT = INNER + 14;
const SLOT_GAP = 2;

const SPRING = { duration: 480, dampingRatio: 0.78, reduceMotion: ReduceMotion.System } as const;

/* Only the two things the bar actually reads. Typed here rather than imported,
   because the navigator ships inside expo-router and its package is not a dependency
   of ours to reach into. Since SDK 58 the navigator moves between tabs by a route's
   key rather than its name, so the bar looks the key up from the name it knows. */
interface TabBarProps {
  state: { index: number; routes: { key: string; name: string }[] };
  navigateToTab: (routeKey: string) => void;
}

const PLACES = ["index", "transacoes"];

export default function BottomNav({ state, navigateToTab }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const active = state.routes[state.index]?.name ?? "index";
  const at = Math.max(0, PLACES.indexOf(active));

  /* The capsule under the place you are, sliding to the next one. */
  const x = useSharedValue(at * (SLOT + SLOT_GAP));
  const stretch = useSharedValue(1);
  useEffect(() => {
    x.set(withSpring(at * (SLOT + SLOT_GAP), SPRING));
    stretch.set(withSequence(withTiming(1.16, { duration: 130 }), withSpring(1, SPRING)));
  }, [at, x, stretch]);
  const capsule = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }, { scaleX: stretch.get() }] }));

  const open = (name: string) => {
    void Haptics.selectionAsync().catch(() => undefined);
    const key = state.routes.find((r) => r.name === name)?.key;
    if (key && name !== active) navigateToTab(key);
  };

  const go = (path: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    router.push(path as never);
  };

  return (
    <View
      pointerEvents="box-none"
      style={{ position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center", paddingBottom: insets.bottom + 14 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        {/* The two places and Registrar, in one piece of glass. */}
        <Glass radius={SIZE / 2} style={{ height: SIZE, flexDirection: "row", alignItems: "center", padding: INSET, gap: SLOT_GAP }}>
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: "absolute",
                top: INSET,
                left: INSET,
                width: SLOT,
                height: INNER,
                borderRadius: INNER / 2,
                borderCurve: "continuous",
                borderWidth: 1,
                borderColor: th("rgba(255,255,255,0.28)", "line"),
                backgroundColor: th("rgba(255,255,255,0.16)", "bg"),
              },
              capsule,
            ]}
          />
          <NavButton label="Início" on={active === "index"} onPress={() => open("index")} icon={House} />
          <NavButton label="Transações" on={active === "transacoes"} onPress={() => open("transacoes")} icon={ArrowLeftRight} />
          <NavButton label="Registrar" on={false} onPress={() => go("/manual")} drawn={<Plus size={25} color={th("rgba(255,255,255,0.78)")} strokeWidth={2.4} />} />
        </Glass>

        {/* Willo, apart. */}
        <Pressable
          onPress={() => go("/registro")}
          accessibilityRole="button"
          accessibilityLabel="Converse com o Willo"
          style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.92 : 1 }] })}
        >
          <Glass radius={SIZE / 2} style={{ width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" }}>
            <View style={{ width: SIZE - 8, height: SIZE - 8, borderRadius: (SIZE - 8) / 2, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
              <ParticleOrb size={SIZE - 12} density={130} />
            </View>
          </Glass>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * One button in the long glass. Where you are, its glyph goes from soft to full and
 * firmer, and pops as the capsule arrives under it.
 */
function NavButton({
  label,
  icon: Icon,
  drawn,
  on,
  onPress,
}: {
  label: string;
  icon?: typeof House;
  /** Drawn as it is, instead of a glyph that lights: Registrar's plus. */
  drawn?: ReactNode;
  on: boolean;
  onPress: () => void;
}) {
  const lit = useSharedValue(on ? 1 : 0);
  const pop = useSharedValue(1);

  useEffect(() => {
    lit.set(withTiming(on ? 1 : 0, { duration: 260 }));
    if (on) pop.set(withSequence(withTiming(0.84, { duration: 110 }), withSpring(1, { duration: 520, dampingRatio: 0.45, reduceMotion: ReduceMotion.System })));
  }, [on, lit, pop]);

  const glyph = useAnimatedStyle(() => ({ transform: [{ scale: pop.get() * (1 + lit.get() * 0.06) }] }));
  const soft = useAnimatedStyle(() => ({ opacity: 1 - lit.get() }));
  const full = useAnimatedStyle(() => ({ opacity: lit.get() }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.92 : 1 }] })}
    >
      <View style={{ width: SLOT, height: INNER, alignItems: "center", justifyContent: "center" }}>
        {drawn ??
          (Icon && (
            <Animated.View style={glyph}>
              <Animated.View style={soft}>
                <Icon size={23} color={th("rgba(255,255,255,0.58)")} strokeWidth={2} />
              </Animated.View>
              <Animated.View style={[{ position: "absolute", top: 0, left: 0 }, full]}>
                <Icon size={23} color={th("#fff")} strokeWidth={2.5} />
              </Animated.View>
            </Animated.View>
          ))}
      </View>
    </Pressable>
  );
}
