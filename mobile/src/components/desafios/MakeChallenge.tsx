import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInRight } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import RoundButton from "~/components/RoundButton";
import WilloBot from "~/components/willo/WilloBot";
import { ChallengeCover } from "~/components/desafios/ChallengeTile";
import { Check, ChevronLeft, Eye, Flame, Sparkles, TrendingDown, X } from "~/components/icons";
import { DIFFICULTY_LABEL, ESSENTIAL, customTemplate, estimateSavings, type ChallengeData, type Template } from "~/lib/challenges";
import { money } from "~/lib/money";
import { th } from "~/theme/theme";
import { GREEN, GROUND, INK } from "~/theme/tokens";

/**
 * Making a challenge of one's own, with Willo, one question at a time.
 *
 * First the kind: stop spending on something, or take up a habit. Then what — one of
 * the person's own categories, biggest spending first, or a habit in their own words
 * with a few ideas to start from. Then for how long, each length saying how hard it is
 * and, for a category, what it would keep. Last, the challenge as it will be, with its
 * picture, what it saves, how the month would close and how it works, and the button.
 * A bar at the top says how far along; Back goes one question back.
 */

type Kind = "cut" | "habit";
const IDEAS = ["Levar marmita para o trabalho", "Fazer café em casa", "Ir a pé ou de bicicleta", "Esperar um dia antes de comprar", "Cozinhar em casa no fim de semana"];

export default function MakeChallenge({ open, data, busy, onClose, onStart }: { open: boolean; data: ChallengeData | null; busy: boolean; onClose: () => void; onStart: (t: Template) => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<Kind | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [habit, setHabit] = useState("");
  const [days, setDays] = useState(15);

  useEffect(() => {
    if (!open) {
      const id = setTimeout(() => {
        setStep(0);
        setKind(null);
        setCategory(null);
        setHabit("");
        setDays(15);
      }, 350);
      return () => clearTimeout(id);
    }
  }, [open]);

  const cuttable = (data?.spending ?? []).filter((s) => !ESSENTIAL.test(s.category)).slice(0, 8);
  const top = Math.max(1, ...cuttable.map((c) => c.total));
  const templateFor = (d: number): Template | null =>
    kind === "cut" && category
      ? customTemplate(category, d)
      : kind === "habit" && habit.trim()
        ? { key: `habit:${habit.trim()}`, name: habit.trim(), line: "Marque cada dia que conseguir.", days: d, kind: "manual", icon: "flag", difficulty: d >= 30 ? "dificil" : d >= 15 ? "medio" : "facil" }
        : null;
  const template = templateFor(days);
  const savesFor = (d: number) => {
    const t = templateFor(d);
    return t && data ? (estimateSavings(t, data.txs)?.saves ?? 0) : 0;
  };
  const saves = savesFor(days);

  const QUESTIONS = ["O que você quer mudar?", kind === "habit" ? "Qual hábito você quer criar?" : "Onde você quer parar de gastar?", "Por quantos dias?", "Fechado! Olha como fica:"];
  const canGo = step === 0 ? !!kind : step === 1 ? !!template : true;
  const back = () => (step === 0 ? onClose() : setStep(step - 1));

  return (
    <Modal visible={open} animationType="slide" presentationStyle="fullScreen" onRequestClose={back}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: th(GROUND, "bg") }}>
        {/* The way back, how far along, and the way out. */}
        <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <RoundButton label="Voltar" onPress={back}>
            <ChevronLeft size={20} color={th("rgba(255,255,255,0.9)")} strokeWidth={2.2} />
          </RoundButton>
          <View style={{ flex: 1, flexDirection: "row", gap: 5 }}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: i <= step ? th("#fff", "bg") : th("rgba(255,255,255,0.12)", "bg") }} />
            ))}
          </View>
          <RoundButton label="Fechar" onPress={onClose}>
            <X size={18} color={th("rgba(255,255,255,0.9)")} strokeWidth={2.2} />
          </RoundButton>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 22, paddingBottom: 140 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Willo, asking. */}
          <Animated.View key={`q${step}${kind}`} entering={FadeIn.duration(260)} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <WilloBot size={52} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12.5, fontWeight: "700", letterSpacing: 1, color: th(INK.softer) }}>PASSO {step + 1} DE 4</Text>
              <Text style={{ marginTop: 2, fontSize: 24, fontWeight: "800", letterSpacing: -0.7, lineHeight: 28, color: th("#fff") }}>{QUESTIONS[step]}</Text>
            </View>
          </Animated.View>

          <Animated.View key={`s${step}`} entering={FadeInRight.duration(280)} style={{ marginTop: 22 }}>
            {step === 0 && (
              <View style={{ gap: 12 }}>
                <Choice
                  on={kind === "cut"}
                  Icon={TrendingDown}
                  title="Parar de gastar com algo"
                  line="Escolha uma das suas categorias. O Willo confere sozinho e calcula quanto você economiza."
                  onPress={() => setKind("cut")}
                />
                <Choice
                  on={kind === "habit"}
                  Icon={Flame}
                  title="Criar um hábito"
                  line="Algo com as suas palavras. Toda noite você marca o check-in do dia."
                  onPress={() => setKind("habit")}
                />
              </View>
            )}

            {step === 1 && kind === "cut" && (
              <View style={{ gap: 10 }}>
                <Text style={{ fontSize: 13.5, color: th(INK.soft), marginBottom: 4 }}>Onde mais saiu dinheiro nos últimos 30 dias</Text>
                {cuttable.length === 0 && (
                  <Text style={{ fontSize: 14.5, lineHeight: 21, color: th(INK.soft) }}>Ainda não há gastos suficientes para sugerir. Que tal criar um hábito?</Text>
                )}
                {cuttable.map((c) => {
                  const on = category === c.category;
                  return (
                    <Pressable
                      key={c.category}
                      onPress={() => setCategory(c.category)}
                      style={({ pressed }) => ({
                        padding: 14,
                        borderRadius: 18,
                        borderWidth: 1.5,
                        borderColor: on ? th("#fff", "line") : th("rgba(255,255,255,0.08)", "line"),
                        backgroundColor: th("rgba(255,255,255,0.05)", "bg"),
                        transform: [{ scale: pressed ? 0.98 : 1 }],
                      })}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                        <Radio on={on} />
                        <Text numberOfLines={1} style={{ flex: 1, fontSize: 15.5, fontWeight: "700", color: th("#fff") }}>
                          {c.category}
                        </Text>
                        <Text style={{ fontSize: 14.5, fontWeight: "700", color: th("#fff") }}>{money(c.total)}</Text>
                      </View>
                      <View style={{ marginTop: 10, marginLeft: 34, height: 5, borderRadius: 3, overflow: "hidden", backgroundColor: th("rgba(255,255,255,0.08)", "bg") }}>
                        <View style={{ width: `${(c.total / top) * 100}%`, height: 5, borderRadius: 3, backgroundColor: th("#FF9F45") }} />
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {step === 1 && kind === "habit" && (
              <View>
                <TextInput
                  value={habit}
                  onChangeText={setHabit}
                  placeholder="Ex.: Levar marmita para o trabalho"
                  placeholderTextColor={th(INK.faint)}
                  maxLength={60}
                  autoFocus
                  style={{ height: 56, borderRadius: 18, paddingHorizontal: 16, fontSize: 16.5, color: th("#fff"), backgroundColor: th("rgba(255,255,255,0.06)", "bg"), borderWidth: 1, borderColor: th("rgba(255,255,255,0.1)", "line") }}
                />
                <Text style={{ marginTop: 18, marginBottom: 10, fontSize: 13.5, color: th(INK.soft) }}>Ou comece por uma ideia</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {IDEAS.map((idea) => {
                    const on = habit === idea;
                    return (
                      <Pressable key={idea} onPress={() => setHabit(idea)} style={{ paddingHorizontal: 14, height: 38, justifyContent: "center", borderRadius: 19, backgroundColor: on ? th("#fff", "bg") : th("rgba(255,255,255,0.07)", "bg") }}>
                        <Text style={{ fontSize: 13.5, fontWeight: "600", color: on ? th("#0B0B0B") : th("#fff") }}>{idea}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {step === 2 && (
              <View style={{ gap: 12 }}>
                {[7, 15, 30].map((d) => {
                  const on = days === d;
                  const s = savesFor(d);
                  const level = d >= 30 ? "dificil" : d >= 15 ? "medio" : "facil";
                  return (
                    <Pressable
                      key={d}
                      onPress={() => setDays(d)}
                      style={({ pressed }) => ({
                        padding: 16,
                        borderRadius: 20,
                        borderWidth: 1.5,
                        borderColor: on ? th("#fff", "line") : th("rgba(255,255,255,0.08)", "line"),
                        backgroundColor: th("rgba(255,255,255,0.05)", "bg"),
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 14,
                        transform: [{ scale: pressed ? 0.98 : 1 }],
                      })}
                    >
                      <Radio on={on} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 19, fontWeight: "800", letterSpacing: -0.4, color: th("#fff") }}>{d} dias</Text>
                        <Text style={{ marginTop: 2, fontSize: 13, color: th(INK.soft) }}>
                          {DIFFICULTY_LABEL[level]} · {d === 7 ? "uma semana" : d === 15 ? "duas semanas" : "um mês inteiro"}
                        </Text>
                      </View>
                      {s > 0 && (
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={{ fontSize: 12, color: th(INK.soft) }}>economiza</Text>
                          <Text style={{ fontSize: 16, fontWeight: "800", color: th(GREEN) }}>{money(s)}</Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            )}

            {step === 3 && template && (
              <View>
                <View style={{ height: Math.round((width - 40) * 0.56), borderRadius: 26, borderCurve: "continuous", overflow: "hidden", backgroundColor: "#0D0E10" }}>
                  <ChallengeCover template={template} width="100%" height="100%" />
                  <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "55%", backgroundColor: "rgba(8,9,10,0.55)" }} />
                  <View style={{ position: "absolute", left: 16, right: 16, bottom: 14 }}>
                    <Text style={{ fontSize: 12, fontWeight: "700", letterSpacing: 1, color: "rgba(255,255,255,0.7)" }}>
                      {template.days} DIAS · {DIFFICULTY_LABEL[template.difficulty].toUpperCase()}
                    </Text>
                    <Text numberOfLines={2} style={{ marginTop: 4, fontSize: 22, fontWeight: "800", letterSpacing: -0.6, color: "#fff" }}>
                      {template.name}
                    </Text>
                  </View>
                </View>

                {saves > 0 && data && (
                  <View style={{ marginTop: 14, flexDirection: "row", padding: 16, borderRadius: 20, backgroundColor: th("rgba(255,255,255,0.05)", "bg") }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12.5, color: th(INK.soft) }}>Você economiza</Text>
                      <Text numberOfLines={1} style={{ marginTop: 3, fontSize: 20, fontWeight: "800", letterSpacing: -0.5, color: th(GREEN) }}>{money(saves)}</Text>
                    </View>
                    <View style={{ width: 1, marginHorizontal: 14, backgroundColor: th("rgba(255,255,255,0.1)", "line") }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12.5, color: th(INK.soft) }}>Seu mês fecharia com</Text>
                      <Text numberOfLines={1} style={{ marginTop: 3, fontSize: 20, fontWeight: "800", letterSpacing: -0.5, color: th("#fff") }}>{money(data.leftover + saves)}</Text>
                    </View>
                  </View>
                )}

                <Text style={{ marginTop: 20, fontSize: 12, fontWeight: "700", letterSpacing: 1.2, color: th(INK.softer) }}>COMO FUNCIONA</Text>
                <View style={{ marginTop: 10, gap: 12 }}>
                  {[
                    { Icon: template.kind === "manual" ? Flame : Eye, text: template.kind === "manual" ? "Toda noite, faça o check-in do dia que você cumpriu." : "O Willo confere sozinho pelos seus lançamentos: se aparecer um gasto desses, o desafio quebra." },
                    { Icon: Sparkles, text: "Cada dia cumprido acende o foguinho. Quanto mais dias seguidos, maior a sequência." },
                    { Icon: Check, text: "Chegando ao último dia, o desafio vira medalha nas suas conquistas." },
                  ].map(({ Icon, text }, i) => (
                    <View key={i} style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
                      <View style={{ width: 32, height: 32, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: th("rgba(255,255,255,0.08)", "bg") }}>
                        <Icon size={16} color={th("#fff")} strokeWidth={2} />
                      </View>
                      <Text style={{ flex: 1, fontSize: 14, lineHeight: 20, color: th(INK.soft) }}>{text}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </Animated.View>
        </ScrollView>

        {/* The next step, always in the same place, on a fade so the list goes under it. */}
        <LinearGradient
          pointerEvents="none"
          colors={th(["rgba(8,9,10,0)", GROUND, GROUND], "grad")}
          locations={[0, 0.4, 1]}
          style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: insets.bottom + 110 }}
        />
        <View style={{ position: "absolute", left: 20, right: 20, bottom: insets.bottom + 16 }}>
          <Pressable
            onPress={() => (step < 3 ? setStep(step + 1) : template && onStart(template))}
            disabled={!canGo || busy}
            accessibilityRole="button"
            style={({ pressed }) => ({ height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: canGo ? th("#fff", "bg") : th("#2A2C31", "bg"), opacity: pressed || busy ? 0.85 : 1 })}
          >
            {busy ? (
              <ActivityIndicator color={th("#0B0B0B")} />
            ) : (
              <Text style={{ fontSize: 16.5, fontWeight: "800", color: canGo ? th("#0B0B0B") : th(INK.faint) }}>{step < 3 ? "Continuar" : "Começar hoje"}</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Radio({ on }: { on: boolean }) {
  return (
    <View style={{ width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", borderWidth: on ? 0 : 1.5, borderColor: th("rgba(255,255,255,0.3)", "line"), backgroundColor: on ? th("#fff", "bg") : "transparent" }}>
      {on && <Check size={13} color={th("#0B0B0B")} strokeWidth={3} />}
    </View>
  );
}

function Choice({ on, Icon, title, line, onPress }: { on: boolean; Icon: typeof Flame; title: string; line: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        padding: 18,
        borderRadius: 22,
        borderWidth: 1.5,
        borderColor: on ? th("#fff", "line") : th("rgba(255,255,255,0.08)", "line"),
        backgroundColor: th("rgba(255,255,255,0.05)", "bg"),
        flexDirection: "row",
        gap: 14,
        alignItems: "center",
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <View style={{ width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: th("rgba(255,255,255,0.08)", "bg") }}>
        <Icon size={22} color={th("#fff")} strokeWidth={2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 17, fontWeight: "800", letterSpacing: -0.3, color: th("#fff") }}>{title}</Text>
        <Text style={{ marginTop: 3, fontSize: 13.5, lineHeight: 19, color: th(INK.soft) }}>{line}</Text>
      </View>
      <Radio on={on} />
    </Pressable>
  );
}
