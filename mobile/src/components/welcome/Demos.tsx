import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Polygon, Rect, Stop } from "react-native-svg";
import { LinearGradient as Fade } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import WilloBot from "~/components/willo/WilloBot";
import { Scope, type SectorKey, SECTORS } from "~/components/radar/parts";
import { Bell, Camera, Check, Mic, Receipt, Sparkles } from "~/components/icons";
import { INK } from "~/theme/tokens";

/**
 * The welcome's demonstrations, one per slide.
 *
 * Each is a short script that plays once from the start while its slide is showing
 * (`active`) and lasts exactly `DURATIONS[name]`; the slide moves on only after it has
 * finished and held for a moment, so nothing is cut off halfway. Whatever is written
 * down arrives softly — a rise, a brief light across it — and silently: the welcome
 * makes no sound. `ChimeContext` is a hook for one, and plays nothing unless given.
 *
 * Entries show their name, amount and what they are as small tags, never cut. The
 * figures are an example and nothing is saved: there is no account yet. Anything that
 * runs inside an animation is plain arithmetic or a worklet: on the phone a plain
 * function called there closes the app.
 */

export const COLD = "#6FA8E8";
export const ICE = "#DCEBFF";
const PANEL = "rgba(22,24,30,0.92)";

export const ChimeContext = createContext<() => void>(() => undefined);

/* Each ends a moment after its script's last event; the slide then holds briefly. */
export const DURATIONS = {
  notify: 1 * 3600 + 1650 + 1200,
  voice: 1 * 3900 + 300 + 20 * 60 + 500 + 900,
  quick: 2700 + 850 + 10 * 120 + 300 + 1100 + 1000,
  receipt: 3700 + 900,
  radar: 5 * 2900 + 2400,
  forecast: 8200 + 1200,
  ask: 2 * 6600 + 200 + 1300 + 48 * 26 + 300 + 900,
} as const;

export function money(v: number) {
  const neg = v < 0;
  const [int, dec] = Math.abs(v).toFixed(2).split(".");
  return `${neg ? "−" : ""}R$ ${int.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${dec}`;
}

function tap() {
  void Haptics.selectionAsync().catch(() => undefined);
}
function success() {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}
function knockFeel() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
}

/** Timeouts that are all cleared together, and on unmount. */
function useLater() {
  const ids = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => ids.current.forEach(clearTimeout), []);
  return {
    at: (ms: number, run: () => void) => {
      ids.current.push(setTimeout(run, ms));
    },
    clear: () => {
      ids.current.forEach(clearTimeout);
      ids.current = [];
    },
  };
}

/** Runs `script` each time `active` becomes true; clears it when it stops. */
function useScript(active: boolean, script: (at: (ms: number, run: () => void) => void) => void, reset: () => void) {
  const later = useLater();
  useEffect(() => {
    later.clear();
    reset();
    if (active) script(later.at);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}

function useTyping(text: string, run: number, every = 55) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    if (run <= 0) return;
    let k = 0;
    const id = setInterval(() => {
      k += 1;
      setN(k);
      if (k >= text.length) clearInterval(id);
    }, every);
    return () => clearInterval(id);
  }, [text, run, every]);
  return text.slice(0, n);
}

/** A number that eases from wherever it is to `to`. */
function useEased(to: number, length = 700, start = 0) {
  const [v, setV] = useState(start);
  const now = useRef(start);
  useEffect(() => {
    const from = now.current;
    const t0 = Date.now();
    const id = setInterval(() => {
      const k = Math.min(1, (Date.now() - t0) / length);
      const x = from + (to - from) * (1 - (1 - k) ** 3);
      now.current = x;
      setV(x);
      if (k >= 1) clearInterval(id);
    }, 30);
    return () => clearInterval(id);
  }, [to, length]);
  return v;
}

/** Arrives softly: up a little, fading in. */
function Rise({ on = true, children, delay = 0, from = 14 }: { on?: boolean; children: ReactNode; delay?: number; from?: number }) {
  const p = useSharedValue(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    p.set(on ? (reduce ? 1 : withDelay(delay, withTiming(1, { duration: 620, easing: Easing.bezier(0.16, 1, 0.3, 1) }))) : withTiming(0, { duration: 260 }));
  }, [on, p, delay, reduce]);
  /* Moves and fades, never scales: on the phone, text that is scaling is drawn as a
     picture and looks blurred until it stops. */
  const style = useAnimatedStyle(() => ({ opacity: p.get(), transform: [{ translateY: (1 - p.get()) * from }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

function Chip({ children, strong }: { children: string; strong?: boolean }) {
  return (
    <View style={{ paddingHorizontal: 8, height: 22, borderRadius: 11, justifyContent: "center", backgroundColor: strong ? "rgba(111,168,232,0.2)" : "rgba(255,255,255,0.08)" }}>
      <Text style={{ fontSize: 11.5, fontWeight: "600", color: strong ? ICE : INK.soft }}>{children}</Text>
    </View>
  );
}

/**
 * An entry as the app shows it: what, how much, and its tags. The name may take two
 * lines rather than be cut; a fresh one has a light pass across it as it arrives.
 */
function Entry({ title, amount, tags, fresh, dim, income }: { title: string; amount: string; tags: string[]; fresh?: boolean; dim?: boolean; income?: boolean }) {
  const sweep = useSharedValue(0);
  useEffect(() => {
    if (fresh) sweep.set(withDelay(220, withTiming(1, { duration: 900, easing: Easing.inOut(Easing.cubic) })));
  }, [fresh, sweep]);
  const light = useAnimatedStyle(() => ({ opacity: sweep.get() > 0 && sweep.get() < 1 ? 1 : 0, transform: [{ translateX: -120 + sweep.get() * 520 }, { rotate: "18deg" }] }));
  return (
    <View style={{ borderRadius: 18, overflow: "hidden", opacity: dim ? 0.5 : 1 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 4 }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)" }}>
          <Receipt size={18} color="#fff" strokeWidth={2} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
            <Text numberOfLines={2} style={{ flex: 1, fontSize: 16, lineHeight: 20, fontWeight: "700", color: "#fff" }}>
              {title}
            </Text>
            <Text style={{ fontSize: 16.5, lineHeight: 20, fontWeight: "800", color: "#fff", fontVariant: ["tabular-nums"] }}>
              {income ? "+" : ""}
              {amount}
            </Text>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
            {tags.map((t, i) => (
              <Chip key={t} strong={i === 0}>
                {t}
              </Chip>
            ))}
          </View>
        </View>
      </View>
      <Animated.View pointerEvents="none" style={[{ position: "absolute", top: -30, bottom: -30, width: 60 }, light]}>
        <Fade colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.14)", "rgba(255,255,255,0)"]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
      </Animated.View>
    </View>
  );
}

function Saved({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <View style={{ width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(111,168,232,0.25)" }}>
        <Check size={12} color={ICE} strokeWidth={3} />
      </View>
      <Text style={{ fontSize: 13.5, color: INK.soft }}>{text}</Text>
    </View>
  );
}

function Glass({ children, style }: { children: ReactNode; style?: object }) {
  return (
    <View style={[{ borderRadius: 24, borderCurve: "continuous", overflow: "hidden", backgroundColor: PANEL }, style]}>
      <Fade colors={["rgba(111,168,232,0.12)", "rgba(111,168,232,0)"]} style={{ position: "absolute", left: 0, right: 0, top: 0, height: 110 }} />
      {children}
    </View>
  );
}

function Label({ children }: { children: string }) {
  return <Text style={{ fontFamily: "Menlo", fontSize: 11, letterSpacing: 1.2, color: "rgba(200,220,245,0.7)" }}>{children}</Text>;
}

/* ================================================================== */
/* Willo Copilot: purchases read from the bank's notifications         */
/* ================================================================== */

const PURCHASES = [
  { merchant: "UBER *TRIP", title: "Uber", tags: ["Transporte", "Débito", "agora"], how: "débito", amount: 18.4 },
  { merchant: "SUPERMERCADO BOA COMPRA", title: "Supermercado Boa Compra", tags: ["Mercado", "Débito", "agora"], how: "débito", amount: 127.9 },
];

export function NotifyDemo({ active }: { active: boolean }) {
  const chime = useContext(ChimeContext);
  const [now, setNow] = useState(0);
  const [caught, setCaught] = useState<number[]>([]);
  const drop = useSharedValue(0);
  const fly = useSharedValue(0);

  useScript(
    active,
    (at) => {
      PURCHASES.forEach((_, k) => {
        const t0 = k * 3600;
        at(t0 + 200, () => {
          setNow(k);
          fly.set(0);
          drop.set(withSequence(withTiming(0, { duration: 0 }), withSpring(1, { damping: 16, stiffness: 120 })));
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        });
        at(t0 + 1100, () => fly.set(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.cubic) })));
        at(t0 + 1650, () => {
          setCaught((c) => [k, ...c].slice(0, 2));
          chime();
          success();
        });
      });
    },
    () => {
      setCaught([]);
      drop.set(0);
      fly.set(0);
    },
  );

  const p = PURCHASES[now];
  const banner = useAnimatedStyle(() => ({
    opacity: drop.get() * (1 - fly.get() * 0.8),
    transform: [{ translateY: (1 - drop.get()) * -50 + fly.get() * 26 }, { scale: 1 - fly.get() * 0.1 }],
  }));
  const beam = useAnimatedStyle(() => ({ opacity: Math.sin(Math.PI * fly.get()), transform: [{ scaleY: 0.2 + fly.get() * 0.8 }] }));

  return (
    <View style={{ width: "100%" }}>
      <Animated.View style={banner}>
        <View style={{ flexDirection: "row", gap: 10, padding: 13, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.11)" }}>
          <View style={{ width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.16)" }}>
            <Bell size={16} color="#fff" strokeWidth={2} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 13.5, fontWeight: "700", color: "#fff" }}>Seu banco</Text>
              <Text style={{ fontSize: 12, color: INK.softer }}>agora</Text>
            </View>
            <Text numberOfLines={2} style={{ marginTop: 2, fontSize: 14, lineHeight: 19, color: INK.soft }}>
              Compra no {p.how} aprovada: {money(p.amount)} em {p.merchant}
            </Text>
          </View>
        </View>
      </Animated.View>

      <View style={{ height: 44, alignItems: "center", justifyContent: "center" }}>
        <Animated.View style={[{ width: 2, height: 44, borderRadius: 1, backgroundColor: ICE }, beam]} />
      </View>

      <Glass>
        {/* A fixed height: what arrives never pushes the slide's title down. */}
        <View style={{ padding: 16, gap: 14, height: 204 }}>
          <Label>ANOTADO PELO COPILOT</Label>
          {caught.map((k, i) => (
            <Rise key={`${k}-${caught.length}`}>
              <Entry title={PURCHASES[k].title} amount={money(PURCHASES[k].amount)} tags={PURCHASES[k].tags} fresh={i === 0} dim={i > 0} />
            </Rise>
          ))}
        </View>
      </Glass>
    </View>
  );
}

/* ================================================================== */
/* Voice                                                               */
/* ================================================================== */

const SAYINGS = [
  { said: "almoço 32 no débito", title: "Almoço", amount: "R$ 32,00", tags: ["Alimentação", "Débito", "hoje"] },
  { said: "recebi 300 de freela", title: "Freela", amount: "R$ 300,00", tags: ["Entrada", "hoje"], income: true },
];

export function VoiceDemo({ active }: { active: boolean }) {
  const chime = useContext(ChimeContext);
  const [k, setK] = useState(0);
  const [run, setRun] = useState(0);
  const [hearing, setHearing] = useState(false);
  const [list, setList] = useState<number[]>([]);
  const said = useTyping(SAYINGS[k].said, hearing ? run : 0, 60);

  useScript(
    active,
    (at) => {
      SAYINGS.forEach((s, i) => {
        const t0 = i * 3900 + 300;
        at(t0, () => {
          setK(i);
          setRun((r) => r + 1);
          setHearing(true);
        });
        at(t0 + s.said.length * 60 + 500, () => {
          setHearing(false);
          setList((l) => [i, ...l].slice(0, 2));
          chime();
          success();
        });
      });
    },
    () => {
      setList([]);
      setHearing(false);
    },
  );

  return (
    <View style={{ width: "100%", alignItems: "center" }}>
      <View style={{ height: 56, justifyContent: "center", alignSelf: "stretch" }}>
        <Text style={{ fontSize: 24, fontWeight: "700", letterSpacing: -0.5, color: hearing ? "#fff" : "rgba(255,255,255,0.32)", textAlign: "center" }}>“{hearing ? said : SAYINGS[k].said}”</Text>
      </View>
      <View style={{ width: 84, height: 84, alignItems: "center", justifyContent: "center", marginTop: 2 }}>
        {hearing && <Pulse />}
        <View style={{ width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", backgroundColor: hearing ? "#fff" : "rgba(255,255,255,0.1)" }}>
          <Mic size={28} color={hearing ? "#0B0D12" : "#fff"} strokeWidth={2.2} />
        </View>
      </View>
      <Wave on={hearing} />
      <Glass style={{ alignSelf: "stretch", marginTop: 16 }}>
        <View style={{ padding: 16, gap: 14, height: 176 }}>
          {list.map((i, row) => (
            <Rise key={`${i}-${list.length}`}>
              <Entry title={SAYINGS[i].title} amount={SAYINGS[i].amount} tags={SAYINGS[i].tags} income={SAYINGS[i].income} fresh={row === 0} dim={row > 0} />
            </Rise>
          ))}
        </View>
      </Glass>
    </View>
  );
}

function Pulse() {
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(withRepeat(withTiming(1, { duration: 1200, easing: Easing.out(Easing.cubic) }), -1, false));
  }, [p]);
  const style = useAnimatedStyle(() => ({ opacity: 0.45 * (1 - p.get()), transform: [{ scale: 1 + p.get() * 0.5 }] }));
  return <Animated.View style={[{ position: "absolute", width: 64, height: 64, borderRadius: 32, backgroundColor: "#fff" }, style]} />;
}

function Wave({ on }: { on: boolean }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withRepeat(withTiming(1, { duration: 1400, easing: Easing.linear }), -1, false));
  }, [t]);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 3, height: 28, marginTop: 6, opacity: on ? 1 : 0.22 }}>
      {Array.from({ length: 25 }, (_, i) => (
        <WaveBar key={i} i={i} t={t} on={on} />
      ))}
    </View>
  );
}

function WaveBar({ i, t, on }: { i: number; t: { get: () => number }; on: boolean }) {
  const style = useAnimatedStyle(() => {
    const v = t.get() * Math.PI * 2;
    return { height: on ? 4 + 22 * Math.abs(Math.sin(v * 2 + i * 0.7) * Math.sin(v + i * 0.31)) : 4 };
  });
  return <Animated.View style={[{ width: 3, borderRadius: 2, backgroundColor: i % 5 === 2 ? COLD : "#fff" }, style]} />;
}

/* ================================================================== */
/* Two taps: the gesture on a phone, then Registro rápido full size    */
/* ================================================================== */

const PH_W = 168;
const PH_H = 344;
const FRAME = 4;

/**
 * An iPhone Pro, drawn to look like the real thing rather than a toy: the true
 * proportions and corner radius, a thin titanium band with its highlights, side
 * buttons, a black border round the screen with the Dynamic Island; on the back, a
 * matte glass with a soft sheen and the square camera block in its corner — three
 * lenses in metal rings over dark glass with a coloured reflection, the flash and
 * the sensor. No maker's logo.
 */
function Phone({ face, children }: { face: "front" | "back"; children?: ReactNode }) {
  const R = 30;
  const BAND = 2.5;
  const side = { position: "absolute" as const, width: 2.5, borderRadius: 1.5 };
  const near = face === "front" ? { left: -1.5 } : { right: -1.5 };
  const far = face === "front" ? { right: -1.5 } : { left: -1.5 };
  return (
    <View style={{ width: PH_W, height: PH_H, shadowColor: "#000", shadowOpacity: 0.6, shadowRadius: 22, shadowOffset: { width: 0, height: 14 } }}>
      {/* Side buttons: action and volume on one side, power on the other. */}
      <Fade colors={["#8E9298", "#55595F"]} style={[side, near, { top: 66, height: 16 }]} />
      <Fade colors={["#8E9298", "#55595F"]} style={[side, near, { top: 94, height: 30 }]} />
      <Fade colors={["#8E9298", "#55595F"]} style={[side, near, { top: 130, height: 30 }]} />
      <Fade colors={["#8E9298", "#55595F"]} style={[side, far, { top: 104, height: 50 }]} />

      {/* The titanium band. */}
      <Fade colors={["#B4B8BE", "#5E6268", "#8C9096", "#4A4D52", "#9A9EA4"]} locations={[0, 0.25, 0.5, 0.78, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, borderRadius: R, padding: BAND }}>
        {face === "front" ? (
          /* The black border round the screen, then the screen. */
          <View style={{ flex: 1, borderRadius: R - BAND, backgroundColor: "#000", padding: 4.5 }}>
            <View style={{ flex: 1, borderRadius: R - BAND - 4.5, overflow: "hidden", backgroundColor: "#07080A" }}>
              {children}
              <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, height: 30, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 }}>
                <Text style={{ fontSize: 9.5, fontWeight: "700", color: "#fff" }}>9:41</Text>
                <View style={{ flexDirection: "row", gap: 2, alignItems: "flex-end" }}>
                  {[3.5, 5, 6.5, 8].map((h) => (
                    <View key={h} style={{ width: 2.2, height: h, borderRadius: 1, backgroundColor: "#fff" }} />
                  ))}
                  <View style={{ marginLeft: 3, width: 15, height: 7.5, borderRadius: 2.5, borderWidth: 1, borderColor: "rgba(255,255,255,0.65)", padding: 1 }}>
                    <View style={{ flex: 1, width: "78%", borderRadius: 1, backgroundColor: "#fff" }} />
                  </View>
                </View>
              </View>
              <View pointerEvents="none" style={{ position: "absolute", top: 7, alignSelf: "center", width: 46, height: 14, borderRadius: 7, backgroundColor: "#000" }} />
              {/* The glass over it all. */}
              <Fade pointerEvents="none" colors={["rgba(255,255,255,0.07)", "rgba(255,255,255,0)", "rgba(255,255,255,0)"]} locations={[0, 0.45, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} />
            </View>
          </View>
        ) : (
          /* The matte back glass. */
          <Fade colors={["#3A3C40", "#2A2C30", "#232528"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, borderRadius: R - BAND, overflow: "hidden" }}>
            <Fade colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.06)", "rgba(255,255,255,0)"]} locations={[0.25, 0.45, 0.65]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} />
            <CameraBlock />
          </Fade>
        )}
      </Fade>
    </View>
  );
}

/** The square camera block: raised, with a lit edge, three lenses, flash and sensor. */
function CameraBlock() {
  const S = 74;
  return (
    <View style={{ position: "absolute", left: 9, top: 9, width: S, height: S, borderRadius: 19, shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } }}>
      <Fade colors={["#46494F", "#2C2E33"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, borderRadius: 19, borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" }}>
        <Lens x={4} y={4} />
        <Lens x={4} y={39} />
        <Lens x={38} y={21.5} />
        {/* Flash, and the depth sensor. */}
        <View style={{ position: "absolute", left: 46, top: 5, width: 11, height: 11, borderRadius: 6, backgroundColor: "#D9D3C2", borderWidth: 1.5, borderColor: "#5A5D63" }} />
        <View style={{ position: "absolute", left: 48, top: 56, width: 10, height: 10, borderRadius: 5, backgroundColor: "#0B0C0E", borderWidth: 1.5, borderColor: "#4A4D53" }} />
        <View style={{ position: "absolute", left: 62, top: 40, width: 3, height: 3, borderRadius: 2, backgroundColor: "#111" }} />
      </Fade>
    </View>
  );
}

/** One lens: a metal ring, dark glass, a coloured reflection and a point of light. */
function Lens({ x, y }: { x: number; y: number }) {
  const D = 31;
  return (
    <View style={{ position: "absolute", left: x, top: y, width: D, height: D, borderRadius: D / 2, shadowColor: "#000", shadowOpacity: 0.6, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } }}>
      <Fade colors={["#8A8E94", "#3B3E43", "#6D7176"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, borderRadius: D / 2, padding: 3 }}>
        <View style={{ flex: 1, borderRadius: D / 2, backgroundColor: "#050608", padding: 3 }}>
          <Fade colors={["#1B2133", "#090B12", "#1E1830"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, borderRadius: D / 2, alignItems: "center", justifyContent: "center" }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#0A0D18", borderWidth: 1, borderColor: "rgba(110,130,200,0.35)" }} />
            <View style={{ position: "absolute", left: 5, top: 4, width: 5, height: 5, borderRadius: 3, backgroundColor: "rgba(170,190,255,0.55)" }} />
            <View style={{ position: "absolute", right: 5, bottom: 5, width: 3, height: 3, borderRadius: 2, backgroundColor: "rgba(200,140,255,0.4)" }} />
          </Fade>
        </View>
      </Fade>
    </View>
  );
}

/** The app as the phone shows it: the balance and Willo. */
function AppHome() {
  return (
    <View style={{ alignItems: "center", marginTop: 56 }}>
      <Text style={{ fontSize: 10, color: INK.softer }}>Saldo em contas</Text>
      <Text style={{ fontSize: 18, fontWeight: "800", color: "#fff", marginTop: 2 }}>R$ 2.430,00</Text>
      <View style={{ width: 96, height: 96, marginTop: 18 }}>
        <WilloBot size={96} mode="idle" />
      </View>
      <View style={{ marginTop: 22, width: 120, height: 9, borderRadius: 5, backgroundColor: "rgba(255,255,255,0.1)" }} />
      <View style={{ marginTop: 7, width: 84, height: 9, borderRadius: 5, backgroundColor: "rgba(255,255,255,0.06)" }} />
    </View>
  );
}

/* Where each knock lands, inside the phone. */
const KNOCK_BACK = { x: PH_W / 2, y: PH_H * 0.55 };
const KNOCK_SCREEN = { x: PH_W / 2, y: FRAME + 56 + 14 + 22 + 18 + 48 };

const ROUNDS = [
  { where: "back" as const, label: "Dois toques atrás do celular", typed: "uber 18,40", title: "Uber", amount: "R$ 18,40", tags: ["Transporte", "hoje"] },
];
const ROUND_MS = 7600;

export function QuickDemo({ active }: { active: boolean }) {
  const chime = useContext(ChimeContext);
  const [r, setR] = useState(0);
  const [face, setFace] = useState<"front" | "back">("back");
  const [run, setRun] = useState(0);
  const [typing, setTyping] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [done, setDone] = useState(false);
  const [filled, setFilled] = useState(false);
  const turn = useSharedValue(1);
  const knock = useSharedValue(0);
  const zoom = useSharedValue(0); // 0: the phone, 1: Registro rápido
  const typed = useTyping(ROUNDS[r].typed, typing ? run : 0, 120);

  useScript(
    active,
    (at) => {
      ROUNDS.forEach((round, i) => {
        const t0 = i * ROUND_MS;
        const back = round.where === "back";
        at(t0, () => {
          setR(i);
          setFace(back ? "back" : "front");
          setDone(false);
          setFilled(false);
          setTyping(false);
          setPressed(false);
          turn.set(1);
          zoom.set(withTiming(0, { duration: 500, easing: Easing.bezier(0.16, 1, 0.3, 1) }));
        });
        at(t0 + 700, () =>
          knock.set(withSequence(withTiming(1, { duration: 130 }), withTiming(0, { duration: 220 }), withTiming(1, { duration: 130 }), withTiming(0, { duration: 380 }))),
        );
        at(t0 + 730, knockFeel);
        at(t0 + 1080, knockFeel);
        if (back) {
          at(t0 + 1700, () => turn.set(withTiming(0, { duration: 280, easing: Easing.in(Easing.quad) })));
          at(t0 + 1990, () => {
            setFace("front");
            turn.set(withTiming(1, { duration: 340, easing: Easing.out(Easing.quad) }));
          });
        }
        const open = t0 + (back ? 2700 : 1900);
        at(open, () => zoom.set(withTiming(1, { duration: 650, easing: Easing.bezier(0.16, 1, 0.3, 1) })));
        at(open + 850, () => {
          setRun((v) => v + 1);
          setTyping(true);
        });
        const end = open + 850 + round.typed.length * 120 + 300;
        at(end, () => {
          setTyping(false);
          setFilled(true);
        });
        at(end + 800, () => setPressed(true));
        at(end + 1000, () => setPressed(false));
        at(end + 1100, () => {
          setDone(true);
          chime();
          success();
        });
      });
    },
    () => {
      setDone(false);
      setFilled(false);
      setTyping(false);
      zoom.set(0);
      turn.set(1);
    },
  );

  const round = ROUNDS[r];
  const spot = face === "back" ? KNOCK_BACK : KNOCK_SCREEN;
  const flip = useAnimatedStyle(() => ({ transform: [{ scaleX: 0.03 + 0.97 * turn.get() }] }));
  const phoneOut = useAnimatedStyle(() => ({ opacity: 1 - zoom.get(), transform: [{ translateY: -zoom.get() * 30 }] }));
  const sheetIn = useAnimatedStyle(() => ({ opacity: zoom.get(), transform: [{ translateY: (1 - zoom.get()) * 60 }] }));
  const ripple = useAnimatedStyle(() => ({ opacity: knock.get() * 0.9, transform: [{ scale: 0.5 + knock.get() * 0.7 }] }));
  const tocs = useAnimatedStyle(() => ({ opacity: knock.get() }));

  return (
    <View style={{ width: "100%", alignItems: "center" }}>
      <View style={{ height: 34, justifyContent: "center", marginBottom: 12 }}>
        <Rise key={r} from={6}>
          <View style={{ paddingHorizontal: 14, height: 32, borderRadius: 16, justifyContent: "center", backgroundColor: "#fff" }}>
            <Text style={{ fontSize: 13.5, fontWeight: "700", color: "#0B0D12" }}>{round.label}</Text>
          </View>
        </Rise>
      </View>

      <View style={{ width: "100%", height: PH_H, alignItems: "center", justifyContent: "center" }}>
        {/* The gesture, on the phone. */}
        <Animated.View style={[{ position: "absolute", top: 0 }, phoneOut]}>
          <Animated.View style={flip}>
            <Phone face={face}>{face === "front" ? <AppHome /> : null}</Phone>
            <Animated.View
              pointerEvents="none"
              style={[{ position: "absolute", left: spot.x - 34, top: spot.y - 34, width: 68, height: 68, borderRadius: 34, borderWidth: 2, borderColor: ICE, backgroundColor: "rgba(220,235,255,0.16)" }, ripple]}
            />
          </Animated.View>
          <Animated.View pointerEvents="none" style={[{ position: "absolute", left: PH_W + 10, top: spot.y - 30, width: 90 }, tocs]}>
            <Text style={{ fontSize: 15, fontWeight: "800", color: ICE }}>toc toc</Text>
          </Animated.View>
        </Animated.View>

        {/* Registro rápido, opened by it, as the app shows it. */}
        <Animated.View style={[{ position: "absolute", left: 0, right: 0, top: 8 }, sheetIn]}>
          <Glass>
            <View style={{ paddingHorizontal: 18, paddingTop: 12, paddingBottom: 18 }}>
              <View style={{ alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.22)", marginBottom: 14 }} />
              <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 1.1, color: INK.softer }}>REGISTRO RÁPIDO · ETAPA {done ? 2 : 1} DE 2</Text>
              <View style={{ flexDirection: "row", gap: 4, marginTop: 8 }}>
                <View style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: "#fff" }} />
                <View style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: done ? "#fff" : "rgba(255,255,255,0.18)" }} />
              </View>
              <Text style={{ marginTop: 16, fontSize: 24, fontWeight: "800", letterSpacing: -0.6, color: "#fff" }}>O que aconteceu?</Text>
              <View
                style={{
                  marginTop: 12,
                  height: 56,
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 6,
                  gap: 2,
                  borderRadius: 20,
                  backgroundColor: "rgba(255,255,255,0.06)",
                  borderWidth: 1,
                  borderColor: typed ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.10)",
                }}
              >
                <View style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
                  <Camera size={20} color="rgba(255,255,255,0.78)" strokeWidth={2} />
                </View>
                <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, paddingHorizontal: 4, fontSize: 19, fontWeight: "600", color: typed ? "#fff" : INK.faint }}>
                  {typed || "Ex.: padaria 48"}
                  {typing && <Caret />}
                </Text>
                <View style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
                  <Mic size={20} color="rgba(255,255,255,0.78)" strokeWidth={2.1} />
                </View>
              </View>
              {/* The entry it became, filled in as soon as it is read. */}
              <View style={{ height: 84, marginTop: 12, justifyContent: "center" }}>
                <Rise on={filled}>
                  <View style={{ padding: 12, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.05)" }}>
                    <Entry title={round.title} amount={round.amount} tags={round.tags} fresh={done} />
                  </View>
                </Rise>
              </View>
              <View style={{ marginTop: 12, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, backgroundColor: done ? "rgba(111,168,232,0.22)" : "#fff", opacity: pressed ? 0.6 : filled || done ? 1 : 0.35 }}>
                {done ? (
                  <>
                    <Check size={16} color={ICE} strokeWidth={3} />
                    <Text style={{ fontSize: 16, fontWeight: "700", color: "#fff" }}>Anotado</Text>
                  </>
                ) : (
                  <Text style={{ fontSize: 16, fontWeight: "700", color: "#0B0D12" }}>Continuar</Text>
                )}
              </View>
            </View>
          </Glass>
        </Animated.View>
      </View>
    </View>
  );
}

function Caret() {
  const p = useSharedValue(1);
  useEffect(() => {
    p.set(withRepeat(withSequence(withTiming(0, { duration: 380 }), withTiming(1, { duration: 380 })), -1));
  }, [p]);
  const style = useAnimatedStyle(() => ({ opacity: p.get() }));
  return <Animated.Text style={[{ color: ICE }, style]}>|</Animated.Text>;
}

/* ================================================================== */
/* A receipt read from a photo                                         */
/* ================================================================== */

const RECEIPT_W = 236;
const RECEIPT_H = 320;
const ITEMS: [string, string, string][] = [
  ["ARROZ TIPO 1 5KG", "1 x 24,90", "24,90"],
  ["CAFE TORRADO 500G", "1 x 18,40", "18,40"],
  ["LEITE INTEGRAL 1L", "6 x 5,99", "35,94"],
  ["BANANA PRATA KG", "1,2 x 6,98", "8,38"],
  ["PAO FRANCES KG", "0,8 x 14,90", "11,92"],
  ["DETERGENTE 500ML", "2 x 2,99", "5,98"],
  ["SABAO EM PO 1KG", "1 x 22,38", "22,38"],
];

export function ReceiptDemo({ active }: { active: boolean }) {
  const chime = useContext(ChimeContext);
  const scan = useSharedValue(0);
  const flash = useSharedValue(0);
  const [marks, setMarks] = useState(0);
  const [read, setRead] = useState(false);

  useScript(
    active,
    (at) => {
      at(350, () => {
        flash.set(withSequence(withTiming(1, { duration: 70 }), withTiming(0, { duration: 520 })));
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
      });
      at(700, () => scan.set(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) })));
      at(2600, () => setMarks(1));
      at(2850, () => setMarks(2));
      at(3100, () => setMarks(3));
      at(3700, () => {
        setRead(true);
        chime();
        success();
      });
    },
    () => {
      scan.set(0);
      setMarks(0);
      setRead(false);
    },
  );

  const scanStyle = useAnimatedStyle(() => ({ opacity: scan.get() > 0 && scan.get() < 1 ? 1 : 0, transform: [{ translateY: scan.get() * RECEIPT_H }] }));
  const dim = useSharedValue(1);
  useEffect(() => {
    dim.set(withTiming(read ? 0.4 : 1, { duration: 600 }));
  }, [read, dim]);
  const paper = useAnimatedStyle(() => ({ opacity: dim.get() }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.get() * 0.85 }));
  const mono = { fontFamily: "Menlo", color: "#2B2E35" };
  const mark = { position: "absolute" as const, left: 8, right: 8, borderRadius: 4, borderWidth: 1.5, borderColor: COLD, backgroundColor: "rgba(111,168,232,0.14)" };

  return (
    <View style={{ alignItems: "center", width: "100%", height: RECEIPT_H + 50 }}>
      <Animated.View style={[{ width: RECEIPT_W + 28, height: RECEIPT_H + 30, alignItems: "center", justifyContent: "center" }, paper]}>
        <View style={{ width: RECEIPT_W, height: RECEIPT_H, transform: [{ rotate: "-1.5deg" }] }}>
          <View style={{ height: RECEIPT_H - 7, backgroundColor: "#F3F1EC", paddingHorizontal: 14, paddingTop: 14, overflow: "hidden" }}>
            <Text style={{ ...mono, fontSize: 9.5, fontWeight: "700", textAlign: "center" }}>SUPERMERCADO BOA COMPRA LTDA</Text>
            <Text style={{ ...mono, fontSize: 7, textAlign: "center", marginTop: 2, color: "#5A5E66" }}>CNPJ 12.345.678/0001-90</Text>
            <Text style={{ ...mono, fontSize: 7, textAlign: "center", color: "#5A5E66" }}>AV. PAULISTA, 1000 - SAO PAULO/SP</Text>
            <Text style={{ ...mono, fontSize: 7, textAlign: "center", marginTop: 6 }}>-------- CUPOM FISCAL --------</Text>
            <View style={{ marginTop: 6, gap: 3 }}>
              {ITEMS.map(([name, qty, total]) => (
                <View key={name}>
                  <Text style={{ ...mono, fontSize: 7 }}>{name}</Text>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ ...mono, fontSize: 7, color: "#5A5E66" }}>{qty}</Text>
                    <Text style={{ ...mono, fontSize: 7 }}>{total}</Text>
                  </View>
                </View>
              ))}
            </View>
            <Text style={{ ...mono, fontSize: 7, marginTop: 5 }}>--------------------------------</Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 3 }}>
              <Text style={{ ...mono, fontSize: 10, fontWeight: "800" }}>TOTAL R$</Text>
              <Text style={{ ...mono, fontSize: 10, fontWeight: "800" }}>127,90</Text>
            </View>
            <Text style={{ ...mono, fontSize: 7, marginTop: 3, color: "#5A5E66" }}>CARTAO DEBITO ........ 127,90</Text>
            <Text style={{ ...mono, fontSize: 7, color: "#5A5E66" }}>05/11/2026 18:42  CAIXA 03</Text>
            <View style={{ flexDirection: "row", gap: 1.2, height: 18, marginTop: 6, alignSelf: "center" }}>
              {Array.from({ length: 46 }, (_, i) => (
                <View key={i} style={{ width: (i * 7) % 3 === 0 ? 2.2 : 1, height: 18, backgroundColor: "#2B2E35" }} />
              ))}
            </View>
          </View>
          <Svg width={RECEIPT_W} height={8}>
            <Polygon points={`${Array.from({ length: 25 }, (_, i) => `${((i * RECEIPT_W) / 24).toFixed(1)},${i % 2 ? 8 : 0}`).join(" ")} ${RECEIPT_W},0 0,0`} fill="#F3F1EC" />
          </Svg>
          {marks >= 1 && <View pointerEvents="none" style={[mark, { top: 10, height: 15 }]} />}
          {marks >= 2 && <View pointerEvents="none" style={[mark, { top: 214, height: 17 }]} />}
          {marks >= 3 && <View pointerEvents="none" style={[mark, { top: 232, height: 24 }]} />}
          <Animated.View pointerEvents="none" style={[{ position: "absolute", left: -6, right: -6, top: -10, height: 20 }, scanStyle]}>
            <Fade colors={["rgba(111,168,232,0)", "rgba(111,168,232,0.9)", "rgba(111,168,232,0)"]} style={{ flex: 1 }} />
          </Animated.View>
          <Animated.View pointerEvents="none" style={[{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "#fff" }, flashStyle]} />
        </View>
        <Viewfinder />
      </Animated.View>

      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
        <Rise on={read} from={24}>
          <Glass>
            <View style={{ padding: 16, gap: 12 }}>
              <Entry title="Supermercado Boa Compra" amount="R$ 127,90" tags={["Mercado", "Débito", "7 itens", "hoje"]} fresh={read} />
              <Saved text="Lido da foto, é só conferir" />
            </View>
          </Glass>
        </Rise>
      </View>
    </View>
  );
}

function Viewfinder() {
  const c = { position: "absolute" as const, width: 28, height: 28, borderColor: "rgba(255,255,255,0.9)" };
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}>
      <View style={[c, { left: 0, top: 0, borderLeftWidth: 3, borderTopWidth: 3, borderTopLeftRadius: 10 }]} />
      <View style={[c, { right: 0, top: 0, borderRightWidth: 3, borderTopWidth: 3, borderTopRightRadius: 10 }]} />
      <View style={[c, { left: 0, bottom: 0, borderLeftWidth: 3, borderBottomWidth: 3, borderBottomLeftRadius: 10 }]} />
      <View style={[c, { right: 0, bottom: 0, borderRightWidth: 3, borderBottomWidth: 3, borderBottomRightRadius: 10 }]} />
    </View>
  );
}

/* ================================================================== */
/* The Radar: its own dial, through every area in turn                  */
/* ================================================================== */

/* Each finding broken by hand into two even lines. */
const FINDINGS: Record<SectorKey, { line: string; note: string; risk?: boolean }> = {
  consumo: { line: "Você gastou 18% menos\ndo que no mês passado.", note: "Mercado é o maior gasto: R$ 812." },
  habitos: { line: "Delivery virou rotina:\n11 pedidos neste mês.", note: "40% acima do seu normal.", risk: true },
  compromissos: { line: "R$ 1.890 já estão\ncomprometidos até o dia 30.", note: "Fatura, aluguel e 3 assinaturas." },
  futuro: { line: "No ritmo de agora, você\nfecha o mês com R$ 1.240.", note: "Pelos gastos dos últimos 14 dias." },
  saude: { line: "Sua saúde financeira\nestá em 78: boa.", note: "Sobra 12% da renda todo mês." },
  simular: { line: "Um celular de R$ 2.400\nem 10x cabe no mês.", note: "Mas a sobra cai para R$ 420." },
};

export function RadarDemo({ active }: { active: boolean }) {
  const [k, setK] = useState(0);
  const [picked, setPicked] = useState<SectorKey | null>(null);

  useScript(
    active,
    (at) => {
      SECTORS.forEach((_, i) => {
        at(i * 2900, () => {
          setPicked(null);
          setK(i);
        });
      });
    },
    () => {
      setK(0);
      setPicked(null);
    },
  );

  const key: SectorKey = picked ?? SECTORS[k].key;
  const f = FINDINGS[key];
  return (
    <View style={{ alignItems: "center", width: "100%" }}>
      <Scope
        size={250}
        selected={key}
        onSelect={(s) => {
          tap();
          setPicked(s);
        }}
        blips={{ habitos: { risk: 1, note: 0 }, compromissos: { risk: 0, note: 2 }, consumo: { risk: 0, note: 1 }, futuro: { risk: 0, note: 1 } }}
      />
      <View style={{ alignSelf: "stretch", minHeight: 92, marginTop: 16 }}>
        <Rise key={key}>
          <Text style={{ fontSize: 19, lineHeight: 25, fontWeight: "700", letterSpacing: -0.4, color: f.risk ? "#FF8A7A" : "#fff", textAlign: "center" }}>{f.line}</Text>
          <Text style={{ marginTop: 6, fontSize: 14, color: INK.soft, textAlign: "center" }}>{f.note}</Text>
        </Rise>
      </View>
    </View>
  );
}

/* ================================================================== */
/* The month ahead, and what if                                        */
/* ================================================================== */

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const EXTRA = [0, 200, 500];

export function ForecastDemo({ active }: { active: boolean }) {
  const [extra, setExtra] = useState(0);
  const draw = useSharedValue(0);
  const drop = useSharedValue(0);

  useScript(
    active,
    (at) => {
      at(200, () => draw.set(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.cubic) })));
      at(3000, () => setExtra(200));
      at(5600, () => setExtra(500));
      at(8200, () => setExtra(0));
    },
    () => {
      draw.set(0);
      setExtra(0);
    },
  );
  useEffect(() => {
    drop.set(withTiming(extra, { duration: 900, easing: Easing.bezier(0.16, 1, 0.3, 1) }));
  }, [extra, drop]);
  const total = useEased(1240 - extra, 900, 1240);

  const W = 320;
  const H = 150;
  const past = [2600, 2480, 4250, 4010, 3820, 3560, 3400, 3190, 3020];
  const ahead = [3020, 2860, 2700, 2558, 2380, 2150, 1910, 1700, 1460, 1240];
  const n = past.length + ahead.length - 2;
  const today = past.length - 1;
  const lo = 600;
  const hi = 4600;
  const x = (k: number) => {
    "worklet";
    return 4 + (k / n) * (W - 8);
  };
  const y = (v: number) => {
    "worklet";
    return 8 + (1 - (v - lo) / (hi - lo)) * (H - 16);
  };
  const pastD = past.map((v, k) => `${k === 0 ? "M" : "L"} ${x(k).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = `${pastD} L ${x(today).toFixed(1)} ${H} L ${x(0).toFixed(1)} ${H} Z`;
  const aheadStart = ahead.map((v, k) => `${k === 0 ? "M" : "L"} ${x(today + k).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const bills = [
    { at: today + 3, label: "Luz", amount: 142 },
    { at: today + 6, label: "Fatura", amount: 1240 },
  ];

  const D = 900;
  const pastProps = useAnimatedProps(() => ({ strokeDashoffset: D * (1 - draw.get()) }));
  const areaStyle = useAnimatedStyle(() => ({ opacity: draw.get() }));
  const aheadProps = useAnimatedProps(() => {
    const d = ahead
      .map((v, k) => {
        const share = k / (ahead.length - 1);
        return `${k === 0 ? "M" : "L"} ${x(today + k).toFixed(1)} ${y(v - drop.get() * share).toFixed(1)}`;
      })
      .join(" ");
    return { d, opacity: draw.get() };
  });
  const endProps = useAnimatedProps(() => ({ cy: y(1240 - drop.get()), opacity: draw.get() }));

  return (
    <View style={{ width: "100%" }}>
      <Text style={{ fontSize: 13, color: INK.softer }}>Sobra prevista no dia 30</Text>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10 }}>
        <Text style={{ marginTop: 2, fontSize: 40, fontWeight: "800", letterSpacing: -1.4, color: "#fff", fontVariant: ["tabular-nums"] }}>{money(total)}</Text>
        {extra > 0 && (
          <Rise key={extra} from={6}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: INK.soft }}>− R$ {extra}</Text>
          </Rise>
        )}
      </View>
      <View style={{ marginTop: 12, alignItems: "center" }}>
        <View style={{ width: W, height: H }}>
          <Animated.View style={[{ position: "absolute", left: 0, top: 0 }, areaStyle]}>
            <Svg width={W} height={H}>
              <Defs>
                <LinearGradient id="fcArea" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.16} />
                  <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
                </LinearGradient>
              </Defs>
              <Path d={area} fill="url(#fcArea)" />
            </Svg>
          </Animated.View>
          <Svg width={W} height={H} style={{ position: "absolute" }}>
            <Line x1={x(today)} y1={4} x2={x(today)} y2={H} stroke="rgba(255,255,255,0.18)" strokeDasharray="2 4" />
            <AnimatedPath d={pastD} stroke="#FFFFFF" strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" fill="none" strokeDasharray={`${D} ${D}`} animatedProps={pastProps} />
            <AnimatedPath d={aheadStart} stroke={COLD} strokeWidth={2.2} strokeDasharray="5 6" strokeLinecap="round" fill="none" animatedProps={aheadProps} />
            {bills.map((b) => (
              <Rect key={b.label} x={x(b.at) - 4} y={H - 14} width={8} height={8} rx={2} fill={ICE} opacity={0.85} />
            ))}
            <Circle cx={x(today)} cy={y(past[today])} r={5} fill="#fff" />
            <AnimatedCircle cx={x(n)} cy={y(1240)} r={5.5} fill={COLD} animatedProps={endProps} />
          </Svg>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", width: W, marginTop: 4 }}>
          <Text style={{ fontSize: 11.5, color: INK.faint }}>dia 1</Text>
          <Text style={{ fontSize: 11.5, color: INK.soft, fontWeight: "600" }}>hoje</Text>
          <Text style={{ fontSize: 11.5, color: INK.faint }}>dia 30</Text>
        </View>
      </View>
      <View style={{ marginTop: 12, gap: 8 }}>
        {bills.map((b) => (
          <View key={b.label} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: ICE }} />
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, color: "#fff" }}>
              {b.label}
              <Text style={{ color: INK.softer }}> · vence em {b.at - today} dias</Text>
            </Text>
            <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff", fontVariant: ["tabular-nums"] }}>{money(b.amount)}</Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
        {EXTRA.map((e) => (
          <Pressable
            key={e}
            onPress={() => {
              tap();
              setExtra(e);
            }}
            accessibilityRole="button"
            accessibilityLabel={e ? `Gastar mais ${e} reais` : "Sem gasto extra"}
            style={{ flex: 1, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: extra === e ? "#fff" : "rgba(255,255,255,0.07)" }}
          >
            <Text style={{ fontSize: 13.5, fontWeight: "700", color: extra === e ? "#0B0D12" : INK.soft }}>{e ? `+ R$ ${e}` : "Como está"}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/* ================================================================== */
/* Ask: Willo answers three questions in turn                          */
/* ================================================================== */

const ASKS: { short: string; q: string; a: string; card: { label: string; value: string; note: string } }[] = [
  {
    short: "Fim de semana",
    q: "Posso gastar R$ 200 no fim de semana?",
    a: "Pode, sim. Depois disso ainda sobram R$ 540 até o dia 30, já contando a fatura.",
    card: { label: "Sobra até o dia 30", value: "R$ 540,00", note: "depois dos R$ 200" },
  },
  {
    short: "Delivery",
    q: "Quanto gastei com delivery?",
    a: "R$ 386 este mês, em 11 pedidos. É 40% a mais do que você costuma.",
    card: { label: "Delivery no mês", value: "R$ 386,00", note: "11 pedidos · +40%" },
  },
  {
    short: "Fatura",
    q: "Quando vence a fatura?",
    a: "Dia 12. São R$ 1.240 e eu te aviso na véspera.",
    card: { label: "Fatura do cartão", value: "R$ 1.240,00", note: "vence dia 12" },
  },
];

export function AskDemo({ active }: { active: boolean }) {
  const later = useLater();
  const [pick, setPick] = useState(0);
  const [round, setRound] = useState(0);
  const [thinking, setThinking] = useState(false);
  const [run, setRun] = useState(0);
  const [card, setCard] = useState(false);
  const answer = useTyping(ASKS[pick].a, thinking ? 0 : run, 26);

  const ask = (i: number, at: (ms: number, f: () => void) => void, t0: number) => {
    at(t0, () => {
      setPick(i);
      setRound((r) => r + 1);
      setThinking(true);
      setCard(false);
      setRun(0);
    });
    at(t0 + 1300, () => {
      setThinking(false);
      setRun((r) => r + 1);
    });
    at(t0 + 1300 + ASKS[i].a.length * 26 + 300, () => setCard(true));
  };

  useScript(
    active,
    (at) => {
      ASKS.forEach((_, i) => ask(i, at, i * 6600 + 200));
    },
    () => {
      setCard(false);
      setThinking(false);
    },
  );

  const a = ASKS[pick];
  return (
    <View style={{ width: "100%" }}>
      <View style={{ minHeight: 270 }}>
        <Rise key={round}>
          <View style={{ gap: 10 }}>
            <View style={{ alignSelf: "flex-end", maxWidth: "86%", backgroundColor: "rgba(255,255,255,0.94)", borderRadius: 20, borderBottomRightRadius: 6, paddingHorizontal: 15, paddingVertical: 10 }}>
              <Text style={{ fontSize: 16, fontWeight: "600", color: "#0B0D12" }}>{a.q}</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
              <View style={{ width: 42, height: 42 }}>
                <WilloBot size={42} mode={thinking ? "thinking" : "speaking"} />
              </View>
              <View style={{ flex: 1, alignItems: "flex-start" }}>
                <View style={{ maxWidth: "100%", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 20, borderBottomLeftRadius: 6, paddingHorizontal: 15, paddingVertical: 10 }}>
                  {thinking ? (
                    <Dots />
                  ) : (
                    <View>
                      <Text style={{ fontSize: 16, lineHeight: 22, color: "transparent" }}>{a.a}</Text>
                      <Text style={{ position: "absolute", left: 0, top: 0, right: 0, fontSize: 16, lineHeight: 22, color: "#fff" }}>{answer}</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
            <View style={{ marginLeft: 50 }}>
              <Rise on={card}>
                <View style={{ borderRadius: 18, padding: 14, backgroundColor: "rgba(111,168,232,0.12)" }}>
                  <Text style={{ fontSize: 12, color: INK.softer }}>{a.card.label}</Text>
                  <Text style={{ marginTop: 2, fontSize: 24, fontWeight: "800", letterSpacing: -0.6, color: "#fff", fontVariant: ["tabular-nums"] }}>{a.card.value}</Text>
                  <Text style={{ marginTop: 2, fontSize: 12.5, color: INK.soft }}>{a.card.note}</Text>
                </View>
              </Rise>
            </View>
          </View>
        </Rise>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
        {ASKS.map((q, i) => (
          <Pressable
            key={q.q}
            onPress={() => {
              tap();
              later.clear();
              ask(i, later.at, 0);
            }}
            accessibilityRole="button"
            accessibilityLabel={q.q}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, height: 34, borderRadius: 17, backgroundColor: pick === i ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.06)" }}
          >
            <Sparkles size={12} color={INK.soft} strokeWidth={2} />
            <Text style={{ fontSize: 12.5, fontWeight: "600", color: INK.soft }}>{q.short}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Dots() {
  return (
    <View style={{ flexDirection: "row", gap: 5, paddingVertical: 7 }}>
      {[0, 1, 2].map((i) => (
        <Dot key={i} delay={i * 150} />
      ))}
    </View>
  );
}

function Dot({ delay }: { delay: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 300 }), withTiming(0, { duration: 300 })), -1)));
  }, [p, delay]);
  const style = useAnimatedStyle(() => ({ opacity: 0.35 + 0.65 * p.get(), transform: [{ translateY: -p.get() * 3 }] }));
  return <Animated.View style={[{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#fff" }, style]} />;
}
