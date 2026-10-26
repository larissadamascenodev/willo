import { Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown, ZoomIn } from "react-native-reanimated";
import BotMark from "~/components/BotMark";
import { Check } from "~/components/icons";
import { GREEN } from "~/theme/tokens";

/**
 * The moment something lands.
 *
 * "Anotado" as a line of text read like any other sentence in the thread, and the
 * one thing a person needs to feel here is that it is done — they are about to put
 * the phone away. So it arrives as an event: the mark springs in beside Willo and
 * settles in under a second, celebratory the first time and invisible the hundredth.
 */
export default function Confirmado({ text }: { text: string }) {
  return (
    <Animated.View entering={FadeInDown.duration(300)} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <BotMark size={30} />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingVertical: 8,
          paddingLeft: 8,
          paddingRight: 16,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: "rgba(200,243,109,0.30)",
          backgroundColor: "rgba(200,243,109,0.10)",
        }}
      >
        <Animated.View
          entering={ZoomIn.delay(60).springify().damping(12).stiffness(520)}
          style={{ width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: GREEN }}
        >
          <Check size={13} color="#0B0B0B" strokeWidth={3.6} />
        </Animated.View>
        <Animated.Text entering={FadeIn.delay(160).duration(260)}>
          <Text style={{ fontSize: 14.5, fontWeight: "600", letterSpacing: -0.2, color: GREEN }}>{text}</Text>
        </Animated.Text>
      </View>
    </Animated.View>
  );
}
