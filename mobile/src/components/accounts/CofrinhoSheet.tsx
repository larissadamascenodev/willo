import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { createGoal, createGoalDeposit, isReserveGoal } from "@/services/goalService";
import { getAccounts } from "@/services/transactionService";
import { colorFor } from "@/lib/banks";
import { CUSTOM_GOAL_PRESET } from "@/lib/goalPresets";
import { GOAL_PRESET_DATA, goalPresetIcon } from "~/lib/goalIcon";
import { deadlineIn, monthYear, monthlyNeeded } from "~/lib/cofrinho";
import StepSheet, { Ask } from "~/components/StepSheet";
import Created from "~/components/accounts/Created";
import BankMark from "~/components/BankMark";
import { Check, Minus, Plus } from "~/components/icons";
import { money } from "~/lib/money";
import { useAuth } from "~/lib/auth";
import { INK, RED } from "~/theme/tokens";

/**
 * Opening a cofrinho, one question at a time.
 *
 * A cofrinho is a goal with the money in it, so this asks what a goal asks — what it is
 * for, how much, by when — and then, because the money has to come from somewhere,
 * whether to put some in now and from which account. All in one go is the point: the
 * goal and the cofrinho cannot be made out of step with each other.
 *
 * The reserve is the one that has no date. It is filled as life allows and is never
 * "late", so it is not asked how long it will take.
 */

/** What a purpose is called on its tile; the full name is what is saved. */
const SHORT: Record<string, string> = {
  casa: "Casa própria",
  carro: "Carro",
  viagem: "Viagem",
  liberdade: "Liberdade financeira",
  educacao: "Educação",
  aposentadoria: "Aposentadoria",
  reserva: "Reserva de emergência",
  negocio: "Negócio",
  custom: "Outro objetivo",
};

/** The purpose that is none of the others, with a name of its own to show. */
const OTHER = { ...CUSTOM_GOAL_PRESET, name: "Outro objetivo" };

const SPANS = [
  { months: 6, label: "6 meses" },
  { months: 12, label: "1 ano" },
  { months: 24, label: "2 anos" },
];

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

export default function CofrinhoSheet({
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
  const [step, setStep] = useState(0);
  const [presetId, setPresetId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [cents, setCents] = useState(0);
  /* null is no date at all; otherwise how many months it is meant to take. */
  const [months, setMonths] = useState<number | null>(12);
  const [more, setMore] = useState(false);
  const [years, setYears] = useState(3);
  const [monthlyCents, setMonthlyCents] = useState(0);
  const [startCents, setStartCents] = useState(0);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<{ name: string; hex: string; icon: string; line: string } | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    setStep(0);
    setPresetId(null);
    setName("");
    setCents(0);
    setMonths(12);
    setMore(false);
    setYears(3);
    setMonthlyCents(0);
    setStartCents(0);
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
  }, [open, user]);

  const reserve = isReserveGoal({ name });
  const withDate = !reserve && months !== null;
  const preset = [...GOAL_PRESET_DATA, OTHER].find((p) => p.id === presetId);

  const start = startCents / 100;
  const target = cents / 100;
  /* What each month asks, with whatever goes in today already counted. */
  const perMonth = useMemo(
    () => (withDate && months ? monthlyNeeded(Math.max(target - start, 0), months) : 0),
    [withDate, months, target, start],
  );
  const due = withDate && months ? monthYear(deadlineIn(months)) : null;

  const pick = (id: string, label: string) => {
    setPresetId(id);
    setName(id === "custom" ? "" : label);
    setError(null);
    if (isReserveGoal({ name: label })) setMonths(null);
    else if (months === null) setMonths(12);
  };

  const next = async () => {
    setError(null);
    if (step === 1) {
      const trimmed = name.trim();
      if (trimmed.length < 2) {
        setError("Dê um nome ao cofrinho.");
        return;
      }
      if (existingNames.some((n) => n.toLocaleLowerCase("pt-BR") === trimmed.toLocaleLowerCase("pt-BR"))) {
        setError("Você já tem um cofrinho com esse nome.");
        return;
      }
      if (cents <= 0) {
        setError(reserve ? "Diga quanto quer ter de reserva." : "Diga quanto quer juntar.");
        return;
      }
      /* Whatever the name now says, the reserve has no date. */
      if (isReserveGoal({ name: trimmed })) setMonths(null);
    }
    if (step < 3) {
      setStep(step + 1);
      return;
    }
    if (!user) return;
    if (start > 0 && !accountId) {
      setError("Escolha de qual conta sai o dinheiro.");
      return;
    }
    setSaving(true);
    try {
      const trimmed = name.trim();
      const dated = !isReserveGoal({ name: trimmed }) && months !== null;
      const goal = await createGoal(
        {
          name: trimmed,
          target_amount: target,
          monthly_contribution: dated ? perMonth || null : monthlyCents > 0 ? monthlyCents / 100 : null,
          deadline: dated && months ? deadlineIn(months) : null,
        },
        user.id,
      );
      if (start > 0 && accountId) {
        await createGoalDeposit(
          { goal_id: goal.id, amount: start, date: isoToday(), source: "Primeiro depósito", account_id: accountId },
          user.id,
        );
      }
      const from = accounts.find((a) => a.id === accountId)?.name;
      setMade({
        name: trimmed,
        hex: preset?.hex ?? CUSTOM_GOAL_PRESET.hex,
        icon: preset?.icon ?? CUSTOM_GOAL_PRESET.icon,
        line:
          dated && perMonth > 0
            ? `Guarde ${money(perMonth)} por mês para chegar em ${due}.${start > 0 && from ? ` ${money(start)} já saíram de ${from}.` : ""}`
            : start > 0 && from
              ? `${money(start)} saíram de ${from} e já estão guardados.`
              : "Ele já está nos seus cofrinhos.",
      });
      onCreated();
    } catch {
      setError("Não foi possível criar o cofrinho.");
    } finally {
      setSaving(false);
    }
  };

  const canNext = step === 0 ? presetId !== null : step === 1 ? name.trim().length >= 2 && cents > 0 : true;
  const Mark = made ? goalPresetIcon(made.icon) : null;

  return (
    <StepSheet
      open={open}
      onClose={onClose}
      step={step}
      steps={4}
      onBack={() => setStep(Math.max(step - 1, 0))}
      onNext={next}
      nextLabel={step === 3 ? "Criar cofrinho" : "Continuar"}
      nextDisabled={!canNext}
      busy={saving}
      done={
        made && Mark ? (
          <Created
            accent={made.hex}
            mark={
              <View
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 48,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: `${made.hex}2E`,
                  borderWidth: 1.5,
                  borderColor: `${made.hex}88`,
                }}
              >
                <Mark size={42} color={made.hex} strokeWidth={2} />
              </View>
            }
            title="Cofrinho criado"
            subtitle={`${made.name}. ${made.line}`}
            onClose={onClose}
          />
        ) : null
      }
    >
      {step === 0 && (
        <View style={{ flex: 1 }}>
          <Ask title="Para que é esse cofrinho?" note="O dinheiro sai da conta, mas continua sendo seu." />
          <View style={{ marginTop: 20, flexDirection: "row", flexWrap: "wrap", rowGap: 12 }}>
            {[...GOAL_PRESET_DATA, OTHER].map((p) => {
              const Icon = goalPresetIcon(p.icon);
              const on = presetId === p.id;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => pick(p.id, p.id === "custom" ? "" : p.name)}
                  style={({ pressed }) => ({ width: "33.33%", alignItems: "center", transform: [{ scale: pressed ? 0.95 : 1 }] })}
                >
                  <View
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 32,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: on ? `${p.hex}33` : "rgba(255,255,255,0.06)",
                      borderWidth: on ? 2 : 1,
                      borderColor: on ? p.hex : "rgba(255,255,255,0.10)",
                    }}
                  >
                    <Icon size={26} color={p.hex} strokeWidth={2} />
                  </View>
                  <Text
                    numberOfLines={2}
                    style={{ marginTop: 8, height: 30, maxWidth: 96, textAlign: "center", fontSize: 12, lineHeight: 15, fontWeight: on ? "700" : "500", color: on ? "#fff" : INK.soft }}
                  >
                    {SHORT[p.id] ?? p.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {step === 1 && (
        <View style={{ flex: 1 }}>
          {/* An objective of the person's own is asked for first: it is the one thing the
              cofrinho cannot be made without. For the rest the name is already known. */}
          {presetId === "custom" ? (
            <>
              <Ask title="Qual é o objetivo?" note="Dê um nome que você reconheça na hora: Moto, Casamento, Reforma…" />
              <TextInput
                value={name}
                onChangeText={(t) => {
                  setName(t);
                  setError(null);
                }}
                placeholder="Nome do objetivo"
                placeholderTextColor={INK.faint}
                maxLength={60}
                autoFocus
                style={{ ...FIELD, marginTop: 20 }}
              />
              <Text style={{ marginTop: 24, fontSize: 12.5, color: INK.soft }}>Quanto quer juntar</Text>
              <AmountField cents={cents} onChange={(c) => { setCents(c); setError(null); }} size={40} top={6} />
            </>
          ) : (
            <>
              <Ask title={reserve ? "Quanto quer ter de reserva?" : "Quanto quer juntar?"} />
              <AmountField cents={cents} onChange={(c) => { setCents(c); setError(null); }} size={46} top={22} />
              <Text style={{ marginTop: 26, fontSize: 12.5, color: INK.soft }}>Nome do cofrinho</Text>
              <TextInput
                value={name}
                onChangeText={(t) => {
                  setName(t);
                  setError(null);
                }}
                placeholder="Ex: Viagem para o Japão"
                placeholderTextColor={INK.faint}
                maxLength={60}
                style={{ ...FIELD, marginTop: 8 }}
              />
            </>
          )}
          {error && <Text style={{ marginTop: 12, fontSize: 13, color: RED }}>{error}</Text>}
        </View>
      )}

      {step === 2 && (
        <View style={{ flex: 1 }}>
          {reserve ? (
            <>
              <Ask title="Quanto guardar por mês?" note="A reserva não tem prazo: você vai guardando conforme der e ela fica sempre à mão." />
              <MonthlyField cents={monthlyCents} onChange={setMonthlyCents} />
            </>
          ) : (
            <>
              <Ask title="Em quanto tempo?" />
              <View style={{ marginTop: 20, flexDirection: "row", gap: 8 }}>
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
                <View
                  style={{
                    marginTop: 22,
                    borderRadius: 22,
                    borderCurve: "continuous",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.12)",
                    backgroundColor: "rgba(255,255,255,0.06)",
                    paddingHorizontal: 18,
                    paddingVertical: 16,
                  }}
                >
                  <Text style={{ fontSize: 13, color: INK.soft }}>Para chegar em {due}, guarde</Text>
                  <Text style={{ marginTop: 4, fontSize: 32, fontWeight: "800", letterSpacing: -1.1, color: "#fff" }}>
                    {money(perMonth)}
                    <Text style={{ fontSize: 15, fontWeight: "500", letterSpacing: 0, color: INK.soft }}> por mês</Text>
                  </Text>
                </View>
              ) : null}

              {months === null ? (
                <>
                  <Text style={{ marginTop: 22, fontSize: 14, lineHeight: 19, color: INK.soft }}>
                    Sem prazo, você guarda conforme der. Se quiser, diga quanto por mês.
                  </Text>
                  <MonthlyField cents={monthlyCents} onChange={setMonthlyCents} />
                </>
              ) : null}

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
            </>
          )}
        </View>
      )}

      {step === 3 && (
        <View style={{ flex: 1 }}>
          <Ask title="Quer começar com quanto?" note="Pode deixar zerado e guardar depois. O que você colocar sai da conta que escolher." />
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
            style={{ marginTop: 22, minWidth: 0, fontSize: 46, fontWeight: "800", letterSpacing: -1.8, color: "#fff", padding: 0 }}
          />

          {start > 0 && (
            <>
              <Text style={{ marginTop: 22, fontSize: 12.5, color: INK.soft }}>Sai de qual conta</Text>
              {accounts.length === 0 ? (
                <Text style={{ marginTop: 10, fontSize: 13, color: INK.softer }}>Crie uma conta primeiro para guardar a partir dela.</Text>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  style={{ marginHorizontal: -22 }}
                  contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 10, gap: 10 }}
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
          {error && <Text style={{ marginTop: 14, fontSize: 13, color: RED }}>{error}</Text>}
        </View>
      )}
    </StepSheet>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        height: 50,
        borderRadius: 25,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: on ? "#fff" : "rgba(255,255,255,0.10)",
        backgroundColor: on ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.05)",
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      <Text style={{ fontSize: 14.5, fontWeight: "700", color: "#fff" }}>{label}</Text>
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
      placeholder="Conforme der"
      placeholderTextColor={INK.faint}
      style={{ ...FIELD, marginTop: 18 }}
    />
  );
}

/** The figure a page is about, typed in place at the size it is read. */
function AmountField({ cents, onChange, size, top }: { cents: number; onChange: (c: number) => void; size: number; top: number }) {
  return (
    <TextInput
      value={brl(cents)}
      onChangeText={(t) => {
        const digits = t.replace(/\D/g, "").slice(0, 11);
        onChange(Math.min(Number(digits || "0"), 999999999));
      }}
      keyboardType="number-pad"
      style={{
        marginTop: top,
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
