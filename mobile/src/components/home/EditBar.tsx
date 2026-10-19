import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { GREEN, GROUND } from "~/theme/tokens";

/**
 * While the board is being edited, the top of the screen says so.
 *
 * A full-width bar rather than a floating pill: editing is a mode the whole screen
 * is in, and a small badge hovering over the cards reads as a message about one of
 * them. The title sits where a screen's title sits and the way out sits opposite it.
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
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        zIndex: 40,
        backgroundColor: GROUND,
        paddingTop: insets.top + 10,
        paddingBottom: 16,
        paddingHorizontal: 20,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <Text style={{ fontSize: 27, fontWeight: "800", letterSpacing: -0.7, color: "#fff" }}>
        Editar widgets
      </Text>

      <Pressable
        onPress={onDone}
        style={({ pressed }) => ({
          height: 44,
          justifyContent: "center",
          borderRadius: 999,
          paddingHorizontal: 20,
          backgroundColor: "rgba(255,255,255,0.08)",
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Text style={{ fontSize: 16, fontWeight: "700", color: GREEN }}>Concluído</Text>
      </Pressable>

      <View />
    </Animated.View>
  );
}
