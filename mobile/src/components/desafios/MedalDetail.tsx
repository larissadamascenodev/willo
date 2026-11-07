import { useEffect, useState } from "react";
import { Modal, Pressable, Share, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import RoundButton from "~/components/RoundButton";
import { SpinningMedal, medalHue } from "~/components/desafios/Medal3D";
import { ChevronLeft, Share2 } from "~/components/icons";
import { longDate, medalLeft, medalLine, type Medal } from "~/lib/medals";
import { isLight, th } from "~/theme/theme";
import { GROUND, INK } from "~/theme/tokens";

/**
 * A medal, opened on a page of its own.
 *
 * The medal large on a soft light of its own colour, turning round once to say it can
 * be turned; its name, what it was for, and the day it was won. One not won yet says
 * how much is left, with a bar. A won one can be shared.
 */
export default function MedalDetail({ medal, onClose }: { medal: Medal | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [shown, setShown] = useState<Medal | null>(medal);
  useEffect(() => {
    if (medal) setShown(medal);
  }, [medal]);
  if (!shown) return null;

  const m = shown;
  const hue = medalHue(m);
  const size = Math.min(260, Math.round(width * 0.64));
  const share = Math.max(0, Math.min(1, m.value / m.step));
  const headline = m.hidden ? "Medalha secreta" : m.level === 0 ? m.name : `${m.name}: ${m.title}`;

  return (
    <Modal visible={!!medal} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose} onDismiss={() => setShown(null)}>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: th(GROUND, "bg") }}>
        {/* A soft light of the medal's colour behind it, curving off below. */}
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top + 70 + size * 0.78, overflow: "hidden", borderBottomLeftRadius: width, borderBottomRightRadius: width, transform: [{ scaleX: 1.6 }] }}>
          <LinearGradient
            colors={isLight() ? ["#FFFFFF", `${hue}22`] : ["rgba(255,255,255,0.02)", `${hue}33`]}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          />
        </View>

        <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, flexDirection: "row", alignItems: "center" }}>
          <RoundButton label="Voltar" onPress={onClose}>
            <ChevronLeft size={20} color={th("rgba(255,255,255,0.9)")} strokeWidth={2.2} />
          </RoundButton>
          <Text style={{ flex: 1, textAlign: "center", marginRight: 44, fontSize: 16, fontWeight: "700", color: th("#fff") }}>Detalhes da medalha</Text>
        </View>

        <Animated.View entering={FadeIn.duration(300)} style={{ marginTop: 36, alignItems: "center" }}>
          <SpinningMedal m={m} size={size} />
          <Text style={{ marginTop: 14, fontSize: 12, color: th(INK.softer) }}>Arraste para girar</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).duration(400)} style={{ marginTop: 22, paddingHorizontal: 28, alignItems: "center" }}>
          <Text style={{ textAlign: "center", fontSize: 30, fontWeight: "800", letterSpacing: -1, lineHeight: 34, color: th("#fff") }}>{headline}</Text>
          <Text style={{ marginTop: 12, textAlign: "center", fontSize: 15.5, lineHeight: 22, color: th(INK.soft) }}>{medalLine(m)}</Text>
          {m.earned ? (
            <Text style={{ marginTop: 14, fontSize: 15, fontWeight: "700", color: th("rgba(255,255,255,0.8)") }}>
              {m.earnedOn ? `Recebida em ${longDate(m.earnedOn)}.` : "Medalha conquistada."}
            </Text>
          ) : !m.hidden ? (
            <View style={{ marginTop: 18, alignSelf: "stretch" }}>
              <View style={{ height: 8, borderRadius: 4, overflow: "hidden", backgroundColor: th("rgba(255,255,255,0.1)", "bg") }}>
                <View style={{ width: `${Math.max(share, 0.02) * 100}%`, height: 8, borderRadius: 4, backgroundColor: hue }} />
              </View>
              <View style={{ marginTop: 8, flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 13.5, fontWeight: "600", color: th("#fff") }}>{medalLeft(m)}</Text>
                <Text style={{ fontSize: 13.5, color: th(INK.soft) }}>
                  {Math.min(m.value, m.step)} de {m.step}
                </Text>
              </View>
            </View>
          ) : null}
        </Animated.View>

        {m.earned && (
          <View style={{ position: "absolute", left: 20, right: 20, bottom: insets.bottom + 16 }}>
            <Pressable
              onPress={() => void Share.share({ message: `Conquistei a medalha "${headline}" no Willo!` }).catch(() => undefined)}
              accessibilityRole="button"
              style={({ pressed }) => ({ height: 56, borderRadius: 28, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: hue, opacity: pressed ? 0.85 : 1 })}
            >
              <Share2 size={19} color="#FFFFFF" strokeWidth={2.4} />
              <Text style={{ fontSize: 17, fontWeight: "800", color: "#FFFFFF" }}>Compartilhar medalha</Text>
            </Pressable>
          </View>
        )}
      </GestureHandlerRootView>
    </Modal>
  );
}
