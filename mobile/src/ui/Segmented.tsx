import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { Glass } from "./Glass";
import { Text } from "./Text";
import { colors, white } from "./theme";

interface Option<T extends string> {
  key: T;
  label: string;
}

/** Abas em pílula com a marca branca deslizando entre as opções (os seletores do site). */
export function Segmented<T extends string>({ options, value, onChange }: { options: readonly Option<T>[]; value: T; onChange: (key: T) => void }) {
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.key === value));
  const segment = width > 0 ? (width - 8) / options.length : 0;
  const x = useSharedValue(0);

  useEffect(() => {
    x.value = withSpring(index * segment, { stiffness: 420, damping: 36 });
  }, [index, segment, x]);

  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <Glass radius={999} style={{ padding: 4 }}>
      <View style={{ flexDirection: "row" }} onLayout={(e) => setWidth(e.nativeEvent.layout.width + 8)}>
        {segment > 0 && (
          <Animated.View
            style={[{ position: "absolute", top: 0, bottom: 0, left: 0, width: segment, borderRadius: 999, backgroundColor: "#fff" }, pill]}
          />
        )}
        {options.map((o) => (
          <Pressable key={o.key} onPress={() => onChange(o.key)} style={{ flex: 1, height: 36, alignItems: "center", justifyContent: "center" }}>
            <Text weight="semibold" size={13} color={o.key === value ? colors.black : white(0.7)}>
              {o.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </Glass>
  );
}
