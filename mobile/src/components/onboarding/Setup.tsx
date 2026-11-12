import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInRight,
  FadeOutLeft,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { BANKS } from "@/lib/banks";
import { createAccount, createCreditCard, createTransaction, getAccounts } from "@/services/transactionService";
import BankMark from "~/components/BankMark";
import { dueAfter } from "~/components/wallet/CardFormSheet";
import { Banknote, Check, ChevronLeft, CreditCard, House, Landmark, Minus, Plus, Receipt, Smartphone, Sparkles, Tv, Zap } from "~/components/icons";
import { C, Cta, MoneyInput, tap, type IconC } from "./kit";
import { useAuth } from "~/lib/auth";
import { setAccountStage } from "~/lib/accountStage";
import { readOnboardingAnswers } from "~/lib/onboarding";
import { money } from "~/lib/money";
import type { OnboardingAnswers } from "~/lib/onboardingProfile";

/**
 * The first minutes of a new account.
 *
 * The welcome comes first: a ring closes into a check over a slow, deep light, and the
 * four things worth setting up are named. Then a guide, one question to a screen and
 * never anything to scroll, in the order the money moves: the account it is in, the
 * bills that leave it every month, what comes into it, and the card. Each section can
 * be left for later, and is saved the way the app saves it everywhere else. At the
 * end, what was set up is shown before the home opens.
 */

type Section = "conta" | "fixas" | "receitas" | "cartao";
type Screen =
  | "hello"
  | "accHave"
  | "accBank"
  | "accName"
  | "accBalance"
  | "fixPick"
  | `fix:${string}`
  | "incAsk"
  | "incValue"
  | "cardAsk"
  | "cardBank"
  | "cardName"
  | "cardLimit"
  | "cardDays"
  | "done";

const SECTIONS: { id: Section; label: string; Icon: IconC; line: string }[] = [
  { id: "conta", label: "Sua conta", Icon: Landmark, line: "Onde o dinheiro fica, com o saldo de hoje" },
  { id: "fixas", label: "Gastos fixos", Icon: Receipt, line: "O que sai todo mês, com o dia de cada um" },
  { id: "receitas", label: "Receitas", Icon: Banknote, line: "Salário e o que mais entra todo mês" },
  { id: "cartao", label: "Cartão", Icon: CreditCard, line: "Para a fatura não pegar você de surpresa" },
];

const BILLS: { id: string; label: string; ask: string; category: string; Icon: IconC; day: number }[] = [
  { id: "aluguel", label: "Aluguel", ask: "o aluguel", category: "Moradia", Icon: House, day: 5 },
  { id: "luz", label: "Luz", ask: "a conta de luz", category: "Moradia", Icon: Zap, day: 10 },
  { id: "internet", label: "Internet", ask: "a internet", category: "Telefone e Internet", Icon: Smartphone, day: 10 },
  { id: "celular", label: "Celular", ask: "o celular", category: "Telefone e Internet", Icon: Smartphone, day: 15 },
  { id: "streaming", label: "Streaming", ask: "o streaming", category: "Assinaturas", Icon: Tv, day: 15 },
  { id: "academia", label: "Academia", ask: "a academia", category: "Academia", Icon: Sparkles, day: 10 },
];

const INCOMES: { id: string; label: string; category: string }[] = [
  { id: "salario", label: "Salário", category: "Salário" },
  { id: "prolabore", label: "Pró-labore", category: "Salário" },
  { id: "aposentadoria", label: "Aposentadoria", category: "Salário" },
  { id: "outra", label: "Outra renda fixa", category: "Transferências recebidas" },
];

const OTHER = "Outro";

/** The next time a day of the month comes round, as YYYY-MM-DD: this month if it has not passed. */
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
  const last = new Date(y, m + 1, 0).getDate();
  const d = Math.min(Math.max(day, 1), last);
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const sectionOf = (s: Screen): Section | null =>
  s.startsWith("acc") ? "conta" : s.startsWith("fix") ? "fixas" : s.startsWith("inc") ? "receitas" : s.startsWith("card") ? "cartao" : null;

/* ───────────────────────────── Pieces ───────────────────────────── */

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const ARC = 2 * Math.PI * 50;
const TICK = 46;

/** A ring that closes, a check drawn inside it, and light pulsing out behind. */
function DoneMark({ size = 112 }: { size?: number }) {
  const ring = useSharedValue(0);
  const tick = useSharedValue(0);
  const pulse = useSharedValue(0);
  useEffect(() => {
    ring.set(withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
    tick.set(withDelay(750, withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) })));
    pulse.set(withDelay(1100, withRepeat(withTiming(1, { duration: 2400, easing: Easing.out(Easing.quad) }), -1, false)));
  }, [ring, tick, pulse]);
  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: ARC * (1 - ring.get()) }));
  const tickProps = useAnimatedProps(() => ({ strokeDashoffset: TICK * (1 - tick.get()) }));
  const wave = useAnimatedStyle(() => ({ opacity: 0.4 * (1 - pulse.get()), transform: [{ scale: 1 + pulse.get() * 0.8 }] }));
  const wave2 = useAnimatedStyle(() => ({ opacity: 0.25 * (1 - pulse.get()), transform: [{ scale: 1 + pulse.get() * 1.5 }] }));
  const glow = useAnimatedStyle(() => ({ opacity: tick.get() }));
  return (
    <View style={{ width: size * 2.2, height: size * 1.7, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={[{ position: "absolute", width: size, height: size, borderRadius: size / 2, borderWidth: 1, borderColor: "#fff" }, wave2]} />
      <Animated.View style={[{ position: "absolute", width: size, height: size, borderRadius: size / 2, borderWidth: 1.5, borderColor: "#fff" }, wave]} />
      <Animated.View style={[{ position: "absolute", width: size, height: size, borderRadius: size / 2, backgroundColor: "rgba(255,255,255,0.07)" }, glow]} />
      <Svg width={size} height={size} viewBox="0 0 112 112">
        <Circle cx={56} cy={56} r={50} stroke="rgba(255,255,255,0.12)" strokeWidth={3} fill="none" />
        <AnimatedCircle cx={56} cy={56} r={50} stroke="#fff" strokeWidth={3} fill="none" strokeLinecap="round" strokeDasharray={[ARC, ARC]} animatedProps={ringProps} transform="rotate(-90 56 56)" />
        <AnimatedPath d="M38 57 L51 70 L75 44" stroke="#fff" strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={[TICK, TICK]} animatedProps={tickProps} />
      </Svg>
    </View>
  );
}

/** The deep light behind the welcome and the end: two slow glows drifting. */
function Glow() {
  const a = useSharedValue(0);
  useEffect(() => {
    a.set(withRepeat(withSequence(withTiming(1, { duration: 6000, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 6000, easing: Easing.inOut(Easing.sin) })), -1, false));
  }, [a]);
  const one = useAnimatedStyle(() => ({ transform: [{ translateX: -40 + a.get() * 80 }, { translateY: a.get() * 30 }] }));
  const two = useAnimatedStyle(() => ({ transform: [{ translateX: 40 - a.get() * 70 }, { translateY: -a.get() * 40 }] }));
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, overflow: "hidden" }}>
      <Animated.View style={[{ position: "absolute", top: -160, left: -80, width: 420, height: 420, borderRadius: 210, backgroundColor: "#5B3FE0", opacity: 0.32 }, one]} />
      <Animated.View style={[{ position: "absolute", top: 40, right: -140, width: 360, height: 360, borderRadius: 180, backgroundColor: "#2F7BFF", opacity: 0.18 }, two]} />
      <LinearGradient colors={["rgba(13,14,16,0)", "rgba(13,14,16,0.55)", C.bg]} locations={[0, 0.45, 0.8]} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} />
    </View>
  );
}

/** Where in the guide: one segment for each section, the current one filling. */
function Progress({ at, fill }: { at: number; fill: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {SECTIONS.map((s, i) => (
        <View key={s.id} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.12)", overflow: "hidden" }}>
          <View style={{ width: `${i < at ? 100 : i === at ? Math.max(fill, 0.08) * 100 : 0}%`, height: 4, borderRadius: 2, backgroundColor: "#fff" }} />
        </View>
      ))}
    </View>
  );
}

/** A question: a light first line and a bold second, and a word under it. */
function Ask({ title, strong, line }: { title: string; strong: string; line?: string }) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ fontSize: 29, lineHeight: 35, fontWeight: "300", letterSpacing: -0.8, color: "#fff" }}>
        {title}
        {"\n"}
        <Text style={{ fontWeight: "800" }}>{strong}</Text>
      </Text>
      {line ? <Text style={{ fontSize: 15, lineHeight: 21, color: C.soft }}>{line}</Text> : null}
    </View>
  );
}

/** The banks as a compact grid of marks, three to a row, with "Outro banco" to close it. */
function BankGrid({ value, onChange }: { value: string | null; onChange: (v: string) => void }) {
  const items = [...BANKS.map((b) => ({ name: b.name, hex: b.hex })), { name: OTHER, hex: "#3A3D46" }];
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {items.map((b) => {
        const on = value === b.name;
        return (
          <Pressable
            key={b.name}
            onPress={() => {
              tap();
              onChange(b.name);
            }}
            style={({ pressed }) => ({
              width: "31.9%",
              height: 76,
              borderRadius: 18,
              borderCurve: "continuous",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              borderWidth: on ? 1.5 : 1,
              borderColor: on ? "#fff" : C.line,
              backgroundColor: on ? "rgba(255,255,255,0.1)" : C.fill,
              transform: [{ scale: pressed ? 0.96 : 1 }],
            })}
          >
            {b.name === OTHER ? (
              <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.12)" }}>
                <Plus size={16} color="#fff" strokeWidth={2.4} />
              </View>
            ) : (
              <BankMark name={b.name} hex={b.hex} size={28} />
            )}
            <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: on ? "700" : "600", color: "#fff", paddingHorizontal: 4 }}>
              {b.name === OTHER ? "Outro banco" : b.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function StepBtn({ by, onPress }: { by: number; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityLabel={by < 0 ? "Dia anterior" : "Próximo dia"} style={({ pressed }) => ({ width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.1)", opacity: pressed ? 0.6 : 1 })}>
      {by < 0 ? <Minus size={18} color="#fff" strokeWidth={2.4} /> : <Plus size={18} color="#fff" strokeWidth={2.4} />}
    </Pressable>
  );
}

/** A day of the month, one step at a time, as the app's own card form does it. */
function DayStepper({ label, value, onChange, note }: { label: string; value: number; onChange: (d: number) => void; note?: string }) {
  const step = (by: number) => {
    tap();
    onChange(((value - 1 + by + 31) % 31) + 1);
  };
  return (
    <View style={{ borderRadius: 22, borderCurve: "continuous", backgroundColor: C.fill, borderWidth: 1, borderColor: C.line, paddingVertical: 14, paddingHorizontal: 16 }}>
      <Text style={{ fontSize: 13, fontWeight: "600", color: C.soft, textAlign: "center" }}>{label}</Text>
      <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <StepBtn by={-1} onPress={() => step(-1)} />
        <Text style={{ fontSize: 36, fontWeight: "800", letterSpacing: -1.2, color: "#fff", fontVariant: ["tabular-nums"] }}>{value}</Text>
        <StepBtn by={1} onPress={() => step(1)} />
      </View>
      {note ? <Text style={{ marginTop: 8, fontSize: 12.5, color: C.softer, textAlign: "center" }}>{note}</Text> : null}
    </View>
  );
}

/** One answer from a short list: a row, white when chosen. */
function Option({ label, on, onPress, Icon }: { label: string; on: boolean; onPress: () => void; Icon?: IconC }) {
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => ({
        height: 56,
        borderRadius: 18,
        borderCurve: "continuous",
        paddingHorizontal: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderWidth: 1,
        borderColor: on ? "#fff" : C.line,
        backgroundColor: on ? "#fff" : C.fill,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      {Icon ? (
        <View style={{ width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: on ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)" }}>
          <Icon size={17} color={on ? "#0B0B0B" : "#fff"} strokeWidth={2.2} />
        </View>
      ) : null}
      <Text style={{ flex: 1, fontSize: 15.5, fontWeight: "700", color: on ? "#0B0B0B" : "#fff" }}>{label}</Text>
      <View style={{ width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", borderWidth: on ? 0 : 1.5, borderColor: "rgba(255,255,255,0.3)", backgroundColor: on ? "#0B0B0B" : "transparent" }}>
        {on && <Check size={13} color="#fff" strokeWidth={3.2} />}
      </View>
    </Pressable>
  );
}

function NameInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      autoFocus
      maxLength={40}
      placeholder={placeholder}
      placeholderTextColor={C.softer}
      selectionColor="#fff"
      style={{ height: 62, borderRadius: 18, borderCurve: "continuous", borderWidth: 1, borderColor: value.trim().length >= 2 ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.14)", backgroundColor: C.fill, paddingHorizontal: 18, fontSize: 19, fontWeight: "700", color: "#fff" }}
    />
  );
}

/* ───────────────────────────── The guide ───────────────────────────── */

export default function Setup() {
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const compact = screenH < 760;
  const { user } = useAuth();
  const [answers, setAnswers] = useState<OnboardingAnswers | null>(null);
  const [accounts, setAccounts] = useState<{ name: string; current_balance: number | string | null }[] | null>(null);
  const [screen, setScreen] = useState<Screen>("hello");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* What the guide holds. */
  const [addAnother, setAddAnother] = useState(false);
  const [bank, setBank] = useState<string | null>(null);
  const [bankName, setBankName] = useState("");
  const [balance, setBalance] = useState(0);
  const [chosen, setChosen] = useState<string[]>([]);
  const [bills, setBills] = useState<Record<string, { amount: number; day: number }>>({});
  const [income, setIncome] = useState<string | null>(null);
  const [incomeAmount, setIncomeAmount] = useState(0);
  const [payday, setPayday] = useState(5);
  const [hasCard, setHasCard] = useState<boolean | null>(null);
  const [cardBank, setCardBank] = useState<string | null>(null);
  const [cardName, setCardName] = useState("");
  const [limit, setLimit] = useState(0);
  const [closing, setClosing] = useState(1);
  const [due, setDue] = useState(dueAfter(1));
  const [dueSet, setDueSet] = useState(false);
  /* What was set up, for the end. */
  const [made, setMade] = useState<{ section: Section; text: string }[]>([]);

  useEffect(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    void readOnboardingAnswers<OnboardingAnswers>().then((a) => {
      setAnswers(a);
      if (a?.income) setIncomeAmount(a.income);
    });
    void getAccounts()
      .then((rows) => setAccounts(rows as { name: string; current_balance: number | string | null }[]))
      .catch(() => setAccounts([]));
  }, []);

  const meta = (user?.user_metadata ?? {}) as { display_name?: string; full_name?: string };
  const first = (answers?.name || meta.display_name || meta.full_name || "").trim().split(" ")[0];
  const hasAccount = (accounts?.length ?? 0) > 0;

  /* The screens, in order, as the answers so far shape them. */
  const order = useMemo<Screen[]>(() => {
    const conta: Screen[] = hasAccount && !addAnother ? ["accHave"] : ["accBank", ...(bank === OTHER ? (["accName"] as Screen[]) : []), "accBalance"];
    const fixas: Screen[] = ["fixPick", ...chosen.map((id) => `fix:${id}` as Screen)];
    const receitas: Screen[] = ["incAsk", ...(income && income !== "nenhuma" ? (["incValue"] as Screen[]) : [])];
    const cartao: Screen[] = ["cardAsk", ...(hasCard ? (["cardBank", ...(cardBank === OTHER ? ["cardName"] : []), "cardLimit", "cardDays"] as Screen[]) : [])];
    return [...conta, ...fixas, ...receitas, ...cartao, "done"];
  }, [hasAccount, addAnother, bank, chosen, income, hasCard, cardBank]);

  const section = sectionOf(screen);
  const sectionIndex = section ? SECTIONS.findIndex((s) => s.id === section) : 0;
  const inSection = order.filter((s) => sectionOf(s) === section);
  const fill = section ? (inSection.indexOf(screen) + 1) / (inSection.length + 1) : 0;

  const go = (s: Screen) => {
    setError(null);
    setScreen(s);
  };
  const next = () => {
    const i = order.indexOf(screen);
    go(order[i + 1] ?? "done");
  };
  const back = () => {
    const i = order.indexOf(screen);
    go(i <= 0 ? "hello" : order[i - 1]);
  };
  /** Leaves the rest of this section for later. */
  const later = () => {
    const at = order.indexOf(screen);
    const after = order.find((s, i) => i > at && sectionOf(s) !== section);
    go(after ?? "done");
  };

  const enter = async () => {
    if (busy) return;
    setBusy(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    try {
      await setAccountStage("app");
    } catch {
      setBusy(false);
      setError("Não consegui abrir o app agora. Tente de novo.");
    }
  };

  /** Saves a section, then moves past it; a failure stays put with a word about it. */
  const save = async (work: () => Promise<{ section: Section; text: string }[]>) => {
    if (!user || busy) return;
    setBusy(true);
    setError(null);
    try {
      const done = await work();
      setMade((m) => [...m, ...done]);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setBusy(false);
      later();
    } catch {
      setBusy(false);
      setError("Não consegui salvar agora. Confira a internet e tente de novo.");
    }
  };

  const accountName = bank === OTHER ? bankName.trim() : bank ?? "";
  const saveAccount = () =>
    save(async () => {
      const b = BANKS.find((x) => x.name === bank);
      await createAccount(user!.id, { name: accountName, type: "checking", initial_balance: balance, color: b?.accent ?? null });
      return [{ section: "conta", text: `${accountName} · ${money(balance)}` }];
    });

  const saveBills = () =>
    save(async () => {
      const out: { section: Section; text: string }[] = [];
      for (const id of chosen) {
        const b = BILLS.find((x) => x.id === id)!;
        const v = bills[id];
        if (!v || v.amount <= 0) continue;
        await createTransaction(
          { name: b.label, type: "despesa", amount: v.amount, category: b.category, date: nextOn(v.day), status: "pendente", payment_method: "conta", recurrence_type: "fixa" } as never,
          user!.id,
        );
        out.push({ section: "fixas", text: `${b.label} · ${money(v.amount)} todo dia ${v.day}` });
      }
      return out;
    });

  const incomeDef = INCOMES.find((x) => x.id === income);
  const saveIncome = () =>
    save(async () => {
      await createTransaction(
        { name: incomeDef!.label, type: "receita", amount: incomeAmount, category: incomeDef!.category, date: nextOn(payday), status: "pendente", payment_method: "conta", recurrence_type: "fixa" } as never,
        user!.id,
      );
      return [{ section: "receitas", text: `${incomeDef!.label} · ${money(incomeAmount)} todo dia ${payday}` }];
    });

  const cardTitle = cardBank === OTHER ? cardName.trim() : cardBank ?? "";
  const saveCard = () =>
    save(async () => {
      const b = BANKS.find((x) => x.name === cardBank);
      await createCreditCard({ name: cardTitle, limit, closing_day: closing, due_day: due, color: b?.hex ?? null }, user!.id);
      return [{ section: "cartao", text: `${cardTitle} · fecha dia ${closing}, vence dia ${due}` }];
    });

  /* ─────────────── The welcome ─────────────── */
  if (screen === "hello") {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <Glow />
        <View style={{ flex: 1, paddingTop: insets.top + (compact ? 4 : 20), paddingHorizontal: 24 }}>
          <View style={{ alignItems: "center" }}>
            <DoneMark size={compact ? 92 : 108} />
          </View>
          <Animated.View entering={FadeInDown.delay(900).duration(560)} style={{ alignItems: "center" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 18, height: 1, backgroundColor: "rgba(255,255,255,0.35)" }} />
              <Text style={{ fontSize: 11.5, fontWeight: "800", letterSpacing: 2.6, color: "rgba(255,255,255,0.65)" }}>CONTA CRIADA</Text>
              <View style={{ width: 18, height: 1, backgroundColor: "rgba(255,255,255,0.35)" }} />
            </View>
            <Text style={{ marginTop: 12, fontSize: compact ? 30 : 34, lineHeight: compact ? 36 : 40, fontWeight: "300", letterSpacing: -1, color: "#fff", textAlign: "center" }}>
              {"Tudo pronto,\n"}
              <Text style={{ fontWeight: "800" }}>{first ? `${first}.` : "vamos começar."}</Text>
            </Text>
            <Text style={{ marginTop: 10, fontSize: 15, lineHeight: 22, color: C.soft, textAlign: "center", maxWidth: 320 }}>
              Em 2 minutos o Willo fica com a sua cara. Tudo pode ficar para depois.
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(1150).duration(500)} style={{ marginTop: compact ? 18 : 28, borderRadius: 24, borderCurve: "continuous", borderWidth: 1, borderColor: "rgba(255,255,255,0.09)", backgroundColor: "rgba(22,24,29,0.72)", paddingVertical: 6, paddingHorizontal: 16 }}>
            {SECTIONS.map(({ id, Icon, label, line }, n) => (
              <Animated.View key={id} entering={FadeInDown.delay(1250 + n * 100).duration(400)} style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: compact ? 10 : 13, borderTopWidth: n ? 1 : 0, borderTopColor: "rgba(255,255,255,0.06)" }}>
                <View style={{ width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.07)" }}>
                  <Icon size={18} color="#fff" strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>{label}</Text>
                  <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12.5, color: C.softer }}>{line}</Text>
                </View>
                <Text style={{ fontSize: 12, fontWeight: "700", color: "rgba(255,255,255,0.35)", fontVariant: ["tabular-nums"] }}>{n + 1}</Text>
              </Animated.View>
            ))}
          </Animated.View>
        </View>

        <Animated.View entering={FadeIn.delay(1600).duration(500)} style={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 10, gap: 6 }}>
          {error && <Text style={{ textAlign: "center", fontSize: 13, color: C.red }}>{error}</Text>}
          <Cta label="Configurar agora" onPress={() => go(order[0])} disabled={busy || accounts === null} />
          <Pressable onPress={() => void enter()} disabled={busy} hitSlop={8} style={({ pressed }) => ({ alignSelf: "center", paddingVertical: 10, flexDirection: "row", gap: 8, alignItems: "center", opacity: pressed ? 0.5 : 1 })}>
            {busy && <ActivityIndicator color="#fff" size="small" />}
            <Text style={{ fontSize: 14, color: "rgba(255,255,255,0.7)" }}>Fazer depois e entrar</Text>
          </Pressable>
        </Animated.View>
      </View>
    );
  }

  /* ─────────────── The end ─────────────── */
  if (screen === "done") {
    const shown = compact ? 4 : 6;
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <Glow />
        <View style={{ flex: 1, paddingTop: insets.top + (compact ? 4 : 20), paddingHorizontal: 24 }}>
          <View style={{ alignItems: "center" }}>
            <DoneMark size={compact ? 84 : 100} />
          </View>
          <Animated.View entering={FadeInDown.delay(800).duration(520)} style={{ alignItems: "center" }}>
            <Text style={{ fontSize: compact ? 28 : 32, lineHeight: compact ? 34 : 38, fontWeight: "300", letterSpacing: -0.9, color: "#fff", textAlign: "center" }}>
              {"Seu Willo está\n"}
              <Text style={{ fontWeight: "800" }}>do seu jeito.</Text>
            </Text>
            <Text style={{ marginTop: 10, fontSize: 15, lineHeight: 22, color: C.soft, textAlign: "center", maxWidth: 320 }}>
              {made.length ? "Isto já está no app. O resto você adiciona quando quiser." : "Você pode configurar tudo depois, de dentro do app."}
            </Text>
          </Animated.View>
          {made.length > 0 && (
            <Animated.View entering={FadeInDown.delay(1050).duration(480)} style={{ marginTop: 24, borderRadius: 24, borderCurve: "continuous", borderWidth: 1, borderColor: "rgba(255,255,255,0.09)", backgroundColor: "rgba(22,24,29,0.72)", paddingVertical: 4, paddingHorizontal: 16 }}>
              {made.slice(0, shown).map((m, n) => {
                const Icon = SECTIONS.find((s) => s.id === m.section)!.Icon;
                return (
                  <View key={n} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderTopWidth: n ? 1 : 0, borderTopColor: "rgba(255,255,255,0.06)" }}>
                    <Icon size={17} color="#fff" strokeWidth={2} />
                    <Text numberOfLines={1} style={{ flex: 1, fontSize: 14.5, fontWeight: "600", color: "#fff" }}>{m.text}</Text>
                    <Check size={15} color={C.green} strokeWidth={3} />
                  </View>
                );
              })}
              {made.length > shown && <Text style={{ paddingBottom: 12, fontSize: 13, color: C.softer }}>e mais {made.length - shown}</Text>}
            </Animated.View>
          )}
        </View>
        <Animated.View entering={FadeIn.delay(1300).duration(500)} style={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 16, gap: 8 }}>
          {error && <Text style={{ textAlign: "center", fontSize: 13, color: C.red }}>{error}</Text>}
          <Cta label={busy ? "Abrindo…" : "Entrar no Willo"} onPress={() => void enter()} disabled={busy} />
        </Animated.View>
      </View>
    );
  }

  /* ─────────────── One question to a screen ─────────────── */
  let body: ReactNode = null;
  let action: { label: string; ready: boolean; run: () => void } = { label: "Continuar", ready: true, run: next };

  if (screen === "accHave") {
    body = (
      <>
        <Ask title="Sua conta" strong="já está aqui." line="Você pode seguir, ou adicionar outra conta agora." />
        <View style={{ marginTop: 22, gap: 10 }}>
          {(accounts ?? []).slice(0, 3).map((a) => (
            <View key={a.name} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 20, borderCurve: "continuous", borderWidth: 1, borderColor: C.line, backgroundColor: C.fill }}>
              <BankMark name={a.name} hex={BANKS.find((b) => b.name === a.name)?.hex ?? "#3A3D46"} size={36} />
              <Text style={{ flex: 1, fontSize: 16, fontWeight: "700", color: "#fff" }}>{a.name}</Text>
              <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff", fontVariant: ["tabular-nums"] }}>{money(Number(a.current_balance) || 0)}</Text>
            </View>
          ))}
          <Pressable
            onPress={() => {
              tap();
              setAddAnother(true);
              go("accBank");
            }}
            style={({ pressed }) => ({ height: 54, borderRadius: 18, borderWidth: 1, borderStyle: "dashed", borderColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, opacity: pressed ? 0.6 : 1 })}
          >
            <Plus size={16} color="#fff" strokeWidth={2.4} />
            <Text style={{ fontSize: 15, fontWeight: "600", color: "#fff" }}>Adicionar outra conta</Text>
          </Pressable>
        </View>
      </>
    );
  }

  if (screen === "accBank") {
    body = (
      <>
        <Ask title="Onde fica o seu" strong="dinheiro hoje?" line="O banco da sua conta principal." />
        <View style={{ marginTop: 20 }}>
          <BankGrid value={bank} onChange={setBank} />
        </View>
      </>
    );
    action = { label: "Continuar", ready: !!bank, run: next };
  }

  if (screen === "accName") {
    body = (
      <>
        <Ask title="Qual é o nome" strong="do seu banco?" />
        <View style={{ marginTop: 22 }}>
          <NameInput value={bankName} onChange={setBankName} placeholder="Ex.: Sicoob" />
        </View>
      </>
    );
    action = { label: "Continuar", ready: bankName.trim().length >= 2, run: next };
  }

  if (screen === "accBalance") {
    body = (
      <>
        <Ask title="Quanto tem na" strong={`${accountName || "conta"} hoje?`} line="O saldo de agora. Daqui pra frente o Willo acompanha." />
        <View style={{ marginTop: 22 }}>
          <MoneyInput value={balance} onChange={setBalance} big autoFocus />
        </View>
      </>
    );
    action = { label: "Salvar conta", ready: true, run: () => void saveAccount() };
  }

  if (screen === "fixPick") {
    body = (
      <>
        <Ask title="Quais contas chegam" strong="todo mês?" line="Toque nas que você tem. O valor vem a seguir." />
        <View style={{ marginTop: 18, gap: 8 }}>
          {BILLS.map((b) => (
            <Option key={b.id} label={b.label} Icon={b.Icon} on={chosen.includes(b.id)} onPress={() => setChosen((c) => (c.includes(b.id) ? c.filter((x) => x !== b.id) : [...c, b.id]))} />
          ))}
        </View>
      </>
    );
    action = {
      label: "Continuar",
      ready: chosen.length > 0,
      run: () => {
        setBills((cur) => {
          const out = { ...cur };
          for (const id of chosen) if (!out[id]) out[id] = { amount: 0, day: BILLS.find((b) => b.id === id)!.day };
          return out;
        });
        next();
      },
    };
  }

  if (screen.startsWith("fix:")) {
    const id = screen.slice(4);
    const b = BILLS.find((x) => x.id === id)!;
    const v = bills[id] ?? { amount: 0, day: b.day };
    const set = (patch: Partial<{ amount: number; day: number }>) => setBills((cur) => ({ ...cur, [id]: { ...v, ...patch } }));
    const lastBill = chosen[chosen.length - 1] === id;
    body = (
      <>
        <Ask title="Quanto é" strong={`${b.ask}?`} line="Um valor médio já serve." />
        <View style={{ marginTop: 20, gap: 14 }}>
          <MoneyInput value={v.amount} onChange={(amount) => set({ amount })} big />
          <DayStepper label="Vence todo dia" value={v.day} onChange={(day) => set({ day })} />
        </View>
      </>
    );
    action = { label: lastBill ? "Salvar gastos fixos" : "Próximo", ready: v.amount > 0, run: () => (lastBill ? void saveBills() : next()) };
  }

  if (screen === "incAsk") {
    body = (
      <>
        <Ask title="E o que entra" strong="todo mês?" line="A sua renda fixa principal." />
        <View style={{ marginTop: 18, gap: 8 }}>
          {INCOMES.map((i) => (
            <Option key={i.id} label={i.label} Icon={Banknote} on={income === i.id} onPress={() => setIncome(i.id)} />
          ))}
          <Option label="Não tenho renda fixa" on={income === "nenhuma"} onPress={() => setIncome("nenhuma")} />
        </View>
      </>
    );
    action = { label: "Continuar", ready: !!income, run: () => (income === "nenhuma" ? later() : next()) };
  }

  if (screen === "incValue") {
    body = (
      <>
        <Ask title="Quanto é o seu" strong={`${(incomeDef?.label ?? "renda").toLowerCase()}?`} line="O valor que cai na conta. O Willo lança todo mês." />
        <View style={{ marginTop: 20, gap: 14 }}>
          <MoneyInput value={incomeAmount} onChange={setIncomeAmount} big />
          <DayStepper label="Cai todo dia" value={payday} onChange={setPayday} />
        </View>
      </>
    );
    action = { label: "Salvar renda", ready: incomeAmount > 0, run: () => void saveIncome() };
  }

  if (screen === "cardAsk") {
    body = (
      <>
        <Ask title="Você usa" strong="cartão de crédito?" line="Com ele aqui, eu aviso antes da fatura fechar." />
        <View style={{ marginTop: 18, gap: 8 }}>
          <Option label="Sim, uso cartão" Icon={CreditCard} on={hasCard === true} onPress={() => setHasCard(true)} />
          <Option label="Não uso cartão" on={hasCard === false} onPress={() => setHasCard(false)} />
        </View>
      </>
    );
    action = { label: "Continuar", ready: hasCard !== null, run: () => (hasCard ? go("cardBank") : go("done")) };
  }

  if (screen === "cardBank") {
    body = (
      <>
        <Ask title="De qual banco é" strong="o seu cartão?" line="O que você mais usa. Outros entram depois." />
        <View style={{ marginTop: 20 }}>
          <BankGrid value={cardBank} onChange={setCardBank} />
        </View>
      </>
    );
    action = { label: "Continuar", ready: !!cardBank, run: next };
  }

  if (screen === "cardName") {
    body = (
      <>
        <Ask title="Qual é o nome" strong="do cartão?" />
        <View style={{ marginTop: 22 }}>
          <NameInput value={cardName} onChange={setCardName} placeholder="Ex.: Sicredi Visa" />
        </View>
      </>
    );
    action = { label: "Continuar", ready: cardName.trim().length >= 2, run: next };
  }

  if (screen === "cardLimit") {
    body = (
      <>
        <Ask title="Qual é o limite" strong={`do ${cardTitle || "cartão"}?`} line="O limite total, como aparece no app do banco." />
        <View style={{ marginTop: 22 }}>
          <MoneyInput value={limit} onChange={setLimit} big autoFocus />
        </View>
      </>
    );
    action = { label: "Continuar", ready: limit > 0, run: next };
  }

  if (screen === "cardDays") {
    body = (
      <>
        <Ask title="Quando a fatura" strong="fecha e vence?" line="O vencimento costuma vir uma semana depois. Ajuste se o seu for diferente." />
        <View style={{ marginTop: 18, gap: 10 }}>
          <DayStepper
            label="Fecha todo dia"
            value={closing}
            onChange={(d) => {
              setClosing(d);
              if (!dueSet) setDue(dueAfter(d));
            }}
          />
          <DayStepper
            label="Vence todo dia"
            value={due}
            onChange={(d) => {
              setDueSet(true);
              setDue(d);
            }}
            note={dueSet ? undefined : "Sugerido: 7 dias depois do fechamento"}
          />
        </View>
      </>
    );
    action = { label: "Salvar cartão", ready: true, run: () => void saveCard() };
  }

  const sec = SECTIONS[sectionIndex];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: C.bg }}>
      <LinearGradient colors={["rgba(91,63,224,0.22)", "rgba(13,14,16,0)"]} style={{ position: "absolute", left: 0, right: 0, top: 0, height: 320 }} />
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Pressable onPress={back} accessibilityLabel="Voltar" hitSlop={8} style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)", opacity: pressed ? 0.6 : 1 })}>
            <ChevronLeft size={20} color="#fff" strokeWidth={2.4} />
          </Pressable>
          <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 2, color: "rgba(255,255,255,0.62)" }}>
            {sectionIndex + 1} DE 4 · {sec.label.toUpperCase()}
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <Progress at={sectionIndex} fill={fill} />
      </View>

      <Animated.View key={screen} entering={FadeInRight.duration(320).easing(Easing.out(Easing.cubic))} exiting={FadeOutLeft.duration(160)} style={{ flex: 1, paddingHorizontal: 20, paddingTop: compact ? 16 : 26 }}>
        {body}
      </Animated.View>

      <View style={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 8, paddingTop: 8, gap: 4 }}>
        {error && <Text style={{ textAlign: "center", fontSize: 13, color: C.red }}>{error}</Text>}
        <Cta label={busy ? "Salvando…" : action.label} onPress={action.run} disabled={!action.ready || busy} />
        <Pressable onPress={later} disabled={busy} hitSlop={8} style={({ pressed }) => ({ alignSelf: "center", paddingVertical: 10, opacity: pressed ? 0.5 : 1 })}>
          <Text style={{ fontSize: 14, color: "rgba(255,255,255,0.7)" }}>Cadastrar depois</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
