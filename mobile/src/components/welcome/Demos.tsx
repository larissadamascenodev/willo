import { useEffect, useRef, useState, type ReactNode } from "react";
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
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { LinearGradient as Fade } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import WilloBot from "~/components/willo/WilloBot";
import { Camera, Check, Mic, Receipt, Sparkles } from "~/components/icons";
import { INK } from "~/theme/tokens";

/**
 * The welcome's demonstrations: each one a thing the app does, worked by hand.
 *
 * Hold the microphone and a sentence becomes an entry; tap Willo twice and Registro
 * rápido opens and saves; press the shutter and a receipt is read; touch a category on
 * the Radar; move what you would spend and watch the end of the month answer; ask a
 * question and get the answer. Each starts by itself once when it comes into view,
 * so someone who only scrolls still sees it happen, and can then do it again by hand.
 *
 * The figures are an example and nothing is saved: there is no account yet.
 */

export const COLD = "#6FA8E8";
export const ICE = "#DCEBFF";
const PANEL = "rgba(22,24,30,0.9)";

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

/** The glass a demonstration sits in. */
export function Stage({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <View>
      <View style={{ borderRadius: 26, borderCurve: "continuous", overflow: "hidden", backgroundColor: PANEL }}>
        <Fade colors={["rgba(111,168,232,0.12)", "rgba(111,168,232,0)"]} style={{ position: "absolute", left: 0, right: 0, top: 0, height: 120 }} />
        <View style={{ padding: 18 }}>{children}</View>
      </View>
      {hint ? <Text style={{ marginTop: 10, textAlign: "center", fontSize: 13, color: INK.softer }}>{hint}</Text> : null}
    </View>
  );
}

/** An entry as the app shows it. */
function Entry({ title, detail, amount }: { title: string; detail: string; amount: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)" }}>
        <Receipt size={18} color="#fff" strokeWidth={2} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: "700", color: "#fff" }}>
          {title}
        </Text>
        <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 13, color: INK.softer }}>
          {detail}
        </Text>
      </View>
      <Text style={{ fontSize: 17, fontWeight: "800", color: "#fff", fontVariant: ["tabular-nums"] }}>{amount}</Text>
    </View>
  );
}

function Saved({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 }}>
      <View style={{ width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(111,168,232,0.25)" }}>
        <Check size={12} color={ICE} strokeWidth={3} />
      </View>
      <Text style={{ fontSize: 13.5, color: INK.soft }}>{text}</Text>
    </View>
  );
}

/** Appears with a short rise, each time `on` turns true. */
function Rise({ on, children, delay = 0 }: { on: boolean; children: ReactNode; delay?: number }) {
  const p = useSharedValue(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    p.set(on ? (reduce ? 1 : withDelay(delay, withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }))) : 0);
  }, [on, p, delay, reduce]);
  const style = useAnimatedStyle(() => ({ opacity: p.get(), transform: [{ translateY: (1 - p.get()) * 10 }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

function useTyping(text: string, run: number, every = 40) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!run) return;
    setN(0);
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

function useCount(to: number, run: number, length = 700) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!run) return;
    const t0 = Date.now();
    const from = 0;
    const id = setInterval(() => {
      const k = Math.min(1, (Date.now() - t0) / length);
      setV(from + (to - from) * (1 - (1 - k) ** 3));
      if (k >= 1) clearInterval(id);
    }, 30);
    return () => clearInterval(id);
  }, [to, run, length]);
  return v;
}

/** Runs `go` once when `visible` first becomes true. */
function useFirstSight(visible: boolean, go: () => void, after = 500) {
  const done = useRef(false);
  useEffect(() => {
    if (!visible || done.current) return;
    done.current = true;
    const id = setTimeout(go, after);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
}

/* ------------------------------------------------------------------ */
/* 1. Voice: hold to speak                                             */
/* ------------------------------------------------------------------ */

const SAID = "almoço 32 no débito";

export function VoiceDemo({ visible }: { visible: boolean }) {
  const [phase, setPhase] = useState<"idle" | "hearing" | "done">("idle");
  const [run, setRun] = useState(0);
  const said = useTyping(SAID, run, 55);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const listen = () => {
    if (timer.current) clearTimeout(timer.current);
    setPhase("hearing");
    setRun((r) => r + 1);
    tap();
  };
  const release = () => {
    if (timer.current) clearTimeout(timer.current);
    /* Let the sentence finish, however short the hold was. */
    timer.current = setTimeout(() => {
      setPhase("done");
      success();
    }, Math.max(250, SAID.length * 55 - 200));
  };
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  useFirstSight(visible, () => {
    listen();
    release();
  });

  return (
    <Stage hint="Segure o microfone e solte">
      <View style={{ minHeight: 58, justifyContent: "center" }}>
        {phase === "idle" ? (
          <Text style={{ fontSize: 17, color: INK.softer }}>“Diga um gasto do seu jeito…”</Text>
        ) : (
          <Text style={{ fontSize: 20, fontWeight: "700", color: "#fff" }}>“{said}”</Text>
        )}
      </View>
      <Rise on={phase === "done"}>
        <View style={{ marginTop: 6, paddingTop: 14, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)" }}>
          <Entry title="Almoço" detail="Alimentação · Débito · hoje" amount="R$ 32,00" />
        </View>
      </Rise>
      <View style={{ alignItems: "center", marginTop: 16 }}>
        <Pressable
          onPressIn={listen}
          onPressOut={release}
          accessibilityRole="button"
          accessibilityLabel="Segure para falar"
          style={{ width: 88, height: 88, alignItems: "center", justifyContent: "center" }}
        >
          {phase === "hearing" && <Pulse />}
          <View style={{ width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", backgroundColor: phase === "hearing" ? "#fff" : "rgba(255,255,255,0.1)" }}>
            <Mic size={26} color={phase === "hearing" ? "#0B0D12" : "#fff"} strokeWidth={2.2} />
          </View>
        </Pressable>
        <Wave on={phase === "hearing"} />
      </View>
    </Stage>
  );
}

function Pulse() {
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(withRepeat(withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) }), -1, false));
  }, [p]);
  const style = useAnimatedStyle(() => ({ opacity: 0.5 * (1 - p.get()), transform: [{ scale: 1 + p.get() * 0.45 }] }));
  return <Animated.View style={[{ position: "absolute", width: 64, height: 64, borderRadius: 32, backgroundColor: "#fff" }, style]} />;
}

function Wave({ on }: { on: boolean }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withRepeat(withTiming(1, { duration: 1200, easing: Easing.linear }), -1, false));
  }, [t]);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 3, height: 26, marginTop: 6, opacity: on ? 1 : 0.25 }}>
      {Array.from({ length: 21 }, (_, i) => (
        <WaveBar key={i} i={i} t={t} on={on} />
      ))}
    </View>
  );
}

function WaveBar({ i, t, on }: { i: number; t: { get: () => number }; on: boolean }) {
  const style = useAnimatedStyle(() => {
    const v = t.get() * Math.PI * 2;
    const h = on ? 4 + 20 * Math.abs(Math.sin(v * 2 + i * 0.7) * Math.sin(v + i * 0.31)) : 4;
    return { height: h };
  });
  return <Animated.View style={[{ width: 3, borderRadius: 2, backgroundColor: i % 5 === 2 ? COLD : "#fff" }, style]} />;
}

/* ------------------------------------------------------------------ */
/* 2. Two taps on Willo                                                 */
/* ------------------------------------------------------------------ */

export function QuickDemo({ visible }: { visible: boolean }) {
  const [open, setOpen] = useState(0);
  const [saved, setSaved] = useState(false);
  const last = useRef(0);
  const amount = useCount(18.4, open, 800);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fire = () => {
    setSaved(false);
    setOpen((o) => o + 1);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setSaved(true);
      success();
    }, 1500);
  };
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  useFirstSight(visible, fire, 700);

  return (
    <Stage hint="Toque duas vezes no Willo">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
        <View style={{ width: 96, height: 96 }}>
          <WilloBot
            size={96}
            mode={open && !saved ? "speaking" : "idle"}
            onPress={() => {
              const now = Date.now();
              if (now - last.current < 350) {
                last.current = 0;
                fire();
              } else {
                last.current = now;
              }
            }}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, fontWeight: "600", color: INK.softer }}>Registro rápido</Text>
          <Text style={{ marginTop: 4, fontSize: 32, fontWeight: "800", letterSpacing: -1, color: open ? "#fff" : "rgba(255,255,255,0.25)", fontVariant: ["tabular-nums"] }}>
            {money(open ? amount : 0)}
          </Text>
          <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
            {["Transporte", "Mercado"].map((c, i) => (
              <View key={c} style={{ paddingHorizontal: 11, height: 28, borderRadius: 14, justifyContent: "center", backgroundColor: open && i === 0 ? "#fff" : "rgba(255,255,255,0.07)" }}>
                <Text style={{ fontSize: 12.5, fontWeight: "600", color: open && i === 0 ? "#0B0D12" : INK.soft }}>{c}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
      <Rise on={saved}>
        <Saved text="Salvo em Transporte, em 2 segundos" />
      </Rise>
    </Stage>
  );
}

/* ------------------------------------------------------------------ */
/* 3. A receipt read from a photo                                       */
/* ------------------------------------------------------------------ */

export function ReceiptDemo({ visible }: { visible: boolean }) {
  const [shot, setShot] = useState(0);
  const [read, setRead] = useState(false);
  const flash = useSharedValue(0);
  const scan = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const snap = () => {
    setRead(false);
    setShot((s) => s + 1);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
    flash.set(withSequence(withTiming(1, { duration: 60 }), withTiming(0, { duration: 380 })));
    scan.set(withSequence(withTiming(0, { duration: 0 }), withDelay(250, withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.quad) }))));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setRead(true);
      success();
    }, 1350);
  };
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  useFirstSight(visible, snap, 700);

  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.get() }));
  const scanStyle = useAnimatedStyle(() => ({ opacity: scan.get() > 0 && scan.get() < 1 ? 1 : 0, top: `${scan.get() * 100}%` }));
  const items: [string, string][] = [
    ["ARROZ 5KG", "24,90"],
    ["CAFE 500G", "18,40"],
    ["LEITE 1L X6", "35,94"],
    ["FRUTAS", "28,76"],
    ["PAO", "19,90"],
  ];

  return (
    <Stage hint="Aperte o botão para fotografar">
      <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
        <View style={{ width: 132, borderRadius: 10, backgroundColor: "rgba(236,238,242,0.94)", padding: 10, overflow: "hidden" }}>
          <Text style={{ fontSize: 8.5, fontWeight: "800", color: "#2A2C31", textAlign: "center" }}>SUPERMERCADO BOA COMPRA</Text>
          <View style={{ height: 1, marginVertical: 6, borderTopWidth: 1, borderStyle: "dashed", borderColor: "#B9BDC5" }} />
          {items.map(([n, v]) => (
            <View key={n} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
              <Text style={{ fontSize: 7.5, color: "#3B3E45" }}>{n}</Text>
              <Text style={{ fontSize: 7.5, color: "#3B3E45" }}>{v}</Text>
            </View>
          ))}
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
            <Text style={{ fontSize: 9, fontWeight: "800", color: "#1E2025" }}>TOTAL</Text>
            <Text style={{ fontSize: 9, fontWeight: "800", color: "#1E2025" }}>127,90</Text>
          </View>
          <Animated.View pointerEvents="none" style={[{ position: "absolute", left: 0, right: 0, height: 14, marginTop: -7 }, scanStyle]}>
            <Fade colors={["rgba(111,168,232,0)", "rgba(111,168,232,0.85)", "rgba(111,168,232,0)"]} style={{ flex: 1 }} />
          </Animated.View>
          <Animated.View pointerEvents="none" style={[{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "#fff" }, flashStyle]} />
        </View>
        <View style={{ flex: 1, gap: 10 }}>
          {([
            ["Local", "Supermercado Boa Compra"],
            ["Valor", "R$ 127,90"],
            ["Categoria", "Mercado · 5 itens"],
          ] as const).map(([k, v], i) => (
            <View key={k}>
              <Text style={{ fontSize: 11.5, color: INK.softer }}>{k}</Text>
              <Rise on={read} delay={i * 140}>
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>{v}</Text>
              </Rise>
              {!read && <View style={{ position: "absolute", top: 18, height: 12, width: "80%", borderRadius: 6, backgroundColor: "rgba(255,255,255,0.07)" }} />}
            </View>
          ))}
        </View>
      </View>
      <View style={{ alignItems: "center", marginTop: 16 }}>
        <Pressable
          onPress={snap}
          accessibilityRole="button"
          accessibilityLabel="Fotografar o comprovante"
          style={({ pressed }) => ({ width: 64, height: 64, borderRadius: 32, borderWidth: 3, borderColor: "#fff", alignItems: "center", justifyContent: "center", transform: [{ scale: pressed ? 0.92 : 1 }] })}
        >
          <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}>
            <Camera size={20} color="#0B0D12" strokeWidth={2.2} />
          </View>
        </Pressable>
      </View>
      {shot > 0 && (
        <Rise on={read}>
          <Saved text="Pronto para conferir, nada digitado" />
        </Rise>
      )}
    </Stage>
  );
}

/* ------------------------------------------------------------------ */
/* 4. The Radar                                                         */
/* ------------------------------------------------------------------ */

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const RADAR: { name: string; share: number; note: string }[] = [
  { name: "Mercado", share: 0.34, note: "Dentro do seu normal." },
  { name: "Delivery", share: 0.22, note: "40% acima do normal este mês." },
  { name: "Transporte", share: 0.18, note: "Caiu 12% desde o mês passado." },
  { name: "Lazer", share: 0.12, note: "Igual ao mês passado." },
];

export function RadarDemo({ visible }: { visible: boolean }) {
  const [pick, setPick] = useState(1);
  const fill = useSharedValue(0);
  const R = 70;
  const L = Math.PI * R;
  useEffect(() => {
    if (visible) fill.set(withDelay(300, withTiming(0.78, { duration: 1400, easing: Easing.out(Easing.cubic) })));
  }, [visible, fill]);
  const arc = useAnimatedProps(() => ({ strokeDashoffset: L * (1 - fill.get()) }));
  const score = useCount(78, visible ? 1 : 0, 1500);

  return (
    <Stage hint="Toque numa categoria">
      <View style={{ alignItems: "center" }}>
        <Svg width={2 * R + 20} height={R + 18}>
          <Defs>
            <LinearGradient id="radarArc" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={COLD} />
              <Stop offset="1" stopColor="#FFFFFF" />
            </LinearGradient>
          </Defs>
          <Path d={`M 10 ${R + 10} A ${R} ${R} 0 0 1 ${2 * R + 10} ${R + 10}`} stroke="rgba(255,255,255,0.1)" strokeWidth={12} strokeLinecap="round" fill="none" />
          <AnimatedPath d={`M 10 ${R + 10} A ${R} ${R} 0 0 1 ${2 * R + 10} ${R + 10}`} stroke="url(#radarArc)" strokeWidth={12} strokeLinecap="round" fill="none" strokeDasharray={`${L} ${L}`} animatedProps={arc} />
        </Svg>
        <View style={{ position: "absolute", bottom: 0, alignItems: "center" }}>
          <Text style={{ fontSize: 38, fontWeight: "800", letterSpacing: -1.2, color: "#fff", fontVariant: ["tabular-nums"] }}>{Math.round(score)}</Text>
        </View>
      </View>
      <Text style={{ textAlign: "center", fontSize: 13, color: INK.softer }}>Saúde financeira boa</Text>
      <View style={{ marginTop: 14, gap: 10 }}>
        {RADAR.map((r, i) => (
          <Pressable
            key={r.name}
            onPress={() => {
              tap();
              setPick(i);
            }}
            accessibilityRole="button"
            accessibilityLabel={`${r.name}, ${Math.round(r.share * 100)} por cento`}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, opacity: pick === i ? 1 : 0.55 }}>
              <Text style={{ width: 84, fontSize: 14, fontWeight: "600", color: "#fff" }}>{r.name}</Text>
              <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                <BarFill share={r.share} on={visible} delay={600 + i * 120} color={pick === i ? "#fff" : COLD} />
              </View>
              <Text style={{ width: 36, textAlign: "right", fontSize: 13, color: INK.soft, fontVariant: ["tabular-nums"] }}>{Math.round(r.share * 100)}%</Text>
            </View>
          </Pressable>
        ))}
      </View>
      <View style={{ marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)", flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Sparkles size={14} color={ICE} strokeWidth={2.2} />
        <Text style={{ flex: 1, fontSize: 14, color: "#fff" }}>
          <Text style={{ fontWeight: "700" }}>{RADAR[pick].name}: </Text>
          {RADAR[pick].note}
        </Text>
      </View>
    </Stage>
  );
}

function BarFill({ share, on, delay, color }: { share: number; on: boolean; delay: number; color: string }) {
  const w = useSharedValue(0);
  useEffect(() => {
    if (on) w.set(withDelay(delay, withTiming(share / 0.4, { duration: 900, easing: Easing.out(Easing.cubic) })));
  }, [on, w, share, delay]);
  const style = useAnimatedStyle(() => ({ width: `${w.get() * 100}%` }));
  return <Animated.View style={[{ height: "100%", borderRadius: 4, backgroundColor: color }, style]} />;
}

/* ------------------------------------------------------------------ */
/* 5. The month ahead, and what if                                       */
/* ------------------------------------------------------------------ */

const EXTRA = [0, 200, 500];

export function ForecastDemo({ visible }: { visible: boolean }) {
  const [extra, setExtra] = useState(0);
  const W = 300;
  const H = 120;
  const base = [2600, 2480, 2410, 4180, 3900, 3720, 3460, 3300, 3120, 2980];
  const ahead = [2980, 2760, 2540, 2190, 1980, 1700, 1420, 1240];
  const end = useSharedValue(1240);
  const draw = useSharedValue(0);
  useEffect(() => {
    if (visible) draw.set(withDelay(250, withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.cubic) })));
  }, [visible, draw]);
  useEffect(() => {
    end.set(withTiming(1240 - extra, { duration: 600, easing: Easing.out(Easing.cubic) }));
  }, [extra, end]);
  const [shown, setShown] = useState(1240);
  useEffect(() => {
    const from = shown;
    const to = 1240 - extra;
    const t0 = Date.now();
    const id = setInterval(() => {
      const k = Math.min(1, (Date.now() - t0) / 600);
      setShown(from + (to - from) * (1 - (1 - k) ** 3));
      if (k >= 1) clearInterval(id);
    }, 30);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extra]);

  const lo = 500;
  const hi = 4400;
  const n = base.length + ahead.length - 1;
  const x = (k: number) => 4 + (k / n) * (W - 8);
  const y = (v: number) => 6 + (1 - (v - lo) / (hi - lo)) * (H - 12);
  const past = base.map((v, k) => `${k === 0 ? "M" : "L"} ${x(k).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const today = base.length - 1;
  const D = 1200;
  const pastProps = useAnimatedProps(() => ({ strokeDashoffset: D * (1 - draw.get()) }));
  const aheadProps = useAnimatedProps(() => {
    const drop = 1240 - end.get();
    const d = ahead
      .map((v, k) => {
        const share = k / (ahead.length - 1);
        return `${k === 0 ? "M" : "L"} ${x(today + k).toFixed(1)} ${y(v - drop * share).toFixed(1)}`;
      })
      .join(" ");
    return { d, opacity: draw.get() };
  });
  const dotProps = useAnimatedProps(() => ({ cy: y(end.get()), opacity: draw.get() }));

  return (
    <Stage hint="E se você gastar mais?">
      <Text style={{ fontSize: 12.5, color: INK.softer }}>Sobra no fim do mês</Text>
      <Text style={{ marginTop: 2, fontSize: 36, fontWeight: "800", letterSpacing: -1.2, color: "#fff", fontVariant: ["tabular-nums"] }}>{money(shown)}</Text>
      <View style={{ marginTop: 10, alignItems: "center" }}>
        <Svg width={W} height={H}>
          <AnimatedPath d={past} stroke="#FFFFFF" strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" fill="none" strokeDasharray={`${D} ${D}`} animatedProps={pastProps} />
          <AnimatedPath stroke={COLD} strokeWidth={2.2} strokeDasharray="5 6" strokeLinecap="round" fill="none" animatedProps={aheadProps} />
          <Circle cx={x(today)} cy={y(base[today])} r={5} fill="#fff" />
          <AnimatedCircle cx={x(n)} r={5} fill={COLD} animatedProps={dotProps} />
        </Svg>
      </View>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
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
    </Stage>
  );
}

/* ------------------------------------------------------------------ */
/* 6. Ask                                                               */
/* ------------------------------------------------------------------ */

const ASKS: { q: string; a: string }[] = [
  { q: "Posso gastar R$ 200 no fim de semana?", a: "Pode, sim. Depois disso ainda sobram R$ 540 até o dia 30, já contando a fatura." },
  { q: "Quanto gastei com delivery?", a: "R$ 386 este mês, em 11 pedidos. É 40% mais do que você costuma." },
  { q: "Quando vence a fatura?", a: "Dia 12, R$ 1.240. Te aviso na véspera." },
];

export function AskDemo({ visible }: { visible: boolean }) {
  const [pick, setPick] = useState<number | null>(null);
  const [run, setRun] = useState(0);
  const [thinking, setThinking] = useState(false);
  const answer = useTyping(pick === null ? "" : ASKS[pick].a, thinking ? 0 : run, 22);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ask = (i: number) => {
    tap();
    setPick(i);
    setThinking(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setThinking(false);
      setRun((r) => r + 1);
    }, 900);
  };
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  useFirstSight(visible, () => ask(0), 600);

  return (
    <Stage hint="Toque numa pergunta">
      <View style={{ minHeight: 150, gap: 10 }}>
        {pick !== null && (
          <View style={{ alignSelf: "flex-end", maxWidth: "86%", backgroundColor: "rgba(255,255,255,0.94)", borderRadius: 18, borderBottomRightRadius: 6, paddingHorizontal: 14, paddingVertical: 9 }}>
            <Text style={{ fontSize: 15, fontWeight: "600", color: "#0B0D12" }}>{ASKS[pick].q}</Text>
          </View>
        )}
        {pick !== null && (
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
            <View style={{ width: 40, height: 40 }}>
              <WilloBot size={40} mode={thinking ? "thinking" : "speaking"} />
            </View>
            <View style={{ flex: 1, alignItems: "flex-start" }}>
              <View style={{ maxWidth: "100%", backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 18, borderBottomLeftRadius: 6, paddingHorizontal: 14, paddingVertical: 9 }}>
                {thinking ? <Dots /> : (
                  <View>
                    <Text style={{ fontSize: 15, lineHeight: 20, color: "transparent" }}>{ASKS[pick].a}</Text>
                    <Text style={{ position: "absolute", left: 0, top: 0, right: 0, fontSize: 15, lineHeight: 20, color: "#fff" }}>{answer}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}
      </View>
      <View style={{ gap: 8, marginTop: 14 }}>
        {ASKS.map((a, i) => (
          <Pressable
            key={a.q}
            onPress={() => ask(i)}
            accessibilityRole="button"
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, height: 40, borderRadius: 20, backgroundColor: pick === i ? "rgba(255,255,255,0.14)" : pressed ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.06)" })}
          >
            <Sparkles size={13} color={INK.soft} strokeWidth={2} />
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, fontWeight: "600", color: INK.soft }}>
              {a.q}
            </Text>
          </Pressable>
        ))}
      </View>
    </Stage>
  );
}

function Dots() {
  return (
    <View style={{ flexDirection: "row", gap: 5, paddingVertical: 6 }}>
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

/* ------------------------------------------------------------------ */
/* 0. Willo Atento: purchases read from the bank's notifications        */
/* ------------------------------------------------------------------ */

const PURCHASES = [
  { merchant: "UBER *TRIP", title: "Uber", category: "Transporte", how: "Débito", amount: 18.4 },
  { merchant: "IFOOD *RESTAURANTE", title: "iFood", category: "Delivery", how: "Crédito", amount: 42.9 },
  { merchant: "SUPERMERCADO BOA COMPRA", title: "Supermercado Boa Compra", category: "Mercado", how: "Débito", amount: 127.9 },
];

export function NotifyDemo({ visible }: { visible: boolean }) {
  const [k, setK] = useState(-1);
  const [caught, setCaught] = useState(false);
  const drop = useSharedValue(0);
  const fly = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buy = () => {
    if (timer.current) clearTimeout(timer.current);
    setCaught(false);
    setK((v) => (v + 1) % PURCHASES.length);
    fly.set(0);
    drop.set(withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: 520, easing: Easing.out(Easing.back(1.2)) })));
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
    timer.current = setTimeout(() => {
      fly.set(withTiming(1, { duration: 650, easing: Easing.inOut(Easing.cubic) }));
      timer.current = setTimeout(() => {
        setCaught(true);
        success();
      }, 520);
    }, 1300);
  };
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  useFirstSight(visible, buy, 600);

  const p = k >= 0 ? PURCHASES[k] : PURCHASES[0];
  const banner = useAnimatedStyle(() => ({
    opacity: drop.get() * (1 - fly.get() * 0.65),
    transform: [{ translateY: (1 - drop.get()) * -40 + fly.get() * 18 }, { scale: 1 - fly.get() * 0.06 }],
  }));
  const beam = useAnimatedStyle(() => ({ opacity: Math.sin(Math.PI * fly.get()), transform: [{ scaleY: 0.2 + fly.get() * 0.8 }] }));

  return (
    <Stage hint="Toque em simular para fazer outra compra">
      {/* The notification, as the phone shows it. */}
      <Animated.View style={banner}>
        <View style={{ flexDirection: "row", gap: 10, padding: 12, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.1)" }}>
          <View style={{ width: 34, height: 34, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.14)" }}>
            <Receipt size={16} color="#fff" strokeWidth={2} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: "#fff" }}>Seu banco</Text>
              <Text style={{ fontSize: 12, color: INK.softer }}>agora</Text>
            </View>
            <Text numberOfLines={2} style={{ marginTop: 2, fontSize: 13.5, lineHeight: 18, color: INK.soft }}>
              Compra no {p.how.toLowerCase()} aprovada: {money(p.amount)} em {p.merchant}
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* Willo catching it. */}
      <View style={{ height: 34, alignItems: "center", justifyContent: "center" }}>
        <Animated.View style={[{ width: 2, height: 34, borderRadius: 1, backgroundColor: ICE }, beam]} />
      </View>

      <View style={{ minHeight: 86, justifyContent: "center" }}>
        {k >= 0 ? (
          <Rise key={k} on={caught}>
            <Entry title={p.title} detail={`${p.category} · ${p.how} · agora`} amount={money(p.amount)} />
            <Saved text="Anotado sozinho, você só confere" />
          </Rise>
        ) : null}
      </View>

      <View style={{ alignItems: "center", marginTop: 12 }}>
        <Pressable
          onPress={() => {
            tap();
            buy();
          }}
          accessibilityRole="button"
          style={({ pressed }) => ({ paddingHorizontal: 18, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.09)" })}
        >
          <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>Simular outra compra</Text>
        </Pressable>
      </View>
    </Stage>
  );
}
