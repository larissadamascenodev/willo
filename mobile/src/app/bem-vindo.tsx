import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import Room from "~/components/Room";
import Showcase from "~/components/welcome/Showcase";

/**
 * The first thing anyone sees without an account.
 *
 * A taste of the app before asking for anything: short scenes of what it does —
 * speaking an expense, two taps, a receipt read from a photo, the Radar, the month's
 * forecast, a question answered — each under a line that says what it is (see
 * Showcase). Then one way forward: start. Someone who already has an account — on the
 * web or on another phone — has a line under the button, not a button of its own.
 */
export default function BemVindo() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <Room lit sky>
      <View style={{ flex: 1, paddingTop: insets.top + 18, paddingBottom: insets.bottom + 20, paddingHorizontal: 24 }}>
        <Animated.Text
          entering={FadeIn.delay(100).duration(600)}
          style={{ fontSize: 22, fontWeight: "800", letterSpacing: -0.6, color: "#fff", textAlign: "center" }}
        >
          willo
        </Animated.Text>

        <Animated.View entering={FadeIn.delay(150).duration(700)} style={{ flex: 1, marginTop: 22 }}>
          <Showcase />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(520).duration(520)} style={{ marginTop: 26 }}>
          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
              router.push("/comecar" as never);
            }}
            accessibilityRole="button"
            style={({ pressed }) => ({
              height: 58,
              borderRadius: 29,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#fff",
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
          >
            <Text style={{ fontSize: 17, fontWeight: "700", color: "#0B0B0B" }}>Começar agora</Text>
          </Pressable>

          {/* Not a second button: whoever has an account is a minority here, and two
              equal buttons would ask every new person to choose. */}
          <Pressable
            onPress={() => router.push("/login" as never)}
            accessibilityRole="button"
            hitSlop={8}
            style={({ pressed }) => ({ height: 48, marginTop: 4, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
          >
            <Text style={{ fontSize: 15.5, fontWeight: "600", color: "rgba(255,255,255,0.82)" }}>Já tenho conta</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Room>
  );
}
