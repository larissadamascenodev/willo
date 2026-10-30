import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { getAccounts } from "@/services/transactionService";
import { payInvoice } from "@/services/invoiceService";
import BottomSheet from "~/components/BottomSheet";
import BankMark from "~/components/BankMark";
import { colorFor } from "@/lib/banks";
import { Minus, Plus } from "~/components/icons";
import { money } from "~/lib/money";
import { showToast } from "~/lib/toast";
import { INK, RED } from "~/theme/tokens";

/**
 * Paying the bill, the way the web does it.
 *
 * An invoice still open takes any amount up to what it owes: the money leaves the
 * account, the limit comes back at once, and the invoice stays open for what is still
 * to be bought. A closed one offers the bank's three ways: all of it; part of it, the
 * rest staying owed; or a plan with an entry, the instalments the bank offered and the
 * interest that costs, worked out from what was typed.
 */

type Mode = "total" | "minimo" | "parcelado";

interface Account {
  id: string;
  name: string;
  color: string | null;
  current_balance: number;
  is_default?: boolean;
  type?: string;
}

const MODES: { key: Mode; label: string; note: string }[] = [
  { key: "total", label: "Valor total", note: "Zera a fatura" },
  { key: "minimo", label: "Parcial", note: "O resto continua devido" },
  { key: "parcelado", label: "Parcelar", note: "Com entrada e juros" },
];

export default function PayInvoiceSheet({
  open,
  invoiceId,
  outstanding,
  closed,
  onClose,
  onPaid,
}: {
  open: boolean;
  invoiceId: string | null;
  /** What the invoice still asks for. */
  outstanding: number;
  /** Past its closing day: the bank's ways of paying apply. */
  closed: boolean;
  onClose: () => void;
  onPaid: () => void;
}) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("total");
  const [amount, setAmount] = useState(0);
  const [entry, setEntry] = useState(0);
  const [count, setCount] = useState(6);
  const [each, setEach] = useState(0);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMode("total");
    setAmount(Math.round(outstanding * 100));
    setEntry(0);
    setCount(6);
    setEach(0);
    setError(null);
    getAccounts()
      .then((list) => {
        const usable = (list as unknown as Account[]).filter((a) => a.type !== "investment");
        setAccounts(usable);
        setAccountId((id) => id ?? (usable.find((a) => a.is_default) ?? usable[0])?.id ?? null);
      })
      .catch(() => undefined);
  }, [open, outstanding]);

  const owed = Math.round(outstanding * 100);
  /* An open invoice pays whatever is typed: all of it is "total", less is a part. */
  const effective: Mode = !closed ? (amount >= owed ? "total" : "minimo") : mode;
  const paysNow = effective === "total" ? owed : effective === "minimo" ? amount : entry;
  const account = accounts.find((a) => a.id === accountId);
  const short = account ? paysNow / 100 > Number(account.current_balance) + 0.004 : false;
  const plan = mode === "parcelado" && each > 0 ? { total: entry + each * count, interest: Math.max(0, entry + each * count - owed) } : null;

  const canPay =
    !!accountId &&
    !!invoiceId &&
    !paying &&
    !short &&
    (effective === "total" ||
      (effective === "minimo" && amount > 0 && amount < owed) ||
      (effective === "parcelado" && count >= 2 && each > 0 && entry < owed));

  const pay = async () => {
    if (!canPay || !invoiceId || !accountId) return;
    setPaying(true);
    setError(null);
    try {
      await payInvoice(invoiceId, accountId, {
        mode: effective,
        amount_paid: effective === "minimo" ? amount / 100 : undefined,
        installments: effective === "parcelado" ? count : undefined,
        entry_amount: effective === "parcelado" ? entry / 100 : undefined,
      });
      window.dispatchEvent(new CustomEvent("finance-data-changed"));
      onClose();
      onPaid();
      showToast(
        effective === "total"
          ? `Fatura paga · ${money(owed / 100)}`
          : effective === "minimo"
            ? `${money(amount / 100)} pagos da fatura`
            : `Fatura parcelada em ${count}x`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível pagar. Tente de novo.");
    } finally {
      setPaying(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} full>
      <View style={{ paddingHorizontal: 20 }}>
        <Text style={{ fontSize: 20, fontWeight: "700", letterSpacing: -0.4, color: "#fff" }}>Pagar fatura</Text>
        <Text style={{ marginTop: 4, fontSize: 13.5, color: INK.soft }}>
          {closed ? "Fatura fechada" : "Fatura aberta"} · falta pagar {money(outstanding)}
        </Text>

        {/* How — only a closed invoice has the bank's options. */}
        {closed && (
          <View style={{ marginTop: 18, flexDirection: "row", gap: 8 }}>
            {MODES.map((m) => {
              const on = mode === m.key;
              return (
                <Pressable
                  key={m.key}
                  onPress={() => setMode(m.key)}
                  style={({ pressed }) => ({
                    flex: 1,
                    paddingVertical: 12,
                    paddingHorizontal: 10,
                    borderRadius: 18,
                    borderCurve: "continuous",
                    borderWidth: 1,
                    borderColor: on ? "#fff" : "rgba(255,255,255,0.08)",
                    backgroundColor: on ? "rgba(255,255,255,0.13)" : "rgba(255,255,255,0.05)",
                    opacity: pressed ? 0.75 : 1,
                  })}
                >
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>{m.label}</Text>
                  <Text style={{ marginTop: 2, fontSize: 11.5, color: INK.soft }}>{m.note}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <Animated.View key={closed ? mode : "open"} entering={FadeIn.duration(200)} style={{ marginTop: 20 }}>
          {(!closed || mode === "minimo") && (
            <>
              <Text style={{ fontSize: 12.5, color: INK.soft }}>{closed ? "Quanto vai pagar agora" : "Valor do pagamento"}</Text>
              <MoneyInput cents={amount} onChange={setAmount} big />
              {!closed && (
                <Text style={{ marginTop: 8, fontSize: 12.5, lineHeight: 18, color: INK.softer }}>
                  O limite volta na hora e a fatura continua aberta para novas compras.
                  {amount < owed && amount > 0 ? ` Continuam devidos ${money((owed - amount) / 100)}.` : ""}
                </Text>
              )}
              {closed && amount > 0 && amount < owed && (
                <Text style={{ marginTop: 8, fontSize: 12.5, color: INK.softer }}>Continuam devidos {money((owed - amount) / 100)}.</Text>
              )}
            </>
          )}

          {closed && mode === "total" && (
            <>
              <Text style={{ fontSize: 12.5, color: INK.soft }}>Valor</Text>
              <Text style={{ marginTop: 4, fontSize: 36, fontWeight: "800", letterSpacing: -1.3, color: "#fff" }}>{money(outstanding)}</Text>
            </>
          )}

          {closed && mode === "parcelado" && (
            <View style={{ gap: 14 }}>
              <View>
                <Text style={{ fontSize: 12.5, color: INK.soft }}>Entrada (pago agora)</Text>
                <MoneyInput cents={entry} onChange={setEntry} />
              </View>
              <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-end" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12.5, color: INK.soft }}>Parcelas</Text>
                  <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <Step icon="minus" onPress={() => setCount((c) => Math.max(2, c - 1))} />
                    <Text style={{ minWidth: 34, textAlign: "center", fontSize: 24, fontWeight: "800", color: "#fff" }}>{count}x</Text>
                    <Step icon="plus" onPress={() => setCount((c) => Math.min(24, c + 1))} />
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12.5, color: INK.soft }}>Valor de cada parcela</Text>
                  <MoneyInput cents={each} onChange={setEach} />
                </View>
              </View>
              {plan && (
                <View style={{ borderRadius: 18, backgroundColor: "rgba(255,255,255,0.05)", padding: 14, gap: 8 }}>
                  <Row label="Total que vai pagar" value={money(plan.total / 100)} />
                  <Row label="Juros" value={money(plan.interest / 100)} tone={plan.interest > 0 ? RED : undefined} />
                </View>
              )}
            </View>
          )}
        </Animated.View>

        {/* From where. */}
        <Text style={{ marginTop: 22, fontSize: 12.5, color: INK.soft }}>Pagar com</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8, marginHorizontal: -20 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
          {accounts.map((a) => {
            const on = a.id === accountId;
            return (
              <Pressable
                key={a.id}
                onPress={() => setAccountId(a.id)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  paddingVertical: 10,
                  paddingLeft: 10,
                  paddingRight: 14,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: on ? "#fff" : "rgba(255,255,255,0.08)",
                  backgroundColor: on ? "rgba(255,255,255,0.13)" : "rgba(255,255,255,0.05)",
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                <BankMark name={a.name} hex={colorFor(a.name, a.color)} size={32} />
                <View>
                  <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>{a.name}</Text>
                  <Text style={{ fontSize: 12, color: INK.soft }}>{money(Number(a.current_balance))}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
        {short && <Text style={{ marginTop: 10, fontSize: 12.5, color: RED }}>Essa conta não tem saldo para esse pagamento. Escolha outra conta ou um valor menor.</Text>}
        {error && <Text style={{ marginTop: 10, fontSize: 13, color: RED }}>{error}</Text>}

        <Pressable
          onPress={() => void pay()}
          disabled={!canPay}
          style={({ pressed }) => ({
            marginTop: 22,
            height: 54,
            borderRadius: 27,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#fff",
            opacity: !canPay ? 0.4 : pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ fontSize: 16.5, fontWeight: "700", color: "#0B0B0B" }}>
            {paying ? "Pagando…" : effective === "parcelado" ? `Parcelar em ${count}x` : `Pagar ${money(paysNow / 100)}`}
          </Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

function MoneyInput({ cents, onChange, big = false }: { cents: number; onChange: (c: number) => void; big?: boolean }) {
  return (
    <TextInput
      value={money(cents / 100)}
      onChangeText={(t) => onChange(Math.min(Number(t.replace(/\D/g, "").slice(0, 11) || "0"), 999999999))}
      keyboardType="number-pad"
      style={{
        marginTop: big ? 4 : 8,
        padding: 0,
        fontSize: big ? 36 : 20,
        fontWeight: "800",
        letterSpacing: big ? -1.3 : -0.5,
        color: cents === 0 ? INK.faint : "#fff",
      }}
    />
  );
}

function Step({ icon, onPress }: { icon: "minus" | "plus"; onPress: () => void }) {
  const Icon = icon === "minus" ? Minus : Plus;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({ width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.10)", opacity: pressed ? 0.6 : 1 })}
    >
      <Icon size={16} color="#fff" strokeWidth={2.4} />
    </Pressable>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text style={{ fontSize: 14, color: INK.soft }}>{label}</Text>
      <Text style={{ fontSize: 14.5, fontWeight: "700", color: tone ?? "#fff" }}>{value}</Text>
    </View>
  );
}
