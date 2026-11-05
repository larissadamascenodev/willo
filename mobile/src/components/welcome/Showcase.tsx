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
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Circle, Defs, Ellipse, Line, LinearGradient, Path, RadialGradient, Stop } from "react-native-svg";
import { LinearGradient as Fade } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import WilloBot from "~/components/willo/WilloBot";
import type { OrbMode } from "~/components/registro/ParticleOrb";
import { Camera, ChartPie, Mic, Sparkles, TrendingUp, Zap } from "~/components/icons";
import { INK } from "~/theme/tokens";
import { isIntroDone, onIntroDone } from "~/lib/launchIntro";

/**
 * The welcome's stage: Willo at the centre of a small system of what he does.
 *
 * He floats over a pool of light on a floor of perspective lines that fade into the
 * dark, with a few motes rising. Around him two tilted rings turn, carrying the six
 * things the app does as glass capsules that pass in front of him and behind. Every
 * few seconds one of them comes on: its capsule lights, Willo casts a beam upward,
 * and a holographic panel materialises there with that thing happening in miniature
 * — a voice being written down, a quick entry counting up, a receipt being scanned,
 * the Radar's dial, the month's line drawing itself, a question answered. Under it
 * the name of the thing decodes itself into place.
 *
 * It all runs on two clocks — the orbit, which never stops, and the scene's own,
 * which the panel's demo reads — so nothing is mounted with an entering or leaving
 * animation between scenes and nothing stutters. A tap goes on to the next; holding
 * pauses. It waits for the opening animation to end before it starts.
 *
 * The colours are the app's: graphite, white, the cold blue for light and lines, no
 * coloured text. The figures in the demos are an example.
 */

const SCENE_MS = 4600;
const COLD = "#6FA8E8";
const ORBIT_MS = 46000;

interface Feature {
  tag: string;
  short: string;
  title: string;
  line: string;
  Icon: typeof Mic;
  Demo: (p: { t: SharedValue<number> }) => ReactNode;
  mode: OrbMode;
}

const FEATURES: Feature[] = [
  {
    tag: "VOZ",
    short: "Voz",
    title: "Fale.\nO Willo anota.",
    line: "Segure o Willo e diga o gasto do seu\njeito: valor, categoria e conta.",
    Icon: Mic,
    Demo: VoiceDemo,
    mode: "listening",
  },
  {
    tag: "REGISTRO RÁPIDO",
    short: "Dois toques",
    title: "Dois toques,\num gasto salvo.",
    line: "Toque duas vezes no Willo e registre\nem segundos, sem procurar menu.",
    Icon: Zap,
    Demo: QuickDemo,
    mode: "speaking",
  },
  {
    tag: "COMPROVANTE",
    short: "Foto",
    title: "Fotografe.\nEle lê por você.",
    line: "Valor, local e categoria saem da\nfoto direto para o seu registro.",
    Icon: Camera,
    Demo: ReceiptDemo,
    mode: "thinking",
  },
  {
    tag: "RADAR",
    short: "Radar",
    title: "Para onde vai\ncada real.",
    line: "Consumo, hábitos e o que está fora\ndo normal, tudo num só lugar.",
    Icon: ChartPie,
    Demo: RadarDemo,
    mode: "thinking",
  },
  {
    tag: "PREVISÃO",
    short: "Previsão",
    title: "O fim do mês,\nantes do fim.",
    line: "O Willo soma o que vem pela frente\ne avisa antes de cada conta vencer.",
    Icon: TrendingUp,
    Demo: ForecastDemo,
    mode: "speaking",
  },
  {
    tag: "CONVERSA",
    short: "Conversa",
    title: "Pergunte.\nEle calcula.",
    line: "Fim de semana, viagem, fatura:\nresposta com os seus números.",
    Icon: Sparkles,
    Demo: ChatDemo,
    mode: "speaking",
  },
];
const N = FEATURES.length;

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
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
  const [index, setIndex] = useState(0);
  const [size, setSize] = useState({ w: 340, h: 420 });
  const [ready, setReady] = useState(isIntroDone());
  useEffect(() => onIntroDone(() => setReady(true)), []);

  /* The orbit's clock, 0..1 forever; the scene's, 0..1 per scene. */
  const orbit = useSharedValue(0);
  const scene = useSharedValue(0);
  const active = useSharedValue(0);
  const held = useRef(false);

  useEffect(() => {
    if (reduce) return;
    orbit.set(withRepeat(withTiming(1, { duration: ORBIT_MS, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(orbit);
  }, [orbit, reduce]);

  const next = useCallback(() => setIndex((i) => (i + 1) % N), []);
  const run = useCallback(() => {
    const left = Math.max(0, 1 - scene.get()) * SCENE_MS;
    scene.set(
      withTiming(1, { duration: left, easing: Easing.linear }, (done) => {
        if (done) runOnJS(next)();
      }),
    );
  }, [scene, next]);

  useEffect(() => {
    if (!ready) return;
    active.set(index);
    cancelAnimation(scene);
    scene.set(0);
    if (!held.current) run();
  }, [index, ready, scene, active, run]);

  const onLayout = (e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  const { w, h } = size;
  const S = Math.max(96, Math.min(150, h * 0.34)); // Willo
  const cx = w / 2;
  const cy = h * 0.66; // his centre
  const rx = Math.min(w * 0.47, 176);
  const ry = rx * 0.27;
  const oy = cy + S * 0.18; // the rings go round his middle
  const panelW = Math.min(w - 8, 300);
  const panelH = 116;
  const panelTop = Math.max(0, cy - S / 2 - 46 - panelH);
  const f = FEATURES[index];

  return (
    <View style={{ flex: 1 }}>
      <Pressable
        onLayout={onLayout}
        accessibilityRole="adjustable"
        accessibilityLabel={`${f.short}. ${f.title.replace("\n", " ")} ${f.line.replace("\n", " ")}`}
        accessibilityHint="Toque para ver a próxima função, segure para pausar."
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(e) => setIndex((i) => (i + (e.nativeEvent.actionName === "increment" ? 1 : N - 1)) % N)}
        onPressIn={() => {
          held.current = true;
          cancelAnimation(scene);
        }}
        onPressOut={() => {
          held.current = false;
          if (ready) run();
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
          <Floor w={w} h={h} cy={oy} />
          <Rings w={w} h={h} cx={cx} oy={oy} rx={rx} ry={ry} orbit={orbit} />
          <Motes w={w} h={h} orbit={orbit} />

          {/* The beam from Willo up to the panel. */}
          {ready && <Beam x={cx} top={panelTop + panelH - 6} bottom={cy - S * 0.32} scene={scene} />}

          <View style={{ position: "absolute", left: cx - S / 2, top: cy - S / 2, width: S, height: S }}>
            <WilloBot size={S} mode={ready ? f.mode : "idle"} />
          </View>

          {FEATURES.map((ft, i) => (
            <Capsule key={ft.tag} i={i} feature={ft} cx={cx} oy={oy} rx={rx} ry={ry} S={S} orbit={orbit} active={active} />
          ))}

          {ready && (
            <Panel key={index} x={cx - panelW / 2} y={panelTop} w={panelW} h={panelH} scene={scene}>
              <f.Demo t={scene} />
            </Panel>
          )}
        </View>
      </Pressable>

      <Caption index={index} ready={ready} scene={scene} />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* The world                                                           */
/* ------------------------------------------------------------------ */

/** A floor of lines in perspective under Willo, fading into the dark, and his pool of light. */
function Floor({ w, h, cy }: { w: number; h: number; cy: number }) {
  const horizon = cy - 10;
  const lines: ReactNode[] = [];
  for (let k = 1; k <= 7; k++) {
    const y = horizon + (h - horizon) * (k / 7) ** 1.8;
    lines.push(<Line key={`h${k}`} x1={0} y1={y} x2={w} y2={y} stroke="url(#floor)" strokeWidth={1} />);
  }
  for (let k = -8; k <= 8; k++) {
    const xb = w / 2 + k * (w / 5);
    lines.push(<Line key={`v${k}`} x1={w / 2 + k * 6} y1={horizon} x2={xb} y2={h} stroke="url(#floor)" strokeWidth={1} />);
  }
  /* The lines fade in from the horizon and out again at the near edge, by their own
     colour rather than by a band laid over them, so the room shows through. */
  return (
    <View style={{ position: "absolute", left: 0, top: 0, width: w, height: h }}>
      <Svg width={w} height={h}>
        <Defs>
          <RadialGradient id="pool" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={COLD} stopOpacity={0.32} />
            <Stop offset="0.55" stopColor={COLD} stopOpacity={0.08} />
            <Stop offset="1" stopColor={COLD} stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id="floor" gradientUnits="userSpaceOnUse" x1={0} y1={horizon} x2={0} y2={h}>
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
            <Stop offset="0.4" stopColor="#FFFFFF" stopOpacity={0.09} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0.02} />
          </LinearGradient>
        </Defs>
        {lines}
        <Ellipse cx={w / 2} cy={cy + 22} rx={w * 0.34} ry={w * 0.07} fill="url(#pool)" />
      </Svg>
    </View>
  );
}

const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

function Rings({ w, h, cx, oy, rx, ry, orbit }: { w: number; h: number; cx: number; oy: number; rx: number; ry: number; orbit: SharedValue<number> }) {
  const flowA = useAnimatedProps(() => ({ strokeDashoffset: -orbit.get() * 2400 }));
  const flowB = useAnimatedProps(() => ({ strokeDashoffset: orbit.get() * 1800 }));
  return (
    <View style={{ position: "absolute", left: 0, top: 0, width: w, height: h }}>
      <Svg width={w} height={h}>
        <Ellipse cx={cx} cy={oy} rx={rx} ry={ry} stroke="#FFFFFF" strokeOpacity={0.16} strokeWidth={1} fill="none" />
        <AnimatedEllipse cx={cx} cy={oy} rx={rx} ry={ry} stroke={COLD} strokeOpacity={0.55} strokeWidth={1.4} strokeDasharray="2 18" fill="none" animatedProps={flowA} />
        <AnimatedEllipse
          cx={cx}
          cy={oy - ry * 0.35}
          rx={rx * 0.7}
          ry={ry * 0.62}
          stroke="#FFFFFF"
          strokeOpacity={0.12}
          strokeWidth={1}
          strokeDasharray="10 14"
          fill="none"
          animatedProps={flowB}
        />
      </Svg>
    </View>
  );
}

/** A few points of light rising slowly through the stage. */
function Motes({ w, h, orbit }: { w: number; h: number; orbit: SharedValue<number> }) {
  const seeds = [0.08, 0.17, 0.29, 0.36, 0.47, 0.58, 0.66, 0.74, 0.83, 0.92, 0.12, 0.52];
  return (
    <>
      {seeds.map((s, i) => (
        <Mote key={i} x={s * w} h={h} phase={(i * 0.37) % 1} speed={7 + (i % 4) * 2} size={i % 3 === 0 ? 2.5 : 1.6} orbit={orbit} />
      ))}
    </>
  );
}

function Mote({ x, h, phase, speed, size, orbit }: { x: number; h: number; phase: number; speed: number; size: number; orbit: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const p = (orbit.get() * speed + phase) % 1;
    return { opacity: Math.sin(Math.PI * p) * 0.55, transform: [{ translateY: h * (1 - p) }] };
  });
  return <Animated.View style={[{ position: "absolute", left: x, top: 0, width: size, height: size, borderRadius: size, backgroundColor: "#DCEBFF" }, style]} />;
}

function Capsule({
  i,
  feature,
  cx,
  oy,
  rx,
  ry,
  S,
  orbit,
  active,
}: {
  i: number;
  feature: Feature;
  cx: number;
  oy: number;
  rx: number;
  ry: number;
  S: number;
  orbit: SharedValue<number>;
  active: SharedValue<number>;
}) {
  const { Icon } = feature;
  const D = 40;
  const style = useAnimatedStyle(() => {
    const a = orbit.get() * Math.PI * 2 + (i / N) * Math.PI * 2;
    const x = cx + rx * Math.cos(a);
    const y = oy + ry * Math.sin(a);
    const z = Math.sin(a); // 1 nearest, -1 farthest
    const near = (z + 1) / 2;
    /* Behind Willo, he hides it. */
    const hidden = z < 0 && Math.abs(x - cx) < S * 0.3 ? 0.18 : 1;
    const on = active.get() === i ? 1 : 0;
    return {
      opacity: (0.4 + 0.6 * near) * hidden,
      transform: [{ translateX: x - D / 2 }, { translateY: y - D / 2 }, { scale: (0.72 + 0.28 * near) * (1 + on * 0.18) }],
    };
  });
  const lit = useAnimatedStyle(() => ({ opacity: withTiming(active.get() === i ? 1 : 0, { duration: 350 }) }));
  return (
    <Animated.View style={[{ position: "absolute", left: 0, top: 0, width: D, height: D }, style]}>
      <View style={{ flex: 1, borderRadius: D / 2, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(28,32,40,0.88)" }}>
        <Animated.View
          style={[
            {
              position: "absolute",
              left: -1,
              top: -1,
              right: -1,
              bottom: -1,
              borderRadius: D / 2 + 1,
              backgroundColor: "rgba(255,255,255,0.95)",
              shadowColor: COLD,
              shadowOpacity: 0.9,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 0 },
            },
            lit,
          ]}
        />
        <Icon size={17} color="rgba(255,255,255,0.85)" strokeWidth={2} />
        <Animated.View style={[{ position: "absolute" }, lit]}>
          <Icon size={17} color="#0B0D12" strokeWidth={2.3} />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

/** The light Willo casts up to the panel: it rises as the panel forms. */
function Beam({ x, top, bottom, scene }: { x: number; top: number; bottom: number; scene: SharedValue<number> }) {
  const height = Math.max(0, bottom - top);
  const style = useAnimatedStyle(() => {
    const t = scene.get();
    const up = reveal(t, 0, 0.08);
    const out = 1 - reveal(t, 0.9, 1);
    return { opacity: out * up };
  });
  return (
    <Animated.View style={[{ position: "absolute", left: x - 34, top, width: 68, height }, style]}>
      <Fade
        colors={["rgba(111,168,232,0.0)", "rgba(111,168,232,0.16)", "rgba(111,168,232,0.02)"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
      />
      <Fade colors={["rgba(220,235,255,0.9)", "rgba(220,235,255,0.05)"]} style={{ position: "absolute", left: 33, width: 2, top: 0, bottom: 0 }} />
    </Animated.View>
  );
}

/** The holographic panel: it materialises from a line, holds, and fades. */
function Panel({ x, y, w, h, scene, children }: { x: number; y: number; w: number; h: number; scene: SharedValue<number>; children: ReactNode }) {
  const shell = useAnimatedStyle(() => {
    const t = scene.get();
    const open = reveal(t, 0.04, 0.14);
    const out = 1 - reveal(t, 0.9, 1);
    return { opacity: Math.min(1, open * 1.6) * out, transform: [{ scaleY: 0.03 + 0.97 * open }, { scaleX: 0.92 + 0.08 * open }] };
  });
  const sweep = useAnimatedStyle(() => {
    const p = reveal(scene.get(), 0.1, 0.32);
    return { opacity: p > 0 && p < 1 ? 1 : 0, transform: [{ translateY: p * h }] };
  });
  const scan: ReactNode[] = [];
  for (let k = 0; k < h; k += 4) scan.push(<Line key={k} x1={0} y1={k} x2={w} y2={k} stroke="#FFFFFF" strokeOpacity={0.025} strokeWidth={1} />);
  const c = { position: "absolute" as const, width: 12, height: 12, borderColor: "rgba(170,205,245,0.75)" };
  return (
    <Animated.View style={[{ position: "absolute", left: x, top: y, width: w, height: h }, shell]}>
      <View style={{ flex: 1, borderRadius: 18, overflow: "hidden", backgroundColor: "rgba(16,20,28,0.78)" }}>
        <Fade colors={["rgba(111,168,232,0.16)", "rgba(111,168,232,0)"]} style={{ position: "absolute", left: 0, right: 0, top: 0, height: h * 0.6 }} />
        <Svg width={w} height={h} style={{ position: "absolute" }}>
          {scan}
        </Svg>
        <View style={{ flex: 1, padding: 14 }}>{children}</View>
        <Animated.View style={[{ position: "absolute", left: 0, right: 0, top: -10, height: 20 }, sweep]}>
          <Fade colors={["rgba(170,205,245,0)", "rgba(170,205,245,0.35)", "rgba(170,205,245,0)"]} style={{ flex: 1 }} />
        </Animated.View>
      </View>
      <View style={[c, { left: -3, top: -3, borderLeftWidth: 1.5, borderTopWidth: 1.5, borderTopLeftRadius: 6 }]} />
      <View style={[c, { right: -3, top: -3, borderRightWidth: 1.5, borderTopWidth: 1.5, borderTopRightRadius: 6 }]} />
      <View style={[c, { left: -3, bottom: -3, borderLeftWidth: 1.5, borderBottomWidth: 1.5, borderBottomLeftRadius: 6 }]} />
      <View style={[c, { right: -3, bottom: -3, borderRightWidth: 1.5, borderBottomWidth: 1.5, borderBottomRightRadius: 6 }]} />
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */
/* The caption                                                         */
/* ------------------------------------------------------------------ */

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&$";

/** Text that resolves into place letter by letter from scrambled glyphs. */
function useDecoded(text: string, run: boolean) {
  const reduce = useReducedMotion();
  const [out, setOut] = useState(text);
  useEffect(() => {
    if (!run || reduce) {
      setOut(text);
      return;
    }
    const t0 = Date.now();
    const total = 520;
    const id = setInterval(() => {
      const p = Math.min(1, (Date.now() - t0) / total);
      const fixed = Math.floor(p * text.length);
      let s = "";
      for (let k = 0; k < text.length; k++) {
        const ch = text[k];
        s += k < fixed || ch === " " || ch === "\n" || ch === "." || ch === "," ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      }
      setOut(s);
      if (p >= 1) clearInterval(id);
    }, 33);
    return () => clearInterval(id);
  }, [text, run, reduce]);
  return out;
}

function Caption({ index, ready, scene }: { index: number; ready: boolean; scene: SharedValue<number> }) {
  const f = FEATURES[index];
  const title = useDecoded(f.title, ready);
  const line = useAnimatedStyle(() => ({ opacity: 0.25 + 0.75 * reveal(scene.get(), 0.05, 0.2) }));
  return (
    <View style={{ marginTop: 14 }}>
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
      <Text style={{ marginTop: 10, fontSize: 30, fontWeight: "800", letterSpacing: -1, lineHeight: 34, color: "#fff" }}>{title}</Text>
      <Animated.Text style={[{ marginTop: 10, fontSize: 15, lineHeight: 21, color: INK.soft }, line]}>{f.line}</Animated.Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* The demos inside the panel                                          */
/* ------------------------------------------------------------------ */

function Tag({ children }: { children: string }) {
  return <Text style={{ fontFamily: "Menlo", fontSize: 10.5, letterSpacing: 1.2, color: "rgba(200,220,245,0.62)" }}>{children}</Text>;
}

function Reveal({ t, a, b, children }: { t: SharedValue<number>; a: number; b: number; children: ReactNode }) {
  const s = useAnimatedStyle(() => {
    const v = reveal(t.get(), a, b);
    return { opacity: v, transform: [{ translateY: (1 - v) * 6 }] };
  });
  return <Animated.View style={s}>{children}</Animated.View>;
}

/** A string typed out as the scene runs, between `a` and `b`. */
function useTypedBy(t: SharedValue<number>, text: string, a: number, b: number) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      const v = clamp01((t.get() - a) / (b - a));
      setN(Math.round(v * text.length));
    }, 45);
    return () => clearInterval(id);
  }, [t, text, a, b]);
  return text.slice(0, n);
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

function Big({ children }: { children: ReactNode }) {
  return <Text style={{ marginTop: 6, fontSize: 24, fontWeight: "800", letterSpacing: -0.6, color: "#fff", fontVariant: ["tabular-nums"] }}>{children}</Text>;
}
function Small({ children }: { children: ReactNode }) {
  return (
    <Text numberOfLines={1} style={{ marginTop: 4, fontSize: 12.5, color: INK.soft }}>
      {children}
    </Text>
  );
}

function Row({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View style={{ flex: 1, minWidth: 0 }}>{left}</View>
      <View style={{ width: 74, height: 74, alignItems: "center", justifyContent: "center" }}>{right}</View>
    </View>
  );
}

function VoiceDemo({ t }: { t: SharedValue<number> }) {
  const said = useTypedBy(t, "“almoço 32 no débito”", 0.16, 0.48);
  return (
    <Row
      left={
        <>
          <Tag>OUVINDO</Tag>
          <Text numberOfLines={1} style={{ marginTop: 6, fontSize: 17, fontWeight: "700", color: "#fff" }}>
            {said}
          </Text>
          <Reveal t={t} a={0.55} b={0.66}>
            <Small>→ R$ 32,00 · Alimentação · Débito</Small>
          </Reveal>
        </>
      }
      right={<Wave t={t} />}
    />
  );
}

function Wave({ t }: { t: SharedValue<number> }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 3, height: 50 }}>
      {Array.from({ length: 9 }, (_, i) => (
        <WaveBar key={i} i={i} t={t} />
      ))}
    </View>
  );
}

function WaveBar({ i, t }: { i: number; t: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const v = t.get();
    const on = reveal(v, 0.12, 0.18) * (1 - reveal(v, 0.5, 0.58));
    const wob = 0.5 + 0.5 * Math.sin(v * 70 + i * 1.3) * Math.sin(v * 23 + i * 0.7);
    return { height: 6 + on * wob * 40 };
  });
  return <Animated.View style={[{ width: 4, borderRadius: 2, backgroundColor: i % 3 === 1 ? COLD : "#fff" }, style]} />;
}

function QuickDemo({ t }: { t: SharedValue<number> }) {
  const v = useCountBy(t, 18.4, 0.3, 0.52);
  return (
    <Row
      left={
        <>
          <Tag>DOIS TOQUES</Tag>
          <Big>{money(v)}</Big>
          <Reveal t={t} a={0.58} b={0.68}>
            <Small>Transporte · salvo em 1 segundo</Small>
          </Reveal>
        </>
      }
      right={<Taps t={t} />}
    />
  );
}

function Taps({ t }: { t: SharedValue<number> }) {
  return (
    <View style={{ width: 70, height: 70, alignItems: "center", justifyContent: "center" }}>
      <TapRing t={t} at={0.16} />
      <TapRing t={t} at={0.24} />
      <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: "#fff" }} />
    </View>
  );
}

function TapRing({ t, at }: { t: SharedValue<number>; at: number }) {
  const style = useAnimatedStyle(() => {
    const p = clamp01((t.get() - at) / 0.14);
    return { opacity: p > 0 && p < 1 ? 1 - p : 0, transform: [{ scale: 0.4 + p * 1.2 }] };
  });
  return <Animated.View style={[{ position: "absolute", width: 56, height: 56, borderRadius: 28, borderWidth: 1.5, borderColor: COLD }, style]} />;
}

function ReceiptDemo({ t }: { t: SharedValue<number> }) {
  const scan = useAnimatedStyle(() => {
    const p = reveal(t.get(), 0.16, 0.5);
    return { opacity: p > 0 && p < 1 ? 1 : 0, transform: [{ translateY: p * 62 }] };
  });
  return (
    <Row
      left={
        <>
          <Tag>LENDO A FOTO</Tag>
          <Reveal t={t} a={0.48} b={0.58}>
            <Big>R$ 127,90</Big>
          </Reveal>
          <Reveal t={t} a={0.58} b={0.68}>
            <Small>Supermercado · Mercado · 5 itens</Small>
          </Reveal>
        </>
      }
      right={
        <View style={{ width: 52, height: 70, borderRadius: 6, backgroundColor: "rgba(236,238,242,0.9)", padding: 7, gap: 5, overflow: "hidden" }}>
          {[0.9, 0.6, 0.75, 0.5, 0.7, 0.85].map((wid, k) => (
            <View key={k} style={{ height: 3, width: `${wid * 100}%`, borderRadius: 2, backgroundColor: k === 5 ? "#1E2025" : "rgba(40,44,52,0.45)" }} />
          ))}
          <Animated.View style={[{ position: "absolute", left: 0, right: 0, top: 0, height: 8 }, scan]}>
            <Fade colors={["rgba(111,168,232,0)", "rgba(111,168,232,0.85)", "rgba(111,168,232,0)"]} style={{ flex: 1 }} />
          </Animated.View>
        </View>
      }
    />
  );
}

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function RadarDemo({ t }: { t: SharedValue<number> }) {
  const R = 30;
  const L = Math.PI * R;
  const score = useCountBy(t, 78, 0.16, 0.5);
  const arc = useAnimatedProps(() => ({ strokeDashoffset: L * (1 - 0.78 * reveal(t.get(), 0.16, 0.5)) }));
  return (
    <Row
      left={
        <>
          <Tag>SAÚDE FINANCEIRA</Tag>
          <Big>{Math.round(score)} · boa</Big>
          <Reveal t={t} a={0.56} b={0.66}>
            <Small>Mercado 34% · Transporte 18%</Small>
          </Reveal>
        </>
      }
      right={
        <Svg width={2 * R + 12} height={R + 14}>
          <Defs>
            <LinearGradient id="g" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={COLD} />
              <Stop offset="1" stopColor="#FFFFFF" />
            </LinearGradient>
          </Defs>
          <Path d={`M 6 ${R + 8} A ${R} ${R} 0 0 1 ${2 * R + 6} ${R + 8}`} stroke="rgba(255,255,255,0.12)" strokeWidth={7} strokeLinecap="round" fill="none" />
          <AnimatedPath
            d={`M 6 ${R + 8} A ${R} ${R} 0 0 1 ${2 * R + 6} ${R + 8}`}
            stroke="url(#g)"
            strokeWidth={7}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${L} ${L}`}
            animatedProps={arc}
          />
        </Svg>
      }
    />
  );
}

function ForecastDemo({ t }: { t: SharedValue<number> }) {
  const v = useCountBy(t, 893, 0.2, 0.5);
  const pts = [0, 14, 9, 24, 20, 32, 28, 40, 47, 44, 54];
  const W = 70;
  const H = 46;
  const d = pts.map((p, k) => `${k === 0 ? "M" : "L"} ${(k / (pts.length - 1)) * W} ${4 + (p / 54) * (H - 8)}`).join(" ");
  const D = 220;
  const draw = useAnimatedProps(() => ({ strokeDashoffset: D * (1 - reveal(t.get(), 0.14, 0.5)) }));
  const dot = useAnimatedProps(() => ({ opacity: reveal(t.get(), 0.48, 0.55) }));
  return (
    <Row
      left={
        <>
          <Tag>FIM DO MÊS</Tag>
          <Big>{money(v)}</Big>
          <Reveal t={t} a={0.56} b={0.66}>
            <Small>Luz vence em 3 dias</Small>
          </Reveal>
        </>
      }
      right={
        <Svg width={W + 6} height={H}>
          <AnimatedPath d={d} stroke="#FFFFFF" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" fill="none" strokeDasharray={`${D} ${D}`} animatedProps={draw} />
          <AnimatedCircle cx={W} cy={H - 4} r={3.5} fill={COLD} animatedProps={dot} />
        </Svg>
      }
    />
  );
}

function ChatDemo({ t }: { t: SharedValue<number> }) {
  const asked = useTypedBy(t, "“Posso gastar R$ 200?”", 0.14, 0.36);
  return (
    <Row
      left={
        <>
          <Tag>CONVERSA</Tag>
          <Text numberOfLines={1} style={{ marginTop: 6, fontSize: 17, fontWeight: "700", color: "#fff" }}>
            {asked}
          </Text>
          <Reveal t={t} a={0.5} b={0.6}>
            <Small>Pode. Sobram R$ 540 até o dia 30.</Small>
          </Reveal>
        </>
      }
      right={<Dots t={t} />}
    />
  );
}

function Dots({ t }: { t: SharedValue<number> }) {
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {[0, 1, 2].map((k) => (
        <ChatDot key={k} k={k} t={t} />
      ))}
    </View>
  );
}

function ChatDot({ k, t }: { k: number; t: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const v = t.get();
    const on = reveal(v, 0.36, 0.4) * (1 - reveal(v, 0.48, 0.52));
    const b = 0.5 + 0.5 * Math.sin(v * 40 - k * 1.2);
    return { opacity: on > 0 ? 0.3 + 0.7 * b : 0.3, transform: [{ translateY: -on * b * 4 }] };
  });
  return <Animated.View style={[{ width: 9, height: 9, borderRadius: 5, backgroundColor: "#fff" }, style]} />;
}
