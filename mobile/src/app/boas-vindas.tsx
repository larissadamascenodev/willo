import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown, ZoomIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import ParticleOrb from "~/components/registro/ParticleOrb";
import { Aura, C } from "~/components/onboarding/kit";
import { Check, CreditCard, Landmark, PenLine } from "~/components/icons";
import { useAuth } from "~/lib/auth";
import { setAccountStage } from "~/lib/accountStage";
import { readOnboardingAnswers } from "~/lib/onboarding";
import type { OnboardingAnswers } from "~/lib/onboardingProfile";

/**
 * Welcome, once the account and the questions are done (and, when there is one, the
 * payment). Willo greets the person by name, the profile the questions made is named,
 * and what happens in the first minutes is laid out — the account, the card, the
 * first entry — before one button takes them in.
 */

const STEPS = [
  { Icon: Landmark, title: "Sua primeira conta", line: "Onde o seu dinheiro fica, com o saldo de hoje." },
  { Icon: CreditCard, title: "Seu cartão", line: "Para eu acompanhar a fatura antes de ela fechar." },
  { Icon: PenLine, title: "Seu primeiro gasto", line: "Falando, digitando ou com uma foto." },
];

export default function BoasVindas() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [answers, setAnswers] = useState<(OnboardingAnswers & { plan?: string }) | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void readOnboardingAnswers<OnboardingAnswers>().then((a) => setAnswers(a));
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }, []);

  const meta = (user?.user_metadata ?? {}) as { display_name?: string; full_name?: string };
  const first = (answers?.name || meta.display_name || meta.full_name || "").trim().split(" ")[0];

  const enter = async () => {
    if (busy) return;
    setBusy(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    try {
      await setAccountStage("app");
    } catch {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Aura hex="#67CD67" top={-200} height={560} />
      <View style={{ flex: 1, paddingTop: insets.top + 36, paddingHorizontal: 24 }}>
        <Animated.View entering={ZoomIn.duration(600).springify().damping(14)} style={{ alignItems: "center" }}>
          <ParticleOrb size={150} mode="speaking" />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(250).duration(500)} style={{ marginTop: 22, alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, height: 28, borderRadius: 14, backgroundColor: "rgba(103,205,103,0.14)" }}>
            <Check size={14} color={C.green} strokeWidth={3} />
            <Text style={{ fontSize: 12.5, fontWeight: "800", letterSpacing: 1, color: C.green }}>CONTA PRONTA</Text>
          </View>
          <Text style={{ marginTop: 16, fontSize: 30, lineHeight: 36, fontWeight: "300", letterSpacing: -0.6, color: "#fff", textAlign: "center" }}>
            {"Tudo pronto,\n"}
            <Text style={{ fontWeight: "800" }}>{first ? `${first}.` : "vamos começar."}</Text>
          </Text>
          <Text style={{ marginTop: 10, fontSize: 15, lineHeight: 22, color: C.soft, textAlign: "center" }}>
            Daqui pra frente eu cuido do seu dinheiro com você. Leva uns 2 minutos para deixar tudo do seu jeito.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(600).duration(500)} style={{ marginTop: 30, gap: 4 }}>
          {STEPS.map(({ Icon, title, line }, n) => (
            <Animated.View key={title} entering={FadeInDown.delay(700 + n * 120).duration(420)} style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12, borderTopWidth: n ? 1 : 0, borderTopColor: C.line }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: C.fill }}>
                <Icon size={19} color="#fff" strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15.5, fontWeight: "700", color: "#fff" }}>{title}</Text>
                <Text style={{ marginTop: 2, fontSize: 13, lineHeight: 18, color: C.soft }}>{line}</Text>
              </View>
            </Animated.View>
          ))}
        </Animated.View>
      </View>

      <Animated.View entering={FadeInDown.delay(1100).duration(500)} style={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 16 }}>
        <Pressable
          onPress={() => void enter()}
          style={({ pressed }) => ({ height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, backgroundColor: "#fff", opacity: pressed ? 0.85 : 1 })}
        >
          {busy && <ActivityIndicator color="#0B0B0B" />}
          <Text style={{ fontSize: 17, fontWeight: "800", color: "#0B0B0B" }}>Entrar no Willo</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}
