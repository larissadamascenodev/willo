import { Pressable, Text } from "react-native";
import { X } from "~/components/icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { GREEN, GROUND } from "~/theme/tokens";

import { th } from "~/theme/theme";
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
export default function EditBar({
  open,
  onDone,
  onCancel,
}: {
  open: boolean;
  onDone: () => void;
  /** Back to how the board was. */
  onCancel?: () => void;
}) {
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
        backgroundColor: th(GROUND, "bg"),
        paddingTop: insets.top + 10,
        paddingBottom: 16,
        paddingHorizontal: 20,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      {/* The mode's name, whole, on the left; the two ways out on the right. */}
      <Text numberOfLines={1} style={{ flex: 1, fontSize: 22, fontWeight: "800", letterSpacing: -0.6, color: th("#fff") }}>
        Editar widgets
      </Text>

      <Pressable
        onPress={onCancel ?? onDone}
        accessibilityLabel="Cancelar"
        hitSlop={8}
        style={({ pressed }) => ({
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: th("rgba(255,255,255,0.08)", "bg"),
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <X size={19} color={th("rgba(255,255,255,0.85)")} strokeWidth={2.4} />
      </Pressable>

      <Pressable
        onPress={onDone}
        style={({ pressed }) => ({
          height: 44,
          justifyContent: "center",
          borderRadius: 999,
          paddingHorizontal: 18,
          backgroundColor: th("rgba(255,255,255,0.08)", "bg"),
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Text style={{ fontSize: 16, fontWeight: "700", color: th(GREEN) }}>Concluído</Text>
      </Pressable>
    </Animated.View>
  );
}
