import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Landmark, Plus } from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import { fetchGoals, type Goal } from "@/services/goalService";
import { getAccounts } from "@/services/transactionService";
import { useMoney } from "@/components/projecoes/shared";
import { AccountCreateSheet } from "~/features/wallet/AccountCreateSheet";
import { AccountsBalanceCard, type AccountBalanceItem } from "~/features/wallet/AccountsBalanceCard";
import { ReserveAndPots } from "~/features/wallet/ReserveAndPots";
import { Button, Glass, PageHeader, Screen, SectionTitle, Text, toast, white } from "~/ui";

/** Carteira: as contas com o saldo de cada uma, a reserva de emergência e os cofrinhos. */
export default function Gestao() {
  const router = useRouter();
  const { user } = useAuth();
  const { fmt } = useMoney();
  const { abrir } = useLocalSearchParams<{ abrir?: string }>();
  const [accounts, setAccounts] = useState<AccountBalanceItem[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  // atalho do cartão "Complete sua conta" do início: /gestao?abrir=conta
  useEffect(() => {
    if (abrir === "conta") setShowAdd(true);
  }, [abrir]);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [accs, goalRows] = await Promise.all([getAccounts(), fetchGoals()]);
      setAccounts(accs as unknown as AccountBalanceItem[]);
      setGoals(goalRows);
    } catch {
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
    const w = window as any;
    w.addEventListener("finance-data-changed", load);
    return () => w.removeEventListener("finance-data-changed", load);
  }, [load]);

  const bankAccounts = accounts.filter((a) => a.type !== "investment");
  const savedTotal = goals.reduce((s, g) => s + g.current_amount, 0);

  return (
    <Screen onRefresh={load}>
      <PageHeader title="Carteira" subtitle="Suas contas, a reserva e os cofrinhos" />

      <View style={{ marginTop: 24 }}>
        {loading ? (
          <View style={{ gap: 12 }}>
            <View style={{ height: 176, borderRadius: 22, backgroundColor: white(0.06) }} />
          </View>
        ) : bankAccounts.length === 0 ? (
          <Glass radius={22} style={{ padding: 32, alignItems: "center" }}>
            <Landmark size={32} color={white(0.45)} />
            <Text size={14} color={white(0.66)} style={{ marginTop: 12 }}>Nenhuma conta cadastrada</Text>
            <Text size={12} color={white(0.5)} style={{ marginTop: 4, marginBottom: 16 }}>Crie sua primeira conta para começar</Text>
            <Button label="Criar conta" height={44} icon={<Plus size={16} color="#0B0B0B" />} onPress={() => setShowAdd(true)} />
          </Glass>
        ) : (
          <AccountsBalanceCard accounts={bankAccounts} onOpen={(id) => router.push({ pathname: "/conta/[id]", params: { id } })} onAdd={() => setShowAdd(true)} savedTotal={savedTotal} />
        )}
      </View>

      <SectionTitle action={<Text size={13} color={white(0.62)} tabular>{fmt(savedTotal)}</Text>}>Guardado</SectionTitle>
      <ReserveAndPots goals={goals} />

      <AccountCreateSheet open={showAdd} onClose={() => setShowAdd(false)} onCreated={load} />
    </Screen>
  );
}
