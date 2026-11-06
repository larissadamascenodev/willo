import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  ZoomIn,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, Line, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { useRaioX } from "@/hooks/useRaioX";
import type { Tone } from "@/services/raioXService";
import Surface from "~/components/Surface";
import { ChallengeCover } from "~/components/desafios/ChallengeTile";
import { Check, ChevronRight, Flame, Trophy } from "~/components/icons";
import { useAuth } from "~/lib/auth";
import { pendingCheckins, tickToday, type PendingCheckin } from "~/lib/challenges";
import { showToast } from "~/lib/toast";
import { th } from "~/theme/theme";
import { INK } from "~/theme/tokens";

/**
 * Two doors on the home, and today's check-in.
 *
 * The Radar is its own small instrument: the six areas as a dial, each wedge lit by
 * how that area stands (bright when fine, amber when it needs a look, coral when it is
 * in trouble), a slow sweep going round, and the score with its level beside it.
 *
 * Desafios shows what is running: the challenges' pictures overlapping, and the best
 * run of days in a row as a flame and a number.
 *
 * Under them, while a challenge still waits for today, a shelf of small picture cards,
 * each with its flame and a round button that turns into a tick.
 */

const FIRE = "#FF9F45";
const DIAL = 66;
const TONE: Record<Tone, { hex: string; alpha: number }> = {
  otimo: { hex: "#BFE3FF", alpha: 0.85 },
  ok: { hex: "#7CC4FF", alpha: 0.5 },
  atencao: { hex: "#F5C26B", alpha: 0.8 },
  critico: { hex: "#FF8A7A", alpha: 0.9 },
};

export default function ShortcutPair({ gap = 16 }: { gap?: number }) {
  const router = useRouter();
  const { user } = useAuth();
  const [running, setRunning] = useState<PendingCheckin[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      void pendingCheckins(user.id).then(setRunning).catch(() => setRunning([]));
    }, [user]),
  );

  const pending = (running ?? []).filter((r) => !r.tickedToday);

  return (
    <View style={{ gap }}>
      <View style={{ flexDirection: "row", gap }}>
        <RadarTile onPress={() => router.push({ pathname: "/registro", params: { view: "radar" } } as never)} />
        <ChallengesTile running={running} onPress={() => router.push("/desafios" as never)} />
      </View>
      {pending.length > 0 && (
        <CheckinShelf
          items={pending}
          onDone={(id) => setRunning((list) => list?.map((r) => (r.id === id ? { ...r, tickedToday: true, streak: r.streak + 1 } : r)) ?? null)}
          onOpen={(id) => router.push(`/desafio/${id}` as never)}
        />
      )}
    </View>
  );
}

/* ── The Radar ─────────────────────────────────────────────────────────────── */

function wedge(c: number, inner: number, outer: number, from: number, to: number) {
  const p = (r: number, deg: number) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return `${(c + r * Math.cos(a)).toFixed(2)} ${(c + r * Math.sin(a)).toFixed(2)}`;
  };
  return `M${p(inner, from)}L${p(outer, from)}A${outer} ${outer} 0 0 1 ${p(outer, to)}L${p(inner, to)}A${inner} ${inner} 0 0 0 ${p(inner, from)}Z`;
}

function RadarDial({ tones }: { tones: (Tone | null)[] }) {
  const reduce = useReducedMotion();
  const spin = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    spin.set(withRepeat(withTiming(360, { duration: 7000, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(spin);
  }, [reduce, spin]);
  const sweep = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.get()}deg` }] }));

  const c = DIAL / 2;
  const outer = c - 2;
  const inner = outer * 0.3;
  /* Worked out here, outside the animation. */
  const ring = th("rgba(255,255,255,0.14)");
  const spoke = th("rgba(255,255,255,0.08)");
  const idle = th("rgba(255,255,255,0.05)", "bg");
  const lit = tones.map((t) => (t ? { fill: th(TONE[t].hex), alpha: TONE[t].alpha } : { fill: idle, alpha: 1 }));
  const beam = th("#BFE3FF");

  return (
    <View style={{ width: DIAL, height: DIAL }}>
      <Svg width={DIAL} height={DIAL}>
        <Circle cx={c} cy={c} r={outer} stroke={ring} strokeWidth={1} fill="none" />
        <Circle cx={c} cy={c} r={outer * 0.64} stroke={spoke} strokeWidth={1} fill="none" />
        {lit.map((l, i) => (
          <Path key={i} d={wedge(c, inner + 1.5, outer - 1.5, i * 60 + 3, i * 60 + 57)} fill={l.fill} fillOpacity={l.alpha * 0.55} />
        ))}
        {[0, 60, 120, 180, 240, 300].map((deg) => {
          const a = ((deg - 90) * Math.PI) / 180;
          return <Line key={deg} x1={c + inner * Math.cos(a)} y1={c + inner * Math.sin(a)} x2={c + outer * Math.cos(a)} y2={c + outer * Math.sin(a)} stroke={spoke} strokeWidth={1} />;
        })}
        <Circle cx={c} cy={c} r={inner * 0.55} fill={beam} />
      </Svg>
      {/* The sweep: a soft beam turning slowly over the dial. */}
      <Animated.View pointerEvents="none" style={[{ position: "absolute", top: 0, left: 0, width: DIAL, height: DIAL }, sweep]}>
        <Svg width={DIAL} height={DIAL}>
          <Defs>
            <RadialGradient id="radar-beam" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={beam} stopOpacity={0.5} />
              <Stop offset="1" stopColor={beam} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Path d={wedge(c, 0.1, outer, -28, 0)} fill="url(#radar-beam)" />
          <Line x1={c} y1={c} x2={c} y2={c - outer} stroke={beam} strokeOpacity={0.7} strokeWidth={1} />
        </Svg>
      </Animated.View>
    </View>
  );
}

/** The Radar's own reading, mounted a moment after the home: it is not what the home waits for. */
function RadarTile({ onPress }: { onPress: () => void }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 700);
    return () => clearTimeout(t);
  }, []);
  return (
    <Surface onPress={onPress} style={{ flex: 1 }}>
      <Glow hex="#7CC4FF" />
      {ready ? <RadarReading /> : <RadarBody tones={[null, null, null, null, null, null]} score={null} level="" line="Lendo o seu mês" />}
    </Surface>
  );
}

function RadarReading() {
  const data = useRaioX();
  if (data.loading) return <RadarBody tones={[null, null, null, null, null, null]} score={null} level="" line="Lendo o seu mês" />;
  const { pillars, score, level } = data.report;
  const watching = pillars.filter((p) => p.tone === "atencao" || p.tone === "critico").length;
  const odd = data.anomalies.length;
  const line = watching > 0 ? `${watching} ${watching === 1 ? "ponto" : "pontos"} de atenção` : odd > 0 ? `${odd} ${odd === 1 ? "coisa" : "coisas"} fora do normal` : "Tudo em ordem";
  return <RadarBody tones={pillars.slice(0, 6).map((p) => p.tone)} score={score} level={level.label} line={line} />;
}

function RadarBody({ tones, score, level, line }: { tones: (Tone | null)[]; score: number | null; level: string; line: string }) {
  return (
    <View style={{ minHeight: 150, padding: 14, justifyContent: "space-between", position: "relative" }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
        <RadarDial tones={tones} />
        {score !== null && (
          <Animated.View entering={FadeIn.duration(300)} style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 22, fontWeight: "800", letterSpacing: -0.8, color: th("#fff"), fontVariant: ["tabular-nums"] }}>{score}</Text>
            <Text style={{ fontSize: 11, fontWeight: "600", letterSpacing: 0.4, color: th(INK.softer) }}>{level.toUpperCase()}</Text>
          </Animated.View>
        )}
      </View>
      <View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 15, fontWeight: "700", letterSpacing: -0.2, color: th("#fff") }}>
            Radar financeiro
          </Text>
          <ChevronRight size={14} color={th(INK.faint)} />
        </View>
        <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12.5, color: th(INK.soft) }}>
          {line}
        </Text>
      </View>
    </View>
  );
}

/* ── Desafios ──────────────────────────────────────────────────────────────── */

function ChallengesTile({ running, onPress }: { running: PendingCheckin[] | null; onPress: () => void }) {
  const list = running ?? [];
  const best = list.reduce((m, r) => Math.max(m, r.streak), 0);
  const waiting = list.filter((r) => !r.tickedToday).length;
  const line = !running
    ? " "
    : list.length === 0
      ? "Desafios e conquistas"
      : waiting > 0
        ? `${waiting} ${waiting === 1 ? "espera" : "esperam"} o check-in`
        : best > 0
          ? `${best} ${best === 1 ? "dia seguido" : "dias seguidos"}`
          : "Check-in de hoje feito";

  return (
    <Surface onPress={onPress} style={{ flex: 1 }}>
      <Glow hex={FIRE} />
      <View style={{ minHeight: 150, padding: 14, justifyContent: "space-between", position: "relative" }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
          {list.length > 0 ? (
            /* The running challenges' pictures, overlapping. */
            <View style={{ flexDirection: "row", height: 40 }}>
              {list.slice(0, 3).map((r, i) => (
                <View key={r.id} style={{ width: 40, height: 40, borderRadius: 20, overflow: "hidden", marginLeft: i ? -12 : 0, borderWidth: 2, borderColor: th("#15171B", "bg"), zIndex: 3 - i }}>
                  <ChallengeCover template={r.template} cover={r.cover} width={40} height={40} />
                </View>
              ))}
            </View>
          ) : (
            <View style={{ width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: th("rgba(233,196,98,0.14)", "bg") }}>
              <Trophy size={21} color={th("#E9C462")} strokeWidth={1.9} />
            </View>
          )}
          {best > 0 && (
            <Animated.View entering={FadeIn.duration(300)} style={{ alignItems: "flex-end" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <Flame size={17} color={FIRE} strokeWidth={2.4} />
                <Text style={{ fontSize: 22, fontWeight: "800", letterSpacing: -0.8, color: th("#fff"), fontVariant: ["tabular-nums"] }}>{best}</Text>
              </View>
            </Animated.View>
          )}
        </View>
        <View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 15, fontWeight: "700", letterSpacing: -0.2, color: th("#fff") }}>
              Desafios
            </Text>
            <ChevronRight size={14} color={th(INK.faint)} />
          </View>
          <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12.5, color: th(INK.soft) }}>
            {line}
          </Text>
        </View>
      </View>
    </Surface>
  );
}

/** A faint coloured light in the corner of a tile, the tile's own. */
function Glow({ hex }: { hex: string }) {
  const id = `glow-${hex.slice(1)}`;
  return (
    <Svg pointerEvents="none" width="100%" height="100%" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
      <Defs>
        <RadialGradient id={id} cx="0.95" cy="0.05" rx="0.9" ry="0.8">
          <Stop offset="0" stopColor={hex} stopOpacity={0.16} />
          <Stop offset="1" stopColor={hex} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

/* ── Today's check-in ──────────────────────────────────────────────────────── */

const CARD_W = 158;
const CARD_H = 132;

function CheckinShelf({ items, onDone, onOpen }: { items: PendingCheckin[]; onDone: (id: string) => void; onOpen: (id: string) => void }) {
  return (
    <Animated.View entering={FadeIn.duration(260)} exiting={FadeOut.duration(200)} layout={LinearTransition.duration(220)}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10, paddingHorizontal: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Flame size={15} color={FIRE} strokeWidth={2.4} />
          <Text style={{ fontSize: 15, fontWeight: "700", letterSpacing: -0.2, color: th("#fff") }}>Check-in de hoje</Text>
        </View>
        <Text style={{ fontSize: 12.5, color: th(INK.softer) }}>{items.length === 1 ? "1 desafio" : `${items.length} desafios`}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
        {items.map((p) => (
          <CheckinCard key={p.id} p={p} onDone={() => onDone(p.id)} onOpen={() => onOpen(p.id)} />
        ))}
      </ScrollView>
    </Animated.View>
  );
}

function CheckinCard({ p, onDone, onOpen }: { p: PendingCheckin; onDone: () => void; onOpen: () => void }) {
  const { user } = useAuth();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");

  const go = async () => {
    if (!user || state !== "idle") return;
    setState("busy");
    try {
      await tickToday(user.id, p.id);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setState("done");
      /* The tick is seen for a moment before the card leaves the shelf. */
      setTimeout(onDone, 1100);
    } catch {
      setState("idle");
      showToast("Não foi possível fazer o check-in.");
    }
  };

  return (
    <View style={{ width: CARD_W, height: CARD_H, borderRadius: 22, borderCurve: "continuous", overflow: "hidden", backgroundColor: "#0D0E10" }}>
      {/* The card opens the challenge; the round button beside it is the check-in. Siblings, not one inside the other. */}
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={p.template.name} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
        <ChallengeCover template={p.template} cover={p.cover} width={CARD_W} height={CARD_H} />
        <LinearGradient colors={["rgba(8,9,10,0.1)", "rgba(8,9,10,0.85)"]} locations={[0.2, 1]} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
        <View style={{ position: "absolute", top: 10, left: 10, height: 24, paddingHorizontal: 8, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(10,11,13,0.5)" }}>
          <Flame size={12} color={p.streak > 0 ? FIRE : "rgba(255,255,255,0.6)"} strokeWidth={2.4} />
          <Text style={{ fontSize: 12, fontWeight: "700", color: "#fff" }}>{state === "done" ? p.streak + 1 : p.streak}</Text>
        </View>
        <View style={{ position: "absolute", left: 12, right: 54, bottom: 12 }}>
          <Text numberOfLines={2} style={{ fontSize: 13.5, fontWeight: "700", lineHeight: 17, color: "#fff" }}>
            {p.template.name}
          </Text>
        </View>
      </Pressable>
        {/* The check-in itself: a round button that turns into a tick. */}
        <Pressable
          onPress={() => void go()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Check-in em ${p.template.name}`}
          style={({ pressed }) => ({
            position: "absolute",
            right: 10,
            bottom: 10,
            width: 38,
            height: 38,
            borderRadius: 19,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: state === "done" ? "#67CD67" : "#FFFFFF",
            transform: [{ scale: pressed ? 0.9 : 1 }],
          })}
        >
          {state === "busy" ? (
            <ActivityIndicator size="small" color="#0B0B0B" />
          ) : state === "done" ? (
            <Animated.View entering={ZoomIn.duration(240)}>
              <Check size={19} color="#0B0B0B" strokeWidth={3} />
            </Animated.View>
          ) : (
            <Flame size={18} color={FIRE} strokeWidth={2.4} />
          )}
        </Pressable>
    </View>
  );
}
