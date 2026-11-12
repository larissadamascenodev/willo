import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { BANKS } from "@/lib/banks";
import { createAccount, createCreditCard, createTransaction, getAccounts } from "@/services/transactionService";
import BankMark from "~/components/BankMark";
import { Banknote, Check, CreditCard, House, Landmark, Receipt, Smartphone, Sparkles, Tv, Zap } from "~/components/icons";
import { Aura, C, Cta, Header, Label, MoneyInput, Title, tap, type IconC } from "./kit";
import { useAuth } from "~/lib/auth";
import { setAccountStage } from "~/lib/accountStage";
import { readOnboardingAnswers } from "~/lib/onboarding";
import type { OnboardingAnswers } from "~/lib/onboardingProfile";

/**
 * The first minutes of a new account.
 *
 * First the welcome: the account is made, a ring closes into a check, and the four
 * things worth setting up are laid out. Then, one screen each and every one of them
 * skippable, those four things — the account the money is in, the card, the salary
 * and the bills that come every month — so the home opens with something real in it.
 * Whatever is skipped can be added later from the app; the home shows every card,
 * empty or not, with the way to fill it.
 */

type Step = "hello" | "conta" | "cartao" | "salario" | "fixas";

const PLAN: { id: Exclude<Step, "hello">; Icon: IconC; title: string; line: string }[] = [
  { id: "conta", Icon: Landmark, title: "Sua conta", line: "Onde o dinheiro fica, com o saldo de hoje." },
  { id: "cartao", Icon: CreditCard, title: "Seu cartão", line: "Para acompanhar a fatura antes de fechar." },
  { id: "salario", Icon: Banknote, title: "Seu salário", line: "Quanto entra e em que dia." },
  { id: "fixas", Icon: Receipt, title: "Contas fixas", line: "Aluguel, luz, internet: o que vem todo mês." },
];

const BILLS: { id: string; label: string; category: string; Icon: IconC; day: number }[] = [
  { id: "aluguel", label: "Aluguel", category: "Moradia", Icon: House, day: 5 },
  { id: "luz", label: "Luz", category: "Moradia", Icon: Zap, day: 10 },
  { id: "internet", label: "Internet", category: "Telefone e Internet", Icon: Smartphone, day: 10 },
  { id: "celular", label: "Celular", category: "Telefone e Internet", Icon: Smartphone, day: 15 },
  { id: "streaming", label: "Streaming", category: "Assinaturas", Icon: Tv, day: 15 },
  { id: "academia", label: "Academia", category: "Academia", Icon: Sparkles, day: 10 },
];

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

const validDay = (n: number) => n >= 1 && n <= 31;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

const RING = 112;
const R = 50;
const ARC = 2 * Math.PI * R;
const TICK = 46;

/** A ring that closes, a check drawn inside it, and light pulsing out behind. */
function DoneMark() {
  const ring = useSharedValue(0);
  const tick = useSharedValue(0);
  const pulse = useSharedValue(0);
  useEffect(() => {
    ring.set(withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
    tick.set(withDelay(750, withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) })));
    pulse.set(withDelay(1100, withRepeat(withTiming(1, { duration: 2200, easing: Easing.out(Easing.quad) }), -1, false)));
  }, [ring, tick, pulse]);
  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: ARC * (1 - ring.get()) }));
  const tickProps = useAnimatedProps(() => ({ strokeDashoffset: TICK * (1 - tick.get()) }));
  const wave = useAnimatedStyle(() => ({ opacity: 0.35 * (1 - pulse.get()), transform: [{ scale: 1 + pulse.get() * 0.9 }] }));
  const glow = useAnimatedStyle(() => ({ opacity: tick.get() }));
  return (
    <View style={{ width: RING * 2, height: RING * 1.6, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={[{ position: "absolute", width: RING, height: RING, borderRadius: RING / 2, borderWidth: 1.5, borderColor: "#fff" }, wave]} />
      <Animated.View style={[{ position: "absolute", width: RING, height: RING, borderRadius: RING / 2, backgroundColor: "rgba(255,255,255,0.06)" }, glow]} />
      <Svg width={RING} height={RING} viewBox="0 0 112 112">
        <Circle cx={56} cy={56} r={R} stroke="rgba(255,255,255,0.12)" strokeWidth={3} fill="none" />
        <AnimatedCircle cx={56} cy={56} r={R} stroke="#fff" strokeWidth={3} fill="none" strokeLinecap="round" strokeDasharray={[ARC, ARC]} animatedProps={ringProps} transform="rotate(-90 56 56)" />
        <AnimatedPath d="M38 57 L51 70 L75 44" stroke="#fff" strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={[TICK, TICK]} animatedProps={tickProps} />
      </Svg>
    </View>
  );
}

function DayInput({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Label>{label}</Label>
      <View style={{ height: 58, borderRadius: 18, borderCurve: "continuous", borderWidth: 1, borderColor: validDay(value) ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.14)", backgroundColor: C.fill, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: C.softer }}>Dia</Text>
        <TextInput
          value={value ? String(value) : ""}
          onChangeText={(t) => onChange(Math.min(Number(t.replace(/\D/g, "").slice(0, 2) || "0"), 31))}
          keyboardType="number-pad"
          maxLength={2}
          placeholder="—"
          placeholderTextColor={C.softer}
          selectionColor="#fff"
          style={{ flex: 1, fontSize: 21, fontWeight: "800", color: "#fff", padding: 0 }}
        />
      </View>
    </View>
  );
}

/** The banks as a grid of marks; the chosen one lit. */
function BankGrid({ value, onChange }: { value: string | null; onChange: (v: string) => void }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {BANKS.map((b) => {
        const on = value === b.name;
        return (
          <Pressable
            key={b.id}
            onPress={() => {
              tap();
              onChange(b.name);
            }}
            style={({ pressed }) => ({
              width: "31.5%",
              paddingVertical: 12,
              borderRadius: 18,
              borderCurve: "continuous",
              alignItems: "center",
              gap: 7,
              borderWidth: on ? 1.5 : 1,
              borderColor: on ? "#fff" : C.line,
              backgroundColor: on ? "rgba(255,255,255,0.1)" : C.fill,
              transform: [{ scale: pressed ? 0.96 : 1 }],
            })}
          >
            <BankMark name={b.name} hex={b.hex} size={34} />
            <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: on ? "700" : "600", color: "#fff", paddingHorizontal: 4 }}>{b.name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function Setup() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [answers, setAnswers] = useState<OnboardingAnswers | null>(null);
  const [hasAccount, setHasAccount] = useState(false);
  const [step, setStep] = useState<Step>("hello");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* What each step holds. */
  const [bank, setBank] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [cardBank, setCardBank] = useState<string | null>(null);
  const [limit, setLimit] = useState(0);
  const [closing, setClosing] = useState(0);
  const [due, setDue] = useState(0);
  const [salary, setSalary] = useState(0);
  const [payday, setPayday] = useState(5);
  const [bills, setBills] = useState<Record<string, { amount: number; day: number }>>({});

  useEffect(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    void readOnboardingAnswers<OnboardingAnswers>().then((a) => {
      setAnswers(a);
      if (a?.income) setSalary(a.income);
    });
    void getAccounts()
      .then((rows) => setHasAccount((rows as unknown[]).length > 0))
      .catch(() => undefined);
  }, []);

  const meta = (user?.user_metadata ?? {}) as { display_name?: string; full_name?: string };
  const first = (answers?.name || meta.display_name || meta.full_name || "").trim().split(" ")[0];

  /* The steps this person goes through: the account only if there is none, the card only if they use one. */
  const steps = useMemo(
    () => PLAN.filter((p) => !(p.id === "conta" && hasAccount) && !(p.id === "cartao" && answers?.card === "sem-cartao")).map((p) => p.id),
    [hasAccount, answers?.card],
  );
  const at = step === "hello" ? -1 : steps.indexOf(step as (typeof steps)[number]);

  const finish = async () => {
    setBusy(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    try {
      await setAccountStage("app");
    } catch {
      setBusy(false);
      setError("Não consegui abrir o app agora. Tente de novo.");
    }
  };

  const next = () => {
    setError(null);
    const i = step === "hello" ? 0 : steps.indexOf(step as (typeof steps)[number]) + 1;
    if (i >= steps.length) void finish();
    else setStep(steps[i] as Step);
  };
  const back = () => {
    setError(null);
    const i = steps.indexOf(step as (typeof steps)[number]) - 1;
    setStep(i < 0 ? "hello" : (steps[i] as Step));
  };

  /** Runs a save, then moves on; on failure stays with a word about it. */
  const save = async (work: () => Promise<unknown>) => {
    if (!user || busy) return;
    setBusy(true);
    setError(null);
    try {
      await work();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setBusy(false);
      next();
    } catch {
      setBusy(false);
      setError("Não consegui salvar agora. Confira a internet e tente de novo.");
    }
  };

  const saveAccount = () =>
    save(async () => {
      const b = BANKS.find((x) => x.name === bank);
      await createAccount(user!.id, { name: bank!, type: "checking", initial_balance: balance, color: b?.accent ?? null });
      setHasAccount(true);
    });

  const saveCard = () =>
    save(async () => {
      const b = BANKS.find((x) => x.name === cardBank);
      await createCreditCard({ name: cardBank!, limit, closing_day: closing, due_day: due, color: b?.hex ?? null }, user!.id);
    });

  const saveSalary = () =>
    save(() =>
      createTransaction(
        { name: "Salário", type: "receita", amount: salary, category: "Salário", date: nextOn(payday), status: "pendente", payment_method: "conta", recurrence_type: "fixa" } as never,
        user!.id,
      ),
    );

  const chosenBills = BILLS.filter((b) => bills[b.id]);
  const billsReady = chosenBills.length > 0 && chosenBills.every((b) => bills[b.id].amount > 0 && validDay(bills[b.id].day));
  const saveBills = () =>
    save(async () => {
      for (const b of chosenBills) {
        const v = bills[b.id];
        await createTransaction(
          { name: b.label, type: "despesa", amount: v.amount, category: b.category, date: nextOn(v.day), status: "pendente", payment_method: "conta", recurrence_type: "fixa" } as never,
          user!.id,
        );
      }
    });

  /* ─────────────────────────── The welcome ─────────────────────────── */
  if (step === "hello") {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <Aura hex="#7C5CFF" top={-200} height={600} />
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 24, paddingHorizontal: 24 }} showsVerticalScrollIndicator={false}>
          <View style={{ alignItems: "center" }}>
            <DoneMark />
          </View>

          <Animated.View entering={FadeInDown.delay(900).duration(520)} style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 11.5, fontWeight: "800", letterSpacing: 2.2, color: "rgba(255,255,255,0.6)" }}>CONTA CRIADA</Text>
            <Text style={{ marginTop: 12, fontSize: 32, lineHeight: 38, fontWeight: "300", letterSpacing: -0.8, color: "#fff", textAlign: "center" }}>
              {"Tudo pronto,\n"}
              <Text style={{ fontWeight: "800" }}>{first ? `${first}.` : "vamos começar."}</Text>
            </Text>
            <Text style={{ marginTop: 10, fontSize: 15, lineHeight: 22, color: C.soft, textAlign: "center" }}>
              Agora vamos deixar o Willo com a sua cara. São uns 2 minutos, e tudo pode ficar para depois.
            </Text>
          </Animated.View>

          <View style={{ marginTop: 26, gap: 8, paddingBottom: 16 }}>
            {PLAN.filter((p) => steps.includes(p.id)).map(({ Icon, title, line }, n) => (
              <Animated.View key={title} entering={FadeInDown.delay(1150 + n * 110).duration(420)} style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: 20, borderCurve: "continuous", backgroundColor: C.card, borderWidth: 1, borderColor: C.line }}>
                <View style={{ width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: C.fill }}>
                  <Icon size={19} color="#fff" strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15.5, fontWeight: "700", color: "#fff" }}>{title}</Text>
                  <Text style={{ marginTop: 2, fontSize: 13, lineHeight: 18, color: C.soft }}>{line}</Text>
                </View>
              </Animated.View>
            ))}
          </View>
        </ScrollView>

        <Animated.View entering={FadeIn.delay(1500).duration(500)} style={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 12, gap: 10 }}>
          <Cta label="Configurar agora" onPress={next} disabled={busy} />
          <Pressable onPress={() => void finish()} disabled={busy} hitSlop={8} style={({ pressed }) => ({ alignSelf: "center", paddingVertical: 8, flexDirection: "row", gap: 8, alignItems: "center", opacity: pressed ? 0.5 : 1 })}>
            {busy && <ActivityIndicator color="#fff" size="small" />}
            <Text style={{ fontSize: 14, color: "rgba(255,255,255,0.7)" }}>Fazer depois e entrar</Text>
          </Pressable>
          {error && <Text style={{ textAlign: "center", fontSize: 13, color: C.red }}>{error}</Text>}
        </Animated.View>
      </View>
    );
  }

  /* ─────────────────────────── The steps ─────────────────────────── */
  const section = PLAN.find((p) => p.id === step)!.title.toUpperCase();
  let body: ReactNode = null;
  let action: { label: string; ready: boolean; run: () => void } = { label: "Continuar", ready: false, run: () => undefined };

  if (step === "conta") {
    body = (
      <>
        <Title title="Onde fica o seu" strong="dinheiro hoje?" line="Escolha o banco da sua conta principal. Você adiciona outras depois." />
        <View style={{ paddingHorizontal: 20, marginTop: 20, gap: 18 }}>
          <BankGrid value={bank} onChange={setBank} />
          {bank && (
            <Animated.View entering={FadeInDown.duration(320)}>
              <Label>Quanto tem nela agora?</Label>
              <MoneyInput value={balance} onChange={setBalance} big />
            </Animated.View>
          )}
        </View>
      </>
    );
    action = { label: "Salvar conta", ready: !!bank, run: () => void saveAccount() };
  }

  if (step === "cartao") {
    body = (
      <>
        <Title title="Qual cartão você" strong="usa mais?" line="Com o fechamento e o vencimento eu aviso antes da fatura apertar." />
        <View style={{ paddingHorizontal: 20, marginTop: 20, gap: 18 }}>
          <BankGrid value={cardBank} onChange={setCardBank} />
          {cardBank && (
            <Animated.View entering={FadeInDown.duration(320)} style={{ gap: 18 }}>
              <View>
                <Label>Limite total</Label>
                <MoneyInput value={limit} onChange={setLimit} />
              </View>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <DayInput label="Fecha no" value={closing} onChange={setClosing} />
                <DayInput label="Vence no" value={due} onChange={setDue} />
              </View>
            </Animated.View>
          )}
        </View>
      </>
    );
    action = { label: "Salvar cartão", ready: !!cardBank && limit > 0 && validDay(closing) && validDay(due), run: () => void saveCard() };
  }

  if (step === "salario") {
    body = (
      <>
        <Title title="Quanto entra" strong="todo mês?" line="O salário, ou o que você recebe de forma fixa. Eu lanço todo mês, no dia certo." />
        <View style={{ paddingHorizontal: 20, marginTop: 20, gap: 18 }}>
          <View>
            <Label>Valor</Label>
            <MoneyInput value={salary} onChange={setSalary} big />
          </View>
          <View style={{ flexDirection: "row" }}>
            <DayInput label="Cai no" value={payday} onChange={setPayday} />
            <View style={{ flex: 1 }} />
          </View>
        </View>
      </>
    );
    action = { label: "Salvar salário", ready: salary > 0 && validDay(payday), run: () => void saveSalary() };
  }

  if (step === "fixas") {
    body = (
      <>
        <Title title="E as contas que" strong="vêm todo mês?" line="Toque nas que você tem e diga o valor de cada uma." />
        <View style={{ paddingHorizontal: 20, marginTop: 20, gap: 10 }}>
          {BILLS.map((b) => {
            const v = bills[b.id];
            const on = !!v;
            return (
              <View key={b.id} style={{ borderRadius: 20, borderCurve: "continuous", borderWidth: on ? 1.5 : 1, borderColor: on ? "rgba(255,255,255,0.5)" : C.line, backgroundColor: on ? "rgba(255,255,255,0.08)" : C.fill, overflow: "hidden" }}>
                <Pressable
                  onPress={() => {
                    tap();
                    setBills((cur) => {
                      const nextBills = { ...cur };
                      if (nextBills[b.id]) delete nextBills[b.id];
                      else nextBills[b.id] = { amount: 0, day: b.day };
                      return nextBills;
                    });
                  }}
                  style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14 }}
                >
                  <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: on ? "#fff" : "rgba(255,255,255,0.08)" }}>
                    <b.Icon size={17} color={on ? "#0B0B0B" : "#fff"} strokeWidth={2.2} />
                  </View>
                  <Text style={{ flex: 1, fontSize: 15.5, fontWeight: "700", color: "#fff" }}>{b.label}</Text>
                  <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: on ? 0 : 1.5, borderColor: "rgba(255,255,255,0.3)", backgroundColor: on ? "#fff" : "transparent" }}>
                    {on && <Check size={14} color="#0B0B0B" strokeWidth={3.2} />}
                  </View>
                </Pressable>
                {on && (
                  <Animated.View entering={FadeInDown.duration(260)} exiting={FadeOut.duration(150)} style={{ flexDirection: "row", gap: 10, paddingHorizontal: 14, paddingBottom: 14 }}>
                    <View style={{ flex: 1.6 }}>
                      <MoneyInput value={v.amount} onChange={(amount) => setBills((cur) => ({ ...cur, [b.id]: { ...cur[b.id], amount } }))} />
                    </View>
                    <View style={{ flex: 1, marginTop: -26 }}>
                      <DayInput label="Vence" value={v.day} onChange={(day) => setBills((cur) => ({ ...cur, [b.id]: { ...cur[b.id], day } }))} />
                    </View>
                  </Animated.View>
                )}
              </View>
            );
          })}
        </View>
      </>
    );
    action = { label: chosenBills.length > 1 ? "Salvar contas" : "Salvar conta fixa", ready: billsReady, run: () => void saveBills() };
  }

  const isLast = at === steps.length - 1;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: C.bg }}>
      <Aura hex="#7C5CFF" top={-260} height={520} />
      <View style={{ paddingTop: insets.top + 8 }}>
        <Header section={section} progress={(at + 1) / (steps.length + 1)} onBack={back} />
      </View>
      <ScrollView key={step} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {body}
      </ScrollView>
      <View style={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 10, paddingTop: 8, gap: 8 }}>
        {error && <Text style={{ textAlign: "center", fontSize: 13, color: C.red }}>{error}</Text>}
        <Cta label={busy ? "Salvando…" : action.label} onPress={action.run} disabled={!action.ready || busy} />
        <Pressable onPress={next} disabled={busy} hitSlop={8} style={({ pressed }) => ({ alignSelf: "center", paddingVertical: 8, opacity: pressed ? 0.5 : 1 })}>
          <Text style={{ fontSize: 14, color: "rgba(255,255,255,0.7)" }}>{isLast ? "Fazer depois e entrar" : "Fazer depois"}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
