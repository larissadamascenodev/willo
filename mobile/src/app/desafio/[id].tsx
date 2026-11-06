import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import Room from "~/components/Room";
import BackButton from "~/components/BackButton";
import ConfirmGlass from "~/components/ConfirmGlass";
import Surface from "~/components/Surface";
import { ChallengeCover } from "~/components/desafios/ChallengeTile";
import { Check, Flame } from "~/components/icons";
import { useAuth } from "~/lib/auth";
import { money } from "~/lib/money";
import { showToast } from "~/lib/toast";
import { abandonChallenge, calendarOf, loadOne, restartChallenge, savedSoFar, tickToday, type Running, type Tx } from "~/lib/challenges";
import { th } from "~/theme/theme";
import { GREEN, INK, RED } from "~/theme/tokens";
import { type as T } from "~/theme/type";

/**
 * One challenge, on a page of its own.
 *
 * Its picture across the top under a dark veil, with its name and the day it is on.
 * Then the flame — the days in a row with a check-in, and the best run — and the
 * button to check in today. Then the challenge as a calendar, every day of it: the
 * days checked in with a flame, the clean ones Willo confirmed, the day it broke,
 * today ringed, the rest to come. Then what it has kept in the pocket so far and how
 * many days are left, and, at the foot, starting over or leaving it.
 */

const FIRE = "#FF9F45";
const WEEK = ["D", "S", "T", "Q", "Q", "S", "S"];

export default function DesafioPage() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [r, setR] = useState<Running | null>(null);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const load = useCallback(async () => {
    if (!user || !id) return;
    const got = await loadOne(user.id, id);
    if (!got) setMissing(true);
    else {
      setR(got.running);
      setTxs(got.txs);
    }
  }, [user, id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const checkIn = async () => {
    if (!user || !r || busy) return;
    setBusy(true);
    try {
      await tickToday(user.id, r.id);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      await load();
    } catch {
      showToast("Não foi possível fazer o check-in. Tente de novo.");
    } finally {
      setBusy(false);
    }
  };

  const restart = async () => {
    if (!r) return;
    await restartChallenge(r.id);
    showToast("Recomeçou hoje");
    await load();
  };

  const leave = async () => {
    if (!r) return;
    await abandonChallenge(r.id);
    setLeaving(false);
    showToast("Desafio encerrado");
    router.back();
  };

  if (missing) {
    return (
      <Room>
        <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16 }}>
          <BackButton />
          <Text style={{ marginTop: 40, textAlign: "center", fontSize: 15, color: th(INK.soft) }}>Esse desafio não está mais aqui.</Text>
        </View>
      </Room>
    );
  }
  if (!r) {
    return (
      <Room>
        <ActivityIndicator color={th(INK.soft)} style={{ marginTop: insets.top + 120 }} />
      </Room>
    );
  }

  const hero = Math.round(width * 0.9);
  const broken = r.state === "broken";
  const finished = r.state === "finished";
  const days = calendarOf(r, txs);
  const lead = days.length ? days[0].weekday : 0;
  const cell = Math.floor((width - 32 - 28 - 2 - 6 * 6) / 7);
  const left = Math.max(0, r.template.days - r.done);
  const saved = savedSoFar(r, txs);

  return (
    <Room>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 48 }} showsVerticalScrollIndicator={false}>
        {/* The picture, the name, the day: a card of its own at the top, dark in both themes. */}
        <View style={{ marginTop: insets.top + 6, marginHorizontal: 12, height: hero, borderRadius: 34, borderCurve: "continuous", overflow: "hidden", backgroundColor: "#0D0E10" }}>
          <ChallengeCover template={r.template} cover={r.cover} width={width - 24} height={hero} />
          <LinearGradient colors={["rgba(8,9,10,0.4)", "rgba(8,9,10,0)", "rgba(8,9,10,0.88)"]} locations={[0, 0.35, 1]} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
          <View style={{ position: "absolute", top: 12, left: 12 }}>
            <BackButton onImage />
          </View>
          <View style={{ position: "absolute", left: 20, right: 20, bottom: 20 }}>
            <Text style={{ fontSize: 12, fontWeight: "700", letterSpacing: 1.4, color: "rgba(255,255,255,0.72)" }}>
              {finished ? "DESAFIO CUMPRIDO" : broken ? "DESAFIO QUEBRADO" : `DIA ${Math.min(r.done + (r.tickedToday ? 0 : 1), r.template.days)} DE ${r.template.days}`}
            </Text>
            <Text style={{ marginTop: 6, fontSize: 28, fontWeight: "800", letterSpacing: -0.8, lineHeight: 32, color: "#fff" }}>{r.template.name}</Text>
            <Text style={{ marginTop: 6, fontSize: 14, lineHeight: 19, color: "rgba(255,255,255,0.78)" }}>{r.template.line}</Text>
          </View>
          <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 34, borderCurve: "continuous", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }} />
        </View>

        <View style={{ paddingHorizontal: 16 }}>
          {/* The flame, and today's check-in. */}
          <Surface style={{ marginTop: 16 }}>
            <View style={{ padding: 18, flexDirection: "row", alignItems: "center", gap: 16 }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", backgroundColor: r.streak > 0 ? "rgba(255,159,69,0.16)" : th("rgba(255,255,255,0.06)", "bg") }}>
                <Flame size={30} color={r.streak > 0 ? FIRE : th(INK.faint)} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 30, fontWeight: "800", letterSpacing: -1, color: th("#fff") }}>
                  {r.streak} {r.streak === 1 ? "dia" : "dias"}
                </Text>
                <Text style={{ marginTop: 1, fontSize: 13.5, color: th(INK.soft) }}>
                  seguidos de check-in{r.best > r.streak ? ` · recorde ${r.best}` : ""}
                </Text>
              </View>
            </View>

            {!finished && !broken && (
              <View style={{ paddingHorizontal: 18, paddingBottom: 18 }}>
                {r.tickedToday ? (
                  <Animated.View entering={ZoomIn.duration(260)} style={{ height: 52, borderRadius: 26, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "rgba(103,205,103,0.16)" }}>
                    <Check size={18} color={th(GREEN)} strokeWidth={2.8} />
                    <Text style={{ fontSize: 15.5, fontWeight: "700", color: th(GREEN) }}>Check-in de hoje feito</Text>
                  </Animated.View>
                ) : (
                  <Pressable
                    onPress={() => void checkIn()}
                    disabled={busy}
                    accessibilityRole="button"
                    style={({ pressed }) => ({ height: 52, borderRadius: 26, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: th("#fff", "bg"), opacity: pressed || busy ? 0.85 : 1 })}
                  >
                    {busy ? <ActivityIndicator color={th("#0B0B0B")} /> : <Flame size={18} color={FIRE} strokeWidth={2.4} />}
                    <Text style={{ fontSize: 16, fontWeight: "700", color: th("#0B0B0B") }}>Fazer check-in de hoje</Text>
                  </Pressable>
                )}
              </View>
            )}
          </Surface>

          {/* Where it stands, in a line, when Willo has something to say. */}
          {(broken || r.template.kind !== "manual") && (
            <Text style={{ marginTop: 12, paddingHorizontal: 4, fontSize: 13.5, lineHeight: 19, color: th(broken ? RED : INK.soft) }}>{r.note}</Text>
          )}

          {/* The challenge, day by day. */}
          <Text style={[T.eyebrow, { marginTop: 26, marginBottom: 10, paddingHorizontal: 4 }]}>Calendário</Text>
          <Surface>
            <View style={{ padding: 14 }}>
              <View style={{ flexDirection: "row", gap: 6, marginBottom: 8 }}>
                {WEEK.map((w, i) => (
                  <Text key={i} style={{ width: cell, textAlign: "center", fontSize: 11.5, fontWeight: "600", color: th(INK.softer) }}>
                    {w}
                  </Text>
                ))}
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {Array.from({ length: lead }).map((_, i) => (
                  <View key={`pad${i}`} style={{ width: cell, height: cell }} />
                ))}
                {days.map((d) => (
                  <Animated.View key={d.iso} entering={FadeIn.duration(200)}>
                    <DayCell size={cell} day={d.day} state={d.state} />
                  </Animated.View>
                ))}
              </View>
              <View style={{ marginTop: 14, flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
                <Key color={FIRE} label="Check-in" />
                {r.template.kind !== "manual" && <Key color={th("rgba(255,255,255,0.5)")} label="Dia limpo" />}
                <Key color={RED} label="Quebrou" />
              </View>
            </View>
          </Surface>

          {/* What it has kept, and what is left. */}
          <View style={{ marginTop: 16, flexDirection: "row", gap: 10 }}>
            <Stat label={saved > 0 ? "Economizado até agora" : "Dias cumpridos"} value={saved > 0 ? money(saved) : String(r.done)} tone={saved > 0 ? GREEN : undefined} />
            <Stat label="Faltam" value={`${left} ${left === 1 ? "dia" : "dias"}`} />
          </View>

          <View style={{ marginTop: 22, gap: 6 }}>
            {(broken || finished) && (
              <Pressable
                onPress={() => void restart()}
                style={({ pressed }) => ({ height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center", backgroundColor: th("#fff", "bg"), opacity: pressed ? 0.85 : 1 })}
              >
                <Text style={{ fontSize: 15.5, fontWeight: "700", color: th("#0B0B0B") }}>{finished ? "Fazer de novo" : "Recomeçar hoje"}</Text>
              </Pressable>
            )}
            {!finished && (
              <Pressable onPress={() => setLeaving(true)} style={({ pressed }) => ({ height: 44, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}>
                <Text style={{ fontSize: 14.5, color: th(INK.soft) }}>Encerrar desafio</Text>
              </Pressable>
            )}
          </View>
        </View>
      </ScrollView>

      <ConfirmGlass open={leaving} title="Encerrar o desafio?" confirmLabel="Encerrar" busyLabel="Encerrando…" onConfirm={() => void leave()} onClose={() => setLeaving(false)}>
        Os dias até aqui ficam no seu histórico. Dá para começar de novo quando quiser.
      </ConfirmGlass>
    </Room>
  );
}

function DayCell({ size, day, state }: { size: number; day: number; state: "checked" | "clean" | "broken" | "today" | "future" | "missed" }) {
  const base = { width: size, height: size, borderRadius: size * 0.32, alignItems: "center" as const, justifyContent: "center" as const };
  if (state === "checked")
    return (
      <View style={[base, { backgroundColor: "rgba(255,159,69,0.18)" }]}>
        <Flame size={size * 0.42} color={FIRE} strokeWidth={2.2} />
        <Text style={{ position: "absolute", bottom: 2, fontSize: 9, fontWeight: "700", color: FIRE }}>{day}</Text>
      </View>
    );
  if (state === "broken")
    return (
      <View style={[base, { backgroundColor: "rgba(248,113,113,0.2)" }]}>
        <Text style={{ fontSize: 13, fontWeight: "700", color: RED }}>{day}</Text>
      </View>
    );
  return (
    <View
      style={[
        base,
        {
          backgroundColor: state === "clean" ? th("rgba(255,255,255,0.1)", "bg") : th("rgba(255,255,255,0.03)", "bg"),
          borderWidth: state === "today" ? 1.5 : 0,
          borderColor: th("#fff", "line"),
        },
      ]}
    >
      <Text style={{ fontSize: 13, fontWeight: state === "today" ? "700" : "500", color: th(state === "future" || state === "missed" ? INK.faint : "#fff") }}>{day}</Text>
    </View>
  );
}

function Key({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ fontSize: 12, color: th(INK.soft) }}>{label}</Text>
    </View>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <Surface style={{ flex: 1 }}>
      <View style={{ padding: 14 }}>
        <Text style={{ fontSize: 12.5, color: th(INK.soft) }}>{label}</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit style={{ marginTop: 4, fontSize: 20, fontWeight: "800", letterSpacing: -0.5, color: th(tone ?? "#fff") }}>
          {value}
        </Text>
      </View>
    </Surface>
  );
}
