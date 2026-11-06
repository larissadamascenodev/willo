import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import Surface from "~/components/Surface";
import { MiniDial, Reading } from "~/components/home/RadarShortcut";
import { ChallengeCover } from "~/components/desafios/ChallengeTile";
import { Flame, Trophy } from "~/components/icons";
import { useAuth } from "~/lib/auth";
import { pendingCheckins, tickToday, type PendingCheckin } from "~/lib/challenges";
import { showToast } from "~/lib/toast";
import { th } from "~/theme/theme";
import { INK } from "~/theme/tokens";
import { type as T } from "~/theme/type";

/**
 * Two doors side by side on the home — the Radar, and challenges and achievements —
 * and under them, while a challenge is still waiting for today's check-in, the
 * check-in itself: each one with its picture, its flame and a button, done without
 * leaving the home.
 */

const FIRE = "#FF9F45";

export default function ShortcutPair({ gap = 16 }: { gap?: number }) {
  const router = useRouter();
  const { user } = useAuth();
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState<PendingCheckin[]>([]);
  const [doing, setDoing] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 900);
    return () => clearTimeout(t);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      void pendingCheckins(user.id).then(setPending).catch(() => undefined);
    }, [user]),
  );

  const checkIn = async (p: PendingCheckin) => {
    if (!user || doing) return;
    setDoing(p.id);
    try {
      await tickToday(user.id, p.id);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setPending((list) => list.filter((x) => x.id !== p.id));
      showToast(`Check-in feito: ${p.streak + 1} ${p.streak + 1 === 1 ? "dia" : "dias"} seguidos`);
    } catch {
      showToast("Não foi possível fazer o check-in.");
    } finally {
      setDoing(null);
    }
  };

  const tile = { flex: 1, minHeight: 128, padding: 14, justifyContent: "space-between" as const };

  return (
    <View style={{ gap }}>
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
                {pending.length ? `${pending.length} esperando check-in` : "Desafios e conquistas"}
              </Text>
            </View>
          </View>
        </Surface>
      </View>

      {/* Today's check-in, while there is one to do. */}
      {pending.length > 0 && (
        <Animated.View entering={FadeIn.duration(260)} exiting={FadeOut.duration(200)} layout={LinearTransition.duration(220)}>
          <Surface>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 }}>
              <Flame size={16} color={FIRE} strokeWidth={2.4} />
              <Text style={{ fontSize: 15, fontWeight: "700", color: th("#fff") }}>Check-in de hoje</Text>
            </View>
            {pending.map((p, i) => (
              <Animated.View key={p.id} exiting={FadeOut.duration(180)} layout={LinearTransition.duration(220)}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: th("rgba(255,255,255,0.06)", "line") }}>
                  <Pressable onPress={() => router.push(`/desafio/${p.id}` as never)} style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                    <View style={{ width: 42, height: 42, borderRadius: 13, overflow: "hidden" }}>
                      <ChallengeCover template={p.template} cover={p.cover} width={42} height={42} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: "600", color: th("#fff") }}>
                        {p.template.name}
                      </Text>
                      <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 12.5, color: th(INK.soft) }}>
                        {p.streak > 0 ? `${p.streak} ${p.streak === 1 ? "dia seguido" : "dias seguidos"}, não perca` : "Comece a sequência hoje"}
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable
                    onPress={() => void checkIn(p)}
                    disabled={!!doing}
                    accessibilityRole="button"
                    accessibilityLabel={`Check-in em ${p.template.name}`}
                    style={({ pressed }) => ({ height: 34, minWidth: 74, paddingHorizontal: 12, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: th("#fff", "bg"), opacity: pressed ? 0.8 : 1 })}
                  >
                    {doing === p.id ? <ActivityIndicator size="small" color={th("#0B0B0B")} /> : <Text style={{ fontSize: 13, fontWeight: "700", color: th("#0B0B0B") }}>Fiz hoje</Text>}
                  </Pressable>
                </View>
              </Animated.View>
            ))}
          </Surface>
        </Animated.View>
      )}
    </View>
  );
}
