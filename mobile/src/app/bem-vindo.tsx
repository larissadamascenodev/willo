import { useCallback, useEffect, useRef, useState, type ComponentRef, type ReactNode } from "react";
import { Image, Pressable, ScrollView, Text, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { cancelAnimation, Easing, FadeIn, useAnimatedStyle, useSharedValue, withSequence, withTiming, type SharedValue } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import Room from "~/components/Room";
import LoginSheet from "~/components/auth/LoginSheet";
import { AskDemo, DURATIONS, ForecastDemo, NotifyDemo, RadarDemo, ReceiptDemo, VoiceDemo } from "~/components/welcome/Demos";
import QuickTap, { QUICK_MS } from "~/components/onboarding/QuickTap";
import { isOnboarded } from "~/lib/onboarding";
import { INK } from "~/theme/tokens";
import { isIntroDone, onIntroDone } from "~/lib/launchIntro";
import { useThemeRedraw } from "~/theme/theme";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const LOGO = require("../../assets/images/willo-logo-white.png") as number;

/**
 * The first thing anyone sees without an account.
 *
 * Slides, one for each thing the app does, that pass on their own and can be swiped.
 * Each fills the screen with that thing happening — a bank's purchase notification
 * written down by itself (Willo Copilot), sentences spoken and noted, two taps on the
 * back of the phone or on Willo, a receipt scanned, the Radar's own dial going round
 * its areas, the month ahead with a spend tried against it, questions answered (see
 * Demos) — under its number, its name, a title and a line.
 *
 * A slide's demonstration plays only while it is showing, and only the slides next
 * to it are drawn. A slide lasts as long as its demonstration plus a short hold,
 * so nothing is cut off; it settles out before the next comes in. Swiping holds the
 * timer. The way in stays at the foot the whole time. Nothing starts under the
 * opening animation.
 */

interface Slide {
  tag: string;
  title: string;
  line: string;
  Demo: (p: { active: boolean }) => ReactNode;
  /** How long its demonstration runs; the slide holds a moment after it. */
  ms: number;
}

const SLIDES: Slide[] = [
  { tag: "WILLO COPILOT", title: "Gastou? Já está anotado.", line: "O Willo pega o aviso de compra do seu banco\ne lança para você. É só conferir.", Demo: NotifyDemo, ms: DURATIONS.notify },
  { tag: "VOZ", title: "Falou, está registrado.", line: "“Gastei 40 no mercado, no débito.” O Willo\nentende valor, categoria, conta e dia.", Demo: VoiceDemo, ms: DURATIONS.voice },
  { tag: "REGISTRO RÁPIDO", title: "Anotar leva 2 segundos.", line: "Dois toques nas costas do iPhone e o\nregistro abre. Nenhum gasto escapa.", Demo: QuickTap, ms: QUICK_MS },
  { tag: "COMPROVANTE", title: "Fotografe. Está feito.", line: "Valor, local, pagamento e data saem da\nfoto direto para o registro. Sem digitar.", Demo: ReceiptDemo, ms: DURATIONS.receipt },
  { tag: "RADAR FINANCEIRO", title: "Saiba para onde vai cada real.", line: "Consumo, hábitos, compromissos e futuro,\ncada um explicado em uma frase.", Demo: RadarDemo, ms: DURATIONS.radar },
  { tag: "PREVISÃO", title: "Veja hoje o fim do seu mês.", line: "Saiba quanto vai sobrar no dia 30 e simule\num gasto antes de fazer. Sem surpresas.", Demo: ForecastDemo, ms: DURATIONS.forecast },
  { tag: "CONVERSA", title: "Pergunte. Ele responde com números.", line: "Respostas com o seu dinheiro de verdade,\nnão com dicas genéricas da internet.", Demo: AskDemo, ms: DURATIONS.ask },
];
const N = SLIDES.length;
/* After a demonstration ends, how long the slide stays before the next one comes. */
const HOLD_MS = 1100;
/* How long before moving on the slide begins to settle out. */
const OUT_MS = 450;
/* The demonstrations are laid out for this much height. They are shrunk only on a
   phone too short for them: shrunk text is resampled and is never quite as sharp. */
const DEMO_H = 420;
const SHRINK_BELOW = 390;

export default function BemVindo() {
  /* Drawn again in place when the theme changes. */
  useThemeRedraw();
  const router = useRouter();
  /* "Já tenho conta" rises as a sheet over the welcome. */
  const [login, setLogin] = useState(false);
  /* Someone who has already answered the onboarding on this phone goes straight back to
     the profile it made, not through the slides again. */
  useEffect(() => {
    void isOnboarded().then((done) => done && router.replace("/comecar" as never));
    // Checked once, as the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const pager = useRef<ComponentRef<typeof ScrollView>>(null);
  const [index, setIndex] = useState(0);
  const [held, setHeld] = useState(false);
  const [ready, setReady] = useState(isIntroDone());
  const [area, setArea] = useState(DEMO_H);
  const [pageH, setPageH] = useState(0);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => onIntroDone(() => setReady(true)), []);
  /* Only while this screen is the one showing: once someone goes on to sign in or to
     start, it stays mounted underneath, and its slides, timers and sounds must stop. */
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const live = ready && focused;

  /* The bar under the current number fills over the slide's time. It is started from
     here with its full length, never read back: on the phone the animation runs on
     another thread. */
  const progress = useSharedValue(0);
  useEffect(() => {
    if (!live) {
      cancelAnimation(progress);
      return;
    }
    if (held) {
      cancelAnimation(progress);
      return;
    }
    const total = SLIDES[index].ms + HOLD_MS;
    setLeaving(false);
    progress.set(withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: total, easing: Easing.linear })));
    const out = setTimeout(() => setLeaving(true), total - OUT_MS);
    const id = setTimeout(() => {
      const next = (index + 1) % N;
      /* After the last, straight back to the first rather than sliding past them all. */
      pager.current?.scrollTo({ x: next * width, animated: next !== 0 });
      setHeld(false);
      setIndex(next);
    }, total);
    return () => {
      clearTimeout(out);
      clearTimeout(id);
    };
  }, [index, held, live, width, progress]);

  const settle = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const i = Math.round(e.nativeEvent.contentOffset.x / width);
      if (i !== index) void Haptics.selectionAsync().catch(() => undefined);
      setIndex(Math.max(0, Math.min(N - 1, i)));
      setHeld(false);
    },
    [width, index],
  );

  const scale = area < SHRINK_BELOW ? area / DEMO_H : 1;

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
          /* A drag let go without a flick may never report a momentum end: settle here too,
             or the slides would stay held. */
          onScrollEndDrag={settle}
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
                  <View style={{ width: width - 48, alignItems: "center", ...(scale < 1 ? { transform: [{ scale }] } : null) }}>
                    <Appear on={live && i === index} leaving={leaving && i === index}>
                      <s.Demo active={live && i === index} />
                    </Appear>
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
            onPress={() => setLogin(true)}
            accessibilityRole="button"
            hitSlop={8}
            style={({ pressed }) => ({ height: 48, marginTop: 4, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
          >
            <Text style={{ fontSize: 15.5, fontWeight: "600", color: "rgba(255,255,255,0.82)" }}>Já tenho conta</Text>
          </Pressable>
        </View>
      </View>
      <LoginSheet open={login} onClose={() => setLogin(false)} />
    </Room>
  );
}

/**
 * A slide's content arriving and leaving: it comes up into place as the slide begins
 * and settles back a little just before the next one, so a change is never a cut.
 */
function Appear({ on, leaving, children }: { on: boolean; leaving: boolean; children: ReactNode }) {
  const p = useSharedValue(0);
  useEffect(() => {
    if (!on) {
      p.set(0);
      return;
    }
    p.set(leaving ? withTiming(0.4, { duration: OUT_MS, easing: Easing.in(Easing.cubic) }) : withTiming(1, { duration: 750, easing: Easing.bezier(0.16, 1, 0.3, 1) }));
  }, [on, leaving, p]);
  /* No scaling: on the phone, text that is scaling is drawn as a picture and looks
     blurred until it stops. */
  const style = useAnimatedStyle(() => ({ opacity: Math.max(0.15, p.get()), transform: [{ translateY: (1 - p.get()) * 22 }] }));
  return <Animated.View style={[{ width: "100%", alignItems: "center" }, style]}>{children}</Animated.View>;
}

/** The slide's number, the bars of all of them with this one filling, its name, title and line. */
function Caption({ i, slide, current, progress }: { i: number; slide: Slide; current: number; progress: SharedValue<number> }) {
  return (
    <View style={{ paddingTop: 12, paddingBottom: 26 }}>
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
      {/* One line: a smaller title rather than two short lines; it shrinks a little
          on a narrow phone instead of breaking. */}
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82} style={{ marginTop: 8, fontSize: 26, fontWeight: "800", letterSpacing: -0.8, lineHeight: 31, color: "#fff" }}>
        {slide.title}
      </Text>
      <Text style={{ marginTop: 6, fontSize: 15, lineHeight: 21, color: INK.soft }}>{slide.line}</Text>
    </View>
  );
}

function Fill({ progress, live }: { progress: SharedValue<number>; live: boolean }) {
  const style = useAnimatedStyle(() => ({ width: `${(live ? progress.get() : 0) * 100}%` }));
  return <Animated.View style={[{ height: "100%", backgroundColor: "#fff" }, style]} />;
}
