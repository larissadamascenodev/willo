import { useEffect } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  interpolateColor,
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
 * Three pieces of glass: at the left a plus that opens Adicionar manualmente in its
 * sheet; in the middle Início and Transações together in one piece; at the right,
 * apart, Willo's sphere in a round glass.
 *
 * Each piece is the system's liquid glass where the phone has it (see Glass), a blur
 * where it does not. The place you are is shown by the button itself — it lights, its
 * glyph firms up and pops, and a point comes up under it — not by a colour.
 *
 * Willo's screen sits over the tabs rather than among them, because it has a bar of
 * its own to type into and two bars at the foot would be one too many.
 */

const SIZE = 52;
/** How far the two places sit inside the glass they share. */
const INSET = 3;
const INNER = SIZE - INSET * 2;

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

  const open = (name: string) => {
    void Haptics.selectionAsync().catch(() => undefined);
    const key = state.routes.find((r) => r.name === name)?.key;
    if (key && name !== active) navigateToTab(key);
  };

  return (
    <View
      pointerEvents="box-none"
      style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingBottom: insets.bottom + 14 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        {/* A new entry, typed by hand. */}
        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
            router.push("/manual" as never);
          }}
          accessibilityRole="button"
          accessibilityLabel="Registrar"
          style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.92 : 1 }] })}
        >
          <Glass radius={SIZE / 2} style={{ width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" }}>
            <Plus size={24} color={th("#fff")} strokeWidth={2.4} />
          </Glass>
        </Pressable>

        {/* The two places, in one piece of glass. */}
        <Glass radius={SIZE / 2} style={{ height: SIZE, flexDirection: "row", alignItems: "center", padding: INSET, gap: 4 }}>
          <NavCircle label="Início" icon={House} on={active === "index"} onPress={() => open("index")} />
          <NavCircle label="Transações" icon={ArrowLeftRight} on={active === "transacoes"} onPress={() => open("transacoes")} />
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
            <View style={{ width: SIZE - 8, height: SIZE - 8, borderRadius: (SIZE - 8) / 2, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
              <ParticleOrb size={SIZE - 12} density={150} />
            </View>
          </Glass>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * A round button that knows whether it is where you are.
 *
 * Selected, its glass fills with white at a fifth, its rim brightens, its glyph goes
 * from soft to full and firmer, and it pops — down a little and up past where it
 * rests — as it arrives; a small point comes up beneath. Pressing it presses it in.
 */
function NavCircle({
  label,
  icon: Icon,
  on,
  onPress,
}: {
  label: string;
  icon: typeof House;
  on: boolean;
  onPress: () => void;
}) {
  const lit = useSharedValue(on ? 1 : 0);
  const pop = useSharedValue(1);

  useEffect(() => {
    lit.set(withSpring(on ? 1 : 0, { duration: 420, dampingRatio: 0.82, reduceMotion: ReduceMotion.System }));
    if (on) pop.set(withSequence(withTiming(0.82, { duration: 90 }), withSpring(1, { duration: 520, dampingRatio: 0.45, reduceMotion: ReduceMotion.System })));
  }, [on, lit, pop]);

  /* The glass stays the glass; being here lays a white light over it. */
  /* The theme's colours are worked out here, on the JavaScript side: the animation
     runs on the UI thread, where only "worklet" functions may be called. */
  const fillOff = th("rgba(255,255,255,0)", "bg");
  const fillOn = th("rgba(255,255,255,0.16)", "bg");
  const edgeOff = th("rgba(255,255,255,0)", "line");
  const edgeOn = th("rgba(255,255,255,0.30)", "line");
  const shell = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(lit.get(), [0, 1], [fillOff, fillOn]),
    borderColor: interpolateColor(lit.get(), [0, 1], [edgeOff, edgeOn]),
  }));
  const glyph = useAnimatedStyle(() => ({ transform: [{ scale: pop.get() * (1 + lit.get() * 0.08) }] }));
  const soft = useAnimatedStyle(() => ({ opacity: 1 - lit.get() }));
  const full = useAnimatedStyle(() => ({ opacity: lit.get() }));
  const point = useAnimatedStyle(() => ({ opacity: lit.get(), transform: [{ scale: 0.4 + lit.get() * 0.6 }] }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.94 : 1 }] })}
    >
      <View style={{ width: INNER + 14, height: INNER, alignItems: "center", justifyContent: "center" }}>
        <Animated.View
          pointerEvents="none"
          style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: INNER / 2, borderWidth: 1 }, shell]}
        />
        <Animated.View style={glyph}>
          <Animated.View style={soft}>
            <Icon size={24} color={th("rgba(255,255,255,0.58)")} strokeWidth={2} />
          </Animated.View>
          <Animated.View style={[{ position: "absolute", top: 0, left: 0 }, full]}>
            <Icon size={24} color={th("#fff")} strokeWidth={2.5} />
          </Animated.View>
        </Animated.View>
        <Animated.View style={[{ position: "absolute", bottom: 5, width: 4, height: 4, borderRadius: 2, backgroundColor: th("#fff", "bg") }, point]} />
      </View>
    </Pressable>
  );
}
