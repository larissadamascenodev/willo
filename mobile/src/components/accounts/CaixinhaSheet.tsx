import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { RESERVE_NAME, createGoal, createGoalDeposit } from "@/services/goalService";
import { getAccounts } from "@/services/transactionService";
import { colorFor } from "@/lib/banks";
import { CUSTOM_GOAL_PRESET } from "@/lib/goalPresets";
import { goalPreset, goalPresetIcon } from "~/lib/goalIcon";
import { deadlineIn, monthYear, monthlyNeeded } from "~/lib/caixinha";
import StepSheet, { Ask } from "~/components/StepSheet";
import Created from "~/components/accounts/Created";
import BankMark from "~/components/BankMark";
import { Check, Minus, Plus } from "~/components/icons";
import { money } from "~/lib/money";
import { useAuth } from "~/lib/auth";
import { INK, RED } from "~/theme/tokens";

/**
 * Opening a caixinha, one question at a time.
 *
 * A caixinha is a goal with the money in it, so this asks what a goal asks — what it is
 * for, how much, by when — and then whether it earns, and, because the money has to come
 * from somewhere, whether to put some in now and from which account. All in one go is the
 * point: the goal and the money cannot be made out of step with each other.
 *
 * Not every caixinha has an amount to reach. The reserve is only filled as life allows, so
 * a caixinha can be made "sem valor definido", and then it is not asked how long it will take.
 */

interface Choice {
  id: string;
  /** What the tile says. */
  label: string;
  /** What is saved; recognised later by its words, so it wears the same picture. */
  name: string;
  icon: string;
  hex: string;
  /** Starts without an amount to reach. */
  open?: boolean;
}

/** The things people start a caixinha for. The last one is theirs to name. */
const CHOICES: Choice[] = [
  { id: "reserva", label: "Reserva de emergência", name: RESERVE_NAME, icon: "ShieldCheck", hex: "#C8F36D", open: true },
  { id: "viagem", label: "Viagem", name: "Viagem dos Sonhos", icon: "Plane", hex: "#22D3EE" },
  { id: "reforma", label: "Reformar a casa", name: "Reformar a casa", icon: "Home", hex: "#60A5FA" },
  { id: "carreira", label: "Focar na carreira", name: "Focar na carreira", icon: "Rocket", hex: "#F87171" },
  { id: "consumo", label: "Sonho de consumo", name: "Sonho de consumo", icon: "Gem", hex: "#C4B5FD" },
  { id: "carro", label: "Carro", name: "Carro Novo", icon: "Car", hex: "#F59E0B" },
  { id: "casa", label: "Casa própria", name: "Casa Própria", icon: "Home", hex: "#60A5FA" },
  { id: "educacao", label: "Educação", name: "Educação", icon: "GraduationCap", hex: "#A78BFA" },
];

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

/** "104", "104,5" → 104.5; null when it is not a share worth keeping. */
const parsePercent = (raw: string): number | null => {
  const n = Number(raw.replace(",", ".").trim());
  return Number.isFinite(n) && n >= 1 && n <= 500 ? Math.round(n * 100) / 100 : null;
};

type Key = "purpose" | "about" | "time" | "yield" | "start";

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
  const [step, setStep] = useState(0);
  const [choiceId, setChoiceId] = useState<string | null>(null);
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<{ name: string; hex: string; icon: string; line: string } | null>(null);

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

  /* Without an amount there is nothing to be late for, so the question of time drops out. */
  const keys: Key[] = hasValue ? ["purpose", "about", "time", "yield", "start"] : ["purpose", "about", "yield", "start"];
  const key = keys[Math.min(step, keys.length - 1)];
  const last = step >= keys.length - 1;

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

  const pick = (c: Choice | "custom") => {
    if (c === "custom") {
      setChoiceId("custom");
      setName("");
      setHasValue(true);
    } else {
      setChoiceId(c.id);
      setName(c.name);
      setHasValue(!c.open);
    }
    setMonths((m) => m ?? 12);
    setError(null);
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
    if (key === "yield" && earning && share === null) {
      setError("Diga quanto do CDI ela rende, por exemplo 100.");
      return;
    }
    if (!last) {
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
      const dated = hasValue && months !== null;
      const goal = await createGoal(
        {
          name: trimmed,
          target_amount: target,
          monthly_contribution: dated ? perMonth || null : hasValue && monthlyCents > 0 ? monthlyCents / 100 : null,
          deadline: dated && months ? deadlineIn(months) : null,
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
      const from = accounts.find((a) => a.id === accountId)?.name;
      const look = goalPreset({ name: trimmed });
      setMade({
        name: trimmed,
        hex: look.hex,
        icon: choice?.icon ?? CUSTOM_GOAL_PRESET.icon,
        line:
          dated && perMonth > 0
            ? `Guarde ${money(perMonth)} por mês para chegar em ${due}.${start > 0 && from ? ` ${money(start)} já saíram de ${from}.` : ""}`
            : start > 0 && from
              ? `${money(start)} saíram de ${from} e já estão guardados.`
              : "Ela já está nas suas caixinhas.",
      });
      onCreated();
    } catch {
      setError("Não foi possível criar a caixinha.");
    } finally {
      setSaving(false);
    }
  };

  const choice = CHOICES.find((c) => c.id === choiceId);
  const canNext =
    key === "purpose" ? choiceId !== null : key === "about" ? name.trim().length >= 2 && (!hasValue || cents > 0) : true;
  const Mark = made ? goalPresetIcon(made.icon) : null;

  return (
    <StepSheet
      open={open}
      onClose={onClose}
      step={step}
      steps={keys.length}
      onBack={() => setStep(Math.max(step - 1, 0))}
      onNext={next}
      nextLabel={last ? "Criar caixinha" : "Continuar"}
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
            title="Caixinha criada"
            subtitle={`${made.name}. ${made.line}`}
            onClose={onClose}
          />
        ) : null
      }
    >
      {key === "purpose" && (
        <View style={{ flex: 1 }}>
          <Ask title="Para que é essa caixinha?" note="Organize seus objetivos. O dinheiro sai da conta, mas continua sendo seu." />
          <View style={{ marginTop: 20, flexDirection: "row", flexWrap: "wrap", rowGap: 12 }}>
            {CHOICES.map((c) => (
              <Tile key={c.id} on={choiceId === c.id} hex={c.hex} label={c.label} onPress={() => pick(c)}>
                {(() => {
                  const Icon = goalPresetIcon(c.icon);
                  return <Icon size={26} color={c.hex} strokeWidth={2} />;
                })()}
              </Tile>
            ))}
            <Tile on={choiceId === "custom"} hex={CUSTOM_GOAL_PRESET.hex} label="Personalizada" onPress={() => pick("custom")}>
              <Plus size={26} color={CUSTOM_GOAL_PRESET.hex} strokeWidth={2.4} />
            </Tile>
          </View>
        </View>
      )}

      {key === "about" && (
        <View style={{ flex: 1 }}>
          <Ask
            title={choiceId === "custom" ? "Qual é o objetivo?" : "Como vai ser essa caixinha?"}
            note={choiceId === "custom" ? "Dê um nome que você reconheça na hora: Moto, Casamento, Reforma…" : undefined}
          />
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
            style={{ ...FIELD, marginTop: 20 }}
          />

          <View style={{ marginTop: 16, flexDirection: "row", gap: 8 }}>
            <Chip label="Valor definido" on={hasValue} onPress={() => { setHasValue(true); setError(null); }} />
            <Chip label="Sem valor definido" on={!hasValue} onPress={() => { setHasValue(false); setError(null); }} />
          </View>

          {hasValue ? (
            <>
              <Text style={{ marginTop: 22, fontSize: 12.5, color: INK.soft }}>Quanto quer juntar</Text>
              <AmountField cents={cents} onChange={(c) => { setCents(c); setError(null); }} size={42} top={6} />
            </>
          ) : (
            <Text style={{ marginTop: 20, fontSize: 14, lineHeight: 19, color: INK.soft }}>
              Sem meta nem prazo: você vai guardando conforme der e ela fica sempre à mão.
            </Text>
          )}
          {error && <Text style={{ marginTop: 12, fontSize: 13, color: RED }}>{error}</Text>}
        </View>
      )}

      {key === "time" && (
        <View style={{ flex: 1 }}>
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
        </View>
      )}

      {key === "yield" && (
        <View style={{ flex: 1 }}>
          <Ask title="Essa caixinha rende?" note="Se o dinheiro fica num lugar que rende, como um CDB ou uma conta com rendimento, a gente estima quanto." />
          <View style={{ marginTop: 20, flexDirection: "row", gap: 8 }}>
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
              <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 10 }}>
                <TextInput
                  value={percent}
                  onChangeText={(t) => {
                    setPercent(t.replace(/[^0-9,.]/g, "").slice(0, 6));
                    setError(null);
                  }}
                  keyboardType="decimal-pad"
                  placeholder="100"
                  placeholderTextColor={INK.faint}
                  style={{ ...FIELD, width: 120, textAlign: "center", fontWeight: "700" }}
                />
                <Text style={{ fontSize: 16, color: INK.soft }}>% do CDI</Text>
              </View>
              <Text style={{ marginTop: 14, fontSize: 12.5, lineHeight: 17, color: INK.softer }}>
                O rendimento é uma estimativa, bruto de imposto, e entra no saldo a cada dia útil.
              </Text>
            </>
          )}
          {error && <Text style={{ marginTop: 12, fontSize: 13, color: RED }}>{error}</Text>}
        </View>
      )}

      {key === "start" && (
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

/** One thing to start a caixinha for: a round glyph and what it is called. */
function Tile({
  on,
  hex,
  label,
  onPress,
  children,
}: {
  on: boolean;
  hex: string;
  label: string;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ width: "33.33%", alignItems: "center", transform: [{ scale: pressed ? 0.95 : 1 }] })}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: on ? `${hex}33` : "rgba(255,255,255,0.06)",
          borderWidth: on ? 2 : 1,
          borderColor: on ? hex : "rgba(255,255,255,0.10)",
        }}
      >
        {children}
      </View>
      <Text
        numberOfLines={2}
        style={{ marginTop: 8, height: 30, maxWidth: 96, textAlign: "center", fontSize: 12, lineHeight: 15, fontWeight: on ? "700" : "500", color: on ? "#fff" : INK.soft }}
      >
        {label}
      </Text>
    </Pressable>
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
