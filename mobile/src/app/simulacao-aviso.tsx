import { useEffect, useRef, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInDown, FadeOut, SlideInUp, SlideOutUp } from "react-native-reanimated";
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
type Step = "nada" | "aviso" | "notificacao";
type Kind = "debito" | "credito" | "pix";
type Size = "compacto" | "normal";

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

/* What Willo says on the card: never the same line twice in a row, so it reads as someone, not a form. */
function askFor(kind: Kind) {
  const e = EVENTS[kind];
  if (e.income)
    return pick([
      `Você recebeu um Pix no ${e.bank}. Posso anotar?`,
      `Caiu um Pix na sua conta do ${e.bank}. Anoto pra você?`,
      `Chegou um Pix agora no ${e.bank}. Registro como entrada?`,
      `${greeting()} Entrou um Pix no ${e.bank}. Posso anotar?`,
    ]);
  const how = kind === "credito" ? "no crédito" : "no débito";
  return pick([
    `Vi uma compra ${how} do ${e.bank}. Posso anotar?`,
    `Passou um gasto ${how} no ${e.bank}. Anoto pra você?`,
    `Opa, gasto novo no ${e.bank}. Registro?`,
    `Acabei de ver essa compra ${how}. Quer que eu anote?`,
    `${greeting()} Vi uma compra no ${e.bank}. Posso anotar?`,
  ]);
}

/* After a confirmation: Willo speaking, never a system receipt. */
function doneFor(kind: Kind) {
  const e = EVENTS[kind];
  const v = `R$ ${brl(e.amount)}`;
  if (e.income)
    return pick([
      { title: "Entrada anotada", body: `${v} de ${e.who} já estão no seu saldo do ${e.bank}.` },
      { title: "Prontinho", body: `Contei os ${v} do Pix de ${e.who} como seus.` },
      { title: "Dinheiro na conta", body: `Anotei ${v} de ${e.who}. Seu saldo já está em dia.` },
    ]);
  const where = kind === "credito" ? `na fatura do ${e.bank}` : `em ${e.category}`;
  return pick([
    { title: "Prontinho, anotei", body: `${v} na ${e.who}, ${where}.` },
    { title: "Deixei tudo certinho", body: `${v} na ${e.who} já estão ${where}.` },
    { title: "Anotado por aqui", body: `Registrei ${v} da ${e.who} ${where}. Pode seguir.` },
    { title: "Feito!", body: `${v} na ${e.who}, ${where}. Eu cuido do resto.` },
  ]);
}

export default function SimulacaoAviso() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [scene, setScene] = useState<Scene>("bloqueada");
  const [step, setStep] = useState<Step>("nada");
  /* Debit or credit comes from the bank's own notice, so the card never asks. */
  const [kind, setKind] = useState<Kind>("debito");
  const [size, setSize] = useState<Size>("compacto");
  const [ask, setAsk] = useState(() => askFor("debito"));
  const [said, setSaid] = useState(() => doneFor("debito"));
  const e = EVENTS[kind];
  const compact = size === "compacto";
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
  const top = locked ? insets.top + 300 : insets.top + 6;
  const pad = compact ? 14 : 18;
  const side = locked ? 12 : 8;
  const enter = (damping: number) => (locked ? FadeInDown.springify().damping(damping) : SlideInUp.springify().damping(damping).stiffness(170));
  const leave = locked ? FadeOut.duration(260) : SlideOutUp.duration(300);
  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      {scene === "bloqueada" ? <LockScreen top={insets.top} /> : <OtherApp top={insets.top} />}

      {/* The confirmation, dropping from the top. A tap on it opens the app's own confirmation. */}
      {step === "aviso" && (
        <Animated.View key={`card-${scene}`} entering={enter(19)} exiting={leave} style={{ position: "absolute", left: side, right: side, top }}>
          <Glass>
            <Pressable onPress={open} accessibilityLabel="Abrir no Willo" style={{ paddingHorizontal: pad, paddingTop: compact ? 12 : 16, paddingBottom: pad }}>
              {/* Willo, and the pencil in the corner. */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
                <Image source={ICON} style={{ width: compact ? 24 : 30, height: compact ? 24 : 30, borderRadius: compact ? 6 : 8 }} />
                {compact ? (
                  <Text style={{ flex: 1, fontSize: 13, fontWeight: "600", color: "#fff" }}>
                    {e.income ? "Registrar entrada" : "Registrar gasto"}
                    <Text style={{ fontWeight: "400", color: "rgba(255,255,255,0.5)" }}> · agora</Text>
                  </Text>
                ) : (
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13.5, fontWeight: "600", color: "#fff" }}>{e.income ? "Registrar entrada" : "Registrar gasto"}</Text>
                    <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Willo · agora</Text>
                  </View>
                )}
                <Pressable onPress={open} hitSlop={10} accessibilityRole="button" accessibilityLabel="Editar" style={({ pressed }) => ({ width: compact ? 28 : 34, height: compact ? 28 : 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.1)" })}>
                  <Pencil size={compact ? 13 : 15} color="#fff" strokeWidth={2.2} />
                </Pressable>
              </View>

              {/* What Willo saw, said as Willo — a different line each time. */}
              <Text style={{ marginTop: compact ? 10 : 16, fontSize: compact ? 13.5 : 14, lineHeight: compact ? 18 : 19, color: "rgba(255,255,255,0.75)" }}>{ask}</Text>
              {compact ? (
                /* The amount first and larger, then who or what it was. */
                <View style={{ marginTop: 6, flexDirection: "row", alignItems: "baseline", gap: 10 }}>
                  <Text style={{ color: "#fff" }}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: "rgba(255,255,255,0.55)" }}>R$ </Text>
                    <Text style={{ fontSize: 28, fontWeight: "800", letterSpacing: -1 }}>{brl(e.amount)}</Text>
                  </Text>
                  <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, fontWeight: "500", color: "rgba(255,255,255,0.85)" }}>
                    {e.who}
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={{ marginTop: 4, color: "#fff" }}>
                    <Text style={{ fontSize: 15, fontWeight: "700", color: "rgba(255,255,255,0.55)" }}>R$ </Text>
                    <Text style={{ fontSize: 34, fontWeight: "800", letterSpacing: -1.2 }}>{brl(e.amount)}</Text>
                  </Text>
                  <Text style={{ fontSize: 15, fontWeight: "500", color: "rgba(255,255,255,0.85)" }}>{e.who}</Text>
                </>
              )}

              {/* Confirmar first, Cancelar after. */}
              <View style={{ marginTop: compact ? 12 : 16, flexDirection: "row", gap: 8 }}>
                <Pressable onPress={confirm} accessibilityRole="button" accessibilityLabel="Confirmar" style={({ pressed }) => ({ flex: 1, height: compact ? 38 : 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: "#fff", opacity: pressed ? 0.85 : 1 })}>
                  <Text style={{ fontSize: compact ? 14 : 15, fontWeight: "700", color: "#0B0B0B" }}>Confirmar</Text>
                </Pressable>
                <Pressable onPress={() => setStep("nada")} accessibilityRole="button" accessibilityLabel="Cancelar" style={({ pressed }) => ({ flex: 1, height: compact ? 38 : 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.1)" })}>
                  <Text style={{ fontSize: compact ? 14 : 15, fontWeight: "600", color: "#fff" }}>Cancelar</Text>
                </Pressable>
              </View>
            </Pressable>
          </Glass>
        </Animated.View>
      )}

      {/* The one notification after confirming: the iPhone's own, with Willo speaking. */}
      {step === "notificacao" && (
        <Animated.View key={`note-${scene}`} entering={enter(20)} exiting={leave} style={{ position: "absolute", left: side, right: side, top }}>
          <Pressable onPress={() => setStep("nada")}>
            <Glass radius={compact ? 22 : 26}>
              <View style={{ padding: compact ? 10 : 13, flexDirection: "row", gap: 10, alignItems: "center" }}>
                <Image source={ICON} style={{ width: compact ? 30 : 38, height: compact ? 30 : 38, borderRadius: compact ? 7 : 9 }} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: compact ? 13.5 : 14, fontWeight: "700", color: "#fff" }}>{said.title}</Text>
                    <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>agora</Text>
                  </View>
                  <Text numberOfLines={compact ? 2 : 3} style={{ marginTop: 1, fontSize: compact ? 13 : 13.5, lineHeight: compact ? 17 : 18, color: "rgba(255,255,255,0.85)" }}>
                    {said.body}
                  </Text>
                </View>
              </View>
            </Glass>
          </Pressable>
        </Animated.View>
      )}

      {/* The controls of the simulation, at the foot. */}
      {!opened && (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={{ position: "absolute", left: 12, right: 12, bottom: insets.bottom + 10 }}>
          <Glass radius={24}>
            <View style={{ padding: 12, gap: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: "600", letterSpacing: 0.5, color: "rgba(255,255,255,0.5)", textAlign: "center" }}>SIMULAÇÃO DO AVISO DO COPILOT</Text>
              <Segment options={[["bloqueada", "Tela bloqueada"], ["app", "Em outro app"]]} value={scene} onChange={(v) => setScene(v as Scene)} />
              <Segment options={[["debito", "Débito"], ["credito", "Crédito"], ["pix", "Pix recebido"]]} value={kind} onChange={(v) => setKind(v as Kind)} />
              <Segment options={[["compacto", "Compacto"], ["normal", "Normal"]]} value={size} onChange={(v) => setSize(v as Size)} />
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

function Glass({ children, radius = 30 }: { children: React.ReactNode; radius?: number }) {
  return (
    <View style={{ borderRadius: radius, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 12 } }}>
      <BlurView intensity={60} tint="dark" style={{ backgroundColor: "rgba(24,24,28,0.6)" }}>
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
