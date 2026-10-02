import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowDownLeft, ArrowUpRight, Banknote, Landmark, Pencil, Trash2, Vault } from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useMonth } from "@/contexts/MonthContext";
import { colorFor, initials } from "@/lib/banks";
import { deleteAccount, getAccounts, getTransactions, updateAccount } from "@/services/transactionService";
import { MONTH_NAMES, useMoney } from "@/components/projecoes/shared";
import { getCategoryHexColor, getCategoryIcon } from "@/lib/categoryUtils";
import { ColorPicker, PillInput, SectionLabel } from "~/features/wallet/sheetParts";
import { BottomSheet, Button, Glass, PageHeader, Screen, SectionTitle, Text, colors, toast, white } from "~/ui";
import { tint } from "~/lib/color";

interface Account { id: string; name: string; type: string; is_default: boolean; current_balance: number; initial_balance: number; color: string | null }
interface Tx { id: string; name: string; category: string; date: string; amount: number; type: string; status: string; account_id: string | null }

const TYPES: Record<string, { label: string; Icon: typeof Landmark }> = {
  cash: { label: "Dinheiro", Icon: Banknote },
  checking: { label: "Conta corrente", Icon: Landmark },
  savings: { label: "Poupança", Icon: Vault },
};

/** Uma conta: saldo, o que entrou e saiu no mês, em quê foi o dinheiro e os lançamentos dela. */
export default function ContaDetalhe() {
  const router = useRouter();
  const { user } = useAuth();
  const { fmt } = useMoney();
  const { selectedMonth, selectedYear } = useMonth();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [account, setAccount] = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("checking");
  const [editColor, setEditColor] = useState("violet");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    if (!user || !id) return;
    try {
      const accs = (await getAccounts()) as unknown as Account[];
      const acc = accs.find((a) => a.id === id);
      if (!acc) {
        toast.error("Conta não encontrada");
        router.replace("/gestao");
        return;
      }
      setAccount(acc);
      setEditName(acc.name);
      setEditType(acc.type);
      setEditColor(acc.color || "violet");
      const txs = (await getTransactions({ month: selectedMonth, year: selectedYear })) as unknown as Tx[];
      setTransactions(txs.filter((t) => t.account_id === id));
    } catch {
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [user, id, selectedMonth, selectedYear, router]);

  useEffect(() => { load(); }, [load]);

  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.filter((t) => t.type === "despesa" && t.status === "pago").forEach((t) => { map[t.category] = (map[t.category] || 0) + Number(t.amount); });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([name, amount]) => ({ name, amount }));
  }, [transactions]);
  const totalOut = byCategory.reduce((s, c) => s + c.amount, 0);
  const totalIn = transactions.filter((t) => t.type === "receita" && t.status === "pago").reduce((s, t) => s + Number(t.amount), 0);

  const save = async () => {
    if (!id || !editName.trim()) return;
    try {
      const updated = await updateAccount(id, { name: editName.trim(), type: editType, color: editColor });
      setAccount((prev) => (prev ? { ...prev, ...updated } : prev));
      setEditing(false);
      toast.success("Conta atualizada!");
    } catch {
      toast.error("Erro ao atualizar conta");
    }
  };

  const remove = async () => {
    if (!id) return;
    try {
      await deleteAccount(id);
      toast.success("Conta excluída!");
      router.replace("/gestao");
    } catch {
      toast.error("Erro ao excluir conta");
    }
  };

  if (loading || !account) {
    return (
      <Screen>
        <PageHeader title="Conta" />
        <View style={{ marginTop: 24, height: 160, borderRadius: 22, backgroundColor: white(0.06) }} />
      </Screen>
    );
  }

  const info = TYPES[account.type] ?? TYPES.checking;
  const hex = colorFor(account.name, account.color);
  const balance = Number(account.current_balance);
  const recent = [...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);

  return (
    <Screen>
      <PageHeader
        title={account.name}
        subtitle={`${info.label}${account.is_default ? " · Principal" : ""}`}
        action={
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable onPress={() => setEditing(true)} accessibilityLabel="Editar" style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: white(0.08), alignItems: "center", justifyContent: "center" }}>
              <Pencil size={16} color="#fff" />
            </Pressable>
            <Pressable onPress={() => setConfirmDelete(true)} accessibilityLabel="Excluir" style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(248,113,113,0.15)", alignItems: "center", justifyContent: "center" }}>
              <Trash2 size={16} color={colors.red} />
            </Pressable>
          </View>
        }
      />

      <Glass radius={26} style={{ marginTop: 20, padding: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: hex, alignItems: "center", justifyContent: "center" }}>
            <Text weight="bold" size={14}>{initials(account.name)}</Text>
          </View>
          <Text size={13} color={white(0.66)}>Saldo disponível</Text>
        </View>
        <Text weight="extrabold" size={38} tabular numberOfLines={1} color={balance < 0 ? colors.red : "#fff"} style={{ marginTop: 8, letterSpacing: -1 }}>{fmt(balance)}</Text>

        <View style={{ marginTop: 16, flexDirection: "row", borderTopWidth: 1, borderTopColor: white(0.12), paddingTop: 14 }}>
          {[{ label: "Entrou", value: totalIn, hex: colors.green, Icon: ArrowDownLeft }, { label: "Saiu", value: totalOut, hex: colors.red, Icon: ArrowUpRight }].map(({ label, value, hex: h, Icon }, i) => (
            <View key={label} style={[{ flex: 1 }, i === 1 ? { borderLeftWidth: 1, borderLeftColor: white(0.12), paddingLeft: 16 } : { paddingRight: 16 }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Icon size={13} color={h} strokeWidth={2.6} />
                <Text size={12.5} color={white(0.66)}>{label} em {MONTH_NAMES[selectedMonth].toLowerCase()}</Text>
              </View>
              <Text weight="extrabold" size={18} tabular numberOfLines={1} style={{ marginTop: 4 }}>{fmt(value)}</Text>
            </View>
          ))}
        </View>
      </Glass>

      {byCategory.length > 0 && (
        <>
          <SectionTitle>Para onde foi</SectionTitle>
          <Glass radius={22} style={{ padding: 16, gap: 12 }}>
            {byCategory.slice(0, 6).map((c) => {
              const Icon: any = getCategoryIcon(c.name);
              const h = getCategoryHexColor(c.name);
              const pct = totalOut > 0 ? Math.round((c.amount / totalOut) * 100) : 0;
              return (
                <View key={c.name} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: tint(h, 0.13) }}>
                    <Icon size={16} color={h} />
                  </View>
                  <Text weight="medium" size={14.5} style={{ flex: 1 }} numberOfLines={1}>{c.name}</Text>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text weight="semibold" size={14.5} tabular>{fmt(c.amount)}</Text>
                    <Text size={11.5} color={white(0.5)} tabular>{pct}%</Text>
                  </View>
                </View>
              );
            })}
          </Glass>
        </>
      )}

      <SectionTitle>Lançamentos do mês</SectionTitle>
      {recent.length === 0 ? (
        <Glass radius={22} style={{ padding: 28, alignItems: "center" }}>
          <Text size={14} color={white(0.62)}>Nenhum lançamento nesta conta em {MONTH_NAMES[selectedMonth].toLowerCase()}.</Text>
        </Glass>
      ) : (
        <Glass radius={22}>
          {recent.map((t, i) => (
            <Pressable key={t.id} onPress={() => router.push({ pathname: "/transacao/[id]", params: { id: t.id } })} style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: pressed ? white(0.04) : "transparent" }, i > 0 && { borderTopWidth: 1, borderTopColor: white(0.06) }]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text weight="medium" size={15} numberOfLines={1}>{t.name}</Text>
                <Text size={12} color={white(0.56)}>{t.category} · {t.date.slice(8, 10)}/{t.date.slice(5, 7)}</Text>
              </View>
              <Text weight="semibold" size={15} tabular color={t.type === "receita" ? colors.green : "#fff"}>{t.type === "receita" ? "+" : "−"}{fmt(Number(t.amount))}</Text>
            </Pressable>
          ))}
        </Glass>
      )}

      <BottomSheet open={editing} onClose={() => setEditing(false)} footer={<Button label="Salvar" disabled={!editName.trim()} onPress={save} />}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}>
          <Text display weight="bold" size={22}>Editar conta</Text>
          <SectionLabel>Nome</SectionLabel>
          <PillInput value={editName} onChangeText={setEditName} placeholder="Nome da conta" maxLength={40} />
          <SectionLabel>Tipo</SectionLabel>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {Object.entries(TYPES).map(([value, { label, Icon }]) => {
              const on = editType === value;
              return (
                <Pressable key={value} onPress={() => setEditType(value)} style={{ flex: 1, alignItems: "center", gap: 8, borderRadius: 20, borderWidth: 1, borderColor: on ? "#fff" : white(0.06), backgroundColor: on ? white(0.08) : white(0.1), paddingVertical: 14 }}>
                  <Icon size={20} color={on ? "#fff" : white(0.66)} />
                  <Text size={12.5} align="center" color={on ? "#fff" : white(0.74)}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
          <SectionLabel>Cor</SectionLabel>
          <ColorPicker value={editColor} onChange={setEditColor} />
        </ScrollView>
      </BottomSheet>

      <BottomSheet open={confirmDelete} onClose={() => setConfirmDelete(false)}>
        <View style={{ paddingHorizontal: 20, paddingBottom: 8, gap: 12 }}>
          <Text display weight="bold" size={20}>Excluir esta conta?</Text>
          <Text size={14} color={white(0.66)} style={{ lineHeight: 20 }}>Os lançamentos ligados a ela deixam de ter conta. Essa ação não pode ser desfeita.</Text>
          <Button label="Sim, excluir" variant="danger" onPress={remove} />
          <Button label="Cancelar" variant="glass" onPress={() => setConfirmDelete(false)} />
        </View>
      </BottomSheet>
    </Screen>
  );
}
