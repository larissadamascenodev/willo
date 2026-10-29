import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  type ViewStyle,
} from "react-native";
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
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
import { aboutLine, purposeLine, reserveChips, reviewLine, startLine, timeLine, type Month } from "~/lib/caixinhaCoach";
import { CoverError, pickGoalCover } from "~/lib/goalCover";
import Room from "~/components/Room";
import ParticleOrb from "~/components/registro/ParticleOrb";
import BankMark from "~/components/BankMark";
import Created from "~/components/accounts/Created";
import CaixinhaCover from "~/components/accounts/CaixinhaCover";
import CoverArt from "~/components/accounts/CoverArt";
import { Check, ChevronLeft, ImageIcon, Minus, Plus, X } from "~/components/icons";
import { money } from "~/lib/money";
import { useAuth } from "~/lib/auth";
import { INK, RED } from "~/theme/tokens";

/**
 * Opening a caixinha with Willo beside you.
 *
 * A full page rather than a sheet, because it is a conversation: at the top is Willo's
 * sphere, small, with the question he is asking typed out large, and under it a line that
 * is about this person — worked out from their own month, see `caixinhaCoach`. Below that
 * is the one thing being decided, set in glass. The first thing decided is what the
 * caixinha is for, shown as pictures, because a trip should look like a trip.
 *
 * It asks what a goal asks — for what, how much, by when — and whether to put some in
 * today and from which account. All in one go: the goal and the money cannot be made out
 * of step with each other. Not every caixinha has an amount to reach; the reserve is only
 * filled as life allows, so the amount is a switch, and with it off the question of time
 * drops out.
 */

interface Choice {
  label: string;
  /** One line of what it covers, under the picture. */
  hint: string;
  /** What is saved; recognised later by its words, so it wears the same picture. */
  name: string;
  /** Starts without an amount to reach. */
  open?: boolean;
}

const CHOICES: Record<CoverKind, Choice> = {
  reserva: { label: "Reserva de emergência", hint: "Para imprevistos, sempre à mão", name: RESERVE_NAME, open: true },
  viagem: { label: "Viagem", hint: "Passagem e hospedagem", name: "Viagem dos Sonhos" },
  reforma: { label: "Reformar a casa", hint: "Obra, móveis, decoração", name: "Reformar a casa" },
  carreira: { label: "Carreira", hint: "Cursos e mentorias", name: "Focar na carreira" },
  consumo: { label: "Sonho de consumo", hint: "Aquele desejo, sem culpa", name: "Sonho de consumo" },
  carro: { label: "Carro", hint: "A entrada ou à vista", name: "Carro Novo" },
  casa: { label: "Casa própria", hint: "A entrada do imóvel", name: "Casa Própria" },
  educacao: { label: "Educação", hint: "Faculdade, curso, idioma", name: "Educação" },
};

/** The card the summary is drawn on: the picture fades into it. */
const CARD = "#17191F";

const SPANS = [
  { months: 6, label: "6 meses" },
  { months: 12, label: "1 ano" },
  { months: 24, label: "2 anos" },
];

const ASK: Record<Key, string> = {
  purpose: "Bora guardar pra quê?",
  about: "Como vai ser essa caixinha?",
  time: "E pra quando você quer?",
  start: "Quer começar com quanto?",
  review: "Ficou assim. Bora criar?",
};

interface Account {
  id: string;
  name: string;
  color: string | null;
  is_default: boolean;
  current_balance: number;
}

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const isoToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const yearsLabel = (n: number) => `${n} ${n === 1 ? "ano" : "anos"}`;
const same = (a: string, b: string) => a.trim().toLocaleLowerCase("pt-BR") === b.trim().toLocaleLowerCase("pt-BR");

type Key = "purpose" | "about" | "time" | "start" | "review";

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
    return () => {
      if (advance.current) clearTimeout(advance.current);
    };
  }, [open, user]);

  /* Without an amount there is nothing to be late for, so the question of time drops out. */
  const keys: Key[] = hasValue ? ["purpose", "about", "time", "start", "review"] : ["purpose", "about", "start", "review"];
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
  const account = accounts.find((a) => a.id === accountId) ?? null;
  const first = ((user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? "") as string).trim().split(/\s+/)[0] || null;

  /* The reserve is made for everyone already; offering it again only leads to "you already have one". */
  const hasReserve = existingNames.some((n) => same(n, RESERVE_NAME));
  const featured: CoverKind | null = hasReserve ? null : "reserva";
  const grid = KIND_ORDER.filter((k) => k !== "reserva");

  const pick = (c: CoverKind | "custom") => {
    void Haptics.selectionAsync().catch(() => undefined);
    if (c === "custom") {
      setChoiceId("custom");
      setName("");
      setHasValue(true);
    } else {
      setChoiceId(c);
      /* A second trip should not start on "you already have one": it is offered a name that is free. */
      const taken = (n: string) => existingNames.some((e) => same(e, n));
      const base = CHOICES[c].name;
      const free = [base, CHOICES[c].label, ...[2, 3, 4, 5].map((i) => `${base} ${i}`)].find((n) => !taken(n)) ?? "";
      setName(free);
      setHasValue(!CHOICES[c].open);
    }
    setMonths((m) => m ?? 12);
    setError(null);
    /* The picture is the answer; the page moves on a beat after it, so the choice is seen. */
    if (advance.current) clearTimeout(advance.current);
    advance.current = setTimeout(() => setStep((s) => (s === 0 ? 1 : s)), 280);
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
      if (existingNames.some((n) => same(n, trimmed))) {
        setError("Você já tem uma caixinha com esse nome. Dê outro nome a esta.");
        return;
      }
      if (hasValue && cents <= 0) {
        setError("Diga quanto quer juntar, ou desligue o valor definido.");
        return;
      }
    }
    if (key === "start" && start > 0 && !accountId) {
      setError("Escolha de qual conta sai o dinheiro.");
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

  const tip = (() => {
    switch (key) {
      case "purpose":
        return purposeLine(first);
      case "about":
        return aboutLine(kind, choiceId === "custom", month);
      case "time":
        return timeLine({ month, perMonth, months, target });
      case "start":
        return startLine({ start, accountName: account?.name ?? null, balance: account ? Number(account.current_balance) || 0 : null });
      default:
        return reviewLine({ perMonth, due, start, hasValue });
    }
  })();

  const gutter = 20;
  const cardW = (width - gutter * 2 - 12) / 2;
  const span = more ? "more" : months === null ? null : months;

  return (
    <Modal visible={open} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <Room>
        {made ? (
          <Created
            accent="#C8F36D"
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
            <View style={{ height: 44, flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: gutter }}>
              <View style={{ width: 40, height: 40 }}>
                {step > 0 && (
                  <Animated.View entering={FadeIn.duration(180)}>
                    <GlassDot label="Voltar" onPress={() => setStep(Math.max(step - 1, 0))}>
                      <ChevronLeft size={19} color="#fff" strokeWidth={2.3} />
                    </GlassDot>
                  </Animated.View>
                )}
              </View>
              <View style={{ flex: 1, flexDirection: "row", gap: 4 }}>
                {keys.map((k, i) => (
                  <View key={k} style={{ flex: 1, height: 2.5, borderRadius: 2, backgroundColor: i <= step ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.14)" }} />
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
                contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: 20, paddingBottom: key === "purpose" && choiceId === null ? insets.bottom + 28 : 28 }}
              >
                <Willo key={key} ask={ASK[key]} tip={tip} />

                {/* ══ What is it for ══ */}
                {key === "purpose" && (
                  <Animated.View entering={FadeInDown.delay(180).duration(420)} style={{ marginTop: 26, gap: 12 }}>
                    {featured && (
                      <PictureCard width={width - gutter * 2} height={150} on={choiceId === featured} label={CHOICES[featured].label} hint={CHOICES[featured].hint} badge="Recomendado" onPress={() => pick(featured)}>
                        <CoverArt kind={featured} />
                      </PictureCard>
                    )}
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                      {grid.map((k) => (
                        <PictureCard key={k} width={cardW} height={164} on={choiceId === k} dim={choiceId !== null && choiceId !== k} label={CHOICES[k].label} hint={CHOICES[k].hint} onPress={() => pick(k)}>
                          <CoverArt kind={k} />
                        </PictureCard>
                      ))}
                      <PictureCard
                        width={cardW}
                        height={164}
                        on={choiceId === "custom"}
                        dim={choiceId !== null && choiceId !== "custom"}
                        label="Personalizada"
                        hint="Do seu jeito"
                        onPress={() => pick("custom")}
                      >
                        <LinearGradient colors={["#242838", "#14161E"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
                        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 44, alignItems: "center", justifyContent: "center" }}>
                          <View style={{ width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.22)", backgroundColor: "rgba(255,255,255,0.08)" }}>
                            <Plus size={22} color="#fff" strokeWidth={2.2} />
                          </View>
                        </View>
                      </PictureCard>
                    </View>
                  </Animated.View>
                )}

                {/* ══ Name and amount ══ */}
                {key === "about" && (
                  <Animated.View entering={FadeInDown.delay(180).duration(420)} style={{ marginTop: 24, gap: 14 }}>
                    <View style={{ height: 150, borderRadius: 28, borderCurve: "continuous", overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" }}>
                      <CaixinhaCover goal={{ name: name || "Nova caixinha", cover_image: null }} height={150} glyph={130} glyphTop={-4} />
                      <LinearGradient colors={["rgba(8,9,10,0)", "rgba(8,9,10,0.78)"]} style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 92 }} />
                      <View style={{ position: "absolute", left: 18, right: 18, bottom: 14 }}>
                        <Text numberOfLines={1} style={{ fontSize: 19, fontWeight: "800", letterSpacing: -0.5, color: "#fff" }}>{name.trim() || "Nova caixinha"}</Text>
                        <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 13, color: "rgba(255,255,255,0.72)" }}>
                          {hasValue ? (cents > 0 ? `Meta de ${brl(cents)}` : "Defina um valor") : "Sem valor definido"}
                        </Text>
                      </View>
                    </View>

                    <Group>
                      <Row>
                        <Text style={{ fontSize: 12, fontWeight: "600", letterSpacing: 0.2, color: INK.softer }}>Nome</Text>
                        <TextInput
                          value={name}
                          onChangeText={(t) => {
                            setName(t);
                            setError(null);
                          }}
                          placeholder="Ex.: Viagem para o Japão"
                          placeholderTextColor={INK.faint}
                          maxLength={60}
                          autoFocus={choiceId === "custom"}
                          style={{ marginTop: 4, minWidth: 0, padding: 0, fontSize: 17, fontWeight: "600", color: "#fff" }}
                        />
                      </Row>
                      <Row last={!hasValue}>
                        <Text style={{ fontSize: 12, fontWeight: "600", letterSpacing: 0.2, color: INK.softer }}>Valor</Text>
                        <View style={{ marginTop: 10 }}>
                          <Segments
                            height={42}
                            value={hasValue ? "com" : "sem"}
                            options={[
                              { value: "com", label: "Com meta" },
                              { value: "sem", label: "Sem valor definido" },
                            ]}
                            onChange={(v) => {
                              void Haptics.selectionAsync().catch(() => undefined);
                              setHasValue(v === "com");
                              setError(null);
                            }}
                          />
                        </View>
                        <Text style={{ marginTop: 10, fontSize: 12.5, lineHeight: 17, color: INK.soft }}>
                          {hasValue ? "Eu calculo quanto guardar por mês para você chegar lá." : "Você guarda conforme der, sem meta nem prazo."}
                        </Text>
                      </Row>
                      {hasValue && (
                        <Row last>
                          <Text style={{ fontSize: 12, fontWeight: "600", letterSpacing: 0.2, color: INK.softer }}>Quanto quer juntar</Text>
                          <AmountField cents={cents} onChange={(c) => { setCents(c); setError(null); }} size={36} />
                          {kind === "reserva" && reserveChips(month).length > 0 && (
                            <View style={{ marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                              {reserveChips(month).map((c) => (
                                <Tag key={c.label} on={cents === c.cents} onPress={() => { setCents(c.cents); setError(null); }}>
                                  {`${c.label} · ${brl(c.cents)}`}
                                </Tag>
                              ))}
                            </View>
                          )}
                        </Row>
                      )}
                    </Group>
                  </Animated.View>
                )}

                {/* ══ By when ══ */}
                {key === "time" && (
                  <Animated.View entering={FadeInDown.delay(180).duration(420)} style={{ marginTop: 26, gap: 14 }}>
                    <Segments
                      value={span}
                      options={[...SPANS.map((s) => ({ value: s.months as number | "more", label: s.label })), { value: "more", label: "Outro" }]}
                      onChange={(v) => {
                        void Haptics.selectionAsync().catch(() => undefined);
                        if (v === "more") {
                          setMore(true);
                          setMonths(years * 12);
                        } else {
                          setMore(false);
                          setMonths(v);
                        }
                      }}
                    />

                    {more && months !== null && (
                      <Group>
                        <Row last>
                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                            <Stepper icon={Minus} label="Menos um ano" disabled={years <= 1} onPress={() => { setYears(years - 1); setMonths((years - 1) * 12); }} />
                            <Text style={{ fontSize: 26, fontWeight: "800", letterSpacing: -0.8, color: "#fff" }}>{yearsLabel(years)}</Text>
                            <Stepper icon={Plus} label="Mais um ano" disabled={years >= 30} onPress={() => { setYears(years + 1); setMonths((years + 1) * 12); }} />
                          </View>
                        </Row>
                      </Group>
                    )}

                    {withDate && cents > 0 ? (
                      <Group>
                        <Row last>
                          <Text style={{ fontSize: 12, fontWeight: "600", letterSpacing: 0.2, color: INK.softer }}>Para chegar em {due}</Text>
                          <Text style={{ marginTop: 4, fontSize: 34, fontWeight: "800", letterSpacing: -1.2, color: "#fff" }}>
                            {money(perMonth)}
                            <Text style={{ fontSize: 15, fontWeight: "500", letterSpacing: 0, color: INK.soft }}> por mês</Text>
                          </Text>
                        </Row>
                      </Group>
                    ) : null}

                    {months === null ? (
                      <Group>
                        <Row last>
                          <Text style={{ fontSize: 12, fontWeight: "600", letterSpacing: 0.2, color: INK.softer }}>Quanto por mês (opcional)</Text>
                          <TextInput
                            value={monthlyCents === 0 ? "" : brl(monthlyCents)}
                            onChangeText={(t) => {
                              const digits = t.replace(/\D/g, "").slice(0, 10);
                              setMonthlyCents(Math.min(Number(digits || "0"), 99999999));
                            }}
                            keyboardType="number-pad"
                            placeholder="Conforme der"
                            placeholderTextColor={INK.faint}
                            style={{ marginTop: 4, minWidth: 0, padding: 0, fontSize: 22, fontWeight: "700", color: "#fff" }}
                          />
                        </Row>
                      </Group>
                    ) : null}

                    <Pressable
                      onPress={() => {
                        setMore(false);
                        setMonths(months === null ? 12 : null);
                      }}
                      hitSlop={10}
                      style={{ alignSelf: "center", paddingVertical: 4 }}
                    >
                      <Text style={{ fontSize: 13.5, fontWeight: "600", color: INK.soft }}>
                        {months === null ? "Definir um prazo" : "Não tem prazo"}
                      </Text>
                    </Pressable>
                  </Animated.View>
                )}

                {/* ══ Start with how much ══ */}
                {key === "start" && (
                  <Animated.View entering={FadeInDown.delay(180).duration(420)} style={{ marginTop: 26, gap: 14 }}>
                    <Group>
                      <Row last>
                        <Text style={{ fontSize: 12, fontWeight: "600", letterSpacing: 0.2, color: INK.softer }}>Começar com</Text>
                        <AmountField
                          cents={startCents}
                          size={40}
                          onChange={(c) => {
                            setStartCents(Math.min(c, 99999999));
                            setError(null);
                          }}
                        />
                      </Row>
                    </Group>

                    {start > 0 &&
                      (accounts.length === 0 ? (
                        <Text style={{ fontSize: 13, color: INK.softer }}>Crie uma conta primeiro para guardar a partir dela.</Text>
                      ) : (
                        <View>
                          <Text style={{ marginBottom: 8, marginLeft: 4, fontSize: 12, fontWeight: "600", letterSpacing: 0.2, color: INK.softer }}>Sai de qual conta</Text>
                          <Group>
                            {accounts.map((acc, i) => {
                              const on = acc.id === accountId;
                              return (
                                <Pressable key={acc.id} onPress={() => { void Haptics.selectionAsync().catch(() => undefined); setAccountId(acc.id); }}>
                                  <Row last={i === accounts.length - 1}>
                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                                      <BankMark name={acc.name} hex={colorFor(acc.name, acc.color, "#6B7280")} size={38} />
                                      <View style={{ flex: 1, minWidth: 0 }}>
                                        <Text numberOfLines={1} style={{ fontSize: 15.5, fontWeight: "600", color: "#fff" }}>{acc.name}</Text>
                                        <Text style={{ marginTop: 1, fontSize: 12.5, color: INK.softer }}>{money(Number(acc.current_balance) || 0)}</Text>
                                      </View>
                                      <View
                                        style={{
                                          width: 24,
                                          height: 24,
                                          borderRadius: 12,
                                          alignItems: "center",
                                          justifyContent: "center",
                                          borderWidth: on ? 0 : 1.5,
                                          borderColor: "rgba(255,255,255,0.28)",
                                          backgroundColor: on ? "#fff" : "transparent",
                                        }}
                                      >
                                        {on && <Check size={14} color="#0B0B0B" strokeWidth={3.2} />}
                                      </View>
                                    </View>
                                  </Row>
                                </Pressable>
                              );
                            })}
                          </Group>
                        </View>
                      ))}
                  </Animated.View>
                )}

                {/* ══ The caixinha as it will be: its picture fading into a card with the plan on it ══ */}
                {key === "review" && (
                  <Animated.View entering={FadeInDown.delay(180).duration(420)} style={{ marginTop: 24 }}>
                    <View style={{ borderRadius: 30, borderCurve: "continuous", overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: CARD }}>
                      <View style={{ height: 190 }}>
                        <CaixinhaCover goal={{ name: name.trim(), cover_image: photo }} height={190} glyph={150} glyphTop={8} />
                        <LinearGradient colors={["rgba(23,25,31,0)", "rgba(23,25,31,0.7)", CARD]} locations={[0, 0.6, 1]} style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 110 }} />

                        {/* The picture can be changed now or any time later, so it is only a small thing in the corner. */}
                        <Pressable
                          onPress={() => void choosePhoto()}
                          disabled={photoBusy}
                          accessibilityLabel="Trocar imagem"
                          style={({ pressed }) => ({ position: "absolute", top: 12, right: 12, opacity: pressed || photoBusy ? 0.6 : 1 })}
                        >
                          <View style={{ height: 32, paddingHorizontal: 12, borderRadius: 16, overflow: "hidden", flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.28)" }}>
                            <BlurView intensity={30} tint="dark" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 16 }} />
                            <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.12)" }} />
                            <View style={{ zIndex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
                              <ImageIcon size={14} color="#fff" />
                              <Text style={{ fontSize: 12.5, fontWeight: "700", color: "#fff" }}>{photoBusy ? "Enviando…" : "Trocar imagem"}</Text>
                            </View>
                          </View>
                        </Pressable>
                      </View>

                      <View style={{ paddingHorizontal: 20, paddingBottom: 20, marginTop: -26 }}>
                        <Text numberOfLines={2} style={{ fontSize: 24, fontWeight: "800", letterSpacing: -0.8, color: "#fff" }}>{name.trim()}</Text>

                        {/* The plan, large: what each month asks and when it gets there. */}
                        <View style={{ marginTop: 18 }}>
                          {hasValue && perMonth > 0 ? (
                            <>
                              <Text style={{ fontSize: 12, fontWeight: "600", color: INK.softer }}>Guardar por mês</Text>
                              <Text style={{ marginTop: 2, fontSize: 36, fontWeight: "800", letterSpacing: -1.3, color: "#fff" }}>
                                {money(perMonth)}
                              </Text>
                              <Text style={{ marginTop: 2, fontSize: 14, color: INK.soft }}>
                                pra chegar lá em <Text style={{ fontWeight: "700", color: "#fff" }}>{due}</Text>
                                {months ? ` · ${months >= 12 && months % 12 === 0 ? yearsLabel(months / 12) : `${months} meses`}` : ""}
                              </Text>
                            </>
                          ) : hasValue ? (
                            <>
                              <Text style={{ fontSize: 12, fontWeight: "600", color: INK.softer }}>Sem prazo</Text>
                              <Text style={{ marginTop: 2, fontSize: 24, fontWeight: "800", letterSpacing: -0.8, color: "#fff" }}>
                                {monthlyCents > 0 ? `${money(monthlyCents / 100)} por mês` : "Guarda quando der"}
                              </Text>
                            </>
                          ) : (
                            <>
                              <Text style={{ fontSize: 12, fontWeight: "600", color: INK.softer }}>Sem valor definido</Text>
                              <Text style={{ marginTop: 2, fontSize: 24, fontWeight: "800", letterSpacing: -0.8, color: "#fff" }}>No seu ritmo</Text>
                            </>
                          )}
                        </View>

                        <View style={{ marginTop: 18, paddingTop: 16, flexDirection: "row", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)" }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 12, fontWeight: "600", color: INK.softer }}>Meta</Text>
                            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ marginTop: 3, fontSize: 17, fontWeight: "700", color: "#fff" }}>
                              {hasValue ? money(target) : "Livre"}
                            </Text>
                          </View>
                          <View style={{ width: 1, marginHorizontal: 16, backgroundColor: "rgba(255,255,255,0.08)" }} />
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 12, fontWeight: "600", color: INK.softer }}>Começa com</Text>
                            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ marginTop: 3, fontSize: 17, fontWeight: "700", color: "#fff" }}>
                              {money(start)}
                            </Text>
                            {start > 0 && account && <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 12, color: INK.softer }}>de {account.name}</Text>}
                          </View>
                        </View>
                      </View>
                    </View>
                  </Animated.View>
                )}

                {error && <Text style={{ marginTop: 16, fontSize: 13.5, lineHeight: 18, color: RED }}>{error}</Text>}
              </ScrollView>

              {/* On the first page a picture is the answer, so there is no button until one has been chosen. */}
              {(key !== "purpose" || choiceId !== null) && (
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
                    opacity: !canNext ? 0.28 : saving ? 0.7 : 1,
                    transform: [{ scale: pressed && canNext ? 0.98 : 1 }],
                  })}
                >
                  <Text style={{ fontSize: 16.5, fontWeight: "700", letterSpacing: -0.2, color: "#0B0B0B" }}>
                    {saving ? "Só um instante…" : last ? "Criar caixinha" : "Continuar"}
                  </Text>
                </Pressable>
              </View>
              )}
            </KeyboardAvoidingView>
          </View>
        )}
      </Room>
    </Modal>
  );
}

/**
 * Willo, asking.
 *
 * His sphere, small and turning — quicker while he is "speaking" — with his name beside
 * it; the question typed out large under them, and once it is all there, his note about
 * this person's own money fades in beneath. The note keeps its place while the question
 * types, so nothing below it jumps.
 */
function Willo({ ask, tip }: { ask: string; tip: string }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    setShown(0);
    const id = setInterval(() => {
      setShown((n) => {
        if (n >= ask.length) {
          clearInterval(id);
          return n;
        }
        return n + 1;
      });
    }, 24);
    return () => clearInterval(id);
  }, [ask]);

  const typing = shown < ask.length;
  const fade = useSharedValue(0);
  useEffect(() => {
    fade.set(withTiming(typing ? 0 : 1, { duration: typing ? 0 : 420 }));
  }, [typing, fade]);
  const note = useAnimatedStyle(() => ({ opacity: fade.get(), transform: [{ translateY: (1 - fade.get()) * 6 }] }));

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginLeft: -6 }}>
        <ParticleOrb size={44} density={170} mode={typing ? "thinking" : "idle"} />
        <Text style={{ fontSize: 13, fontWeight: "700", letterSpacing: 0.3, color: "rgba(255,255,255,0.9)" }}>Willo</Text>
      </View>
      <Text style={{ marginTop: 10, fontSize: 29, fontWeight: "800", letterSpacing: -1, lineHeight: 34, color: "#fff" }}>
        {ask.slice(0, shown)}
        <Text style={{ color: "transparent" }}>{ask.slice(shown)}</Text>
      </Text>
      <Animated.Text style={[{ marginTop: 10, fontSize: 15, lineHeight: 22, color: "rgba(255,255,255,0.62)" }, note]}>{tip}</Animated.Text>
    </View>
  );
}

/** A picture to choose, with what it is called and what it covers across its foot. */
function PictureCard({
  width,
  height,
  on,
  dim = false,
  label,
  hint,
  badge,
  onPress,
  children,
}: {
  width: number;
  height: number;
  on: boolean;
  dim?: boolean;
  label: string;
  hint: string;
  badge?: string;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }] })}>
      <View
        style={{
          width,
          height,
          borderRadius: 26,
          borderCurve: "continuous",
          overflow: "hidden",
          borderWidth: on ? 2 : 1,
          borderColor: on ? "#fff" : "rgba(255,255,255,0.12)",
          opacity: dim ? 0.5 : 1,
        }}
      >
        {children}
        <LinearGradient colors={["rgba(8,9,10,0)", "rgba(8,9,10,0.55)", "rgba(8,9,10,0.9)"]} locations={[0, 0.45, 1]} style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 86 }} />
        <View style={{ position: "absolute", left: 14, right: 14, bottom: 12 }}>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={{ fontSize: 15.5, fontWeight: "800", letterSpacing: -0.3, color: "#fff" }}>
            {label}
          </Text>
          <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 12, color: "rgba(255,255,255,0.66)" }}>{hint}</Text>
        </View>
        {badge && (
          <View style={{ position: "absolute", top: 12, left: 12, height: 26, paddingHorizontal: 10, borderRadius: 13, overflow: "hidden", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.26)" }}>
            <BlurView intensity={30} tint="dark" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 13 }} />
            <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.12)" }} />
            <Text style={{ zIndex: 1, fontSize: 11.5, fontWeight: "700", color: "#fff" }}>{badge}</Text>
          </View>
        )}
        {on && (
          <View style={{ position: "absolute", top: 12, right: 12, width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }}>
            <Check size={15} color="#0B0B0B" strokeWidth={3.2} />
          </View>
        )}
      </View>
    </Pressable>
  );
}

/** A round glass button for the page's top bar. */
function GlassDot({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
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

/** A grouped piece of glass, the way a settings page groups its rows. */
function Group({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <View
      style={[
        {
          borderRadius: 24,
          borderCurve: "continuous",
          overflow: "hidden",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.10)",
          backgroundColor: "rgba(255,255,255,0.06)",
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

function Row({ children, last = false }: { children: ReactNode; last?: boolean }) {
  return (
    <View style={{ paddingHorizontal: 18, paddingVertical: 15, borderBottomWidth: last ? 0 : 1, borderBottomColor: "rgba(255,255,255,0.07)" }}>
      {children}
    </View>
  );
}

/**
 * A choice of a few, as one control: a capsule of glass with a white pill that slides
 * under the chosen one. `value` null lights none — for time, there is no date at all.
 */
function Segments<V extends string | number>({
  options,
  value,
  onChange,
  height = 50,
}: {
  options: { value: V; label: string }[];
  value: V | null;
  onChange: (v: V) => void;
  height?: number;
}) {
  const [track, setTrack] = useState(0);
  const index = options.findIndex((o) => o.value === value);
  const each = track > 0 ? (track - 8) / options.length : 0;
  const x = useSharedValue(0);
  const shown = useSharedValue(index >= 0 ? 1 : 0);

  useEffect(() => {
    if (index >= 0) x.set(withSpring(index * each, { duration: 420, dampingRatio: 0.82 }));
    shown.set(withTiming(index >= 0 ? 1 : 0, { duration: 180 }));
  }, [index, each, x, shown]);

  const pill = useAnimatedStyle(() => ({ opacity: shown.get(), transform: [{ translateX: x.get() }] }));

  return (
    <View
      onLayout={(e) => setTrack(e.nativeEvent.layout.width)}
      style={{
        height,
        padding: 4,
        borderRadius: height / 2,
        flexDirection: "row",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
        backgroundColor: "rgba(255,255,255,0.06)",
      }}
    >
      {each > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              top: 4,
              left: 4,
              width: each,
              height: height - 10,
              borderRadius: (height - 10) / 2,
              backgroundColor: "#fff",
              shadowColor: "#000",
              shadowOpacity: 0.25,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
            },
            pill,
          ]}
        />
      )}
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={String(o.value)} onPress={() => onChange(o.value)} style={{ flex: 1, alignItems: "center", justifyContent: "center", zIndex: 1 }}>
            <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: on ? "700" : "600", color: on ? "#0B0B0B" : "rgba(255,255,255,0.78)" }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A small suggestion that can be tapped to use it. */
function Tag({ on, onPress, children }: { on: boolean; onPress: () => void; children: string }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        height: 34,
        paddingHorizontal: 13,
        borderRadius: 17,
        justifyContent: "center",
        borderWidth: 1,
        borderColor: on ? "#fff" : "rgba(255,255,255,0.16)",
        backgroundColor: on ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.05)",
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      <Text style={{ fontSize: 13, fontWeight: "600", color: "#fff" }}>{children}</Text>
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
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.14)",
        backgroundColor: "rgba(255,255,255,0.08)",
        opacity: disabled ? 0.3 : 1,
        transform: [{ scale: pressed ? 0.92 : 1 }],
      })}
    >
      <Icon size={19} color="#fff" strokeWidth={2.4} />
    </Pressable>
  );
}

/** The figure a row is about, typed in place at the size it is read. */
function AmountField({ cents, onChange, size }: { cents: number; onChange: (c: number) => void; size: number }) {
  return (
    <TextInput
      value={brl(cents)}
      onChangeText={(t) => {
        const digits = t.replace(/\D/g, "").slice(0, 11);
        onChange(Math.min(Number(digits || "0"), 999999999));
      }}
      keyboardType="number-pad"
      style={{
        marginTop: 4,
        minWidth: 0,
        fontSize: size,
        fontWeight: "800",
        letterSpacing: -size / 26,
        color: cents === 0 ? INK.faint : "#fff",
        padding: 0,
      }}
    />
  );
}
