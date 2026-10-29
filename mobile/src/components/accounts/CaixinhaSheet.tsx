import { useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RESERVE_NAME, createGoal, createGoalDeposit } from "@/services/goalService";
import { prefetchDashboardData } from "@/services/dashboardData";
import { getAccounts } from "@/services/transactionService";
import { colorFor } from "@/lib/banks";
import { deadlineIn, monthYear, monthlyNeeded } from "~/lib/caixinha";
import { KIND_ORDER, coverKind, type CoverKind } from "~/lib/coverKind";
import {
  aboutLine,
  purposeLine,
  reserveChips,
  reviewLine,
  startLine,
  timeLine,
  yieldLine,
  type Month,
} from "~/lib/caixinhaCoach";
import { CoverError, pickGoalCover } from "~/lib/goalCover";
import { estimate, latestCdi } from "~/lib/yields";
import Room from "~/components/Room";
import BotMark from "~/components/BotMark";
import BankMark from "~/components/BankMark";
import Created from "~/components/accounts/Created";
import CaixinhaCover from "~/components/accounts/CaixinhaCover";
import CoverArt from "~/components/accounts/CoverArt";
import { Check, ChevronLeft, ImageIcon, Minus, Plus, X } from "~/components/icons";
import { money } from "~/lib/money";
import { useAuth } from "~/lib/auth";
import { GREEN, INK, RED } from "~/theme/tokens";

/**
 * Opening a caixinha with Willo beside you.
 *
 * A full page rather than a sheet, because it is a conversation: at the top Willo says
 * something about the step — worked out from the person's own month, see `caixinhaCoach` —
 * and below it is the one thing being decided. The first thing decided is what the caixinha
 * is for, shown as pictures, because a trip should look like a trip.
 *
 * A caixinha is a goal with the money in it, so the page asks what a goal asks — for what,
 * how much, by when — then whether to put some in today and from which account, and whether
 * it earns. All in one go: the goal and the money cannot be made out of step with each other.
 * Not every caixinha has an amount to reach; the reserve is only filled as life allows, so
 * one can be made "sem valor definido" and then it is not asked how long it will take.
 */

interface Choice {
  id: CoverKind;
  label: string;
  /** What is saved; recognised later by its words, so it wears the same picture. */
  name: string;
  /** Starts without an amount to reach. */
  open?: boolean;
}

const CHOICES: Record<CoverKind, Choice> = {
  reserva: { id: "reserva", label: "Reserva de emergência", name: RESERVE_NAME, open: true },
  viagem: { id: "viagem", label: "Viagem", name: "Viagem dos Sonhos" },
  reforma: { id: "reforma", label: "Reformar a casa", name: "Reformar a casa" },
  carreira: { id: "carreira", label: "Focar na carreira", name: "Focar na carreira" },
  consumo: { id: "consumo", label: "Sonho de consumo", name: "Sonho de consumo" },
  carro: { id: "carro", label: "Carro", name: "Carro Novo" },
  casa: { id: "casa", label: "Casa própria", name: "Casa Própria" },
  educacao: { id: "educacao", label: "Educação", name: "Educação" },
};

const SPANS = [
  { months: 6, label: "6 meses" },
  { months: 12, label: "1 ano" },
  { months: 24, label: "2 anos" },
];

const SHARES = [100, 105, 110, 115, 120];

interface Account {
  id: string;
  name: string;
  color: string | null;
  is_default: boolean;
  current_balance: number;
}

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const FIELD = {
  height: 54,
  minWidth: 0,
  borderRadius: 18,
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.12)",
  backgroundColor: "rgba(255,255,255,0.06)",
  paddingHorizontal: 18,
  fontSize: 17,
  color: "#fff",
} as const;

const isoToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const yearsLabel = (n: number) => `${n} ${n === 1 ? "ano" : "anos"}`;

/** "104", "104,5" → 104.5; null when it is not a share worth keeping. */
const parsePercent = (raw: string): number | null => {
  const n = Number(raw.replace(",", ".").trim());
  return Number.isFinite(n) && n >= 1 && n <= 500 ? Math.round(n * 100) / 100 : null;
};

type Key = "purpose" | "about" | "time" | "start" | "yield" | "review";

export default function CaixinhaSheet({
  open,
  onClose,
  onCreated,
  existingNames = [],
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  existingNames?: string[];
}) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [step, setStep] = useState(0);
  const [choiceId, setChoiceId] = useState<CoverKind | "custom" | null>(null);
  const [name, setName] = useState("");
  /* Whether there is an amount to reach at all. */
  const [hasValue, setHasValue] = useState(true);
  const [cents, setCents] = useState(0);
  /* null is no date at all; otherwise how many months it is meant to take. */
  const [months, setMonths] = useState<number | null>(12);
  const [more, setMore] = useState(false);
  const [years, setYears] = useState(3);
  const [monthlyCents, setMonthlyCents] = useState(0);
  const [earning, setEarning] = useState(false);
  const [percent, setPercent] = useState("100");
  const [startCents, setStartCents] = useState(0);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<{ name: string; line: string; photo: string | null } | null>(null);
  /* The person's month, read once when the page opens. */
  const [month, setMonth] = useState<Month>({ income: 0, expense: 0 });
  const [cdi, setCdi] = useState<number | null>(null);
  const advance = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    setStep(0);
    setChoiceId(null);
    setName("");
    setHasValue(true);
    setCents(0);
    setMonths(12);
    setMore(false);
    setYears(3);
    setMonthlyCents(0);
    setEarning(false);
    setPercent("100");
    setStartCents(0);
    setPhoto(null);
    setError(null);
    setSaving(false);
    setMade(null);
    void (async () => {
      try {
        const list = (await getAccounts()) as unknown as Account[];
        setAccounts(list);
        setAccountId(list.find((a) => a.is_default)?.id ?? list[0]?.id ?? null);
      } catch {
        setAccounts([]);
      }
    })();
    void (async () => {
      try {
        const now = new Date();
        const data = await prefetchDashboardData(now.getMonth(), now.getFullYear(), { includeHistorical: false, userId: user.id });
        setMonth({
          income: data.projection.avgIncome3m || data.receitas || 0,
          expense: data.projection.avgExpense3m || data.despesas || 0,
        });
      } catch {
        setMonth({ income: 0, expense: 0 });
      }
    })();
    void latestCdi().then((r) => setCdi(r?.rate ?? null));
    return () => {
      if (advance.current) clearTimeout(advance.current);
    };
  }, [open, user]);

  /* Without an amount there is nothing to be late for, so the question of time drops out. */
  const keys: Key[] = hasValue ? ["purpose", "about", "time", "start", "yield", "review"] : ["purpose", "about", "start", "yield", "review"];
  const key = keys[Math.min(step, keys.length - 1)];
  const last = step >= keys.length - 1;

  const kind: CoverKind | null = choiceId && choiceId !== "custom" ? choiceId : coverKind(name);
  const withDate = hasValue && months !== null;
  const start = startCents / 100;
  const target = hasValue ? cents / 100 : 0;
  /* What each month asks, with whatever goes in today already counted. */
  const perMonth = useMemo(
    () => (withDate && months ? monthlyNeeded(Math.max(target - start, 0), months) : 0),
    [withDate, months, target, start],
  );
  const due = withDate && months ? monthYear(deadlineIn(months)) : null;
  const share = parsePercent(percent);
  const account = accounts.find((a) => a.id === accountId) ?? null;
  const first = ((user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? "") as string).trim().split(/\s+/)[0] || null;

  /* What the rate would credit: today's deposit if there is one, otherwise the amount aimed at. */
  const base = start > 0 ? start : target;
  const forecast = earning && share !== null && cdi !== null && base > 0 ? estimate(base, cdi, share) : null;

  const pick = (c: CoverKind | "custom") => {
    void Haptics.selectionAsync().catch(() => undefined);
    if (c === "custom") {
      setChoiceId("custom");
      setName("");
      setHasValue(true);
    } else {
      setChoiceId(c);
      setName(CHOICES[c].name);
      setHasValue(!CHOICES[c].open);
    }
    setMonths((m) => m ?? 12);
    setError(null);
    /* The picture is the answer; the page moves on a beat after it, so the choice is seen. */
    if (advance.current) clearTimeout(advance.current);
    advance.current = setTimeout(() => setStep((s) => (s === 0 ? 1 : s)), 260);
  };

  const choosePhoto = async () => {
    if (!user || photoBusy) return;
    setPhotoBusy(true);
    setError(null);
    try {
      const url = await pickGoalCover(user.id);
      if (url) setPhoto(url);
    } catch (e) {
      setError(e instanceof CoverError || e instanceof Error ? e.message : "Não foi possível enviar a foto.");
    } finally {
      setPhotoBusy(false);
    }
  };

  const next = async () => {
    setError(null);
    if (key === "about") {
      const trimmed = name.trim();
      if (trimmed.length < 2) {
        setError("Dê um nome à caixinha.");
        return;
      }
      if (existingNames.some((n) => n.toLocaleLowerCase("pt-BR") === trimmed.toLocaleLowerCase("pt-BR"))) {
        setError("Você já tem uma caixinha com esse nome. Dê outro nome a esta.");
        return;
      }
      if (hasValue && cents <= 0) {
        setError("Diga quanto quer juntar, ou marque sem valor definido.");
        return;
      }
    }
    if (key === "start" && start > 0 && !accountId) {
      setError("Escolha de qual conta sai o dinheiro.");
      return;
    }
    if (key === "yield" && earning && share === null) {
      setError("Diga quanto do CDI ela rende, por exemplo 100.");
      return;
    }
    if (!last) {
      setStep(step + 1);
      return;
    }
    if (!user) return;
    setSaving(true);
    try {
      const trimmed = name.trim();
      const dated = hasValue && months !== null;
      const goal = await createGoal(
        {
          name: trimmed,
          target_amount: target,
          monthly_contribution: dated ? perMonth || null : hasValue && monthlyCents > 0 ? monthlyCents / 100 : null,
          deadline: dated && months ? deadlineIn(months) : null,
          cover_image: photo,
          ...(earning && share !== null ? { yield_type: "cdi" as const, yield_percent: share } : {}),
        },
        user.id,
      );
      if (start > 0 && accountId) {
        await createGoalDeposit(
          { goal_id: goal.id, amount: start, date: isoToday(), source: "Primeiro depósito", account_id: accountId },
          user.id,
        );
      }
      setMade({
        name: trimmed,
        photo,
        line:
          dated && perMonth > 0
            ? `Guarde ${money(perMonth)} por mês para chegar em ${due}.${start > 0 && account ? ` ${money(start)} já saíram de ${account.name}.` : ""}`
            : start > 0 && account
              ? `${money(start)} saíram de ${account.name} e já estão guardados.`
              : "Ela já está nas suas caixinhas.",
      });
      onCreated();
    } catch {
      setError("Não foi possível criar a caixinha.");
    } finally {
      setSaving(false);
    }
  };

  const canNext =
    key === "purpose" ? choiceId !== null : key === "about" ? name.trim().length >= 2 && (!hasValue || cents > 0) : true;

  const say = (() => {
    switch (key) {
      case "purpose":
        return purposeLine(first);
      case "about":
        return aboutLine(kind, choiceId === "custom", month);
      case "time":
        return timeLine({ month, perMonth, months, target });
      case "start":
        return startLine({ start, accountName: account?.name ?? null, balance: account ? Number(account.current_balance) || 0 : null });
      case "yield":
        return yieldLine({ earning, percent: share, base, monthly: forecast?.month ?? null });
      default:
        return reviewLine({ name: name.trim(), perMonth, due, start, earning });
    }
  })();

  const gutter = 20;
  const cardW = (width - gutter * 2 - 12) / 2;

  return (
    <Modal visible={open} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <Room>
        {made ? (
          <Created
            accent={kind ? "#C8F36D" : "#C4B5FD"}
            mark={
              <View style={{ width: 112, height: 112, borderRadius: 34, borderCurve: "continuous", overflow: "hidden", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.3)" }}>
                <CaixinhaCover goal={{ name: made.name, cover_image: made.photo }} width={112} height={112} />
              </View>
            }
            title="Caixinha criada"
            subtitle={`${made.name}. ${made.line}`}
            onClose={onClose}
          />
        ) : (
          <View style={{ flex: 1, paddingTop: insets.top + 8 }}>
            {/* Back, how far along, and out. */}
            <View style={{ height: 44, flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: gutter }}>
              <View style={{ width: 40, height: 40 }}>
                {step > 0 && (
                  <Animated.View entering={FadeIn.duration(180)}>
                    <GlassDot label="Voltar" onPress={() => setStep(Math.max(step - 1, 0))}>
                      <ChevronLeft size={19} color="#fff" strokeWidth={2.3} />
                    </GlassDot>
                  </Animated.View>
                )}
              </View>
              <View style={{ flex: 1, flexDirection: "row", gap: 5 }}>
                {keys.map((k, i) => (
                  <View key={k} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i <= step ? "#fff" : "rgba(255,255,255,0.16)" }} />
                ))}
              </View>
              <GlassDot label="Fechar" onPress={onClose}>
                <X size={17} color="rgba(255,255,255,0.86)" strokeWidth={2.3} />
              </GlassDot>
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: 18, paddingBottom: 24 }}
              >
                <Say text={say} />

                {/* ══ What is it for ══ */}
                {key === "purpose" && (
                  <Animated.View entering={FadeInDown.duration(380)} style={{ marginTop: 22, flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                    {KIND_ORDER.map((k) => (
                      <PictureCard key={k} width={cardW} on={choiceId === k} label={CHOICES[k].label} onPress={() => pick(k)}>
                        <CoverArt kind={k} />
                      </PictureCard>
                    ))}
                    <PictureCard width={cardW} on={choiceId === "custom"} label="Personalizada" onPress={() => pick("custom")}>
                      <LinearGradient colors={["#1B1E27", "#2B2F3D"]} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
                      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 28, alignItems: "center", justifyContent: "center" }}>
                        <View style={{ width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.12)" }}>
                          <Plus size={22} color="#fff" strokeWidth={2.4} />
                        </View>
                      </View>
                    </PictureCard>
                  </Animated.View>
                )}

                {/* ══ Name and amount ══ */}
                {key === "about" && (
                  <Animated.View entering={FadeInDown.duration(380)} style={{ marginTop: 20 }}>
                    <View style={{ height: 118, borderRadius: 26, borderCurve: "continuous", overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" }}>
                      <CaixinhaCover goal={{ name: name || "Nova caixinha", cover_image: null }} height={118} glyph={110} glyphTop={-6} />
                      <LinearGradient colors={["rgba(8,9,10,0)", "rgba(8,9,10,0.7)"]} style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 70 }} />
                      <Text numberOfLines={1} style={{ position: "absolute", left: 16, right: 16, bottom: 12, fontSize: 16, fontWeight: "700", color: "#fff" }}>
                        {name.trim() || "Nova caixinha"}
                      </Text>
                    </View>

                    <TextInput
                      value={name}
                      onChangeText={(t) => {
                        setName(t);
                        setError(null);
                      }}
                      placeholder="Nome da caixinha"
                      placeholderTextColor={INK.faint}
                      maxLength={60}
                      autoFocus={choiceId === "custom"}
                      style={{ ...FIELD, marginTop: 14 }}
                    />

                    <View style={{ marginTop: 14, flexDirection: "row", gap: 8 }}>
                      <Chip label="Valor definido" on={hasValue} onPress={() => { setHasValue(true); setError(null); }} />
                      <Chip label="Sem valor definido" on={!hasValue} onPress={() => { setHasValue(false); setError(null); }} />
                    </View>

                    {hasValue ? (
                      <>
                        <Text style={{ marginTop: 22, fontSize: 12.5, color: INK.soft }}>Quanto quer juntar</Text>
                        <AmountField cents={cents} onChange={(c) => { setCents(c); setError(null); }} />
                      </>
                    ) : (
                      <Text style={{ marginTop: 18, fontSize: 14, lineHeight: 19, color: INK.soft }}>
                        Sem meta nem prazo: você vai guardando conforme der e ela fica sempre à mão.
                      </Text>
                    )}

                    {kind === "reserva" && reserveChips(month).length > 0 && (
                      <View style={{ marginTop: 16 }}>
                        <Text style={{ fontSize: 12.5, color: INK.soft }}>Sugestão do Willo, pelas suas despesas</Text>
                        <View style={{ marginTop: 8, flexDirection: "row", gap: 8 }}>
                          {reserveChips(month).map((c) => (
                            <Chip
                              key={c.label}
                              label={`${c.label} · ${brl(c.cents).replace(/\s/g, " ")}`}
                              on={hasValue && cents === c.cents}
                              small
                              onPress={() => {
                                setHasValue(true);
                                setCents(c.cents);
                                setError(null);
                              }}
                            />
                          ))}
                        </View>
                      </View>
                    )}
                  </Animated.View>
                )}

                {/* ══ By when ══ */}
                {key === "time" && (
                  <Animated.View entering={FadeInDown.duration(380)} style={{ marginTop: 22 }}>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {SPANS.map((s) => (
                        <Chip
                          key={s.months}
                          label={s.label}
                          on={!more && months === s.months}
                          onPress={() => {
                            setMore(false);
                            setMonths(s.months);
                          }}
                        />
                      ))}
                      <Chip
                        label="Mais"
                        on={more && months !== null}
                        onPress={() => {
                          setMore(true);
                          setMonths(years * 12);
                        }}
                      />
                    </View>

                    {more && months !== null && (
                      <View style={{ marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 22 }}>
                        <Stepper
                          icon={Minus}
                          label="Menos um ano"
                          disabled={years <= 1}
                          onPress={() => {
                            setYears(years - 1);
                            setMonths((years - 1) * 12);
                          }}
                        />
                        <Text style={{ minWidth: 110, textAlign: "center", fontSize: 28, fontWeight: "800", letterSpacing: -0.8, color: "#fff" }}>
                          {yearsLabel(years)}
                        </Text>
                        <Stepper
                          icon={Plus}
                          label="Mais um ano"
                          disabled={years >= 30}
                          onPress={() => {
                            setYears(years + 1);
                            setMonths((years + 1) * 12);
                          }}
                        />
                      </View>
                    )}

                    {withDate && cents > 0 ? (
                      <GlassCard style={{ marginTop: 22 }}>
                        <Text style={{ fontSize: 13, color: INK.soft }}>Para chegar em {due}, guarde</Text>
                        <Text style={{ marginTop: 4, fontSize: 32, fontWeight: "800", letterSpacing: -1.1, color: "#fff" }}>
                          {money(perMonth)}
                          <Text style={{ fontSize: 15, fontWeight: "500", letterSpacing: 0, color: INK.soft }}> por mês</Text>
                        </Text>
                      </GlassCard>
                    ) : null}

                    {months === null ? <MonthlyField cents={monthlyCents} onChange={setMonthlyCents} /> : null}

                    <Pressable
                      onPress={() => {
                        setMore(false);
                        setMonths(months === null ? 12 : null);
                      }}
                      hitSlop={10}
                      style={{ marginTop: 18, alignSelf: "flex-start" }}
                    >
                      <Text style={{ fontSize: 13.5, fontWeight: "600", color: INK.soft }}>
                        {months === null ? "Definir um prazo" : "Não tem prazo"}
                      </Text>
                    </Pressable>
                  </Animated.View>
                )}

                {/* ══ Start with how much ══ */}
                {key === "start" && (
                  <Animated.View entering={FadeInDown.duration(380)} style={{ marginTop: 22 }}>
                    <Text style={{ fontSize: 12.5, color: INK.soft }}>Começar com</Text>
                    <TextInput
                      value={startCents === 0 ? "" : brl(startCents)}
                      onChangeText={(t) => {
                        const digits = t.replace(/\D/g, "").slice(0, 10);
                        setStartCents(Math.min(Number(digits || "0"), 99999999));
                        setError(null);
                      }}
                      keyboardType="number-pad"
                      placeholder="R$ 0,00"
                      placeholderTextColor={INK.faint}
                      style={{ marginTop: 6, minWidth: 0, fontSize: 44, fontWeight: "800", letterSpacing: -1.7, color: "#fff", padding: 0 }}
                    />

                    {start > 0 && (
                      <>
                        <Text style={{ marginTop: 24, fontSize: 12.5, color: INK.soft }}>Sai de qual conta</Text>
                        {accounts.length === 0 ? (
                          <Text style={{ marginTop: 10, fontSize: 13, color: INK.softer }}>Crie uma conta primeiro para guardar a partir dela.</Text>
                        ) : (
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            style={{ marginHorizontal: -gutter }}
                            contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: 10, gap: 10 }}
                          >
                            {accounts.map((acc) => {
                              const on = acc.id === accountId;
                              return (
                                <Pressable
                                  key={acc.id}
                                  onPress={() => setAccountId(acc.id)}
                                  style={({ pressed }) => ({
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 10,
                                    paddingLeft: 8,
                                    paddingRight: 16,
                                    paddingVertical: 8,
                                    borderRadius: 22,
                                    borderCurve: "continuous",
                                    borderWidth: 1,
                                    borderColor: on ? "#fff" : "rgba(255,255,255,0.10)",
                                    backgroundColor: on ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)",
                                    transform: [{ scale: pressed ? 0.97 : 1 }],
                                  })}
                                >
                                  <BankMark name={acc.name} hex={colorFor(acc.name, acc.color, "#6B7280")} size={38} />
                                  <View>
                                    <Text numberOfLines={1} style={{ maxWidth: 120, fontSize: 14, fontWeight: "600", color: "#fff" }}>{acc.name}</Text>
                                    <Text style={{ marginTop: 1, fontSize: 12, color: INK.softer }}>{money(Number(acc.current_balance) || 0)}</Text>
                                  </View>
                                  {on && <Check size={15} color="#fff" strokeWidth={3} />}
                                </Pressable>
                              );
                            })}
                          </ScrollView>
                        )}
                      </>
                    )}
                  </Animated.View>
                )}

                {/* ══ Does it earn ══ */}
                {key === "yield" && (
                  <Animated.View entering={FadeInDown.duration(380)} style={{ marginTop: 22 }}>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <Chip label="Não rende" on={!earning} onPress={() => { setEarning(false); setError(null); }} />
                      <Chip label="Rende" on={earning} onPress={() => { setEarning(true); setError(null); }} />
                    </View>

                    {earning && (
                      <>
                        <Text style={{ marginTop: 22, fontSize: 12.5, color: INK.soft }}>Tipo de rendimento</Text>
                        <View style={{ marginTop: 8, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                          <Pill label="CDI" on />
                          {["Tesouro Direto", "CDB", "LCI / LCA", "Fundos"].map((t) => (
                            <Pill key={t} label={t} soon />
                          ))}
                        </View>

                        <Text style={{ marginTop: 22, fontSize: 12.5, color: INK.soft }}>Quanto do CDI ela rende</Text>
                        <View style={{ marginTop: 8, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                          {SHARES.map((s) => (
                            <Pressable
                              key={s}
                              onPress={() => {
                                setPercent(String(s));
                                setError(null);
                              }}
                              style={({ pressed }) => ({
                                height: 42,
                                minWidth: 64,
                                paddingHorizontal: 14,
                                borderRadius: 21,
                                alignItems: "center",
                                justifyContent: "center",
                                borderWidth: 1,
                                borderColor: share === s ? "#fff" : "rgba(255,255,255,0.10)",
                                backgroundColor: share === s ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.05)",
                                transform: [{ scale: pressed ? 0.96 : 1 }],
                              })}
                            >
                              <Text style={{ fontSize: 14.5, fontWeight: "700", color: "#fff" }}>{s}%</Text>
                            </Pressable>
                          ))}
                          <TextInput
                            value={SHARES.includes(Number(percent)) ? "" : percent}
                            onChangeText={(t) => {
                              setPercent(t.replace(/[^0-9,.]/g, "").slice(0, 6));
                              setError(null);
                            }}
                            keyboardType="decimal-pad"
                            placeholder="Outro"
                            placeholderTextColor={INK.faint}
                            style={{ ...FIELD, height: 42, width: 92, borderRadius: 21, paddingHorizontal: 12, fontSize: 14.5, textAlign: "center", fontWeight: "700" }}
                          />
                        </View>

                        {forecast ? (
                          <GlassCard style={{ marginTop: 20 }}>
                            <Text style={{ fontSize: 13, color: INK.soft }}>
                              {start > 0 ? `Com ${money(start)} guardados` : `Quando chegar em ${money(target)}`}, rende cerca de
                            </Text>
                            <View style={{ marginTop: 10, flexDirection: "row" }}>
                              <Figure label="Por mês" value={`+${money(forecast.month)}`} />
                              <Figure label="Por ano" value={`+${money(forecast.year)}`} />
                            </View>
                          </GlassCard>
                        ) : null}
                        <Text style={{ marginTop: 14, fontSize: 12.5, lineHeight: 17, color: INK.softer }}>
                          O rendimento é uma estimativa, bruto de imposto, e entra no saldo a cada dia útil.
                        </Text>
                      </>
                    )}
                  </Animated.View>
                )}

                {/* ══ How it will look, and a picture of your own ══ */}
                {key === "review" && (
                  <Animated.View entering={FadeInDown.duration(380)} style={{ marginTop: 20 }}>
                    <View style={{ height: 210, borderRadius: 30, borderCurve: "continuous", overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" }}>
                      <CaixinhaCover goal={{ name: name.trim(), cover_image: photo }} height={210} glyph={150} glyphTop={10} />
                      <LinearGradient colors={["rgba(8,9,10,0)", "rgba(8,9,10,0.82)"]} style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 120 }} />
                      <View style={{ position: "absolute", left: 18, right: 18, bottom: 16 }}>
                        <Text numberOfLines={2} style={{ fontSize: 22, fontWeight: "800", letterSpacing: -0.7, color: "#fff" }}>{name.trim()}</Text>
                        <Text style={{ marginTop: 3, fontSize: 14, color: "rgba(255,255,255,0.74)" }}>
                          {hasValue ? `Meta de ${money(target)}` : "Sem valor definido"}
                        </Text>
                      </View>
                    </View>

                    <Pressable
                      onPress={() => void choosePhoto()}
                      disabled={photoBusy}
                      style={({ pressed }) => ({
                        marginTop: 12,
                        height: 50,
                        borderRadius: 25,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.14)",
                        backgroundColor: "rgba(255,255,255,0.07)",
                        opacity: photoBusy ? 0.6 : 1,
                        transform: [{ scale: pressed ? 0.98 : 1 }],
                      })}
                    >
                      <ImageIcon size={18} color="#fff" />
                      <Text style={{ fontSize: 15, fontWeight: "600", color: "#fff" }}>
                        {photoBusy ? "Enviando…" : photo ? "Trocar foto" : "Adicionar foto"}
                      </Text>
                    </Pressable>

                    <View style={{ marginTop: 14, flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                      <Fact label="Prazo" value={due ?? "Sem prazo"} />
                      <Fact label="Por mês" value={perMonth > 0 ? money(perMonth) : monthlyCents > 0 ? money(monthlyCents / 100) : "Conforme der"} />
                      <Fact label="Começa com" value={start > 0 ? money(start) : "R$ 0"} />
                      <Fact label="Rendimento" value={earning && share !== null ? `${share}% do CDI` : "Não rende"} tone={earning ? GREEN : undefined} />
                    </View>
                  </Animated.View>
                )}

                {error && <Text style={{ marginTop: 16, fontSize: 13.5, lineHeight: 18, color: RED }}>{error}</Text>}
              </ScrollView>

              <View style={{ paddingHorizontal: gutter, paddingTop: 8, paddingBottom: insets.bottom + 12 }}>
                <Pressable
                  onPress={() => {
                    if (!canNext || saving) return;
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
                    Keyboard.dismiss();
                    void next();
                  }}
                  accessibilityRole="button"
                  style={({ pressed }) => ({
                    height: 56,
                    borderRadius: 28,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#fff",
                    opacity: !canNext ? 0.32 : saving ? 0.7 : 1,
                    transform: [{ scale: pressed && canNext ? 0.98 : 1 }],
                  })}
                >
                  <Text style={{ fontSize: 16.5, fontWeight: "700", letterSpacing: -0.2, color: "#0B0B0B" }}>
                    {saving ? "Só um instante…" : last ? "Criar caixinha" : "Continuar"}
                  </Text>
                </Pressable>
              </View>
            </KeyboardAvoidingView>
          </View>
        )}
      </Room>
    </Modal>
  );
}

/** Willo's line: his mark, and what he says typed out in a bubble of glass. */
function Say({ text }: { text: string }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    setShown(0);
    /* Always done in about a second, however long the line is. */
    const step = Math.max(1, Math.ceil(text.length / 55));
    const id = setInterval(() => {
      setShown((n) => {
        if (n + step >= text.length) {
          clearInterval(id);
          return text.length;
        }
        return n + step;
      });
    }, 18);
    return () => clearInterval(id);
  }, [text]);

  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
      <BotMark size={38} />
      <View
        style={{
          flex: 1,
          minWidth: 0,
          borderRadius: 22,
          borderTopLeftRadius: 6,
          borderCurve: "continuous",
          overflow: "hidden",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.14)",
        }}
      >
        <BlurView intensity={50} tint="dark" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(18,20,26,0.4)" }} />
        <View style={{ position: "absolute", top: 0, left: 16, right: 16, height: 1, backgroundColor: "rgba(255,255,255,0.2)" }} />
        <View style={{ paddingHorizontal: 16, paddingVertical: 13 }}>
          {/* The full line sits invisible underneath so the bubble is its final size from the first letter. */}
          <Text style={{ fontSize: 15.5, lineHeight: 22, color: "transparent" }}>{text}</Text>
          <Text style={{ position: "absolute", left: 16, right: 16, top: 13, fontSize: 15.5, lineHeight: 22, color: "#fff" }}>
            {text.slice(0, shown)}
          </Text>
        </View>
      </View>
    </View>
  );
}

/** A picture to choose, with what it is called across its foot. */
function PictureCard({
  width,
  on,
  label,
  onPress,
  children,
}: {
  width: number;
  on: boolean;
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }] })}>
      <View
        style={{
          width,
          height: 128,
          borderRadius: 24,
          borderCurve: "continuous",
          overflow: "hidden",
          borderWidth: on ? 2 : 1,
          borderColor: on ? "#fff" : "rgba(255,255,255,0.12)",
          opacity: on ? 1 : 0.94,
        }}
      >
        {children}
        <LinearGradient colors={["rgba(8,9,10,0)", "rgba(8,9,10,0.82)"]} style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 66 }} />
        <Text numberOfLines={2} style={{ position: "absolute", left: 13, right: 13, bottom: 11, fontSize: 14.5, lineHeight: 17, fontWeight: "700", color: "#fff" }}>
          {label}
        </Text>
        {on && (
          <View style={{ position: "absolute", top: 10, right: 10, width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }}>
            <Check size={14} color="#0B0B0B" strokeWidth={3.2} />
          </View>
        )}
      </View>
    </Pressable>
  );
}

/** A round glass button for the page's top bar. */
function GlassDot({ label, onPress, children }: { label: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.14)",
          backgroundColor: "rgba(255,255,255,0.07)",
        }}
      >
        {children}
      </View>
    </Pressable>
  );
}

function GlassCard({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <View
      style={[
        {
          borderRadius: 22,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.12)",
          backgroundColor: "rgba(255,255,255,0.06)",
          paddingHorizontal: 18,
          paddingVertical: 16,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 12, color: INK.softer }}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ marginTop: 3, fontSize: 21, fontWeight: "800", letterSpacing: -0.6, color: GREEN }}>
        {value}
      </Text>
    </View>
  );
}

function Fact({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <GlassCard style={{ width: "48%", paddingVertical: 12, paddingHorizontal: 14, flexGrow: 1 }}>
      <Text style={{ fontSize: 12, color: INK.softer }}>{label}</Text>
      <Text numberOfLines={1} style={{ marginTop: 3, fontSize: 16, fontWeight: "700", letterSpacing: -0.3, color: tone ?? "#fff" }}>{value}</Text>
    </GlassCard>
  );
}

/** A kind of yield: the chosen one lit, the ones not built yet dimmed and marked. */
function Pill({ label, on = false, soon = false }: { label: string; on?: boolean; soon?: boolean }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        height: 38,
        paddingHorizontal: 16,
        borderRadius: 19,
        borderWidth: 1,
        borderColor: on ? "#fff" : "rgba(255,255,255,0.10)",
        backgroundColor: on ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.04)",
        opacity: soon ? 0.5 : 1,
      }}
    >
      <Text style={{ fontSize: 13.5, fontWeight: "700", color: "#fff" }}>{label}</Text>
      {soon && <Text style={{ fontSize: 10.5, color: INK.softer }}>em breve</Text>}
    </View>
  );
}

function Chip({ label, on, onPress, small = false }: { label: string; on: boolean; onPress: () => void; small?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        height: small ? 44 : 50,
        borderRadius: small ? 22 : 25,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 8,
        borderWidth: 1,
        borderColor: on ? "#fff" : "rgba(255,255,255,0.10)",
        backgroundColor: on ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.05)",
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ fontSize: small ? 13 : 14.5, fontWeight: "700", color: "#fff" }}>
        {label}
      </Text>
    </Pressable>
  );
}

function Stepper({ icon: Icon, label, disabled, onPress }: { icon: typeof Plus; label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.14)",
        backgroundColor: "rgba(255,255,255,0.08)",
        opacity: disabled ? 0.3 : 1,
        transform: [{ scale: pressed ? 0.92 : 1 }],
      })}
    >
      <Icon size={20} color="#fff" strokeWidth={2.4} />
    </Pressable>
  );
}

function MonthlyField({ cents, onChange }: { cents: number; onChange: (c: number) => void }) {
  return (
    <TextInput
      value={cents === 0 ? "" : brl(cents)}
      onChangeText={(t) => {
        const digits = t.replace(/\D/g, "").slice(0, 10);
        onChange(Math.min(Number(digits || "0"), 99999999));
      }}
      keyboardType="number-pad"
      placeholder="Quanto por mês (opcional)"
      placeholderTextColor={INK.faint}
      style={{ ...FIELD, marginTop: 18 }}
    />
  );
}

/** The figure a page is about, typed in place at the size it is read. */
function AmountField({ cents, onChange }: { cents: number; onChange: (c: number) => void }) {
  return (
    <TextInput
      value={brl(cents)}
      onChangeText={(t) => {
        const digits = t.replace(/\D/g, "").slice(0, 11);
        onChange(Math.min(Number(digits || "0"), 999999999));
      }}
      keyboardType="number-pad"
      style={{
        marginTop: 6,
        minWidth: 0,
        fontSize: 42,
        fontWeight: "800",
        letterSpacing: -1.6,
        color: cents === 0 ? INK.faint : "#fff",
        padding: 0,
      }}
    />
  );
}
