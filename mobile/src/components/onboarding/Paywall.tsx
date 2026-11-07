import { useEffect, useState, type ComponentType } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, FadeIn, FadeInDown, FadeOut } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import LegalSheet from "~/components/auth/LegalSheet";
import { AskDemo, DURATIONS, NotifyDemo, ReceiptDemo, VoiceDemo } from "~/components/welcome/Demos";
import { Check, X } from "~/components/icons";
import { Aura, C, Cta, tap } from "./kit";
import { PhoneFront } from "./Device";
import { PLANS, TRIAL_DAYS, brl, startTrial, type PlanId } from "~/lib/plans";
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

const SLIDES: { key: keyof typeof DURATIONS; label: string; Demo: ComponentType<{ active: boolean }> }[] = [
  { key: "notify", label: "Willo Copilot", Demo: NotifyDemo },
  { key: "voice", label: "Fale, ele anota", Demo: VoiceDemo },
  { key: "receipt", label: "Foto do comprovante", Demo: ReceiptDemo },
  { key: "ask", label: "Pergunte qualquer coisa", Demo: AskDemo },
];

const PHONE_W = 178;
/* The demonstrations are laid out at this size, and shrunk onto the phone's screen. */
const DEMO_W = 340;
const DEMO_H = 440;

export default function Paywall({ name, goal, onClose, onStart }: { name: string; goal: GoalId | null; onClose: () => void; onStart: (plan: PlanId) => void }) {
  const insets = useSafeAreaInsets();
  const [plan, setPlan] = useState<PlanId>("anual");
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [legal, setLegal] = useState<"terms" | "privacy" | null>(null);
  const [slide, setSlide] = useState(0);
  const chosen = PLANS[plan];
  const reach = goal === "dividas" ? "Saia das dívidas mais rápido." : goal === "controlar" || goal === "organizar" ? "Tome conta do seu mês." : "Chegue lá mais rápido.";

  /* One feature after another, each for as long as its demonstration runs. */
  useEffect(() => {
    const t = setTimeout(() => setSlide((v) => (v + 1) % SLIDES.length), DURATIONS[SLIDES[slide].key] + 500);
    return () => clearTimeout(t);
  }, [slide]);

  const now = SLIDES[slide];
  const left = SLIDES[(slide + SLIDES.length - 1) % SLIDES.length];
  const right = SLIDES[(slide + 1) % SLIDES.length];
  const screenW = PHONE_W * 0.91;
  const scale = screenW / DEMO_W;

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
          <Text style={{ fontSize: 13.5, color: C.soft }}>{name ? `${name}, seu perfil está pronto.` : "Seu perfil está pronto."}</Text>
          <Text style={{ fontSize: 27, lineHeight: 32, fontWeight: "300", letterSpacing: -0.6, color: "#fff", textAlign: "center" }}>
            Desbloqueie o Willo.{"\n"}
            <Text style={{ fontWeight: "800" }}>{reach}</Text>
          </Text>
        </Animated.View>
      </View>

      {/* The phones, showing what it does. */}
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        <View style={{ position: "absolute", left: -PHONE_W * 0.38, opacity: 0.35, transform: [{ scale: 0.82 }] }}>
          <PhoneFront width={PHONE_W}>
            <Still label={left.label} />
          </PhoneFront>
        </View>
        <View style={{ position: "absolute", right: -PHONE_W * 0.38, opacity: 0.35, transform: [{ scale: 0.82 }] }}>
          <PhoneFront width={PHONE_W}>
            <Still label={right.label} />
          </PhoneFront>
        </View>
        <PhoneFront width={PHONE_W}>
          <Animated.View key={now.key} entering={FadeIn.duration(500)} exiting={FadeOut.duration(250)} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ position: "absolute", top: 40, fontSize: 9.5, fontWeight: "800", letterSpacing: 1.2, color: "rgba(255,255,255,0.6)" }}>{now.label.toUpperCase()}</Text>
            <View style={{ width: DEMO_W, height: DEMO_H, alignItems: "center", justifyContent: "center", transform: [{ scale }], marginTop: 22 }}>
              <now.Demo active />
            </View>
          </Animated.View>
        </PhoneFront>
        <LinearGradient pointerEvents="none" colors={["rgba(13,14,16,0)", C.bg]} style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 70 }} />
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
              {plan === "anual" ? "PLANO ANUAL" : "PLANO MENSAL"} · {TRIAL_DAYS} DIAS GRÁTIS
            </Text>
            <Text style={{ fontSize: 44, fontWeight: "800", letterSpacing: -1.8, color: "#fff" }}>
              {brl(chosen.perMonth)}
              <Text style={{ fontSize: 17, fontWeight: "500", letterSpacing: 0, color: C.soft }}> /mês</Text>
            </Text>
            <Text style={{ fontSize: 13.5, color: C.soft }}>{plan === "anual" ? `${brl(chosen.price)} cobrado por ano` : "Cobrado todo mês"}</Text>
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
          <Text style={{ fontSize: 11.5, color: C.softer }}>Renova automaticamente. Cancele quando quiser.</Text>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <Pressable onPress={() => void startTrial(plan)} hitSlop={6}>
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

/** A side phone's screen: the feature's name over the app's dark ground. */
function Still({ label }: { label: string }) {
  return (
    <View style={{ flex: 1, paddingTop: 54, paddingHorizontal: 14, gap: 10 }}>
      <Text style={{ fontSize: 10, fontWeight: "800", letterSpacing: 1.2, color: "rgba(255,255,255,0.6)" }}>{label.toUpperCase()}</Text>
      {[0.9, 0.7, 0.8].map((w, n) => (
        <View key={n} style={{ height: 46, width: `${w * 100}%`, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.07)" }} />
      ))}
    </View>
  );
}
