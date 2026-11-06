import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import Room from "~/components/Room";
import BackButton from "~/components/BackButton";
import SegmentedTabs from "~/components/SegmentedTabs";
import Surface from "~/components/Surface";
import CenterModal from "~/components/CenterModal";
import WilloBot from "~/components/willo/WilloBot";
import { CHALLENGE_ICON, DifficultyTag, MedalBadge } from "~/components/desafios/parts";
import ChallengeTile, { GridOffer, HeroOffer } from "~/components/desafios/ChallengeTile";
import { Check, ChevronRight, Lock, Plus, Trophy } from "~/components/icons";
import { useAuth } from "~/lib/auth";
import { money } from "~/lib/money";
import { showToast } from "~/lib/toast";
import {
  DIFFICULTY_LABEL,
  ESSENTIAL,
  TIER_NAME,
  abandonChallenge,
  customTemplate,
  estimateSavings,
  loadChallenges,
  plural,
  restartChallenge,
  startChallenge,
  tickToday,
  type Achievement,
  type ChallengeData,
  type Running,
  type Template,
} from "~/lib/challenges";
import { th } from "~/theme/theme";
import { GREEN, INK, RED } from "~/theme/tokens";
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
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const half = Math.floor((screenW - 32 - 12) / 2);
  const { user } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("desafios");
  const [data, setData] = useState<ChallengeData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [picked, setPicked] = useState<Template | null>(null);
  const [medal, setMedal] = useState<Achievement | null>(null);
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

  const act = async (fn: () => Promise<void>, done: string) => {
    try {
      await fn();
      void Haptics.selectionAsync().catch(() => undefined);
      showToast(done);
      await load();
    } catch {
      showToast("Não deu certo. Tente de novo.");
    }
  };

  const savingsOf = (t: Template) => (data ? (estimateSavings(t, data.txs)?.saves ?? t.saves ?? 0) : 0);
  const earned = data ? data.medals.reduce((n, m) => n + m.tier, 0) : 0;
  const totalLevels = data ? data.medals.reduce((n, m) => n + m.steps.length, 0) : 0;
  /* The level closest to being earned, among those that can be seen. */
  const nearest = data
    ? data.medals
        .filter((m) => m.next !== null && !(m.secret && !m.revealed))
        .sort((a, b) => b.value / (b.next ?? 1) - a.value / (a.next ?? 1))[0] ?? null
    : null;
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
          {data ? `${data.running.length} em andamento · ${earned} de ${totalLevels} níveis de medalha` : " "}
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
            {/* Running: a shelf of tall cards, each opening its own page. */}
            {data.running.length > 0 && (
              <>
                <Eyebrow>Em andamento</Eyebrow>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
                  {data.running.map((r) => (
                    <ChallengeTile key={r.id} r={r} onPress={() => router.push(`/desafio/${r.id}` as never)} />
                  ))}
                </ScrollView>
              </>
            )}

            {/* Aimed at where the money is going. */}
            {data.suggested.length > 0 && (
              <>
                <Eyebrow>Sugeridos para você</Eyebrow>
                <View style={{ gap: 14 }}>
                  {data.suggested.map((sg) => (
                    <HeroOffer
                      key={sg.template.key}
                      template={sg.template}
                      cover={data.covers[sg.template.key]}
                      reason={sg.reason}
                      saves={money(sg.saves)}
                      month={money(data.leftover + sg.saves)}
                      onPress={() => setPicked(sg.template)}
                    />
                  ))}
                </View>
              </>
            )}

            {/* One's own, with Willo. */}
            <Eyebrow>Criar o meu</Eyebrow>
            <Surface onPress={() => setMaking(true)}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14 }}>
                <View style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
                  <WilloBot size={44} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 15.5, fontWeight: "600", color: th("#fff") }}>Montar um desafio com o Willo</Text>
                  <Text style={{ marginTop: 2, fontSize: 13, color: th(INK.soft) }}>Três perguntas e ele calcula quanto você economiza</Text>
                </View>
                <Plus size={18} color={th(INK.soft)} />
              </View>
            </Surface>

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
                      saves={savingsOf(t) > 0 ? `Economiza ${money(savingsOf(t))}` : undefined}
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
            {/* Where the collection stands, and the nearest next level. */}
            <Surface style={{ marginTop: 18 }}>
              <View style={{ padding: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 26, fontWeight: "800", letterSpacing: -0.8, color: th("#fff") }}>
                    {earned}
                    <Text style={{ fontSize: 15, fontWeight: "600", color: th(INK.soft) }}> de {totalLevels} níveis</Text>
                  </Text>
                  <Text style={{ fontSize: 13, color: th(INK.soft) }}>{Math.round((earned / Math.max(1, totalLevels)) * 100)}%</Text>
                </View>
                <View style={{ marginTop: 10, height: 6, borderRadius: 3, overflow: "hidden", backgroundColor: th("rgba(255,255,255,0.1)", "bg") }}>
                  <View style={{ width: `${(earned / Math.max(1, totalLevels)) * 100}%`, height: 6, borderRadius: 3, backgroundColor: th("#E9C462") }} />
                </View>
                {nearest && (
                  <Pressable onPress={() => setMedal(nearest)} style={{ marginTop: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <MedalBadge a={nearest} size={46} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontSize: 12, fontWeight: "600", color: th(INK.softer) }}>MAIS PERTO</Text>
                      <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 14.5, fontWeight: "700", color: th("#fff") }}>
                        {nearest.name} · {TIER_NAME[(nearest.tier + 1) as 1]}
                      </Text>
                      <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 12.5, color: th(INK.soft) }}>
                        Faltam {plural(Math.max(0, (nearest.next ?? 0) - nearest.value), nearest.unit)}
                      </Text>
                    </View>
                    <ChevronRight size={16} color={th(INK.faint)} />
                  </Pressable>
                )}
              </View>
            </Surface>

            {/* The medals, by what they reward. */}
            {MEDAL_GROUPS.map((group) => {
              const list = data.medals.filter((m) => m.group === group);
              if (!list.length) return null;
              return (
                <View key={group}>
                  <Eyebrow>{group}</Eyebrow>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 20 }}>
                    {list.map((m) => {
                      const hidden = m.secret && !m.revealed;
                      return (
                        <Pressable key={m.key} onPress={() => setMedal(m)} style={({ pressed }) => ({ width: "33.33%", alignItems: "center", opacity: pressed ? 0.7 : 1 })}>
                          {hidden ? <SecretBadge /> : <MedalBadge a={m} />}
                          <Text numberOfLines={1} style={{ marginTop: 8, fontSize: 13, fontWeight: "600", color: th(m.tier ? "#fff" : INK.soft) }}>
                            {hidden ? "Secreta" : m.name}
                          </Text>
                          {!hidden && <LevelDots tier={m.tier} levels={m.steps.length} />}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </Animated.View>
        )}
      </ScrollView>

      {/* A challenge, before starting it. */}
      <CenterModal open={!!picked} onClose={() => setPicked(null)} title={picked?.name ?? ""} subtitle={picked ? `${picked.days} dias · ${picked.kind === "manual" ? "você marca cada dia" : "o Willo confere sozinho"}` : undefined}>
        {picked && data && (
          <View>
            <Text style={{ fontSize: 14.5, lineHeight: 20, color: th(INK.soft) }}>{picked.line}</Text>
            {savingsOf(picked) > 0 && (
              <View style={{ marginTop: 14, flexDirection: "row", gap: 10 }}>
                <Figure label="Você economiza" value={money(savingsOf(picked))} tone={GREEN} />
                <Figure label="Seu mês fecharia com" value={money(data.leftover + savingsOf(picked))} />
              </View>
            )}
            <View style={{ marginTop: 12, flexDirection: "row" }}>
              <DifficultyTag label={DIFFICULTY_LABEL[picked.difficulty]} />
            </View>
            <PrimaryButton label="Começar hoje" busy={busy} onPress={() => void start(picked)} />
          </View>
        )}
      </CenterModal>

      {/* A medal, opened: the levels earned, the next one, and the rest kept back. */}
      <CenterModal
        open={!!medal}
        onClose={() => setMedal(null)}
        title={medal ? (medal.secret && !medal.revealed ? "Medalha secreta" : medal.name) : ""}
        subtitle={medal ? (medal.secret && !medal.revealed ? "Ainda escondida" : medal.tier ? `Nível ${TIER_NAME[medal.tier].toLowerCase()}` : "Ainda bloqueada") : undefined}
      >
        {medal && (medal.secret && !medal.revealed ? (
          <View style={{ alignItems: "center" }}>
            <SecretBadge size={96} />
            <Text style={{ marginTop: 14, textAlign: "center", fontSize: 14.5, lineHeight: 20, color: th(INK.soft) }}>{medal.hint}</Text>
          </View>
        ) : (
          <View style={{ alignItems: "center" }}>
            <MedalBadge a={medal} size={104} />
            <Text style={{ marginTop: 12, textAlign: "center", fontSize: 14.5, color: th(INK.soft) }}>{medal.what}</Text>
            <Text style={{ marginTop: 4, fontSize: 15.5, fontWeight: "700", color: th("#fff") }}>{plural(medal.value, medal.unit)}</Text>
            <View style={{ alignSelf: "stretch", marginTop: 14, borderRadius: 16, overflow: "hidden", backgroundColor: th("rgba(255,255,255,0.05)", "bg") }}>
              {medal.steps.map((step, i) => {
                const got = medal.value >= step;
                const isNext = i === medal.tier;
                const kept = i > medal.tier;
                return (
                  <View key={step} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: th("rgba(255,255,255,0.06)", "line"), opacity: kept ? 0.55 : 1 }}>
                    <View style={{ width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: got ? th(GREEN, "bg") : th("rgba(255,255,255,0.08)", "bg") }}>
                      {got ? <Check size={12} color="#0B0B0B" strokeWidth={3} /> : kept ? <Lock size={10} color={th(INK.faint)} strokeWidth={2.4} /> : null}
                    </View>
                    <Text style={{ flex: 1, fontSize: 14, fontWeight: isNext ? "700" : "500", color: th(got || isNext ? "#fff" : INK.soft) }}>{TIER_NAME[(i + 1) as 1]}</Text>
                    <Text style={{ fontSize: 13.5, color: th(INK.soft) }}>{kept ? "Libera depois" : plural(step, medal.unit)}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </CenterModal>

      <MakeWithWillo
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

/** The levels of a medal, as dots: the earned ones lit. */
function LevelDots({ tier, levels }: { tier: number; levels: number }) {
  return (
    <View style={{ marginTop: 5, flexDirection: "row", gap: 3 }}>
      {Array.from({ length: levels }).map((_, i) => (
        <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: i < tier ? th("#E9C462") : th("rgba(255,255,255,0.14)", "bg") }} />
      ))}
    </View>
  );
}

/** A medal not revealed yet: a dark disc with a question mark. */
function SecretBadge({ size = 76 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: size - 8, height: size - 8, borderRadius: (size - 8) / 2, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderStyle: "dashed", borderColor: th("rgba(255,255,255,0.3)", "line"), backgroundColor: th("rgba(255,255,255,0.04)", "bg") }}>
        <Text style={{ fontSize: size * 0.36, fontWeight: "800", color: th(INK.faint) }}>?</Text>
      </View>
    </View>
  );
}

function Eyebrow({ children }: { children: string }) {
  return <Text style={[T.eyebrow, { marginTop: 26, marginBottom: 10, paddingHorizontal: 4 }]}>{children}</Text>;
}

function Glyph({ t, small = false }: { t: Template; small?: boolean }) {
  const Icon = CHALLENGE_ICON[t.icon];
  const s = small ? 36 : 44;
  return (
    <View style={{ width: s, height: s, borderRadius: s * 0.32, alignItems: "center", justifyContent: "center", backgroundColor: th("rgba(255,255,255,0.07)", "bg") }}>
      <Icon size={small ? 17 : 20} color={th("#fff")} strokeWidth={1.9} />
    </View>
  );
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={{ flex: 1, padding: 12, borderRadius: 14, backgroundColor: th("rgba(255,255,255,0.05)", "bg") }}>
      <Text style={{ fontSize: 12, color: th(INK.soft) }}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ marginTop: 3, fontSize: 17, fontWeight: "700", letterSpacing: -0.3, color: th(tone ?? "#fff") }}>
        {value}
      </Text>
    </View>
  );
}

function PrimaryButton({ label, onPress, busy = false, disabled = false }: { label: string; onPress: () => void; busy?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy || disabled}
      accessibilityRole="button"
      style={({ pressed }) => ({ marginTop: 18, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center", backgroundColor: th("#fff", "bg"), opacity: disabled ? 0.4 : pressed || busy ? 0.8 : 1 })}
    >
      {busy ? <ActivityIndicator color={th("#0B0B0B")} /> : <Text style={{ fontSize: 15.5, fontWeight: "700", color: th("#0B0B0B") }}>{label}</Text>}
    </Pressable>
  );
}

/* ── Making one's own, with Willo ─────────────────────────────────────────────
   Three questions: what to cut (the person's own biggest spending, or a habit in
   their words), for how long, and Willo's sum of what it keeps in the pocket. */

function MakeWithWillo({ open, data, busy, onClose, onStart }: { open: boolean; data: ChallengeData | null; busy: boolean; onClose: () => void; onStart: (t: Template) => void }) {
  const [step, setStep] = useState(0);
  const [category, setCategory] = useState<string | null>(null);
  const [habit, setHabit] = useState("");
  const [days, setDays] = useState(15);

  const reset = () => {
    setStep(0);
    setCategory(null);
    setHabit("");
    setDays(15);
  };
  const close = () => {
    onClose();
    setTimeout(reset, 300);
  };

  const cuttable = (data?.spending ?? []).filter((s) => !ESSENTIAL.test(s.category)).slice(0, 6);
  const template: Template | null = category
    ? customTemplate(category, days)
    : habit.trim()
      ? { key: `habit:${habit.trim()}`, name: habit.trim(), line: "Marque cada dia que conseguir.", days, kind: "manual", icon: "flag", difficulty: days >= 30 ? "dificil" : days >= 15 ? "medio" : "facil" }
      : null;
  const saves = template && data ? (estimateSavings(template, data.txs)?.saves ?? 0) : 0;

  const say = ["O que você quer cortar?", "Por quantos dias?", "Fechado. Olha o que muda:"][step];

  return (
    <CenterModal open={open} onClose={close} title="Criar com o Willo" subtitle={`Pergunta ${step + 1} de 3`}>
      <View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <WilloBot size={40} />
          <Text style={{ flex: 1, fontSize: 16, fontWeight: "600", color: th("#fff") }}>{say}</Text>
        </View>

        {step === 0 && (
          <View style={{ marginTop: 14 }}>
            {cuttable.length > 0 && (
              <>
                <Text style={{ fontSize: 12.5, color: th(INK.soft), marginBottom: 8 }}>Onde mais saiu dinheiro nos últimos 30 dias</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {cuttable.map((c) => {
                    const on = category === c.category;
                    return (
                      <Pressable
                        key={c.category}
                        onPress={() => {
                          setCategory(on ? null : c.category);
                          setHabit("");
                        }}
                        style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: on ? th("#fff", "bg") : th("rgba(255,255,255,0.07)", "bg") }}
                      >
                        <Text style={{ fontSize: 13.5, fontWeight: "600", color: on ? th("#0B0B0B") : th("#fff") }}>{c.category}</Text>
                        <Text style={{ fontSize: 11.5, color: on ? th("rgba(11,11,11,0.6)") : th(INK.soft) }}>{money(c.total)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}
            <Text style={{ fontSize: 12.5, color: th(INK.soft), marginTop: 14, marginBottom: 8 }}>Ou um hábito, com as suas palavras</Text>
            <TextInput
              value={habit}
              onChangeText={(v) => {
                setHabit(v);
                if (v) setCategory(null);
              }}
              placeholder="Ex.: Levar marmita para o trabalho"
              placeholderTextColor={th(INK.faint)}
              maxLength={60}
              style={{ height: 46, borderRadius: 14, paddingHorizontal: 14, fontSize: 15, color: th("#fff"), backgroundColor: th("rgba(255,255,255,0.06)", "bg") }}
            />
            <PrimaryButton label="Continuar" disabled={!template} onPress={() => setStep(1)} />
          </View>
        )}

        {step === 1 && (
          <View style={{ marginTop: 14 }}>
            <SegmentedTabs
              value={String(days) as "7" | "15" | "30"}
              onChange={(k) => setDays(Number(k))}
              options={[
                { key: "7" as const, label: "7 dias" },
                { key: "15" as const, label: "15 dias" },
                { key: "30" as const, label: "30 dias" },
              ]}
            />
            <PrimaryButton label="Continuar" onPress={() => setStep(2)} />
            <Pressable onPress={() => setStep(0)} style={{ height: 40, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 14, color: th(INK.soft) }}>Voltar</Text>
            </Pressable>
          </View>
        )}

        {step === 2 && template && data && (
          <View style={{ marginTop: 14 }}>
            <Text style={{ fontSize: 17, fontWeight: "700", color: th("#fff") }}>{template.name}</Text>
            <Text style={{ marginTop: 4, fontSize: 13.5, lineHeight: 19, color: th(INK.soft) }}>
              {template.kind === "abstain" ? "O Willo confere sozinho pelos seus registros." : "Você marca cada dia que conseguir."}
            </Text>
            {saves > 0 ? (
              <View style={{ marginTop: 14, flexDirection: "row", gap: 10 }}>
                <Figure label="Você economiza" value={money(saves)} tone={GREEN} />
                <Figure label="Seu mês fecharia com" value={money(data.leftover + saves)} />
              </View>
            ) : (
              <Text style={{ marginTop: 12, fontSize: 13.5, lineHeight: 19, color: th(INK.soft) }}>
                Esse é um hábito: o Willo não tem como medir a economia pelos registros, mas conta cada dia cumprido.
              </Text>
            )}
            <PrimaryButton label="Começar hoje" busy={busy} onPress={() => onStart(template)} />
            <Pressable onPress={() => setStep(1)} style={{ height: 40, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 14, color: th(INK.soft) }}>Voltar</Text>
            </Pressable>
          </View>
        )}
      </View>
    </CenterModal>
  );
}
