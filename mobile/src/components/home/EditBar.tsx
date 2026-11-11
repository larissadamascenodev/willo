import { Pressable, Text, View } from "react-native";
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
  onFill,
}: {
  open: boolean;
  onDone: () => void;
  /** Back to how the board was. */
  onCancel?: () => void;
  /** Pair the compact cards up, so no row is left half empty. */
  onFill?: () => void;
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
      <Pressable onPress={onCancel ?? onDone} hitSlop={8} style={({ pressed }) => ({ height: 44, justifyContent: "center", paddingHorizontal: 4, opacity: pressed ? 0.6 : 1 })}>
        <Text style={{ fontSize: 16, fontWeight: "600", color: th("rgba(255,255,255,0.75)") }}>Cancelar</Text>
      </Pressable>

      <Text numberOfLines={1} style={{ flex: 1, textAlign: "center", fontSize: 18, fontWeight: "800", letterSpacing: -0.4, color: th("#fff") }}>
        Editar widgets
      </Text>

      {onFill && (
        <Pressable onPress={onFill} hitSlop={6} style={({ pressed }) => ({ height: 44, justifyContent: "center", paddingHorizontal: 6, opacity: pressed ? 0.6 : 1 })}>
          <Text style={{ fontSize: 15, fontWeight: "700", color: th(GREEN) }}>Preencher</Text>
        </Pressable>
      )}

      <Pressable
        onPress={onDone}
        style={({ pressed }) => ({
          height: 44,
          justifyContent: "center",
          borderRadius: 999,
          paddingHorizontal: 20,
          backgroundColor: th("rgba(255,255,255,0.08)", "bg"),
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Text style={{ fontSize: 16, fontWeight: "700", color: th(GREEN) }}>Concluído</Text>
      </Pressable>

    </Animated.View>
  );
}
