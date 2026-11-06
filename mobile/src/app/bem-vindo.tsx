import { useCallback, useEffect, useRef, useState, type ComponentRef, type ReactNode } from "react";
import { Image, Pressable, ScrollView, Text, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { cancelAnimation, Easing, FadeIn, useAnimatedStyle, useSharedValue, withSequence, withTiming, type SharedValue } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import Room from "~/components/Room";
import { AskDemo, ForecastDemo, NotifyDemo, QuickDemo, RadarDemo, ReceiptDemo, VoiceDemo } from "~/components/welcome/Demos";
import { INK } from "~/theme/tokens";
import { isIntroDone, onIntroDone } from "~/lib/launchIntro";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const LOGO = require("../../assets/images/willo-logo-white.png") as number;

/**
 * The first thing anyone sees without an account.
 *
 * Slides, one for each thing the app does, that pass on their own and can be swiped.
 * Each fills the screen with that thing happening — a bank's purchase notification
 * written down by itself (Willo Atento), sentences spoken and noted, two taps on the
 * back of the phone or on Willo, a receipt scanned, the Radar's own dial going round
 * its areas, the month ahead with a spend tried against it, questions answered (see
 * Demos) — under its number, its name, a title and a line.
 *
 * A slide's demonstration plays only while it is showing, and only the slides next
 * to it are drawn. Touching or swiping holds the timer; letting go starts the slide
 * over. The way in stays at the foot the whole time. Nothing starts under the
 * opening animation.
 */

interface Slide {
  tag: string;
  title: string;
  line: string;
  Demo: (p: { active: boolean }) => ReactNode;
}

const SLIDES: Slide[] = [
  { tag: "WILLO ATENTO", title: "Você compra.\nEle já anotou.", line: "O Willo lê o aviso de compra do banco\ne registra sozinho. Você só confere.", Demo: NotifyDemo },
  { tag: "VOZ", title: "Fale.\nO Willo anota.", line: "Diga do seu jeito: ele entende o valor,\na categoria, a conta e o dia.", Demo: VoiceDemo },
  { tag: "REGISTRO RÁPIDO", title: "Dois toques,\num gasto salvo.", line: "Dois toques atrás do celular ou no Willo\ne o registro rápido já abre.", Demo: QuickDemo },
  { tag: "COMPROVANTE", title: "Fotografe.\nEle lê por você.", line: "Local, valor, pagamento e data saem\nda foto direto para o registro.", Demo: ReceiptDemo },
  { tag: "RADAR FINANCEIRO", title: "Cada área do seu\ndinheiro, explicada.", line: "Consumo, hábitos, compromissos, futuro\ne saúde, cada um numa frase.", Demo: RadarDemo },
  { tag: "PREVISÃO", title: "O fim do mês,\nantes do fim.", line: "Veja quanto sobra no dia 30 e simule\num gasto antes de fazer.", Demo: ForecastDemo },
  { tag: "CONVERSA", title: "Pergunte.\nEle calcula.", line: "Respostas com os seus números,\nnão com conselhos genéricos.", Demo: AskDemo },
];
const N = SLIDES.length;
const SLIDE_MS = 8500;
/* The demonstrations are laid out for this much height and shrink where there is less. */
const DEMO_H = 440;

export default function BemVindo() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const pager = useRef<ComponentRef<typeof ScrollView>>(null);
  const [index, setIndex] = useState(0);
  const [held, setHeld] = useState(false);
  const [ready, setReady] = useState(isIntroDone());
  const [area, setArea] = useState(DEMO_H);
  const [pageH, setPageH] = useState(0);
  useEffect(() => onIntroDone(() => setReady(true)), []);

  /* The bar under the current number fills over the slide's time. It is started from
     here with its full length, never read back: on the phone the animation runs on
     another thread. */
  const progress = useSharedValue(0);
  useEffect(() => {
    if (!ready) return;
    if (held) {
      cancelAnimation(progress);
      return;
    }
    progress.set(withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: SLIDE_MS, easing: Easing.linear })));
    const id = setTimeout(() => {
      const next = (index + 1) % N;
      pager.current?.scrollTo({ x: next * width, animated: true });
      setIndex(next);
    }, SLIDE_MS);
    return () => clearTimeout(id);
  }, [index, held, ready, width, progress]);

  const settle = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const i = Math.round(e.nativeEvent.contentOffset.x / width);
      if (i !== index) void Haptics.selectionAsync().catch(() => undefined);
      setIndex(Math.max(0, Math.min(N - 1, i)));
      setHeld(false);
    },
    [width, index],
  );

  const scale = Math.min(1, area / DEMO_H);

  return (
    <Room lit sky={false}>
      <View style={{ flex: 1, paddingTop: insets.top + 14 }}>
        <Animated.View entering={FadeIn.delay(100).duration(600)} style={{ alignItems: "center" }}>
          <Image source={LOGO} tintColor="#F7F5F2" resizeMode="contain" accessibilityRole="image" accessibilityLabel="Willo" style={{ width: 78, height: 78 * (222 / 725) }} />
        </Animated.View>

        <ScrollView
          ref={pager}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScrollBeginDrag={() => setHeld(true)}
          onMomentumScrollEnd={settle}
          onTouchStart={() => setHeld(true)}
          onTouchEnd={() => setHeld(false)}
          onLayout={(e) => setPageH(e.nativeEvent.layout.height)}
          style={{ flex: 1 }}
        >
          {SLIDES.map((s, i) => (
            <View key={s.tag} style={{ width, height: pageH || undefined, paddingHorizontal: 24 }}>
              <View
                onLayout={i === index ? (e) => setArea(e.nativeEvent.layout.height) : undefined}
                style={{ flex: 1, alignItems: "center", justifyContent: "center", overflow: "visible" }}
              >
                {Math.abs(i - index) <= 1 && (
                  <View style={{ width: width - 48, transform: [{ scale }], alignItems: "center" }}>
                    <s.Demo active={ready && i === index} />
                  </View>
                )}
              </View>
              <Caption i={i} slide={s} current={index} progress={progress} />
            </View>
          ))}
        </ScrollView>

        <View style={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: insets.bottom + 12 }}>
          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
              router.push("/comecar" as never);
            }}
            accessibilityRole="button"
            style={({ pressed }) => ({ height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", backgroundColor: "#fff", transform: [{ scale: pressed ? 0.98 : 1 }] })}
          >
            <Text style={{ fontSize: 17, fontWeight: "700", color: "#0B0B0B" }}>Começar agora</Text>
          </Pressable>
          {/* Not a second button: whoever has an account is a minority here, and two
              equal buttons would ask every new person to choose. */}
          <Pressable
            onPress={() => router.push("/login" as never)}
            accessibilityRole="button"
            hitSlop={8}
            style={({ pressed }) => ({ height: 48, marginTop: 4, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
          >
            <Text style={{ fontSize: 15.5, fontWeight: "600", color: "rgba(255,255,255,0.82)" }}>Já tenho conta</Text>
          </Pressable>
        </View>
      </View>
    </Room>
  );
}

/** The slide's number, the bars of all of them with this one filling, its name, title and line. */
function Caption({ i, slide, current, progress }: { i: number; slide: Slide; current: number; progress: SharedValue<number> }) {
  return (
    <View style={{ paddingTop: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Text style={{ fontFamily: "Menlo", fontSize: 12, letterSpacing: 1, color: INK.softer }}>
          {String(i + 1).padStart(2, "0")} / {String(N).padStart(2, "0")}
        </Text>
        <View style={{ flexDirection: "row", gap: 4 }}>
          {SLIDES.map((s, k) => (
            <View key={s.tag} style={{ width: k === i ? 22 : 6, height: 3, borderRadius: 2, backgroundColor: k < i ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.2)", overflow: "hidden" }}>
              {k === i && <Fill progress={progress} live={i === current} />}
            </View>
          ))}
        </View>
        <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: "Menlo", fontSize: 12, letterSpacing: 1.2, color: INK.softer }}>
          {slide.tag}
        </Text>
      </View>
      <Text style={{ marginTop: 10, fontSize: 30, fontWeight: "800", letterSpacing: -1, lineHeight: 34, color: "#fff" }}>{slide.title}</Text>
      <Text style={{ marginTop: 10, fontSize: 15, lineHeight: 21, color: INK.soft }}>{slide.line}</Text>
    </View>
  );
}

function Fill({ progress, live }: { progress: SharedValue<number>; live: boolean }) {
  const style = useAnimatedStyle(() => ({ width: `${(live ? progress.get() : 0) * 100}%` }));
  return <Animated.View style={[{ height: "100%", backgroundColor: "#fff" }, style]} />;
}
