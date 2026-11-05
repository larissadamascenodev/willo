import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { DWELL, type InsightSlide } from "@/lib/insights";
import ParticleOrb, { type OrbMode } from "~/components/registro/ParticleOrb";
import VoiceEntrySheet from "~/components/registro/VoiceEntrySheet";
import { Mic } from "~/components/icons";
import GreetingLine from "~/components/willo/GreetingLine";
import type { Greeting } from "~/lib/greeting";
import { useProfile } from "@/hooks/useProfile";
import { routeFor } from "~/lib/assistantAsk";
import { useVoiceEntry } from "~/lib/voiceEntry";
import { useTapOrDouble } from "~/lib/doubleTap";
import { firstName } from "~/lib/greeting";
import { INK } from "~/theme/tokens";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

/**
 * The top of the home, with Willo in it.
 *
 * The sphere floats, and under it, with no box, he says something: hello, what he has
 * noticed in the person's numbers, the same readings the stories carry and so always
 * current, and things worth asking him, the same way as on the sphere in the conversation.
 * So it is three things at once: the assistant that has something to say, the quickest
 * way into Registro rápido, and someone to ask.
 *
 * Drag the sphere and it turns; tap it and the conversation opens; tap it twice and
 * Registro rápido opens. Touch and hold it and it swells and listens, until you let go or
 * stop talking. If what you said was an expense or an income, a sheet comes up with what
 * he heard for you to confirm. If it was a question, the conversation opens with it asked,
 * and he answers there. If it was an instruction to open a screen, he opens it.
 *
 * It sits on the background, like the stories: the page passes over it when it scrolls.
 */

/* The sphere as large as the room allows, with everything else packed under it in
   rows of fixed height — so that whatever is on show, a reading, an answer, the word
   that he is listening, the page does not move and nothing is taller than the rest. */
const ORB = 250;
const HINT = 0;
/** What he says: a line or two, and under it a line or two more. */
const CAPTION = 106;
/** Under that: how to talk to him, or the way out of listening. */
const FOOT = 28;
/** What this takes of the screen, for the home to leave room for. */
export const ORB_HERO_BODY = 4 + ORB + 6 + CAPTION + 4 + FOOT + 8;
/** The same with no robot: only what he says, in the middle of the screen. */
export const LINES_HERO_BODY = 14 + CAPTION + 4 + FOOT + 14;

/** A reading's sentence is what he says; its quip, if any, goes under it. */
export const readingsFrom = (slides: InsightSlide[]): Greeting[] =>
  slides.map((s) => {
    const title = s.body.map((p) => p.text).join("");
    return { title, sub: s.quip ?? "", ask: `Me explica melhor: ${title}` };
  });

/** What touching one of his lines does: the conversation opens, on that subject. */
export const paramsForLine = (line: Greeting) =>
  ({ pathname: "/registro", params: line.ask ? { ask: line.ask } : { say: line.say ?? line.title } }) as never;

export default function OrbHero({ slides, lines = false }: { slides: InsightSlide[]; /** His lines alone, with no robot: touching them does what touching him does. */ lines?: boolean }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { profile } = useProfile();

  const entry = useVoiceEntry({
    onQuestion: (said) => {
      const route = routeFor(said);
      /* "Abre as faturas" is an instruction: go. Anything else is for the conversation. */
      if (route?.go) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        router.push(route.href as never);
        return;
      }
      router.push({ pathname: "/registro", params: { ask: said } } as never);
    },
  });

  const lineOnShow = useRef<Greeting | null>(null);
  const listening = entry.state === "listening";
  /* Let go before the microphone had started: it stops as soon as it has. */
  const letGo = useRef(false);
  useEffect(() => {
    if (listening && letGo.current) void entry.toggle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening]);
  const reading = entry.state === "reading";
  const busy = entry.state !== "idle";
  const readings = useMemo(() => readingsFrom(slides), [slides]);
  /* While a new line is arriving, he is the one saying it. */
  const [saying, setSaying] = useState(false);
  const stopSaying = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (stopSaying.current) clearTimeout(stopSaying.current);
    },
    [],
  );
  const onLine = (line: Greeting) => {
    lineOnShow.current = line;
    setSaying(true);
    if (stopSaying.current) clearTimeout(stopSaying.current);
    stopSaying.current = setTimeout(() => setSaying(false), 500 + line.title.split(" ").length * 170);
  };
  const mode: OrbMode = listening ? "listening" : reading ? "thinking" : saying ? "speaking" : "idle";
  /* As large as the width allows with a margin each side, so it is never cut. */
  const orb = Math.min(ORB, width - 72);

  /* Afloat: a slow rise and fall, the same either way round. */
  const bob = useSharedValue(0);
  useEffect(() => {
    bob.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.System }),
          withTiming(0, { duration: 2800, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.System }),
        ),
        -1,
        false,
      ),
    );
  }, [bob]);
  const float = useAnimatedStyle(() => ({ transform: [{ translateY: -5 + bob.get() * 10 }] }));

  /* One tap opens the conversation; two open Registro rápido. Holding him is what listens. */
  const tapOrDouble = useTapOrDouble(
    () => {
      router.push("/registro" as never);
    },
    () => router.push("/rapido" as never),
  );
  const tap = () => (entry.state === "idle" ? tapOrDouble() : void entry.toggle());
  const hold = () => {
    letGo.current = false;
    if (entry.state === "idle") void entry.toggle();
  };
  const holdEnd = () => {
    letGo.current = true;
    if (entry.state === "listening") void entry.toggle();
  };

  /* With no robot one tap has nothing else to open than what is being said. */
  const tapLines = useTapOrDouble(
    () => (lineOnShow.current ? router.push(paramsForLine(lineOnShow.current)) : router.push("/registro" as never)),
    () => router.push("/rapido" as never),
  );
  const held = useRef(false);

  return (
    <View style={{ alignItems: "center", paddingTop: lines ? 14 : 4 }}>
      {!lines && (
        <Animated.View style={float}>
          <ParticleOrb size={orb} mode={mode} expanded={listening} loudness={entry.loudness} onPress={tap} onHold={hold} onHoldEnd={holdEnd} />
        </Animated.View>
      )}

      {/* What he has to say, or, while listening, that he is. With no robot, this is what is touched. */}
      <Pressable
        disabled={!lines}
        onPress={() => {
          if (held.current) return;
          if (entry.state === "idle") tapLines();
          else void entry.toggle();
        }}
        onLongPress={() => {
          held.current = true;
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
          hold();
        }}
        onPressOut={() => {
          if (!held.current) return;
          held.current = false;
          holdEnd();
        }}
        delayLongPress={320}
        style={{ height: CAPTION, marginTop: lines ? 0 : 6, alignSelf: "stretch", alignItems: "center", justifyContent: lines ? "center" : "flex-start", overflow: "hidden" }}
      >
        {listening ? (
          /* Swollen, the sphere reaches further down: the words keep clear of it. */
          <Animated.View entering={FadeIn.duration(220)} style={{ alignItems: "center", marginTop: lines ? 0 : orb * 0.09 }}>
            <Text style={{ fontSize: 19, fontWeight: "700", letterSpacing: -0.4, color: "#fff" }}>Estou ouvindo…</Text>
            <Text style={{ marginTop: 3, fontSize: 13.5, color: INK.soft, textAlign: "center" }}>Pode falar. Eu paro quando você parar.</Text>
          </Animated.View>
        ) : reading ? (
          <Animated.View entering={FadeIn.duration(220)} style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 19, fontWeight: "700", letterSpacing: -0.4, color: "#fff" }}>Pensando…</Text>
          </Animated.View>
        ) : entry.message ? (
          <Animated.View entering={FadeIn.duration(220)} style={{ paddingHorizontal: 12 }}>
            <Text numberOfLines={3} style={{ fontSize: 14.5, lineHeight: 20, color: "#F9CE4E", textAlign: "center" }}>{entry.message}</Text>
          </Animated.View>
        ) : (
          <View pointerEvents={lines ? "none" : "auto"} style={{ alignSelf: "stretch" }}>
            <GreetingLine
              name={firstName(profile?.display_name)}
              readings={readings}
              onPick={(line) => router.push(paramsForLine(line))}
              onLine={onLine}
            />
          </View>
        )}
      </Pressable>

      {/* The foot: how to talk to him, or the way out of listening. */}
      <View style={{ marginTop: 4, height: FOOT, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 }}>
        {listening ? (
          <Pressable onPress={() => void entry.cancel()} hitSlop={10} style={({ pressed }) => ({ paddingVertical: 4, paddingHorizontal: 14, opacity: pressed ? 0.6 : 1 })}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: "rgba(255,255,255,0.7)" }}>Cancelar</Text>
          </Pressable>
        ) : !reading ? (
          <>
            <Mic size={12} color={INK.softer} strokeWidth={2.2} />
            <Text style={{ fontSize: 12.5, color: INK.softer }}>{lines ? "Segure para falar · Dois toques para um gasto rápido" : "Segure para falar"}</Text>
          </>
        ) : null}
      </View>

      <VoiceEntrySheet entry={entry} />
    </View>
  );
}

/**
 * Text arriving a letter at a time.
 *
 * The whole sentence is laid out from the first letter, the part not yet typed
 * simply invisible, so the words appear where they will stay instead of the line
 * re-centring on every character and shuffling.
 */
export function Typewriter({ text, onDone, failed }: { text: string; onDone: () => void; failed?: boolean }) {
  const [shown, setShown] = useState(0);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    setShown(0);
    const iv = setInterval(() => {
      setShown((n) => {
        if (n >= text.length) {
          clearInterval(iv);
          return n;
        }
        return n + 1;
      });
    }, 22);
    return () => clearInterval(iv);
  }, [text]);

  useEffect(() => {
    if (shown >= text.length) done.current();
  }, [shown, text]);

  return (
    <Text numberOfLines={3} style={{ fontSize: 16, lineHeight: 21, letterSpacing: -0.2, color: failed ? "#F9CE4E" : "rgba(255,255,255,0.92)", textAlign: "center" }}>
      {text.slice(0, shown)}
      <Text style={{ color: "transparent" }}>{text.slice(shown)}</Text>
    </Text>
  );
}

/**
 * Willo's light, spilling softly down the top of the home. Drawn behind the page, so
 * the cards rise through it as they scroll.
 */
export function WilloGlow({ height }: { height: number }) {
  const { width } = useWindowDimensions();
  return (
    <Svg pointerEvents="none" width={width} height={height} style={{ position: "absolute", top: 0, left: 0 }}>
      <Defs>
        <RadialGradient id="willo-light" cx="50%" cy="34%" rx="80%" ry="50%">
          <Stop offset="0" stopColor="#CFE3FF" stopOpacity={0.16} />
          <Stop offset="0.4" stopColor="#8DB8FF" stopOpacity={0.07} />
          <Stop offset="1" stopColor="#000000" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill="url(#willo-light)" />
    </Svg>
  );
}
