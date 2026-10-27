import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import Room from "~/components/Room";
import ParticleOrb from "~/components/registro/ParticleOrb";
import { INK } from "~/theme/tokens";

/**
 * The first thing anyone sees without an account.
 *
 * Willo himself, as the sphere that turns, and one way forward: start. Someone who
 * already has an account — on the web or on another phone — has a line under the
 * button, not a button of its own. The pitch is one sentence in two lines, because
 * what it promises is shown by the first minute of using it, not by a paragraph.
 */
export default function BemVindo() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const orb = Math.min(width * 0.86, height * 0.4, 340);

  return (
    <Room lit sky>
      <View style={{ flex: 1, paddingTop: insets.top + 18, paddingBottom: insets.bottom + 20, paddingHorizontal: 24 }}>
        <Animated.Text
          entering={FadeIn.delay(100).duration(600)}
          style={{ fontSize: 22, fontWeight: "800", letterSpacing: -0.6, color: "#fff", textAlign: "center" }}
        >
          willo
        </Animated.Text>

        <Animated.View
          entering={FadeIn.delay(150).duration(900)}
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ParticleOrb size={orb} mode="idle" />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(350).duration(520)} style={{ alignItems: "center" }}>
          <Text style={{ fontSize: 32, fontWeight: "800", letterSpacing: -1.1, lineHeight: 36, color: "#fff", textAlign: "center" }}>
            Seu dinheiro,{"\n"}claro e sob controle.
          </Text>
          {/* Two lines, broken where the sentence breathes. It is told to shrink a little
              rather than wrap to a third on a narrower phone. */}
          <Text
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.86}
            style={{ marginTop: 12, alignSelf: "stretch", fontSize: 15.5, lineHeight: 22, color: INK.soft, textAlign: "center" }}
          >
            Fale o que gastou e o Willo anota,{"\n"}organiza e mostra para onde vai cada real.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(520).duration(520)} style={{ marginTop: 30 }}>
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
