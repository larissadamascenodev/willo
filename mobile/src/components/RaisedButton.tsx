import type { ReactNode } from "react";
import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { isLight, th } from "~/theme/theme";

/**
 * A round button that stands up off the page.
 *
 * Not a hole of glass in the background but a drop sitting on it, the way the big apps
 * draw the buttons in their top row: the page shows through, a shade lighter, brighter at
 * the top than at the bottom; a thin line of light along its upper rim; and a soft shadow
 * under it, so it reads as raised. Pressed, it sinks a little.
 */
export default function RaisedButton({
  size = 50,
  onPress,
  label,
  children,
  style,
}: {
  size?: number;
  onPress?: () => void;
  label: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const light = isLight();
  const r = size / 2;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.94 : 1 }], opacity: pressed ? 0.9 : 1 }, style]}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: r,
          shadowColor: "#000",
          shadowOpacity: light ? 0.14 : 0.45,
          shadowRadius: light ? 8 : 10,
          shadowOffset: { width: 0, height: light ? 3 : 4 },
        }}
      >
        <View style={{ flex: 1, borderRadius: r, overflow: "hidden", borderWidth: 1, borderColor: light ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.18)" }}>
          <BlurView intensity={light ? 40 : 28} tint={th("dark", "tint")} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
          <LinearGradient
            pointerEvents="none"
            colors={light ? ["rgba(255,255,255,0.98)", "rgba(246,247,249,0.92)"] : ["rgba(255,255,255,0.30)", "rgba(255,255,255,0.12)"]}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          />
          {/* The rim of light along the top edge. */}
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderRadius: r,
              borderTopWidth: 1.2,
              borderLeftWidth: 0.6,
              borderRightWidth: 0.6,
              borderColor: light ? "rgba(255,255,255,1)" : "rgba(255,255,255,0.6)",
            }}
          />
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>{children}</View>
        </View>
      </View>
    </Pressable>
  );
}
