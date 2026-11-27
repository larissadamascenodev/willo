import { useEffect, useRef, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { Easing, FadeIn, FadeOut, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import BottomSheet from "~/components/BottomSheet";
import TransactionExperience from "~/components/pass/TransactionExperience";
import { nowTime, passRows } from "~/components/pass/passTheme";
import { Pencil } from "~/components/icons";
import { colorFor } from "@/lib/banks";
import { playConfirm, preloadConfirm } from "~/lib/sounds";

/**
 * A simulation, for Expo Go only: how the Copilot's confirmation will look when a purchase is
 * paid with the iPhone — over the lock screen or another app, without opening Willo. The real
 * one is drawn by iOS from the "Registrar compra no Willo" action (build 14); this one exists to
 * settle its layout. Nothing here is written anywhere. Reached from the Copilot screen.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ICON = require("../../assets/images/app-icon.png") as number;

type Scene = "bloqueada" | "app";
type Step = "nada" | "aviso" | "aberta" | "notificacao";
type Kind = "debito" | "credito" | "pix";

/* What came in: a purchase from the Wallet or the bank, or a Pix received (from the bank's notice). */
const EVENTS: Record<Kind, { who: string; amount: number; bank: string; category: string; income: boolean }> = {
  debito: { who: "Padaria Cleide", amount: 15.5, bank: "Nubank", category: "Alimentação", income: false },
  credito: { who: "Drogasil", amount: 42.9, bank: "Nubank", category: "Farmácia", income: false },
  pix: { who: "Maria Silva", amount: 10, bank: "Nubank", category: "Outros", income: true },
};
const brl = (v: number) => v.toFixed(2).replace(".", ",");
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];
const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia!" : h < 18 ? "Boa tarde!" : "Boa noite!";
};

/* What Willo says on the card: a purchase (debit or credit, the same lines) or a Pix received,
   never the same line twice in a row, so it reads as someone and not a form. */
let lastAsk = "";
function askFor(kind: Kind) {
  const e = EVENTS[kind];
  /* The notification's title: one line, so short enough to be read whole. */
  const lines = e.income
    ? ["Olha só, caiu um Pix! Anoto?", "Pix na área! Posso registrar?", "Chegou dinheirinho! Anoto?", `Pix novo no ${e.bank}! Bora anotar?`, `${greeting()} Caiu um Pix. Anoto?`]
    : ["Opa, gastinho novo! Anoto?", `Compra nova no ${e.bank}. Anoto?`, "Passou o cartão, eu vi! Registro?", "Mais uma comprinha! Deixo anotada?", "Comprinha à vista! Bora anotar?", `${greeting()} Anoto essa compra?`];
  const next = pick(lines.filter((l) => l !== lastAsk));
  lastAsk = next;
  return next;
}

/* After a confirmation: Willo speaking, never a system receipt. A purchase or a Pix received,
   a different line each time. */
let lastDone = "";
function doneFor(kind: Kind) {
  const e = EVENTS[kind];
  const v = `R$ ${brl(e.amount)}`;
  const where = kind === "credito" ? `na fatura do ${e.bank}` : `em ${e.category}`;
  const lines = e.income
    ? [
        { title: "Oba, dinheiro no bolso!", body: `${v} de ${e.who} já estão no seu saldo.` },
        { title: "Anotadinho!", body: `Pix de ${v} de ${e.who} registrado.` },
        { title: "Saldo feliz", body: `${v} de ${e.who} entraram no seu mês.` },
        { title: "Chegou e tá anotado", body: `${v} de ${e.who}, direto pro seu saldo.` },
        { title: "Que beleza!", body: `Pix de ${e.who} registrado: ${v} a mais por aqui.` },
      ]
    : [
        { title: "Anotadinho!", body: `${v} na ${e.who}, ${where}.` },
        { title: "Pode deixar comigo", body: `${v} na ${e.who} já tá ${where}.` },
        { title: "Missão cumprida", body: `${v} na ${e.who} registrados. Segue o jogo!` },
        { title: "Tá anotado!", body: `${v} na ${e.who}, ${where}. Eu cuido do resto.` },
        { title: "Prontinho!", body: `${v} na ${e.who} já entrou no seu mês.` },
        { title: "Deixa comigo", body: `Anotei ${v} na ${e.who}, ${where}.` },
      ];
  const next = pick(lines.filter((l) => l.title !== lastDone));
  lastDone = next.title;
  return next;
}

const SETTLE = Easing.bezier(0.2, 0.9, 0.25, 1);
const AWAY = Easing.bezier(0.4, 0, 1, 1);
function dropIn(locked: boolean) {
  return () => {
    "worklet";
    return {
      initialValues: locked ? { opacity: 0, transform: [{ translateY: 18 }, { scale: 0.96 }] } : { opacity: 0, transform: [{ translateY: -140 }, { scale: 0.98 }] },
      animations: {
        opacity: withTiming(1, { duration: locked ? 320 : 220 }),
        transform: [{ translateY: withTiming(0, { duration: 460, easing: SETTLE }) }, { scale: withTiming(1, { duration: 460, easing: SETTLE }) }],
      },
    };
  };
}
function liftOut(locked: boolean) {
  return () => {
    "worklet";
    return {
      initialValues: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
      animations: {
        opacity: withTiming(0, { duration: locked ? 220 : 300, easing: AWAY }),
        transform: [{ translateY: withTiming(locked ? 0 : -140, { duration: 300, easing: AWAY }) }, { scale: withTiming(locked ? 0.96 : 1, { duration: 300, easing: AWAY }) }],
      },
    };
  };
}

export default function SimulacaoAviso() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [scene, setScene] = useState<Scene>("bloqueada");
  const [step, setStep] = useState<Step>("nada");
  /* Debit or credit comes from the bank's own notice, so the card never asks. */
  const [kind, setKind] = useState<Kind>("debito");
  const [ask, setAsk] = useState(() => askFor("debito"));
  const [said, setSaid] = useState(() => doneFor("debito"));
  const e = EVENTS[kind];
  const [opened, setOpened] = useState(false);
  const [writing, setWriting] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (ms: number, f: () => void) => timers.current.push(setTimeout(f, ms));
  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => {
    preloadConfirm();
    return clear;
  }, []);

  const pay = () => {
    clear();
    setStep("nada");
    setAsk(askFor(kind));
    later(700, () => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setStep("aviso");
    });
  };
  /* Confirmed: the card goes, and the one notification that stays is Willo's. */
  const confirmed = () => {
    setSaid(doneFor(kind));
    setStep("nada");
    later(180, () => setStep("notificacao"));
    later(6500, () => setStep((s) => (s === "notificacao" ? "nada" : s)));
  };
  const confirm = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    playConfirm();
    confirmed();
  };
  const open = () => {
    clear();
    setStep("nada");
    setOpened(true);
  };

  /* Unlocked, it drops from the top; locked, it sits with the other notifications, under the clock. */
  const locked = scene === "bloqueada";
  /* Where the iPhone puts its notifications: just under the Dynamic Island, or in the list under the clock. */
  const top = locked ? insets.top + 300 : insets.top + 2;
  const side = 8;
  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      {scene === "bloqueada" ? <LockScreen top={insets.top} /> : <OtherApp top={insets.top} />}

      {/* The notice, as the iPhone shows any app's: the icon, Willo's words as the title, the amount and
          the name under them. A tap opens the app on the confirmation; holding it opens it in place. */}
      {step === "aviso" && (
        <Animated.View key={`card-${scene}`} entering={dropIn(locked)} exiting={liftOut(locked)} style={{ position: "absolute", left: side, right: side, top }}>
          <Pressable
            onPress={open}
            onLongPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setStep("aberta");
            }}
            delayLongPress={350}
            accessibilityLabel="Notificação do Willo"
          >
            <Glass>
              <View style={{ paddingHorizontal: 14, paddingVertical: 14, flexDirection: "row", gap: 11, alignItems: "center" }}>
                <Image source={ICON} style={{ width: 38, height: 38, borderRadius: 9 }} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                    <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, fontWeight: "600", color: "#fff" }}>
                      {ask}
                    </Text>
                    <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.55)" }}>agora</Text>
                  </View>
                  <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 15, lineHeight: 20, color: "rgba(255,255,255,0.9)" }}>
                    R$ {brl(e.amount)} · {e.who}
                  </Text>
                </View>
              </View>
            </Glass>
          </Pressable>
        </Animated.View>
      )}

      {/* Held open: the rest of the screen blurs; our layout in the notification, the iPhone's two
          actions under it. A tap outside closes it and the purchase stays in the Copilot. */}
      {step === "aberta" && (
        <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(200)} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}>
          <Pressable onPress={() => setStep("nada")} style={{ flex: 1 }}>
            <BlurView intensity={45} tint="dark" style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.25)" }} />
          </Pressable>
          <Animated.View entering={dropIn(true)} style={{ position: "absolute", left: 12, right: 12, top: insets.top + 90, gap: 10 }}>
            <Glass>
              <View style={{ padding: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Image source={ICON} style={{ width: 22, height: 22, borderRadius: 5 }} />
                  <Text style={{ flex: 1, fontSize: 13, fontWeight: "600", letterSpacing: 0.3, color: "rgba(255,255,255,0.6)" }}>WILLO</Text>
                  <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>agora</Text>
                </View>
                <Text style={{ marginTop: 14, fontSize: 17, lineHeight: 22, fontWeight: "600", color: "#fff" }}>{ask}</Text>
                <Text style={{ marginTop: 10, color: "#fff" }}>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: "rgba(255,255,255,0.55)" }}>R$ </Text>
                  <Text style={{ fontSize: 40, fontWeight: "800", letterSpacing: -1.4 }}>{brl(e.amount)}</Text>
                </Text>
                <Text style={{ marginTop: 2, fontSize: 16, fontWeight: "500", color: "rgba(255,255,255,0.85)" }}>{e.who}</Text>
                <Text style={{ marginTop: 6, fontSize: 13.5, color: "rgba(255,255,255,0.55)" }}>
                  {e.bank} · {kind === "credito" ? "Crédito" : kind === "pix" ? "Pix" : "Débito"}
                  {e.income ? "" : ` · ${e.category}`}
                </Text>
              </View>
            </Glass>
            {/* The iPhone's own action list. */}
            <Glass radius={20}>
              <Pressable onPress={confirm} style={({ pressed }) => ({ height: 50, paddingHorizontal: 18, justifyContent: "center", backgroundColor: pressed ? "rgba(255,255,255,0.12)" : "transparent" })}>
                <Text style={{ fontSize: 17, color: "#fff" }}>Confirmar</Text>
              </Pressable>
              <View style={{ height: 0.5, backgroundColor: "rgba(255,255,255,0.15)" }} />
              <Pressable onPress={() => setStep("nada")} style={({ pressed }) => ({ height: 50, paddingHorizontal: 18, justifyContent: "center", backgroundColor: pressed ? "rgba(255,255,255,0.12)" : "transparent" })}>
                <Text style={{ fontSize: 17, color: "#FF453A" }}>Cancelar</Text>
              </Pressable>
            </Glass>
          </Animated.View>
        </Animated.View>
      )}

      {/* The one notification after confirming: the iPhone's own, at its own size, Willo speaking. */}
      {step === "notificacao" && (
        <Animated.View key={`note-${scene}`} entering={dropIn(locked)} exiting={liftOut(locked)} style={{ position: "absolute", left: side, right: side, top }}>
          <Pressable onPress={() => setStep("nada")}>
            <Glass>
              <View style={{ paddingHorizontal: 14, paddingVertical: 14, flexDirection: "row", gap: 11, alignItems: "center" }}>
                <Image source={ICON} style={{ width: 38, height: 38, borderRadius: 9 }} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                    <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, fontWeight: "600", color: "#fff" }}>
                      {said.title}
                    </Text>
                    <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.55)" }}>agora</Text>
                  </View>
                  <Text numberOfLines={4} style={{ marginTop: 1, fontSize: 15, lineHeight: 20, color: "rgba(255,255,255,0.9)" }}>
                    {said.body}
                  </Text>
                </View>
              </View>
            </Glass>
          </Pressable>
        </Animated.View>
      )}

      {/* The controls of the simulation, at the foot. */}
      {!opened && step !== "aberta" && (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={{ position: "absolute", left: 12, right: 12, bottom: insets.bottom + 10 }}>
          <Glass radius={24}>
            <View style={{ padding: 12, gap: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: "600", letterSpacing: 0.5, color: "rgba(255,255,255,0.5)", textAlign: "center" }}>SIMULAÇÃO · TOQUE ABRE O APP · SEGURE PARA ABRIR</Text>
              <Segment options={[["bloqueada", "Tela bloqueada"], ["app", "Em outro app"]]} value={scene} onChange={(v) => setScene(v as Scene)} />
              <Segment options={[["debito", "Débito"], ["credito", "Crédito"], ["pix", "Pix recebido"]]} value={kind} onChange={(v) => setKind(v as Kind)} />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/" as never))} style={{ flex: 1, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.1)" }}>
                  <Text style={{ fontSize: 14.5, fontWeight: "600", color: "#fff" }}>Sair</Text>
                </Pressable>
                <Pressable onPress={pay} style={{ flex: 1.4, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }}>
                  <Text style={{ fontSize: 14.5, fontWeight: "700", color: "#0B0B0B" }}>{kind === "pix" ? "Simular Pix" : "Simular compra"}</Text>
                </Pressable>
              </View>
            </View>
          </Glass>
        </Animated.View>
      )}

      {/* A tap on the card, or the pencil: Willo opens on the confirmation it always shows. */}
      <BottomSheet open={opened} onClose={() => !writing && setOpened(false)} full>
        {opened ? (
          <View style={{ paddingHorizontal: 14, paddingTop: 4, paddingBottom: 8 }}>
            <TransactionExperience
              data={{
                kind: e.income ? "receita" : "despesa",
                amount: e.amount,
                title: e.who,
                category: e.category,
                rows: passRows({ kind: e.income ? "receita" : "despesa", category: e.category, bank: { name: e.bank, hex: colorFor(e.bank, null) }, method: kind === "credito" ? "cartao" : "conta", date: new Date().toISOString().slice(0, 10) }),
              }}
              onConfirm={async (id) => {
                await new Promise((r) => setTimeout(r, 450));
                return { id, time: nowTime() };
              }}
              onPhase={(p) => setWriting(p === "saving" || p === "flow")}
              onDone={() => {
                setOpened(false);
                confirmed();
              }}
            />
          </View>
        ) : null}
      </BottomSheet>
    </View>
  );
}

/* The material of an iPhone notification: frosted, rounded at 26, a hairline edge, a soft shadow. */
function Glass({ children, radius = 26 }: { children: React.ReactNode; radius?: number }) {
  return (
    <View style={{ borderRadius: radius, borderCurve: "continuous", overflow: "hidden", borderWidth: 0.5, borderColor: "rgba(255,255,255,0.12)", shadowColor: "#000", shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } }}>
      <BlurView intensity={70} tint="dark" style={{ backgroundColor: "rgba(36,36,40,0.5)" }}>
        {children}
      </BlurView>
    </View>
  );
}

function Segment({ options, value, onChange }: { options: [string, string][]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ flexDirection: "row", padding: 3, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.08)" }}>
      {options.map(([k, label]) => (
        <Pressable key={k} onPress={() => onChange(k)} style={{ flex: 1, height: 32, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: value === k ? "rgba(255,255,255,0.18)" : "transparent" }}>
          <Text style={{ fontSize: 12.5, fontWeight: "600", color: value === k ? "#fff" : "rgba(255,255,255,0.6)" }}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function LockScreen({ top }: { top: number }) {
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const date = now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  return (
    <LinearGradient colors={["#1b1f4a", "#3a2a6e", "#0d0f24"]} style={{ flex: 1, alignItems: "center" }}>
      <Text style={{ marginTop: top + 150, fontSize: 17, fontWeight: "600", color: "rgba(255,255,255,0.85)" }}>{date}</Text>
      <Text style={{ fontSize: 92, fontWeight: "700", color: "rgba(255,255,255,0.92)", letterSpacing: -3 }}>{time}</Text>
    </LinearGradient>
  );
}

function OtherApp({ top }: { top: number }) {
  const block = (h: number, w: string | number = "100%") => <View style={{ height: h, width: w as never, borderRadius: 14, backgroundColor: "#e9e9ee" }} />;
  return (
    <View style={{ flex: 1, backgroundColor: "#fff", paddingTop: top + 60, paddingHorizontal: 18, gap: 14 }}>
      <Text style={{ fontSize: 30, fontWeight: "800", color: "#111" }}>Notas</Text>
      {block(18, "70%")}
      {block(140)}
      {block(18, "85%")}
      {block(18, "60%")}
      {block(110)}
      {block(18, "75%")}
    </View>
  );
}
