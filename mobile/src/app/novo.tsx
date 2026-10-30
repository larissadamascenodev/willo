import { useEffect, useMemo, useRef, useState } from "react";
import { showToast } from "~/lib/toast";
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
import {
  createTransaction,
  getAccounts,
  getCreditCards,
  getTransactionById,
  updateTransaction,
} from "@/services/transactionService";
import { getCustomCategories, type CustomCategory } from "@/services/categoryService";
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from "@/lib/categoryData";
import { categoryHex } from "@/lib/categoryData";
import { colorFor, initials } from "@/lib/banks";
import { cardHex } from "@/hooks/useCardsOverview";
import Room from "~/components/Room";
import BottomSheet from "~/components/BottomSheet";
import SegmentedTabs from "~/components/SegmentedTabs";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock, CreditCard, FileText, Tag, Wallet, X, Sparkles, Minus, Plus } from "~/components/icons";
import { categoryIcon } from "~/lib/categoryIcon";
import CategoryPicker from "~/components/CategoryPicker";
import BankMark from "~/components/BankMark";
import CenterModal from "~/components/CenterModal";
import MonthCalendar from "~/components/eventos/MonthCalendar";
import { Group, Row as GRow, Segments, Stepper } from "~/components/accounts/caixinhaUi";
import { money } from "~/lib/money";
import { suggestCategory } from "~/lib/categorize";
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
 *
 * Opened with an id to edit, it is the same form filled in with what was saved,
 * and saving changes that movement rather than adding one. How it repeats is not
 * offered then: turning a purchase into instalments after the fact is a different
 * thing from correcting it.
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

const isoOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayISO = () => isoOf(new Date());

/** "Hoje", "Ontem", or the day itself. */
const dayLabel = (iso: string) => {
  const today = new Date();
  const d = new Date(`${iso}T12:00:00`);
  const diff = Math.round((new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86_400_000);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Ontem";
  if (diff === -1) return "Amanhã";
  return d
    .toLocaleDateString("pt-BR", { day: "numeric", month: "short", ...(d.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}) })
    .replace(".", "");
};
const shiftDay = (iso: string, by: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + by);
  return isoOf(d);
};

interface Account {
  id: string;
  name: string;
  is_default: boolean;
  color: string | null;
  current_balance: number;
}

interface Card {
  id: string;
  name: string;
  due_day: number;
  color: string | null;
  limit?: number | null;
  used_limit?: number | null;
}

export default function Novo() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ tipo?: string; editar?: string; cartao?: string }>();
  /* Opened from a card: the purchase starts on that card. */
  const fromCard = typeof params.cartao === "string" && params.cartao ? params.cartao : null;
  const editingId = typeof params.editar === "string" && params.editar ? params.editar : null;

  const [type, setType] = useState<"receita" | "despesa">(
    params.tipo === "receita" ? "receita" : "despesa",
  );
  const [cents, setCents] = useState(0);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(todayISO());
  const [method, setMethod] = useState<"conta" | "cartao">(fromCard ? "cartao" : "conta");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [creditCardId, setCreditCardId] = useState<string | null>(fromCard);
  const [recurrence, setRecurrence] = useState<"unica" | "parcelado" | "fixa">("unica");
  const [installments, setInstallments] = useState(2);
  const [status, setStatus] = useState<"pago" | "pendente">("pago");
  const [observation, setObservation] = useState("");

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [customCats, setCustomCats] = useState<CustomCategory[]>([]);
  const [pickingCategory, setPickingCategory] = useState(false);
  const [pickingDate, setPickingDate] = useState(false);
  const [calMonth, setCalMonth] = useState(() => ({ m: new Date().getMonth(), y: new Date().getFullYear() }));
  /* What Willo suggested for the name typed, and whether the person has chosen for themselves. */
  const [suggested, setSuggested] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const chosen = useRef(false);
  const editedOnCard = useRef<{ cardId: string; amount: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /* While the saved movement is on its way in, the form is not the person's yet. */
  const [loadingEdit, setLoadingEdit] = useState(!!editingId);

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
      if (!editingId) setAccountId(accs.find((x) => x.is_default)?.id ?? accs[0]?.id ?? null);
    })();
    return () => {
      alive = false;
    };
  }, [user, editingId]);

  /* Editing: the form starts from what was saved. */
  useEffect(() => {
    if (!editingId) return;
    let alive = true;
    getTransactionById(editingId)
      .then((tx: any) => {
        if (!alive || !tx) return;
        setType(tx.type === "receita" ? "receita" : "despesa");
        setCents(Math.round(Number(tx.amount) * 100));
        setName(tx.name ?? "");
        setCategory(tx.category ?? "");
        chosen.current = true;
        setDate(String(tx.date).slice(0, 10));
        setMethod(tx.payment_method === "cartao" ? "cartao" : "conta");
        setAccountId(tx.account_id ?? null);
        setCreditCardId(tx.credit_card_id ?? null);
        if (tx.payment_method === "cartao" && tx.credit_card_id) editedOnCard.current = { cardId: tx.credit_card_id, amount: Number(tx.amount) || 0 };
        setRecurrence(tx.recurrence_type === "parcelado" || tx.recurrence_type === "fixa" ? tx.recurrence_type : "unica");
        if (tx.installments) setInstallments(tx.installments);
        setStatus(tx.status === "pago" ? "pago" : "pendente");
        const obs = String(tx.observation ?? "");
        setObservation(obs.startsWith("paid_installments:") ? (obs.split(" | ")[1] ?? "") : obs);
      })
      .catch(() => alive && setError("Não consegui abrir esse lançamento."))
      .finally(() => alive && setLoadingEdit(false));
    return () => {
      alive = false;
    };
  }, [editingId]);

  /* A card purchase is settled by the statement, not on its own. */
  useEffect(() => {
    if (method === "cartao" && !loadingEdit) setStatus("pendente");
  }, [method, loadingEdit]);

  /* Willo reads the name as it is typed and fills in the category — until the person
     picks one themselves, after which their choice stands. */
  useEffect(() => {
    if (editingId || chosen.current) return;
    const text = name.trim();
    if (text.length < 3) {
      setSuggested(null);
      return;
    }
    let alive = true;
    const t = setTimeout(() => {
      setThinking(true);
      void suggestCategory({ name: text, amount: cents / 100, type })
        .then((cat) => {
          if (!alive || chosen.current || !cat) return;
          setSuggested(cat);
          setCategory(cat);
        })
        .finally(() => alive && setThinking(false));
    }, 700);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [name, type, editingId]); // eslint-disable-line react-hooks/exhaustive-deps

  const usingCard = !isReceita && method === "cartao";

  /* What a card still has free, with the purchase being edited given back to it. */
  const cardRoom = (id: string): number | null => {
    const c = cards.find((x) => x.id === id);
    if (!c || c.limit == null) return null;
    const back = editedOnCard.current?.cardId === id ? editedOnCard.current.amount : 0;
    return Number(c.limit) - (Number(c.used_limit) || 0) + back;
  };

  const categories = useMemo(() => {
    const defaults = isReceita ? DEFAULT_INCOME_CATEGORIES : DEFAULT_EXPENSE_CATEGORIES;
    const custom = customCats.filter((c) => c.type === type).map((c) => c.name);
    return [...new Set([...custom, ...defaults])];
  }, [isReceita, type, customCats]);

  const save = async () => {
    if (saving || loadingEdit) return;
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
    /* A card cannot take more than the room it has left. Paying or bringing a bill
       forward frees the room again; until then the purchase does not fit. */
    if (usingCard && creditCardId) {
      const room = cardRoom(creditCardId);
      if (room !== null && cents / 100 > room + 0.004) {
        setError(`Esse cartão tem só ${money(Math.max(room, 0))} de limite disponível. Pague ou antecipe a fatura para liberar limite.`);
        return;
      }
    }

    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await updateTransaction(editingId, {
          name: name.trim(),
          type,
          amount: cents / 100,
          category,
          date,
          status: usingCard ? "pendente" : status,
          payment_method: usingCard ? "cartao" : "conta",
          account_id: usingCard ? null : accountId,
          credit_card_id: usingCard ? creditCardId : null,
          observation: observation.trim() || null,
        });
        window.dispatchEvent(new CustomEvent("transaction-created"));
        showToast("Transação atualizada");
        router.back();
        return;
      }
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
      showToast(type === "receita" ? "Receita adicionada" : "Despesa adicionada");
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
              {editingId ? (isReceita ? "Editar receita" : "Editar despesa") : isReceita ? "Nova receita" : "Nova despesa"}
            </Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Which kind. Editing has no kind to choose — it already is one. */}
          <View style={{ marginTop: 8 }}>
            <SegmentedTabs
              value={type}
              onChange={(k) => {
                setType(k);
                setCategory("");
                setSuggested(null);
                chosen.current = false;
              }}
              options={[
                { key: "receita" as const, label: "Receita" },
                { key: "despesa" as const, label: "Despesa" },
              ]}
            />
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
              {editingId && recurrence === "parcelado"
                ? "Valor da parcela"
                : isReceita
                  ? "Valor da receita"
                  : "Valor da despesa"}
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
                <View style={{ flexShrink: 1, alignItems: "flex-end" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <CatIcon size={16} color={categoryHex(category, customCats)} />
                    <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 15, color: "#fff" }}>
                      {category}
                    </Text>
                  </View>
                  {suggested === category && !chosen.current && (
                    <View style={{ marginTop: 2, flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Sparkles size={10} color={GREEN} />
                      <Text style={{ fontSize: 11.5, color: GREEN }}>sugerida pelo Willo</Text>
                    </View>
                  )}
                </View>
              ) : (
                <Text style={{ fontSize: 15, color: INK.faint }}>{thinking ? "Willo está pensando…" : "Escolher"}</Text>
              )}
              <ChevronRight size={16} color={INK.faint} />
            </Row>
          </View>

          {/* ══ How it was paid: from an account, or on a card ══ */}
          {!isReceita && (
            <>
              <Text style={SECTION}>Como pagou</Text>
              <Segments
                height={44}
                value={method}
                options={[
                  { value: "conta" as const, label: "Débito / Pix" },
                  { value: "cartao" as const, label: "Crédito" },
                ]}
                onChange={(v) => setMethod(v)}
              />
            </>
          )}

          {/* ══ Which account or which card, each as itself ══ */}
          <Text style={SECTION}>{usingCard ? "Qual cartão" : isReceita ? "Entrou em qual conta" : "Saiu de qual conta"}</Text>
          <Group>
            {usingCard
              ? cards.map((c, i) => (
                  <PickRow
                    key={c.id}
                    last={i === cards.length - 1}
                    selected={c.id === creditCardId}
                    onPress={() => setCreditCardId(c.id)}
                    name={c.name}
                    hex={cardHex(c.color)}
                    subtitle={(() => {
                      const room = cardRoom(c.id);
                      return room === null ? `Vence dia ${c.due_day}` : `${money(Math.max(room, 0))} disponível · vence dia ${c.due_day}`;
                    })()}
                  />
                ))
              : accounts.map((a, i) => (
                  <PickRow
                    key={a.id}
                    last={i === accounts.length - 1}
                    selected={a.id === accountId}
                    onPress={() => setAccountId(a.id)}
                    name={a.name}
                    hex={colorFor(a.name, a.color)}
                    subtitle={`${money(Number(a.current_balance) || 0)}${a.is_default ? " · padrão" : ""}`}
                  />
                ))}
            {(usingCard ? cards : accounts).length === 0 && (
              <Text style={{ paddingVertical: 20, textAlign: "center", fontSize: 14, color: INK.soft }}>
                {usingCard ? "Nenhum cartão cadastrado" : "Nenhuma conta cadastrada"}
              </Text>
            )}
          </Group>

          {/* ══ Whether it comes back ══ */}
          {!editingId && (
            <>
              <Text style={SECTION}>Repetição</Text>
              <Segments
                height={44}
                value={recurrence}
                onChange={(v) => setRecurrence(v)}
                options={
                  isReceita
                    ? [
                        { value: "unica" as const, label: "Única" },
                        { value: "fixa" as const, label: "Todo mês" },
                      ]
                    : [
                        { value: "unica" as const, label: "Única" },
                        { value: "parcelado" as const, label: "Parcelado" },
                        { value: "fixa" as const, label: usingCard ? "Assinatura" : "Todo mês" },
                      ]
                }
              />

              {!isReceita && recurrence === "parcelado" && (
                <Group style={{ marginTop: 10 }}>
                  <GRow last>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <Stepper icon={Minus} label="Menos uma parcela" disabled={installments <= 2} onPress={() => setInstallments((n) => Math.max(2, n - 1))} />
                      <View style={{ alignItems: "center" }}>
                        <Text style={{ fontSize: 24, fontWeight: "800", letterSpacing: -0.6, color: "#fff" }}>{installments}x</Text>
                        {cents > 0 && (
                          <Text style={{ marginTop: 1, fontSize: 13, color: INK.soft }}>de R$ {brl(Math.round(cents / installments))}</Text>
                        )}
                      </View>
                      <Stepper icon={Plus} label="Mais uma parcela" disabled={installments >= 48} onPress={() => setInstallments((n) => Math.min(48, n + 1))} />
                    </View>
                  </GRow>
                </Group>
              )}
            </>
          )}

          {/* ══ When: today and yesterday a tap away, any other day on the calendar ══ */}
          <Text style={SECTION}>Quando</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <DayChip label="Hoje" on={date === todayISO()} onPress={() => setDate(todayISO())} />
            <DayChip label="Ontem" on={date === shiftDay(todayISO(), -1)} onPress={() => setDate(shiftDay(todayISO(), -1))} />
            <DayChip
              label={date !== todayISO() && date !== shiftDay(todayISO(), -1) ? dayLabel(date) : "Outra data"}
              icon={CalendarDays}
              on={date !== todayISO() && date !== shiftDay(todayISO(), -1)}
              onPress={() => {
                const d = new Date(`${date}T12:00:00`);
                setCalMonth({ m: d.getMonth(), y: d.getFullYear() });
                setPickingDate(true);
              }}
            />
          </View>

          {/* ══ Whether it has happened yet ══ */}
          {!usingCard && (
            <>
              <Text style={SECTION}>Situação</Text>
              <Segments
                height={44}
                value={status}
                onChange={(v) => setStatus(v)}
                options={[
                  { value: "pago" as const, label: isReceita ? "Recebido" : "Pago" },
                  { value: "pendente" as const, label: isReceita ? "A receber" : "Pendente" },
                ]}
              />
            </>
          )}

          {/* ══ Anything worth remembering about it ══ */}
          <Text style={SECTION}>Observação</Text>
          <Group>
            <TextInput
              placeholder="Escreva algo sobre esse lançamento (opcional)"
              placeholderTextColor={INK.faint}
              value={observation}
              onChangeText={setObservation}
              maxLength={200}
              multiline
              style={{ minHeight: 84, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14, fontSize: 15, lineHeight: 21, color: "#fff", textAlignVertical: "top" }}
            />
          </Group>

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
                {editingId ? "Salvar alterações" : isReceita ? "Adicionar receita" : "Adicionar despesa"}
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <CenterModal open={pickingDate} onClose={() => setPickingDate(false)} title="Escolher data">
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <Pressable accessibilityLabel="Mês anterior" hitSlop={8} onPress={() => setCalMonth(({ m, y }) => (m === 0 ? { m: 11, y: y - 1 } : { m: m - 1, y }))} style={{ padding: 6 }}>
            <ChevronLeft size={18} color="#fff" />
          </Pressable>
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#fff", textTransform: "capitalize" }}>
            {new Date(calMonth.y, calMonth.m, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
          </Text>
          <Pressable accessibilityLabel="Próximo mês" hitSlop={8} onPress={() => setCalMonth(({ m, y }) => (m === 11 ? { m: 0, y: y + 1 } : { m: m + 1, y }))} style={{ padding: 6 }}>
            <ChevronRight size={18} color="#fff" />
          </Pressable>
        </View>
        <MonthCalendar
          month={calMonth.m}
          year={calMonth.y}
          events={[]}
          selectedDay={(() => {
            const d = new Date(`${date}T12:00:00`);
            return d.getMonth() === calMonth.m && d.getFullYear() === calMonth.y ? d.getDate() : null;
          })()}
          onSelectDay={(day) => {
            if (!day) return;
            setDate(isoOf(new Date(calMonth.y, calMonth.m, day)));
            setPickingDate(false);
          }}
        />
      </CenterModal>

      <CategoryPicker
        open={pickingCategory}
        type={type}
        value={category}
        suggested={suggested}
        customCats={customCats}
        onClose={() => setPickingCategory(false)}
        onManage={() => {
          setPickingCategory(false);
          router.push("/categorias" as never);
        }}
        onPick={(cat) => {
          chosen.current = true;
          setCategory(cat);
          setPickingCategory(false);
          setError(null);
        }}
      />
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

/** An account or a card to pick, wearing its own mark — the bank's logo, the wallet's. */
function PickRow({
  selected,
  onPress,
  name,
  hex,
  subtitle,
  last,
}: {
  selected: boolean;
  onPress: () => void;
  name: string;
  hex: string;
  subtitle?: string;
  last?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      <GRow last={last}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <BankMark name={name} hex={hex} size={38} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontSize: 15.5, fontWeight: "600", color: "#fff" }}>{name}</Text>
            {subtitle && <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 12.5, color: INK.softer }}>{subtitle}</Text>}
          </View>
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: selected ? 0 : 1.5,
              borderColor: "rgba(255,255,255,0.28)",
              backgroundColor: selected ? "#fff" : "transparent",
            }}
          >
            {selected && <Check size={14} color="#0B0B0B" strokeWidth={3.2} />}
          </View>
        </View>
      </GRow>
    </Pressable>
  );
}

/** One of the quick days, or the calendar. */
function DayChip({ label, on, onPress, icon: Icon }: { label: string; on: boolean; onPress: () => void; icon?: React.ComponentType<{ size?: number; color?: string }> }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        height: 44,
        borderRadius: 22,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        borderWidth: 1,
        borderColor: on ? "#fff" : "rgba(255,255,255,0.10)",
        backgroundColor: on ? "#fff" : "rgba(255,255,255,0.06)",
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      {Icon && <Icon size={15} color={on ? "#0B0B0B" : "#fff"} />}
      <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "700", color: on ? "#0B0B0B" : "#fff" }}>{label}</Text>
    </Pressable>
  );
}
