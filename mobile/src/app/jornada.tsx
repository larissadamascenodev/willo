import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import Room from "~/components/Room";
import PageHeader from "~/components/PageHeader";
import Surface from "~/components/Surface";
import { MedalArt } from "~/components/desafios/Medal3D";
import { AlertTriangle, Check, ChevronRight, Clock, Flame, TrendingUp } from "~/components/icons";
import { useAuth } from "~/lib/auth";
import { STAGES, type Journey, type MiniGoal } from "~/lib/journey";
import { useJourney } from "~/lib/useJourney";
import { daysInARow, loadConquistas, type Conquistas } from "~/lib/conquistas";
import { money } from "~/lib/money";
import { th, useThemeRedraw } from "~/theme/theme";
import { GREEN, INK } from "~/theme/tokens";

/**
 * Sua Jornada.
 *
 * Two sides behind one pill. Jornada: the five stages with the person on theirs, what
 * the next one asks (each with its numbers), the three mini-metas of the moment —
 * chosen from the records, never skipped, each worth points once the records show it
 * done — and the points and medals, the old Conquistas, in one place. Perfil: the
 * profile those same records draw — the stage in a sentence, four traits, the strong
 * point and the one asking attention, what an hour of work is worth, and what Willo
 * keeps an eye on.
 */

const AMBER = "#F5B544";
const FIRE = "#FF9F45";

export default function JornadaScreen() {
  useThemeRedraw();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { journey, reload } = useJourney();
  const [tab, setTab] = useState<"jornada" | "perfil">("jornada");
  const [conq, setConq] = useState<Conquistas | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadConq = useCallback(async () => {
    if (!user) return;
    try {
      setConq(await loadConquistas(user.id));
    } catch {
      /* The section waits. */
    }
  }, [user]);
  useEffect(() => {
    void loadConq();
  }, [loadConq]);

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
              await Promise.all([reload(), loadConq()]);
              setRefreshing(false);
            }}
            tintColor={th(INK.softer)}
          />
        }
      >
        <PageHeader title="Sua jornada" />

        <Pill tab={tab} onChange={setTab} />

        {!journey ? (
          <ActivityIndicator color={th(INK.soft)} style={{ marginTop: 60 }} />
        ) : (
          <Animated.View key={tab} entering={FadeIn.duration(220)}>
            {tab === "jornada" ? (
              <JourneySide j={journey} conq={conq} onGoal={(g) => router.push(g.href as never)} onMedals={() => router.push("/conquistas" as never)} />
            ) : (
              <ProfileSide j={journey} />
            )}
          </Animated.View>
        )}
      </ScrollView>
    </Room>
  );
}

function Pill({ tab, onChange }: { tab: "jornada" | "perfil"; onChange: (t: "jornada" | "perfil") => void }) {
  return (
    <View style={{ marginTop: 16, flexDirection: "row", padding: 4, borderRadius: 23, backgroundColor: th("rgba(255,255,255,0.06)", "bg") }}>
      {(["jornada", "perfil"] as const).map((k) => {
        const on = tab === k;
        return (
          <Pressable
            key={k}
            onPress={() => {
              if (on) return;
              void Haptics.selectionAsync().catch(() => undefined);
              onChange(k);
            }}
            style={{ flex: 1, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: on ? th("rgba(255,255,255,0.13)", "bg") : "transparent" }}
          >
            <Text style={{ fontSize: 14.5, fontWeight: on ? "700" : "600", color: th(on ? "#fff" : INK.soft) }}>{k === "jornada" ? "Jornada" : "Perfil"}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const Eyebrow = ({ children }: { children: string }) => (
  <Text style={{ fontSize: 11.5, fontWeight: "700", letterSpacing: 1.6, color: th(INK.softer) }}>{children}</Text>
);

function Bar({ value, hex = GREEN, height = 6 }: { value: number; hex?: string; height?: number }) {
  return (
    <View style={{ height, borderRadius: height / 2, overflow: "hidden", backgroundColor: th("rgba(255,255,255,0.1)", "bg") }}>
      <View style={{ width: `${Math.max(3, Math.round(value * 100))}%`, height, borderRadius: height / 2, backgroundColor: th(hex) }} />
    </View>
  );
}

/* ───────────── Jornada ───────────── */

function JourneySide({ j, conq, onGoal, onMedals }: { j: Journey; conq: Conquistas | null; onGoal: (g: MiniGoal) => void; onMedals: () => void }) {
  const won = conq?.medals.filter((m) => m.earned).length ?? 0;
  const nearest = conq?.medals.filter((m) => !m.earned && !m.hidden && m.value > 0).sort((a, b) => b.value / b.step - a.value / a.step)[0] ?? null;
  return (
    <View>
      {j.change && (
        <Animated.View entering={FadeInDown.duration(380)} style={{ marginTop: 16, flexDirection: "row", gap: 10, padding: 14, borderRadius: 18, backgroundColor: j.change.up ? "rgba(103,205,103,0.12)" : "rgba(245,181,68,0.1)" }}>
          {j.change.up ? <TrendingUp size={18} color={th(GREEN)} strokeWidth={2.4} /> : <AlertTriangle size={18} color={AMBER} strokeWidth={2.4} />}
          <Text style={{ flex: 1, fontSize: 14, lineHeight: 20, color: th("#fff") }}>
            {j.change.up
              ? `Você subiu para ${j.change.to}. O que você fez nas últimas semanas apareceu nos números.`
              : `Você voltou para ${j.change.to}. Acontece, e o caminho de volta está logo abaixo.`}
          </Text>
        </Animated.View>
      )}

      {/* Where they are. */}
      <Surface style={{ marginTop: 16 }}>
        <View style={{ padding: 18, gap: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Eyebrow>{`ETAPA ${j.index + 1} DE ${STAGES.length}`}</Eyebrow>
            {j.estimated && (
              <View style={{ paddingHorizontal: 8, height: 20, borderRadius: 10, justifyContent: "center", backgroundColor: th("rgba(255,255,255,0.08)", "bg") }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: th(INK.soft) }}>ESTIMADA</Text>
              </View>
            )}
          </View>
          <View>
            <Text style={{ fontSize: 30, fontWeight: "800", letterSpacing: -1, color: th("#fff") }}>{j.stage}</Text>
            <Text style={{ marginTop: 6, fontSize: 14.5, lineHeight: 21, color: th(INK.soft) }}>{j.line}</Text>
          </View>
          <Stages j={j} />
          {j.estimated && (
            <Text style={{ fontSize: 12.5, lineHeight: 18, color: th(INK.softer) }}>
              Por enquanto é a etapa das suas respostas do início. Com {j.daysToReal > 0 ? `mais ${j.daysToReal} ${j.daysToReal === 1 ? "dia" : "dias"}` : "um mês"} de registros, ela passa a sair dos seus números.
            </Text>
          )}
        </View>
      </Surface>

      {/* What the next one asks. */}
      {j.next && j.requirements.length > 0 && (
        <View style={{ marginTop: 26 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingHorizontal: 4 }}>
            <Eyebrow>{`PARA CHEGAR EM ${j.next.toUpperCase()}`}</Eyebrow>
            <Text style={{ fontSize: 13, fontWeight: "700", color: th("#fff") }}>{Math.round(j.toNext * 100)}%</Text>
          </View>
          <Surface style={{ marginTop: 10 }}>
            {j.requirements.map((r, i) => (
              <View key={r.label} style={{ padding: 14, gap: 8, borderTopWidth: i ? 1 : 0, borderTopColor: th("rgba(255,255,255,0.06)", "line") }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: r.done ? th(GREEN) : "transparent", borderWidth: r.done ? 0 : 2, borderColor: th("rgba(255,255,255,0.22)", "line") }}>
                    {r.done && <Check size={13} color="#0B0B0B" strokeWidth={3.2} />}
                  </View>
                  <Text style={{ flex: 1, fontSize: 14.5, fontWeight: "600", color: th("#fff") }}>{r.label}</Text>
                  <Text style={{ fontSize: 12.5, color: th(r.done ? GREEN : INK.soft) }}>{r.detail}</Text>
                </View>
                {!r.done && (
                  <View style={{ paddingLeft: 32 }}>
                    <Bar value={r.progress} hex="#fff" height={4} />
                  </View>
                )}
              </View>
            ))}
          </Surface>
        </View>
      )}

      {/* The mini-metas. */}
      <View style={{ marginTop: 26 }}>
        <View style={{ paddingHorizontal: 4 }}>
          <Eyebrow>MINI-METAS AGORA</Eyebrow>
          <Text style={{ marginTop: 4, fontSize: 13, lineHeight: 18, color: th(INK.soft) }}>O Willo escolhe pelos seus números e confere sozinho quando você cumpre.</Text>
        </View>
        <View style={{ marginTop: 10, gap: 10 }}>
          {j.goals.map((g, i) => (
            <Animated.View key={g.id} entering={FadeInDown.delay(i * 60).duration(320)}>
              <Pressable onPress={() => onGoal(g)} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.985 : 1 }] })}>
                <Surface>
                  <View style={{ padding: 14, gap: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: th(g.done ? GREEN : g.tone === "urgente" ? AMBER : "#fff") }} />
                      <Text style={{ flex: 1, fontSize: 15, fontWeight: "700", color: th("#fff") }}>{g.title}</Text>
                      <View style={{ paddingHorizontal: 9, height: 24, borderRadius: 12, justifyContent: "center", backgroundColor: th("rgba(103,205,103,0.14)", "bg") }}>
                        <Text style={{ fontSize: 12.5, fontWeight: "800", color: th(GREEN) }}>+{g.points}</Text>
                      </View>
                    </View>
                    <Text style={{ paddingLeft: 18, fontSize: 13, color: th(INK.soft) }}>{g.detail}</Text>
                    {g.progress > 0 && !g.done && (
                      <View style={{ paddingLeft: 18 }}>
                        <Bar value={g.progress} hex={g.tone === "urgente" ? AMBER : GREEN} height={4} />
                      </View>
                    )}
                  </View>
                </Surface>
              </Pressable>
            </Animated.View>
          ))}
        </View>
      </View>

      {/* Points and medals: the Conquistas, here. */}
      <View style={{ marginTop: 26 }}>
        <View style={{ paddingHorizontal: 4 }}>
          <Eyebrow>PONTOS E CONQUISTAS</Eyebrow>
        </View>
        <Surface style={{ marginTop: 10 }}>
          <View style={{ padding: 16, gap: 14 }}>
            <View style={{ flexDirection: "row" }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 26, fontWeight: "800", letterSpacing: -0.8, color: th("#fff") }}>{j.points}</Text>
                <Text style={{ fontSize: 12.5, color: th(INK.soft) }}>pontos · {j.pointsThisMonth} este mês</Text>
              </View>
              {conq && (
                <View style={{ flex: 1, alignItems: "flex-end" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <Flame size={18} color={FIRE} strokeWidth={2.4} />
                    <Text style={{ fontSize: 22, fontWeight: "800", color: th("#fff") }}>{conq.streak.current}</Text>
                  </View>
                  <Text style={{ fontSize: 12.5, color: th(INK.soft) }}>{daysInARow(conq.streak.current)}</Text>
                </View>
              )}
            </View>
            {conq && (
              <Pressable onPress={onMedals} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 14, borderTopWidth: 1, borderTopColor: th("rgba(255,255,255,0.07)", "line"), opacity: pressed ? 0.7 : 1 })}>
                {nearest ? <MedalArt m={nearest} size={46} /> : null}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 14.5, fontWeight: "700", color: th("#fff") }}>
                    {won} de {conq.medals.length} medalhas
                  </Text>
                  <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 12.5, color: th(INK.soft) }}>
                    {nearest ? `Mais perto: ${nearest.level ? nearest.title : nearest.name}` : "Ver todas as medalhas"}
                  </Text>
                </View>
                <ChevronRight size={16} color={th(INK.faint)} />
              </Pressable>
            )}
          </View>
        </Surface>
      </View>
    </View>
  );
}

function Stages({ j }: { j: Journey }) {
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {STAGES.map((s, i) => {
          const past = i < j.index;
          const here = i === j.index;
          return (
            <View key={s} style={{ flexDirection: "row", alignItems: "center", flex: i < STAGES.length - 1 ? 1 : 0 }}>
              <View
                style={{
                  width: here ? 16 : 12,
                  height: here ? 16 : 12,
                  borderRadius: 8,
                  backgroundColor: past ? th(GREEN) : here ? th("#fff", "bg") : "transparent",
                  borderWidth: past || here ? 0 : 2,
                  borderColor: th("rgba(255,255,255,0.28)", "line"),
                }}
              />
              {i < STAGES.length - 1 && <View style={{ flex: 1, height: 2, marginHorizontal: 4, borderRadius: 1, backgroundColor: past ? th(GREEN) : th("rgba(255,255,255,0.12)", "line") }} />}
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        {STAGES.map((s, i) => (
          <Text key={s} numberOfLines={2} style={{ width: "19%", fontSize: 10.5, lineHeight: 13, fontWeight: i === j.index ? "800" : "500", color: th(i === j.index ? "#fff" : INK.softer), textAlign: i === 0 ? "left" : i === STAGES.length - 1 ? "right" : "center" }}>
            {s}
          </Text>
        ))}
      </View>
    </View>
  );
}

/* ───────────── Perfil ───────────── */

function ProfileSide({ j }: { j: Journey }) {
  return (
    <View>
      <Surface style={{ marginTop: 16 }}>
        <View style={{ padding: 18, gap: 16 }}>
          <View>
            <Eyebrow>{j.estimated ? "SEU PERFIL · ESTIMADO" : "SEU PERFIL · DOS SEUS NÚMEROS"}</Eyebrow>
            <Text style={{ marginTop: 8, fontSize: 30, fontWeight: "800", letterSpacing: -1, color: th("#fff") }}>{j.stage}</Text>
            <Text style={{ marginTop: 6, fontSize: 14.5, lineHeight: 21, color: th(INK.soft) }}>{j.line}</Text>
          </View>
          {j.traits.map((t) => (
            <View key={t.label} style={{ gap: 7 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 14, color: th(INK.soft) }}>{t.label}</Text>
                <Text style={{ fontSize: 14, fontWeight: "700", color: th("#fff") }}>{t.word}</Text>
              </View>
              <Bar value={t.value} hex={t.value >= 0.7 ? GREEN : t.value >= 0.45 ? "#fff" : AMBER} height={5} />
            </View>
          ))}
        </View>
      </Surface>

      <View style={{ marginTop: 12, flexDirection: "row", gap: 10 }}>
        {[
          { eyebrow: "PONTO FORTE", t: j.strong, Icon: TrendingUp },
          { eyebrow: "PEDE ATENÇÃO", t: j.weak, Icon: AlertTriangle },
        ].map(({ eyebrow, t, Icon }) => (
          <Surface key={eyebrow} style={{ flex: 1 }}>
            <View style={{ padding: 14, gap: 8 }}>
              <Icon size={18} color={th(eyebrow === "PONTO FORTE" ? GREEN : AMBER)} strokeWidth={2.2} />
              <Eyebrow>{eyebrow}</Eyebrow>
              <Text style={{ fontSize: 15.5, lineHeight: 20, fontWeight: "700", color: th("#fff") }}>{t.label}</Text>
            </View>
          </Surface>
        ))}
      </View>

      {j.hour > 0 && (
        <Surface style={{ marginTop: 12 }}>
          <View style={{ padding: 16, gap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Clock size={16} color={th(INK.soft)} strokeWidth={2.2} />
              <Eyebrow>SUA HORA DE TRABALHO</Eyebrow>
            </View>
            <Text style={{ marginTop: 6, fontSize: 30, fontWeight: "800", letterSpacing: -1, color: th("#fff") }}>
              {money(j.hour)}
              <Text style={{ fontSize: 14, fontWeight: "600", letterSpacing: 0, color: th(INK.soft) }}> por hora</Text>
            </Text>
            <Text style={{ fontSize: 13, lineHeight: 18, color: th(INK.soft) }}>Um delivery de R$ 45 custa {Math.round((45 / j.hour) * 60)} minutos de trabalho. Contando 220 horas por mês.</Text>
          </View>
        </Surface>
      )}

      {j.watching.length > 0 && (
        <View style={{ marginTop: 22 }}>
          <View style={{ paddingHorizontal: 4 }}>
            <Eyebrow>O WILLO ACOMPANHA DE PERTO</Eyebrow>
          </View>
          <View style={{ marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {j.watching.map((w) => (
              <View key={w} style={{ paddingHorizontal: 12, height: 34, borderRadius: 17, justifyContent: "center", backgroundColor: th("rgba(255,255,255,0.07)", "bg") }}>
                <Text style={{ fontSize: 13.5, fontWeight: "600", color: th("#fff") }}>{w}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}
