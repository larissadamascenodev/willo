import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import LegalSheet from "~/components/auth/LegalSheet";
import { Check } from "~/components/icons";
import { Aura, C, Cta, Header } from "./kit";

/**
 * "Antes de começar, só confirme": the Terms and the Privacy Policy, sending data to
 * the AI providers, and that Willo organises rather than advises. Each line can be
 * ticked on its own; the button ticks whatever is left and goes on. The names of the
 * documents open them in place.
 *
 * Used in the onboarding right after the name, and once inside the app for an account
 * that never gave this "yes".
 */
export default function Consent({ progress, onBack, onAccept, busy }: { progress?: number; onBack?: () => void; onAccept: () => void; busy?: boolean }) {
  const insets = useSafeAreaInsets();
  const [terms, setTerms] = useState(false);
  const [advice, setAdvice] = useState(false);
  const [legal, setLegal] = useState<"terms" | "privacy" | null>(null);

  const accept = () => {
    if (busy) return;
    setTerms(true);
    setAdvice(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    setTimeout(onAccept, 260);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Aura hex={C.violet} />
      <View style={{ flex: 1, paddingTop: insets.top + 6 }}>
        {onBack ? <Header section="ANTES DE COMEÇAR" progress={progress ?? 0} onBack={onBack} /> : <View style={{ height: 44 }} />}
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 24 }} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInDown.duration(480)}>
            <Text style={{ fontSize: 28, lineHeight: 34, fontWeight: "300", letterSpacing: -0.6, color: "#fff" }}>
              Antes de começar,{"\n"}
              <Text style={{ fontWeight: "800" }}>só confirme:</Text>
            </Text>
          </Animated.View>

          <View style={{ marginTop: 32, gap: 20 }}>
            <Line on={terms} onPress={() => setTerms((v) => !v)} delay={120}>
              Aceito os{" "}
              <Text onPress={() => setLegal("terms")} style={{ color: "#fff", textDecorationLine: "underline" }}>
                Termos de Uso
              </Text>{" "}
              e a{" "}
              <Text onPress={() => setLegal("privacy")} style={{ color: "#fff", textDecorationLine: "underline" }}>
                Política de Privacidade
              </Text>
              , incluindo o envio dos meus dados à <Text style={{ color: "#fff" }}>Anthropic e ao Google Gemini</Text> (servidores nos EUA).
            </Line>
            <Line on={advice} onPress={() => setAdvice((v) => !v)} delay={220}>
              Entendo que o Willo <Text style={{ color: "#fff" }}>organiza</Text> minhas finanças e <Text style={{ color: "#fff" }}>não é consultoria financeira</Text>: as decisões são minhas.
            </Line>
          </View>
        </ScrollView>
        <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: insets.bottom + 12 }}>
          <Cta label="Aceitar tudo e começar" onPress={accept} disabled={busy} />
        </View>
      </View>
      <LegalSheet which={legal} onClose={() => setLegal(null)} />
    </View>
  );
}

function Line({ on, onPress, delay, children }: { on: boolean; onPress: () => void; delay: number; children: React.ReactNode }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(420)}>
      <Pressable
        onPress={() => {
          void Haptics.selectionAsync().catch(() => undefined);
          onPress();
        }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: on }}
        style={{ flexDirection: "row", gap: 14, alignItems: "flex-start" }}
      >
        <View style={{ width: 24, height: 24, borderRadius: 12, marginTop: 0, alignItems: "center", justifyContent: "center", borderWidth: on ? 0 : 1.5, borderColor: "rgba(255,255,255,0.45)", backgroundColor: on ? "#fff" : "transparent" }}>
          {on && (
            <Animated.View entering={ZoomIn.duration(200)}>
              <Check size={14} color="#0B0B0B" strokeWidth={3.2} />
            </Animated.View>
          )}
        </View>
        <Text style={{ flex: 1, fontSize: 13.5, lineHeight: 19.5, color: C.soft }}>{children}</Text>
      </Pressable>
    </Animated.View>
  );
}
