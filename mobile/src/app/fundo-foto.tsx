import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Room from "~/components/Room";
import RoundButton from "~/components/RoundButton";
import Surface from "~/components/Surface";
import { X } from "~/components/icons";
import { VEIL_STEPS, nearestStep, discardPhoto, photoUri, setLightSkyModel, setPhotoLook, setSkyModel, setSkyPhoto, usePhotoLook, useSkyPhoto } from "~/lib/skyModel";
import SegmentedTabs from "~/components/SegmentedTabs";
import { isLight, th, thIn, useThemeRedraw } from "~/theme/theme";
import { INK } from "~/theme/tokens";

/**
 * A photo, seen as the home will wear it, before it is kept.
 *
 * The photo is always worn the same way — blurred, under a veil, heavier at the top —
 * so it reads well whatever the photo is. In the dark theme the veil is dark and the
 * person picks how strong, in three set steps; in the light one they pick a light or
 * a dark veil, at a set strength. This shows it with
 * a line of the home and a card over it, and keeps it on "Usar como fundo".
 * Backing out of a newly picked photo throws it away.
 */
export default function FundoFoto() {
  /* Drawn again in place when the theme changes. */
  useThemeRedraw();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { file } = useLocalSearchParams<{ file?: string }>();
  const current = useSkyPhoto();
  const uri = file ? photoUri(file) : current;
  const [saving, setSaving] = useState(false);
  const light = isLight();
  const storedLook = usePhotoLook("light");
  const darkLook = usePhotoLook("dark");
  const [step, setStep] = useState<(typeof VEIL_STEPS)[number]["key"]>(VEIL_STEPS[nearestStep(darkLook.amount)].key);
  const amount = VEIL_STEPS.find((v) => v.key === step)!.amount;
  const [tone, setTone] = useState<"light" | "dark">(light ? storedLook.tone : "dark");

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/perfil" as never);
  };

  const cancel = () => {
    if (file) discardPhoto(file);
    close();
  };

  const use = () => {
    if (saving) return;
    setSaving(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    if (file) setSkyPhoto(file, false);
    if (light) setPhotoLook("light", { ...storedLook, tone });
    else setPhotoLook("dark", { ...darkLook, tone: "dark", amount });
    if (light) setLightSkyModel("custom");
    else setSkyModel("custom");
    close();
  };

  /* On the photo, the ink follows the veil; inside the card, the theme's. */
  const ink = thIn(tone, "#fff");
  const soft = thIn(tone, INK.soft);
  const cardInk = th("#fff");
  const cardSoft = th(INK.soft);

  if (!uri) {
    return (
      <Room>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
          <Text style={{ textAlign: "center", fontSize: 15, color: soft }}>Nenhuma foto escolhida.</Text>
        </View>
      </Room>
    );
  }

  return (
    <Room preview="custom" previewPhoto={uri} previewTone={tone} previewAmount={light ? undefined : amount}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, flexDirection: "row", alignItems: "center" }}>
        <RoundButton label="Cancelar" onPress={cancel}>
          <X size={18} color={ink} strokeWidth={2.2} />
        </RoundButton>
        <Text style={{ flex: 1, textAlign: "center", marginRight: 40, fontSize: 16, fontWeight: "600", color: ink }}>Seu fundo</Text>
      </View>

      {/* What will sit on it: a line from the top of the home and a card. */}
      <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 16, gap: 18 }}>
        <View style={{ alignItems: "center" }}>
          <Text style={{ fontSize: 24, fontWeight: "700", letterSpacing: -0.5, color: ink }}>Oi. Tô aqui.</Text>
          <Text style={{ marginTop: 4, fontSize: 15, color: soft }}>O que vamos resolver agora?</Text>
        </View>
        <Surface>
          <View style={{ padding: 18 }}>
            <Text style={{ fontSize: 14, color: cardSoft }}>Saldo em contas</Text>
            <Text style={{ marginTop: 4, fontSize: 30, fontWeight: "800", letterSpacing: -0.9, color: cardInk }}>R$ 4.280,00</Text>
            <Text style={{ marginTop: 6, fontSize: 13.5, color: cardSoft }}>
              Previsto no fim do mês: <Text style={{ fontWeight: "700", color: cardInk }}>R$ 1.120,00</Text>
            </Text>
          </View>
        </Surface>
      </View>

      <View style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16, gap: 10 }}>
        {!light && (
          <View style={{ marginBottom: 6 }}>
            <Text style={{ textAlign: "center", fontSize: 13, fontWeight: "600", color: soft, marginBottom: 8 }}>Intensidade do véu</Text>
            <SegmentedTabs glass height={38} value={step} onChange={setStep} options={VEIL_STEPS.map((v) => ({ key: v.key, label: v.label }))} />
          </View>
        )}
        {light && (
          <View style={{ marginBottom: 6 }}>
            <Text style={{ textAlign: "center", fontSize: 13, fontWeight: "600", color: soft, marginBottom: 8 }}>Véu sobre a foto</Text>
            <SegmentedTabs
              glass
              height={38}
              value={tone}
              onChange={setTone}
              options={[
                { key: "light" as const, label: "Claro" },
                { key: "dark" as const, label: "Escuro" },
              ]}
            />
          </View>
        )}
        <Text style={{ textAlign: "center", fontSize: 13, lineHeight: 18, color: soft }}>Aparece só na tela inicial, suavizada para a leitura.</Text>
        <Pressable
          onPress={use}
          disabled={saving}
          accessibilityRole="button"
          style={({ pressed }) => ({
            height: 54,
            borderRadius: 27,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: thIn(tone, "#fff", "bg"),
            opacity: pressed || saving ? 0.85 : 1,
          })}
        >
          <Text style={{ fontSize: 16, fontWeight: "700", color: thIn(tone, "#0B0B0B") }}>Usar como fundo</Text>
        </Pressable>
      </View>
    </Room>
  );
}
