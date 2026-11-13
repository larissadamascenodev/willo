import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, Text, TextInput, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  createTransaction,
  getAccounts,
  getCreditCards,
} from "@/services/transactionService";
import CategoryPicker from "~/components/CategoryPicker";
import EntryForm, { type EntryValues } from "~/components/registro/EntryForm";
import type { Account, Card } from "~/components/registro/entryParts";
import AccountSelect from "~/components/AccountSelect";
import StepSheet, { Ask } from "~/components/StepSheet";
import {
  Banknote,
  Check,
  House,
  Landmark,
  Minus,
  Pencil,
  Plus,
  Smartphone,
  Sparkles,
  Tv,
  Zap,
} from "~/components/icons";
import { money } from "~/lib/money";
import { useAuth } from "~/lib/auth";
import { GREEN, INK, RED } from "~/theme/tokens";
import { live, th } from "~/theme/theme";

/**
 * Adding a fixed income or a fixed cost, the way a new account's setup asks it: what it
 * is (the usual ones to tap, or a name of one's own), then how much and on which day of
 * the month. Nothing else — it lands in the account like the setup's, every month.
 */

type Kind = "despesa" | "receita";
type Icon = typeof House;

const PRESETS: Record<
  Kind,
  { label: string; category: string; Icon: Icon; day: number }[]
> = {
  receita: [
    { label: "Salário", category: "Salário", Icon: Banknote, day: 5 },
    { label: "Pró-labore", category: "Salário", Icon: Landmark, day: 5 },
    { label: "Aposentadoria", category: "Salário", Icon: Banknote, day: 1 },
    {
      label: "Aluguel recebido",
      category: "Transferências recebidas",
      Icon: House,
      day: 10,
    },
  ],
  despesa: [
    { label: "Aluguel", category: "Moradia", Icon: House, day: 5 },
    { label: "Luz", category: "Moradia", Icon: Zap, day: 10 },
    {
      label: "Internet",
      category: "Telefone e Internet",
      Icon: Smartphone,
      day: 10,
    },
    {
      label: "Celular",
      category: "Telefone e Internet",
      Icon: Smartphone,
      day: 15,
    },
    { label: "Streaming", category: "Assinaturas", Icon: Tv, day: 15 },
    { label: "Academia", category: "Academia", Icon: Sparkles, day: 10 },
  ],
};

const OTHER = "__outro";

const FIELD = live({
  height: 56,
  minWidth: 0,
  borderRadius: 18,
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.12)",
  backgroundColor: "rgba(255,255,255,0.06)",
  paddingHorizontal: 18,
  fontSize: 17,
  fontWeight: "600",
  color: "#fff",
} as const);

const MONTHS = [
  "jan.",
  "fev.",
  "mar.",
  "abr.",
  "maio",
  "jun.",
  "jul.",
  "ago.",
  "set.",
  "out.",
  "nov.",
  "dez.",
];

/** The next time a day of the month comes round: this month if it has not passed. */
function nextOn(day: number) {
  const now = new Date();
  let y = now.getFullYear();
  let m = now.getMonth();
  if (day < now.getDate()) {
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  const d = Math.min(Math.max(day, 1), new Date(y, m + 1, 0).getDate());
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export default function FixedSheet({
  kind,
  onClose,
}: {
  kind: Kind | null;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const open = kind !== null;
  /* Kept while the sheet slides away, so its words do not change under it. */
  const [k, setK] = useState<Kind>("receita");
  const [step, setStep] = useState(0);
  const [pick, setPick] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [cents, setCents] = useState(0);
  const [day, setDay] = useState(5);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /* Where it lands or leaves from: the person's accounts, the everyday one first. */
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  /* The check before saving: the same form as any entry's, everything still changeable. */
  const [entry, setEntry] = useState<EntryValues | null>(null);
  const [picking, setPicking] = useState(false);
  const [made, setMade] = useState<{
    name: string;
    amount: number;
    day: number;
    income: boolean;
    Icon: Icon;
  } | null>(null);

  useEffect(() => {
    if (!kind) return;
    setK(kind);
    setStep(0);
    setPick(null);
    setTyped("");
    setCents(0);
    setDay(5);
    setSaving(false);
    setError(null);
    setEntry(null);
    let alive = true;
    void Promise.all([getAccounts(), getCreditCards()])
      .then(([list, cs]) => {
        if (!alive) return;
        const rank = (t?: string) =>
          t === "checking" ? 0 : t === "savings" ? 1 : 2;
        const usable = (list as unknown as Account[])
          .filter((a) => a.type !== "investment")
          .sort((a, z) => rank(a.type) - rank(z.type));
        setAccounts(usable);
        setCards(cs as unknown as Card[]);
        setAccountId((cur) =>
          cur && usable.some((a) => a.id === cur)
            ? cur
            : (usable[0]?.id ?? null),
        );
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [kind]);

  const income = k === "receita";
  const preset = PRESETS[k].find((p) => p.label === pick) ?? null;
  const name = pick === OTHER ? typed.trim() : (pick ?? "");
  const starts = nextOn(day);
  const startsLater = Number(starts.slice(5, 7)) - 1 !== new Date().getMonth();

  const next = async () => {
    setError(null);
    if (step === 0) {
      if (preset) setDay(preset.day);
      setStep(1);
      return;
    }
    if (step === 1) {
      setEntry({
        type: k,
        cents,
        name,
        category:
          preset?.category ?? (income ? "Transferências recebidas" : "Outros"),
        method: "conta",
        whereId: accountId,
        repeat: "fixa",
        parts: null,
        date: starts,
        status: "pendente",
        note: "",
      });
      setStep(2);
      return;
    }
    const v = entry;
    if (!user || !v || v.cents <= 0 || !v.name.trim() || !v.whereId) return;
    setSaving(true);
    try {
      const credit = v.type === "despesa" && v.method === "cartao";
      await createTransaction(
        {
          name: v.name.trim(),
          type: v.type,
          amount: v.cents / 100,
          category: v.category ?? "Outros",
          date: v.date,
          status: credit ? "pendente" : v.status,
          payment_method:
            v.type === "receita" ? "conta" : (v.method ?? "conta"),
          account_id: credit ? null : v.whereId,
          credit_card_id: credit ? v.whereId : null,
          recurrence_type: v.repeat === "fixa" ? "fixa" : "unica",
        } as never,
        user.id,
      );
      window.dispatchEvent(new CustomEvent("transaction-created"));
      void Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => undefined);
      /* The sheet goes; a small card says it was done, and goes by itself. */
      setMade({
        name: v.name.trim(),
        amount: v.cents / 100,
        day: Number(v.date.slice(8, 10)),
        income: v.type === "receita",
        Icon: preset?.Icon ?? (v.type === "receita" ? Banknote : Pencil),
      });
      onClose();
    } catch {
      setError("Não foi possível salvar. Tente de novo.");
    } finally {
      setSaving(false);
    }
  };

  const canNext =
    step === 0
      ? !!pick && (pick !== OTHER || typed.trim().length >= 2)
      : step === 1
        ? cents > 0 && !!accountId
        : !!entry && entry.cents > 0 && !!entry.name.trim() && !!entry.whereId;

  return (
    <>
      <Saved made={made} onGone={() => setMade(null)} />
      <StepSheet
        open={open}
        onClose={onClose}
        step={step}
        steps={3}
        onBack={() => setStep(Math.max(step - 1, 0))}
        onNext={next}
        nextLabel={step === 2 ? "Confirmar e adicionar" : "Continuar"}
        nextDisabled={!canNext}
        busy={saving}
        tall={step === 2}
      >
        {step === 0 && (
          <View style={{ flex: 1 }}>
            <Ask
              title={income ? "Qual é a receita?" : "Qual é a conta?"}
              note={
                income
                  ? "O que entra todo mês. Toque numa ou escreva outra."
                  : "O que sai todo mês. Toque numa ou escreva outra."
              }
            />
            <View style={{ marginTop: 18, gap: 8 }}>
              {PRESETS[k].map((p) => (
                <Option
                  key={p.label}
                  label={p.label}
                  Icon={p.Icon}
                  on={pick === p.label}
                  onPress={() => setPick(pick === p.label ? null : p.label)}
                />
              ))}
              <Option
                label={income ? "Outra receita" : "Outra conta"}
                Icon={Pencil}
                on={pick === OTHER}
                onPress={() => setPick(pick === OTHER ? null : OTHER)}
              />
            </View>
            {pick === OTHER && (
              <TextInput
                value={typed}
                onChangeText={setTyped}
                autoFocus
                maxLength={40}
                placeholder={
                  income ? "Ex: Freela fixo, Pensão" : "Ex: Escola, Condomínio"
                }
                placeholderTextColor={th(INK.faint)}
                style={{ ...FIELD, marginTop: 12 }}
              />
            )}
          </View>
        )}

        {step === 1 && (
          <View style={{ flex: 1 }}>
            <Ask title={`${name}: qual o valor?`} />
            <TextInput
              value={(cents / 100).toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
              onChangeText={(t) =>
                setCents(
                  Math.min(
                    Number(t.replace(/\D/g, "").slice(0, 11) || "0"),
                    999999999,
                  ),
                )
              }
              keyboardType="number-pad"
              autoFocus
              style={{
                marginTop: 14,
                minWidth: 0,
                fontSize: 38,
                fontWeight: "800",
                letterSpacing: -1.4,
                color: th(cents === 0 ? INK.faint : "#fff"),
                padding: 0,
              }}
            />
            {/* Which account, right under the amount, so the keyboard never hides it. */}
            {accounts.length > 0 && (
              <View style={{ marginTop: 14 }}>
                <Text
                  style={{
                    marginBottom: 8,
                    fontSize: 13,
                    fontWeight: "600",
                    color: th(INK.soft),
                  }}
                >
                  {income ? "Entra na conta" : "Sai da conta"}
                </Text>
                <AccountSelect
                  options={accounts}
                  value={accountId}
                  onChange={setAccountId}
                  title={income ? "Em qual conta entra?" : "De qual conta sai?"}
                />
              </View>
            )}
            <DayStepper
              label={income ? "Cai todo dia" : "Vence todo dia"}
              value={day}
              onChange={setDay}
              note={
                startsLater
                  ? `Esse dia já passou neste mês: começa em ${Number(starts.slice(8, 10))} ${MONTHS[Number(starts.slice(5, 7)) - 1]}`
                  : undefined
              }
            />
          </View>
        )}

        {step === 2 && entry && (
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 22,
                fontWeight: "800",
                letterSpacing: -0.5,
                color: th("#fff"),
              }}
            >
              Confira antes de salvar
            </Text>
            <EntryForm
              values={entry}
              onChange={(patch) =>
                setEntry((cur) => (cur ? { ...cur, ...patch } : cur))
              }
              accounts={accounts}
              cards={cards}
              onPickCategory={() => setPicking(true)}
            />
            {error && (
              <Text style={{ marginTop: 12, fontSize: 13, color: th(RED) }}>
                {error}
              </Text>
            )}
          </View>
        )}
      </StepSheet>
      <CategoryPicker
        open={picking}
        type={entry?.type ?? k}
        value={entry?.category ?? ""}
        onPick={(c: string) => {
          setPicking(false);
          setEntry((cur) => (cur ? { ...cur, category: c } : cur));
        }}
        onClose={() => setPicking(false)}
      />
    </>
  );
}

/** One answer from the short list: a row, filled when chosen. */
function Option({
  label,
  on,
  onPress,
  Icon,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
  Icon: Icon;
}) {
  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
      style={({ pressed }) => ({
        height: 54,
        borderRadius: 18,
        borderCurve: "continuous",
        paddingHorizontal: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderWidth: 1,
        borderColor: th(on ? "#fff" : "rgba(255,255,255,0.10)", "line"),
        backgroundColor: th(
          on ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)",
          "bg",
        ),
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 11,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: th("rgba(255,255,255,0.08)", "bg"),
        }}
      >
        <Icon size={17} color={th("#fff")} strokeWidth={2.1} />
      </View>
      <Text
        style={{
          flex: 1,
          fontSize: 15.5,
          fontWeight: "600",
          color: th("#fff"),
        }}
      >
        {label}
      </Text>
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: on ? 0 : 1.5,
          borderColor: th("rgba(255,255,255,0.3)", "line"),
          backgroundColor: th(on ? "#fff" : "transparent", "bg"),
        }}
      >
        {on && <Check size={13} color={th("#0B0B0B")} strokeWidth={3.2} />}
      </View>
    </Pressable>
  );
}

/** A day of the month, one step at a time, on one line: the label, then − day +. */
function DayStepper({
  label,
  value,
  onChange,
  note,
}: {
  label: string;
  value: number;
  onChange: (d: number) => void;
  note?: string;
}) {
  const step = (by: number) => {
    void Haptics.selectionAsync().catch(() => undefined);
    onChange(((value - 1 + by + 31) % 31) + 1);
  };
  const btn = (by: number) => (
    <Pressable
      onPress={() => step(by)}
      hitSlop={8}
      accessibilityLabel={by < 0 ? "Dia anterior" : "Próximo dia"}
      style={({ pressed }) => ({
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: th("rgba(255,255,255,0.1)", "bg"),
        opacity: pressed ? 0.6 : 1,
      })}
    >
      {by < 0 ? (
        <Minus size={16} color={th("#fff")} strokeWidth={2.4} />
      ) : (
        <Plus size={16} color={th("#fff")} strokeWidth={2.4} />
      )}
    </Pressable>
  );
  return (
    <View
      style={{
        marginTop: 14,
        borderRadius: 18,
        borderCurve: "continuous",
        backgroundColor: th("rgba(255,255,255,0.06)", "bg"),
        borderWidth: 1,
        borderColor: th("rgba(255,255,255,0.08)", "line"),
        paddingVertical: 10,
        paddingLeft: 16,
        paddingRight: 10,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Text
          style={{
            flex: 1,
            fontSize: 14.5,
            fontWeight: "600",
            color: th("#fff"),
          }}
        >
          {label}
        </Text>
        {btn(-1)}
        <Text
          style={{
            minWidth: 34,
            textAlign: "center",
            fontSize: 24,
            fontWeight: "800",
            letterSpacing: -0.6,
            color: th("#fff"),
            fontVariant: ["tabular-nums"],
          }}
        >
          {value}
        </Text>
        {btn(1)}
      </View>
      {note ? (
        <Text style={{ marginTop: 6, fontSize: 12, color: th(INK.softer) }}>
          {note}
        </Text>
      ) : null}
    </View>
  );
}

/** "Added": a small card in the middle of the screen, gone by itself in a moment or at a touch. */
function Saved({
  made,
  onGone,
}: {
  made: {
    name: string;
    amount: number;
    day: number;
    income: boolean;
    Icon: Icon;
  } | null;
  onGone: () => void;
}) {
  const pop = useSharedValue(0);
  const gone = useRef(onGone);
  gone.current = onGone;
  useEffect(() => {
    if (!made) return;
    pop.set(0);
    pop.set(withSpring(1, { damping: 14, stiffness: 220 }));
    const t = setTimeout(() => {
      pop.set(withTiming(0, { duration: 180, easing: Easing.in(Easing.quad) }));
      setTimeout(() => gone.current(), 190);
    }, 2000);
    return () => clearTimeout(t);
  }, [made, pop]);
  const card = useAnimatedStyle(() => ({
    opacity: Math.min(pop.get() * 1.6, 1),
    transform: [{ scale: 0.86 + pop.get() * 0.14 }],
  }));
  if (!made) return null;
  const tint = made.income ? GREEN : RED;
  const I = made.Icon;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onGone}>
      <Pressable
        onPress={onGone}
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(0,0,0,0.28)",
        }}
      >
        <Animated.View
          style={[
            {
              width: 240,
              alignItems: "center",
              paddingVertical: 22,
              paddingHorizontal: 18,
              borderRadius: 26,
              borderCurve: "continuous",
              backgroundColor: th("#17181C", "bg"),
              borderWidth: 1,
              borderColor: th("rgba(255,255,255,0.08)", "line"),
              shadowColor: "#000",
              shadowOpacity: 0.3,
              shadowRadius: 24,
              shadowOffset: { width: 0, height: 10 },
            },
            card,
          ]}
        >
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: `${tint}26`,
            }}
          >
            <I size={24} color={tint} strokeWidth={2.1} />
            <View
              style={{
                position: "absolute",
                right: -2,
                bottom: -2,
                width: 20,
                height: 20,
                borderRadius: 10,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: tint,
              }}
            >
              <Check size={12} color="#fff" strokeWidth={3.2} />
            </View>
          </View>
          <Text
            style={{
              marginTop: 12,
              fontSize: 16,
              fontWeight: "700",
              color: th("#fff"),
            }}
          >
            {made.income ? "Receita adicionada" : "Despesa adicionada"}
          </Text>
          <Text
            numberOfLines={2}
            style={{
              marginTop: 4,
              fontSize: 13,
              lineHeight: 18,
              color: th(INK.soft),
              textAlign: "center",
            }}
          >
            {made.name} · {money(made.amount)}
            {"\n"}todo dia {made.day}
          </Text>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
