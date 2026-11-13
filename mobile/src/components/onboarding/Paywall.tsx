import { useEffect, useState, type ComponentType } from "react";
import { Alert, Image, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, FadeIn, FadeInDown, FadeOut } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import LegalSheet from "~/components/auth/LegalSheet";
import { AskDemo, DURATIONS, NotifyDemo, ReceiptDemo, VoiceDemo } from "~/components/welcome/Demos";
import { Check, X } from "~/components/icons";
import { Aura, C, Cta, tap } from "./kit";
import QuickTap, { QUICK_MS } from "./QuickTap";
import { PLANS, TRIAL_DAYS, brl, startTrial, type PlanId } from "~/lib/plans";
import { restore } from "~/lib/purchases";
import type { GoalId } from "~/lib/onboardingProfile";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const LOGO = require("../../../assets/images/willo-logo-white.png") as number;

/**
 * Willo PRO, laid out like the premium apps do it.
 *
 * At the top, the wordmark with PRO beside it and a two-line title. Behind, phones
 * showing what Willo does, one after another — the Copilot noting a purchase, a
 * sentence spoken and noted, a receipt read from a photo, a question answered — the
 * one in the middle playing, the ones at the sides waiting. At the foot, a short panel:
 * the year as a month's price with the total under it, the free trial, and a quiet
 * "Alterar plano" that opens the year and the month and closes again on a choice.
 */

const SLIDES: { label: string; ms: number; Demo: ComponentType<{ active: boolean }> }[] = [
  { label: "Willo Copilot", ms: DURATIONS.notify, Demo: NotifyDemo },
  { label: "Dois toques atrás do celular", ms: QUICK_MS, Demo: QuickTap },
  { label: "Fale, ele anota", ms: DURATIONS.voice, Demo: VoiceDemo },
  { label: "Foto do comprovante", ms: DURATIONS.receipt, Demo: ReceiptDemo },
  { label: "Pergunte qualquer coisa", ms: DURATIONS.ask, Demo: AskDemo },
];

/* The demonstrations are laid out at this size, and shrunk to the room there is. */
const DEMO_W = 340;
const DEMO_H = 440;

export default function Paywall({ name, goal, onClose, onStart, renew = false }: { name: string; goal: GoalId | null; onClose: () => void; onStart: (plan: PlanId) => void; /** Shown again after the free week or the subscription ended: no free week offered. */ renew?: boolean }) {
  const insets = useSafeAreaInsets();
  const [plan, setPlan] = useState<PlanId>("anual");
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [legal, setLegal] = useState<"terms" | "privacy" | null>(null);
  const [slide, setSlide] = useState(0);
  const chosen = PLANS[plan];
  /* The free week is the annual plan's, and only for someone who has not had it. */
  const trial = plan === "anual" && !renew;
  const reach = goal === "dividas" ? "Saia das dívidas mais rápido." : goal === "controlar" || goal === "organizar" ? "Tome conta do seu mês." : "Chegue lá mais rápido.";

  /* One feature after another, each for as long as its demonstration runs. */
  useEffect(() => {
    const t = setTimeout(() => setSlide((v) => (v + 1) % SLIDES.length), SLIDES[slide].ms + 600);
    return () => clearTimeout(t);
  }, [slide]);

  const now = SLIDES[slide];
  const [room, setRoom] = useState({ w: 0, h: 0 });
  const scale = room.h > 0 ? Math.min(1, (room.h - 34) / DEMO_H, (room.w - 32) / DEMO_W) : 1;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Aura hex="#7C5CFF" top={-140} height={640} />

      <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 20 }}>
        <View style={{ height: 40, alignItems: "center", justifyContent: "center" }}>
          <Pressable onPress={onClose} accessibilityLabel="Fechar" hitSlop={10} style={({ pressed }) => ({ position: "absolute", left: 0, width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}>
            <X size={22} color="#fff" strokeWidth={2.2} />
          </Pressable>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Image source={LOGO} resizeMode="contain" style={{ width: 74, height: 74 * (222 / 725) }} />
            <LinearGradient colors={["#B49BFF", "#7C5CFF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 9, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={{ fontSize: 11.5, fontWeight: "900", letterSpacing: 1.4, color: "#fff" }}>PRO</Text>
            </LinearGradient>
          </View>
        </View>
        <Animated.View entering={FadeIn.duration(600)} style={{ alignItems: "center", marginTop: 12, gap: 4 }}>
          <Text style={{ fontSize: 13.5, color: C.soft }}>{renew ? "Seu acesso ao Willo PRO terminou." : name ? `${name}, seu perfil está pronto.` : "Seu perfil está pronto."}</Text>
          <Text style={{ fontSize: 27, lineHeight: 32, fontWeight: "300", letterSpacing: -0.6, color: "#fff", textAlign: "center" }}>
            {renew ? "Assine para continuar." : "Desbloqueie o Willo."}{"\n"}
            <Text style={{ fontWeight: "800" }}>{renew ? "Seus dados continuam aqui." : reach}</Text>
          </Text>
        </Animated.View>
      </View>

      {/* What it does, playing on the ground itself, one feature after another. */}
      <View onLayout={(e) => setRoom({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })} style={{ flex: 1, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {room.h > 0 && (
          <Animated.View key={slide} entering={FadeIn.duration(500)} exiting={FadeOut.duration(250)} style={{ alignItems: "center" }}>
            <View style={{ width: DEMO_W, height: DEMO_H * scale, alignItems: "center", justifyContent: "center" }}>
              <View style={{ width: DEMO_W, height: DEMO_H, alignItems: "center", justifyContent: "center", transform: [{ scale }] }}>
                <now.Demo active />
              </View>
            </View>
          </Animated.View>
        )}
        <View style={{ position: "absolute", bottom: 6, flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Text style={{ fontSize: 11, fontWeight: "800", letterSpacing: 1.4, color: "rgba(255,255,255,0.6)" }}>{now.label.toUpperCase()}</Text>
          <View style={{ flexDirection: "row", gap: 4 }}>
            {SLIDES.map((_, n) => (
              <View key={n} style={{ width: n === slide ? 16 : 5, height: 4, borderRadius: 2, backgroundColor: n === slide ? "#fff" : "rgba(255,255,255,0.25)" }} />
            ))}
          </View>
        </View>
      </View>

      {/* The plan, short, at the foot. */}
      <View style={{ borderTopLeftRadius: 30, borderTopRightRadius: 30, borderCurve: "continuous", backgroundColor: "#16171C", borderTopWidth: 1, borderColor: "rgba(255,255,255,0.08)", paddingHorizontal: 20, paddingTop: 18, paddingBottom: insets.bottom + 8, gap: 12 }}>
        {picking ? (
          <Animated.View entering={FadeInDown.duration(300).easing(Easing.out(Easing.cubic))} style={{ gap: 10 }}>
            {(["anual", "mensal"] as PlanId[]).map((id) => {
              const p = PLANS[id];
              const on = plan === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => {
                    tap();
                    setPlan(id);
                    setTimeout(() => setPicking(false), 180);
                  }}
                  style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.985 : 1 }] })}
                >
                  <View style={{ height: 64, borderRadius: 20, borderCurve: "continuous", borderWidth: on ? 1.5 : 1, borderColor: on ? "#fff" : "rgba(255,255,255,0.12)", backgroundColor: on ? "rgba(255,255,255,0.06)" : "transparent", paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
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
          <Animated.View key={plan} entering={FadeIn.duration(320)} style={{ alignItems: "center", gap: 2 }}>
            <Text style={{ fontSize: 11, fontWeight: "800", letterSpacing: 1.6, color: "rgba(255,255,255,0.55)" }}>
              {trial ? `PLANO ANUAL · ${TRIAL_DAYS} DIAS GRÁTIS` : plan === "anual" ? "PLANO ANUAL" : "PLANO MENSAL"}
            </Text>
            <Text style={{ fontSize: 44, fontWeight: "800", letterSpacing: -1.8, color: "#fff" }}>
              {brl(chosen.perMonth)}
              <Text style={{ fontSize: 17, fontWeight: "500", letterSpacing: 0, color: C.soft }}> /mês</Text>
            </Text>
            <Text style={{ fontSize: 13.5, color: C.soft }}>{plan === "anual" ? `${brl(chosen.price)} cobrado por ano` : "Cobrado todo mês"}</Text>
          </Animated.View>
        )}

        {!picking && (
          <Cta
            label={busy ? "Um instante…" : trial ? `Começar ${TRIAL_DAYS} dias grátis` : `Assinar por ${brl(chosen.price)}/${chosen.period}`}
            disabled={busy}
            onPress={async () => {
              setBusy(true);
              const r = await startTrial(plan);
              setBusy(false);
              if (r.ok) onStart(plan);
              else if (!r.cancelled) Alert.alert("Não deu certo", r.message ?? "Tente de novo em instantes.");
            }}
          />
        )}

        {!picking && (
          <Pressable
            onPress={() => {
              tap();
              setPicking(true);
            }}
            hitSlop={8}
            style={({ pressed }) => ({ alignSelf: "center", opacity: pressed ? 0.5 : 1 })}
          >
            <Text style={{ fontSize: 13, fontWeight: "400", color: "rgba(255,255,255,0.7)", textDecorationLine: "underline" }}>Alterar plano</Text>
          </Pressable>
        )}

        <View style={{ alignItems: "center", gap: 6 }}>
          <Text style={{ fontSize: 11.5, lineHeight: 16, color: C.softer, textAlign: "center" }}>
            {trial ? `Grátis por ${TRIAL_DAYS} dias, depois ${brl(PLANS.anual.price)} por ano.` : `${brl(chosen.price)} por ${chosen.period}.`}{" "}
            Renova automaticamente. Cancele quando quiser nos Ajustes do iPhone.
          </Text>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <Pressable
              disabled={busy}
              onPress={async () => {
                setBusy(true);
                const r = await restore();
                setBusy(false);
                if (r.active) onStart(plan);
                else Alert.alert(r.ok ? "Nenhuma assinatura encontrada" : "Não deu certo", r.ok ? "Este Apple ID não tem uma assinatura do Willo PRO ativa." : "Não foi possível falar com a App Store agora. Tente de novo em instantes.");
              }}
              hitSlop={6}
            >
              <Text style={{ fontSize: 11.5, color: C.softer }}>Restaurar</Text>
            </Pressable>
            <Text style={{ fontSize: 11.5, color: C.softer }}>·</Text>
            <Pressable onPress={() => setLegal("terms")} hitSlop={6}>
              <Text style={{ fontSize: 11.5, color: C.softer }}>Termos</Text>
            </Pressable>
            <Text style={{ fontSize: 11.5, color: C.softer }}>·</Text>
            <Pressable onPress={() => setLegal("privacy")} hitSlop={6}>
              <Text style={{ fontSize: 11.5, color: C.softer }}>Privacidade</Text>
            </Pressable>
          </View>
        </View>
      </View>
      <LegalSheet which={legal} onClose={() => setLegal(null)} />
    </View>
  );
}
