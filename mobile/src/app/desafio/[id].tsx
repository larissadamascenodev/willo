import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import Animated, { FadeIn, FadeInDown, ZoomIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import Room from "~/components/Room";
import BackButton from "~/components/BackButton";
import RoundButton from "~/components/RoundButton";
import { CoverError, pickGoalCover } from "~/lib/goalCover";
import ConfirmGlass from "~/components/ConfirmGlass";
import Surface from "~/components/Surface";
import { ChallengeCover, accentOf } from "~/components/desafios/ChallengeTile";
import { Check, Flame, ImagePlus, Trophy } from "~/components/icons";
import { useAuth } from "~/lib/auth";
import { money } from "~/lib/money";
import { showToast } from "~/lib/toast";
import { DIFFICULTY_LABEL, abandonChallenge, calendarOf, estimateSavings, loadOne, restartChallenge, savedSoFar, setChallengeCover, tickToday, type Running, type Tx } from "~/lib/challenges";
import { isLight, th } from "~/theme/theme";
import { GREEN, GROUND_LIT, INK, RED } from "~/theme/tokens";
import { type as T } from "~/theme/type";

/**
 * One challenge, on a page of its own, laid out as a caixinha's page is.
 *
 * Its picture edge to edge at the top, melting into the page, with the day it is on,
 * its name and what it asks written on the fade, and a mark for every day of it. Then
 * the flame — the days in a row and the best run — with today's check-in. Then what it
 * has kept in the pocket, what the whole of it is worth, and the days left with the day
 * it ends. Then the challenge as a calendar, every day of it, and at the foot starting
 * over or leaving it.
 */

const FIRE = "#FF9F45";
/* How hard, in a colour that reads on the dark veil. */
const DIFF_TONE = { facil: "#8FE08F", medio: "#FFC46B", dificil: "#FF8A8A" } as const;
const WEEK = ["D", "S", "T", "Q", "Q", "S", "S"];

const dayMonth = (d: Date) => d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" }).replace(".", "");


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
  const [photoBusy, setPhotoBusy] = useState(false);

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

  const choosePhoto = async () => {
    if (!user || !r || photoBusy) return;
    setPhotoBusy(true);
    try {
      const url = await pickGoalCover(user.id);
      if (!url) return;
      await setChallengeCover(user.id, r.id, r.template, url);
      showToast("Foto do desafio salva");
      await load();
    } catch (e) {
      showToast(e instanceof CoverError ? e.message : "Não foi possível salvar a foto. Tente de novo.");
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = async () => {
    if (!user || !r) return;
    try {
      await setChallengeCover(user.id, r.id, r.template, null);
      await load();
    } catch {
      showToast("Não foi possível tirar a foto. Tente de novo.");
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

  const heroH = Math.round(width * 1.12) + insets.top;
  const broken = r.state === "broken";
  const finished = r.state === "finished";
  const days = calendarOf(r, txs);
  const lead = days.length ? days[0].weekday : 0;
  const cell = Math.floor((width - 32 - 32 - 6 * 6) / 7);
  const left = Math.max(0, r.template.days - r.done);
  const saved = savedSoFar(r, txs);
  const worth = estimateSavings(r.template, txs)?.saves ?? r.template.saves ?? 0;
  const share = Math.max(0, Math.min(1, r.done / r.template.days));
  const day = Math.min(r.done + (r.tickedToday ? 0 : 1), r.template.days);
  const start = new Date(`${r.startedAt.slice(0, 10)}T12:00:00`);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + r.template.days - 1);
  const accent = accentOf(r.template);
  /* The last seven days, ending today: lit with a check-in, green when Willo saw it clean. */
  const byDay = new Map(days.map((d) => [d.iso, d.state]));
  const today = new Date();
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6 + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const state = byDay.get(iso);
    return { iso, label: WEEK[d.getDay()], today: i === 6, lit: state === "checked", clean: state === "clean", out: !state };
  });
  const auto = r.template.kind !== "manual";

  return (
    /* A plain ground, so the picture melts into it with no seam. */
    <View style={{ flex: 1, backgroundColor: th(GROUND_LIT, "bg") }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 48 }} showsVerticalScrollIndicator={false}>
        {/* ══ Its picture, edge to edge, melting into the page under what it is and where it
              stands, as a caixinha's does. The veil starts low and soft, so the top of the
              picture keeps its own light. ══ */}
        <View style={{ height: heroH }}>
          <ChallengeCover template={r.template} cover={r.cover} width={width} height={heroH} />
          {/* A light shade under the clock in the dark theme only; in the light one the top of the picture is left as it is. */}
          {!isLight() && <LinearGradient colors={["rgba(0,0,0,0.35)", "rgba(0,0,0,0)"]} style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top + 100 }} />}
          <LinearGradient
            colors={th(["rgba(13,14,16,0)", "rgba(13,14,16,0.08)", "rgba(13,14,16,0.4)", "rgba(13,14,16,0.82)", GROUND_LIT], "grad")}
            locations={[0, 0.35, 0.62, 0.86, 1]}
            style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: Math.round(heroH * 0.48) }}
          />

        </View>

        <Animated.View entering={FadeInDown.duration(460)} style={{ marginTop: -92, paddingHorizontal: 22 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {finished ? (
              <GlassPill tone={GREEN} label="Desafio cumprido" />
            ) : broken ? (
              <GlassPill tone={RED} label="Desafio quebrado" />
            ) : (
              <GlassPill label={`Dia ${day} de ${r.template.days}`} />
            )}
            <GlassPill label={DIFFICULTY_LABEL[r.template.difficulty]} tone={DIFF_TONE[r.template.difficulty]} />
          </View>
          <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8} style={{ fontSize: 26, fontWeight: "800", letterSpacing: -0.8, lineHeight: 30, color: th("#fff") }}>{r.template.name}</Text>
          <Text style={{ marginTop: 6, fontSize: 14, lineHeight: 19, color: th("rgba(255,255,255,0.74)") }}>{r.template.line}</Text>

          {/* A mark for every day of it. */}
          <View style={{ marginTop: 18, flexDirection: "row", gap: r.template.days > 15 ? 2 : 3 }}>
            {Array.from({ length: r.template.days }).map((_, i) => (
              <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i < r.done ? th(broken ? RED : finished ? GREEN : accent) : th("rgba(255,255,255,0.16)", "bg") }} />
            ))}
          </View>
          <View style={{ marginTop: 9, flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 13.5, color: th(INK.soft) }}>
              <Text style={{ fontWeight: "700", color: th("#fff") }}>{r.done}</Text> de {r.template.days} dias cumpridos
            </Text>
            <Text style={{ fontSize: 13.5, fontWeight: "700", color: th("#fff") }}>{Math.round(share * 100)}%</Text>
          </View>
        </Animated.View>

        <View style={{ marginTop: 22, paddingHorizontal: 16 }}>
          {/* ══ The run of days: the flame and the count, the record beside it, the last
                seven days as a row of small flames, and today's check-in ══ */}
          <Animated.View entering={FadeInDown.delay(80).duration(420)}>
            <Surface>
              <View style={{ padding: 18 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                  <View style={{ width: 56, height: 56, borderRadius: 18, borderCurve: "continuous", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                    {r.streak > 0 ? (
                      <LinearGradient colors={["#FFB15E", "#FF6A3D"]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
                    ) : (
                      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: th("rgba(255,255,255,0.07)", "bg") }} />
                    )}
                    <View style={{ zIndex: 1 }}>
                      <Flame size={28} color={r.streak > 0 ? "#FFFFFF" : th(INK.faint)} strokeWidth={2.2} />
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: "700", letterSpacing: 1, color: th(INK.softer) }}>SEQUÊNCIA</Text>
                    <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 28, fontWeight: "800", letterSpacing: -0.9, color: th("#fff") }}>
                      {r.streak}
                      <Text style={{ fontSize: 15, fontWeight: "700", letterSpacing: -0.2, color: th(INK.soft) }}> {r.streak === 1 ? "dia seguido" : "dias seguidos"}</Text>
                    </Text>
                  </View>
                  <View style={{ alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: th("rgba(233,196,98,0.12)", "bg") }}>
                    <Trophy size={15} color={th("#E9C462")} strokeWidth={2.2} />
                    <Text style={{ marginTop: 2, fontSize: 15, fontWeight: "800", color: th("#fff") }}>{Math.max(r.best, r.streak)}</Text>
                    <Text style={{ fontSize: 10.5, fontWeight: "600", color: th(INK.soft) }}>recorde</Text>
                  </View>
                </View>

                {/* The last seven days. */}
                <View style={{ marginTop: 16, flexDirection: "row", justifyContent: "space-between" }}>
                  {week.map((d) => (
                    <View key={d.iso} style={{ alignItems: "center", gap: 6 }}>
                      <Text style={{ fontSize: 11.5, fontWeight: "700", color: th(d.today ? "#fff" : INK.softer) }}>{d.label}</Text>
                      <View
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 17,
                          alignItems: "center",
                          justifyContent: "center",
                          overflow: "hidden",
                          borderWidth: d.today && !d.lit ? 1.5 : 0,
                          borderColor: th("#fff", "line"),
                          backgroundColor: d.lit ? "transparent" : d.clean ? "rgba(103,205,103,0.16)" : th("rgba(255,255,255,0.05)", "bg"),
                        }}
                      >
                        {d.lit && <LinearGradient colors={["#FFB15E", "#FF6A3D"]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />}
                        <View style={{ zIndex: 1 }}>
                          {d.lit ? <Flame size={16} color="#FFFFFF" strokeWidth={2.4} /> : d.clean ? <Check size={14} color={th(GREEN)} strokeWidth={3} /> : <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: th(d.out ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.22)", "bg") }} />}
                        </View>
                      </View>
                    </View>
                  ))}
                </View>

                {!finished && !broken && (
                  <View style={{ marginTop: 18 }}>
                    {r.tickedToday ? (
                      <Animated.View entering={ZoomIn.duration(260)} style={{ height: 50, borderRadius: 25, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "rgba(103,205,103,0.14)" }}>
                        <Check size={18} color={th(GREEN)} strokeWidth={2.8} />
                        <Text style={{ fontSize: 15, fontWeight: "700", color: th(GREEN) }}>Feito hoje · volte amanhã</Text>
                      </Animated.View>
                    ) : (
                      <Pressable
                        onPress={() => void checkIn()}
                        disabled={busy}
                        accessibilityRole="button"
                        style={({ pressed }) => ({ height: 52, borderRadius: 26, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: th("#fff", "bg"), opacity: pressed || busy ? 0.85 : 1 })}
                      >
                        {busy ? <ActivityIndicator color={th("#0B0B0B")} /> : <Flame size={19} color={FIRE} strokeWidth={2.4} />}
                        <Text style={{ fontSize: 16, fontWeight: "700", color: th("#0B0B0B") }}>Fazer check-in de hoje</Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            </Surface>
          </Animated.View>

          {/* Where it stands, in a line, when Willo has something to say. */}
          {(broken || auto) && <Text style={{ marginTop: 12, paddingHorizontal: 4, fontSize: 13.5, lineHeight: 19, color: th(broken ? RED : INK.soft) }}>{r.note}</Text>}

          {/* ══ What it has kept, what the whole of it is worth, and the days left ══ */}
          <Animated.View entering={FadeInDown.delay(140).duration(420)} style={{ marginTop: 16, flexDirection: "row", gap: 10 }}>
            {worth > 0 ? (
              <Stat label="Economizado" value={money(saved)} tone={GREEN} foot={`de ${money(worth).replace(/,00$/, "")} no total`} />
            ) : (
              <Stat label="Dias cumpridos" value={String(r.done)} foot={`de ${r.template.days} dias`} />
            )}
            <Stat
              label={finished ? "Terminou em" : "Faltam"}
              value={finished ? dayMonth(end) : `${left} ${left === 1 ? "dia" : "dias"}`}
              foot={finished ? "desafio completo" : `até ${dayMonth(end)}`}
            />
          </Animated.View>

          {/* ══ The challenge, day by day ══ */}
          <View style={{ marginTop: 26, marginBottom: 10, paddingHorizontal: 4, flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
            <Text style={T.eyebrow}>Calendário</Text>
            <Text style={{ fontSize: 12.5, color: th(INK.softer) }}>
              {dayMonth(start)} a {dayMonth(end)}
            </Text>
          </View>
          <Surface>
            <View style={{ padding: 16 }}>
              <View style={{ flexDirection: "row", gap: 6, marginBottom: 10 }}>
                {WEEK.map((w, i) => (
                  <Text key={i} style={{ width: cell, textAlign: "center", fontSize: 11.5, fontWeight: "700", color: th(INK.softer) }}>
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
              <View style={{ marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: th("rgba(255,255,255,0.07)", "line"), flexDirection: "row", flexWrap: "wrap", columnGap: 14, rowGap: 8 }}>
                <Key color={FIRE} label="Check-in" />
                {auto && <Key color={GREEN} label="Dia limpo" />}
                <Key color={th("#fff")} label="Hoje" ring />
                <Key color={RED} label="Quebrou" />
              </View>
            </View>
          </Surface>

          <View style={{ marginTop: 22, gap: 6 }}>
            {(broken || finished) && (
              <Pressable
                onPress={() => void restart()}
                style={({ pressed }) => ({ height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center", backgroundColor: th("#fff", "bg"), opacity: pressed ? 0.85 : 1 })}
              >
                <Text style={{ fontSize: 15.5, fontWeight: "700", color: th("#0B0B0B") }}>{finished ? "Fazer de novo" : "Recomeçar hoje"}</Text>
              </Pressable>
            )}
            {r.cover && (
              <Pressable onPress={() => void removePhoto()} style={({ pressed }) => ({ height: 44, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}>
                <Text style={{ fontSize: 14.5, color: th(INK.soft) }}>Voltar para a imagem do Willo</Text>
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

      <View style={{ position: "absolute", top: insets.top + 8, left: 16, right: 16, flexDirection: "row", justifyContent: "space-between" }}>
        <BackButton onImage />
        <RoundButton label={r.cover ? "Trocar a foto" : "Colocar uma foto"} onImage onPress={() => void choosePhoto()}>
          {photoBusy ? <ActivityIndicator color="#fff" /> : <ImagePlus size={19} color={th("rgba(255,255,255,0.9)")} strokeWidth={2.2} />}
        </RoundButton>
      </View>

      <ConfirmGlass open={leaving} title="Encerrar o desafio?" confirmLabel="Encerrar" busyLabel="Encerrando…" onConfirm={() => void leave()} onClose={() => setLeaving(false)}>
        Os dias até aqui ficam no seu histórico. Dá para começar de novo quando quiser.
      </ConfirmGlass>
    </View>
  );
}

function GlassPill({ label, tone }: { label: string; tone?: string }) {
  /* In the light theme a solid white tag, so it stands out on the faded picture; in the dark, glass. */
  if (isLight())
    return (
      <View style={{ height: 30, paddingHorizontal: 13, borderRadius: 15, justifyContent: "center", backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "rgba(0,0,0,0.06)", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }}>
        <Text style={{ fontSize: 13, fontWeight: "700", color: th(tone ?? "#fff") }}>{label}</Text>
      </View>
    );
  return (
    <View style={{ height: 28, paddingHorizontal: 12, borderRadius: 14, overflow: "hidden", justifyContent: "center", borderWidth: 1, borderColor: tone ? `${tone}66` : "rgba(255,255,255,0.28)" }}>
      <BlurView intensity={30} tint="dark" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 14 }} />
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 14, backgroundColor: tone ? `${tone}22` : "rgba(255,255,255,0.12)" }} />
      <Text style={{ zIndex: 1, fontSize: 12.5, fontWeight: "700", color: tone ?? "#fff" }}>{label}</Text>
    </View>
  );
}

function DayCell({ size, day, state }: { size: number; day: number; state: "checked" | "clean" | "broken" | "today" | "future" | "missed" }) {
  const base = { width: size, height: size, borderRadius: size * 0.34, alignItems: "center" as const, justifyContent: "center" as const, overflow: "hidden" as const };
  if (state === "checked")
    return (
      <View style={base}>
        <LinearGradient colors={["#FFB15E", "#FF7A3D"]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
        <View style={{ zIndex: 1 }}>
          <Flame size={size * 0.38} color="#FFFFFF" strokeWidth={2.3} />
        </View>
        <Text style={{ position: "absolute", zIndex: 1, bottom: 2, fontSize: 9, fontWeight: "800", color: "rgba(255,255,255,0.9)" }}>{day}</Text>
      </View>
    );
  if (state === "clean")
    return (
      <View style={[base, { backgroundColor: "rgba(103,205,103,0.16)" }]}>
        <Check size={size * 0.3} color={th(GREEN)} strokeWidth={3} />
        <Text style={{ position: "absolute", bottom: 2, fontSize: 9, fontWeight: "700", color: th(GREEN) }}>{day}</Text>
      </View>
    );
  if (state === "broken")
    return (
      <View style={[base, { backgroundColor: "rgba(248,113,113,0.2)" }]}>
        <Text style={{ fontSize: 14, fontWeight: "800", color: th(RED) }}>{day}</Text>
      </View>
    );
  return (
    <View
      style={[
        base,
        {
          backgroundColor: state === "today" ? th("rgba(255,255,255,0.1)", "bg") : th("rgba(255,255,255,0.035)", "bg"),
          borderWidth: state === "today" ? 2 : 0,
          borderColor: th("#fff", "line"),
        },
      ]}
    >
      <Text style={{ fontSize: 14, fontWeight: state === "today" ? "800" : "500", color: th(state === "future" || state === "missed" ? INK.faint : "#fff") }}>{day}</Text>
    </View>
  );
}

function Key({ color, label, ring }: { color: string; label: string; ring?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: ring ? "transparent" : color, borderWidth: ring ? 1.5 : 0, borderColor: color }} />
      <Text style={{ fontSize: 12, color: th(INK.soft) }}>{label}</Text>
    </View>
  );
}

function Stat({ label, value, tone, foot }: { label: string; value: string; tone?: string; foot?: string }) {
  return (
    <Surface style={{ flex: 1 }}>
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 12.5, color: th(INK.soft) }}>{label}</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit style={{ marginTop: 4, fontSize: 24, fontWeight: "800", letterSpacing: -0.8, color: th(tone ?? "#fff") }}>
          {value}
        </Text>
        {foot && (
          <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12, color: th(INK.softer) }}>
            {foot}
          </Text>
        )}
      </View>
    </Surface>
  );
}
