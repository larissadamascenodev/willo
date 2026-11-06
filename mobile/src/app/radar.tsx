import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useRaioX } from "@/hooks/useRaioX";
import { useAssistantSnapshot } from "@/hooks/useAssistantSnapshot";
import { allowedCategories } from "@/services/quickEntry";
import Room from "~/components/Room";
import BackButton from "~/components/BackButton";
import RadarPanel from "~/components/willo/RadarPanel";
import { th } from "~/theme/theme";
import { type as T } from "~/theme/type";

/**
 * The Radar, on a page of its own.
 *
 * It used to be a tab beside the conversation with Willo; the conversation now stands
 * alone, and the Radar is reached from its card on the home. The same dial and the
 * same six sectors; a question asked from it opens the conversation with it asked.
 */
export default function RadarScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const data = useRaioX();
  const { build } = useAssistantSnapshot();
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    allowedCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  const ask = useCallback((question: string) => router.push({ pathname: "/registro", params: { ask: question } } as never), [router]);

  return (
    <Room>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16 }}>
        <View style={{ height: 44, justifyContent: "center" }}>
          <BackButton />
        </View>
        <Text style={[T.title, { marginTop: 8, paddingHorizontal: 4 }]}>Radar financeiro</Text>
        <Text style={{ marginTop: 4, paddingHorizontal: 4, fontSize: 14, color: th("rgba(255,255,255,0.66)") }}>
          Toque num setor para ver o que o Willo encontrou
        </Text>
      </View>
      <View style={{ flex: 1, marginTop: 8 }}>
        <RadarPanel data={data.loading ? null : data} snapshot={build() as never} categories={categories} bottom={insets.bottom} onAsk={ask} />
      </View>
    </Room>
  );
}
