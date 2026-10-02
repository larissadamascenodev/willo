import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { ArrowDown, Check } from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getAccounts, notifyFinanceDataChanged } from "@/services/transactionService";
import { useMoney } from "@/components/projecoes/shared";
import { BottomSheet, Button, Chip, Glass, Text, colors, toast, white } from "~/ui";
import { MoneyField, SectionLabel } from "../wallet/sheetParts";
import { toDateKey } from "../nova/format";

interface Account { id: string; name: string; type: string; current_balance: number }

function AccountList({ accounts, value, onChange }: { accounts: Account[]; value: string; onChange: (id: string) => void }) {
  const { fmt } = useMoney();
  return (
    <Glass radius={22} style={{ paddingHorizontal: 16 }}>
      {accounts.map((a, i) => (
        <Pressable key={a.id} onPress={() => onChange(a.id)} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: white(0.06) }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text weight="medium" size={15} numberOfLines={1}>{a.name}{a.type === "investment" ? " · investimento" : ""}</Text>
            <Text size={12} color={white(0.56)} tabular>{fmt(Number(a.current_balance))}</Text>
          </View>
          {value === a.id && <Check size={20} color="#fff" />}
        </Pressable>
      ))}
    </Glass>
  );
}

/** Mover dinheiro entre contas; para uma conta de investimento vira um aporte. */
export function TransferSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const { fmt } = useMoney();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [cents, setCents] = useState(0);
  const [when, setWhen] = useState<"hoje" | "ontem">("hoje");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFrom(""); setTo(""); setCents(0); setWhen("hoje"); setBusy(false);
    getAccounts(true).then((a) => setAccounts(a as unknown as Account[])).catch(() => {});
  }, [open]);

  const fromAcc = accounts.find((a) => a.id === from);
  const toAcc = accounts.find((a) => a.id === to);
  const invest = toAcc?.type === "investment";
  const amount = cents / 100;
  const short = !!fromAcc && amount > Number(fromAcc.current_balance);
  const can = !!from && !!to && from !== to && amount > 0 && !short && !busy;

  const submit = async () => {
    if (!user || !can) return;
    setBusy(true);
    try {
      const d = new Date();
      if (when === "ontem") d.setDate(d.getDate() - 1);
      const { error } = await supabase.from("transactions").insert({
        user_id: user.id,
        name: `${invest ? "Investimento" : "Transferência"}: ${fromAcc?.name} → ${toAcc?.name}`,
        type: invest ? "investimento" : "transferencia",
        amount,
        category: invest ? "Investimentos" : "Transferência",
        date: toDateKey(d),
        status: "pago",
        account_id: from,
        to_account_id: to,
        payment_method: "conta",
        recurrence_type: "unica",
      } as any);
      if (error) throw error;
      toast.success(`${fmt(amount)} ${invest ? "investido" : "transferido"}`);
      notifyFinanceDataChanged();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao realizar transferência");
      setBusy(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} size="full" footer={<Button label={busy ? "Transferindo…" : "Transferir"} disabled={!can} loading={busy} onPress={submit} />}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}>
        <Text display weight="bold" size={22}>Transferir</Text>
        <Text size={14} color={white(0.62)}>Mova dinheiro entre as suas contas.</Text>

        <SectionLabel>Valor</SectionLabel>
        <MoneyField cents={cents} onChange={setCents} />
        {short && <Text size={13} color={colors.red} style={{ marginTop: 8 }}>Saldo insuficiente na conta de origem.</Text>}

        <SectionLabel>De</SectionLabel>
        <AccountList accounts={accounts.filter((a) => a.type !== "investment")} value={from} onChange={setFrom} />
        <View style={{ alignItems: "center", marginTop: 12 }}><ArrowDown size={18} color={white(0.5)} /></View>
        <SectionLabel>Para</SectionLabel>
        <AccountList accounts={accounts.filter((a) => a.id !== from)} value={to} onChange={setTo} />

        <SectionLabel>Quando</SectionLabel>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Chip label="Hoje" on={when === "hoje"} onPress={() => setWhen("hoje")} />
          <Chip label="Ontem" on={when === "ontem"} onPress={() => setWhen("ontem")} />
        </View>
      </ScrollView>
    </BottomSheet>
  );
}
