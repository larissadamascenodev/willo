import { type ComponentRef, type ReactNode, type Ref } from "react";
import { Pressable, View } from "react-native";
import Glass from "~/components/Glass";

/**
 * The round button every page's header uses: the way back, the three dots, the plus.
 *
 * One shape, one size and one weight of glass, so that a page never has a back arrow
 * that is bare and a menu that is a circle. It is the system's liquid glass where the
 * phone has it (see Glass), which reads on a picture as well as on the dark ground,
 * so `onImage` only darkens the glass a touch more behind the glyph.
 *
 * Pressing it shrinks it rather than fading it: glass under a fading ancestor loses
 * its rim and highlight. Disabled, only the glyph fades.
 */
export default function RoundButton({
  label,
  onPress,
  children,
  hostRef,
  onImage = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
  hostRef?: Ref<ComponentRef<typeof View>>;
  onImage?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      ref={hostRef}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.93 : 1 }] })}
    >
      <Glass radius={20} interactive={!disabled} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
        {onImage && (
          <View
            pointerEvents="none"
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 20, backgroundColor: "rgba(18,20,26,0.22)" }}
          />
        )}
        <View style={{ opacity: disabled ? 0.4 : 1 }}>{children}</View>
      </Glass>
    </Pressable>
  );
}
