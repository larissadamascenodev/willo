import { type ComponentRef, type ReactNode, type Ref } from "react";
import { Pressable, View } from "react-native";
import { BlurView } from "expo-blur";

/**
 * The round button every page's header uses: the way back, the three dots, the plus.
 *
 * One shape, one size and one weight of glass, so that a page never has a back arrow
 * that is bare and a menu that is a circle. Over a picture it is given a blur of its
 * own (`onImage`) so it still reads on anything; everywhere else it is the quiet
 * translucent circle.
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
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({ opacity: disabled ? 0.4 : pressed ? 0.6 : 1, transform: [{ scale: pressed ? 0.95 : 1 }] })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: onImage ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.10)",
          backgroundColor: onImage ? "transparent" : "rgba(255,255,255,0.07)",
        }}
      >
        {onImage && (
          <>
            <BlurView intensity={40} tint="dark" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
            <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(18,20,26,0.34)" }} />
          </>
        )}
        <View style={{ zIndex: 1 }}>{children}</View>
      </View>
    </Pressable>
  );
}
