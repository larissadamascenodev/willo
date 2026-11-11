import { useCallback, useEffect, useRef, useState } from "react";
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
import Surface from "~/components/Surface";
import ParticleOrb from "~/components/registro/ParticleOrb";
import { ICE, RISK, SECTORS, SKY, type SectorKey } from "~/components/radar/parts";
import { ChallengeCover } from "~/components/desafios/ChallengeTile";
import { Check, ChevronRight, Flame, Trophy } from "~/components/icons";
import { useAuth } from "~/lib/auth";
import { pendingCheckins, tickToday, type PendingCheckin } from "~/lib/challenges";
import { FEATURES } from "~/lib/features";
import { loadConquistas, type Conquistas } from "~/lib/conquistas";
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
export default function ShortcutPair({ gap = 16 }: { gap?: number }) {
  const router = useRouter();
  const { user } = useAuth();
  const [running, setRunning] = useState<PendingCheckin[] | null>(null);
  const [wins, setWins] = useState<Conquistas | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      /* While the challenges are put away, the tile is the medals and the sequence. */
      if (!FEATURES.desafios) {
        void loadConquistas(user.id).then(setWins).catch(() => undefined);
        return;
      }
      void pendingCheckins(user.id).then(setRunning).catch(() => setRunning([]));
    }, [user]),
  );

  const pending = (running ?? []).filter((r) => !r.tickedToday);
  const [rowW, setRowW] = useState(0);
  /* The picture area of each tile: the Radar's dial, and the challenges' stack. */
  const art = rowW > 0 ? Math.min((rowW - gap) / 2 - 28, 170) : 0;

  return (
    <View style={{ gap }}>
      {/* One size for both, measured once, so the pair is even. */}
      <View onLayout={(e) => setRowW(e.nativeEvent.layout.width)} style={{ flexDirection: "row", gap }}>
        <RadarTile art={art} onPress={() => router.push("/radar" as never)} />
        {FEATURES.desafios ? (
          <ChallengesTile art={art} running={running} onPress={() => router.push("/desafios" as never)} />
        ) : (
          <ConquistasTile art={art} wins={wins} onPress={() => router.push("/conquistas" as never)} />
        )}
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

/* The Radar's own cycle, small: the same six sectors, rim ticks and light as the Radar
   screen, Willo's orb at the centre, a dot for each thing a sector found. The light
   sweeps round without stopping; the line under the dial goes from sector to sector,
   slowly enough to read. */

const STEP = 60;
const SWEEP_MS = 3000;

function sectorWedge(c: number, r: number, inner: number) {
  const point = (rad: number, deg: number) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return `${(c + rad * Math.cos(a)).toFixed(2)} ${(c + rad * Math.sin(a)).toFixed(2)}`;
  };
  return `M${point(inner, -STEP / 2)}L${point(r, -STEP / 2)}A${r} ${r} 0 0 1 ${point(r, STEP / 2)}L${point(inner, STEP / 2)}A${inner} ${inner} 0 0 0 ${point(inner, -STEP / 2)}Z`;
}

type Blips = Partial<Record<SectorKey, { risk: number; note: number }>>;

function MiniScope({ size, blips }: { size: number; blips: Blips }) {
  const reduce = useReducedMotion();
  const c = size / 2;
  const r = c - 2;
  const core = r * 0.34;
  /* The light sweeps round without stopping, as a radar does. */
  const angle = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    angle.set(withRepeat(withTiming(360, { duration: SWEEP_MS, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(angle);
  }, [angle, reduce]);
  const light = useAnimatedStyle(() => ({ transform: [{ rotate: `${angle.get()}deg` }] }));

  /* Worked out here, outside the animation. */
  const rim = th("rgba(255,255,255,0.12)");
  const tick = th("rgba(255,255,255,0.24)");
  const sky = th(SKY, "grad");
  const ice = th(ICE);
  const risk = th(RISK, "bg");
  const note = th(ICE, "bg");

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        {[1, 0.66].map((k) => (
          <Circle key={k} cx={c} cy={c} r={r * k} stroke={rim} strokeWidth={1} fill="none" />
        ))}
        {SECTORS.map((_, i) => {
          const a = ((i * STEP - STEP / 2 - 90) * Math.PI) / 180;
          return <Line key={i} x1={c + core * Math.cos(a)} y1={c + core * Math.sin(a)} x2={c + r * Math.cos(a)} y2={c + r * Math.sin(a)} stroke={rim} strokeWidth={1} />;
        })}
        {Array.from({ length: 72 }).map((_, i) => {
          const a = (i * 5 * Math.PI) / 180;
          const long = i % 6 === 0;
          return <Line key={i} x1={c + (r - (long ? 6 : 2.5)) * Math.cos(a)} y1={c + (r - (long ? 6 : 2.5)) * Math.sin(a)} x2={c + r * Math.cos(a)} y2={c + r * Math.sin(a)} stroke={tick} strokeWidth={0.7} />;
        })}
      </Svg>

      <Animated.View pointerEvents="none" style={[{ position: "absolute", width: size, height: size }, light]}>
        <Svg width={size} height={size}>
          <Defs>
            <RadialGradient id="mini-scope-light" cx="50%" cy="50%" r="50%">
              <Stop offset="0.3" stopColor={sky} stopOpacity={0.06} />
              <Stop offset="1" stopColor={sky} stopOpacity={0.4} />
            </RadialGradient>
          </Defs>
          <Path d={sectorWedge(c, r, core)} fill="url(#mini-scope-light)" stroke={ice} strokeOpacity={0.55} strokeWidth={1} />
        </Svg>
      </Animated.View>

      {/* What each sector found, as dots where its name would be. */}
      {SECTORS.map((sct, i) => {
        const b = blips[sct.key];
        const dots = [...Array(Math.min(b?.risk ?? 0, 3)).fill(risk), ...Array(Math.min(b?.note ?? 0, 3 - Math.min(b?.risk ?? 0, 3))).fill(note)] as string[];
        if (!dots.length) return null;
        const a = ((i * STEP - 90) * Math.PI) / 180;
        return (
          <View key={sct.key} pointerEvents="none" style={{ position: "absolute", left: c + r * 0.67 * Math.cos(a) - 14, top: c + r * 0.67 * Math.sin(a) - 3, width: 28, flexDirection: "row", justifyContent: "center", gap: 3 }}>
            {dots.map((hex, n) => (
              <View key={n} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: hex }} />
            ))}
          </View>
        );
      })}

      <View pointerEvents="none" style={{ position: "absolute", left: c - core, top: c - core, width: core * 2, height: core * 2, alignItems: "center", justifyContent: "center" }}>
        <ParticleOrb size={core * 2} />
      </View>
    </View>
  );
}

/** The Radar's own reading, mounted a moment after the home: it is not what the home waits for. */
function RadarTile({ art, onPress }: { art: number; onPress: () => void }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 700);
    return () => clearTimeout(t);
  }, []);
  return (
    <Surface onPress={onPress} style={{ flex: 1 }}>
      <Glow hex="#7CC4FF" />
      <View style={{ flex: 1, padding: 14, gap: 12, position: "relative" }}>
        {ready && art > 0 ? <RadarReading size={art} /> : <View style={{ height: Math.max(art, 120) + 50 }} />}
      </View>
    </Surface>
  );
}

function RadarReading({ size }: { size: number }) {
  const data = useRaioX();
  const ready = !data.loading;
  const blips: Blips = ready
    ? {
        consumo: { risk: data.categories.filter((x) => x.tone === "critico").length, note: data.categories.filter((x) => x.tone === "atencao").length },
        habitos: { risk: 0, note: data.anomalies.length + data.duplicates.length },
        compromissos: { risk: data.commitment.committedPct >= 0.6 ? 1 : 0, note: data.commitment.committedPct >= 0.4 ? 1 : 0 },
        futuro: { risk: data.forecast.endBalance < 0 ? 1 : 0, note: 0 },
        saude: { risk: data.report.pillars.filter((p) => p.tone === "critico").length, note: data.report.pillars.filter((p) => p.tone === "atencao").length },
      }
    : {};

  /* Only the dial and its name: the scores and the sentences are on the Radar's own screen. */
  return (
    <>
      <View style={{ alignItems: "center" }}>
        <MiniScope size={size} blips={blips} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 15, fontWeight: "700", letterSpacing: -0.2, color: th("#fff") }}>
          Radar financeiro
        </Text>
        <ChevronRight size={14} color={th(INK.faint)} />
      </View>
    </>
  );
}

/* ── Desafios ──────────────────────────────────────────────────────────────── */

/**
 * Desafios e conquistas, on the same card as the Radar beside it — light in the light
 * theme, dark in the dark — so the pair reads as one row. The leading challenge's
 * picture sits in it as a rounded window, the same size as the Radar's scope, with
 * the best run of days as a flame and how many are running; under it, what it is and
 * what waits for today. With nothing running, a medal waiting to be earned.
 */
function ChallengesTile({ art, running, onPress }: { art: number; running: PendingCheckin[] | null; onPress: () => void }) {
  const list = running ?? [];
  const lead = [...list].sort((a, b) => b.streak - a.streak)[0];
  const best = lead?.streak ?? 0;
  const waiting = list.filter((r) => !r.tickedToday).length;
  const line = !running
    ? " "
    : list.length === 0
      ? "Comece um desafio e ganhe medalhas"
      : waiting > 0
        ? `${waiting} ${waiting === 1 ? "espera" : "esperam"} o check-in de hoje`
        : "Check-in de hoje feito";
  const pic = Math.max(art, 120);

  return (
    <Surface onPress={onPress} style={{ flex: 1 }}>
      <Glow hex="#FF9F45" />
      <View style={{ flex: 1, padding: 14, gap: 12 }}>
        <View style={{ height: pic, borderRadius: 18, borderCurve: "continuous", overflow: "hidden", backgroundColor: "#0D0E10" }}>
          {lead ? (
            <ChallengeCover template={lead.template} cover={lead.cover} width="100%" height="100%" />
          ) : (
            <LinearGradient colors={["#2A2414", "#14120C"]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
          )}
          <LinearGradient colors={["rgba(8,9,10,0.35)", "rgba(8,9,10,0)", "rgba(8,9,10,0)"]} locations={[0, 0.4, 1]} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
          <View style={{ position: "absolute", top: 8, left: 8, right: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            {lead ? (
              <View style={{ height: 26, paddingHorizontal: 9, borderRadius: 13, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(10,11,13,0.6)", borderWidth: 1, borderColor: "rgba(255,159,69,0.45)" }}>
                <Flame size={12} color="#FF9F45" strokeWidth={2.4} />
                <Text style={{ fontSize: 12.5, fontWeight: "800", color: "#fff", fontVariant: ["tabular-nums"] }}>{best}</Text>
              </View>
            ) : (
              <View />
            )}
            {list.length > 1 && (
              <View style={{ height: 24, paddingHorizontal: 8, borderRadius: 12, justifyContent: "center", backgroundColor: "rgba(10,11,13,0.6)" }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: "rgba(255,255,255,0.9)" }}>{list.length} ativos</Text>
              </View>
            )}
          </View>
          {!lead && (
            <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
              <View style={{ width: pic * 0.5, height: pic * 0.5, borderRadius: pic * 0.25, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "rgba(233,196,98,0.5)", backgroundColor: "rgba(233,196,98,0.1)" }}>
                <Trophy size={pic * 0.2} color="#E9C462" strokeWidth={1.6} />
              </View>
            </View>
          )}
        </View>
        <View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 15, fontWeight: "700", letterSpacing: -0.2, color: th("#fff") }}>
              Desafios e conquistas
            </Text>
            <ChevronRight size={14} color={th(INK.faint)} />
          </View>
          <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12.5, color: waiting > 0 ? th("#FF9F45") : th(INK.soft) }}>
            {line}
          </Text>
        </View>
      </View>
    </Surface>
  );
}

/* ── Conquistas ────────────────────────────────────────────────────────────── */

/**
 * Conquistas e sequência, beside the Radar: the flame and the days in a row on a warm
 * dark picture, the last seven days as dots under it, and under the picture how many
 * medals are won — or, while today is still open on a live sequence, a word to keep it.
 */
function ConquistasTile({ art, wins, onPress }: { art: number; wins: Conquistas | null; onPress: () => void }) {
  const pic = Math.max(art, 120);
  const s = wins?.streak;
  const lit = (s?.current ?? 0) > 0;
  const won = wins ? wins.medals.filter((m) => m.earned).length : 0;
  const keep = !!s && lit && !s.todayDone;
  const line = !wins ? " " : keep ? "Anote algo hoje" : `${won} de ${wins.medals.length} medalhas`;

  /* The card's own glass all the way through: a pane a shade lighter, white marks on it,
     the days done filled and the rest left as rings. Worked out here, not in an animation. */
  const pane = th("rgba(255,255,255,0.05)", "bg");
  const rim = th("rgba(255,255,255,0.10)", "line");
  const ink = th("#fff");
  const faint = th("rgba(255,255,255,0.45)");
  const dotOff = th("rgba(255,255,255,0.14)", "bg");
  const dotOn = th("#fff", "bg");

  return (
    <Surface onPress={onPress} style={{ flex: 1 }}>
      <View style={{ flex: 1, padding: 14, gap: 12 }}>
        <View style={{ height: pic, borderRadius: 18, borderCurve: "continuous", overflow: "hidden", borderWidth: 1, borderColor: rim, backgroundColor: pane, alignItems: "center", justifyContent: "center" }}>
          {s && (
            <>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Flame size={Math.round(pic * 0.2)} color={lit ? ink : faint} strokeWidth={2.2} />
                <Text style={{ fontSize: Math.round(pic * 0.28), fontWeight: "800", letterSpacing: -1, color: ink, fontVariant: ["tabular-nums"] }}>{s.current}</Text>
              </View>
              <Text style={{ marginTop: 2, fontSize: 11.5, color: th(INK.soft) }}>{s.current === 1 ? "dia seguido" : "dias seguidos"}</Text>
              <View style={{ marginTop: 12, flexDirection: "row", gap: 5 }}>
                {s.week.map((d) => (
                  <View
                    key={d.iso}
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: d.done ? dotOn : dotOff,
                      borderWidth: d.today && !d.done ? 1 : 0,
                      borderColor: faint,
                    }}
                  />
                ))}
              </View>
            </>
          )}
        </View>
        <View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 15, fontWeight: "700", letterSpacing: -0.2, color: ink }}>
              Conquistas
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
