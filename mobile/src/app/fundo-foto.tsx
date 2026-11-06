import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Room from "~/components/Room";
import RoundButton from "~/components/RoundButton";
import SegmentedTabs from "~/components/SegmentedTabs";
import PlainSlider from "~/components/PlainSlider";
import Surface from "~/components/Surface";
import { Toggle } from "~/components/registro/entryParts";
import { X } from "~/components/icons";
import {
  discardPhoto,
  photoUri,
  setLightSkyModel,
  setPhotoLook,
  setSkyModel,
  setSkyPhoto,
  usePhotoLook,
  useSkyPhoto,
  type PhotoLook,
} from "~/lib/skyModel";
import { isLight, th } from "~/theme/theme";
import { INK } from "~/theme/tokens";

/**
 * Setting a photo as the background, the way a chat app sets its wallpaper.
 *
 * The photo fills the screen with a sample of the home over it — a line of text and
 * a card — so the person sees what they will read on it. Under that: a veil, light or
 * dark, dragged to the strength they want, and the photo blurred or not. Nothing is
 * kept until "Usar como fundo"; backing out of a newly picked photo throws it away.
 *
 * Each theme keeps its own veil, so this edits the one for the theme on screen.
 */

const MAX_VEIL = 0.85;

export default function FundoFoto() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { file } = useLocalSearchParams<{ file?: string }>();
  const mode = isLight() ? "light" : "dark";
  const stored = usePhotoLook(mode);
  const current = useSkyPhoto();
  const uri = file ? photoUri(file) : current;

  const [look, setLook] = useState<PhotoLook>(stored);
  const [saving, setSaving] = useState(false);

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
    setPhotoLook(mode, look);
    if (file) setSkyPhoto(file, false);
    if (mode === "light") setLightSkyModel("custom");
    else setSkyModel("custom");
    close();
  };

  if (!uri) {
    return (
      <Room>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
          <Text style={{ textAlign: "center", fontSize: 15, color: th(INK.soft) }}>Nenhuma foto escolhida.</Text>
        </View>
      </Room>
    );
  }

  /* The sample's ink is the theme's, as on the home. */
  const ink = th("#fff");
  const soft = th(INK.soft);

  return (
    <Room preview="custom" previewPhoto={uri} previewLook={look}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, flexDirection: "row", alignItems: "center" }}>
        <RoundButton label="Cancelar" onPress={cancel}>
          <X size={18} color={ink} strokeWidth={2.2} />
        </RoundButton>
        <Text style={{ flex: 1, textAlign: "center", marginRight: 40, fontSize: 16, fontWeight: "600", color: ink }}>Ajustar o fundo</Text>
      </View>

      {/* What will sit on it: a line from the top of the home and a card. */}
      <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 16, gap: 18 }}>
        <View style={{ alignItems: "center" }}>
          <Text style={{ fontSize: 24, fontWeight: "700", letterSpacing: -0.5, color: ink }}>Oi. Tô aqui.</Text>
          <Text style={{ marginTop: 4, fontSize: 15, color: soft }}>O que vamos resolver agora?</Text>
        </View>
        <Surface>
          <View style={{ padding: 18 }}>
            <Text style={{ fontSize: 14, color: soft }}>Saldo em contas</Text>
            <Text style={{ marginTop: 4, fontSize: 30, fontWeight: "800", letterSpacing: -0.9, color: ink }}>R$ 4.280,00</Text>
            <Text style={{ marginTop: 6, fontSize: 13.5, color: soft }}>
              Previsto no fim do mês: <Text style={{ fontWeight: "700", color: ink }}>R$ 1.120,00</Text>
            </Text>
          </View>
        </Surface>
      </View>

      {/* The controls, on a pane of their own so they read on any photo. */}
      <View style={{ marginHorizontal: 12, marginBottom: insets.bottom + 12, borderRadius: 28, borderCurve: "continuous", overflow: "hidden" }}>
        <BlurView intensity={70} tint={th("dark", "tint")} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: isLight() ? "rgba(250,250,251,0.72)" : "rgba(16,18,22,0.6)" }} />
        <View style={{ padding: 18, gap: 16 }}>
          <View>
            <Text style={{ fontSize: 13, fontWeight: "600", color: soft, marginBottom: 8 }}>Véu sobre a foto</Text>
            <SegmentedTabs
              compact
              height={36}
              value={look.tone}
              onChange={(tone) => setLook((l) => ({ ...l, tone }))}
              options={[
                { key: "light" as const, label: "Claro" },
                { key: "dark" as const, label: "Escuro" },
              ]}
            />
          </View>

          <View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 2 }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: soft }}>Intensidade</Text>
              <Text style={{ fontSize: 13, color: soft, fontVariant: ["tabular-nums"] }}>{Math.round((look.amount / MAX_VEIL) * 100)}%</Text>
            </View>
            <PlainSlider
              label="Intensidade do véu"
              value={look.amount / MAX_VEIL}
              onChange={(v) => setLook((l) => ({ ...l, amount: Math.round(v * MAX_VEIL * 100) / 100 }))}
              fill={th("#fff")}
              track={th("rgba(255,255,255,0.18)", "bg")}
              knob="#FFFFFF"
            />
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Text style={{ flex: 1, fontSize: 15, fontWeight: "500", color: ink }}>Desfocar a foto</Text>
            <Toggle label="Desfocar a foto" value={look.blur} onChange={(blur) => setLook((l) => ({ ...l, blur }))} />
          </View>

          <Pressable
            onPress={use}
            disabled={saving}
            accessibilityRole="button"
            style={({ pressed }) => ({
              height: 52,
              borderRadius: 26,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: th("#fff", "bg"),
              opacity: pressed || saving ? 0.85 : 1,
            })}
          >
            <Text style={{ fontSize: 16, fontWeight: "700", color: th("#0B0B0B") }}>Usar como fundo</Text>
          </Pressable>
        </View>
      </View>
    </Room>
  );
}
