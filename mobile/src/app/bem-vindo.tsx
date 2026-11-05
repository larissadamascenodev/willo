import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Image, Pressable, ScrollView, Text, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, FadeIn, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";
import { LinearGradient as Fade } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Room from "~/components/Room";
import WilloBot from "~/components/willo/WilloBot";
import { AskDemo, ForecastDemo, NotifyDemo, QuickDemo, RadarDemo, ReceiptDemo, VoiceDemo } from "~/components/welcome/Demos";
import { Check, ChevronDown, Lock } from "~/components/icons";
import { GROUND_LIT, INK } from "~/theme/tokens";
import { isIntroDone, onIntroDone } from "~/lib/launchIntro";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const LOGO = require("../../assets/images/willo-logo-white.png") as number;

/**
 * The first thing anyone sees without an account.
 *
 * A page to scroll, like a product's own presentation. It opens on Willo and one
 * promise; under it, each thing the app does has a section of its own with a
 * demonstration that is worked by hand — a purchase notification caught and written
 * down by itself (Willo Atento), hold the microphone, tap Willo twice,
 * press the shutter, touch a category, try spending more, ask a question (see
 * Demos). Each section rises into place as it comes into view and plays itself once,
 * so someone who only scrolls sees it all happen. It ends on what keeps money safe.
 *
 * The way in never scrolls away: "Começar agora" and the line for whoever already
 * has an account stay at the foot of the screen the whole time, over a fade.
 */

interface SectionDef {
  kicker: string;
  title: string;
  line: string;
  Demo: (p: { visible: boolean }) => ReactNode;
}

const SECTIONS: SectionDef[] = [
  { kicker: "WILLO ATENTO", title: "Você compra.\nEle já anotou.", line: "O Willo lê o aviso de compra do banco\ne registra sozinho. Você só confere.", Demo: NotifyDemo },
  { kicker: "VOZ", title: "Fale.\nO Willo anota.", line: "Diga o gasto do seu jeito. Ele entende\no valor, a categoria e a conta.", Demo: VoiceDemo },
  { kicker: "REGISTRO RÁPIDO", title: "Dois toques,\num gasto salvo.", line: "Toque duas vezes no Willo em qualquer\ntela e registre em segundos.", Demo: QuickDemo },
  { kicker: "COMPROVANTE", title: "Fotografe.\nEle lê por você.", line: "Valor, local e categoria saem da\nfoto direto para o seu registro.", Demo: ReceiptDemo },
  { kicker: "RADAR", title: "Para onde vai\ncada real.", line: "Consumo, hábitos e o que está fora\ndo normal, explicado em uma linha.", Demo: RadarDemo },
  { kicker: "PREVISÃO", title: "O fim do mês,\nantes do fim.", line: "Simule um gasto e veja na hora\ncomo o mês termina.", Demo: ForecastDemo },
  { kicker: "CONVERSA", title: "Pergunte.\nEle calcula.", line: "Respostas com os seus números,\nnão com conselhos genéricos.", Demo: AskDemo },
];

const CTA_H = 130;

export default function BemVindo() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [ready, setReady] = useState(isIntroDone());
  useEffect(() => onIntroDone(() => setReady(true)), []);

  /* Where each section starts, and which have been seen. */
  const tops = useRef<number[]>([]);
  const [seen, setSeen] = useState<boolean[]>(() => SECTIONS.map(() => false));
  const [scrolled, setScrolled] = useState(false);
  const check = useCallback(
    (y: number) => {
      const line = y + height * 0.78;
      setSeen((prev) => {
        let changed = false;
        const next = prev.map((was, i) => {
          const top = tops.current[i];
          const now = was || (top !== undefined && top < line);
          if (now !== was) changed = true;
          return now;
        });
        return changed ? next : prev;
      });
      if (y > 40 && !scrolled) setScrolled(true);
    },
    [height, scrolled],
  );
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => check(e.nativeEvent.contentOffset.y);

  const heroH = Math.max(480, height - CTA_H - insets.bottom - 10);
  const bot = Math.min(210, height * 0.25);

  return (
    <Room lit sky={false}>
      <ScrollView
        onScroll={onScroll}
        scrollEventThrottle={32}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: CTA_H + insets.bottom + 30, paddingHorizontal: 24 }}
      >
        {/* The opening. */}
        <View style={{ height: heroH - insets.top - 14 }}>
          <Animated.View entering={FadeIn.delay(100).duration(600)} style={{ alignItems: "center" }}>
            <Image source={LOGO} tintColor="#F7F5F2" resizeMode="contain" accessibilityRole="image" accessibilityLabel="Willo" style={{ width: 78, height: 78 * (222 / 725) }} />
          </Animated.View>

          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <HeroGlow size={bot} />
            <WilloBot size={bot} mode="idle" />
          </View>

          <Animated.View entering={FadeIn.delay(250).duration(700)}>
            <Text style={{ fontSize: 36, fontWeight: "800", letterSpacing: -1.4, lineHeight: 40, color: "#fff", textAlign: "center" }}>
              Seu dinheiro organizado,{"\n"}só de falar.
            </Text>
            <Text style={{ marginTop: 12, fontSize: 15.5, lineHeight: 22, color: INK.soft, textAlign: "center" }}>
              Compras anotadas sozinhas, voz, foto e mais.{"\n"}Experimente cada uma aqui embaixo.
            </Text>
          </Animated.View>

          <Cue hidden={scrolled} ready={ready} />
        </View>

        {SECTIONS.map((s, i) => (
          <View
            key={s.kicker}
            onLayout={(e) => {
              tops.current[i] = e.nativeEvent.layout.y;
              check(0);
            }}
            style={{ marginTop: i === 0 ? 8 : 64 }}
          >
            <Section index={i} def={s} visible={ready && seen[i]} />
          </View>
        ))}

        {/* The close: what keeps money safe. */}
        <View style={{ marginTop: 72, alignItems: "center" }}>
          <Text style={{ fontSize: 30, fontWeight: "800", letterSpacing: -1.1, lineHeight: 34, color: "#fff", textAlign: "center" }}>
            Tudo isso,{"\n"}num só lugar.
          </Text>
          <View style={{ marginTop: 22, gap: 12, alignSelf: "stretch" }}>
            <Promise icon={<Lock size={15} color="#fff" strokeWidth={2.2} />} text="Sem senha do banco. Nunca." />
            <Promise icon={<Check size={15} color="#fff" strokeWidth={2.6} />} text="Você confere e decide o que fica salvo." />
            <Promise icon={<Check size={15} color="#fff" strokeWidth={2.6} />} text="Seus dados ficam protegidos e são só seus." />
          </View>
        </View>
      </ScrollView>

      {/* The way in, always there. */}
      <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
        <Fade pointerEvents="none" colors={[`${GROUND_LIT}00`, `${GROUND_LIT}F2`, GROUND_LIT]} locations={[0, 0.35, 1]} style={{ position: "absolute", left: 0, right: 0, top: -40, bottom: 0 }} />
        <View style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 12, paddingTop: 6 }}>
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

/** A section: its number and name, the title, one line, and the demonstration. */
function Section({ index, def, visible }: { index: number; def: SectionDef; visible: boolean }) {
  const reduce = useReducedMotion();
  const p = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (visible && !reduce) p.set(withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }));
  }, [visible, p, reduce]);
  const head = useAnimatedStyle(() => ({ opacity: p.get(), transform: [{ translateY: (1 - p.get()) * 26 }] }));
  const body = useAnimatedStyle(() => ({ opacity: p.get(), transform: [{ translateY: (1 - p.get()) * 46 }, { scale: 0.97 + 0.03 * p.get() }] }));
  const { Demo } = def;
  return (
    <View>
      <Animated.View style={head}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Text style={{ fontFamily: "Menlo", fontSize: 12, letterSpacing: 1, color: INK.softer }}>{String(index + 1).padStart(2, "0")}</Text>
          <View style={{ width: 22, height: 1, backgroundColor: "rgba(255,255,255,0.25)" }} />
          <Text style={{ fontFamily: "Menlo", fontSize: 12, letterSpacing: 1.3, color: INK.softer }}>{def.kicker}</Text>
        </View>
        <Text style={{ marginTop: 10, fontSize: 32, fontWeight: "800", letterSpacing: -1.2, lineHeight: 36, color: "#fff" }}>{def.title}</Text>
        <Text style={{ marginTop: 10, fontSize: 15.5, lineHeight: 22, color: INK.soft }}>{def.line}</Text>
      </Animated.View>
      <Animated.View style={[{ marginTop: 18 }, body]}>
        <Demo visible={visible} />
      </Animated.View>
    </View>
  );
}

function Promise({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, height: 52, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.05)" }}>
      <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(111,168,232,0.2)" }}>{icon}</View>
      <Text style={{ flex: 1, fontSize: 15, color: "#fff" }}>{text}</Text>
    </View>
  );
}

/** The light Willo stands in, breathing. */
function HeroGlow({ size }: { size: number }) {
  const reduce = useReducedMotion();
  const b = useSharedValue(0);
  useEffect(() => {
    if (!reduce) b.set(withRepeat(withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [b, reduce]);
  const style = useAnimatedStyle(() => ({ opacity: 0.65 + 0.35 * b.get(), transform: [{ scale: 0.95 + 0.08 * b.get() }] }));
  const w = size * 2.2;
  const h = size * 1.5;
  return (
    <Animated.View pointerEvents="none" style={[{ position: "absolute", width: w, height: h }, style]}>
      <Svg width={w} height={h}>
        <Defs>
          <RadialGradient id="heroGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#6FA8E8" stopOpacity={0.32} />
            <Stop offset="0.5" stopColor="#6FA8E8" stopOpacity={0.08} />
            <Stop offset="1" stopColor="#6FA8E8" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} fill="url(#heroGlow)" />
      </Svg>
    </Animated.View>
  );
}

/** "There is more below": a small chevron that nods until the page is scrolled. */
function Cue({ hidden, ready }: { hidden: boolean; ready: boolean }) {
  const reduce = useReducedMotion();
  const p = useSharedValue(0);
  useEffect(() => {
    if (!ready || reduce) return;
    p.set(withDelay(800, withRepeat(withSequence(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 700, easing: Easing.inOut(Easing.sin) })), -1)));
  }, [p, ready, reduce]);
  const style = useAnimatedStyle(() => ({ opacity: hidden ? withTiming(0) : withTiming(ready ? 0.7 : 0), transform: [{ translateY: p.get() * 6 }] }));
  return (
    <Animated.View pointerEvents="none" style={[{ alignItems: "center", marginTop: 18 }, style]}>
      <ChevronDown size={22} color="#fff" strokeWidth={2} />
    </Animated.View>
  );
}
