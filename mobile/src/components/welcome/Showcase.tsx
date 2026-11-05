import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, Text, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Circle, Defs, Ellipse, Line, LinearGradient, Path, RadialGradient, Stop } from "react-native-svg";
import { LinearGradient as Fade } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import WilloBot from "~/components/willo/WilloBot";
import type { OrbMode } from "~/components/registro/ParticleOrb";
import { Camera, ChartPie, Check, Mic, Sparkles, TrendingUp, Zap } from "~/components/icons";
import { INK } from "~/theme/tokens";
import { isIntroDone, onIntroDone } from "~/lib/launchIntro";

/**
 * The welcome's stage: Willo standing on a dial of what he does.
 *
 * Behind him a thin halo with a light running round it; under him a pedestal of
 * light; round his feet a ring like a watch's bezel, ticked, carrying the app's six
 * functions as glass capsules. The ring holds still while a function is shown — its
 * capsule at the front, lit, right under Willo — and turns one step, smoothly, to
 * bring the next one round when the scene changes. A capsule passing behind him is
 * hidden by him, not seen through him.
 *
 * Above, a holographic panel materialises on the beam Willo casts, with that
 * function happening in full: what was said and what was written down, the quick
 * entry counting up and saved, the receipt read, the Radar, the month's line, the
 * question and the whole answer. Nothing in it is cut. Under the stage the name of
 * the function slides in.
 *
 * Two clocks: the scene's, which every part of a scene reads, and a slow one for
 * the halo's light and the motes. How far a scene has got is kept on the JS side:
 * on the phone the clock runs on the other thread, and reading it back just after a
 * reset gives the old value. A tap goes on; holding pauses. It waits for the opening
 * animation to end. The colours are the app's — graphite, white, the cold blue — and
 * the figures are an example.
 */

const SCENE_MS = 5200;
const TURN_MS = 950;
const COLD = "#6FA8E8";
const ICE = "#DCEBFF";

interface Feature {
  tag: string;
  title: string;
  line: string;
  Icon: typeof Mic;
  Demo: (p: { t: SharedValue<number> }) => ReactNode;
  mode: OrbMode;
}

const FEATURES: Feature[] = [
  {
    tag: "VOZ",
    title: "Fale.\nO Willo anota.",
    line: "Segure o Willo e diga o gasto do seu\njeito: valor, categoria e conta.",
    Icon: Mic,
    Demo: VoiceDemo,
    mode: "listening",
  },
  {
    tag: "REGISTRO RÁPIDO",
    title: "Dois toques,\num gasto salvo.",
    line: "Toque duas vezes no Willo e registre\nem segundos, sem procurar menu.",
    Icon: Zap,
    Demo: QuickDemo,
    mode: "speaking",
  },
  {
    tag: "COMPROVANTE",
    title: "Fotografe.\nEle lê por você.",
    line: "Valor, local e categoria saem da\nfoto direto para o seu registro.",
    Icon: Camera,
    Demo: ReceiptDemo,
    mode: "thinking",
  },
  {
    tag: "RADAR",
    title: "Para onde vai\ncada real.",
    line: "Consumo, hábitos e o que está fora\ndo normal, tudo num só lugar.",
    Icon: ChartPie,
    Demo: RadarDemo,
    mode: "thinking",
  },
  {
    tag: "PREVISÃO",
    title: "O fim do mês,\nantes do fim.",
    line: "O Willo soma o que vem pela frente\ne avisa antes de cada conta vencer.",
    Icon: TrendingUp,
    Demo: ForecastDemo,
    mode: "speaking",
  },
  {
    tag: "CONVERSA",
    title: "Pergunte.\nEle calcula.",
    line: "Fim de semana, viagem, fatura:\nresposta com os seus números.",
    Icon: Sparkles,
    Demo: ChatDemo,
    mode: "speaking",
  },
];
const N = FEATURES.length;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function clamp01(v: number) {
  "worklet";
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
function reveal(t: number, a: number, b: number) {
  "worklet";
  const v = clamp01((t - a) / (b - a));
  return v * v * (3 - 2 * v);
}

function money(v: number) {
  const [int, dec] = v.toFixed(2).split(".");
  return `R$ ${int.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${dec}`;
}

/* ------------------------------------------------------------------ */
/* The stage                                                           */
/* ------------------------------------------------------------------ */

export default function Showcase() {
  const reduce = useReducedMotion();
  /* Steps taken, always forward, so the ring always turns the same way. */
  const [step, setStep] = useState(0);
  const index = step % N;
  const [size, setSize] = useState({ w: 340, h: 440 });
  const [panelH, setPanelH] = useState(150);
  const [ready, setReady] = useState(isIntroDone());
  useEffect(() => onIntroDone(() => setReady(true)), []);

  const scene = useSharedValue(0);
  const turn = useSharedValue(0);
  const slow = useSharedValue(0);
  const held = useRef(false);

  useEffect(() => {
    if (reduce) return;
    slow.set(withRepeat(withTiming(1, { duration: 9000, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(slow);
  }, [slow, reduce]);

  const next = useCallback(() => setStep((s) => s + 1), []);

  const shown = useRef(0);
  const startedAt = useRef(0);
  const from = useRef(0);
  const finish = useCallback(
    (which: number) => {
      if (which === shown.current) next();
    },
    [next],
  );
  const start = useCallback(
    (fraction: number) => {
      const which = shown.current;
      from.current = fraction;
      startedAt.current = Date.now();
      const left = Math.max(300, (1 - fraction) * SCENE_MS);
      const go = withTiming(1, { duration: left, easing: Easing.linear }, (done) => {
        if (done) runOnJS(finish)(which);
      });
      scene.set(fraction === 0 ? withSequence(withTiming(0, { duration: 0 }), go) : go);
    },
    [scene, finish],
  );
  const pause = useCallback(() => {
    from.current = Math.min(0.97, from.current + (Date.now() - startedAt.current) / SCENE_MS);
    cancelAnimation(scene);
  }, [scene]);

  useEffect(() => {
    if (!ready) return;
    shown.current = step;
    turn.set(reduce ? step : withTiming(step, { duration: TURN_MS, easing: Easing.inOut(Easing.cubic) }));
    cancelAnimation(scene);
    from.current = 0;
    if (held.current) scene.set(0);
    else start(0);
  }, [step, ready, scene, turn, start, reduce]);

  const onLayout = (e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  const { w, h } = size;
  const S = Math.max(100, Math.min(134, h * 0.28));
  const rx = Math.min(w * 0.44, 165);
  const ry = rx * 0.25;
  const oy = h - ry - 26; // the ring, round his feet
  const cx = w / 2;
  const cy = oy - S * 0.36; // his centre
  const f = FEATURES[index];

  return (
    <View style={{ flex: 1 }}>
      <Pressable
        onLayout={onLayout}
        accessibilityRole="adjustable"
        accessibilityLabel={`${f.tag.toLowerCase()}. ${f.title.replace("\n", " ")} ${f.line.replace("\n", " ")}`}
        accessibilityHint="Toque para ver a próxima função, segure para pausar."
        accessibilityActions={[{ name: "increment" }]}
        onAccessibilityAction={() => next()}
        onPressIn={() => {
          held.current = true;
          if (ready) pause();
        }}
        onPressOut={() => {
          held.current = false;
          if (ready) start(from.current);
        }}
        delayLongPress={260}
        onLongPress={() => undefined}
        onPress={() => {
          void Haptics.selectionAsync().catch(() => undefined);
          next();
        }}
        style={{ flex: 1 }}
      >
        <View pointerEvents="none" style={{ flex: 1 }}>
          <Glow w={w} h={h} cx={cx} cy={cy} slow={slow} />
          <Motes w={w} h={h} slow={slow} />
          <Pedestal cx={cx} oy={oy} rx={rx} ry={ry} w={w} h={h} />
          <Dial cx={cx} oy={oy} rx={rx} ry={ry} w={w} h={h} turn={turn} />

          {/* Capsules behind him, then him, then capsules in front. */}
          {FEATURES.map((ft, i) => (
            <Capsule key={`b${ft.tag}`} layer="back" i={i} feature={ft} cx={cx} oy={oy} rx={rx} ry={ry} turn={turn} />
          ))}

          {ready && <Beam x={cx} top={panelH - 4} bottom={cy - S * 0.42} scene={scene} />}
          <Halo cx={cx} cy={cy - S * 0.2} r={S * 0.6} slow={slow} />
          <View style={{ position: "absolute", left: cx - S / 2, top: cy - S / 2, width: S, height: S }}>
            <WilloBot size={S} mode={ready ? f.mode : "idle"} />
          </View>

          {FEATURES.map((ft, i) => (
            <Capsule key={`f${ft.tag}`} layer="front" i={i} feature={ft} cx={cx} oy={oy} rx={rx} ry={ry} turn={turn} />
          ))}

          {ready && (
            <Panel key={step} w={w} scene={scene} onHeight={setPanelH}>
              <f.Demo t={scene} />
            </Panel>
          )}
        </View>
      </Pressable>

      <Caption index={index} scene={scene} ready={ready} />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* The world                                                           */
/* ------------------------------------------------------------------ */

/** A soft light behind Willo that breathes slowly. */
function Glow({ w, h, cx, cy, slow }: { w: number; h: number; cx: number; cy: number; slow: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({ opacity: 0.75 + 0.25 * Math.sin(slow.get() * Math.PI * 2) }));
  return (
    <Animated.View style={[{ position: "absolute", left: 0, top: 0, width: w, height: h }, style]}>
      <Svg width={w} height={h}>
        <Defs>
          <RadialGradient id="aura" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={COLD} stopOpacity={0.2} />
            <Stop offset="0.5" stopColor={COLD} stopOpacity={0.06} />
            <Stop offset="1" stopColor={COLD} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        {/* An ellipse whose light is gone before its own edge, so it never meets the
            edge of the stage. */}
        <Ellipse cx={cx} cy={cy} rx={Math.min(w * 0.5, 190)} ry={Math.min(h - cy, cy) * 0.95} fill="url(#aura)" />
      </Svg>
    </Animated.View>
  );
}

function Motes({ w, h, slow }: { w: number; h: number; slow: SharedValue<number> }) {
  const seeds = [0.07, 0.16, 0.27, 0.35, 0.62, 0.71, 0.8, 0.9, 0.22, 0.85];
  return (
    <>
      {seeds.map((s, i) => (
        <Mote key={i} x={s * w} h={h} phase={(i * 0.41) % 1} speed={1 + (i % 3)} size={i % 3 === 0 ? 2.2 : 1.5} slow={slow} />
      ))}
    </>
  );
}

function Mote({ x, h, phase, speed, size, slow }: { x: number; h: number; phase: number; speed: number; size: number; slow: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const p = (slow.get() * speed + phase) % 1;
    return { opacity: Math.sin(Math.PI * p) * 0.5, transform: [{ translateY: h * (1 - p) }] };
  });
  return <Animated.View style={[{ position: "absolute", left: x, top: 0, width: size, height: size, borderRadius: size, backgroundColor: ICE }, style]} />;
}

/** The light Willo stands in: a disc of glow and a bright rim. */
function Pedestal({ cx, oy, rx, ry, w, h }: { cx: number; oy: number; rx: number; ry: number; w: number; h: number }) {
  return (
    <View style={{ position: "absolute", left: 0, top: 0, width: w, height: h }}>
      <Svg width={w} height={h}>
        <Defs>
          <RadialGradient id="disc" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={ICE} stopOpacity={0.34} />
            <Stop offset="0.35" stopColor={COLD} stopOpacity={0.16} />
            <Stop offset="1" stopColor={COLD} stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id="rim" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={ICE} stopOpacity={0} />
            <Stop offset="0.5" stopColor={ICE} stopOpacity={0.7} />
            <Stop offset="1" stopColor={ICE} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Ellipse cx={cx} cy={oy - ry * 0.25} rx={rx * 0.62} ry={ry * 0.62} fill="url(#disc)" />
        <Ellipse cx={cx} cy={oy - ry * 0.25} rx={rx * 0.36} ry={ry * 0.36} stroke="url(#rim)" strokeWidth={1.2} fill="none" />
      </Svg>
    </View>
  );
}

/** The ring at his feet: a bezel with fine ticks and a brighter one at each function. */
function Dial({ cx, oy, rx, ry, w, h, turn }: { cx: number; oy: number; rx: number; ry: number; w: number; h: number; turn: SharedValue<number> }) {
  const ticks = 72;
  const marks: ReactNode[] = [];
  for (let k = 0; k < ticks; k++) {
    const a = (k / ticks) * Math.PI * 2;
    const major = k % (ticks / N) === 0;
    const len = major ? 7 : 3.5;
    const x1 = cx + rx * Math.cos(a);
    const y1 = oy + ry * Math.sin(a);
    const x2 = cx + (rx + len) * Math.cos(a);
    const y2 = oy + (ry + len * (ry / rx)) * Math.sin(a);
    const near = (Math.sin(a) + 1) / 2;
    marks.push(<Line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#FFFFFF" strokeOpacity={(major ? 0.32 : 0.12) * (0.4 + 0.6 * near)} strokeWidth={major ? 1.4 : 1} />);
  }
  return (
    <View style={{ position: "absolute", left: 0, top: 0, width: w, height: h }}>
      <Svg width={w} height={h}>
        <Defs>
          <LinearGradient id="bezel" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.08} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0.34} />
          </LinearGradient>
        </Defs>
        <Ellipse cx={cx} cy={oy} rx={rx} ry={ry} stroke="url(#bezel)" strokeWidth={1.2} fill="none" />
        <Ellipse cx={cx} cy={oy} rx={rx + 10} ry={ry + 10 * (ry / rx)} stroke="#FFFFFF" strokeOpacity={0.05} strokeWidth={1} fill="none" />
        {marks}
      </Svg>
      <Sweep cx={cx} oy={oy} rx={rx} ry={ry} turn={turn} />
    </View>
  );
}

/** A short bright arc at the front of the ring, which flares as the ring turns. */
function Sweep({ cx, oy, rx, ry, turn }: { cx: number; oy: number; rx: number; ry: number; turn: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const frac = turn.get() - Math.floor(turn.get());
    const moving = frac > 0.001 && frac < 0.999 ? Math.sin(Math.PI * frac) : 0;
    return { opacity: 0.35 + 0.65 * moving };
  });
  const p = (a: number) => `${(cx + rx * Math.cos(a)).toFixed(1)} ${(oy + ry * Math.sin(a)).toFixed(1)}`;
  let d = `M ${p(Math.PI * 0.3)}`;
  for (let k = 1; k <= 24; k++) d += ` L ${p(Math.PI * 0.3 + (Math.PI * 0.4 * k) / 24)}`;
  return (
    <Animated.View style={[{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }, style]}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="sweep" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={ICE} stopOpacity={0} />
            <Stop offset="0.5" stopColor={ICE} stopOpacity={1} />
            <Stop offset="1" stopColor={ICE} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={d} stroke="url(#sweep)" strokeWidth={2.2} strokeLinecap="round" fill="none" />
      </Svg>
    </Animated.View>
  );
}

/** A thin halo behind his head with a point of light running round it. */
function Halo({ cx, cy, r, slow }: { cx: number; cy: number; r: number; slow: SharedValue<number> }) {
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${slow.get() * 360}deg` }] }));
  const D = r * 2;
  return (
    <View style={{ position: "absolute", left: cx - r, top: cy - r, width: D, height: D }}>
      <Svg width={D} height={D}>
        <Circle cx={r} cy={r} r={r - 1} stroke="#FFFFFF" strokeOpacity={0.07} strokeWidth={1} fill="none" />
      </Svg>
      <Animated.View style={[{ position: "absolute", left: 0, top: 0, width: D, height: D }, spin]}>
        <Svg width={D} height={D}>
          <Defs>
            <LinearGradient id="halo" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={ICE} stopOpacity={0} />
              <Stop offset="1" stopColor={ICE} stopOpacity={0.85} />
            </LinearGradient>
          </Defs>
          <Path d={`M ${r} 1 A ${r - 1} ${r - 1} 0 0 1 ${D - 1} ${r}`} stroke="url(#halo)" strokeWidth={1.6} strokeLinecap="round" fill="none" />
          <Circle cx={D - 1} cy={r} r={2.2} fill={ICE} />
        </Svg>
      </Animated.View>
    </View>
  );
}

/**
 * A function's capsule on the ring. Drawn twice — once behind Willo and once in
 * front — each showing only while the capsule is on its side of him, so he hides
 * what passes behind him.
 */
function Capsule({
  layer,
  i,
  feature,
  cx,
  oy,
  rx,
  ry,
  turn,
}: {
  layer: "back" | "front";
  i: number;
  feature: Feature;
  cx: number;
  oy: number;
  rx: number;
  ry: number;
  turn: SharedValue<number>;
}) {
  const { Icon } = feature;
  const D = 42;
  const style = useAnimatedStyle(() => {
    /* At turn = i (and every N after) the capsule is at the front, under Willo. */
    const a = Math.PI / 2 + ((i - turn.get()) / N) * Math.PI * 2;
    const x = cx + rx * Math.cos(a);
    const y = oy + ry * Math.sin(a);
    const z = Math.sin(a); // 1 nearest
    const front = clamp01(z * 5 + 0.5);
    const side = layer === "front" ? front : 1 - front;
    const near = (z + 1) / 2;
    const focus = Math.max(0, z) ** 6;
    return {
      opacity: side * (0.35 + 0.65 * near),
      transform: [{ translateX: x - D / 2 }, { translateY: y - D / 2 }, { scale: 0.62 + 0.3 * near + 0.28 * focus }],
    };
  });
  const lit = useAnimatedStyle(() => {
    const a = Math.PI / 2 + ((i - turn.get()) / N) * Math.PI * 2;
    return { opacity: Math.max(0, Math.sin(a)) ** 10 };
  });
  return (
    <Animated.View style={[{ position: "absolute", left: 0, top: 0, width: D, height: D }, style]}>
      <View style={{ flex: 1, borderRadius: D / 2, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(30,34,42,0.96)", overflow: "hidden" }}>
        <Fade colors={["rgba(255,255,255,0.14)", "rgba(255,255,255,0)"]} style={{ position: "absolute", left: 0, right: 0, top: 0, height: D * 0.55 }} />
        <Animated.View style={[{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, backgroundColor: "#F4F8FF" }, lit]} />
        <Icon size={18} color="rgba(255,255,255,0.82)" strokeWidth={2} />
        <Animated.View style={[{ position: "absolute" }, lit]}>
          <Icon size={18} color="#0B0D12" strokeWidth={2.3} />
        </Animated.View>
      </View>
      <Animated.View
        pointerEvents="none"
        style={[
          { position: "absolute", left: -6, top: -6, right: -6, bottom: -6, borderRadius: D, borderWidth: 1, borderColor: "rgba(220,235,255,0.35)" },
          lit,
        ]}
      />
    </Animated.View>
  );
}

/** The light Willo casts up to the panel. */
function Beam({ x, top, bottom, scene }: { x: number; top: number; bottom: number; scene: SharedValue<number> }) {
  const height = Math.max(0, bottom - top);
  const style = useAnimatedStyle(() => {
    const t = scene.get();
    return { opacity: reveal(t, 0.08, 0.16) * (1 - reveal(t, 0.9, 1)) };
  });
  if (height < 8) return null;
  return (
    <Animated.View style={[{ position: "absolute", left: x - 40, top, width: 80, height }, style]}>
      <Fade
        colors={["rgba(111,168,232,0)", "rgba(111,168,232,0.14)", "rgba(111,168,232,0)"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
      />
      <Fade colors={["rgba(220,235,255,0.7)", "rgba(220,235,255,0.0)"]} style={{ position: "absolute", left: 39.25, width: 1.5, top: 0, bottom: 0 }} />
    </Animated.View>
  );
}

/** The holographic panel: it forms from a line, holds, and fades; it grows to its content. */
function Panel({ w, scene, onHeight, children }: { w: number; scene: SharedValue<number>; onHeight: (h: number) => void; children: ReactNode }) {
  const shell = useAnimatedStyle(() => {
    const t = scene.get();
    const open = reveal(t, 0.02, 0.1);
    const out = 1 - reveal(t, 0.92, 1);
    return { opacity: Math.min(1, open * 1.8) * out, transform: [{ scaleY: 0.04 + 0.96 * open }] };
  });
  const sweep = useAnimatedStyle(() => {
    const p = reveal(scene.get(), 0.08, 0.3);
    return { opacity: p > 0 && p < 1 ? 1 : 0, top: `${p * 100}%` };
  });
  const c = { position: "absolute" as const, width: 12, height: 12, borderColor: "rgba(190,215,245,0.7)" };
  return (
    <Animated.View onLayout={(e) => onHeight(e.nativeEvent.layout.height)} style={[{ position: "absolute", left: 0, top: 0, width: w }, shell]}>
      <View style={{ borderRadius: 20, borderCurve: "continuous", overflow: "hidden", backgroundColor: "rgba(14,18,25,0.86)" }}>
        <Fade colors={["rgba(111,168,232,0.18)", "rgba(111,168,232,0.02)"]} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} />
        <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>{children}</View>
        <Animated.View style={[{ position: "absolute", left: 0, right: 0, height: 18, marginTop: -9 }, sweep]}>
          <Fade colors={["rgba(190,215,245,0)", "rgba(190,215,245,0.3)", "rgba(190,215,245,0)"]} style={{ flex: 1 }} />
        </Animated.View>
      </View>
      <View style={[c, { left: -3, top: -3, borderLeftWidth: 1.5, borderTopWidth: 1.5, borderTopLeftRadius: 7 }]} />
      <View style={[c, { right: -3, top: -3, borderRightWidth: 1.5, borderTopWidth: 1.5, borderTopRightRadius: 7 }]} />
      <View style={[c, { left: -3, bottom: -3, borderLeftWidth: 1.5, borderBottomWidth: 1.5, borderBottomLeftRadius: 7 }]} />
      <View style={[c, { right: -3, bottom: -3, borderRightWidth: 1.5, borderBottomWidth: 1.5, borderBottomRightRadius: 7 }]} />
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */
/* The caption                                                         */
/* ------------------------------------------------------------------ */

function Caption({ index, scene, ready }: { index: number; scene: SharedValue<number>; ready: boolean }) {
  const f = FEATURES[index];
  /* It slides in with the scene and leaves with it, on the scene's own clock. */
  const title = useAnimatedStyle(() => {
    if (!ready) return { opacity: 1, transform: [{ translateY: 0 }] };
    const t = scene.get();
    return { opacity: reveal(t, 0.03, 0.14) * (1 - reveal(t, 0.95, 1)), transform: [{ translateY: (1 - reveal(t, 0.03, 0.14)) * 14 }] };
  });
  const line = useAnimatedStyle(() => {
    if (!ready) return { opacity: 1, transform: [{ translateY: 0 }] };
    const t = scene.get();
    return { opacity: reveal(t, 0.08, 0.2) * (1 - reveal(t, 0.95, 1)), transform: [{ translateY: (1 - reveal(t, 0.08, 0.2)) * 10 }] };
  });
  return (
    <View style={{ marginTop: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Text style={{ fontFamily: "Menlo", fontSize: 12, letterSpacing: 1, color: INK.softer }}>
          {String(index + 1).padStart(2, "0")} / {String(N).padStart(2, "0")}
        </Text>
        <View style={{ flexDirection: "row", gap: 4 }}>
          {FEATURES.map((ft, i) => (
            <View key={ft.tag} style={{ width: i === index ? 18 : 6, height: 3, borderRadius: 2, backgroundColor: i === index ? "#fff" : "rgba(255,255,255,0.2)" }} />
          ))}
        </View>
        <Text style={{ fontFamily: "Menlo", fontSize: 12, letterSpacing: 1.2, color: INK.softer }}>{f.tag}</Text>
      </View>
      <Animated.Text style={[{ marginTop: 10, fontSize: 30, fontWeight: "800", letterSpacing: -1, lineHeight: 34, color: "#fff" }, title]}>{f.title}</Animated.Text>
      <Animated.Text style={[{ marginTop: 10, fontSize: 15, lineHeight: 21, color: INK.soft }, line]}>{f.line}</Animated.Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* The demos inside the panel: everything shown in full                */
/* ------------------------------------------------------------------ */

function Tag({ children, icon }: { children: string; icon?: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      {icon}
      <Text style={{ fontFamily: "Menlo", fontSize: 10.5, letterSpacing: 1.3, color: "rgba(200,220,245,0.7)" }}>{children}</Text>
    </View>
  );
}

function Reveal({ t, a, b, children }: { t: SharedValue<number>; a: number; b: number; children: ReactNode }) {
  const s = useAnimatedStyle(() => {
    const v = reveal(t.get(), a, b);
    return { opacity: v, transform: [{ translateY: (1 - v) * 6 }] };
  });
  return <Animated.View style={s}>{children}</Animated.View>;
}

/** Typed out as the scene runs. The full text holds its space from the start, so the
    panel does not change size as letters arrive. */
function Typed({ t, text, a, b, style }: { t: SharedValue<number>; text: string; a: number; b: number; style: object }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      const v = clamp01((t.get() - a) / (b - a));
      setN(Math.round(v * text.length));
    }, 40);
    return () => clearInterval(id);
  }, [t, text, a, b]);
  return (
    <View>
      <Text style={[style, { opacity: 0 }]}>{text}</Text>
      <Text style={[style, { position: "absolute", left: 0, top: 0, right: 0 }]}>{text.slice(0, n)}</Text>
    </View>
  );
}

function useCountBy(t: SharedValue<number>, to: number, a: number, b: number) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      const p = clamp01((t.get() - a) / (b - a));
      setV(to * (1 - (1 - p) ** 3));
    }, 40);
    return () => clearInterval(id);
  }, [t, to, a, b]);
  return v;
}

const SAID = { fontSize: 17, lineHeight: 23, fontWeight: "700" as const, color: "#fff" };
const ICON_SOFT = "rgba(200,220,245,0.8)";

function Result({ children }: { children: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)" }}>
      <View style={{ width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(111,168,232,0.22)" }}>
        <Check size={13} color={ICE} strokeWidth={3} />
      </View>
      <Text style={{ flex: 1, fontSize: 14, lineHeight: 19, color: "#fff" }}>{children}</Text>
    </View>
  );
}

function VoiceDemo({ t }: { t: SharedValue<number> }) {
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Tag icon={<Mic size={12} color={ICON_SOFT} strokeWidth={2.2} />}>VOCÊ DISSE</Tag>
        <Wave t={t} />
      </View>
      <View style={{ marginTop: 8 }}>
        <Typed t={t} text="“Almoço, 32 reais, no débito.”" a={0.14} b={0.46} style={SAID} />
      </View>
      <Reveal t={t} a={0.52} b={0.62}>
        <Result>
          <Text style={{ fontWeight: "700" }}>Almoço · R$ 32,00</Text>
          <Text style={{ color: INK.soft }}>{"\n"}Alimentação · Débito · hoje</Text>
        </Result>
      </Reveal>
    </View>
  );
}

function Wave({ t }: { t: SharedValue<number> }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 2.5, height: 20 }}>
      {Array.from({ length: 14 }, (_, i) => (
        <WaveBar key={i} i={i} t={t} />
      ))}
    </View>
  );
}

function WaveBar({ i, t }: { i: number; t: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const v = t.get();
    const on = reveal(v, 0.1, 0.16) * (1 - reveal(v, 0.46, 0.54));
    const wob = 0.5 + 0.5 * Math.sin(v * 80 + i * 1.1) * Math.sin(v * 27 + i * 0.6);
    return { height: 3 + on * wob * 17 };
  });
  return <Animated.View style={[{ width: 2.5, borderRadius: 2, backgroundColor: i % 4 === 1 ? COLD : "#fff" }, style]} />;
}

function QuickDemo({ t }: { t: SharedValue<number> }) {
  const v = useCountBy(t, 18.4, 0.22, 0.46);
  const chips = ["Transporte", "Mercado", "Lazer"];
  return (
    <View>
      <Tag icon={<Zap size={12} color={ICON_SOFT} strokeWidth={2.2} />}>DOIS TOQUES · REGISTRO RÁPIDO</Tag>
      <Text style={{ marginTop: 6, fontSize: 32, fontWeight: "800", letterSpacing: -1, color: "#fff", fontVariant: ["tabular-nums"] }}>{money(v)}</Text>
      <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
        {chips.map((c, i) => (
          <View key={c} style={{ paddingHorizontal: 11, height: 28, borderRadius: 14, justifyContent: "center", backgroundColor: i === 0 ? "#fff" : "rgba(255,255,255,0.07)" }}>
            <Text style={{ fontSize: 12.5, fontWeight: "600", color: i === 0 ? "#0B0D12" : INK.soft }}>{c}</Text>
          </View>
        ))}
      </View>
      <Reveal t={t} a={0.54} b={0.64}>
        <Result>
          <Text style={{ fontWeight: "700" }}>Salvo em Transporte</Text>
          <Text style={{ color: INK.soft }}> · em 2 segundos</Text>
        </Result>
      </Reveal>
    </View>
  );
}

function ReceiptDemo({ t }: { t: SharedValue<number> }) {
  const scan = useAnimatedStyle(() => {
    const p = reveal(t.get(), 0.12, 0.46);
    return { opacity: p > 0 && p < 1 ? 1 : 0, top: `${p * 100}%` };
  });
  const lines: [string, string][] = [
    ["Arroz 5 kg", "24,90"],
    ["Café 500 g", "18,40"],
    ["Leite 1 L ×6", "35,94"],
  ];
  return (
    <View>
      <Tag icon={<Camera size={12} color={ICON_SOFT} strokeWidth={2.2} />}>LENDO O COMPROVANTE</Tag>
      <View style={{ flexDirection: "row", gap: 14, marginTop: 10, alignItems: "center" }}>
        <View style={{ width: 92, borderRadius: 8, backgroundColor: "rgba(236,238,242,0.93)", padding: 8, overflow: "hidden" }}>
          <Text style={{ fontSize: 7.5, fontWeight: "800", color: "#2A2C31", textAlign: "center" }}>BOA COMPRA</Text>
          {lines.map(([n, v]) => (
            <View key={n} style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
              <Text style={{ fontSize: 6.5, color: "#3B3E45" }}>{n}</Text>
              <Text style={{ fontSize: 6.5, color: "#3B3E45" }}>{v}</Text>
            </View>
          ))}
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
            <Text style={{ fontSize: 7.5, fontWeight: "800", color: "#1E2025" }}>TOTAL</Text>
            <Text style={{ fontSize: 7.5, fontWeight: "800", color: "#1E2025" }}>127,90</Text>
          </View>
          <Animated.View style={[{ position: "absolute", left: 0, right: 0, height: 10, marginTop: -5 }, scan]}>
            <Fade colors={["rgba(111,168,232,0)", "rgba(111,168,232,0.9)", "rgba(111,168,232,0)"]} style={{ flex: 1 }} />
          </Animated.View>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Reveal t={t} a={0.3} b={0.4}>
            <Text style={{ fontSize: 12, color: INK.softer }}>Supermercado Boa Compra</Text>
          </Reveal>
          <Reveal t={t} a={0.38} b={0.48}>
            <Text style={{ fontSize: 24, fontWeight: "800", letterSpacing: -0.6, color: "#fff", fontVariant: ["tabular-nums"] }}>R$ 127,90</Text>
          </Reveal>
          <Reveal t={t} a={0.48} b={0.58}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Check size={13} color={ICE} strokeWidth={3} />
              <Text style={{ fontSize: 12.5, color: INK.soft }}>Mercado · 5 itens · pronto</Text>
            </View>
          </Reveal>
        </View>
      </View>
    </View>
  );
}

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function RadarDemo({ t }: { t: SharedValue<number> }) {
  const R = 34;
  const L = Math.PI * R;
  const score = useCountBy(t, 78, 0.12, 0.44);
  const arc = useAnimatedProps(() => ({ strokeDashoffset: L * (1 - 0.78 * reveal(t.get(), 0.12, 0.44)) }));
  const rows: [string, number, string][] = [
    ["Mercado", 0.34, "#FFFFFF"],
    ["Transporte", 0.18, COLD],
    ["Lazer", 0.12, "rgba(255,255,255,0.45)"],
  ];
  return (
    <View>
      <Tag icon={<ChartPie size={12} color={ICON_SOFT} strokeWidth={2.2} />}>RADAR FINANCEIRO</Tag>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginTop: 8 }}>
        <View style={{ width: 2 * R + 10, alignItems: "center" }}>
          <Svg width={2 * R + 10} height={R + 10}>
            <Defs>
              <LinearGradient id="g" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={COLD} />
                <Stop offset="1" stopColor="#FFFFFF" />
              </LinearGradient>
            </Defs>
            <Path d={`M 5 ${R + 5} A ${R} ${R} 0 0 1 ${2 * R + 5} ${R + 5}`} stroke="rgba(255,255,255,0.12)" strokeWidth={7} strokeLinecap="round" fill="none" />
            <AnimatedPath
              d={`M 5 ${R + 5} A ${R} ${R} 0 0 1 ${2 * R + 5} ${R + 5}`}
              stroke="url(#g)"
              strokeWidth={7}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${L} ${L}`}
              animatedProps={arc}
            />
          </Svg>
          <Text style={{ marginTop: -18, fontSize: 22, fontWeight: "800", color: "#fff", fontVariant: ["tabular-nums"] }}>{Math.round(score)}</Text>
          <Text style={{ fontSize: 11, color: INK.softer }}>saúde boa</Text>
        </View>
        <View style={{ flex: 1, gap: 9 }}>
          {rows.map(([n, s, c], k) => (
            <Bar key={n} t={t} name={n} share={s} color={c} at={0.3 + k * 0.06} />
          ))}
        </View>
      </View>
      <Reveal t={t} a={0.6} b={0.7}>
        <Result>
          <Text style={{ fontWeight: "700" }}>Delivery 40% acima do normal</Text>
          <Text style={{ color: INK.soft }}> este mês</Text>
        </Result>
      </Reveal>
    </View>
  );
}

function Bar({ t, name, share, color, at }: { t: SharedValue<number>; name: string; share: number; color: string; at: number }) {
  const style = useAnimatedStyle(() => ({ width: `${(share / 0.4) * 100 * reveal(t.get(), at, at + 0.16)}%` }));
  return (
    <View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 12, color: "#fff" }}>{name}</Text>
        <Text style={{ fontSize: 12, color: INK.soft, fontVariant: ["tabular-nums"] }}>{Math.round(share * 100)}%</Text>
      </View>
      <View style={{ marginTop: 4, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
        <Animated.View style={[{ height: "100%", borderRadius: 3, backgroundColor: color }, style]} />
      </View>
    </View>
  );
}

function ForecastDemo({ t }: { t: SharedValue<number> }) {
  const v = useCountBy(t, 893, 0.16, 0.46);
  const pts = [8, 4, 22, 18, 30, 26, 34, 30, 40, 46, 43, 52, 58];
  const W = 120;
  const H = 54;
  const today = 7;
  const P = (k: number) => `${((k / (pts.length - 1)) * W).toFixed(1)} ${(4 + (pts[k] / 60) * (H - 8)).toFixed(1)}`;
  const past = pts
    .slice(0, today + 1)
    .map((_, k) => `${k === 0 ? "M" : "L"} ${P(k)}`)
    .join(" ");
  const ahead = pts
    .slice(today)
    .map((_, k) => `${k === 0 ? "M" : "L"} ${P(today + k)}`)
    .join(" ");
  const D = 300;
  const draw = useAnimatedProps(() => ({ strokeDashoffset: D * (1 - reveal(t.get(), 0.1, 0.34)) }));
  const later = useAnimatedProps(() => ({ opacity: reveal(t.get(), 0.32, 0.44) }));
  return (
    <View>
      <Tag icon={<TrendingUp size={12} color={ICON_SOFT} strokeWidth={2.2} />}>PREVISÃO DO MÊS</Tag>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginTop: 6 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, color: INK.softer }}>Sobra no fim do mês</Text>
          <Text style={{ marginTop: 2, fontSize: 28, fontWeight: "800", letterSpacing: -0.8, color: "#fff", fontVariant: ["tabular-nums"] }}>{money(v)}</Text>
        </View>
        <Svg width={W + 6} height={H}>
          <AnimatedPath d={past} stroke="#FFFFFF" strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" fill="none" strokeDasharray={`${D} ${D}`} animatedProps={draw} />
          <AnimatedPath d={ahead} stroke={COLD} strokeWidth={2} strokeDasharray="4 5" strokeLinecap="round" fill="none" animatedProps={later} />
          <AnimatedCircle cx={(today / (pts.length - 1)) * W} cy={4 + (pts[today] / 60) * (H - 8)} r={3.5} fill="#fff" animatedProps={later} />
        </Svg>
      </View>
      <Reveal t={t} a={0.54} b={0.64}>
        <Result>
          <Text style={{ fontWeight: "700" }}>Conta de luz vence em 3 dias</Text>
          <Text style={{ color: INK.soft }}> · R$ 142,00, aviso na véspera</Text>
        </Result>
      </Reveal>
    </View>
  );
}

function ChatDemo({ t }: { t: SharedValue<number> }) {
  return (
    <View style={{ gap: 10 }}>
      <Tag icon={<Sparkles size={12} color={ICON_SOFT} strokeWidth={2.2} />}>CONVERSA</Tag>
      <View style={{ alignSelf: "flex-end", maxWidth: "88%", backgroundColor: "rgba(255,255,255,0.94)", borderRadius: 16, borderBottomRightRadius: 5, paddingHorizontal: 12, paddingVertical: 8 }}>
        <Typed t={t} text="Posso gastar R$ 200 no fim de semana?" a={0.08} b={0.3} style={{ fontSize: 14.5, lineHeight: 19, fontWeight: "600", color: "#0B0D12" }} />
      </View>
      <View style={{ alignSelf: "flex-start", maxWidth: "92%", backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 16, borderBottomLeftRadius: 5, paddingHorizontal: 12, paddingVertical: 8 }}>
        <Typed t={t} text="Pode, sim. Depois disso ainda sobram R$ 540 até o dia 30, já contando a fatura." a={0.4} b={0.66} style={{ fontSize: 14.5, lineHeight: 19, color: "#fff" }} />
      </View>
    </View>
  );
}
