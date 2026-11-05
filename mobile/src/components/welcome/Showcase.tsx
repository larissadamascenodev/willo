import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, Text, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { LinearGradient as Fade } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import WilloBot from "~/components/willo/WilloBot";
import type { OrbMode } from "~/components/registro/ParticleOrb";
import { Bell, Camera, Check, Mic, Receipt, Sparkles } from "~/components/icons";
import { INK } from "~/theme/tokens";
import { isIntroDone, onIntroDone } from "~/lib/launchIntro";

/**
 * A taste of the app before there is an account: six short scenes, each one thing the
 * app really does, played one after another on the welcome screen.
 *
 * Each scene is a small piece of the app acting itself out — Willo listening and a
 * spoken expense becoming an entry; two taps opening Registro rápido; a receipt read
 * from a photo; the Radar filling; the month's forecast drawing itself; a question
 * answered with numbers — under a line that says what it is. They advance on their
 * own like stories; a tap on the right goes on, on the left goes back, and holding
 * pauses. The figures are an example, the same in every scene.
 *
 * Everything is drawn in the app's own parts and colours — the dark glass, white, the
 * cold blue, grey — so what someone sees here is what they will find inside.
 */

const SCENE_MS = 5600;
const COLD = "#6FA8E8";
const PANEL = "rgba(24,26,31,0.82)";
const PANEL_SOFT = "rgba(255,255,255,0.06)";
/** The scenes are laid out in this box and scaled to the room the screen has. */
const BOX_W = 340;
const BOX_H = 370;

interface Scene {
  kicker: string;
  title: string;
  line: string;
  label: string;
  Stage: () => ReactNode;
}

const SCENES: Scene[] = [
  {
    kicker: "POR VOZ",
    title: "Fale o gasto.\nO Willo anota.",
    line: "Segure o Willo e diga do seu jeito:\nele entende valor, categoria e conta.",
    label: "Exemplo: a pessoa segura o Willo, diz almoço 32 no débito e o gasto aparece registrado.",
    Stage: VoiceScene,
  },
  {
    kicker: "REGISTRO RÁPIDO",
    title: "Dois toques,\num gasto salvo.",
    line: "Toque duas vezes no Willo e registre\nem segundos, sem procurar menu.",
    label: "Exemplo: dois toques no Willo abrem o registro rápido e um gasto de 18 reais e 40 é salvo.",
    Stage: QuickScene,
  },
  {
    kicker: "FOTO DO COMPROVANTE",
    title: "Fotografe.\nEle lê por você.",
    line: "Valor, local e categoria saem da foto\ndireto para o seu registro.",
    label: "Exemplo: a foto de um cupom de supermercado vira um gasto de 127 reais e 90.",
    Stage: ReceiptScene,
  },
  {
    kicker: "RADAR FINANCEIRO",
    title: "Veja para onde\nvai cada real.",
    line: "Consumo, hábitos e o que está fora\ndo normal, tudo num só lugar.",
    label: "Exemplo: o Radar mostra a saúde financeira em 78 e os gastos por categoria.",
    Stage: RadarScene,
  },
  {
    kicker: "PREVISÃO",
    title: "Saiba antes como\no mês termina.",
    line: "O Willo soma o que vem pela frente\ne avisa antes de cada conta vencer.",
    label: "Exemplo: o saldo previsto para o fim do mês e o aviso de uma conta de luz que vence em 3 dias.",
    Stage: ForecastScene,
  },
  {
    kicker: "CONVERSA",
    title: "Pergunte. Ele responde\ncom os seus números.",
    line: "Planeje o fim de semana, a viagem\ne a fatura só conversando.",
    label: "Exemplo: a pessoa pergunta se pode gastar 200 no fim de semana e o Willo responde que sobram 540 reais até o dia 30.",
    Stage: ChatScene,
  },
];

/* ------------------------------------------------------------------ */
/* The player                                                          */
/* ------------------------------------------------------------------ */

export default function Showcase() {
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState({ w: BOX_W, h: BOX_H });
  const progress = useSharedValue(0);
  const held = useRef(false);

  const go = useCallback((to: number) => {
    setIndex((to + SCENES.length) % SCENES.length);
  }, []);
  const next = useCallback(() => setIndex((i) => (i + 1) % SCENES.length), []);

  const run = useCallback(() => {
    const left = Math.max(0, 1 - progress.get()) * SCENE_MS;
    progress.set(
      withTiming(1, { duration: left, easing: Easing.linear }, (done) => {
        if (done) runOnJS(next)();
      }),
    );
  }, [progress, next]);

  /* Nothing plays under the opening animation: the first scene waits for it. */
  const [ready, setReady] = useState(isIntroDone());
  useEffect(() => onIntroDone(() => setReady(true)), []);

  useEffect(() => {
    if (!ready) return;
    cancelAnimation(progress);
    progress.set(0);
    if (!held.current) run();
  }, [index, progress, run, ready]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox({ w: width, h: height });
  };
  const scale = Math.min(1, box.w / BOX_W, box.h / BOX_H);
  const scene = SCENES[index];
  const { Stage } = scene;

  return (
    <View style={{ flex: 1 }}>
      <Pressable
        onLayout={onLayout}
        accessibilityRole="adjustable"
        accessibilityLabel={`${scene.kicker.toLowerCase()}. ${scene.label}`}
        accessibilityHint="Toque à direita para a próxima, à esquerda para a anterior, segure para pausar."
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(e) => go(index + (e.nativeEvent.actionName === "increment" ? 1 : -1))}
        onPressIn={() => {
          held.current = true;
          cancelAnimation(progress);
        }}
        onPressOut={() => {
          held.current = false;
          if (ready) run();
        }}
        delayLongPress={280}
        onLongPress={() => undefined}
        onPress={(e) => {
          void Haptics.selectionAsync().catch(() => undefined);
          go(index + (e.nativeEvent.locationX < box.w * 0.32 ? -1 : 1));
        }}
        style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
      >
        <View pointerEvents="none" style={{ width: BOX_W, height: BOX_H, transform: [{ scale }] }}>
          {ready && (
            <Animated.View key={index} entering={FadeIn.duration(260)} exiting={FadeOut.duration(180)} style={{ flex: 1 }}>
              <Stage />
            </Animated.View>
          )}
        </View>
      </Pressable>

      <Segments index={index} progress={progress} onPick={go} />

      <Animated.View key={`c${index}`} entering={FadeInDown.duration(420)} style={{ marginTop: 18 }}>
        <Text style={{ fontSize: 12, fontWeight: "700", letterSpacing: 1.4, color: INK.softer }}>{scene.kicker}</Text>
        <Text
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          style={{ marginTop: 8, fontSize: 30, fontWeight: "800", letterSpacing: -1, lineHeight: 34, color: "#fff" }}
        >
          {scene.title}
        </Text>
        {/* Two lines, broken by hand where the sentence breathes, and told to shrink a
            little rather than wrap to a third and leave a word alone on it. */}
        <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.86} style={{ marginTop: 10, fontSize: 15.5, lineHeight: 22, color: INK.soft }}>
          {scene.line}
        </Text>
      </Animated.View>
    </View>
  );
}

function Segments({ index, progress, onPick }: { index: number; progress: SharedValue<number>; onPick: (i: number) => void }) {
  return (
    <View style={{ flexDirection: "row", gap: 6, marginTop: 14 }}>
      {SCENES.map((s, i) => (
        <Pressable
          key={s.kicker}
          onPress={() => onPick(i)}
          hitSlop={{ top: 12, bottom: 12 }}
          accessibilityRole="button"
          accessibilityLabel={`${i + 1} de ${SCENES.length}: ${s.kicker.toLowerCase()}`}
          style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.16)", overflow: "hidden" }}
        >
          {i < index && <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.86)" }} />}
          {i === index && <Fill progress={progress} />}
        </Pressable>
      ))}
    </View>
  );
}

function Fill({ progress }: { progress: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({ width: `${progress.get() * 100}%` }));
  return <Animated.View style={[{ height: "100%", backgroundColor: "#fff" }, style]} />;
}

/* ------------------------------------------------------------------ */
/* Little helpers the scenes share                                     */
/* ------------------------------------------------------------------ */

function money(v: number) {
  const [int, dec] = v.toFixed(2).split(".");
  return `R$ ${int.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${dec}`;
}

/** Characters of `text` shown so far, typed from `start` ms. */
function useTyped(text: string, start: number, every = 42) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let tick: ReturnType<typeof setInterval> | undefined;
    const begin = setTimeout(() => {
      let i = 0;
      tick = setInterval(() => {
        i += 1;
        setN(i);
        if (i >= text.length && tick) clearInterval(tick);
      }, every);
    }, start);
    return () => {
      clearTimeout(begin);
      if (tick) clearInterval(tick);
    };
  }, [text, start, every]);
  return text.slice(0, n);
}

/** A number counting up to `to` from `start` ms, over `length` ms. */
function useCount(to: number, start: number, length = 700) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let tick: ReturnType<typeof setInterval> | undefined;
    const begin = setTimeout(() => {
      const t0 = Date.now();
      tick = setInterval(() => {
        const p = Math.min(1, (Date.now() - t0) / length);
        const e = 1 - (1 - p) ** 3;
        setV(to * e);
        if (p >= 1 && tick) clearInterval(tick);
      }, 30);
    }, start);
    return () => {
      clearTimeout(begin);
      if (tick) clearInterval(tick);
    };
  }, [to, start, length]);
  return v;
}

/** True from `at` ms on. */
function useAfter(at: number) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setOn(true), at);
    return () => clearTimeout(id);
  }, [at]);
  return on;
}

function Rise({ delay, children, from = "down" }: { delay: number; children: ReactNode; from?: "down" | "up" }) {
  const reduce = useReducedMotion();
  const e = (from === "down" ? FadeInDown : FadeInUp).delay(reduce ? 0 : delay).duration(reduce ? 1 : 460);
  return <Animated.View entering={e}>{children}</Animated.View>;
}

function Panel({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[{ backgroundColor: PANEL, borderRadius: 22, borderCurve: "continuous", padding: 16 }, style]}>{children}</View>;
}

function Bubble({ children, mine }: { children: ReactNode; mine?: boolean }) {
  return (
    <View
      style={{
        alignSelf: mine ? "flex-end" : "flex-start",
        maxWidth: "86%",
        paddingHorizontal: 16,
        paddingVertical: 11,
        borderRadius: 20,
        borderCurve: "continuous",
        borderBottomRightRadius: mine ? 6 : 20,
        borderBottomLeftRadius: mine ? 20 : 6,
        backgroundColor: mine ? "rgba(255,255,255,0.92)" : PANEL,
      }}
    >
      {children}
    </View>
  );
}

function Dot({ children, tone = "soft" }: { children: ReactNode; tone?: "soft" | "cold" }) {
  return (
    <View
      style={{
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: tone === "cold" ? "rgba(111,168,232,0.18)" : PANEL_SOFT,
      }}
    >
      {children}
    </View>
  );
}

/** An entry as the app shows it: what, where it went, and how much. */
function EntryRow({ title, detail, amount, icon }: { title: string; detail: string; amount: string; icon: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Dot>{icon}</Dot>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: "700", color: "#fff" }}>
          {title}
        </Text>
        <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 13, color: INK.softer }}>
          {detail}
        </Text>
      </View>
      <Text style={{ fontSize: 16, fontWeight: "700", color: "#fff", fontVariant: ["tabular-nums"] }}>{amount}</Text>
    </View>
  );
}

function Done({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 }}>
      <View style={{ width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(111,168,232,0.22)" }}>
        <Check size={13} color={COLD} strokeWidth={3} />
      </View>
      <Text style={{ fontSize: 13.5, fontWeight: "600", color: INK.soft }}>{text}</Text>
    </View>
  );
}

/** Rings that leave Willo: listening, or the two taps. */
function Rings({ size, count, every, start = 0, repeat = true }: { size: number; count: number; every: number; start?: number; repeat?: boolean }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <Ring key={i} size={size} delay={start + i * every} repeat={repeat} period={every * count} />
      ))}
    </>
  );
}

function Ring({ size, delay, repeat, period }: { size: number; delay: number; repeat: boolean; period: number }) {
  const p = useSharedValue(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) return;
    const once = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
    p.set(
      withDelay(
        delay,
        repeat ? withRepeat(withSequence(withTiming(0, { duration: 0 }), once, withTiming(1, { duration: Math.max(0, period - 900) })), -1) : once,
      ),
    );
  }, [p, delay, repeat, period, reduce]);
  const style = useAnimatedStyle(() => ({
    opacity: p.get() > 0 && p.get() < 1 ? 0.55 * (1 - p.get()) : 0,
    transform: [{ scale: 0.7 + p.get() * 0.9 }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: "absolute", width: size, height: size, borderRadius: size / 2, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.9)" },
        style,
      ]}
    />
  );
}

/** Willo, with a mode that changes on a schedule. */
function Actor({ size, plan }: { size: number; plan: [number, OrbMode][] }) {
  const [mode, setMode] = useState<OrbMode>(plan[0][1]);
  useEffect(() => {
    const ids = plan.slice(1).map(([at, m]) => setTimeout(() => setMode(m), at));
    return () => ids.forEach(clearTimeout);
  }, [plan]);
  return <WilloBot size={size} mode={mode} />;
}

/* ------------------------------------------------------------------ */
/* The scenes                                                          */
/* ------------------------------------------------------------------ */

const VOICE_PLAN: [number, OrbMode][] = [
  [0, "listening"],
  [2300, "thinking"],
  [2900, "speaking"],
  [4200, "idle"],
];

function VoiceScene() {
  const said = useTyped("almoço 32 no débito", 600, 55);
  const heard = useAfter(2300);
  return (
    <View style={{ flex: 1, justifyContent: "space-between", paddingVertical: 6 }}>
      <View style={{ gap: 12 }}>
        <Rise delay={350}>
          <Bubble mine>
            <Text style={{ fontSize: 16.5, fontWeight: "600", color: "#0B0B0D" }}>
              {said}
              {!heard && <Text style={{ color: "rgba(11,11,13,0.35)" }}>|</Text>}
            </Text>
          </Bubble>
        </Rise>
        {heard && (
          <Rise delay={500}>
            <Panel>
              <EntryRow title="Almoço" detail="Alimentação · Débito · hoje" amount="R$ 32,00" icon={<Receipt size={18} color="#fff" strokeWidth={2} />} />
              <Done text="Anotado, sem digitar nada" />
            </Panel>
          </Rise>
        )}
      </View>
      <View style={{ alignItems: "center", gap: 10 }}>
        <View style={{ width: 130, height: 130, alignItems: "center", justifyContent: "center" }}>
          {!heard && <Rings size={118} count={3} every={520} />}
          <Actor size={100} plan={VOICE_PLAN} />
        </View>
        <Hint icon={<Mic size={14} color="#fff" strokeWidth={2.2} />} text={heard ? "Pronto" : "Segurando para falar"} />
      </View>
    </View>
  );
}

function Hint({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 13, height: 30, borderRadius: 15, backgroundColor: PANEL_SOFT }}>
      {icon}
      <Text style={{ fontSize: 13, fontWeight: "600", color: INK.soft }}>{text}</Text>
    </View>
  );
}

const QUICK_PLAN: [number, OrbMode][] = [
  [0, "idle"],
  [3600, "speaking"],
  [4600, "idle"],
];

function QuickScene() {
  const amount = useCount(18.4, 1500, 800);
  const open = useAfter(1050);
  const saved = useAfter(3300);
  const chips = ["Transporte", "Mercado", "Lazer"];
  return (
    <View style={{ flex: 1, alignItems: "center", paddingTop: 4 }}>
      <View style={{ width: 150, height: 150, alignItems: "center", justifyContent: "center" }}>
        <Rings size={120} count={2} every={230} start={350} repeat={false} />
        <Actor size={100} plan={QUICK_PLAN} />
        <TapMark at={350} />
        <TapMark at={580} />
      </View>
      {open && (
        <Rise delay={0}>
          <Panel style={{ width: BOX_W, marginTop: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: INK.softer }}>Registro rápido</Text>
            <Text style={{ marginTop: 6, fontSize: 40, fontWeight: "800", letterSpacing: -1.4, color: "#fff", fontVariant: ["tabular-nums"] }}>
              {money(amount)}
            </Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              {chips.map((c, i) => (
                <View
                  key={c}
                  style={{
                    paddingHorizontal: 13,
                    height: 32,
                    borderRadius: 16,
                    justifyContent: "center",
                    backgroundColor: i === 0 ? "#fff" : PANEL_SOFT,
                  }}
                >
                  <Text style={{ fontSize: 13.5, fontWeight: "600", color: i === 0 ? "#0B0B0D" : INK.soft }}>{c}</Text>
                </View>
              ))}
            </View>
            {saved ? <Done text="Salvo em Transporte" /> : <View style={{ height: 34 }} />}
          </Panel>
        </Rise>
      )}
    </View>
  );
}

/** A fingertip's touch on Willo. */
function TapMark({ at }: { at: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(withDelay(at, withSequence(withTiming(1, { duration: 90 }), withTiming(0, { duration: 260 }))));
  }, [p, at]);
  const style = useAnimatedStyle(() => ({ opacity: p.get() * 0.9, transform: [{ scale: 0.6 + p.get() * 0.4 }] }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: "absolute", width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.45)", top: 64, left: 58 }, style]}
    />
  );
}

function ReceiptScene() {
  const read = useAfter(2500);
  const scan = useSharedValue(0);
  useEffect(() => {
    scan.set(withDelay(500, withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }), 2, true)));
  }, [scan]);
  const line = useAnimatedStyle(() => ({ opacity: scan.get() > 0 && scan.get() < 1 ? 1 : 0.0, transform: [{ translateY: scan.get() * 196 }] }));
  const items: [string, string][] = [
    ["ARROZ 5KG", "24,90"],
    ["CAFE 500G", "18,40"],
    ["LEITE 1L X6", "35,94"],
    ["FRUTAS", "28,76"],
    ["PAO", "19,90"],
  ];
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Rise delay={150}>
        <View style={{ width: 220, alignItems: "center" }}>
          <View style={{ width: 208, borderRadius: 14, backgroundColor: "rgba(236,238,242,0.94)", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14, overflow: "hidden" }}>
            <Text style={{ fontSize: 11, fontWeight: "800", letterSpacing: 0.6, color: "#2A2C31", textAlign: "center" }}>SUPERMERCADO BOA COMPRA</Text>
            <Text style={{ marginTop: 2, fontSize: 9.5, color: "#6A6E76", textAlign: "center" }}>05/11 · 18:42</Text>
            <View style={{ height: 1, marginVertical: 10, borderTopWidth: 1, borderStyle: "dashed", borderColor: "#B9BDC5" }} />
            {items.map(([n, v]) => (
              <View key={n} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 5 }}>
                <Text style={{ fontSize: 10.5, color: "#3B3E45" }}>{n}</Text>
                <Text style={{ fontSize: 10.5, color: "#3B3E45", fontVariant: ["tabular-nums"] }}>{v}</Text>
              </View>
            ))}
            <View style={{ height: 1, marginVertical: 8, borderTopWidth: 1, borderStyle: "dashed", borderColor: "#B9BDC5" }} />
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 12, fontWeight: "800", color: "#1E2025" }}>TOTAL</Text>
              <Text style={{ fontSize: 12, fontWeight: "800", color: "#1E2025" }}>R$ 127,90</Text>
            </View>
            <Animated.View pointerEvents="none" style={[{ position: "absolute", left: 0, right: 0, top: 8, height: 26 }, line]}>
              <Fade colors={["rgba(111,168,232,0)", "rgba(111,168,232,0.55)", "rgba(111,168,232,0)"]} style={{ flex: 1 }} />
            </Animated.View>
          </View>
          <Corners />
        </View>
      </Rise>
      {read && (
        <Rise delay={0}>
          <Panel style={{ width: BOX_W, marginTop: -26 }}>
            <EntryRow title="Supermercado" detail="Mercado · Débito · 5 itens" amount="R$ 127,90" icon={<Camera size={18} color="#fff" strokeWidth={2} />} />
            <Done text="Lido da foto, é só conferir" />
          </Panel>
        </Rise>
      )}
    </View>
  );
}

/** The camera's frame around the receipt. */
function Corners() {
  const c = { position: "absolute" as const, width: 22, height: 22, borderColor: "rgba(255,255,255,0.85)" };
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: -2, right: -2, top: -10, bottom: -10 }}>
      <View style={[c, { left: 0, top: 0, borderLeftWidth: 2.5, borderTopWidth: 2.5, borderTopLeftRadius: 8 }]} />
      <View style={[c, { right: 0, top: 0, borderRightWidth: 2.5, borderTopWidth: 2.5, borderTopRightRadius: 8 }]} />
      <View style={[c, { left: 0, bottom: 0, borderLeftWidth: 2.5, borderBottomWidth: 2.5, borderBottomLeftRadius: 8 }]} />
      <View style={[c, { right: 0, bottom: 0, borderRightWidth: 2.5, borderBottomWidth: 2.5, borderBottomRightRadius: 8 }]} />
    </View>
  );
}

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function RadarScene() {
  const R = 92;
  const L = Math.PI * R;
  const fill = useSharedValue(0);
  useEffect(() => {
    fill.set(withDelay(300, withTiming(0.78, { duration: 1400, easing: Easing.out(Easing.cubic) })));
  }, [fill]);
  const arc = useAnimatedProps(() => ({ strokeDashoffset: L * (1 - fill.get()) }));
  const score = useCount(78, 300, 1400);
  const rows: [string, number, string][] = [
    ["Mercado", 0.34, "#FFFFFF"],
    ["Transporte", 0.18, COLD],
    ["Lazer", 0.12, "rgba(255,255,255,0.42)"],
  ];
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <View style={{ width: 2 * R + 30, height: R + 30, alignItems: "center" }}>
        <Svg width={2 * R + 30} height={R + 30}>
          <Defs>
            <LinearGradient id="gauge" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={COLD} />
              <Stop offset="1" stopColor="#FFFFFF" />
            </LinearGradient>
          </Defs>
          <Path d={`M 15 ${R + 15} A ${R} ${R} 0 0 1 ${2 * R + 15} ${R + 15}`} stroke="rgba(255,255,255,0.1)" strokeWidth={14} strokeLinecap="round" fill="none" />
          <AnimatedPath
            d={`M 15 ${R + 15} A ${R} ${R} 0 0 1 ${2 * R + 15} ${R + 15}`}
            stroke="url(#gauge)"
            strokeWidth={14}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${L} ${L}`}
            animatedProps={arc}
          />
        </Svg>
        <View style={{ position: "absolute", bottom: 6, alignItems: "center" }}>
          <Text style={{ fontSize: 46, fontWeight: "800", letterSpacing: -1.5, color: "#fff", fontVariant: ["tabular-nums"] }}>{Math.round(score)}</Text>
          <Text style={{ marginTop: -4, fontSize: 13, fontWeight: "600", color: INK.softer }}>Saúde financeira boa</Text>
        </View>
      </View>
      <Rise delay={900}>
        <Panel style={{ width: BOX_W, marginTop: 18, gap: 14 }}>
          {rows.map(([name, share, color], i) => (
            <Bar key={name} name={name} share={share} color={color} delay={1100 + i * 160} />
          ))}
        </Panel>
      </Rise>
    </View>
  );
}

function Bar({ name, share, color, delay }: { name: string; share: number; color: string; delay: number }) {
  const w = useSharedValue(0);
  useEffect(() => {
    w.set(withDelay(delay, withTiming(share, { duration: 900, easing: Easing.out(Easing.cubic) })));
  }, [w, share, delay]);
  const style = useAnimatedStyle(() => ({ width: `${(w.get() / 0.4) * 100}%` }));
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Text style={{ width: 86, fontSize: 14, fontWeight: "600", color: "#fff" }}>{name}</Text>
      <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
        <Animated.View style={[{ height: "100%", borderRadius: 4, backgroundColor: color }, style]} />
      </View>
      <Text style={{ width: 38, textAlign: "right", fontSize: 13.5, fontWeight: "600", color: INK.soft, fontVariant: ["tabular-nums"] }}>
        {Math.round(share * 100)}%
      </Text>
    </View>
  );
}

function ForecastScene() {
  const W = BOX_W;
  const H = 150;
  /* A month: falling with each bill, a payday in the middle; today is the 18th. */
  const days = 30;
  const today = 17;
  const values: number[] = [];
  let v = 2600;
  for (let d = 0; d < days; d++) {
    if (d === 5) v += 1850;
    if ([2, 9, 14, 21, 26].includes(d)) v -= 420;
    v -= 38 + ((d * 37) % 23);
    values.push(v);
  }
  const lo = Math.min(...values) - 200;
  const hi = Math.max(...values) + 200;
  const x = (d: number) => 6 + (d / (days - 1)) * (W - 12);
  const y = (val: number) => 8 + (1 - (val - lo) / (hi - lo)) * (H - 16);
  const path = (from: number, to: number) =>
    values
      .slice(from, to + 1)
      .map((val, i) => `${i === 0 ? "M" : "L"} ${x(from + i).toFixed(1)} ${y(val).toFixed(1)}`)
      .join(" ");
  const past = path(0, today);
  const ahead = path(today, days - 1);
  const end = values[days - 1];

  const draw = useSharedValue(0);
  const later = useSharedValue(0);
  useEffect(() => {
    draw.set(withDelay(250, withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.cubic) })));
    later.set(withDelay(1500, withTiming(1, { duration: 700 })));
  }, [draw, later]);
  const D = 1600;
  const pastProps = useAnimatedProps(() => ({ strokeDashoffset: D * (1 - draw.get()) }));
  const aheadProps = useAnimatedProps(() => ({ opacity: later.get() }));
  const dotProps = useAnimatedProps(() => ({ opacity: later.get() }));
  const total = useCount(end, 1500, 900);
  const warned = useAfter(2900);

  return (
    <View style={{ flex: 1 }}>
      <Rise delay={100}>
        <Text style={{ fontSize: 13, fontWeight: "600", color: INK.softer }}>Previsto no fim do mês</Text>
        <Text style={{ marginTop: 4, fontSize: 38, fontWeight: "800", letterSpacing: -1.3, color: "#fff", fontVariant: ["tabular-nums"] }}>{money(total)}</Text>
      </Rise>
      <View style={{ marginTop: 12 }}>
        <Svg width={W} height={H}>
          <AnimatedPath d={past} stroke="#FFFFFF" strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" fill="none" strokeDasharray={`${D} ${D}`} animatedProps={pastProps} />
          <AnimatedPath d={ahead} stroke={COLD} strokeWidth={2.4} strokeDasharray="5 6" strokeLinecap="round" fill="none" animatedProps={aheadProps} />
          <AnimatedCircle cx={x(today)} cy={y(values[today])} r={5.5} fill="#fff" animatedProps={dotProps} />
          <AnimatedCircle cx={x(days - 1)} cy={y(end)} r={4.5} fill={COLD} animatedProps={dotProps} />
        </Svg>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
          <Text style={{ fontSize: 12, color: INK.faint }}>1 nov</Text>
          <Text style={{ fontSize: 12, color: INK.soft, fontWeight: "600" }}>hoje</Text>
          <Text style={{ fontSize: 12, color: INK.faint }}>30 nov</Text>
        </View>
      </View>
      {warned && (
        <Rise delay={0}>
          <Panel style={{ marginTop: 16, paddingVertical: 13 }}>
            <EntryRow title="Conta de luz" detail="Vence em 3 dias" amount="R$ 142,00" icon={<Bell size={17} color="#fff" strokeWidth={2} />} />
          </Panel>
        </Rise>
      )}
    </View>
  );
}

const CHAT_PLAN: [number, OrbMode][] = [
  [0, "idle"],
  [1000, "thinking"],
  [1900, "speaking"],
  [3900, "idle"],
];

function ChatScene() {
  const answering = useAfter(1900);
  const answer = useTyped("Pode, sim. Depois disso ainda sobram R$ 540 até o dia 30, já contando a fatura.", 2000, 28);
  const ideas = useAfter(4300);
  return (
    <View style={{ flex: 1, justifyContent: "space-between", paddingVertical: 6 }}>
      <View style={{ gap: 12 }}>
        <Rise delay={250}>
          <Bubble mine>
            <Text style={{ fontSize: 16, fontWeight: "600", color: "#0B0B0D" }}>Posso gastar R$ 200 no fim de semana?</Text>
          </Bubble>
        </Rise>
        <Rise delay={900}>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10 }}>
            <View style={{ width: 58, height: 58, alignItems: "center", justifyContent: "center" }}>
              <Actor size={58} plan={CHAT_PLAN} />
            </View>
            <View style={{ flex: 1 }}>
              <Bubble>
                {answering ? (
                  <Text style={{ fontSize: 15.5, lineHeight: 21, color: "#fff" }}>{answer}</Text>
                ) : (
                  <Typing />
                )}
              </Bubble>
            </View>
          </View>
        </Rise>
      </View>
      {ideas && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {["E se eu jantar fora?", "Quanto vai a fatura?"].map((q, i) => (
            <Rise key={q} delay={i * 120}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, height: 36, borderRadius: 18, backgroundColor: PANEL_SOFT }}>
                <Sparkles size={13} color={INK.soft} strokeWidth={2} />
                <Text style={{ fontSize: 13.5, fontWeight: "600", color: INK.soft }}>{q}</Text>
              </View>
            </Rise>
          ))}
        </View>
      )}
    </View>
  );
}

function Typing() {
  return (
    <View style={{ flexDirection: "row", gap: 5, paddingVertical: 6 }}>
      {[0, 1, 2].map((i) => (
        <TypingDot key={i} delay={i * 150} />
      ))}
    </View>
  );
}

function TypingDot({ delay }: { delay: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 300 }), withTiming(0, { duration: 300 })), -1)));
  }, [p, delay]);
  const style = useAnimatedStyle(() => ({ opacity: 0.35 + p.get() * 0.65, transform: [{ translateY: -p.get() * 3 }] }));
  return <Animated.View style={[{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#fff" }, style]} />;
}
