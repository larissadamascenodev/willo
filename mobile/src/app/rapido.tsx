import { useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { createTransaction, getAccounts, getCreditCards, getRecentTransactions } from "@/services/transactionService";
import { allowedCategories, todayISO } from "@/services/quickEntry";
import { parseLocal } from "@/lib/quickEntry/parseLocal";
import { categoryHex } from "@/lib/categoryData";
import { colorFor } from "@/lib/banks";
import Room from "~/components/Room";
import BankMark from "~/components/BankMark";
import CategoryPicker from "~/components/CategoryPicker";
import { DrawnTick } from "~/components/registro/VoiceEntrySheet";
import { CreditCard, Landmark, Tag, X } from "~/components/icons";
import { categoryIcon } from "~/lib/categoryIcon";
import { chipFill, chipInk } from "~/lib/chip";
import { suggestCategory } from "~/lib/categorize";
import { money } from "~/lib/money";
import { playCash } from "~/lib/sounds";
import { useAuth } from "~/lib/auth";
import { INK, RED } from "~/theme/tokens";

/**
 * Registro rápido: a double tap away.
 *
 * Four things and done — how much, on what, debit or credit, and which account or card.
 * The category is worked out as the words are typed (from the person's own history,
 * then the obvious words, then Willo), and can be changed with a tap. No instalments,
 * no dates, no notes: the full form exists for those. It ends on the drawn tick and the
 * coins, and closes on Concluir.
 */

interface Account {
  id: string;
  name: string;
  color: string | null;
  type?: string;
  is_default?: boolean;
}
interface Card {
  id: string;
  name: string;
  color: string | null;
  limit?: number | null;
  used_limit?: number | null;
}

export default function Rapido() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [cents, setCents] = useState(0);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [picked, setPicked] = useState(false);
  const [picking, setPicking] = useState(false);
  const [method, setMethod] = useState<"conta" | "cartao" | null>(null);
  const [where, setWhere] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const history = useRef<Record<string, string>>({});

  useEffect(() => {
    getAccounts()
      .then((list) => {
        const usable = (list as unknown as Account[]).filter((a) => a.type !== "investment");
        setAccounts(usable);
      })
      .catch(() => undefined);
    getCreditCards().then((c) => setCards(c as unknown as Card[])).catch(() => undefined);
    allowedCategories().then(setCategories).catch(() => undefined);
    getRecentTransactions(120)
      .then((rows) => {
        for (const r of rows as { name: string; category: string }[]) if (r.name && r.category && r.category !== "Outros") history.current[r.name] ??= r.category;
      })
      .catch(() => undefined);
  }, []);

  /* The category, guessed as the words come in — until the person picks one. */
  useEffect(() => {
    if (picked) return;
    const text = name.trim();
    if (text.length < 2) {
      setCategory(null);
      return;
    }
    const local = parseLocal(`${text} 1`, { today: todayISO(), categories, history: history.current })?.[0]?.category ?? null;
    if (local) {
      setCategory(local);
      return;
    }
    let alive = true;
    const t = setTimeout(() => {
      suggestCategory({ name: text, amount: cents / 100 || 1, type: "despesa" })
        .then((c) => alive && !picked && setCategory(c))
        .catch(() => undefined);
    }, 450);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [name, categories, picked, cents]);

  /* One account or one card needs no choosing. */
  useEffect(() => {
    if (method === "conta" && accounts.length === 1) setWhere(accounts[0].id);
    else if (method === "cartao" && cards.length === 1) setWhere(cards[0].id);
    else setWhere(null);
  }, [method, accounts, cards]);

  const options = useMemo(
    () => (method === "conta" ? accounts.map((a) => ({ id: a.id, name: a.name, color: a.color })) : method === "cartao" ? cards.map((c) => ({ id: c.id, name: c.name, color: c.color })) : []),
    [method, accounts, cards],
  );

  const ready = cents > 0 && name.trim().length > 0 && !!method && !!where && !saving;

  const save = async () => {
    if (!user || !ready || !method || !where) return;
    if (method === "cartao") {
      const card = cards.find((c) => c.id === where);
      const room = card?.limit != null ? Number(card.limit) - (Number(card.used_limit) || 0) : null;
      if (room !== null && cents / 100 > room + 0.004) {
        setError(`Esse cartão tem só ${money(Math.max(room, 0))} de limite disponível.`);
        return;
      }
    }
    setSaving(true);
    setError(null);
    try {
      await createTransaction(
        {
          name: name.trim().replace(/^./, (c) => c.toUpperCase()),
          type: "despesa",
          amount: cents / 100,
          category: category ?? "Outros",
          date: todayISO(),
          status: method === "cartao" ? "pendente" : "pago",
          payment_method: method,
          account_id: method === "conta" ? where : null,
          credit_card_id: method === "cartao" ? where : null,
        } as never,
        user.id,
      );
      window.dispatchEvent(new CustomEvent("transaction-created"));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      playCash();
      setDone(true);
    } catch {
      setError("Não consegui salvar agora. Tente de novo.");
    } finally {
      setSaving(false);
    }
  };

  const close = () => (router.canGoBack() ? router.back() : router.replace("/" as never));
  const Icon = category ? categoryIcon(category) : Tag;
  const hex = category ? categoryHex(category) : "#8B8D94";

  return (
    <Room lit sky>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 17, fontWeight: "700", color: "#fff" }}>Registro rápido</Text>
          <Pressable onPress={close} accessibilityLabel="Fechar" hitSlop={10} style={({ pressed }) => ({ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)", opacity: pressed ? 0.6 : 1 })}>
            <X size={17} color="rgba(255,255,255,0.88)" strokeWidth={2.4} />
          </Pressable>
        </View>

        {done ? (
          <Animated.View entering={FadeIn.duration(260)} style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
            <DrawnTick />
            <Animated.Text entering={FadeIn.delay(500).duration(300)} style={{ marginTop: 14, fontSize: 22, fontWeight: "800", color: "#fff" }}>
              Anotado!
            </Animated.Text>
            <Text style={{ marginTop: 6, fontSize: 15, color: INK.soft, textAlign: "center" }}>
              {name.trim()} · {money(cents / 100)} · {method === "cartao" ? "crédito" : "débito"}
            </Text>
            <Pressable onPress={close} style={({ pressed }) => ({ marginTop: 28, alignSelf: "stretch", height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", backgroundColor: "#fff", opacity: pressed ? 0.85 : 1 })}>
              <Text style={{ fontSize: 16.5, fontWeight: "700", color: "#0B0B0B" }}>Concluir</Text>
            </Pressable>
          </Animated.View>
        ) : (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: insets.bottom + 24 }}>
            {/* ── How much ── */}
            <TextInput
              autoFocus
              value={money(cents / 100)}
              onChangeText={(t) => setCents(Math.min(Number(t.replace(/\D/g, "") || "0"), 99999999))}
              keyboardType="number-pad"
              style={{ padding: 0, fontSize: 46, fontWeight: "800", letterSpacing: -1.8, color: cents === 0 ? INK.faint : "#fff" }}
            />

            {/* ── On what, and the category it brings ── */}
            <View style={{ marginTop: 18, flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Pressable onPress={() => setPicking(true)} accessibilityLabel="Categoria" style={{ width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center", backgroundColor: chipFill(hex) }}>
                <Icon size={21} color={chipInk(hex)} strokeWidth={2} />
              </Pressable>
              <TextInput
                value={name}
                onChangeText={(t) => {
                  setName(t);
                  setError(null);
                }}
                placeholder="O que foi? Ex.: padaria"
                placeholderTextColor={INK.faint}
                maxLength={40}
                style={{ flex: 1, height: 50, borderRadius: 18, paddingHorizontal: 16, fontSize: 16.5, color: "#fff", backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" }}
              />
            </View>
            <Pressable onPress={() => setPicking(true)} hitSlop={6} style={{ marginTop: 8, marginLeft: 60 }}>
              <Text style={{ fontSize: 13, color: category ? INK.soft : INK.faint }}>
                {category ? `${category} · tocar para trocar` : "A categoria aparece enquanto você escreve"}
              </Text>
            </Pressable>

            {/* ── Debit or credit ── */}
            <View style={{ marginTop: 24, flexDirection: "row", gap: 10 }}>
              {(
                [
                  { id: "conta", label: "Débito", Icon: Landmark },
                  { id: "cartao", label: "Crédito", Icon: CreditCard },
                ] as const
              ).map((o) => {
                const on = method === o.id;
                return (
                  <Pressable
                    key={o.id}
                    onPress={() => setMethod(o.id)}
                    style={({ pressed }) => ({
                      flex: 1,
                      height: 58,
                      borderRadius: 20,
                      overflow: "hidden",
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 9,
                      borderWidth: 1,
                      borderColor: on ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.14)",
                      backgroundColor: on ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.06)",
                      transform: [{ scale: pressed ? 0.97 : 1 }],
                    })}
                  >
                    <o.Icon size={19} color="#fff" strokeWidth={2.1} />
                    <Text style={{ fontSize: 16, fontWeight: "700", color: "#fff" }}>{o.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* ── Which account, which card ── */}
            {method && options.length > 1 && (
              <Animated.View entering={FadeInDown.duration(260)} style={{ marginTop: 14, flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {options.map((o) => {
                  const on = where === o.id;
                  return (
                    <Pressable
                      key={o.id}
                      onPress={() => setWhere(o.id)}
                      style={({ pressed }) => ({
                        flexGrow: 1,
                        flexBasis: "45%",
                        height: 58,
                        borderRadius: 20,
                        overflow: "hidden",
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        paddingHorizontal: 12,
                        borderWidth: 1,
                        borderColor: on ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.14)",
                        backgroundColor: on ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.06)",
                        transform: [{ scale: pressed ? 0.97 : 1 }],
                      })}
                    >
                        <BankMark name={o.name} hex={colorFor(o.name, o.color)} size={30} />
                      <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, fontWeight: "700", color: "#fff" }}>{o.name}</Text>
                    </Pressable>
                  );
                })}
              </Animated.View>
            )}

            {error && <Text style={{ marginTop: 14, fontSize: 13.5, color: RED }}>{error}</Text>}

            <Pressable
              onPress={() => void save()}
              disabled={!ready}
              style={({ pressed }) => ({ marginTop: 26, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: "#fff", opacity: !ready ? 0.35 : pressed ? 0.85 : 1 })}
            >
              <Text style={{ fontSize: 17, fontWeight: "700", color: "#0B0B0B" }}>{saving ? "Salvando…" : "Concluir"}</Text>
            </Pressable>
          </ScrollView>
        )}
      </KeyboardAvoidingView>

      <CategoryPicker
        open={picking}
        type="despesa"
        value={category ?? ""}
        onPick={(c: string) => {
          setCategory(c);
          setPicked(true);
          setPicking(false);
        }}
        onClose={() => setPicking(false)}
      />
    </Room>
  );
}
