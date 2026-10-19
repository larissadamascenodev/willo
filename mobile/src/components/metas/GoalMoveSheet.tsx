import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { getAccounts } from "@/services/transactionService";
import { colorFor } from "@/lib/banks";
import BottomSheet from "~/components/BottomSheet";
import SegmentedTabs from "~/components/SegmentedTabs";
import BankMark from "~/components/BankMark";
import { Check, X } from "~/components/icons";
import { money } from "~/lib/money";
import { useAuth } from "~/lib/auth";
import { GREEN, INK, RED } from "~/theme/tokens";

/**
 * Putting money into a goal, or taking it back out.
 *
 * One sheet for both, because they are the same act in opposite directions and the
 * only thing that really differs is which way the money travels between the account
 * and the goal. Which account it travels to or from is the part people forget to
 * say, so it is asked for rather than assumed — a deposit with no account named is
 * money that came from outside the app, and that is a real answer too.
 */

interface Account {
  id: string;
  name: string;
  color: string | null;
  is_default: boolean;
  current_balance: number;
}

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const isoDay = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return d.toISOString().split("T")[0];
};

export default function GoalMoveSheet({
  open,
  onClose,
  onSubmit,
  goalName,
  mode,
  maxAmount,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    amount: number;
    date: string;
    account_id?: string;
    source?: string;
    destination?: string;
  }) => Promise<void> | void;
  goalName: string;
  mode: "deposito" | "saque";
  /** What is in the goal, when taking money out. */
  maxAmount?: number;
}) {
  const { user } = useAuth();
  const isDeposit = mode === "deposito";

  const [cents, setCents] = useState(0);
  const [when, setWhen] = useState<"hoje" | "ontem">("hoje");
  const [note, setNote] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    setCents(0);
    setWhen("hoje");
    setNote("");
    setError(null);
    setSaving(false);
    void (async () => {
      const list = (await getAccounts()) as unknown as Account[];
      setAccounts(list);
      setAccountId(list.find((a) => a.is_default)?.id ?? list[0]?.id ?? null);
    })();
  }, [open, user]);

  const amount = cents / 100;
  const overLimit = !isDeposit && maxAmount !== undefined && amount > maxAmount;

  const submit = async () => {
    if (amount <= 0) {
      setError("Informe um valor.");
      return;
    }
    if (overLimit) {
      setError(`A meta tem ${money(maxAmount ?? 0)} guardados.`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        amount,
        date: isoDay(when === "ontem" ? 1 : 0),
        account_id: accountId ?? undefined,
        ...(isDeposit ? { source: note.trim() || undefined } : { destination: note.trim() || undefined }),
      });
    } catch {
      setError(isDeposit ? "Não foi possível guardar." : "Não foi possível sacar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} full>
      <View style={{ paddingHorizontal: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#fff" }}>
              {isDeposit ? "Guardar dinheiro" : "Sacar da meta"}
            </Text>
            <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 13, color: INK.soft }}>
              {goalName}
            </Text>
          </View>
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

        {/* The amount leads, at the size it leads on the entry form. */}
        <View style={{ marginTop: 24, flexDirection: "row", alignItems: "baseline", gap: 6 }}>
          <TextInput
            value={brl(cents)}
            onChangeText={(t) => {
              const digits = t.replace(/\D/g, "").slice(0, 10);
              setCents(Math.min(Number(digits || "0"), 99999999));
              setError(null);
            }}
            keyboardType="number-pad"
            style={{
              /* A flex child keeps its own content width unless it is told it may
                 shrink, and at this size that pushes the sheet sideways. */
              flex: 1,
              minWidth: 0,
              fontSize: 40,
              fontWeight: "800",
              letterSpacing: -1.4,
              color: cents === 0 ? INK.faint : isDeposit ? "#fff" : RED,
              padding: 0,
            }}
          />
        </View>
        {!isDeposit && maxAmount !== undefined && (
          <Text style={{ marginTop: 4, fontSize: 12.5, color: INK.softer }}>
            Disponível na meta: {money(maxAmount)}
          </Text>
        )}

        <Text style={{ marginTop: 24, fontSize: 12.5, color: INK.soft }}>Quando</Text>
        <View style={{ marginTop: 8 }}>
          <SegmentedTabs
            value={when}
            onChange={setWhen}
            options={[
              { key: "hoje" as const, label: "Hoje" },
              { key: "ontem" as const, label: "Ontem" },
            ]}
          />
        </View>

        <Text style={{ marginTop: 20, fontSize: 12.5, color: INK.soft }}>
          {isDeposit ? "De qual conta" : "Para qual conta"}
        </Text>
        <View style={{ marginTop: 10, gap: 8 }}>
          {accounts.map((acc) => {
            const on = acc.id === accountId;
            const hex = colorFor(acc.name, acc.color, "#6B7280");
            return (
              <Pressable
                key={acc.id}
                onPress={() => setAccountId(on ? null : acc.id)}
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
                <BankMark name={acc.name} hex={hex} size={32} />
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
          <Text style={{ fontSize: 11.5, lineHeight: 16, color: INK.softer }}>
            {isDeposit
              ? "Sem conta marcada, o depósito entra como dinheiro vindo de fora do Willo."
              : "Sem conta marcada, o saque sai da meta sem entrar em nenhuma conta."}
          </Text>
        </View>

        <Text style={{ marginTop: 20, fontSize: 12.5, color: INK.soft }}>
          {isDeposit ? "De onde veio" : "Para onde foi"} (opcional)
        </Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder={isDeposit ? "Ex: 13º salário" : "Ex: conserto do carro"}
          placeholderTextColor={INK.faint}
          maxLength={80}
          style={{
            marginTop: 8,
            height: 48,
            minWidth: 0,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: INK.edge,
            backgroundColor: "rgba(255,255,255,0.05)",
            paddingHorizontal: 16,
            fontSize: 15,
            color: "#fff",
          }}
        />

        {error && <Text style={{ marginTop: 14, fontSize: 13, color: RED }}>{error}</Text>}

        <Pressable
          onPress={submit}
          disabled={saving}
          style={({ pressed }) => ({
            marginTop: 24,
            height: 52,
            borderRadius: 26,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: isDeposit ? "#fff" : "rgba(248,113,113,0.16)",
            borderWidth: isDeposit ? 0 : 1,
            borderColor: "rgba(248,113,113,0.30)",
            opacity: saving || amount <= 0 ? 0.55 : pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ fontSize: 16, fontWeight: "700", color: isDeposit ? "#0B0B0B" : RED }}>
            {saving ? "Salvando..." : isDeposit ? "Guardar" : "Sacar"}
          </Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}
