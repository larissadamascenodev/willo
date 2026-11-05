import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { LinearGradient as Fade } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { parseLocal } from "@/lib/quickEntry/parseLocal";
import Glass from "~/components/Glass";
import { ArrowUp, Check, Receipt } from "~/components/icons";
import { INK } from "~/theme/tokens";

/**
 * Trying Willo before there is an account: say an expense the way you would, and it
 * is written down at once.
 *
 * It is the real reader the app uses for Registro rápido — on the phone, no AI, no
 * network — run against a fixed set of categories, so what someone sees here is
 * exactly what happens inside. Nothing is saved: there is no account yet. Three
 * suggestions sit under the field for whoever would rather tap than type.
 *
 * `onState` tells the screen what Willo should be doing and saying: thinking while it
 * reads, pleased when it has written something down, puzzled when it could not.
 */

export type TryState = { kind: "idle" } | { kind: "reading" } | { kind: "done" } | { kind: "unclear"; question: boolean };

const CATEGORIES = [
  "Alimentação",
  "Supermercado",
  "Transporte",
  "Saúde",
  "Assinaturas",
  "Moradia",
  "Conta de Luz",
  "Conta de Água",
  "Telefone e Internet",
  "Pets",
  "Lazer",
  "Salário",
  "Freelance",
  "Reembolso",
  "Cashback",
];

const SUGGESTIONS = ["almoço 32", "uber 18 ontem", "mercado 127"];

interface Written {
  name: string;
  amount: number;
  income: boolean;
  category: string | null;
  when: string;
  how: string | null;
}

function isoToday() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function money(v: number) {
  const [int, dec] = v.toFixed(2).split(".");
  return `R$ ${int.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${dec}`;
}

function whenOf(date: string, today: string) {
  if (date === today) return "Hoje";
  const d = new Date(`${today}T12:00:00`);
  d.setDate(d.getDate() - 1);
  if (date === d.toISOString().slice(0, 10)) return "Ontem";
  const [, m, day] = date.split("-");
  return `${day}/${m}`;
}

export default function TryWillo({ onState, onFocus }: { onState: (s: TryState) => void; onFocus?: () => void }) {
  const [text, setText] = useState("");
  const [written, setWritten] = useState<Written | null>(null);
  const [round, setRound] = useState(0);
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const read = (sentence: string) => {
    const said = sentence.trim();
    if (!said) return;
    input.current?.blur();
    setText(said);
    onState({ kind: "reading" });
    if (timer.current) clearTimeout(timer.current);
    /* A breath to read it, so the moment is seen; the reading itself is instant. */
    timer.current = setTimeout(() => {
      const today = isoToday();
      const entries = parseLocal(said, { today, categories: CATEGORIES });
      const first = entries?.[0];
      if (!first) {
        setWritten(null);
        onState({ kind: "unclear", question: /\?|^(quanto|como|quando|posso|qual|o que)\b/i.test(said) });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
        return;
      }
      setWritten({
        name: first.name,
        amount: first.amount,
        income: first.type === "receita",
        category: first.category,
        when: whenOf(first.date || today, today),
        how: first.paymentMethod === "cartao" ? "Crédito" : first.paymentMethod === "conta" ? "Débito" : null,
      });
      setRound((r) => r + 1);
      onState({ kind: "done" });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    }, 520);
  };

  return (
    <View>
      <Glass radius={28} style={{ height: 56, flexDirection: "row", alignItems: "center", paddingLeft: 20, paddingRight: 6 }}>
        <TextInput
          ref={input}
          value={text}
          onChangeText={setText}
          onFocus={onFocus}
          onSubmitEditing={() => read(text)}
          placeholder="Diga um gasto, do seu jeito"
          placeholderTextColor="rgba(255,255,255,0.42)"
          returnKeyType="done"
          submitBehavior="blurAndSubmit"
          maxLength={80}
          autoCorrect={false}
          accessibilityLabel="Experimente: escreva um gasto"
          style={{ flex: 1, minWidth: 0, height: "100%", fontSize: 16, color: "#fff" }}
        />
        <Pressable
          onPress={() => read(text)}
          disabled={!text.trim()}
          accessibilityRole="button"
          accessibilityLabel="Anotar"
          hitSlop={6}
          style={({ pressed }) => ({
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: text.trim() ? "#fff" : "rgba(255,255,255,0.1)",
            transform: [{ scale: pressed ? 0.92 : 1 }],
          })}
        >
          <ArrowUp size={20} color={text.trim() ? "#0B0B0D" : "rgba(255,255,255,0.45)"} strokeWidth={2.4} />
        </Pressable>
      </Glass>

      <View style={{ minHeight: 88, marginTop: 10 }}>
        {written ? (
          <Card key={round} entry={written} />
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 }}>
            {SUGGESTIONS.map((s) => (
              <Pressable
                key={s}
                onPress={() => {
                  void Haptics.selectionAsync().catch(() => undefined);
                  read(s);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Experimentar: ${s}`}
                style={({ pressed }) => ({
                  height: 36,
                  paddingHorizontal: 14,
                  borderRadius: 18,
                  justifyContent: "center",
                  backgroundColor: pressed ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.07)",
                })}
              >
                <Text style={{ fontSize: 14, fontWeight: "600", color: INK.soft }}>“{s}”</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

/** What Willo wrote down, as the app shows an entry, arriving like a receipt. */
function Card({ entry }: { entry: Written }) {
  const reduce = useReducedMotion();
  const p = useSharedValue(reduce ? 1 : 0);
  const sheen = useSharedValue(0);
  const [shown, setShown] = useState(reduce ? entry.amount : 0);

  useEffect(() => {
    if (reduce) return;
    p.set(withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }));
    sheen.set(withDelay(260, withTiming(1, { duration: 900, easing: Easing.inOut(Easing.cubic) })));
    const t0 = Date.now();
    const id = setInterval(() => {
      const k = Math.min(1, (Date.now() - t0) / 650);
      setShown(entry.amount * (1 - (1 - k) ** 3));
      if (k >= 1) clearInterval(id);
    }, 30);
    return () => clearInterval(id);
  }, [p, sheen, entry.amount, reduce]);

  const arrive = useAnimatedStyle(() => ({
    opacity: p.get(),
    transform: [{ translateY: (1 - p.get()) * -14 }, { scale: 0.96 + 0.04 * p.get() }],
  }));
  const light = useAnimatedStyle(() => ({
    opacity: sheen.get() > 0 && sheen.get() < 1 ? 1 : 0,
    transform: [{ translateX: -220 + sheen.get() * 640 }, { rotate: "20deg" }],
  }));

  const meta = [entry.income ? "Entrada" : null, entry.category ?? "Categoria: o Willo pergunta", entry.when, entry.how].filter(Boolean).join(" · ");

  return (
    <Animated.View style={arrive}>
      <View style={{ borderRadius: 22, borderCurve: "continuous", overflow: "hidden", backgroundColor: "rgba(24,26,32,0.9)" }}>
        <Fade colors={["rgba(255,255,255,0.07)", "rgba(255,255,255,0)"]} style={{ position: "absolute", left: 0, right: 0, top: 0, height: 40 }} />
        <View style={{ padding: 16, gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)" }}>
              <Receipt size={18} color="#fff" strokeWidth={2} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ fontSize: 16.5, fontWeight: "700", color: "#fff" }}>
                {entry.name}
              </Text>
              <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 13, color: INK.softer }}>
                {meta}
              </Text>
            </View>
            <Text style={{ fontSize: 18, fontWeight: "800", letterSpacing: -0.4, color: "#fff", fontVariant: ["tabular-nums"] }}>
              {entry.income ? "+" : ""}
              {money(shown)}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(111,168,232,0.25)" }}>
              <Check size={11} color="#DCEBFF" strokeWidth={3} />
            </View>
            <Text style={{ fontSize: 13, color: INK.soft }}>Anotado num instante. Experimente outro.</Text>
          </View>
        </View>
        <Animated.View pointerEvents="none" style={[{ position: "absolute", top: -40, bottom: -40, width: 70 }, light]}>
          <Fade colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.12)", "rgba(255,255,255,0)"]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
        </Animated.View>
      </View>
    </Animated.View>
  );
}
