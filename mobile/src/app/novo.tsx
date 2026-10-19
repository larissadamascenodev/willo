import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createTransaction, getAccounts, getCreditCards } from "@/services/transactionService";
import { getCustomCategories, type CustomCategory } from "@/services/categoryService";
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from "@/lib/categoryData";
import { categoryHex } from "@/lib/categoryData";
import { colorFor, initials } from "@/lib/banks";
import { cardHex } from "@/hooks/useCardsOverview";
import Room from "~/components/Room";
import BottomSheet from "~/components/BottomSheet";
import { Check, ChevronRight, Clock, CreditCard, FileText, Tag, Wallet, X } from "~/components/icons";
import { categoryIcon } from "~/lib/categoryIcon";
import { chipFill, chipInk } from "~/lib/chip";
import { useAuth } from "~/lib/auth";
import { GREEN, INK, RED } from "~/theme/tokens";

/**
 * Putting something in.
 *
 * The screen asks in the order the answer comes to mind: how much, then what it
 * was, then where it came from, then whether it repeats. The figure leads because
 * it is the only part you already know when you open this — everything else is
 * recall.
 *
 * It fills the whole screen. As a panel it left a strip of the page showing above
 * it, and with the keyboard up that strip moved.
 */

const SECTION = {
  marginTop: 28,
  marginBottom: 4,
  paddingHorizontal: 4,
  fontSize: 11,
  fontWeight: "600" as const,
  letterSpacing: 1.4,
  textTransform: "uppercase" as const,
  color: INK.softer,
};

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

interface Account {
  id: string;
  name: string;
  is_default: boolean;
  color: string | null;
}

interface Card {
  id: string;
  name: string;
  due_day: number;
  color: string | null;
}

export default function Novo() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ tipo?: string }>();

  const [type, setType] = useState<"receita" | "despesa">(
    params.tipo === "receita" ? "receita" : "despesa",
  );
  const [cents, setCents] = useState(0);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [date] = useState(todayISO());
  const [method, setMethod] = useState<"conta" | "cartao">("conta");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [creditCardId, setCreditCardId] = useState<string | null>(null);
  const [recurrence, setRecurrence] = useState<"unica" | "parcelado" | "fixa">("unica");
  const [installments, setInstallments] = useState(2);
  const [status, setStatus] = useState<"pago" | "pendente">("pago");
  const [observation, setObservation] = useState("");

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [customCats, setCustomCats] = useState<CustomCategory[]>([]);
  const [pickingCategory, setPickingCategory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isReceita = type === "receita";
  const accent = isReceita ? GREEN : RED;

  useEffect(() => {
    if (!user) return;
    let alive = true;
    void (async () => {
      const [a, c, k] = await Promise.all([getAccounts(), getCreditCards(), getCustomCategories()]);
      if (!alive) return;
      const accs = a as unknown as Account[];
      setAccounts(accs);
      setCards(c as unknown as Card[]);
      setCustomCats(k);
      setAccountId(accs.find((x) => x.is_default)?.id ?? accs[0]?.id ?? null);
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  /* A card purchase is settled by the statement, not on its own. */
  useEffect(() => {
    if (method === "cartao") setStatus("pendente");
  }, [method]);

  const usingCard = !isReceita && method === "cartao";

  const categories = useMemo(() => {
    const defaults = isReceita ? DEFAULT_INCOME_CATEGORIES : DEFAULT_EXPENSE_CATEGORIES;
    const custom = customCats.filter((c) => c.type === type).map((c) => c.name);
    return [...new Set([...custom, ...defaults])];
  }, [isReceita, type, customCats]);

  const save = async () => {
    if (saving) return;
    if (cents === 0) {
      setError("Digite o valor.");
      return;
    }
    if (!name.trim()) {
      setError("Dê um nome ao lançamento.");
      return;
    }
    if (!category) {
      setError("Escolha uma categoria.");
      return;
    }
    if (!user) {
      setError("Entre na sua conta para lançar.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await createTransaction(
        {
          name: name.trim(),
          type,
          amount: cents / 100,
          category,
          date,
          status: usingCard ? "pendente" : status,
          payment_method: usingCard ? "cartao" : "conta",
          account_id: usingCard ? null : accountId,
          credit_card_id: usingCard ? creditCardId : null,
          recurrence_type: recurrence,
          installments: recurrence === "parcelado" ? installments : null,
          installment_current: recurrence === "parcelado" ? 1 : null,
          observation: observation.trim() || null,
        } as never,
        user.id,
      );
      /* Every screen that reads a month listens for this. */
      window.dispatchEvent(new CustomEvent("transaction-created"));
      router.back();
    } catch {
      setError("Não foi possível salvar. Tente de novo.");
      setSaving(false);
    }
  };

  const CatIcon = category ? categoryIcon(category, customCats) : null;

  return (
    <Room>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {/* Nav */}
        <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 16 }}>
          <View style={{ height: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Pressable
              onPress={() => router.back()}
              accessibilityLabel="Fechar"
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                marginLeft: -8,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <X size={24} color="rgba(255,255,255,0.82)" />
            </Pressable>
            <Text style={{ fontSize: 16, fontWeight: "600", color: "#fff" }}>
              {isReceita ? "Nova receita" : "Nova despesa"}
            </Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Which kind. Editing has no kind to choose — it already is one. */}
          <View
            style={{
              marginTop: 8,
              flexDirection: "row",
              borderRadius: 999,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.06)",
              backgroundColor: "rgba(255,255,255,0.035)",
              padding: 4,
            }}
          >
            {(["receita", "despesa"] as const).map((k) => {
              const on = type === k;
              return (
                <Text
                  key={k}
                  onPress={() => {
                    setType(k);
                    setCategory("");
                  }}
                  style={{
                    flex: 1,
                    height: 38,
                    lineHeight: 38,
                    textAlign: "center",
                    borderRadius: 999,
                    overflow: "hidden",
                    fontSize: 13,
                    fontWeight: "600",
                    backgroundColor: on ? "#fff" : "transparent",
                    color: on ? "#0B0B0B" : INK.soft,
                  }}
                >
                  {k === "receita" ? "Receita" : "Despesa"}
                </Text>
              );
            })}
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* The figure, loose on the page and reading from the left. */}
          <View style={{ paddingTop: 24, paddingBottom: 28 }}>
            <Text style={{ paddingHorizontal: 4, fontSize: 11.5, fontWeight: "600", letterSpacing: 1.4, textTransform: "uppercase", color: INK.softer }}>
              {isReceita ? "Valor da receita" : "Valor da despesa"}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, paddingHorizontal: 4, marginTop: 8 }}>
              <Text style={{ fontSize: 20, fontWeight: "700", color: INK.softer }}>R$</Text>
              <TextInput
                value={brl(cents)}
                onChangeText={(t) => {
                  const digits = t.replace(/\D/g, "").slice(0, 10);
                  setCents(Math.min(Number(digits || "0"), 99999999));
                  setError(null);
                }}
                keyboardType="number-pad"
                autoFocus
                style={{
                  /* A flex child does not shrink below its own content unless it is
                     told it may. At this size the field's intrinsic width is 636px,
                     which pushed the whole form sideways. */
                  flex: 1,
                  minWidth: 0,
                  fontSize: 46,
                  fontWeight: "800",
                  letterSpacing: -1.6,
                  color: cents === 0 ? INK.faint : "#fff",
                  padding: 0,
                }}
              />
            </View>
            <View style={{ marginTop: 16, marginHorizontal: 4, height: 2, width: 44, borderRadius: 999, backgroundColor: accent, opacity: 0.85 }} />
          </View>

          <Text style={SECTION}>O que foi</Text>
          <View>
            <Row icon={FileText} label="Descrição">
              <TextInput
                placeholder={isReceita ? "Ex: Salário" : "Ex: Mercado"}
                placeholderTextColor={INK.faint}
                value={name}
                onChangeText={(t) => {
                  setName(t);
                  setError(null);
                }}
                maxLength={100}
                style={{ flex: 1, minWidth: 0, textAlign: "right", fontSize: 15, color: "#fff", padding: 0 }}
              />
            </Row>
            <Row icon={Tag} label="Categoria" onPress={() => setPickingCategory(true)}>
              {category && CatIcon ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <CatIcon size={16} color={categoryHex(category, customCats)} />
                  <Text numberOfLines={1} style={{ fontSize: 15, color: "#fff" }}>
                    {category}
                  </Text>
                </View>
              ) : (
                <Text style={{ fontSize: 15, color: INK.faint }}>Escolher</Text>
              )}
              <ChevronRight size={16} color={INK.faint} />
            </Row>
          </View>

          {!isReceita && (
            <>
              <Text style={SECTION}>Como pagou</Text>
              <View
                style={{
                  flexDirection: "row",
                  borderRadius: 999,
                  backgroundColor: "rgba(255,255,255,0.06)",
                  padding: 4,
                  marginBottom: 4,
                }}
              >
                {(["conta", "cartao"] as const).map((k) => {
                  const on = method === k;
                  return (
                    <Text
                      key={k}
                      onPress={() => setMethod(k)}
                      style={{
                        flex: 1,
                        height: 34,
                        lineHeight: 34,
                        textAlign: "center",
                        borderRadius: 999,
                        overflow: "hidden",
                        fontSize: 13,
                        fontWeight: "600",
                        backgroundColor: on ? "#fff" : "transparent",
                        color: on ? "#0B0B0B" : "rgba(255,255,255,0.7)",
                      }}
                    >
                      {k === "conta" ? "Conta" : "Cartão"}
                    </Text>
                  );
                })}
              </View>
            </>
          )}

          {(isReceita || method === "conta") && (
            <View>
              {accounts.map((a, i) => (
                <PickRow
                  key={a.id}
                  first={i === 0}
                  selected={a.id === accountId}
                  onPress={() => setAccountId(a.id)}
                  hex={colorFor(a.name, a.color)}
                  mark={initials(a.name)}
                  title={a.name}
                  subtitle={a.is_default ? "Conta padrão" : undefined}
                />
              ))}
              {accounts.length === 0 && (
                <Text style={{ paddingVertical: 20, textAlign: "center", fontSize: 14, color: INK.soft }}>
                  Nenhuma conta cadastrada
                </Text>
              )}
            </View>
          )}

          {usingCard && (
            <View>
              {cards.map((c, i) => (
                <PickRow
                  key={c.id}
                  first={i === 0}
                  selected={c.id === creditCardId}
                  onPress={() => setCreditCardId(c.id)}
                  hex={cardHex(c.color)}
                  icon={CreditCard}
                  title={c.name}
                  subtitle={`Vence dia ${c.due_day}`}
                />
              ))}
              {cards.length === 0 && (
                <Text style={{ paddingVertical: 20, textAlign: "center", fontSize: 14, color: INK.soft }}>
                  Nenhum cartão cadastrado
                </Text>
              )}
            </View>
          )}

          <Text style={SECTION}>Repetição</Text>
          <View
            style={{
              flexDirection: "row",
              borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.06)",
              padding: 4,
            }}
          >
            {(isReceita
              ? ([["unica", "Única"], ["fixa", "Todo mês"]] as const)
              : ([["unica", "Única"], ["parcelado", "Parcelado"], ["fixa", usingCard ? "Assinatura" : "Todo mês"]] as const)
            ).map(([key, label]) => {
              const on = recurrence === key;
              return (
                <Text
                  key={key}
                  onPress={() => setRecurrence(key)}
                  style={{
                    flex: 1,
                    height: 34,
                    lineHeight: 34,
                    textAlign: "center",
                    borderRadius: 999,
                    overflow: "hidden",
                    fontSize: 13,
                    fontWeight: "600",
                    backgroundColor: on ? "#fff" : "transparent",
                    color: on ? "#0B0B0B" : "rgba(255,255,255,0.7)",
                  }}
                >
                  {label}
                </Text>
              );
            })}
          </View>

          {!isReceita && recurrence === "parcelado" && (
            <View style={{ marginTop: 8 }}>
              <Row icon={CreditCard} label="Parcelas">
                <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                  <Text
                    onPress={() => setInstallments((n) => Math.max(2, n - 1))}
                    style={{ fontSize: 22, color: "#fff", paddingHorizontal: 8 }}
                  >
                    −
                  </Text>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: "#fff", minWidth: 34, textAlign: "center" }}>
                    {installments}x
                  </Text>
                  <Text
                    onPress={() => setInstallments((n) => Math.min(48, n + 1))}
                    style={{ fontSize: 22, color: "#fff", paddingHorizontal: 8 }}
                  >
                    +
                  </Text>
                </View>
              </Row>
              {cents > 0 && (
                <Text style={{ marginTop: 8, paddingHorizontal: 4, fontSize: 13, color: INK.soft }}>
                  <Text style={{ fontWeight: "600", color: "#fff" }}>
                    {installments}x de R$ {brl(Math.round(cents / installments))}
                  </Text>
                </Text>
              )}
            </View>
          )}

          <Text style={SECTION}>Mais</Text>
          <View>
            {!usingCard && (
              <Row
                icon={status === "pago" ? Check : Clock}
                label={status === "pago" ? (isReceita ? "Recebido" : "Pago") : isReceita ? "A receber" : "Pendente"}
                onPress={() => setStatus((s) => (s === "pago" ? "pendente" : "pago"))}
              >
                <View
                  style={{
                    width: 48,
                    height: 28,
                    borderRadius: 999,
                    padding: 3,
                    justifyContent: "center",
                    alignItems: status === "pago" ? "flex-end" : "flex-start",
                    backgroundColor: status === "pago" ? GREEN : "rgba(255,255,255,0.15)",
                  }}
                >
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff" }} />
                </View>
              </Row>
            )}
            <Row icon={FileText} label="Observação">
              <TextInput
                placeholder="Opcional"
                placeholderTextColor={INK.softer}
                value={observation}
                onChangeText={setObservation}
                maxLength={200}
                style={{ flex: 1, minWidth: 0, textAlign: "right", fontSize: 15, color: "#fff", padding: 0 }}
              />
            </Row>
          </View>

          {error && (
            <Text style={{ marginTop: 16, paddingHorizontal: 4, fontSize: 13.5, color: RED }}>{error}</Text>
          )}
        </ScrollView>

        {/* Save */}
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: "rgba(255,255,255,0.06)",
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: insets.bottom + 14,
          }}
        >
          <Pressable
            onPress={save}
            disabled={saving}
            style={({ pressed }) => ({
              height: 56,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 999,
              backgroundColor: "#fff",
              opacity: pressed ? 0.82 : 1,
            })}
          >
            {saving ? (
              <ActivityIndicator color="#0B0B0B" />
            ) : (
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#0B0B0B" }}>
                {isReceita ? "Adicionar receita" : "Adicionar despesa"}
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <BottomSheet open={pickingCategory} onClose={() => setPickingCategory(false)} full>
        <View style={{ paddingHorizontal: 20 }}>
          <Text style={{ fontSize: 22, fontWeight: "700", color: "#fff" }}>Categoria</Text>
          <View style={{ marginTop: 16, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {categories.map((cat) => {
              const Icon = categoryIcon(cat, customCats);
              const hex = categoryHex(cat, customCats);
              const on = category === cat;
              return (
                <Pressable
                  key={cat}
                  onPress={() => {
                    setCategory(cat);
                    setPickingCategory(false);
                    setError(null);
                  }}
                  style={{
                    width: "31%",
                    alignItems: "center",
                    gap: 8,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: on ? "#fff" : "rgba(255,255,255,0.06)",
                    backgroundColor: on ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
                    paddingVertical: 14,
                    paddingHorizontal: 8,
                  }}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: chipFill(hex),
                    }}
                  >
                    <Icon size={20} color={chipInk(hex)} />
                  </View>
                  <Text numberOfLines={2} style={{ fontSize: 12, textAlign: "center", color: "rgba(255,255,255,0.85)" }}>
                    {cat}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </BottomSheet>
    </Room>
  );
}

/** Settings-style row: icon, label on the left, control on the right. */
function Row({
  icon: Icon,
  label,
  children,
  onPress,
}: {
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  label: string;
  children?: React.ReactNode;
  onPress?: () => void;
}) {
  const body = (
    <View
      style={{
        minHeight: 56,
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        paddingHorizontal: 4,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: "rgba(255,255,255,0.055)",
      }}
    >
      <Icon size={17} color={INK.softer} strokeWidth={2} />
      <Text style={{ fontSize: 15, color: "#fff" }}>{label}</Text>
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
        {children}
      </View>
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      {body}
    </Pressable>
  );
}

/** An account or a card to pick, shown as itself rather than as a chip in a box. */
function PickRow({
  selected,
  onPress,
  hex,
  mark,
  icon: Icon,
  title,
  subtitle,
  first,
}: {
  selected: boolean;
  onPress: () => void;
  hex: string;
  mark?: string;
  icon?: React.ComponentType<{ size?: number; color?: string }>;
  title: string;
  subtitle?: string;
  first?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        paddingHorizontal: 4,
        paddingVertical: 12,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: "rgba(255,255,255,0.055)",
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: hex,
        }}
      >
        {Icon ? <Icon size={15} color="#fff" /> : (
          <Text style={{ fontSize: 11.5, fontWeight: "700", color: "#fff" }}>{mark}</Text>
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "500", color: "#fff" }}>
          {title}
        </Text>
        {subtitle && (
          <Text numberOfLines={1} style={{ fontSize: 12, color: INK.softer }}>
            {subtitle}
          </Text>
        )}
      </View>
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: selected ? 0 : 1,
          borderColor: "rgba(255,255,255,0.2)",
          backgroundColor: selected ? "#fff" : "transparent",
        }}
      >
        {selected && <Check size={12} color="#0B0B0B" strokeWidth={3.4} />}
      </View>
    </Pressable>
  );
}
