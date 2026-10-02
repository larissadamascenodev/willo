import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, Modal, Pressable, Share, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Share2, X } from "lucide-react-native";
import { getCategoryIcon } from "@/lib/categoryUtils";
import type { MonthWrap } from "@/services/raioXAnalytics";
import { Text, colors, white } from "~/ui";
import { brl, brlCents } from "./primitives";

const SLIDE_MS = 5500;

interface Slide { colors: [string, string]; content: ReactNode }

const Big = ({ children }: { children: ReactNode }) => <Text weight="extrabold" size={48} style={{ lineHeight: 50, letterSpacing: -1.5 }}>{children}</Text>;
const Kicker = ({ children }: { children: ReactNode }) => <Text weight="bold" size={13} color={white(0.74)} style={{ letterSpacing: 2.4, textTransform: "uppercase" }}>{children}</Text>;
const Sub = ({ children }: { children: ReactNode }) => <Text size={17} color={white(0.85)} style={{ marginTop: 16, lineHeight: 23 }}>{children}</Text>;
const Emoji = ({ children, size = 56 }: { children: string; size?: number }) => <Text size={size} style={{ lineHeight: size * 1.2 }}>{children}</Text>;

function buildSlides(w: MonthWrap): Slide[] {
  const slides: Slide[] = [
    { colors: ["#3F6212", "#0B0B0B"], content: (<><Emoji size={64}>✨</Emoji><Kicker>Retrospectiva</Kicker><Big>Seu {w.monthLabel} em números</Big><Sub>{w.count} lançamentos contando a história do seu dinheiro. Bora ver?</Sub></>) },
    {
      colors: ["#1E3A8A", "#0B0B0B"],
      content: (
        <>
          <Kicker>O mês em resumo</Kicker>
          <View style={{ marginTop: 16, gap: 16 }}>
            <View><Text size={15} color={white(0.74)}>Entrou</Text><Text weight="extrabold" size={40} tabular color="#C8F36D">{brl(w.income)}</Text></View>
            <View><Text size={15} color={white(0.74)}>Saiu</Text><Text weight="extrabold" size={40} tabular>{brl(w.expense)}</Text></View>
            <View><Text size={15} color={white(0.74)}>{w.saved >= 0 ? "Sobrou" : "Faltou"}</Text><Text weight="extrabold" size={40} tabular color={w.saved >= 0 ? "#C8F36D" : "#F87171"}>{brl(Math.abs(w.saved))}</Text></View>
          </View>
          {w.savedPct !== null && w.savedPct > 0 && <Sub>Você guardou {Math.round(w.savedPct * 100)}% do que ganhou 💰</Sub>}
        </>
      ),
    },
  ];

  if (w.villain) {
    const Icon = getCategoryIcon(w.villain.name);
    slides.push({
      colors: ["#7F1D1D", "#0B0B0B"],
      content: (
        <>
          <Emoji>😈</Emoji><Kicker>Categoria vilã</Kicker>
          <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: white(0.1) }}><Icon size={28} color="#F87171" /></View>
            <View style={{ flex: 1 }}><Big>{w.villain.name}</Big></View>
          </View>
          <Sub>Levou {brl(w.villain.amount)}, {Math.round(w.villain.share * 100)}% de tudo que você gastou.</Sub>
        </>
      ),
    });
  }
  if (w.priciestDay) {
    const d = new Date(`${w.priciestDay.date}T12:00:00`);
    slides.push({ colors: ["#86198F", "#0B0B0B"], content: (<><Emoji>📅</Emoji><Kicker>Dia mais caro</Kicker><Big>{d.getDate()} de {w.monthLabel}</Big><Sub>Uma {w.priciestDay.weekday} de {brl(w.priciestDay.amount)} em gastos. Que dia, hein?</Sub></>) });
  }
  if (w.biggest) {
    slides.push({ colors: ["#9A3412", "#0B0B0B"], content: (<><Emoji>🛍️</Emoji><Kicker>Maior compra</Kicker><Big>{brlCents(w.biggest.amount)}</Big><Sub>{w.biggest.name}. Valeu a pena? Só você sabe 😉</Sub></>) });
  }
  slides.push({
    colors: ["#3F6212", "#0B0B0B"],
    content: (
      <>
        <Emoji size={64}>🏆</Emoji><Kicker>Maior conquista</Kicker>
        <Text weight="extrabold" size={32} style={{ marginTop: 8, lineHeight: 38, letterSpacing: -0.6 }}>{w.win}</Text>
        {w.score !== null && (
          <View style={{ marginTop: 24, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 20, backgroundColor: white(0.1), paddingHorizontal: 16, paddingVertical: 12 }}>
            <Text weight="extrabold" size={34} tabular>{w.score}</Text>
            <View>
              <Text size={14} color={white(0.82)}>pontos de saúde financeira</Text>
              {w.scoreDelta !== null && w.scoreDelta !== 0 && <Text size={14} weight="bold" color={w.scoreDelta > 0 ? "#C8F36D" : "#F87171"}>{w.scoreDelta > 0 ? "+" : ""}{w.scoreDelta} vs mês anterior</Text>}
            </View>
          </View>
        )}
      </>
    ),
  });
  return slides;
}

/** A retrospectiva do mês passado, em histórias, feita para compartilhar. */
export function MonthWrapped({ wrap, open, onClose }: { wrap: MonthWrap; open: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const slides = buildSlides(wrap);
  const [index, setIndex] = useState(0);
  const last = index === slides.length - 1;
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => { if (open) setIndex(0); }, [open]);

  useEffect(() => {
    if (!open) return;
    progress.setValue(last ? 1 : 0);
    if (last) return;
    const anim = Animated.timing(progress, { toValue: 1, duration: SLIDE_MS, easing: Easing.linear, useNativeDriver: false });
    anim.start(({ finished }) => { if (finished) setIndex((i) => Math.min(i + 1, slides.length - 1)); });
    return () => anim.stop();
  }, [open, index, last, progress, slides.length]);

  const share = async () => {
    const text = [
      `Minha retrospectiva de ${wrap.monthLabel} no Willo ✨`,
      wrap.saved >= 0 ? `💰 Sobraram ${brl(wrap.saved)}` : null,
      wrap.villain ? `😈 Categoria vilã: ${wrap.villain.name}` : null,
      `🏆 ${wrap.win}`,
      wrap.score !== null ? `📊 Score: ${wrap.score} pontos` : null,
    ].filter(Boolean).join("\n");
    try { await Share.share({ message: text }); } catch { /* a folha de compartilhar foi fechada */ }
  };

  const slide = slides[index];
  return (
    <Modal visible={open} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <LinearGradient colors={slide.colors} start={{ x: 0.2, y: 0 }} end={{ x: 0.6, y: 0.8 }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />

        <View style={{ position: "absolute", left: 12, right: 12, top: insets.top + 10, flexDirection: "row", gap: 4, zIndex: 20 }}>
          {slides.map((_, i) => (
            <View key={i} style={{ flex: 1, height: 3, borderRadius: 2, overflow: "hidden", backgroundColor: white(0.25) }}>
              {i < index && <View style={{ flex: 1, backgroundColor: "#fff" }} />}
              {i === index && <Animated.View style={{ height: 3, backgroundColor: "#fff", width: progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }} />}
            </View>
          ))}
        </View>
        <View style={{ position: "absolute", left: 16, right: 16, top: insets.top + 22, flexDirection: "row", alignItems: "center", justifyContent: "space-between", zIndex: 20 }}>
          <Text size={13} weight="semibold" color={white(0.8)}>willo.</Text>
          <Pressable onPress={onClose} accessibilityLabel="Fechar" hitSlop={10} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}><X size={24} color="#fff" /></Pressable>
        </View>

        <Pressable accessibilityLabel="Anterior" onPress={() => setIndex((i) => Math.max(i - 1, 0))} style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: "33%", zIndex: 10 }} />
        <Pressable accessibilityLabel="Próximo" onPress={() => (last ? undefined : setIndex((i) => i + 1))} style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: "67%", zIndex: 10 }} />

        <View pointerEvents="none" style={{ flex: 1, justifyContent: "center", paddingHorizontal: 24 }}>{slide.content}</View>

        {last && (
          <View style={{ position: "absolute", left: 20, right: 20, bottom: insets.bottom + 24, flexDirection: "row", gap: 10, zIndex: 20 }}>
            <Pressable onPress={share} style={{ flex: 1, height: 56, borderRadius: 28, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#fff" }}>
              <Share2 size={20} color={colors.black} /><Text weight="bold" size={16} color={colors.black}>Compartilhar</Text>
            </Pressable>
            <Pressable onPress={onClose} style={{ height: 56, borderRadius: 28, paddingHorizontal: 24, alignItems: "center", justifyContent: "center", backgroundColor: white(0.15) }}><Text weight="semibold" size={16}>Fechar</Text></Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}
