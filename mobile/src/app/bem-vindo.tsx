import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from "react";
import { Image, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, FadeIn, FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";
import * as Haptics from "expo-haptics";
import Room from "~/components/Room";
import WilloBot from "~/components/willo/WilloBot";
import type { OrbMode } from "~/components/registro/ParticleOrb";
import TryWillo, { type TryState } from "~/components/welcome/TryWillo";
import { Bell, ChartPie, Lock, Mic } from "~/components/icons";
import { INK } from "~/theme/tokens";
import { isIntroDone, onIntroDone } from "~/lib/launchIntro";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const LOGO = require("../../assets/images/willo-logo-white.png") as number;

/**
 * The first thing anyone sees without an account.
 *
 * Its one job is to let someone feel what Willo does before being asked for anything,
 * and that is done by letting them do it: Willo, alive, says hello and asks for an
 * expense; whatever they type — or one of three suggestions — is written down at once
 * as an entry, by the same reader the app uses inside (see TryWillo). One promise
 * above it, three outcomes under it rather than a list of features, the line that
 * answers the fear every finance app meets — no bank password — and the way in.
 *
 * Motion answers what the person does, rather than playing on its own. The page
 * scrolls only if the phone is too short for it, and moves up for the keyboard.
 */

const LINES: Record<string, string> = {
  idle: "Oi! Me conta um gasto que eu anoto.",
  reading: "Deixa eu ver…",
  done: "Pronto! É assim com cada gasto.",
  question: "Perguntas eu respondo lá dentro, com os seus números.",
  unclear: "Essa eu não peguei. Tente “uber 18 ontem”.",
};

export default function BemVindo() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduce = useReducedMotion();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const [state, setState] = useState<TryState>({ kind: "idle" });
  const [ready, setReady] = useState(isIntroDone());
  useEffect(() => onIntroDone(() => setReady(true)), []);

  const bot = Math.min(132, height * 0.15, width * 0.36);
  const lineKey = state.kind === "unclear" ? (state.question ? "question" : "unclear") : state.kind;

  /* He talks while a line arrives, thinks while reading, and is still otherwise. */
  const [mode, setMode] = useState<OrbMode>("idle");
  useEffect(() => {
    if (!ready) return;
    if (state.kind === "reading") {
      setMode("thinking");
      return;
    }
    setMode("speaking");
    const id = setTimeout(() => setMode("idle"), 1800);
    return () => clearTimeout(id);
  }, [state, ready]);

  /* The light behind Willo breathes, and swells once when something is written down. */
  const swell = useSharedValue(0);
  useEffect(() => {
    if (state.kind === "done" && !reduce) {
      swell.set(0);
      swell.set(withTiming(1, { duration: 1400, easing: Easing.out(Easing.cubic) }));
    }
  }, [state, swell, reduce]);
  const breathe = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    breathe.set(withRepeat(withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [breathe, reduce]);
  const glow = useAnimatedStyle(() => ({
    opacity: Math.min(1, 0.6 + 0.25 * breathe.get() + 0.5 * Math.sin(Math.PI * swell.get())),
    transform: [{ scale: 1 + 0.14 * Math.sin(Math.PI * swell.get()) }],
  }));

  return (
    <Room lit sky={false}>
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 14, paddingBottom: insets.bottom + 16, paddingHorizontal: 24 }}
      >
        {/* The brand's own wordmark. */}
        <Animated.View entering={FadeIn.delay(100).duration(600)} style={{ alignItems: "center" }}>
          <Image
            source={LOGO}
            tintColor="#F7F5F2"
            resizeMode="contain"
            accessibilityRole="image"
            accessibilityLabel="Willo"
            style={{ width: 78, height: 78 * (222 / 725) }}
          />
        </Animated.View>

        {/* Willo, and what he is saying. */}
        <View style={{ alignItems: "center", marginTop: 10 }}>
          <Bubble key={lineKey} text={ready ? LINES[lineKey] : ""} />
          <View style={{ width: bot * 1.9, height: bot, alignItems: "center", justifyContent: "center", marginTop: 6 }}>
            <Animated.View pointerEvents="none" style={[{ position: "absolute", width: bot * 1.9, height: bot * 1.2 }, glow]}>
              <Svg width="100%" height="100%">
                <Defs>
                  <RadialGradient id="welcomeGlow" cx="50%" cy="50%" r="50%">
                    <Stop offset="0" stopColor="#6FA8E8" stopOpacity={0.3} />
                    <Stop offset="0.5" stopColor="#6FA8E8" stopOpacity={0.08} />
                    <Stop offset="1" stopColor="#6FA8E8" stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Ellipse cx="50%" cy="50%" rx="50%" ry="50%" fill="url(#welcomeGlow)" />
              </Svg>
            </Animated.View>
            <WilloBot size={bot} mode={mode} />
          </View>
        </View>

        <Animated.View entering={FadeInDown.delay(300).duration(560)} style={{ marginTop: 14 }}>
          <Text style={{ fontSize: 31, fontWeight: "800", letterSpacing: -1.2, lineHeight: 35, color: "#fff", textAlign: "center" }}>
            Seu dinheiro organizado,{"\n"}só de falar.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(420).duration(560)} style={{ marginTop: 18 }}>
          <TryWillo onState={setState} onFocus={() => setTimeout(() => scroll.current?.scrollTo({ y: 180, animated: true }), 250)} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(540).duration(560)} style={{ flexDirection: "row", marginTop: 10, gap: 8 }}>
          <Outcome icon={<Mic size={17} color="#fff" strokeWidth={2} />} text={"Anota\nsem esforço"} />
          <Outcome icon={<ChartPie size={17} color="#fff" strokeWidth={2} />} text={"Mostra para\nonde vai"} />
          <Outcome icon={<Bell size={17} color="#fff" strokeWidth={2} />} text={"Avisa antes\ndo susto"} />
        </Animated.View>

        <View style={{ flex: 1, minHeight: 14 }} />

        <Animated.View entering={FadeInDown.delay(640).duration(520)}>
          {/* The fear every finance app meets, answered before the button. */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginBottom: 12 }}>
            <Lock size={13} color={INK.softer} strokeWidth={2.2} />
            <Text style={{ fontSize: 13, color: INK.softer }}>Sem senha do banco · Seus dados protegidos</Text>
          </View>

          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
              router.push("/comecar" as never);
            }}
            accessibilityRole="button"
            style={({ pressed }) => ({
              height: 58,
              borderRadius: 29,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#fff",
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
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
        </Animated.View>
      </ScrollView>
    </Room>
  );
}

/** What Willo says, typed out a letter at a time, in a bubble that points at him. */
function Bubble({ text }: { text: string }) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? text.length : 0);
  useEffect(() => {
    if (reduce || !text) {
      setN(text.length);
      return;
    }
    setN(0);
    let k = 0;
    const id = setInterval(() => {
      k += 1;
      setN(k);
      if (k >= text.length) clearInterval(id);
    }, 26);
    return () => clearInterval(id);
  }, [text, reduce]);
  return (
    <View style={{ minHeight: 42, alignItems: "center", justifyContent: "flex-end" }}>
      {text ? (
        <View style={{ alignItems: "center" }}>
          <View style={{ maxWidth: 290, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 18, borderCurve: "continuous", backgroundColor: "rgba(255,255,255,0.08)" }}>
            {/* The whole line holds its place, so the bubble does not grow as it types. */}
            <Text style={{ fontSize: 15, lineHeight: 20, color: "transparent", textAlign: "center" }}>{text}</Text>
            <Text style={{ position: "absolute", left: 16, right: 16, top: 10, fontSize: 15, lineHeight: 20, color: "#fff", textAlign: "center" }}>{text.slice(0, n)}</Text>
          </View>
          <View style={{ width: 12, height: 12, marginTop: -6, transform: [{ rotate: "45deg" }], backgroundColor: "rgba(255,255,255,0.08)" }} />
        </View>
      ) : null}
    </View>
  );
}

function Outcome({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 6, paddingVertical: 10, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.04)" }}>
      {icon}
      <Text style={{ fontSize: 12.5, lineHeight: 16, color: INK.soft, textAlign: "center" }}>{text}</Text>
    </View>
  );
}
