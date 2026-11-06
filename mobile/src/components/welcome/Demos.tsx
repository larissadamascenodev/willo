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
import Svg, { Circle, Defs, Line, LinearGradient, Path, Polygon, Rect, Stop } from "react-native-svg";
import { LinearGradient as Fade } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import WilloBot from "~/components/willo/WilloBot";
import { Scope, type SectorKey, SECTORS } from "~/components/radar/parts";
import { Bell, Check, Mic, Receipt, Sparkles } from "~/components/icons";
import { INK } from "~/theme/tokens";

/**
 * The welcome's demonstrations, one per slide. Each plays on its own, over and over,
 * while its slide is the one showing (`active`), and can be worked by hand too.
 *
 * Every one uses the app's own vocabulary — the dark glass, white, the cold blue —
 * and the Radar uses the Radar's own dial. The figures are an example and nothing is
 * saved: there is no account yet.
 *
 * Anything that runs inside an animation is either plain arithmetic or marked as a
 * worklet: on the phone a plain function called there closes the app.
 */

export const COLD = "#6FA8E8";
export const ICE = "#DCEBFF";
const PANEL = "rgba(22,24,30,0.92)";

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

/** A counter that ticks every `period` ms while `active`, from 0 each time it starts. */
function useCycle(active: boolean, period: number) {
  const [n, setN] = useState(-1);
  useEffect(() => {
    if (!active) {
      setN(-1);
      return;
    }
    setN(0);
    const id = setInterval(() => setN((k) => k + 1), period);
    return () => clearInterval(id);
  }, [active, period]);
  return n;
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

function useTyping(text: string, run: number, every = 40) {
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

/** A number that eases from wherever it is to `to` whenever `to` changes or `run` ticks. */
function useEased(to: number, run: number, length = 700, start = 0) {
  const [v, setV] = useState(start);
  const now = useRef(start);
  useEffect(() => {
    if (run <= 0) return;
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
  }, [to, run, length]);
  return v;
}

/** Appears with a short rise each time `on` turns true. */
function Rise({ on, children, delay = 0, from = 12 }: { on: boolean; children: ReactNode; delay?: number; from?: number }) {
  const p = useSharedValue(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    p.set(on ? (reduce ? 1 : withDelay(delay, withTiming(1, { duration: 440, easing: Easing.out(Easing.cubic) }))) : withTiming(0, { duration: 160 }));
  }, [on, p, delay, reduce]);
  const style = useAnimatedStyle(() => ({ opacity: p.get(), transform: [{ translateY: (1 - p.get()) * from }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/** An entry as the app shows it. */
function Entry({ title, detail, amount, dim }: { title: string; detail: string; amount: string; dim?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, opacity: dim ? 0.5 : 1 }}>
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
      <Text style={{ fontSize: 16.5, fontWeight: "800", color: "#fff", fontVariant: ["tabular-nums"] }}>{amount}</Text>
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

function Glass({ children, style }: { children: ReactNode; style?: object }) {
  return (
    <View style={[{ borderRadius: 24, borderCurve: "continuous", overflow: "hidden", backgroundColor: PANEL }, style]}>
      <Fade colors={["rgba(111,168,232,0.12)", "rgba(111,168,232,0)"]} style={{ position: "absolute", left: 0, right: 0, top: 0, height: 110 }} />
      {children}
    </View>
  );
}

/* ================================================================== */
/* Willo Atento: purchases read from the bank's notifications          */
/* ================================================================== */

const PURCHASES = [
  { merchant: "UBER *TRIP", title: "Uber", category: "Transporte", how: "Débito", amount: 18.4 },
  { merchant: "IFOOD *RESTAURANTE", title: "iFood", category: "Delivery", how: "Crédito", amount: 42.9 },
  { merchant: "SUPERMERCADO BOA COMPRA", title: "Supermercado Boa Compra", category: "Mercado", how: "Débito", amount: 127.9 },
];

export function NotifyDemo({ active }: { active: boolean }) {
  const n = useCycle(active, 3600);
  const later = useLater();
  const [caught, setCaught] = useState<number[]>([]);
  const [now, setNow] = useState(-1);
  const drop = useSharedValue(0);
  const fly = useSharedValue(0);

  useEffect(() => {
    later.clear();
    if (n < 0) {
      setCaught([]);
      setNow(-1);
      drop.set(0);
      return;
    }
    const k = n % PURCHASES.length;
    setNow(k);
    fly.set(0);
    drop.set(withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: 520, easing: Easing.out(Easing.back(1.2)) })));
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
    later.at(1300, () => fly.set(withTiming(1, { duration: 650, easing: Easing.inOut(Easing.cubic) })));
    later.at(1850, () => {
      setCaught((c) => [k, ...c.filter((x) => x !== k)].slice(0, 3));
      success();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  const p = PURCHASES[Math.max(0, now)];
  const banner = useAnimatedStyle(() => ({
    opacity: drop.get() * (1 - fly.get() * 0.7),
    transform: [{ translateY: (1 - drop.get()) * -40 + fly.get() * 22 }, { scale: 1 - fly.get() * 0.08 }],
  }));
  const beam = useAnimatedStyle(() => ({ opacity: Math.sin(Math.PI * fly.get()), transform: [{ scaleY: 0.2 + fly.get() * 0.8 }] }));

  return (
    <View style={{ width: "100%" }}>
      {/* The notification, as the phone shows it. */}
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
              Compra no {p.how.toLowerCase()} aprovada: {money(p.amount)} em {p.merchant}
            </Text>
          </View>
        </View>
      </Animated.View>

      <View style={{ height: 40, alignItems: "center", justifyContent: "center" }}>
        <Animated.View style={[{ width: 2, height: 40, borderRadius: 1, backgroundColor: ICE }, beam]} />
      </View>

      <Glass>
        <View style={{ padding: 16, gap: 14, minHeight: 196 }}>
          <Text style={{ fontFamily: "Menlo", fontSize: 11, letterSpacing: 1.2, color: "rgba(200,220,245,0.7)" }}>ANOTADO SOZINHO</Text>
          {caught.map((k, i) => (
            <Rise key={`${k}-${caught.length}-${i}`} on>
              <Entry title={PURCHASES[k].title} detail={`${PURCHASES[k].category} · ${PURCHASES[k].how} · agora`} amount={money(PURCHASES[k].amount)} dim={i > 0} />
            </Rise>
          ))}
        </View>
      </Glass>
    </View>
  );
}

/* ================================================================== */
/* Voice: hold to speak, and a few different sentences                 */
/* ================================================================== */

const SAYINGS = [
  { said: "almoço 32 no débito", title: "Almoço", detail: "Alimentação · Débito · hoje", amount: "R$ 32,00" },
  { said: "uber 18 ontem", title: "Uber", detail: "Transporte · ontem", amount: "R$ 18,00" },
  { said: "ifood 45 no crédito", title: "iFood", detail: "Delivery · Crédito · hoje", amount: "R$ 45,00" },
  { said: "mercado 127 no pix", title: "Mercado", detail: "Supermercado · Pix · hoje", amount: "R$ 127,00" },
  { said: "recebi 300 de freela", title: "Freela", detail: "Entrada · hoje", amount: "+R$ 300,00" },
];

export function VoiceDemo({ active }: { active: boolean }) {
  const auto = useCycle(active, 3400);
  const later = useLater();
  const [step, setStep] = useState(0);
  const [hearing, setHearing] = useState(false);
  const [list, setList] = useState<number[]>([]);
  const k = step % SAYINGS.length;
  const said = useTyping(SAYINGS[k].said, hearing ? step + 1 : 0, 50);

  const say = (i: number) => {
    later.clear();
    setStep(i);
    setHearing(true);
    later.at(SAYINGS[i % SAYINGS.length].said.length * 50 + 350, () => {
      setHearing(false);
      setList((l) => [i % SAYINGS.length, ...l].slice(0, 3));
      success();
    });
  };
  useEffect(() => {
    if (auto < 0) {
      later.clear();
      setList([]);
      setHearing(false);
      return;
    }
    say(auto);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

  return (
    <View style={{ width: "100%", alignItems: "center" }}>
      <View style={{ minHeight: 64, justifyContent: "center", alignSelf: "stretch" }}>
        <Text style={{ fontSize: 24, fontWeight: "700", letterSpacing: -0.5, color: hearing ? "#fff" : "rgba(255,255,255,0.35)", textAlign: "center" }}>
          “{hearing ? said : SAYINGS[k].said}”
        </Text>
      </View>
      <Pressable
        onPressIn={() => {
          tap();
          say(step + 1);
        }}
        accessibilityRole="button"
        accessibilityLabel="Segure para falar"
        style={{ width: 96, height: 96, alignItems: "center", justifyContent: "center", marginTop: 4 }}
      >
        {hearing && <Pulse />}
        <View style={{ width: 70, height: 70, borderRadius: 35, alignItems: "center", justifyContent: "center", backgroundColor: hearing ? "#fff" : "rgba(255,255,255,0.1)" }}>
          <Mic size={28} color={hearing ? "#0B0D12" : "#fff"} strokeWidth={2.2} />
        </View>
      </Pressable>
      <Wave on={hearing} />
      <Glass style={{ alignSelf: "stretch", marginTop: 16 }}>
        <View style={{ padding: 16, gap: 14, minHeight: 160 }}>
          {list.map((i, row) => (
            <Rise key={`${i}-${list.length}-${row}`} on>
              <Entry title={SAYINGS[i].title} detail={SAYINGS[i].detail} amount={SAYINGS[i].amount} dim={row > 0} />
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
    p.set(withRepeat(withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) }), -1, false));
  }, [p]);
  const style = useAnimatedStyle(() => ({ opacity: 0.5 * (1 - p.get()), transform: [{ scale: 1 + p.get() * 0.45 }] }));
  return <Animated.View style={[{ position: "absolute", width: 70, height: 70, borderRadius: 35, backgroundColor: "#fff" }, style]} />;
}

function Wave({ on }: { on: boolean }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withRepeat(withTiming(1, { duration: 1200, easing: Easing.linear }), -1, false));
  }, [t]);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 3, height: 28, marginTop: 6, opacity: on ? 1 : 0.25 }}>
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
/* Two taps: on the back of the phone, or on Willo                     */
/* ================================================================== */

const PHONE_W = 172;
const PHONE_H = 340;

export function QuickDemo({ active }: { active: boolean }) {
  const n = useCycle(active, 4200);
  const later = useLater();
  const back = n >= 0 && n % 2 === 0;
  const [face, setFace] = useState<"back" | "front">("front");
  const [open, setOpen] = useState(0);
  const [saved, setSaved] = useState(false);
  const turn = useSharedValue(1);
  const knock = useSharedValue(0);
  const sheet = useSharedValue(0);
  const amount = useEased(18.4, open, 800);

  useEffect(() => {
    later.clear();
    setSaved(false);
    sheet.set(withTiming(0, { duration: 200 }));
    if (n < 0) return;
    const knocks = withSequence(withTiming(0, { duration: 300 }), withTiming(1, { duration: 120 }), withTiming(0, { duration: 160 }), withTiming(1, { duration: 120 }), withTiming(0, { duration: 260 }));
    setFace(back ? "back" : "front");
    turn.set(1);
    knock.set(knocks);
    later.at(420, knockFeel);
    later.at(700, knockFeel);
    if (back) {
      /* Turn the phone round to its screen. */
      later.at(1000, () => turn.set(withTiming(0, { duration: 220, easing: Easing.in(Easing.quad) })));
      later.at(1230, () => {
        setFace("front");
        turn.set(withTiming(1, { duration: 260, easing: Easing.out(Easing.quad) }));
      });
    }
    later.at(back ? 1550 : 1000, () => {
      setOpen((o) => o + 1);
      sheet.set(withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }));
    });
    later.at(back ? 2700 : 2200, () => {
      setSaved(true);
      success();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  const phone = useAnimatedStyle(() => ({ transform: [{ scaleX: 0.04 + 0.96 * turn.get() }] }));
  const ripple = useAnimatedStyle(() => ({ opacity: knock.get() * 0.9, transform: [{ scale: 0.6 + knock.get() * 0.6 }] }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - sheet.get()) * (PHONE_H * 0.62) }] }));

  return (
    <View style={{ alignItems: "center" }}>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
        {(
          [
            ["Atrás do celular", back],
            ["No Willo", !back && n >= 0],
          ] as const
        ).map(([label, on]) => (
          <View key={label} style={{ paddingHorizontal: 13, height: 32, borderRadius: 16, justifyContent: "center", backgroundColor: on ? "#fff" : "rgba(255,255,255,0.07)" }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: on ? "#0B0D12" : INK.soft }}>{label}</Text>
          </View>
        ))}
      </View>

      <Animated.View style={[{ width: PHONE_W, height: PHONE_H }, phone]}>
        <View style={{ flex: 1, borderRadius: 34, borderWidth: 2, borderColor: "rgba(255,255,255,0.22)", backgroundColor: face === "back" ? "#1A1C21" : "#0B0C0F", overflow: "hidden" }}>
          {face === "back" ? (
            <>
              {/* The camera block on a matte back. */}
              <View style={{ position: "absolute", left: 14, top: 14, width: 62, height: 62, borderRadius: 18, backgroundColor: "#24272D" }}>
                {[
                  [10, 10],
                  [34, 10],
                  [10, 34],
                ].map(([x, y]) => (
                  <View key={`${x}${y}`} style={{ position: "absolute", left: x, top: y, width: 18, height: 18, borderRadius: 9, backgroundColor: "#0A0B0D", borderWidth: 2, borderColor: "#353941" }} />
                ))}
              </View>
              <Fade colors={["rgba(255,255,255,0.06)", "rgba(255,255,255,0)"]} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} />
            </>
          ) : (
            <>
              {/* The app, with Willo, and Registro rápido rising over it. */}
              <View style={{ alignItems: "center", marginTop: 46 }}>
                <View style={{ width: 70, height: 70 }}>
                  <WilloBot size={70} mode={saved ? "speaking" : "idle"} />
                </View>
                <View style={{ marginTop: 10, width: 96, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.12)" }} />
                <View style={{ marginTop: 6, width: 64, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.07)" }} />
              </View>
              <Animated.View style={[{ position: "absolute", left: 0, right: 0, bottom: 0, height: PHONE_H * 0.6, borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: "#1B1E25", padding: 14 }, sheetStyle]}>
                <View style={{ alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)" }} />
                <Text style={{ marginTop: 12, fontSize: 11, fontWeight: "600", color: INK.softer }}>Registro rápido</Text>
                <Text style={{ marginTop: 4, fontSize: 26, fontWeight: "800", letterSpacing: -0.8, color: "#fff", fontVariant: ["tabular-nums"] }}>{money(amount)}</Text>
                <View style={{ flexDirection: "row", gap: 5, marginTop: 8 }}>
                  {["Transporte", "Mercado"].map((c, i) => (
                    <View key={c} style={{ paddingHorizontal: 8, height: 22, borderRadius: 11, justifyContent: "center", backgroundColor: i === 0 ? "#fff" : "rgba(255,255,255,0.08)" }}>
                      <Text style={{ fontSize: 10, fontWeight: "700", color: i === 0 ? "#0B0D12" : INK.soft }}>{c}</Text>
                    </View>
                  ))}
                </View>
                <Rise on={saved} from={6}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14 }}>
                    <Check size={13} color={ICE} strokeWidth={3} />
                    <Text style={{ fontSize: 12, color: "#fff", fontWeight: "600" }}>Salvo</Text>
                  </View>
                </Rise>
              </Animated.View>
            </>
          )}
          {/* Where the finger knocks: the middle of the back, or on Willo. */}
          <Animated.View
            pointerEvents="none"
            style={[
              { position: "absolute", left: PHONE_W / 2 - 30, top: face === "back" ? PHONE_H / 2 - 30 : 51, width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: ICE, backgroundColor: "rgba(220,235,255,0.15)" },
              ripple,
            ]}
          />
        </View>
      </Animated.View>
    </View>
  );
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
  const n = useCycle(active, 5600);
  const later = useLater();
  const scan = useSharedValue(0);
  const flash = useSharedValue(0);
  const [marks, setMarks] = useState(false);
  const [read, setRead] = useState(false);

  useEffect(() => {
    later.clear();
    setMarks(false);
    setRead(false);
    if (n < 0) return;
    flash.set(withSequence(withTiming(0, { duration: 250 }), withTiming(1, { duration: 60 }), withTiming(0, { duration: 420 })));
    later.at(260, () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined));
    scan.set(withSequence(withTiming(0, { duration: 0 }), withDelay(500, withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }))));
    later.at(2050, () => setMarks(true));
    later.at(2700, () => {
      setRead(true);
      success();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  const scanStyle = useAnimatedStyle(() => ({ opacity: scan.get() > 0 && scan.get() < 1 ? 1 : 0, transform: [{ translateY: scan.get() * RECEIPT_H }] }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.get() * 0.85 }));
  const mono = { fontFamily: "Menlo", color: "#2B2E35" };
  const mark = { position: "absolute" as const, left: 8, right: 8, borderRadius: 4, borderWidth: 1.5, borderColor: COLD, backgroundColor: "rgba(111,168,232,0.14)" };

  return (
    <View style={{ alignItems: "center" }}>
      <View style={{ width: RECEIPT_W + 28, height: RECEIPT_H + 30, alignItems: "center", justifyContent: "center" }}>
        {/* The paper: thermal white, a little warm, with a torn zigzag foot. */}
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

          {/* What the reader found: the store, the total, the payment and date. */}
          {marks && (
            <>
              <View pointerEvents="none" style={[mark, { top: 10, height: 15 }]} />
              <View pointerEvents="none" style={[mark, { top: 214, height: 17 }]} />
              <View pointerEvents="none" style={[mark, { top: 232, height: 24 }]} />
            </>
          )}
          <Animated.View pointerEvents="none" style={[{ position: "absolute", left: -6, right: -6, top: -10, height: 20 }, scanStyle]}>
            <Fade colors={["rgba(111,168,232,0)", "rgba(111,168,232,0.9)", "rgba(111,168,232,0)"]} style={{ flex: 1 }} />
          </Animated.View>
          <Animated.View pointerEvents="none" style={[{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "#fff" }, flashStyle]} />
        </View>
        <Viewfinder />
      </View>

      <View style={{ alignSelf: "stretch", marginTop: -40 }}>
        <Rise on={read} from={20}>
          <Glass>
            <View style={{ padding: 16 }}>
              <Entry title="Supermercado Boa Compra" detail="Mercado · Débito · 7 itens" amount="R$ 127,90" />
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
/* The Radar: its own dial, going round the areas                       */
/* ================================================================== */

const FINDINGS: Record<SectorKey, { line: string; note: string; risk?: boolean }> = {
  consumo: { line: "Você gastou 18% menos que no mês passado.", note: "Mercado é o maior gasto: R$ 812." },
  habitos: { line: "Delivery virou rotina: 11 pedidos.", note: "40% acima do seu normal.", risk: true },
  compromissos: { line: "R$ 1.890 já comprometidos até o dia 30.", note: "Fatura, aluguel e 3 assinaturas." },
  futuro: { line: "Você fecha o mês com R$ 1.240.", note: "No ritmo dos últimos 14 dias." },
  saude: { line: "Saúde financeira 78: boa.", note: "Sobra 12% da renda todo mês." },
  simular: { line: "Um celular de R$ 2.400 em 10x cabe.", note: "Mas a sua sobra cai para R$ 420." },
};

export function RadarDemo({ active }: { active: boolean }) {
  const auto = useCycle(active, 2600);
  const [picked, setPicked] = useState<SectorKey | null>(null);
  const key: SectorKey = picked ?? SECTORS[Math.max(0, auto) % SECTORS.length].key;
  const f = FINDINGS[key];
  useEffect(() => {
    if (!active) setPicked(null);
  }, [active]);
  return (
    <View style={{ alignItems: "center", width: "100%" }}>
      <Scope
        size={250}
        selected={key}
        onSelect={(k) => {
          tap();
          setPicked(k);
        }}
        blips={{ habitos: { risk: 1, note: 0 }, compromissos: { risk: 0, note: 2 }, consumo: { risk: 0, note: 1 }, futuro: { risk: 0, note: 1 } }}
      />
      <View style={{ alignSelf: "stretch", minHeight: 80, marginTop: 16 }}>
        <Rise key={key} on>
          <Text style={{ fontSize: 20, lineHeight: 26, fontWeight: "700", letterSpacing: -0.4, color: f.risk ? "#FF8A7A" : "#fff", textAlign: "center" }}>{f.line}</Text>
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
  const auto = useCycle(active, 2400);
  const [picked, setPicked] = useState<number | null>(null);
  const extra = picked ?? EXTRA[Math.max(0, auto) % EXTRA.length];
  useEffect(() => {
    if (!active) setPicked(null);
  }, [active]);

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

  const drop = useSharedValue(0);
  const draw = useSharedValue(0);
  useEffect(() => {
    draw.set(active ? withDelay(150, withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.cubic) })) : 0);
  }, [active, draw]);
  useEffect(() => {
    drop.set(withTiming(extra, { duration: 650, easing: Easing.out(Easing.cubic) }));
  }, [extra, drop]);
  const total = useEased(1240 - extra, 1, 650, 1240);

  const D = 900;
  const pastProps = useAnimatedProps(() => ({ strokeDashoffset: D * (1 - draw.get()) }));
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
      <Text style={{ marginTop: 2, fontSize: 40, fontWeight: "800", letterSpacing: -1.4, color: "#fff", fontVariant: ["tabular-nums"] }}>{money(total)}</Text>
      <View style={{ marginTop: 12, alignItems: "center" }}>
        <Svg width={W} height={H}>
          <Defs>
            <LinearGradient id="fcArea" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.16} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path d={area} fill="url(#fcArea)" />
          <Line x1={x(today)} y1={4} x2={x(today)} y2={H} stroke="rgba(255,255,255,0.18)" strokeDasharray="2 4" />
          <AnimatedPath d={pastD} stroke="#FFFFFF" strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" fill="none" strokeDasharray={`${D} ${D}`} animatedProps={pastProps} />
          <AnimatedPath d={aheadStart} stroke={COLD} strokeWidth={2.2} strokeDasharray="5 6" strokeLinecap="round" fill="none" animatedProps={aheadProps} />
          {bills.map((b) => (
            <Rect key={b.label} x={x(b.at) - 4} y={H - 14} width={8} height={8} rx={2} fill={ICE} opacity={0.85} />
          ))}
          <Circle cx={x(today)} cy={y(past[today])} r={5} fill="#fff" />
          <AnimatedCircle cx={x(n)} cy={y(1240)} r={5.5} fill={COLD} animatedProps={endProps} />
        </Svg>
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
              <Text style={{ color: INK.softer }}> · vence em {b.at - today} dias, aviso na véspera</Text>
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
              setPicked(e);
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
/* Ask                                                                 */
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
  const auto = useCycle(active, 5200);
  const later = useLater();
  const [pick, setPick] = useState(0);
  const [thinking, setThinking] = useState(true);
  const [run, setRun] = useState(0);
  const [card, setCard] = useState(false);
  const answer = useTyping(ASKS[pick].a, thinking ? 0 : run, 22);

  const ask = (i: number) => {
    later.clear();
    setPick(i);
    setThinking(true);
    setCard(false);
    later.at(900, () => {
      setThinking(false);
      setRun((r) => r + 1);
    });
    later.at(900 + ASKS[i].a.length * 22 + 200, () => setCard(true));
  };
  useEffect(() => {
    if (auto < 0) {
      later.clear();
      return;
    }
    ask(auto % ASKS.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

  const a = ASKS[pick];
  return (
    <View style={{ width: "100%" }}>
      <View style={{ minHeight: 256, gap: 10 }}>
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
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
        {ASKS.map((q, i) => (
          <Pressable
            key={q.q}
            onPress={() => {
              tap();
              ask(i);
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
