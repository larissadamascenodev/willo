import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInDown, FadeOut } from "react-native-reanimated";
import { ChallengeCover } from "~/components/desafios/ChallengeTile";
import { Eye, Flame, Trophy, X } from "~/components/icons";
import { DIFFICULTY_LABEL, type Template } from "~/lib/challenges";
import { isLight, th } from "~/theme/theme";
import { INK } from "~/theme/tokens";

/**
 * A challenge, before it is started.
 *
 * Its picture fills the top of the card with its name over it and its tags — how long,
 * how it is checked, how hard. Under it, the line that explains it, how it works in
 * three steps, what it would save and how the month would close, and the button.
 */
export default function ChallengePreview({
  template,
  cover,
  saves,
  month,
  busy,
  onStart,
  onClose,
}: {
  template: Template | null;
  cover?: string | null;
  saves: number;
  month: number | null;
  busy: boolean;
  onStart: () => void;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const [shown, setShown] = useState<Template | null>(template);
  useEffect(() => {
    if (template) setShown(template);
  }, [template]);
  if (!shown) return null;

  const t = shown;
  const auto = t.kind !== "manual";
  const cardW = Math.min(390, width - 28);
  const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const steps = [
    { Icon: auto ? Eye : Flame, text: auto ? "O Willo confere sozinho pelos seus lançamentos: se aparecer um gasto desses, o desafio quebra." : "Toda noite, faça o check-in do dia que você cumpriu." },
    { Icon: Flame, text: "Cada check-in acende o foguinho. Quanto mais dias seguidos, maior a sequência." },
    { Icon: Trophy, text: "Ao chegar no último dia, o desafio vira conquista na sua coleção." },
  ];

  return (
    <Modal visible={!!template} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent onDismiss={() => setShown(null)}>
      {template && (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(160)} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
          <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Fechar">
            <BlurView intensity={30} tint={th("dark", "tint")} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
            <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)" }} />
          </Pressable>
        </Animated.View>
      )}
      {template && (
        <View pointerEvents="box-none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
          <Animated.View
            entering={FadeInDown.duration(320)}
            exiting={FadeOut.duration(160)}
            style={{ width: cardW, maxHeight: height - 80, borderRadius: 32, borderCurve: "continuous", overflow: "hidden", borderWidth: 1, borderColor: th("rgba(255,255,255,0.12)", "line") }}
          >
            <BlurView intensity={80} tint={th("dark", "tint")} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
            <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: isLight() ? "rgba(250,250,251,0.86)" : "rgba(18,20,26,0.78)" }} />

            <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
              {/* The picture, with the name and the tags over it. */}
              <View style={{ height: 210 }}>
                <ChallengeCover template={t} cover={cover} width={cardW} height={210} />
                <LinearGradient colors={["rgba(8,9,10,0.25)", "rgba(8,9,10,0)", "rgba(8,9,10,0.85)"]} locations={[0, 0.4, 1]} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
                <Pressable
                  onPress={onClose}
                  accessibilityLabel="Fechar"
                  style={({ pressed }) => ({ position: "absolute", top: 14, right: 14, width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(10,11,13,0.5)", opacity: pressed ? 0.7 : 1 })}
                >
                  <X size={17} color="#fff" strokeWidth={2.4} />
                </Pressable>
                <View style={{ position: "absolute", left: 18, right: 18, bottom: 16 }}>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {[`${t.days} dias`, auto ? "O Willo confere" : "Check-in diário", DIFFICULTY_LABEL[t.difficulty]].map((tag) => (
                      <View key={tag} style={{ height: 24, paddingHorizontal: 9, borderRadius: 12, justifyContent: "center", backgroundColor: "rgba(255,255,255,0.16)" }}>
                        <Text style={{ fontSize: 11.5, fontWeight: "700", color: "#fff" }}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                  <Text style={{ marginTop: 10, fontSize: 24, fontWeight: "800", letterSpacing: -0.7, lineHeight: 28, color: "#fff" }}>{t.name}</Text>
                </View>
              </View>

              <View style={{ padding: 18 }}>
                <Text style={{ fontSize: 14.5, lineHeight: 21, color: th(INK.soft) }}>{t.line}</Text>

                {(saves > 0 || month !== null) && (
                  <View style={{ marginTop: 16, flexDirection: "row", padding: 14, borderRadius: 18, backgroundColor: th("rgba(255,255,255,0.06)", "bg") }}>
                    {saves > 0 && (
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, color: th(INK.soft) }}>Você economiza</Text>
                        <Text numberOfLines={1} style={{ marginTop: 3, fontSize: 19, fontWeight: "800", letterSpacing: -0.4, color: "#4FB84F" }}>
                          {money(saves)}
                        </Text>
                      </View>
                    )}
                    {saves > 0 && month !== null && <View style={{ width: 1, marginHorizontal: 14, backgroundColor: th("rgba(255,255,255,0.1)", "line") }} />}
                    {month !== null && (
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, color: th(INK.soft) }}>Seu mês fecharia com</Text>
                        <Text numberOfLines={1} style={{ marginTop: 3, fontSize: 19, fontWeight: "800", letterSpacing: -0.4, color: th("#fff") }}>
                          {money(month + saves)}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                <Text style={{ marginTop: 18, fontSize: 12, fontWeight: "700", letterSpacing: 1.2, color: th(INK.softer) }}>COMO FUNCIONA</Text>
                <View style={{ marginTop: 10, gap: 12 }}>
                  {steps.map(({ Icon, text }, i) => (
                    <View key={i} style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
                      <View style={{ width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: th("rgba(255,255,255,0.08)", "bg") }}>
                        <Icon size={15} color={th("#fff")} strokeWidth={2} />
                      </View>
                      <Text style={{ flex: 1, fontSize: 13.5, lineHeight: 19, color: th(INK.soft) }}>{text}</Text>
                    </View>
                  ))}
                </View>

                <Pressable
                  onPress={onStart}
                  disabled={busy}
                  accessibilityRole="button"
                  style={({ pressed }) => ({ marginTop: 22, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: th("#fff", "bg"), opacity: pressed || busy ? 0.85 : 1 })}
                >
                  {busy ? <ActivityIndicator color={th("#0B0B0B")} /> : <Text style={{ fontSize: 16, fontWeight: "800", color: th("#0B0B0B") }}>Começar hoje</Text>}
                </Pressable>
              </View>
            </ScrollView>
          </Animated.View>
        </View>
      )}
    </Modal>
  );
}
