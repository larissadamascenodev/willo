import { useCallback, useEffect, useRef, useState } from "react";
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
import AssistantAsk from "~/components/home/AssistantAsk";
import { GLYPHS } from "~/components/home/Stories";
import { ChevronRight, Mic } from "~/components/icons";
import { routeFor, type AssistantRoute } from "~/lib/assistantAsk";
import { useVoiceEntry } from "~/lib/voiceEntry";
import { GREEN, INK } from "~/theme/tokens";
import Sun from "lucide-react-native/icons/sun";

/**
 * The top of the home, with Willo in it.
 *
 * The sphere floats, turning slowly, and under it the app says what it has noticed
 * — the same readings the stories carry, one at a time, as though he were telling
 * you. So it is three things at once: the assistant that has something to say, the
 * quickest way into Registro rápido, and someone to ask.
 *
 * Touch the sphere and it turns; tap it and it swells and listens, and stops by
 * itself when you do. If what you said was an expense or an income, a sheet comes
 * up with what he heard for you to confirm. If it was a question — "como estão
 * minhas faturas?" — the answer is written under the sphere, a letter at a time,
 * in the place the readings were; and if it was about a screen, there is a way to
 * open it, or he opens it if you asked him to. Short, always: the answer shares
 * the room with the readings and does not get to push the page down.
 *
 * It sits on the background with no card, like the stories: the page passes over it
 * when it scrolls.
 */

/* The sphere as large as the room allows, with everything else packed under it in
   rows of fixed height — so that whatever is on show, a reading, an answer, the word
   that he is listening, the page does not move and nothing is taller than the rest. */
const ORB = 230;
const HINT = 16;
/** Two lines of reading under a label; or three of an answer. */
const CAPTION = 64;
/** Under that: where you are in the readings, or the one thing the moment offers. */
const FOOT = 28;
/** What this takes of the screen, for the home to leave room for. */
export const ORB_HERO_BODY = 4 + ORB + 4 + HINT + 2 + CAPTION + 4 + FOOT + 8;

/** The answer to a question, from asking to being read. */
type Talk =
  | { phase: "thinking"; question: string; route: AssistantRoute | null }
  | { phase: "typing" | "done"; text: string; route: AssistantRoute | null; failed?: boolean };

export default function OrbHero({ slides }: { slides: InsightSlide[] }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [talk, setTalk] = useState<Talk | null>(null);
  const [index, setIndex] = useState(0);

  const goTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const entry = useVoiceEntry({
    onQuestion: (said) => {
      const route = routeFor(said);
      /* "Abre as faturas" is an instruction, not a question: go. */
      if (route?.go) {
        setTalk({ phase: "typing", text: `${route.label.replace(/^Abrir/, "Abrindo")}…`, route });
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        goTimer.current = setTimeout(() => {
          setTalk(null);
          router.push(route.href as never);
        }, 1100);
        return;
      }
      setTalk({ phase: "thinking", question: said, route });
    },
  });

  useEffect(
    () => () => {
      if (goTimer.current) clearTimeout(goTimer.current);
    },
    [],
  );

  const listening = entry.state === "listening";
  const reading = entry.state === "reading";
  const busy = entry.state !== "idle";
  const count = slides.length;
  const i = Math.min(index, Math.max(count - 1, 0));
  const slide = slides[i];
  const mode: OrbMode = listening ? "listening" : reading || talk?.phase === "thinking" ? "thinking" : "idle";
  const orb = Math.min(ORB, width * 0.62);

  /* The clock moves on while nothing is being said to it or by it. */
  useEffect(() => {
    if (busy || talk || count <= 1) return;
    const t = setTimeout(() => setIndex((n) => (n + 1) % count), DWELL);
    return () => clearTimeout(t);
  }, [i, busy, talk, count]);

  /* An answer that has been read goes after a while, and the readings come back. */
  useEffect(() => {
    if (talk?.phase !== "done") return;
    const t = setTimeout(() => setTalk(null), 16_000);
    return () => clearTimeout(t);
  }, [talk]);

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

  const onReply = useCallback((text: string) => setTalk((t) => (t && t.phase === "thinking" ? { phase: "typing", text, route: t.route } : t)), []);
  const onFail = useCallback((reason: string) => setTalk((t) => (t ? { phase: "typing", text: reason, route: null, failed: true } : t)), []);
  const typed = useCallback(() => setTalk((t) => (t && t.phase === "typing" ? { ...t, phase: "done" } : t)), []);

  const Icon = slide ? (GLYPHS[slide.icon] ?? Sun) : Sun;

  return (
    <View style={{ alignItems: "center", paddingTop: 4 }}>
      <Animated.View style={float}>
        <ParticleOrb
          size={orb}
          mode={mode}
          expanded={listening}
          onPress={() => {
            /* Speaking over an answer clears it. */
            if (goTimer.current) clearTimeout(goTimer.current);
            setTalk(null);
            void entry.toggle();
          }}
        />
      </Animated.View>

      {/* What the sphere is for, on a line of its own. */}
      <View style={{ marginTop: 4, height: HINT, flexDirection: "row", alignItems: "center", gap: 5 }}>
        {!busy && !talk && (
          <>
            <Mic size={11} color={GREEN} strokeWidth={2.4} />
            <Text style={{ fontSize: 12, color: INK.softer }}>toque para falar</Text>
          </>
        )}
      </View>

      {/* What he has to say — or, while listening, that he is; or the answer. */}
      <View style={{ height: CAPTION, marginTop: 2, alignSelf: "stretch", alignItems: "center", justifyContent: "flex-start" }}>
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
        ) : talk?.phase === "thinking" ? (
          <Animated.View entering={FadeIn.duration(220)} style={{ alignItems: "center", paddingHorizontal: 12 }}>
            <Text style={{ fontSize: 19, fontWeight: "700", letterSpacing: -0.4, color: "#fff" }}>Pensando…</Text>
            <Text numberOfLines={1} style={{ marginTop: 3, fontSize: 13.5, fontStyle: "italic", color: INK.softer, textAlign: "center" }}>
              “{talk.question}”
            </Text>
          </Animated.View>
        ) : talk ? (
          <Pressable onPress={() => talk.phase === "done" && setTalk(null)} style={{ alignItems: "center", paddingHorizontal: 10 }}>
            <Typewriter text={talk.text} onDone={typed} failed={talk.failed} />
          </Pressable>
        ) : entry.message ? (
          <Animated.View entering={FadeIn.duration(220)} style={{ paddingHorizontal: 12 }}>
            <Text numberOfLines={3} style={{ fontSize: 14.5, lineHeight: 20, color: "#F9CE4E", textAlign: "center" }}>{entry.message}</Text>
          </Animated.View>
        ) : slide ? (
          <Animated.View key={slide.id} entering={FadeIn.duration(420)} style={{ alignSelf: "stretch", alignItems: "center" }}>
            <Pressable onPress={() => setIndex((n) => (n + 1) % Math.max(count, 1))} style={{ alignSelf: "stretch", alignItems: "center", paddingHorizontal: 8 }}>
              {/* Every reading takes the same room: a label on one line and the reading
                  on two. A long one is set a little smaller rather than a third line. */}
              <View style={{ height: 14, flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Icon size={12} color={slide.accent} strokeWidth={2.3} />
                <Text numberOfLines={1} style={{ fontSize: 10, fontWeight: "600", letterSpacing: 1.4, textTransform: "uppercase", color: INK.soft, flexShrink: 1 }}>
                  {slide.label}
                </Text>
              </View>
              <Text
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                style={{ marginTop: 6, height: 44, fontSize: 15.5, fontWeight: "500", lineHeight: 21, letterSpacing: -0.2, color: "rgba(255,255,255,0.76)", textAlign: "center" }}
              >
                {slide.body.map((part, n) =>
                  part.bold ? (
                    <Text key={n} style={{ fontWeight: "800", color: "#fff" }}>
                      {part.text}
                    </Text>
                  ) : (
                    <Text key={n}>{part.text}</Text>
                  ),
                )}
              </Text>
            </Pressable>
          </Animated.View>
        ) : null}
      </View>

      {/* The foot: the readings' dots, or the one thing the moment offers — a way out
          of listening, or a way into the screen an answer was about. */}
      <View style={{ marginTop: 4, height: FOOT, flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
        {listening ? (
          <Pressable onPress={() => void entry.cancel()} hitSlop={10} style={({ pressed }) => ({ paddingVertical: 4, paddingHorizontal: 14, opacity: pressed ? 0.6 : 1 })}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: "rgba(255,255,255,0.7)" }}>Cancelar</Text>
          </Pressable>
        ) : talk?.phase === "done" && talk.route ? (
          <Animated.View entering={FadeInDown.duration(260)}>
            <Pressable
              onPress={() => {
                const href = talk.route!.href;
                setTalk(null);
                router.push(href as never);
              }}
              style={({ pressed }) => ({
                height: 28,
                paddingLeft: 13,
                paddingRight: 8,
                borderRadius: 14,
                flexDirection: "row",
                alignItems: "center",
                gap: 2,
                backgroundColor: "rgba(255,255,255,0.10)",
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#fff" }}>{talk.route.label}</Text>
              <ChevronRight size={14} color="#fff" />
            </Pressable>
          </Animated.View>
        ) : !busy && !talk && count > 1 ? (
          <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
            {slides.map((s, n) => (
              <View key={s.id + n} style={{ width: n === i ? 14 : 4, height: 4, borderRadius: 2, backgroundColor: n === i ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.22)" }} />
            ))}
          </View>
        ) : null}
      </View>

      {/* The question, put to whoever answers. It draws nothing. */}
      {talk?.phase === "thinking" && <AssistantAsk key={talk.question} question={talk.question} onReply={onReply} onFail={onFail} />}

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
