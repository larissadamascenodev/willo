import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { Check } from "~/components/icons";
import { GREEN } from "~/theme/tokens";

/**
 * While the board is being edited, a bar says so and gives the way out.
 *
 * It belongs to the screen rather than to the board: inside a scroller it would
 * scroll away with the cards, and a way out that leaves the screen is not one.
 */
export default function EditBar({ open, onDone }: { open: boolean; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  if (!open) return null;

  return (
    <Animated.View
      entering={FadeInUp.duration(240)}
      exiting={FadeOutUp.duration(180)}
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        alignItems: "center",
        paddingTop: insets.top + 10,
        zIndex: 40,
      }}
    >
      <BlurView
        intensity={30}
        tint="dark"
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.10)",
          backgroundColor: "rgba(16,16,19,0.82)",
          paddingVertical: 6,
          paddingLeft: 20,
          paddingRight: 6,
          overflow: "hidden",
        }}
      >
        <Text style={{ fontSize: 14, fontWeight: "600", color: "#fff" }}>Arraste para mover</Text>
        <Pressable
          onPress={onDone}
          style={({ pressed }) => ({
            height: 36,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            borderRadius: 999,
            backgroundColor: GREEN,
            paddingHorizontal: 16,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Check size={14} color="#0B0B0B" strokeWidth={3} />
          <Text style={{ fontSize: 13.5, fontWeight: "700", color: "#0B0B0B" }}>Concluído</Text>
        </Pressable>
      </BlurView>
      <View />
    </Animated.View>
  );
}
