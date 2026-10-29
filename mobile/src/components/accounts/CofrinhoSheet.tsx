import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { createGoal, createGoalDeposit, isReserveGoal } from "@/services/goalService";
import { getAccounts } from "@/services/transactionService";
import { colorFor } from "@/lib/banks";
import { GOAL_PRESET_DATA, goalPresetIcon } from "~/lib/goalIcon";
import { CUSTOM_GOAL_PRESET } from "@/lib/goalPresets";
import { deadlineIn, monthYear, monthlyNeeded } from "~/lib/cofrinho";
import BottomSheet from "~/components/BottomSheet";
import SegmentedTabs from "~/components/SegmentedTabs";
import BankMark from "~/components/BankMark";
import { Check, X } from "~/components/icons";
import { money } from "~/lib/money";
import { useAuth } from "~/lib/auth";
import { GREEN, INK, RED } from "~/theme/tokens";

/**
 * Opening a cofrinho.
 *
 * A cofrinho is a goal with the money in it, so this asks what a goal asks — what it
 * is for, how much, by when — and then, because the money has to come from somewhere,
 * whether to put some in now and from which account. Doing it in one go is the point:
 * the goal and the cofrinho cannot be created out of step with each other.
 *
 * The reserve is the one that has no date. It is filled as life allows and never
 * "late", so it is not asked how long it will take.
 */

const MONTHS = [
  { n: 6, label: "6 meses" },
  { n: 12, label: "1 ano" },
  { n: 18, label: "1,5 ano" },
  { n: 24, label: "2 anos" },
  { n: 36, label: "3 anos" },
  { n: 60, label: "5 anos" },
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
  height: 48,
  minWidth: 0,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: INK.edge,
  backgroundColor: "rgba(255,255,255,0.05)",
  paddingHorizontal: 16,
  fontSize: 15.5,
  color: "#fff",
} as const;

const isoToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

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
  const [presetId, setPresetId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [cents, setCents] = useState(0);
  const [dated, setDated] = useState<"prazo" | "livre">("prazo");
  const [months, setMonths] = useState(12);
  const [other, setOther] = useState(false);
  const [monthlyCents, setMonthlyCents] = useState(0);
  const [startCents, setStartCents] = useState(0);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    setPresetId(null);
    setName("");
    setCents(0);
    setDated("prazo");
    setMonths(12);
    setOther(false);
    setMonthlyCents(0);
    setStartCents(0);
    setError(null);
    setSaving(false);
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
  const withDate = !reserve && dated === "prazo";

  const pick = (id: string, label: string) => {
    setPresetId(id);
    setName(label);
    setError(null);
    if (isReserveGoal({ name: label })) setDated("livre");
    else if (dated === "livre" && isReserveGoal({ name })) setDated("prazo");
  };

  const start = startCents / 100;
  const target = cents / 100;
  const rest = Math.max(target - start, 0);
  /* What each month asks, with whatever goes in today already counted. */
  const perMonth = useMemo(() => (withDate ? monthlyNeeded(rest, months) : 0), [withDate, rest, months]);
  const due = withDate ? monthYear(deadlineIn(months)) : null;
  const source = accounts.find((a) => a.id === accountId) ?? null;

  const submit = async () => {
    if (!user) return;
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("Diga para que é o cofrinho.");
      return;
    }
    if (existingNames.some((n) => n.toLocaleLowerCase("pt-BR") === trimmed.toLocaleLowerCase("pt-BR"))) {
      setError("Você já tem um cofrinho com esse nome.");
      return;
    }
    if (cents <= 0) {
      setError(reserve ? "Diga quanto você quer ter de reserva." : "Diga quanto você quer juntar.");
      return;
    }
    if (start > 0 && !accountId) {
      setError("Escolha de qual conta sai o dinheiro.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const goal = await createGoal(
        {
          name: trimmed,
          target_amount: target,
          monthly_contribution: withDate ? perMonth || null : monthlyCents > 0 ? monthlyCents / 100 : null,
          deadline: withDate ? deadlineIn(months) : null,
        },
        user.id,
      );
      if (start > 0 && accountId) {
        await createGoalDeposit(
          { goal_id: goal.id, amount: start, date: isoToday(), source: "Primeiro depósito", account_id: accountId },
          user.id,
        );
      }
      onCreated();
    } catch {
      setError("Não foi possível criar o cofrinho.");
      setSaving(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} full>
      <View style={{ paddingHorizontal: 20, paddingBottom: 24 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#fff" }}>Novo cofrinho</Text>
          <Pressable
            accessibilityLabel="Fechar"
            onPress={onClose}
            hitSlop={10}
            style={({ pressed }) => ({
              width: 32,
              height: 32,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255,255,255,0.06)",
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <X size={16} color={INK.soft} />
          </Pressable>
        </View>
        <Text style={{ marginTop: 6, fontSize: 13, lineHeight: 18, color: INK.softer }}>
          O dinheiro sai da conta, mas continua sendo seu — e conta na sua meta.
        </Text>

        <Text style={{ marginTop: 22, fontSize: 12.5, color: INK.soft }}>Para que é</Text>
        <View style={{ marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {[...GOAL_PRESET_DATA, { ...CUSTOM_GOAL_PRESET, name: "Outro objetivo" }].map((preset) => {
            const Icon = goalPresetIcon(preset.icon);
            const on = presetId === preset.id;
            return (
              <Pressable
                key={preset.id}
                onPress={() => (preset.id === "custom" ? (setPresetId("custom"), setName(""), setDated("prazo")) : pick(preset.id, preset.name))}
                style={{
                  width: "48.5%",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: on ? preset.hex : "rgba(255,255,255,0.07)",
                  backgroundColor: on ? `${preset.hex}1A` : "rgba(255,255,255,0.035)",
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                }}
              >
                <Icon size={18} color={preset.hex} strokeWidth={2} />
                <Text numberOfLines={2} style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: "600", color: "#fff" }}>
                  {preset.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={{ marginTop: 22, fontSize: 12.5, color: INK.soft }}>Nome</Text>
        <TextInput
          value={name}
          onChangeText={(t) => {
            setName(t);
            setPresetId(isReserveGoal({ name: t }) ? "reserva" : null);
            if (isReserveGoal({ name: t })) setDated("livre");
            setError(null);
          }}
          placeholder="Ex: Viagem para o Japão"
          placeholderTextColor={INK.faint}
          maxLength={60}
          style={{ ...FIELD, marginTop: 8 }}
        />

        <Text style={{ marginTop: 22, fontSize: 12.5, color: INK.soft }}>
          {reserve ? "Quanto você quer ter de reserva" : "Quanto você quer juntar"}
        </Text>
        <TextInput
          value={brl(cents)}
          onChangeText={(t) => {
            const digits = t.replace(/\D/g, "").slice(0, 11);
            setCents(Math.min(Number(digits || "0"), 999999999));
            setError(null);
          }}
          keyboardType="number-pad"
          style={{
            marginTop: 8,
            minWidth: 0,
            fontSize: 34,
            fontWeight: "800",
            letterSpacing: -1.2,
            color: cents === 0 ? INK.faint : "#fff",
            padding: 0,
          }}
        />

        {/* The reserve is never asked "how long?"; everything else is. */}
        {reserve ? (
          <Text style={{ marginTop: 14, fontSize: 12.5, lineHeight: 18, color: INK.softer }}>
            A reserva não tem prazo: você vai guardando conforme der, e ela fica sempre à mão.
          </Text>
        ) : (
          <>
            <Text style={{ marginTop: 22, fontSize: 12.5, color: INK.soft }}>Tem prazo?</Text>
            <View style={{ marginTop: 8 }}>
              <SegmentedTabs
                value={dated}
                onChange={setDated}
                options={[
                  { key: "prazo" as const, label: "Tem prazo" },
                  { key: "livre" as const, label: "Sem prazo" },
                ]}
              />
            </View>
          </>
        )}

        {withDate && (
          <>
            <Text style={{ marginTop: 20, fontSize: 12.5, color: INK.soft }}>Em quanto tempo</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              style={{ marginHorizontal: -20 }}
              contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, gap: 8 }}
            >
              {MONTHS.map((m) => {
                const on = !other && months === m.n;
                return (
                  <Pressable
                    key={m.n}
                    onPress={() => {
                      setOther(false);
                      setMonths(m.n);
                    }}
                    style={{
                      height: 40,
                      paddingHorizontal: 16,
                      borderRadius: 20,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 1,
                      borderColor: on ? "#fff" : "rgba(255,255,255,0.09)",
                      backgroundColor: on ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.04)",
                    }}
                  >
                    <Text style={{ fontSize: 13.5, fontWeight: "600", color: "#fff" }}>{m.label}</Text>
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => setOther(true)}
                style={{
                  height: 40,
                  paddingHorizontal: 16,
                  borderRadius: 20,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: other ? "#fff" : "rgba(255,255,255,0.09)",
                  backgroundColor: other ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.04)",
                }}
              >
                <Text style={{ fontSize: 13.5, fontWeight: "600", color: "#fff" }}>Outro</Text>
              </Pressable>
            </ScrollView>
            {other && (
              <View style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 10 }}>
                <TextInput
                  value={String(months || "")}
                  onChangeText={(t) => setMonths(Math.min(Number(t.replace(/\D/g, "") || "0"), 600))}
                  keyboardType="number-pad"
                  maxLength={3}
                  style={{ ...FIELD, width: 90, textAlign: "center" }}
                />
                <Text style={{ fontSize: 14, color: INK.soft }}>meses</Text>
              </View>
            )}
          </>
        )}

        {/* Without a date, a monthly figure is a habit rather than a deadline. */}
        {!withDate && (
          <>
            <Text style={{ marginTop: 22, fontSize: 12.5, color: INK.soft }}>
              Quanto quer guardar por mês (opcional)
            </Text>
            <TextInput
              value={monthlyCents === 0 ? "" : brl(monthlyCents)}
              onChangeText={(t) => {
                const digits = t.replace(/\D/g, "").slice(0, 10);
                setMonthlyCents(Math.min(Number(digits || "0"), 99999999));
              }}
              keyboardType="number-pad"
              placeholder="Conforme der"
              placeholderTextColor={INK.faint}
              style={{ ...FIELD, marginTop: 8 }}
            />
          </>
        )}

        <Text style={{ marginTop: 22, fontSize: 12.5, color: INK.soft }}>Já quer guardar algo agora? (opcional)</Text>
        <TextInput
          value={startCents === 0 ? "" : brl(startCents)}
          onChangeText={(t) => {
            const digits = t.replace(/\D/g, "").slice(0, 10);
            setStartCents(Math.min(Number(digits || "0"), 99999999));
            setError(null);
          }}
          keyboardType="number-pad"
          placeholder="Começar com R$ 0,00"
          placeholderTextColor={INK.faint}
          style={{ ...FIELD, marginTop: 8 }}
        />
        {start > 0 && (
          <>
            <Text style={{ marginTop: 18, fontSize: 12.5, color: INK.soft }}>Sai de qual conta</Text>
            <View style={{ marginTop: 10, gap: 8 }}>
              {accounts.map((acc) => {
                const on = acc.id === accountId;
                return (
                  <Pressable
                    key={acc.id}
                    onPress={() => setAccountId(acc.id)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: on ? "#fff" : "rgba(255,255,255,0.07)",
                      backgroundColor: on ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.035)",
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                    }}
                  >
                    <BankMark name={acc.name} hex={colorFor(acc.name, acc.color, "#6B7280")} size={32} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: "600", color: "#fff" }}>
                        {acc.name}
                      </Text>
                      <Text style={{ marginTop: 1, fontSize: 12, color: INK.softer }}>
                        {money(Number(acc.current_balance) || 0)}
                      </Text>
                    </View>
                    {on && <Check size={16} color={GREEN} strokeWidth={3} />}
                  </Pressable>
                );
              })}
              {accounts.length === 0 && (
                <Text style={{ fontSize: 12.5, color: INK.softer }}>Crie uma conta primeiro para guardar a partir dela.</Text>
              )}
            </View>
          </>
        )}

        {/* What the answers add up to. */}
        {withDate && cents > 0 && months > 0 && (
          <View
            style={{
              marginTop: 24,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.08)",
              backgroundColor: "rgba(255,255,255,0.04)",
              paddingHorizontal: 18,
              paddingVertical: 16,
            }}
          >
            <Text style={{ fontSize: 12.5, color: INK.soft }}>Para chegar em {due}, guarde</Text>
            <Text style={{ marginTop: 4, fontSize: 28, fontWeight: "800", letterSpacing: -1, color: "#fff" }}>
              {money(perMonth)}
              <Text style={{ fontSize: 14, fontWeight: "500", letterSpacing: 0, color: INK.soft }}> por mês</Text>
            </Text>
            {source && start > 0 && (
              <Text style={{ marginTop: 6, fontSize: 12, color: INK.softer }}>
                Já descontando os {money(start)} que saem hoje de {source.name}.
              </Text>
            )}
          </View>
        )}

        {error && <Text style={{ marginTop: 16, fontSize: 13, color: RED }}>{error}</Text>}

        <Pressable
          onPress={submit}
          disabled={saving}
          style={({ pressed }) => ({
            marginTop: 24,
            height: 52,
            borderRadius: 26,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#fff",
            opacity: saving ? 0.6 : pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#0B0B0B" }}>
            {saving ? "Criando..." : "Criar cofrinho"}
          </Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}
