import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import Animated, { Easing, FadeIn, FadeInDown, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import Room from "~/components/Room";
import BackButton from "~/components/BackButton";
import Surface from "~/components/Surface";
import { MedalArt } from "~/components/desafios/Medal3D";
import MedalDetail from "~/components/desafios/MedalDetail";
import { ChevronRight, Flame, Plus } from "~/components/icons";
import { useAuth } from "~/lib/auth";
import { showToast } from "~/lib/toast";
import { medalLeft, type Medal } from "~/lib/medals";
import { daysInARow, loadConquistas, type Conquistas as Data } from "~/lib/conquistas";
import { th, useThemeRedraw } from "~/theme/theme";
import { INK } from "~/theme/tokens";
import { type as T } from "~/theme/type";

/**
 * Conquistas.
 *
 * The sequence first, as its own card: the flame and the days in a row, the record,
 * the last seven days, and the next medal it leads to — with a way to write something
 * down when today is still open. Then the collection: how many medals are won, the
 * one closest, and every medal by what it rewards.
 */

const FIRE = "#FF9F45";
const GROUPS = ["Registro", "Contas e cartões", "Guardar", "Mês saudável", "Desafios", "Uso do Willo", "Secretas"] as const;

export default function ConquistasScreen() {
  /* Drawn again in place when the theme changes. */
  useThemeRedraw();
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [medal, setMedal] = useState<Medal | null>(null);
  const [show, setShow] = useState<"todas" | "ganhas" | "faltam">("todas");

  const load = useCallback(
    async (fresh = false) => {
      if (!user) return;
      try {
        setData(await loadConquistas(user.id, fresh));
      } catch {
        showToast("Não foi possível carregar as conquistas.");
      }
    },
    [user],
  );

  useFocusEffect(
    useCallback(() => {
      void load(true);
    }, [load]),
  );

  const medals = data?.medals ?? [];
  const won = medals.filter((m) => m.earned).length;
  /* The medal closest to being won, among those that can be seen. */
  const nearest = medals.filter((m) => !m.earned && !m.hidden && m.value > 0).sort((a, b) => b.value / b.step - a.value / a.step)[0] ?? null;
  const cellMedal = Math.min(96, Math.floor((screenW - 32) / 3) - 22);

  return (
    <Room>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 48, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load(true);
              setRefreshing(false);
            }}
            tintColor={th(INK.softer)}
          />
        }
      >
        <View style={{ height: 44, justifyContent: "center" }}>
          <BackButton />
        </View>
        <Text style={[T.title, { marginTop: 8, paddingHorizontal: 4 }]}>Conquistas</Text>
        <Text style={{ marginTop: 4, paddingHorizontal: 4, fontSize: 14, color: th(INK.soft) }}>
          {data ? `${won} de ${medals.length} medalhas · ${daysInARow(data.streak.current)}` : " "}
        </Text>

        {!data ? (
          <ActivityIndicator color={th(INK.soft)} style={{ marginTop: 60 }} />
        ) : (
          <Animated.View entering={FadeIn.duration(220)}>
            <Animated.View entering={FadeInDown.duration(420)} style={{ marginTop: 20 }}>
              <StreakCard data={data} onWrite={() => router.push("/registro" as never)} onMedal={setMedal} />
            </Animated.View>

            {/* Where the collection stands, and the nearest one to win. */}
            <Surface style={{ marginTop: 16 }}>
              <View style={{ padding: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 26, fontWeight: "800", letterSpacing: -0.8, color: th("#fff") }}>
                    {won}
                    <Text style={{ fontSize: 15, fontWeight: "600", color: th(INK.soft) }}> de {medals.length} medalhas</Text>
                  </Text>
                  <Text style={{ fontSize: 13, color: th(INK.soft) }}>{Math.round((won / Math.max(1, medals.length)) * 100)}%</Text>
                </View>
                <View style={{ marginTop: 10, height: 6, borderRadius: 3, overflow: "hidden", backgroundColor: th("rgba(255,255,255,0.1)", "bg") }}>
                  <View style={{ width: `${(won / Math.max(1, medals.length)) * 100}%`, height: 6, borderRadius: 3, backgroundColor: th("#E9C462") }} />
                </View>
                {nearest && (
                  <Pressable onPress={() => setMedal(nearest)} style={{ marginTop: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <MedalArt m={nearest} size={52} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontSize: 12, fontWeight: "600", color: th(INK.softer) }}>MAIS PERTO</Text>
                      <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 14.5, fontWeight: "700", color: th("#fff") }}>
                        {nearest.level ? nearest.title : nearest.name}
                      </Text>
                      <Text numberOfLines={2} style={{ marginTop: 1, fontSize: 12.5, lineHeight: 17, color: th(INK.soft) }}>
                        {nearest.level ? `${nearest.name} · ${medalLeft(nearest).toLowerCase()}` : medalLeft(nearest)}
                      </Text>
                    </View>
                    <ChevronRight size={16} color={th(INK.faint)} />
                  </Pressable>
                )}
              </View>
            </Surface>

            <View style={{ marginTop: 16, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {(["todas", "ganhas", "faltam"] as const).map((k) => {
                const on = show === k;
                return (
                  <Pressable
                    key={k}
                    onPress={() => setShow(k)}
                    style={{ height: 34, paddingHorizontal: 14, borderRadius: 17, justifyContent: "center", backgroundColor: on ? th("#fff", "bg") : th("rgba(255,255,255,0.07)", "bg") }}
                  >
                    <Text style={{ fontSize: 13.5, fontWeight: "700", color: on ? th("#0B0B0B") : th(INK.soft) }}>{k === "todas" ? "Todas" : k === "ganhas" ? `Conquistadas · ${won}` : "A conquistar"}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Every medal on its own, by what it rewards. */}
            {GROUPS.map((group) => {
              const list = medals.filter((m) => m.group === group && (show === "todas" || (show === "ganhas" ? m.earned : !m.earned)));
              if (!list.length) return null;
              return (
                <View key={group}>
                  <Text style={[T.eyebrow, { marginTop: 26, marginBottom: 10, paddingHorizontal: 4 }]}>{group}</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 22 }}>
                    {list.map((m) => (
                      <Pressable key={m.id} onPress={() => setMedal(m)} style={({ pressed }) => ({ width: "33.33%", alignItems: "center", transform: [{ scale: pressed ? 0.95 : 1 }] })}>
                        <View style={{ opacity: m.earned ? 1 : 0.75 }}>
                          <MedalArt m={m} size={cellMedal} />
                        </View>
                        <Text numberOfLines={1} style={{ marginTop: 10, fontSize: 13, fontWeight: "700", color: th(m.earned ? "#fff" : INK.soft) }}>
                          {m.hidden ? "Secreta" : m.name}
                        </Text>
                        <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 11.5, color: th(INK.softer) }}>
                          {m.hidden ? "Ainda escondida" : m.level ? m.title : m.earned ? "Conquista única" : "Ainda não"}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              );
            })}
          </Animated.View>
        )}
      </ScrollView>

      {/* A medal, opened on a page of its own. */}
      <MedalDetail medal={medal} onClose={() => setMedal(null)} />
    </Room>
  );
}

/* ── The sequence ──────────────────────────────────────────────────────────── */

/** The sequence, dark and warm in both themes: the flame, the days, the week, the next medal. */
function StreakCard({ data, onWrite, onMedal }: { data: Data; onWrite: () => void; onMedal: (m: Medal) => void }) {
  const s = data.streak;
  const lit = s.current > 0;
  const reduce = useReducedMotion();
  /* The flame breathes while the sequence is alive. */
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (reduce || !lit) return;
    pulse.set(withRepeat(withSequence(withTiming(1.08, { duration: 1100, easing: Easing.inOut(Easing.quad) }), withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) })), -1, false));
    return () => cancelAnimation(pulse);
  }, [pulse, reduce, lit]);
  const breathe = useAnimatedStyle(() => ({ transform: [{ scale: pulse.get() }] }));

  const line = s.todayDone
    ? `Hoje já está anotado. Amanhã a sequência vai para ${s.current + 1}.`
    : lit
      ? "Anote um gasto ou uma entrada hoje para não perder a sequência."
      : "Anote um gasto ou uma entrada hoje para começar uma sequência.";
  const toNext = s.next ? Math.max(1, s.next.step - s.current) : 0;

  return (
    <View style={{ borderRadius: 28, borderCurve: "continuous", overflow: "hidden", backgroundColor: "#120C08" }}>
      <LinearGradient colors={["#3B2210", "#1A110A", "#100B08"]} locations={[0, 0.55, 1]} start={{ x: 0, y: 0 }} end={{ x: 0.9, y: 1 }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
      <LinearGradient colors={["rgba(255,159,69,0.32)", "rgba(255,159,69,0)"]} start={{ x: 1, y: 0 }} end={{ x: 0.35, y: 0.7 }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />

      <View style={{ padding: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <Text style={{ fontSize: 11.5, fontWeight: "700", letterSpacing: 1.2, color: "rgba(255,255,255,0.6)" }}>SEQUÊNCIA</Text>
          {s.best > 0 && (
            <View style={{ height: 26, paddingHorizontal: 10, borderRadius: 13, justifyContent: "center", backgroundColor: "rgba(10,11,13,0.45)" }}>
              <Text style={{ fontSize: 11.5, fontWeight: "700", color: "#fff" }}>Recorde · {daysInARow(s.best).replace(" seguidos", "").replace(" seguido", "")}</Text>
            </View>
          )}
        </View>

        <View style={{ marginTop: 14, flexDirection: "row", alignItems: "center", gap: 16 }}>
          <Animated.View style={[{ width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center", backgroundColor: lit ? "rgba(255,159,69,0.18)" : "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: lit ? "rgba(255,159,69,0.45)" : "rgba(255,255,255,0.12)" }, breathe]}>
            <Flame size={38} color={lit ? FIRE : "rgba(255,255,255,0.45)"} fill={lit ? "rgba(255,159,69,0.35)" : "transparent"} strokeWidth={2} />
          </Animated.View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 50, lineHeight: 54, fontWeight: "800", letterSpacing: -2, color: "#fff", fontVariant: ["tabular-nums"] }}>{s.current}</Text>
            <Text style={{ fontSize: 14, color: "rgba(255,255,255,0.72)" }}>{s.current === 1 ? "dia seguido anotando" : "dias seguidos anotando"}</Text>
          </View>
        </View>

        {/* The last seven days. */}
        <View style={{ marginTop: 20, flexDirection: "row", justifyContent: "space-between" }}>
          {s.week.map((d) => (
            <View key={d.iso} style={{ alignItems: "center", gap: 6 }}>
              <Text style={{ fontSize: 11, fontWeight: d.today ? "800" : "600", color: d.today ? "#fff" : "rgba(255,255,255,0.5)" }}>{d.label}</Text>
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: d.done ? FIRE : "rgba(255,255,255,0.07)",
                  borderWidth: d.today && !d.done ? 1.5 : 0,
                  borderColor: "rgba(255,159,69,0.75)",
                  borderStyle: d.today && !d.done ? "dashed" : "solid",
                }}
              >
                {d.done && <Flame size={15} color="#fff" fill="#fff" strokeWidth={2} />}
              </View>
            </View>
          ))}
        </View>

        <Text style={{ marginTop: 16, fontSize: 13.5, lineHeight: 19, color: "rgba(255,255,255,0.78)" }}>{line}</Text>
        {!s.todayDone && (
          <Pressable onPress={onWrite} accessibilityRole="button" style={({ pressed }) => ({ marginTop: 14, height: 44, borderRadius: 22, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#fff", opacity: pressed ? 0.85 : 1 })}>
            <Plus size={17} color="#0B0B0B" strokeWidth={2.6} />
            <Text style={{ fontSize: 15, fontWeight: "700", color: "#0B0B0B" }}>Anotar agora</Text>
          </Pressable>
        )}

        {s.next && (
          <Pressable onPress={() => onMedal(s.next as Medal)} style={{ marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)", flexDirection: "row", alignItems: "center", gap: 12 }}>
            <MedalArt m={s.next} size={42} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 11.5, fontWeight: "700", letterSpacing: 0.8, color: "rgba(255,255,255,0.55)" }}>PRÓXIMA MEDALHA</Text>
              <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 14.5, fontWeight: "700", color: "#fff" }}>
                {s.next.title}
              </Text>
              <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 12.5, color: "rgba(255,255,255,0.65)" }}>
                {s.next.name} · {toNext === 1 ? "falta 1 dia" : `faltam ${toNext} dias`}
              </Text>
            </View>
            <ChevronRight size={16} color="rgba(255,255,255,0.5)" />
          </Pressable>
        )}
      </View>
      <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 28, borderCurve: "continuous", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" }} />
    </View>
  );
}
