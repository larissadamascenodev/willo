import { useEffect, useRef, useState, type ReactNode } from "react";
import { Text, View } from "react-native";
import Animated, { Easing, FadeInDown, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Camera, Check, Mic } from "~/components/icons";
import { C } from "./kit";

/**
 * Two taps on the back of the phone, and the quick entry rises up the screen.
 *
 * A real-looking iPhone — titanium band, side buttons, the black border, the Dynamic
 * Island, glass over it — showing the app's own home. Two knocks ring out from behind
 * it, the quick entry slides up from the bottom of the screen, the entry is typed,
 * becomes a filled-in line and is saved; then it slides away and it all starts again.
 */

const W = 206;
const H = 420;
const BAND = 3.5;
const BEZEL = 6;
const R = 48;
const LOOP = 7600;
const TYPED = "uber 18,40";

export default function QuickTap() {
  const knock = useSharedValue(0);
  const sheet = useSharedValue(0);
  const [typed, setTyped] = useState("");
  const [filled, setFilled] = useState(false);
  const [saved, setSaved] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const at = (ms: number, run: () => void) => timers.current.push(setTimeout(run, ms));
    const play = () => {
      setTyped("");
      setFilled(false);
      setSaved(false);
      at(700, () => {
        knock.set(withSequence(withTiming(1, { duration: 140 }), withTiming(0, { duration: 200 }), withTiming(1, { duration: 140 }), withTiming(0, { duration: 420 })));
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      });
      at(1040, () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined));
      at(1500, () => sheet.set(withSpring(1, { damping: 18, stiffness: 140 })));
      TYPED.split("").forEach((_, i) => at(2300 + i * 110, () => setTyped(TYPED.slice(0, i + 1))));
      at(2300 + TYPED.length * 110 + 250, () => setFilled(true));
      at(4300, () => {
        setSaved(true);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      });
      at(6200, () => sheet.set(withTiming(0, { duration: 520, easing: Easing.in(Easing.cubic) })));
      at(LOOP, play);
    };
    play();
    const list = timers.current;
    return () => list.forEach(clearTimeout);
  }, [knock, sheet]);

  const ring1 = useAnimatedStyle(() => ({ opacity: knock.get() * 0.55, transform: [{ scale: 0.7 + knock.get() * 0.5 }] }));
  const ring2 = useAnimatedStyle(() => ({ opacity: knock.get() * 0.3, transform: [{ scale: 0.9 + knock.get() * 0.75 }] }));
  const toc = useAnimatedStyle(() => ({ opacity: knock.get(), transform: [{ translateY: (1 - knock.get()) * 6 }] }));
  const rise = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - sheet.get()) * (H * 0.75) }] }));
  const dim = useAnimatedStyle(() => ({ opacity: sheet.get() * 0.55 }));

  return (
    <View style={{ width: W + 120, height: H + 10, alignItems: "center", justifyContent: "center" }}>
      {/* The knocks, ringing out from behind the phone. */}
      <Animated.View pointerEvents="none" style={[{ position: "absolute", width: W + 70, height: W + 70, borderRadius: (W + 70) / 2, borderWidth: 2, borderColor: "rgba(255,255,255,0.8)" }, ring1]} />
      <Animated.View pointerEvents="none" style={[{ position: "absolute", width: W + 70, height: W + 70, borderRadius: (W + 70) / 2, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.6)" }, ring2]} />
      <Animated.View pointerEvents="none" style={[{ position: "absolute", right: 0, top: H * 0.42, height: 30, paddingHorizontal: 12, borderRadius: 15, justifyContent: "center", backgroundColor: "#fff" }, toc]}>
        <Text style={{ fontSize: 13, fontWeight: "800", color: "#0B0B0B" }}>toc toc</Text>
      </Animated.View>

      <Device>
        <HomeScreen />
        <Animated.View pointerEvents="none" style={[{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, backgroundColor: "#000" }, dim]} />
        <Animated.View style={[{ position: "absolute", left: 0, right: 0, bottom: 0, height: H * 0.7, borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: "#17191E", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", paddingHorizontal: 13, paddingTop: 9 }, rise]}>
          <View style={{ alignSelf: "center", width: 34, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.25)" }} />
          <Text style={{ marginTop: 10, fontSize: 8.5, fontWeight: "800", letterSpacing: 1.1, color: C.softer }}>REGISTRO RÁPIDO</Text>
          <Text style={{ marginTop: 6, fontSize: 17, fontWeight: "800", letterSpacing: -0.4, color: "#fff" }}>O que aconteceu?</Text>
          <View style={{ marginTop: 10, height: 40, borderRadius: 14, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 9, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: typed ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.1)" }}>
            <Camera size={14} color="rgba(255,255,255,0.7)" strokeWidth={2} />
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, fontWeight: "600", color: typed ? "#fff" : "rgba(255,255,255,0.35)" }}>{typed || "Ex.: padaria 48"}</Text>
            <Mic size={14} color="rgba(255,255,255,0.7)" strokeWidth={2} />
          </View>
          <View style={{ marginTop: 10, height: 58 }}>
            {filled && (
              <Animated.View entering={FadeInDown.duration(320)} style={{ borderRadius: 14, padding: 10, backgroundColor: "rgba(255,255,255,0.05)", gap: 6 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 12.5, fontWeight: "800", color: "#fff" }}>Uber</Text>
                  <Text style={{ fontSize: 12.5, fontWeight: "800", color: "#fff" }}>R$ 18,40</Text>
                </View>
                <View style={{ flexDirection: "row", gap: 4 }}>
                  {["Transporte", "Nubank", "hoje"].map((t) => (
                    <View key={t} style={{ height: 17, paddingHorizontal: 7, borderRadius: 9, justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)" }}>
                      <Text style={{ fontSize: 8.5, fontWeight: "700", color: "rgba(255,255,255,0.8)" }}>{t}</Text>
                    </View>
                  ))}
                </View>
              </Animated.View>
            )}
          </View>
          <View style={{ marginTop: 10, height: 38, borderRadius: 19, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: saved ? "rgba(103,205,103,0.18)" : "#fff", opacity: filled || saved ? 1 : 0.35 }}>
            {saved && <Check size={13} color={C.green} strokeWidth={3} />}
            <Text style={{ fontSize: 13, fontWeight: "800", color: saved ? "#fff" : "#0B0B0B" }}>{saved ? "Anotado" : "Salvar"}</Text>
          </View>
        </Animated.View>
      </Device>
    </View>
  );
}

/** The phone: titanium band, side buttons, the black border, the Dynamic Island, glass over the screen. */
function Device({ children }: { children: ReactNode }) {
  const side = { position: "absolute" as const, width: 3, borderRadius: 2 };
  return (
    <View style={{ width: W, height: H, shadowColor: "#000", shadowOpacity: 0.7, shadowRadius: 30, shadowOffset: { width: 0, height: 18 } }}>
      <LinearGradient colors={["#A7ABB1", "#5D6167"]} style={[side, { left: -2, top: 92, height: 22 }]} />
      <LinearGradient colors={["#A7ABB1", "#5D6167"]} style={[side, { left: -2, top: 128, height: 40 }]} />
      <LinearGradient colors={["#A7ABB1", "#5D6167"]} style={[side, { left: -2, top: 176, height: 40 }]} />
      <LinearGradient colors={["#A7ABB1", "#5D6167"]} style={[side, { right: -2, top: 140, height: 62 }]} />
      <LinearGradient colors={["#C9CDD3", "#6A6E74", "#9CA0A6", "#4A4D53", "#B7BBC1"]} locations={[0, 0.22, 0.5, 0.78, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, borderRadius: R, borderCurve: "continuous", padding: BAND }}>
        <View style={{ flex: 1, borderRadius: R - BAND, borderCurve: "continuous", backgroundColor: "#000", padding: BEZEL }}>
          <View style={{ flex: 1, borderRadius: R - BAND - BEZEL, borderCurve: "continuous", overflow: "hidden", backgroundColor: "#0B0C0F" }}>
            {children}
            <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, height: 34, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20 }}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: "#fff" }}>9:41</Text>
              <View style={{ flexDirection: "row", gap: 2, alignItems: "flex-end" }}>
                {[4, 5.5, 7, 8.5].map((h) => (
                  <View key={h} style={{ width: 2.5, height: h, borderRadius: 1, backgroundColor: "#fff" }} />
                ))}
                <View style={{ marginLeft: 4, width: 17, height: 8.5, borderRadius: 3, borderWidth: 1, borderColor: "rgba(255,255,255,0.6)", padding: 1 }}>
                  <View style={{ flex: 1, width: "80%", borderRadius: 1.5, backgroundColor: "#fff" }} />
                </View>
              </View>
            </View>
            <View pointerEvents="none" style={{ position: "absolute", top: 9, alignSelf: "center", width: 62, height: 18, borderRadius: 9, backgroundColor: "#000" }} />
            <LinearGradient pointerEvents="none" colors={["rgba(255,255,255,0.09)", "rgba(255,255,255,0)", "rgba(255,255,255,0)"]} locations={[0, 0.42, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} />
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

/** The app's home, as it really looks, at the phone's size. */
function HomeScreen() {
  const card = { borderRadius: 14, backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.05)", padding: 9 };
  return (
    <View style={{ flex: 1, paddingTop: 40, paddingHorizontal: 10, gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
        <LinearGradient colors={["#B9B0FF", "#6FA8E8"]} style={{ width: 20, height: 20, borderRadius: 10 }} />
        <Text style={{ flex: 1, fontSize: 11.5, fontWeight: "800", color: "#fff" }}>Larissa</Text>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.green }} />
      </View>
      <View style={[card, { gap: 5 }]}>
        <Text style={{ fontSize: 8, color: C.softer }}>Receitas e despesas · este mês</Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 9.5, fontWeight: "800", color: "#fff" }}>Entrada</Text>
          <Text style={{ fontSize: 9.5, fontWeight: "800", color: "#fff" }}>R$ 2.885</Text>
        </View>
        <View style={{ height: 3.5, borderRadius: 2, backgroundColor: C.green }} />
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 9.5, fontWeight: "800", color: "#fff" }}>Saída</Text>
          <Text style={{ fontSize: 9.5, fontWeight: "800", color: C.red }}>−R$ 2.521</Text>
        </View>
        <View style={{ height: 3.5, width: "86%", borderRadius: 2, backgroundColor: C.red }} />
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={[card, { flex: 1, alignItems: "center", gap: 6 }]}>
          <View style={{ width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: "rgba(124,196,255,0.55)", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(124,196,255,0.08)" }}>
            <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: "rgba(124,196,255,0.35)", alignItems: "center", justifyContent: "center" }}>
              <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: "#DCEBFF" }} />
            </View>
          </View>
          <Text style={{ fontSize: 9, fontWeight: "800", color: "#fff" }}>Radar</Text>
        </View>
        <View style={[card, { flex: 1, alignItems: "center", gap: 6, backgroundColor: "rgba(255,159,69,0.12)" }]}>
          <View style={{ height: 42, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 22, fontWeight: "800", color: "#fff" }}>5</Text>
          </View>
          <Text style={{ fontSize: 9, fontWeight: "800", color: "#fff" }}>Conquistas</Text>
        </View>
      </View>
      <View style={[card, { gap: 6 }]}>
        <Text style={{ fontSize: 8, color: C.softer }}>Próximos eventos</Text>
        {[
          ["Fatura Nubank", "dia 10"],
          ["Internet", "dia 12"],
        ].map(([t, d]) => (
          <View key={t} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.orange }} />
            <Text style={{ flex: 1, fontSize: 9, color: "#fff" }}>{t}</Text>
            <Text style={{ fontSize: 8.5, color: C.softer }}>{d}</Text>
          </View>
        ))}
      </View>
      <View style={{ position: "absolute", left: 10, right: 10, bottom: 12, height: 32, borderRadius: 16, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 8, backgroundColor: "rgba(255,255,255,0.1)" }}>
        <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: "rgba(255,255,255,0.18)" }} />
        <Text style={{ flex: 1, fontSize: 9, color: C.soft }}>Converse com o Willo</Text>
        <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: "rgba(255,255,255,0.18)" }} />
      </View>
      <View style={{ position: "absolute", bottom: 4, alignSelf: "center", width: 70, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.5)" }} />
    </View>
  );
}

