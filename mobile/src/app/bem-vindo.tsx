import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import Room from "~/components/Room";
import Glass from "~/components/Glass";
import ParticleOrb from "~/components/registro/ParticleOrb";
import { INK } from "~/theme/tokens";

/**
 * The first thing anyone sees without an account.
 *
 * Willo himself, as the sphere that turns, and two ways forward: start, for someone
 * new, or sign in, for someone who already has an account — on the web or on another
 * phone. Nothing else competes with those two. The pitch is one sentence, because
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
          <Text style={{ marginTop: 12, maxWidth: 320, fontSize: 15.5, lineHeight: 22, color: INK.soft, textAlign: "center" }}>
            Fale o que gastou e o Willo anota, organiza e mostra para onde vai cada real.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(520).duration(520)} style={{ marginTop: 30, gap: 12 }}>
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

          <Pressable
            onPress={() => router.push("/login" as never)}
            accessibilityRole="button"
            style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}
          >
            <Glass radius={29} interactive style={{ height: 58, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 16.5, fontWeight: "600", color: "#fff" }}>Já tenho conta</Text>
            </Glass>
          </Pressable>
        </Animated.View>
      </View>
    </Room>
  );
}
