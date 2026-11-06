import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/integrations/supabase/client";
import Surface from "~/components/Surface";
import { MiniDial, Reading } from "~/components/home/RadarShortcut";
import { Trophy } from "~/components/icons";
import { useAuth } from "~/lib/auth";
import { th } from "~/theme/theme";
import { INK } from "~/theme/tokens";
import { type as T } from "~/theme/type";

/**
 * Two doors side by side on the home: the Radar, and challenges and achievements.
 *
 * The Radar used to sit alone above the cards; it now shares a row with the
 * challenges, after what came in and went out — the two places to go and look
 * deeper at the month.
 */
export default function ShortcutPair({ gap = 16 }: { gap?: number }) {
  const router = useRouter();
  const { user } = useAuth();
  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 900);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!user) return;
    void supabase
      .from("user_challenges")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "active")
      .then(({ count }) => setRunning(count ?? 0));
  }, [user]);

  const tile = { flex: 1, minHeight: 128, padding: 14, justifyContent: "space-between" as const };

  return (
    <View style={{ flexDirection: "row", gap }}>
      <Surface onPress={() => router.push({ pathname: "/registro", params: { view: "radar" } } as never)} style={{ flex: 1 }}>
        <View style={tile}>
          <MiniDial />
          <View>
            <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "700", letterSpacing: -0.2, color: th("#fff") }}>
              Radar financeiro
            </Text>
            {ready ? <Reading /> : <Text numberOfLines={1} style={[T.note, { marginTop: 2, fontSize: 13 }]}>Consumo e hábitos</Text>}
          </View>
        </View>
      </Surface>

      <Surface onPress={() => router.push("/desafios" as never)} style={{ flex: 1 }}>
        <View style={tile}>
          <View style={{ width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: th("rgba(233,196,98,0.14)", "bg") }}>
            <Trophy size={21} color={th("#E9C462")} strokeWidth={1.9} />
          </View>
          <View>
            <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "700", letterSpacing: -0.2, color: th("#fff") }}>
              Desafios
            </Text>
            <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 13, color: th(INK.soft) }}>
              {running ? `${running} em andamento` : "Conquistas e metas"}
            </Text>
          </View>
        </View>
      </Surface>
    </View>
  );
}
