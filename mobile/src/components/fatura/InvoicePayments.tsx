import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import type { InvoiceLine } from "@/lib/invoice/readModel";
import type { InvoicePayment } from "@/services/invoiceService";
import { getAccounts } from "@/services/transactionService";
import { colorFor } from "@/lib/banks";
import CenterModal from "~/components/CenterModal";
import BankMark from "~/components/BankMark";
import { MoreVertical, Pencil, Trash2, Wallet } from "~/components/icons";
import { changePayment, removePayment } from "~/lib/invoicePayments";
import { money } from "~/lib/money";
import { showToast } from "~/lib/toast";
import { GREEN, INK, RED } from "~/theme/tokens";

/**
 * Payments, as lines of the statement.
 *
 * Money paid into an invoice is something that happened on the card, so it sits in the
 * list with the purchases, in date order, green and signed "+" because it is money
 * coming back to the card. Opened, it can be corrected or removed — one payment at a
 * time, the account's balance and the card's limit following it.
 */

export type Entry = { kind: "line"; line: InvoiceLine; at: string } | { kind: "payment"; payment: InvoicePayment; at: string };

/** Purchases and payments together, newest first. */
export function mergeEntries(lines: InvoiceLine[], payments: InvoicePayment[]): Entry[] {
  /* A payment sits at the moment it was made. A line has only a day, and an instalment's
     day is the invoice's own, often ahead of today — so a line counts from the start of
     its day, never later than today, and what was paid today lands on top. */
  const today = new Date().toISOString().slice(0, 10);
  const all: Entry[] = [
    ...lines.map((line) => ({ kind: "line" as const, line, at: `${line.date < today ? line.date : today}T00:00:00` })),
    ...payments.map((payment) => ({ kind: "payment" as const, payment, at: new Date(payment.paid_at).toISOString() })),
  ];
  return all.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

/** "Pagamento antecipado" before the invoice closes, "Pagamento da fatura" after. */
export function paymentName(payment: InvoicePayment, month: number, year: number, closingDay?: number | null) {
  if (!closingDay) return "Pagamento da fatura";
  const closing = new Date(year, month - 1, closingDay);
  return new Date(payment.paid_at) < closing ? "Pagamento antecipado" : "Pagamento da fatura";
}

export function PaymentRow({ name, payment, accountName, onPress }: { name: string; payment: InvoicePayment; accountName?: string; onPress?: () => void }) {
  const day = new Date(payment.paid_at).toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12, opacity: pressed ? 0.7 : 1 })}>
      <View style={{ width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(200,243,109,0.14)" }}>
        <Wallet size={20} color={GREEN} strokeWidth={2} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: 15.5, fontWeight: "600", color: "#fff" }}>{name}</Text>
        <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12.5, color: INK.soft }}>
          {day}
          {accountName ? ` · ${accountName}` : ""}
        </Text>
      </View>
      <Text style={{ fontSize: 15, fontWeight: "600", color: GREEN }}>+{money(Number(payment.amount))}</Text>
    </Pressable>
  );
}

interface Account {
  id: string;
  name: string;
  color: string | null;
  current_balance: number;
  type?: string;
}

export function PaymentDetail({
  payment,
  name,
  cardName,
  onClose,
  onChanged,
}: {
  payment: InvoicePayment | null;
  name: string;
  cardName?: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [shown, setShown] = useState<InvoicePayment | null>(payment);
  const [mode, setMode] = useState<"view" | "menu" | "edit" | "confirm">("view");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cents, setCents] = useState(0);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!payment) return;
    setShown(payment);
    setMode("view");
    setError(null);
    setCents(Math.round(Number(payment.amount) * 100));
    setAccountId(payment.account_id);
    getAccounts()
      .then((list) => setAccounts((list as unknown as Account[]).filter((a) => a.type !== "investment")))
      .catch(() => undefined);
  }, [payment]);

  if (!shown) return null;
  const account = accounts.find((a) => a.id === shown.account_id);
  const day = new Date(shown.paid_at).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" });

  const run = async (fn: () => Promise<void>, said: string) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onClose();
      onChanged();
      showToast(said);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível concluir.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <CenterModal
      open={!!payment}
      onClose={onClose}
      title={name}
      subtitle={cardName}
      actions={
        mode === "view" || mode === "menu" ? (
          <Pressable
            onPress={() => setMode((m) => (m === "menu" ? "view" : "menu"))}
            hitSlop={10}
            accessibilityLabel="Opções do pagamento"
            style={({ pressed }) => ({
              width: 32,
              height: 32,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: mode === "menu" ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.08)",
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <MoreVertical size={16} color="rgba(255,255,255,0.86)" strokeWidth={2.4} />
          </Pressable>
        ) : null
      }
    >
      {mode === "menu" && (
        <View style={{ position: "absolute", top: 0, right: 20, zIndex: 10, minWidth: 170, borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", backgroundColor: "rgba(30,32,38,0.98)" }}>
          <Item icon={Pencil} label="Editar" onPress={() => setMode("edit")} />
          <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.08)" }} />
          <Item icon={Trash2} label="Excluir" danger onPress={() => setMode("confirm")} />
        </View>
      )}

      {(mode === "view" || mode === "menu") && (
        <Animated.View entering={FadeIn.duration(200)}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(200,243,109,0.14)" }}>
              <Wallet size={21} color={GREEN} strokeWidth={2} />
            </View>
            <View>
              <Text style={{ fontSize: 30, fontWeight: "800", letterSpacing: -1, color: GREEN }}>+{money(Number(shown.amount))}</Text>
              <Text style={{ marginTop: 1, fontSize: 13, color: INK.soft }}>Pago nesta fatura · o limite voltou</Text>
            </View>
          </View>
          <View style={{ marginTop: 14 }}>
            <Fact label="Data" value={day} />
            <Fact label="Pago com" value={account?.name ?? "—"} last />
          </View>
        </Animated.View>
      )}

      {mode === "edit" && (
        <Animated.View entering={FadeIn.duration(200)}>
          <Text style={{ fontSize: 12.5, color: INK.soft }}>Valor pago</Text>
          <TextInput
            value={money(cents / 100)}
            onChangeText={(t) => setCents(Math.min(Number(t.replace(/\D/g, "").slice(0, 11) || "0"), 999999999))}
            keyboardType="number-pad"
            style={{ marginTop: 4, padding: 0, fontSize: 32, fontWeight: "800", letterSpacing: -1.1, color: cents === 0 ? INK.faint : "#fff" }}
          />
          <Text style={{ marginTop: 16, fontSize: 12.5, color: INK.soft }}>Pago com</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8, marginHorizontal: -20 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
            {accounts.map((a) => {
              const on = a.id === accountId;
              return (
                <Pressable
                  key={a.id}
                  onPress={() => setAccountId(a.id)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, paddingLeft: 8, paddingRight: 12, borderRadius: 18, borderWidth: 1, borderColor: on ? "#fff" : "rgba(255,255,255,0.08)", backgroundColor: on ? "rgba(255,255,255,0.13)" : "rgba(255,255,255,0.05)" }}
                >
                  <BankMark name={a.name} hex={colorFor(a.name, a.color)} size={28} />
                  <Text numberOfLines={1} style={{ fontSize: 13.5, fontWeight: "700", color: "#fff" }}>{a.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {error && <Text style={{ marginTop: 12, fontSize: 13, color: RED }}>{error}</Text>}
          <View style={{ marginTop: 20, flexDirection: "row", gap: 10 }}>
            <Button label="Cancelar" onPress={() => setMode("view")} disabled={busy} />
            <Button
              label={busy ? "Salvando…" : "Salvar"}
              primary
              disabled={busy || cents <= 0}
              onPress={() => void run(() => changePayment(shown, { amount: cents / 100, accountId }), `“${name}” atualizado`)}
            />
          </View>
        </Animated.View>
      )}

      {mode === "confirm" && (
        <Animated.View entering={FadeIn.duration(200)} style={{ alignItems: "center", paddingTop: 4 }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,107,107,0.14)" }}>
            <Trash2 size={24} color={RED} />
          </View>
          <Text style={{ marginTop: 14, fontSize: 18, fontWeight: "700", color: "#fff", textAlign: "center" }}>Excluir “{name}”?</Text>
          <Text style={{ marginTop: 8, fontSize: 14, lineHeight: 20, color: INK.soft, textAlign: "center" }}>
            {money(Number(shown.amount))} volta para {account?.name ?? "a conta"} e a fatura passa a dever esse valor de novo.
          </Text>
          {error && <Text style={{ marginTop: 12, fontSize: 13, color: RED }}>{error}</Text>}
          <View style={{ marginTop: 22, alignSelf: "stretch", flexDirection: "row", gap: 10 }}>
            <Button label="Cancelar" onPress={() => setMode("view")} disabled={busy} />
            <Button label={busy ? "Excluindo…" : "Excluir"} danger disabled={busy} onPress={() => void run(() => removePayment(shown), `“${name}” excluído`)} />
          </View>
        </Animated.View>
      )}
    </CenterModal>
  );
}

function Fact({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 16, paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: "rgba(255,255,255,0.06)" }}>
      <Text style={{ fontSize: 14.5, color: INK.soft }}>{label}</Text>
      <Text style={{ flexShrink: 1, fontSize: 15, fontWeight: "600", color: "#fff", textAlign: "right" }}>{value}</Text>
    </View>
  );
}

function Item({ icon: Icon, label, onPress, danger = false }: { icon: typeof Pencil; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 13, opacity: pressed ? 0.6 : 1 })}>
      <Icon size={16} color={danger ? RED : "#fff"} />
      <Text style={{ fontSize: 15, fontWeight: "600", color: danger ? RED : "#fff" }}>{label}</Text>
    </Pressable>
  );
}

function Button({ label, onPress, disabled, primary = false, danger = false }: { label: string; onPress: () => void; disabled?: boolean; primary?: boolean; danger?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        flex: 1,
        height: 50,
        borderRadius: 25,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: danger ? RED : primary ? "#fff" : "rgba(255,255,255,0.10)",
        opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
      })}
    >
      <Text style={{ fontSize: 15.5, fontWeight: "700", color: primary ? "#0B0B0B" : "#fff" }}>{label}</Text>
    </Pressable>
  );
}
