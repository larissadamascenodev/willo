import { useEffect, useRef, useState } from "react";
import { Image, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { Easing, FadeInDown, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Camera, Car, Check, Mic } from "~/components/icons";
import { C, IconTile } from "./kit";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const IPHONE = require("../../../assets/images/onboarding/iphone-back.png") as number;

/**
 * Two taps on the back of the phone, and the quick entry rises.
 *
 * The iPhone is seen from behind. A fingertip knocks twice on the glass, two rings
 * going out from it with each knock; then the phone draws back and fades, and the
 * quick entry rises over the place it was, as the app shows it: what happened is typed,
 * it becomes a filled-in entry and is saved. It sinks away, the phone comes back, and
 * it all starts again.
 */

const BOX_W = 340;
const BOX_H = 440;
const PHONE_W = 210;
const PHONE_H = PHONE_W * (492 / 288);
/** How long one round of the demonstration lasts. */
export const QUICK_MS = 8200;
const LOOP = QUICK_MS;
const TYPED = "uber 18,40";

export default function QuickTap({ active = true }: { active?: boolean }) {
  const knock = useSharedValue(0);
  const press = useSharedValue(0);
  const phone = useSharedValue(1);
  const sheet = useSharedValue(0);
  const [typed, setTyped] = useState("");
  const [filled, setFilled] = useState(false);
  const [saved, setSaved] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const at = (ms: number, run: () => void) => timers.current.push(setTimeout(run, ms));
    const tapOnce = () => {
      press.set(withSequence(withTiming(1, { duration: 110 }), withTiming(0, { duration: 170 })));
      knock.set(withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: 620, easing: Easing.out(Easing.cubic) })));
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    };
    const play = () => {
      setTyped("");
      setFilled(false);
      setSaved(false);
      phone.set(withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }));
      at(900, tapOnce);
      at(1250, tapOnce);
      at(2050, () => phone.set(withTiming(0, { duration: 420, easing: Easing.in(Easing.cubic) })));
      at(2250, () => sheet.set(withSpring(1, { damping: 17, stiffness: 130 })));
      TYPED.split("").forEach((_, i) => at(3000 + i * 105, () => setTyped(TYPED.slice(0, i + 1))));
      at(3000 + TYPED.length * 105 + 250, () => setFilled(true));
      at(5000, () => {
        setSaved(true);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      });
      at(6900, () => sheet.set(withTiming(0, { duration: 480, easing: Easing.in(Easing.cubic) })));
      at(LOOP, play);
    };
    if (active) play();
    const list = timers.current;
    return () => {
      list.forEach(clearTimeout);
      timers.current = [];
    };
  }, [active, knock, press, phone, sheet]);

  const phoneStyle = useAnimatedStyle(() => ({ opacity: phone.get(), transform: [{ scale: 0.86 + phone.get() * 0.14 }, { translateY: (1 - phone.get()) * -20 }] }));
  const finger = useAnimatedStyle(() => ({ opacity: phone.get() * (0.55 + press.get() * 0.45), transform: [{ scale: 1 - press.get() * 0.18 }] }));
  const ring = useAnimatedStyle(() => ({ opacity: (1 - knock.get()) * 0.9 * phone.get(), transform: [{ scale: 0.4 + knock.get() * 1.6 }] }));
  const ring2 = useAnimatedStyle(() => ({ opacity: (1 - knock.get()) * 0.5 * phone.get(), transform: [{ scale: 0.3 + knock.get() * 2.4 }] }));
  const toc = useAnimatedStyle(() => ({ opacity: (knock.get() > 0 && knock.get() < 1 ? 1 : 0) * phone.get() }));
  const rise = useAnimatedStyle(() => ({ opacity: Math.min(1, sheet.get() * 1.6), transform: [{ translateY: (1 - sheet.get()) * 260 }] }));

  const tapX = PHONE_W / 2;
  const tapY = PHONE_H * 0.64;

  return (
    <View style={{ width: BOX_W, height: BOX_H, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={[{ width: PHONE_W, height: PHONE_H }, phoneStyle]}>
        <Image source={IPHONE} resizeMode="contain" style={{ position: "absolute", width: PHONE_W, height: PHONE_H }} />
        <LinearGradient pointerEvents="none" colors={["rgba(13,14,16,0)", "#0D0E10"]} style={{ position: "absolute", left: -10, right: -10, bottom: -2, height: 90 }} />
          <Animated.View pointerEvents="none" style={[{ position: "absolute", left: tapX - 40, top: tapY - 40, width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: "rgba(255,255,255,0.9)" }, ring]} />
          <Animated.View pointerEvents="none" style={[{ position: "absolute", left: tapX - 40, top: tapY - 40, width: 80, height: 80, borderRadius: 40, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.6)" }, ring2]} />
          <Animated.View pointerEvents="none" style={[{ position: "absolute", left: tapX - 17, top: tapY - 17, width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.85)", borderWidth: 2, borderColor: "#fff" }, finger]} />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[{ position: "absolute", right: 8, top: BOX_H * 0.5, height: 30, paddingHorizontal: 13, borderRadius: 15, justifyContent: "center", backgroundColor: "#fff" }, toc]}>
        <Text style={{ fontSize: 13, fontWeight: "800", color: "#0B0B0B" }}>toc toc</Text>
      </Animated.View>

      {/* The quick entry, over where the phone was. */}
      <Animated.View style={[{ position: "absolute", left: 0, right: 0, bottom: 20, borderRadius: 28, borderCurve: "continuous", backgroundColor: "#17191E", borderWidth: 1, borderColor: "rgba(255,255,255,0.09)", paddingHorizontal: 18, paddingTop: 10, paddingBottom: 18, shadowColor: "#000", shadowOpacity: 0.6, shadowRadius: 28, shadowOffset: { width: 0, height: 10 } }, rise]}>
        <View style={{ alignSelf: "center", width: 38, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.22)" }} />
        <Text style={{ marginTop: 14, fontSize: 11, fontWeight: "800", letterSpacing: 1.4, color: C.softer }}>REGISTRO RÁPIDO</Text>
        <Text style={{ marginTop: 6, fontSize: 23, fontWeight: "800", letterSpacing: -0.6, color: "#fff" }}>O que aconteceu?</Text>
        <View style={{ marginTop: 14, height: 54, borderRadius: 18, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: typed ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.1)" }}>
          <Camera size={18} color="rgba(255,255,255,0.75)" strokeWidth={2} />
          <Text numberOfLines={1} style={{ flex: 1, fontSize: 18, fontWeight: "600", color: typed ? "#fff" : "rgba(255,255,255,0.35)" }}>{typed || "Ex.: padaria 48"}</Text>
          <Mic size={18} color="rgba(255,255,255,0.75)" strokeWidth={2} />
        </View>
        <View style={{ marginTop: 12, height: 64, justifyContent: "center" }}>
          {filled && (
            <Animated.View entering={FadeInDown.duration(360)} style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 18, padding: 11, backgroundColor: "rgba(255,255,255,0.05)" }}>
              <IconTile Icon={Car} hex={C.blue} size={40} />
              <View style={{ flex: 1, gap: 5 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 15.5, fontWeight: "800", color: "#fff" }}>Uber</Text>
                  <Text style={{ fontSize: 15.5, fontWeight: "800", color: "#fff" }}>R$ 18,40</Text>
                </View>
                <View style={{ flexDirection: "row", gap: 5 }}>
                  {["Transporte", "Nubank", "hoje"].map((t) => (
                    <View key={t} style={{ height: 21, paddingHorizontal: 8, borderRadius: 11, justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)" }}>
                      <Text style={{ fontSize: 11, fontWeight: "700", color: "rgba(255,255,255,0.8)" }}>{t}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </Animated.View>
          )}
        </View>
        <View style={{ marginTop: 12, height: 50, borderRadius: 25, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: saved ? "rgba(103,205,103,0.16)" : "#fff", opacity: filled || saved ? 1 : 0.35 }}>
          {saved && <Check size={16} color={C.green} strokeWidth={3} />}
          <Text style={{ fontSize: 16, fontWeight: "800", color: saved ? "#fff" : "#0B0B0B" }}>{saved ? "Anotado" : "Salvar"}</Text>
        </View>
      </Animated.View>
    </View>
  );
}
