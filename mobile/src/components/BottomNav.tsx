import { useEffect } from "react";
import { Pressable, Text, View, type ViewStyle } from "react-native";
import Animated, {
  interpolateColor,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import ParticleOrb from "~/components/registro/ParticleOrb";
import { ArrowLeftRight, House } from "~/components/icons";

/**
 * The row at the foot of the screen.
 *
 * Three pieces of glass, side by side: Início at one end, Transações at the other,
 * and between them the way to Willo — a long pill with the sphere, small, in a disc
 * at its left, and an invitation. The sphere is the same one that turns on the home
 * and listens in Willo's own screen, only small.
 *
 * It is white and translucent and nothing else. The place you are is shown by the
 * button itself — it lights, its glyph firms up and pops, and a point comes up under
 * it — not by a colour.
 *
 * Willo's screen sits over the tabs rather than among them, because it has a bar of
 * its own to type into and two bars at the foot would be one too many.
 */

const GLASS: ViewStyle = {
  backgroundColor: "rgba(34,34,36,0.82)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.09)",
};

const SIZE = 52;
const GAP = 9;

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
      <View style={{ flexDirection: "row", alignItems: "center", gap: GAP }}>
        <NavCircle label="Início" icon={House} on={active === "index"} onPress={() => open("index")} />

        {/* Willo. */}
        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
            router.push("/registro" as never);
          }}
          accessibilityRole="button"
          accessibilityLabel="Converse com o Willo"
          style={({ pressed }) => ({ flex: 1, transform: [{ scale: pressed ? 0.98 : 1 }] })}
        >
          <View style={[GLASS, { height: SIZE, borderRadius: SIZE / 2, overflow: "hidden", flexDirection: "row", alignItems: "center", paddingLeft: 7, paddingRight: 12, gap: 9 }]}>
            <BlurView intensity={26} tint="dark" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(255,255,255,0.10)",
                overflow: "hidden",
              }}
            >
              <ParticleOrb size={33} density={140} />
            </View>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ flex: 1, minWidth: 0, fontSize: 14, color: "rgba(255,255,255,0.66)" }}>
              Converse com o Willo
            </Text>
          </View>
        </Pressable>

        <NavCircle label="Transações" icon={ArrowLeftRight} on={active === "transacoes"} onPress={() => open("transacoes")} />
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

  const shell = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(lit.get(), [0, 1], ["rgba(34,34,36,0.82)", "rgba(255,255,255,0.20)"]),
    borderColor: interpolateColor(lit.get(), [0, 1], ["rgba(255,255,255,0.09)", "rgba(255,255,255,0.34)"]),
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
      <Animated.View style={[{ width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderWidth: 1, overflow: "hidden", alignItems: "center", justifyContent: "center" }, shell]}>
        <BlurView intensity={26} tint="dark" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
        <Animated.View style={glyph}>
          <Animated.View style={soft}>
            <Icon size={24} color="rgba(255,255,255,0.58)" strokeWidth={2} />
          </Animated.View>
          <Animated.View style={[{ position: "absolute", top: 0, left: 0 }, full]}>
            <Icon size={24} color="#fff" strokeWidth={2.5} />
          </Animated.View>
        </Animated.View>
        <Animated.View style={[{ position: "absolute", bottom: 7, width: 4, height: 4, borderRadius: 2, backgroundColor: "#fff" }, point]} />
      </Animated.View>
    </Pressable>
  );
}
