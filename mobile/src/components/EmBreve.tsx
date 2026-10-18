import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Room from "~/components/Room";
import { INK } from "~/theme/tokens";
import { type as T } from "~/theme/type";

/**
 * A screen that has not been carried over yet.
 *
 * It names itself rather than being blank, so moving around the app while it is
 * half-built says which parts are standing and which are still coming.
 */
export default function EmBreve({ title, note }: { title: string; note?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <Room>
      <View style={{ flex: 1, paddingTop: insets.top + 16, paddingHorizontal: 20 }}>
        <Text style={T.title}>{title}</Text>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 90 }}>
          <Text style={{ fontSize: 14, color: INK.softer, textAlign: "center", lineHeight: 20 }}>
            {note ?? "Esta tela ainda está sendo reconstruída."}
          </Text>
        </View>
      </View>
    </Room>
  );
}
