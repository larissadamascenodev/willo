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
import { useAuth } from "~/lib/auth";
import { cachedName, rememberName } from "~/lib/warmHome";
import { GREEN, INK } from "~/theme/tokens";
import Svg, { Defs, Ellipse, LinearGradient as SvgLinear, Path, RadialGradient, Rect, Stop } from "react-native-svg";

import { useGroundTh } from "~/theme/groundInk";
import { th as themeTh } from "~/theme/theme";
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
 *
 * He stands rather than floats: on a disc of light, a pad of the room's own blue with a
 * bright front rim and a shadow where he touches it, a faint column of light rising
 * behind him. He stands to one side and speaks beside himself, so the top of the home is
 * a single band instead of a column — the first card is close under it.
 */

/** Standing: the sphere, and the pad of light it stands on. */
const STAND_ORB = 124;
const STAND_W = 146;
const PAD = 34;
const STAND_H = STAND_ORB + PAD - 8;
/** What this takes of the screen, for the home to leave room for. */
export const ORB_HERO_BODY = STAND_H + 10;

/** A reading's sentence is what he says; its quip, if any, goes under it. */
export const readingsFrom = (slides: InsightSlide[]): Greeting[] =>
  slides.map((s) => {
    const title = s.body.map((p) => p.text).join("");
    return { title, sub: s.quip ?? "", ask: `Me explica melhor: ${title}` };
  });

/** What touching one of his lines does: the conversation opens, on that subject. */
export const paramsForLine = (line: Greeting) =>
  ({ pathname: "/registro", params: line.ask ? { ask: line.ask } : { say: line.say ?? line.title } }) as never;

export default function OrbHero({ slides }: { slides: InsightSlide[] }) {
  const th = useGroundTh();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { profile } = useProfile();
  const { user } = useAuth();
  /* Until the profile arrives: the name kept from last time, or the one on the account. */
  const knownName =
    cachedName(user?.id) ?? ((user?.user_metadata as { display_name?: string; full_name?: string } | undefined)?.display_name || (user?.user_metadata as { full_name?: string } | undefined)?.full_name || null);
  useEffect(() => {
    if (user?.id && profile?.display_name) rememberName(user.id, profile.display_name);
  }, [user?.id, profile?.display_name]);

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
  /* Beside him, the words have what is left of the width. */
  const [box, setBox] = useState(0);
  const column = width - 32 - STAND_W - 14;

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

  const status = listening ? "ouvindo" : reading ? "pensando" : saying ? "falando" : "online";

  return (
    <View style={{ height: ORB_HERO_BODY, flexDirection: "row", alignItems: "center", gap: 14 }}>
      <Stand size={STAND_ORB} listening={listening}>
        <ParticleOrb size={STAND_ORB} mode={mode} expanded={listening} loudness={entry.loudness} onPress={tap} onHold={hold} onHoldEnd={holdEnd} />
      </Stand>

      {/* Beside him: who is speaking, what he says, and how to talk to him. */}
      <View style={{ flex: 1, minWidth: 0, height: STAND_H, paddingTop: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: themeTh(listening ? "#FF6B6B" : GREEN, "bg") }} />
          <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 2.2, color: th(INK.softer) }}>WILLO · {status.toUpperCase()}</Text>
        </View>
        {/* What he says takes whatever height the status line and the hint leave. */}
        <View style={{ marginTop: 8, flex: 1, overflow: "hidden" }} onLayout={(e) => setBox(e.nativeEvent.layout.height)}>
          {listening ? (
            <Animated.View entering={FadeIn.duration(220)}>
              <Text style={{ fontSize: 18, fontWeight: "700", letterSpacing: -0.4, color: th("#fff") }}>Estou ouvindo…</Text>
              <Text style={{ marginTop: 3, fontSize: 13, color: th(INK.soft) }}>Pode falar. Eu paro quando você parar.</Text>
            </Animated.View>
          ) : reading ? (
            <Animated.View entering={FadeIn.duration(220)}>
              <Text style={{ fontSize: 18, fontWeight: "700", letterSpacing: -0.4, color: th("#fff") }}>Pensando…</Text>
            </Animated.View>
          ) : entry.message ? (
            <Animated.View entering={FadeIn.duration(220)}>
              <Text numberOfLines={4} style={{ fontSize: 14, lineHeight: 19, color: th("#F9CE4E") }}>{entry.message}</Text>
            </Animated.View>
          ) : (
            <GreetingLine
              name={firstName(profile?.display_name ?? knownName)}
              readings={readings}
              onPick={(line) => router.push(paramsForLine(line))}
              onLine={onLine}
              align="left"
              room={column}
              titleSize={17.5}
              maxHeight={box || undefined}
            />
          )}
        </View>
        {/* At the foot, always whole: how to talk to him, or the way out of listening. */}
        <View style={{ marginTop: 8, height: 28, justifyContent: "center" }}>
          {listening ? (
            <Pressable
              onPress={() => void entry.cancel()}
              hitSlop={10}
              style={({ pressed }) => ({ alignSelf: "flex-start", height: 28, paddingHorizontal: 12, borderRadius: 14, justifyContent: "center", backgroundColor: th("rgba(255,255,255,0.10)", "bg"), opacity: pressed ? 0.6 : 1 })}
            >
              <Text style={{ fontSize: 12.5, fontWeight: "600", color: th("rgba(255,255,255,0.85)") }}>Cancelar</Text>
            </Pressable>
          ) : !reading ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Mic size={12} color={th(INK.softer)} strokeWidth={2.2} />
              <Text numberOfLines={1} style={{ fontSize: 12, color: th(INK.softer) }}>Segure o Willo para falar</Text>
            </View>
          ) : null}
        </View>
      </View>

      <VoiceEntrySheet entry={entry} />
    </View>
  );
}

/**
 * The pad he stands on: a disc of light seen from just above, its front rim bright, the
 * back of it fading, a shadow where he touches it and a faint column of light rising
 * behind him. It breathes slowly; while he listens it brightens.
 */
function Stand({ size, listening, children }: { size: number; listening: boolean; children: React.ReactNode }) {
  const glow = useSharedValue(0);
  useEffect(() => {
    glow.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.System }),
          withTiming(0, { duration: 2600, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.System }),
        ),
        -1,
        false,
      ),
    );
  }, [glow]);
  const loud = useSharedValue(0);
  useEffect(() => {
    loud.set(withTiming(listening ? 1 : 0, { duration: 420 }));
  }, [listening, loud]);
  const breathe = useAnimatedStyle(() => ({ opacity: 0.72 + glow.get() * 0.2 + loud.get() * 0.08 }));
  const beam = useAnimatedStyle(() => ({ opacity: 0.55 + glow.get() * 0.25 + loud.get() * 0.2 }));

  /* Worked out here, not in the animation. */
  const sky = themeTh("#7CC4FF", "grad");
  const ice = themeTh("#CFE6FF", "grad");
  const dark = themeTh("#000000", "grad");
  const w = STAND_W;
  const h = STAND_H;
  const cx = w / 2;
  const floor = h - PAD / 2;
  const rx = w / 2 - 4;
  const ry = 13;

  return (
    <View style={{ width: w, height: h }}>
      {/* The column of light behind him. */}
      <Animated.View pointerEvents="none" style={[{ position: "absolute", left: 0, top: 0, width: w, height: h }, beam]}>
        <Svg width={w} height={h}>
          <Defs>
            <SvgLinear id="stand-beam" x1="0" y1="1" x2="0" y2="0">
              <Stop offset="0" stopColor={sky} stopOpacity={0.28} />
              <Stop offset="1" stopColor={sky} stopOpacity={0} />
            </SvgLinear>
          </Defs>
          <Path d={`M${cx - rx * 0.62},${floor} L${cx - rx * 0.3},${h * 0.08} L${cx + rx * 0.3},${h * 0.08} L${cx + rx * 0.62},${floor} Z`} fill="url(#stand-beam)" />
        </Svg>
      </Animated.View>

      {/* The pad. */}
      <Animated.View pointerEvents="none" style={[{ position: "absolute", left: 0, top: 0, width: w, height: h }, breathe]}>
        <Svg width={w} height={h}>
          <Defs>
            <RadialGradient id="stand-pad" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0" stopColor={sky} stopOpacity={0.42} />
              <Stop offset="0.7" stopColor={sky} stopOpacity={0.1} />
              <Stop offset="1" stopColor={sky} stopOpacity={0} />
            </RadialGradient>
            <SvgLinear id="stand-rim" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={ice} stopOpacity={0.08} />
              <Stop offset="1" stopColor={ice} stopOpacity={0.85} />
            </SvgLinear>
            <RadialGradient id="stand-shadow" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0" stopColor={dark} stopOpacity={0.55} />
              <Stop offset="1" stopColor={dark} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={cx} cy={floor} rx={rx + 6} ry={ry + 6} fill="url(#stand-pad)" />
          <Ellipse cx={cx} cy={floor} rx={rx} ry={ry} fill="none" stroke="url(#stand-rim)" strokeWidth={1.4} />
          <Ellipse cx={cx} cy={floor} rx={rx * 0.66} ry={ry * 0.62} fill="none" stroke={ice} strokeOpacity={0.22} strokeWidth={1} />
          <Ellipse cx={cx} cy={floor - 1} rx={size * 0.34} ry={6} fill="url(#stand-shadow)" />
        </Svg>
      </Animated.View>

      {/* Him, standing on it. */}
      <View style={{ position: "absolute", left: (w - size) / 2, top: floor - size + 4, width: size, height: size }}>{children}</View>
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
  const th = useGroundTh();
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
    <Text numberOfLines={3} style={{ fontSize: 16, lineHeight: 21, letterSpacing: -0.2, color: th(failed ? "#F9CE4E" : "rgba(255,255,255,0.92)"), textAlign: "center" }}>
      {text.slice(0, shown)}
      <Text style={{ color: "transparent" }}>{text.slice(shown)}</Text>
    </Text>
  );
}

/**
 * Willo's light, spilling softly down the top of the home. Drawn behind the page, so
 * the cards rise through it as they scroll.
 */
export function WilloGlow({ height, cx = "50%" }: { height: number; /** Where the light comes from, across: over him, where he stands. */ cx?: string }) {
  const { width } = useWindowDimensions();
  return (
    <Svg pointerEvents="none" width={width} height={height} style={{ position: "absolute", top: 0, left: 0 }}>
      <Defs>
        <RadialGradient id="willo-light" cx={cx} cy="34%" rx="80%" ry="50%">
          <Stop offset="0" stopColor={themeTh("#CFE3FF", "grad")} stopOpacity={0.16} />
          <Stop offset="0.4" stopColor={themeTh("#8DB8FF", "grad")} stopOpacity={0.07} />
          <Stop offset="1" stopColor={themeTh("#000000", "grad")} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill="url(#willo-light)" />
    </Svg>
  );
}
