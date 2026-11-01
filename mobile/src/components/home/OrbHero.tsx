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
import ChatBubble from "~/components/willo/ChatBubble";
import { routeFor } from "~/lib/assistantAsk";
import { useVoiceEntry } from "~/lib/voiceEntry";
import { useTapOrDouble } from "~/lib/doubleTap";
import { NEXT } from "~/lib/greeting";
import { GREEN, INK } from "~/theme/tokens";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

/**
 * The top of the home, with Willo in it.
 *
 * The sphere floats, and under it he sends messages: what he has noticed in the
 * person's numbers, the same readings the stories carry and so always current, mixed
 * with things worth asking him, in a new order each time, so it does not sound like a
 * loop. So it is three things at once: the assistant that has something to say, the
 * quickest way into Registro rápido, and someone to ask.
 *
 * Touch the sphere and it turns; tap it and it swells and listens, and stops by itself
 * when you do. If what you said was an expense or an income, a sheet comes up with what
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
/** His message, the same as in the conversation: his name and up to three lines. */
const CAPTION = 114;
/** Under that: the way out of listening. */
const FOOT = 28;
/** What this takes of the screen, for the home to leave room for. */
export const ORB_HERO_BODY = 4 + ORB + 6 + CAPTION + 4 + FOOT + 8;

export default function OrbHero({ slides }: { slides: InsightSlide[] }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);

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

  const listening = entry.state === "listening";
  const reading = entry.state === "reading";
  const busy = entry.state !== "idle";
  /* What he has noticed, with something to ask him after every two. The order of those is
     chosen once, so the readings can update under them without the rest jumping about. */
  const [asks] = useState(() => [...NEXT].sort(() => Math.random() - 0.5));
  const messages = useMemo(() => {
    const out: { id: string; text: string }[] = [];
    const written = (body: { text: string; bold?: boolean }[]) => body.map((p) => (p.bold ? `**${p.text}**` : p.text)).join("");
    let a = 0;
    const askNext = () => {
      const ask = asks[a++];
      out.push({ id: `ask-${a}`, text: `${ask.title} ${ask.sub}` });
    };
    slides.forEach((s, n) => {
      out.push({ id: s.id, text: written(s.body) });
      if (n % 2 === 1 && a < asks.length) askNext();
    });
    while (a < asks.length && out.length < 4) askNext();
    return out;
  }, [slides, asks]);
  const count = messages.length;
  const i = Math.min(index, Math.max(count - 1, 0));
  const slide = messages[i];
  const mode: OrbMode = listening ? "listening" : reading ? "thinking" : "idle";
  /* As large as the width allows with a margin each side, so it is never cut. */
  const orb = Math.min(ORB, width - 72);

  /* The next message, a while after this one has been written out. */
  const [written, setWritten] = useState(false);
  useEffect(() => {
    setWritten(false);
  }, [i]);
  useEffect(() => {
    if (busy || !written || count <= 1) return;
    const t = setTimeout(() => setIndex((n) => (n + 1) % count), DWELL);
    return () => clearTimeout(t);
  }, [written, busy, count]);

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

  /* One tap listens; two open Registro rápido. While listening, a tap stops at once. */
  const tapOrDouble = useTapOrDouble(
    () => {
      void entry.toggle();
    },
    () => router.push("/rapido" as never),
  );
  const tap = () => (entry.state === "idle" ? tapOrDouble() : void entry.toggle());

  return (
    <View style={{ alignItems: "center", paddingTop: 4 }}>
      <Animated.View style={float}>
        <ParticleOrb
          size={orb}
          mode={mode}
          expanded={listening}
          onPress={tap}
        />
      </Animated.View>

      {/* What he has to say, or, while listening, that he is. */}
      <View style={{ height: CAPTION, marginTop: 6, alignSelf: "stretch", alignItems: "center", justifyContent: "flex-start", overflow: "hidden" }}>
        {listening ? (
          <Animated.View entering={FadeIn.duration(220)} style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 19, fontWeight: "700", letterSpacing: -0.4, color: "#fff" }}>Estou ouvindo…</Text>
            <Text style={{ marginTop: 3, fontSize: 13.5, color: INK.soft, textAlign: "center" }}>Pode falar. Eu paro quando você parar.</Text>
          </Animated.View>
        ) : reading ? (
          <Animated.View entering={FadeIn.duration(220)} style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 19, fontWeight: "700", letterSpacing: -0.4, color: "#fff" }}>Anotando…</Text>
            <Text style={{ marginTop: 3, fontSize: 13.5, color: INK.soft }}>Só um instante.</Text>
          </Animated.View>
        ) : entry.message ? (
          <Animated.View entering={FadeIn.duration(220)} style={{ paddingHorizontal: 12 }}>
            <Text numberOfLines={3} style={{ fontSize: 14.5, lineHeight: 20, color: "#F9CE4E", textAlign: "center" }}>{entry.message}</Text>
          </Animated.View>
        ) : slide ? (
          <Pressable key={slide.id} onPress={() => setIndex((n) => (n + 1) % Math.max(count, 1))} style={{ alignSelf: "stretch", paddingHorizontal: 20 }}>
            <ChatBubble role="bot" named avatarRoom={false} text={slide.text} onDone={() => setWritten(true)} />
          </Pressable>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 }}>
            <Mic size={11} color={GREEN} strokeWidth={2.4} />
            <Text style={{ fontSize: 12.5, color: INK.softer }}>toque na esfera para falar com o Willo</Text>
          </View>
        )}
      </View>

      {/* The foot: the way out of listening. */}
      <View style={{ marginTop: 4, height: FOOT, flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
        {listening && (
          <Pressable onPress={() => void entry.cancel()} hitSlop={10} style={({ pressed }) => ({ paddingVertical: 4, paddingHorizontal: 14, opacity: pressed ? 0.6 : 1 })}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: "rgba(255,255,255,0.7)" }}>Cancelar</Text>
          </Pressable>
        )}
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
