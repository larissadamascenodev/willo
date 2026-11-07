import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import Room from "~/components/Room";
import BackButton from "~/components/BackButton";
import SegmentedTabs from "~/components/SegmentedTabs";
import Surface from "~/components/Surface";
import WilloBot from "~/components/willo/WilloBot";
import { MedalArt } from "~/components/desafios/Medal3D";
import MedalDetail from "~/components/desafios/MedalDetail";
import { medalLeft, medalsOf, type Medal } from "~/lib/medals";
import { ActivePortrait, GridOffer, SuggestionCard } from "~/components/desafios/ChallengeTile";
import ChallengePreview from "~/components/desafios/ChallengePreview";
import MakeChallenge from "~/components/desafios/MakeChallenge";
import { ChevronRight, Plus, Trophy } from "~/components/icons";
import { useAuth } from "~/lib/auth";
import { money } from "~/lib/money";
import { showToast } from "~/lib/toast";
import { estimateSavings, loadChallenges, startChallenge, type ChallengeData, type Template } from "~/lib/challenges";
import { th, useThemeRedraw } from "~/theme/theme";
import { INK } from "~/theme/tokens";
import { type as T } from "~/theme/type";

/**
 * Desafios e conquistas.
 *
 * Challenges first: the ones running, each a ring filling day by day with one line
 * on where it stands — Willo checks most of them from the entries, a few are ticked
 * by hand. Then the ones worth starting, picked from where the money went in the last
 * 30 days, each saying what it would keep and how the month would close with it.
 * Then one's own, made with Willo in three questions, and the rest of the list.
 *
 * Conquistas: nine medals, each in bronze, silver and gold, worked out from what the
 * person has done — and how close the next step is.
 */

type Tab = "desafios" | "conquistas";

export default function Desafios() {
  /* Drawn again in place when the theme changes. */
  useThemeRedraw();
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const half = Math.floor((screenW - 32 - 12) / 2);
  /* A little wider than half, so the next card shows at the edge and says the row goes on. */
  const carouselW = Math.floor((screenW - 32) * 0.56);
  const { user } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("desafios");
  const [data, setData] = useState<ChallengeData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [picked, setPicked] = useState<Template | null>(null);
  const [medal, setMedal] = useState<Medal | null>(null);
  const [show, setShow] = useState<"todas" | "ganhas" | "faltam">("todas");
  const [making, setMaking] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setData(await loadChallenges(user.id));
    } catch {
      showToast("Não foi possível carregar os desafios.");
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const start = async (t: Template) => {
    if (!user || busy) return;
    setBusy(true);
    try {
      await startChallenge(user.id, t);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      showToast("Desafio começou hoje");
      setPicked(null);
      setMaking(false);
      await load();
    } catch {
      showToast("Não foi possível começar. Tente de novo.");
    } finally {
      setBusy(false);
    }
  };

  const savingsOf = (t: Template) => (data ? (estimateSavings(t, data.txs)?.saves ?? t.saves ?? 0) : 0);
  const medals = data ? medalsOf(data.medals) : [];
  const won = medals.filter((m) => m.earned).length;
  /* The medal closest to being won, among those that can be seen. */
  const nearest = medals.filter((m) => !m.earned && !m.hidden && m.value > 0).sort((a, b) => b.value / b.step - a.value / a.step)[0] ?? null;
  const cellMedal = Math.min(96, Math.floor((screenW - 32) / 3) - 22);
  const suggestedKeys = new Set((data?.suggested ?? []).map((s) => s.template.key));
  const others = (data?.available ?? []).filter((t) => !suggestedKeys.has(t.key));

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
              await load();
              setRefreshing(false);
            }}
            tintColor={th(INK.softer)}
          />
        }
      >
        <View style={{ height: 44, justifyContent: "center" }}>
          <BackButton />
        </View>
        <Text style={[T.title, { marginTop: 8, paddingHorizontal: 4 }]}>Desafios</Text>
        <Text style={{ marginTop: 4, paddingHorizontal: 4, fontSize: 14, color: th(INK.soft) }}>
          {data ? `${data.running.length} em andamento · ${won} de ${medals.length} medalhas` : " "}
        </Text>

        <View style={{ marginTop: 18 }}>
          <SegmentedTabs
            value={tab}
            onChange={setTab}
            options={[
              { key: "desafios" as const, label: "Desafios" },
              { key: "conquistas" as const, label: "Conquistas" },
            ]}
          />
        </View>

        {!data ? (
          <ActivityIndicator color={th(INK.soft)} style={{ marginTop: 60 }} />
        ) : tab === "desafios" ? (
          <Animated.View entering={FadeIn.duration(220)}>
            {/* Running: a carousel of portrait cards, each opening its own page. */}
            {data.running.length > 0 && (
              <>
                <Eyebrow>Em andamento</Eyebrow>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  decelerationRate="fast"
                  snapToInterval={carouselW + 12}
                  style={{ marginHorizontal: -16 }}
                  contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
                >
                  {data.running.map((r) => (
                    <ActivePortrait key={r.id} r={r} width={carouselW} onPress={() => router.push(`/desafio/${r.id}` as never)} />
                  ))}
                </ScrollView>
              </>
            )}

            {/* One's own, with Willo: set apart, right after what is running. */}
            <View style={{ marginTop: 22 }}>
              <Pressable onPress={() => setMaking(true)} accessibilityRole="button" accessibilityLabel="Criar um desafio com o Willo" style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
                <View style={{ borderRadius: 26, borderCurve: "continuous", overflow: "hidden", backgroundColor: "#101320" }}>
                  <LinearGradient colors={["#1B2140", "#121626", "#0E1018"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16 }}>
                    <View style={{ width: 64, height: 64, alignItems: "center", justifyContent: "center" }}>
                      <WilloBot size={64} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontSize: 12, fontWeight: "700", letterSpacing: 1.2, color: "rgba(191,227,255,0.8)" }}>CRIAR O MEU</Text>
                      <Text style={{ marginTop: 3, fontSize: 17, fontWeight: "800", letterSpacing: -0.3, color: "#fff" }}>Monte um desafio com o Willo</Text>
                      <Text style={{ marginTop: 3, fontSize: 13, lineHeight: 18, color: "rgba(255,255,255,0.68)" }}>Em quatro passos, e ele calcula quanto você economiza</Text>
                    </View>
                    <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" }}>
                      <Plus size={18} color="#0B0B0B" strokeWidth={2.6} />
                    </View>
                  </View>
                  <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 26, borderCurve: "continuous", borderWidth: 1, borderColor: "rgba(124,196,255,0.22)" }} />
                </View>
              </Pressable>
            </View>

            {/* Aimed at where the money is going. */}
            {data.suggested.length > 0 && (
              <>
                <Eyebrow>Sugeridos para você</Eyebrow>
                <View style={{ gap: 16 }}>
                  {data.suggested.map((sg) => (
                    <SuggestionCard
                      key={sg.template.key}
                      template={sg.template}
                      cover={data.covers[sg.template.key]}
                      reason={sg.reason}
                      saves={money(sg.saves)}
                      month={money(data.leftover + sg.saves)}
                      ink={th("#fff")}
                      soft={th(INK.soft)}
                      panel={th("rgba(255,255,255,0.06)", "bg")}
                      rule={th("rgba(255,255,255,0.1)", "line")}
                      buttonBg={th("#fff", "bg")}
                      buttonInk={th("#0B0B0B")}
                      onPress={() => setPicked(sg.template)}
                    />
                  ))}
                </View>
              </>
            )}

            {/* Every other challenge, two by two. */}
            {others.length > 0 && (
              <>
                <Eyebrow>Todos os desafios</Eyebrow>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                  {others.map((t) => (
                    <GridOffer
                      key={t.key}
                      template={t}
                      cover={data.covers[t.key]}
                      width={half}
                      saves={savingsOf(t) > 0 ? money(savingsOf(t)) : undefined}
                      onPress={() => setPicked(t)}
                    />
                  ))}
                </View>
              </>
            )}

            {data.finished.length > 0 && (
              <>
                <Eyebrow>Cumpridos</Eyebrow>
                <Surface>
                  {data.finished.slice(0, 8).map((r, i) => (
                    <View key={r.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderTopColor: th("rgba(255,255,255,0.06)", "line") }}>
                      <Trophy size={17} color={th("#E9C462")} strokeWidth={2} />
                      <Text numberOfLines={1} style={{ flex: 1, fontSize: 14.5, color: th("#fff") }}>
                        {r.template.name}
                      </Text>
                      {r.completedAt && <Text style={{ fontSize: 12, color: th(INK.softer) }}>{new Date(r.completedAt).toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}</Text>}
                    </View>
                  ))}
                </Surface>
              </>
            )}
          </Animated.View>
        ) : (
          <Animated.View entering={FadeIn.duration(220)}>
            {/* Where the collection stands, and the nearest one to win. */}
            <Surface style={{ marginTop: 18 }}>
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
                        {nearest.level ? `${nearest.name} · ${nearest.title}` : nearest.name}
                      </Text>
                      <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 12.5, color: th(INK.soft) }}>
                        {medalLeft(nearest)}
                      </Text>
                    </View>
                    <ChevronRight size={16} color={th(INK.faint)} />
                  </Pressable>
                )}
              </View>
            </Surface>

            <View style={{ marginTop: 16, flexDirection: "row", gap: 8 }}>
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
            {MEDAL_GROUPS.map((group) => {
              const list = medals.filter((m) => m.group === group && (show === "todas" || (show === "ganhas" ? m.earned : !m.earned)));
              if (!list.length) return null;
              return (
                <View key={group}>
                  <Eyebrow>{group}</Eyebrow>
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

      {/* A challenge, before starting it. */}
      <ChallengePreview
        template={picked}
        cover={picked && data ? data.covers[picked.key] : null}
        saves={picked ? savingsOf(picked) : 0}
        month={data ? data.leftover : null}
        busy={busy}
        onStart={() => picked && void start(picked)}
        onClose={() => setPicked(null)}
      />

      {/* A medal, opened on a page of its own. */}
      <MedalDetail medal={medal} onClose={() => setMedal(null)} />

      <MakeChallenge
        open={making}
        data={data}
        busy={busy}
        onClose={() => setMaking(false)}
        onStart={(t) => void start(t)}
      />
    </Room>
  );
}

/* ── Pieces ─────────────────────────────────────────────────────────────────── */

const MEDAL_GROUPS = ["Registro", "Contas e cartões", "Guardar", "Mês saudável", "Desafios", "Uso do Willo", "Secretas"] as const;

function Eyebrow({ children }: { children: string }) {
  return <Text style={[T.eyebrow, { marginTop: 26, marginBottom: 10, paddingHorizontal: 4 }]}>{children}</Text>;
}
