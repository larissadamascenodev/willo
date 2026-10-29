import { useEffect, useState, type ReactNode } from "react";
import { Keyboard, Modal, Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { GROUND_LIT, INK } from "~/theme/tokens";

/**
 * A panel that comes up from the foot of the screen.
 *
 * For a place you go to, rather than something you do to what is under your thumb —
 * that is the anchored menu. It keeps a real blur behind it, because what sits back
 * there is the page's own content and not a flat ground.
 *
 * It rides up with the keyboard. A sheet with a field in it that the keyboard then
 * covers is a sheet whose field cannot be seen being typed in.
 */
export default function BottomSheet({
  open,
  onClose,
  children,
  full = false,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Takes most of the screen instead of only what it needs. */
  full?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [lift, setLift] = useState(0);

  useEffect(() => {
    if (!open) {
      setLift(0);
      return;
    }
    const ios = Platform.OS === "ios";
    const show = Keyboard.addListener(ios ? "keyboardWillChangeFrame" : "keyboardDidShow", (e) => {
      setLift(Math.max(0, e.endCoordinates.height - (ios ? insets.bottom : 0)));
    });
    const hide = Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", () => setLift(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [open, insets.bottom]);

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={{ flex: 1 }} onPress={onClose}>
        <BlurView intensity={12} tint="dark" style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }} />
      </Pressable>

      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: lift,
          maxHeight: full ? "88%" : "72%",
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          borderTopWidth: 1,
          borderColor: INK.edge,
          backgroundColor: GROUND_LIT,
          paddingTop: 10,
          paddingBottom: insets.bottom + 16,
        }}
      >
        {/* The grab handle, which says which way this came from. */}
        <View
          style={{
            alignSelf: "center",
            width: 38,
            height: 4,
            borderRadius: 999,
            backgroundColor: "rgba(255,255,255,0.18)",
            marginBottom: 12,
          }}
        />
        <ScrollView showsVerticalScrollIndicator={false}>{children}</ScrollView>
      </View>
    </Modal>
  );
}
