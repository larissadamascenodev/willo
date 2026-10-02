import { View } from "react-native";
import { useRouter } from "expo-router";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Background, Button, Logo, Mascot, Text, white } from "~/ui";
import { Pressable } from "react-native";

export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: "#0A1220" }}>
      <Background />
      <View style={{ flex: 1, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16, paddingHorizontal: 20 }}>
        <Animated.View entering={FadeIn.duration(500)} style={{ alignItems: "center" }}>
          <Logo height={26} />
        </Animated.View>

        <Animated.View entering={FadeIn.delay(150).duration(600)} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Mascot variant="feliz" size={260} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(500)}>
          <View style={{ alignItems: "center" }}>
            <Text display weight="extrabold" size={27} align="center" style={{ letterSpacing: -0.4 }}>
              Gaste melhor, guarde mais.
            </Text>
            <Text size={15} color={white(0.66)} align="center" style={{ marginTop: 4 }}>
              Tudo calculado pro seu bolso.
            </Text>
          </View>
          <View style={{ marginTop: 28 }}>
            <Button label="Começar agora" onPress={() => router.push({ pathname: "/auth", params: { mode: "signup" } })} />
          </View>
          <Pressable onPress={() => router.push({ pathname: "/auth", params: { mode: "login" } })} style={{ marginTop: 16, paddingVertical: 8 }}>
            <Text size={14} color={white(0.66)} align="center">
              Já tenho conta
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}
