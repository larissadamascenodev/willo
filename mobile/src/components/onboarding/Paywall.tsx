import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, FadeIn, FadeInDown, FadeOut, LinearTransition, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import WilloBot from "~/components/willo/WilloBot";
import LegalSheet from "~/components/auth/LegalSheet";
import { Check, ChevronDown, X } from "~/components/icons";
import { C, Cta, tap, type IconC } from "./kit";
import { Bell, MessageIcon, Smartphone, Target, Zap } from "./icons";
import { PLANS, TRIAL_DAYS, brl, startTrial, type PlanId } from "~/lib/plans";
import type { GoalId } from "~/lib/onboardingProfile";

/**
 * Willo PRO, the way premium apps sell it.
 *
 * Willo himself at the top, in a halo of light. What it unlocks, in a quiet list. Then
 * a panel held at the foot of the screen with one price — the year, as what it comes to
 * a month, the total under it — and one way on, the free trial. "Alterar plano" opens
 * the choice between the year and the month in the same panel. The same screen comes
 * back whenever someone whose trial ended tries to do something; closing it always lets
 * them carry on looking.
 */

const FEATURES: [IconC, string, string][] = [
  [Zap, "Willo Copilot", "Seus gastos se anotam sozinhos, você só confirma"],
  [Smartphone, "Dois toques atrás do celular", "E o registro rápido abre, de qualquer tela"],
  [Bell, "Avisos na hora certa", "Contas, fatura, limites e o salário caindo"],
  [MessageIcon, "Converse com o Willo", "Respostas com os seus números, sem limite"],
  [Target, "Seu perfil financeiro", "Que evolui junto com você"],
];

export default function Paywall({ name, goal, onClose, onStart }: { name: string; goal: GoalId | null; onClose: () => void; onStart: (plan: PlanId) => void }) {
  const insets = useSafeAreaInsets();
  const [plan, setPlan] = useState<PlanId>("anual");
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [legal, setLegal] = useState<"terms" | "privacy" | null>(null);
  const chosen = PLANS[plan];
  const reach = goal === "dividas" ? "Saia das dívidas mais rápido." : goal === "controlar" || goal === "organizar" ? "Tome conta do seu mês." : "Chegue lá mais rápido.";

  /* The halo behind Willo breathes. */
  const glow = useSharedValue(0);
  useEffect(() => {
    glow.set(withRepeat(withSequence(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 2200, easing: Easing.inOut(Easing.quad) })), -1, false));
  }, [glow]);
  const halo = useAnimatedStyle(() => ({ opacity: 0.65 + glow.get() * 0.35, transform: [{ scale: 0.94 + glow.get() * 0.08 }] }));

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20 }}>
          <Pressable onPress={onClose} accessibilityLabel="Fechar" hitSlop={10} style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)", opacity: pressed ? 0.6 : 1 })}>
            <X size={18} color="#fff" strokeWidth={2.4} />
          </Pressable>
          <View style={{ height: 28, paddingHorizontal: 13, borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.22)", justifyContent: "center" }}>
            <Text style={{ fontSize: 12, fontWeight: "800", letterSpacing: 1.8, color: "#fff" }}>WILLO PRO</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Willo, in a halo of light. */}
        <View style={{ alignItems: "center", height: 230, justifyContent: "center", marginTop: 4 }}>
          <Animated.View pointerEvents="none" style={[{ position: "absolute", width: 360, height: 300 }, halo]}>
            <Svg width={360} height={300}>
              <Defs>
                <RadialGradient id="pro-halo" cx="0.5" cy="0.55" rx="0.5" ry="0.5">
                  <Stop offset="0" stopColor="#B49BFF" stopOpacity={0.55} />
                  <Stop offset="0.45" stopColor="#7C5CFF" stopOpacity={0.18} />
                  <Stop offset="1" stopColor="#7C5CFF" stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Rect x="0" y="0" width="360" height="300" fill="url(#pro-halo)" />
            </Svg>
          </Animated.View>
          <View style={{ position: "absolute", width: 210, height: 210, borderRadius: 105, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" }} />
          <View style={{ position: "absolute", width: 290, height: 290, borderRadius: 145, borderWidth: 1, borderColor: "rgba(255,255,255,0.04)" }} />
          <Animated.View entering={FadeInDown.duration(700).easing(Easing.out(Easing.cubic))}>
            <WilloBot size={168} />
          </Animated.View>
        </View>

        <Animated.View entering={FadeIn.delay(250).duration(600)} style={{ alignItems: "center", paddingHorizontal: 24, gap: 8 }}>
          <Text style={{ fontSize: 14, color: C.soft }}>{name ? `${name}, seu perfil está pronto.` : "Seu perfil está pronto."}</Text>
          <Text style={{ fontSize: 28, lineHeight: 34, fontWeight: "300", letterSpacing: -0.6, color: "#fff", textAlign: "center" }}>
            Desbloqueie o Willo.{"\n"}
            <Text style={{ fontWeight: "800" }}>{reach}</Text>
          </Text>
        </Animated.View>

        <View style={{ marginTop: 26, marginHorizontal: 20, borderRadius: 24, borderCurve: "continuous", borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,0.03)", paddingHorizontal: 18, paddingVertical: 6 }}>
          {FEATURES.map(([Icon, t, l], n) => (
            <Animated.View key={t} entering={FadeInDown.delay(350 + n * 90).duration(420)} style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 13, borderTopWidth: n ? 1 : 0, borderTopColor: "rgba(255,255,255,0.06)" }}>
              <Icon size={19} color="rgba(255,255,255,0.9)" strokeWidth={1.8} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>{t}</Text>
                <Text style={{ fontSize: 12.5, lineHeight: 17, color: C.softer }}>{l}</Text>
              </View>
            </Animated.View>
          ))}
        </View>
      </ScrollView>

      {/* The price and the way on, held at the foot. */}
      <Animated.View layout={LinearTransition.duration(320)} style={{ borderTopLeftRadius: 30, borderTopRightRadius: 30, borderCurve: "continuous", backgroundColor: "#15161B", borderTopWidth: 1, borderColor: "rgba(255,255,255,0.08)", paddingHorizontal: 20, paddingTop: 20, paddingBottom: insets.bottom + 10, gap: 14 }}>
        <LinearGradient pointerEvents="none" colors={["rgba(255,255,255,0.05)", "rgba(255,255,255,0)"]} style={{ position: "absolute", left: 0, right: 0, top: 0, height: 80, borderTopLeftRadius: 30, borderTopRightRadius: 30 }} />

        {picking ? (
          <Animated.View entering={FadeInDown.duration(320)} exiting={FadeOut.duration(150)} style={{ gap: 10 }}>
            {(["anual", "mensal"] as PlanId[]).map((id) => {
              const p = PLANS[id];
              const on = plan === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => {
                    tap();
                    setPlan(id);
                  }}
                  style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.985 : 1 }] })}
                >
                  <View style={{ minHeight: 68, borderRadius: 20, borderCurve: "continuous", borderWidth: on ? 1.5 : 1, borderColor: on ? "#fff" : "rgba(255,255,255,0.12)", backgroundColor: on ? "rgba(255,255,255,0.06)" : "transparent", paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View style={{ width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", borderWidth: on ? 0 : 1.5, borderColor: "rgba(255,255,255,0.3)", backgroundColor: on ? "#fff" : "transparent" }}>
                      {on && <Check size={13} color="#0B0B0B" strokeWidth={3.4} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: "800", color: "#fff" }}>{p.label}</Text>
                      <Text style={{ fontSize: 12.5, color: C.softer }}>{id === "anual" ? `${brl(p.price)} por ano` : "Cobrado todo mês"}</Text>
                    </View>
                    <Text style={{ fontSize: 18, fontWeight: "800", color: "#fff" }}>
                      {brl(p.perMonth)}
                      <Text style={{ fontSize: 12, fontWeight: "600", color: C.softer }}>/mês</Text>
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </Animated.View>
        ) : (
          <Animated.View key={plan} entering={FadeIn.duration(320)} style={{ alignItems: "center", gap: 4 }}>
            <Text style={{ fontSize: 11.5, fontWeight: "800", letterSpacing: 1.6, color: "rgba(255,255,255,0.6)" }}>
              {plan === "anual" ? "PLANO ANUAL" : "PLANO MENSAL"} · {TRIAL_DAYS} DIAS GRÁTIS
            </Text>
            <Text style={{ fontSize: 42, fontWeight: "800", letterSpacing: -1.6, color: "#fff" }}>
              {brl(chosen.perMonth)}
              <Text style={{ fontSize: 16, fontWeight: "600", letterSpacing: 0, color: C.soft }}> /mês</Text>
            </Text>
            <Text style={{ fontSize: 13, color: C.softer }}>{plan === "anual" ? `${brl(chosen.price)} cobrado por ano` : "Cobrado todo mês"}</Text>
          </Animated.View>
        )}

        <Cta
          label={busy ? "Um instante…" : `Começar ${TRIAL_DAYS} dias grátis`}
          disabled={busy}
          onPress={async () => {
            setBusy(true);
            const r = await startTrial(plan);
            setBusy(false);
            if (r.ok) onStart(plan);
          }}
        />

        <Pressable
          onPress={() => {
            tap();
            setPicking((v) => !v);
          }}
          hitSlop={6}
          style={({ pressed }) => ({ alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 5, opacity: pressed ? 0.6 : 1 })}
        >
          <Text style={{ fontSize: 14.5, fontWeight: "700", color: "#fff" }}>{picking ? "Ver plano escolhido" : "Alterar plano"}</Text>
          <View style={{ transform: [{ rotate: picking ? "180deg" : "0deg" }] }}>
            <ChevronDown size={15} color="#fff" strokeWidth={2.4} />
          </View>
        </Pressable>

        <View style={{ alignItems: "center", gap: 8 }}>
          <Text style={{ fontSize: 12, color: C.softer }}>Renova automaticamente. Cancele quando quiser.</Text>
          <View style={{ flexDirection: "row", gap: 22 }}>
            <Pressable onPress={() => void startTrial(plan)} hitSlop={6}>
              <Text style={{ fontSize: 12, color: C.softer }}>Restaurar</Text>
            </Pressable>
            <Pressable onPress={() => setLegal("terms")} hitSlop={6}>
              <Text style={{ fontSize: 12, color: C.softer }}>Termos</Text>
            </Pressable>
            <Pressable onPress={() => setLegal("privacy")} hitSlop={6}>
              <Text style={{ fontSize: 12, color: C.softer }}>Privacidade</Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
      <LegalSheet which={legal} onClose={() => setLegal(null)} />
    </View>
  );
}
