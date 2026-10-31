import { useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { createTransaction, getAccounts, getCreditCards, getRecentTransactions } from "@/services/transactionService";
import { allowedCategories, readEntry, todayISO } from "@/services/quickEntry";
import { parseLocal } from "@/lib/quickEntry/parseLocal";
import { categoryHex } from "@/lib/categoryData";
import { colorFor } from "@/lib/banks";
import BottomSheet from "~/components/BottomSheet";
import BankMark from "~/components/BankMark";
import CategoryPicker from "~/components/CategoryPicker";
import ReceiptCard from "~/components/registro/ReceiptCard";
import { ChevronLeft, CreditCard, Download, Landmark, Share2, Tag, X } from "~/components/icons";
import { categoryIcon } from "~/lib/categoryIcon";
import { chipFill, chipInk } from "~/lib/chip";
import { money } from "~/lib/money";
import { preloadCash } from "~/lib/sounds";
import { saveReceipt, shareReceipt } from "~/lib/receiptShare";
import { showToast } from "~/lib/toast";
import { useAuth } from "~/lib/auth";
import { GREEN, INK, RED } from "~/theme/tokens";

/**
 * Registro rápido: a double tap away, one question at a time.
 *
 * "O que aconteceu?" — the person writes it their own way, "padaria 48". Willo reads it
 * (on the phone when it can, the AI reader when it cannot), then asks only what is still
 * missing, one screen each: debit or credit, then which account or which card. Then
 * everything on one page to check — whether it went out or came in, the amount, the
 * words, the category Willo chose (changeable) — and Registrar. It lands on the receipt,
 * the coins, and the ways on: share it, keep it in the gallery, see the transactions.
 */

type Step = "write" | "method" | "where" | "confirm" | "done";

interface Account {
  id: string;
  name: string;
  color: string | null;
  type?: string;
}
interface Card {
  id: string;
  name: string;
  color: string | null;
  limit?: number | null;
  used_limit?: number | null;
}

const EXAMPLES = ["padaria 48", "uber 22 no crédito", "mercado 130", "recebi 300 de freela"];

export default function Rapido() {
  const router = useRouter();
  const { user } = useAuth();
  const receiptRef = useRef<ComponentRef<typeof View>>(null);

  const [step, setStep] = useState<Step>("write");
  const [said, setSaid] = useState("");
  const [reading, setReading] = useState(false);
  const [name, setName] = useState("");
  const [cents, setCents] = useState(0);
  const [type, setType] = useState<"despesa" | "receita">("despesa");
  const [category, setCategory] = useState<string | null>(null);
  const [method, setMethod] = useState<"conta" | "cartao" | null>(null);
  const [where, setWhere] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const history = useRef<Record<string, string>>({});

  useEffect(() => {
    getAccounts()
      .then((list) => setAccounts((list as unknown as Account[]).filter((a) => a.type !== "investment")))
      .catch(() => undefined);
    getCreditCards().then((c) => setCards(c as unknown as Card[])).catch(() => undefined);
    allowedCategories().then(setCategories).catch(() => undefined);
    getRecentTransactions(120)
      .then((rows) => {
        for (const r of rows as { name: string; category: string }[]) if (r.name && r.category && r.category !== "Outros") history.current[r.name] ??= r.category;
      })
      .catch(() => undefined);
  }, []);

  const options = useMemo(
    () =>
      method === "cartao"
        ? cards.map((c) => ({ id: c.id, name: c.name, color: c.color }))
        : accounts.map((a) => ({ id: a.id, name: a.name, color: a.color })),
    [method, accounts, cards],
  );
  const whereName = options.find((o) => o.id === where)?.name ?? null;

  /* After the way it was paid, the account or card — unless there is only one. */
  const afterMethod = (m: "conta" | "cartao") => {
    setMethod(m);
    const list = m === "cartao" ? cards : accounts;
    if (list.length === 1) {
      setWhere(list[0].id);
      setStep("confirm");
    } else {
      setWhere(null);
      setStep("where");
    }
  };

  const read = async () => {
    const text = said.trim();
    if (!text || reading) return;
    setError(null);
    setReading(true);
    try {
      const local = parseLocal(text, { today: todayISO(), categories, history: history.current });
      const entries = local ?? (await readEntry({ text, categories })).entries;
      const e = entries[0];
      if (!e) {
        setError("Não achei um valor aí. Tente algo como “padaria 48”.");
        return;
      }
      void Haptics.selectionAsync().catch(() => undefined);
      setName(e.name);
      setCents(Math.round(e.amount * 100));
      setType(e.type);
      setCategory(e.category);
      if (e.type === "receita") {
        afterMethod("conta");
      } else if (e.paymentMethod) {
        afterMethod(e.paymentMethod);
      } else {
        setMethod(null);
        setStep("method");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não consegui ler agora. Tente de novo.");
    } finally {
      setReading(false);
    }
  };

  const register = async () => {
    if (!user || !method || !where || cents <= 0 || !name.trim()) return;
    if (type === "despesa" && method === "cartao") {
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
          type,
          amount: cents / 100,
          category: category ?? "Outros",
          date: todayISO(),
          status: type === "despesa" && method === "cartao" ? "pendente" : "pago",
          payment_method: method,
          account_id: method === "conta" ? where : null,
          credit_card_id: method === "cartao" ? where : null,
        } as never,
        user.id,
      );
      window.dispatchEvent(new CustomEvent("transaction-created"));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setSavedAt(new Date());
      setStep("done");
    } catch {
      setError("Não consegui salvar agora. Tente de novo.");
    } finally {
      setSaving(false);
    }
  };

  /* The sheet leaves first; the screen behind it is already there. */
  const [open, setOpen] = useState(false);
  useEffect(() => {
    preloadCash();
    const t = setTimeout(() => setOpen(true), 30);
    return () => clearTimeout(t);
  }, []);
  const leave = (then?: () => void) => {
    setOpen(false);
    setTimeout(() => {
      if (router.canGoBack()) router.back();
      else router.replace("/" as never);
      then?.();
    }, 260);
  };
  const close = () => leave();
  const back = () => {
    setError(null);
    if (step === "method") setStep("write");
    else if (step === "where") setStep(type === "receita" ? "write" : "method");
    else if (step === "confirm") setStep(options.length > 1 ? "where" : type === "receita" ? "write" : "method");
  };

  const steps: Step[] = ["write", "method", "where", "confirm"];
  const stepNo = Math.min(steps.indexOf(step) + 1, 4);
  const methodLabel = method === "cartao" ? "Crédito" : "Débito";
  const Icon = category ? categoryIcon(category) : Tag;
  const hex = category ? categoryHex(category) : "#8B8D94";

  return (
    <>
      <BottomSheet open={open} onClose={close} full={step === "done"}>
        {/* ── Where in it, and the ways out ── */}
        <View style={{ paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          {step !== "write" && step !== "done" ? (
            <Pressable onPress={back} hitSlop={10} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 2, height: 36, paddingHorizontal: 10, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.08)", opacity: pressed ? 0.6 : 1 })}>
              <ChevronLeft size={16} color="#fff" />
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#fff" }}>Voltar</Text>
            </Pressable>
          ) : (
            <View style={{ width: 36 }} />
          )}
          <Pressable onPress={close} accessibilityLabel="Fechar" hitSlop={10} style={({ pressed }) => ({ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)", opacity: pressed ? 0.6 : 1 })}>
            <X size={17} color="rgba(255,255,255,0.88)" strokeWidth={2.4} />
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8 }}>
          {step !== "done" && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 1.4, color: "rgba(255,255,255,0.72)" }}>REGISTRO RÁPIDO · ETAPA {stepNo} DE 4</Text>
            </View>
          )}
          {step !== "done" && (
            <View style={{ marginTop: 8, flexDirection: "row", gap: 4 }}>
              {steps.map((s, i) => (
                <View key={s} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i < stepNo ? "#fff" : "rgba(255,255,255,0.12)" }} />
              ))}
            </View>
          )}

          {/* ── 1 · What happened ── */}
          {step === "write" && (
            <Animated.View key="write" entering={FadeIn.duration(260)} style={{ marginTop: 18 }}>
              <Text style={{ fontSize: 26, fontWeight: "800", letterSpacing: -0.7, color: "#fff" }}>O que aconteceu?</Text>
              <Text style={{ marginTop: 6, fontSize: 14.5, lineHeight: 20, color: INK.soft }}>
                Escreva do seu jeito: o que foi e quanto. Eu entendo a categoria e o resto.
              </Text>
              <TextInput
                autoFocus
                value={said}
                onChangeText={(t) => {
                  setSaid(t);
                  setError(null);
                }}
                onSubmitEditing={() => void read()}
                returnKeyType="next"
                placeholder="Ex.: padaria 48"
                placeholderTextColor={INK.faint}
                style={{ marginTop: 20, minHeight: 58, borderRadius: 20, paddingHorizontal: 18, fontSize: 19, fontWeight: "600", color: "#fff", backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: said.trim() ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.10)" }}
              />
              <View style={{ marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {EXAMPLES.map((e) => (
                  <Pressable key={e} onPress={() => setSaid(e)} style={({ pressed }) => ({ height: 32, justifyContent: "center", paddingHorizontal: 12, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.06)", opacity: pressed ? 0.6 : 1 })}>
                    <Text style={{ fontSize: 13, color: INK.soft }}>{e}</Text>
                  </Pressable>
                ))}
              </View>
              {error && <Text style={{ marginTop: 14, fontSize: 13.5, color: RED }}>{error}</Text>}
              <Primary label={reading ? "Lendo…" : "Continuar"} busy={reading} disabled={!said.trim() || reading} onPress={() => void read()} />
            </Animated.View>
          )}

          {/* ── 2 · Debit or credit ── */}
          {step === "method" && (
            <Animated.View key="method" entering={FadeInDown.duration(320)} style={{ marginTop: 22 }}>
              <Summary name={name} cents={cents} />
              <Text style={{ marginTop: 14, fontSize: 22, fontWeight: "800", letterSpacing: -0.5, color: "#fff" }}>Foi no débito ou no crédito?</Text>
              <View style={{ marginTop: 14, flexDirection: "row", gap: 10 }}>
                <Choice icon={<Landmark size={20} color="#fff" strokeWidth={2.1} />} label="Débito" onPress={() => afterMethod("conta")} />
                <Choice icon={<CreditCard size={20} color="#fff" strokeWidth={2.1} />} label="Crédito" onPress={() => afterMethod("cartao")} />
              </View>
            </Animated.View>
          )}

          {/* ── 3 · Which account, which card ── */}
          {step === "where" && (
            <Animated.View key="where" entering={FadeInDown.duration(320)} style={{ marginTop: 22 }}>
              <Summary name={name} cents={cents} />
              <Text style={{ marginTop: 14, fontSize: 22, fontWeight: "800", letterSpacing: -0.5, color: "#fff" }}>
                {method === "cartao" ? "Em qual cartão?" : type === "receita" ? "Entrou em qual conta?" : "De qual conta?"}
              </Text>
              <View style={{ marginTop: 14, flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {options.map((o) => (
                  <Choice
                    key={o.id}
                    icon={<BankMark name={o.name} hex={colorFor(o.name, o.color)} size={34} />}
                    label={o.name}
                    onPress={() => {
                      setWhere(o.id);
                      setStep("confirm");
                    }}
                  />
                ))}
              </View>
            </Animated.View>
          )}

          {/* ── 4 · Check before saving ── */}
          {step === "confirm" && (
            <Animated.View key="confirm" entering={FadeInDown.duration(320)} style={{ marginTop: 22 }}>
              <Text style={{ fontSize: 26, fontWeight: "800", letterSpacing: -0.7, color: "#fff" }}>Confira antes de salvar</Text>
              <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={{ fontSize: 13, color: INK.softer }}>Você escreveu</Text>
                <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 13, fontStyle: "italic", color: INK.soft }}>“{said.trim()}”</Text>
              </View>

              {/* Out or in */}
              <View style={{ marginTop: 18, flexDirection: "row", gap: 8 }}>
                {(["despesa", "receita"] as const).map((t) => {
                  const on = type === t;
                  return (
                    <Pressable
                      key={t}
                      onPress={() => setType(t)}
                      style={({ pressed }) => ({ flex: 1, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: on ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.10)", backgroundColor: on ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.04)", opacity: pressed ? 0.7 : 1 })}
                    >
                      <Text style={{ fontSize: 14.5, fontWeight: "700", color: on ? (t === "receita" ? GREEN : "#fff") : INK.soft }}>{t === "despesa" ? "Despesa" : "Receita"}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Field label="Valor">
                <TextInput
                  value={money(cents / 100)}
                  onChangeText={(t) => setCents(Math.min(Number(t.replace(/\D/g, "") || "0"), 99999999))}
                  keyboardType="number-pad"
                  style={{ padding: 0, fontSize: 32, fontWeight: "800", letterSpacing: -1, color: type === "receita" ? GREEN : "#FF8A9A" }}
                />
              </Field>
              <Field label="Descrição">
                <TextInput value={name} onChangeText={setName} maxLength={40} style={{ padding: 0, fontSize: 17, fontWeight: "600", color: "#fff" }} />
              </Field>
              <Field label="Categoria">
                <Pressable onPress={() => setPicking(true)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, opacity: pressed ? 0.7 : 1 })}>
                  <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: chipFill(hex) }}>
                    <Icon size={16} color={chipInk(hex)} strokeWidth={2} />
                  </View>
                  <Text style={{ flex: 1, fontSize: 16, fontWeight: "600", color: category ? "#fff" : "#F9CE4E" }}>{category ?? "Escolher categoria"}</Text>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: "#5AA9FF" }}>Trocar</Text>
                </Pressable>
              </Field>
              <Field label={type === "receita" ? "Entrou em" : "Pagamento"}>
                <Pressable onPress={() => setStep(type === "receita" ? "where" : "method")} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, opacity: pressed ? 0.7 : 1 })}>
                  {whereName ? <BankMark name={whereName} hex={colorFor(whereName, options.find((o) => o.id === where)?.color ?? null)} size={30} /> : null}
                  <Text style={{ flex: 1, fontSize: 16, fontWeight: "600", color: "#fff" }}>
                    {type === "receita" ? whereName : `${methodLabel}${whereName ? ` · ${whereName}` : ""}`}
                  </Text>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: "#5AA9FF" }}>Trocar</Text>
                </Pressable>
              </Field>

              {error && <Text style={{ marginTop: 14, fontSize: 13.5, color: RED }}>{error}</Text>}
              <Primary label={saving ? "Registrando…" : "Registrar"} busy={saving} disabled={saving || cents <= 0 || !name.trim() || !where} onPress={() => void register()} />
            </Animated.View>
          )}

          {/* ── Saved: the receipt, and what to do with it ── */}
          {step === "done" && savedAt && (
            <Animated.View key="done" entering={FadeIn.duration(240)} style={{ paddingTop: 2 }}>
              <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 1.4, color: GREEN }}>SALVO</Text>
              <Text style={{ marginTop: 4, fontSize: 28, fontWeight: "800", letterSpacing: -0.8, color: "#fff" }}>
                {type === "receita" ? "Receita registrada." : "Gasto registrado."}
              </Text>
              <View ref={receiptRef} collapsable={false} style={{ marginTop: 16, paddingHorizontal: 6, paddingTop: 6, paddingBottom: 10, borderRadius: 24, backgroundColor: "#0B0C0E" }}>
                <ReceiptCard
                  when={savedAt}
                  lines={[{ id: "1", name: name.trim(), category: category ?? "Outros", amount: cents / 100, type, method: type === "receita" ? whereName : `${methodLabel}${whereName ? ` · ${whereName}` : ""}` }]}
                />
              </View>

              <View style={{ marginTop: 22, flexDirection: "row", gap: 10 }}>
                <Secondary
                  icon={<Share2 size={16} color="#fff" />}
                  label="Compartilhar"
                  onPress={() =>
                    void shareReceipt(receiptRef, `Willo · ${name.trim()} · ${type === "receita" ? "+" : "−"}${money(cents / 100)} · ${category ?? "Outros"} · ${savedAt.toLocaleDateString("pt-BR")}`)
                  }
                />
                <Secondary
                  icon={<Download size={16} color="#fff" />}
                  label="Salvar"
                  onPress={() =>
                    void saveReceipt(receiptRef).then((r) =>
                      showToast(r === "saved" ? "Comprovante salvo na galeria" : r === "denied" ? "Libere o acesso às fotos para salvar" : "Salvar na galeria chega com a nova versão do app"),
                    )
                  }
                />
              </View>
              <Primary label="Concluir" onPress={close} />
              <Pressable onPress={() => leave(() => router.push("/(tabs)/transacoes" as never))} style={({ pressed }) => ({ marginTop: 6, height: 44, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: INK.soft }}>Ver transações</Text>
              </Pressable>
            </Animated.View>
          )}
        </View>
      </BottomSheet>

      <CategoryPicker
        open={picking}
        type={type}
        value={category ?? ""}
        onPick={(c: string) => {
          setCategory(c);
          setPicking(false);
        }}
        onClose={() => setPicking(false)}
      />
    </>
  );
}

function Summary({ name, cents }: { name: string; cents: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
      <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 15, color: INK.soft }}>{name}</Text>
      <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>{money(cents / 100)}</Text>
    </View>
  );
}

function Choice({ icon, label, note, onPress }: { icon: React.ReactNode; label: string; note?: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexGrow: 1,
        flexBasis: "45%",
        minHeight: 62,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 22,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.14)",
        backgroundColor: pressed ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.06)",
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)" }}>{icon}</View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: "700", color: "#fff" }}>{label}</Text>
        {note ? <Text style={{ marginTop: 2, fontSize: 12.5, color: INK.soft }}>{note}</Text> : null}
      </View>
    </Pressable>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 12, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", backgroundColor: "rgba(255,255,255,0.04)" }}>
      <Text style={{ fontSize: 11.5, color: INK.softer, marginBottom: 6 }}>{label}</Text>
      {children}
    </View>
  );
}

function Primary({ label, onPress, disabled, busy }: { label: string; onPress: () => void; disabled?: boolean; busy?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({ marginTop: 22, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, backgroundColor: "#fff", opacity: disabled && !busy ? 0.35 : pressed ? 0.85 : 1 })}
    >
      {busy && <ActivityIndicator color="#0B0B0B" />}
      <Text style={{ fontSize: 17, fontWeight: "700", color: "#0B0B0B" }}>{label}</Text>
    </Pressable>
  );
}

function Secondary({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ flex: 1, height: 50, borderRadius: 25, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", backgroundColor: "rgba(255,255,255,0.07)", opacity: pressed ? 0.7 : 1 })}
    >
      {icon}
      <Text style={{ fontSize: 15, fontWeight: "600", color: "#fff" }}>{label}</Text>
    </Pressable>
  );
}
