import { useMemo, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Layers, Search, SlidersHorizontal, X } from "lucide-react-native";
import { useMonth } from "@/contexts/MonthContext";
import { useFinanceData } from "@/hooks/useFinanceData";
import { deleteTransaction } from "@/services/transactionService";
import type { TransactionRow } from "@/services/monthTransactions";
import { useMoney } from "@/components/projecoes/shared";
import { MonthPicker } from "~/features/nav/MonthPicker";
import { TransactionListItem } from "~/features/transactions/TransactionListItem";
import { TransactionsSummary } from "~/features/transactions/TransactionsSummary";
import { useMonthTransactions } from "~/features/transactions/useMonthTransactions";
import { Glass, Screen, Segmented, Text, colors, fonts, toast, white } from "~/ui";

type Tab = "todos" | "receita" | "despesa";

const TABS = [
  { key: "todos", label: "Todas" },
  { key: "receita", label: "Receitas" },
  { key: "despesa", label: "Despesas" },
] as const;

const WEEKDAYS = ["Domingo", "Segunda-Feira", "Terça-Feira", "Quarta-Feira", "Quinta-Feira", "Sexta-Feira", "Sábado"];
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function dateHeader(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return { label: `${WEEKDAYS[date.getDay()]}, ${d} De ${MONTHS[date.getMonth()]}`, isToday: date.toDateString() === new Date().toDateString() };
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: on ? "#fff" : white(0.06), backgroundColor: on ? "#fff" : white(0.05) }}>
      <Text size={12} weight="medium" color={on ? colors.black : white(0.82)}>{label}</Text>
    </Pressable>
  );
}

export default function Transacoes() {
  const router = useRouter();
  const { fmt } = useMoney();
  const { selectedMonth, selectedYear, setMonth } = useMonth();
  const { data: finance } = useFinanceData(selectedMonth, selectedYear);
  const { transactions, accounts, creditCards, customCategories, loading, error, reload } = useMonthTransactions(selectedMonth, selectedYear);

  const [tab, setTab] = useState<Tab>("todos");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [status, setStatus] = useState("todos");
  const [account, setAccount] = useState("todos");
  const [category, setCategory] = useState("todos");

  const accountName = useMemo(() => Object.fromEntries(accounts.map((a) => [a.id, a.name])), [accounts]);
  const categories = useMemo(() => [...new Set(transactions.map((t) => t.category))].sort(), [transactions]);
  const activeFilters = [status !== "todos", account !== "todos", category !== "todos"].filter(Boolean).length;

  const filtered = useMemo(
    () =>
      transactions.filter((tx) => {
        if (tab !== "todos" && tx.type !== tab) return false;
        if (category !== "todos" && tx.category !== category) return false;
        if (status !== "todos" && tx.status !== status) return false;
        if (account !== "todos" && tx.account_id !== account) return false;
        if (search && !tx.name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      }),
    [transactions, tab, category, status, account, search],
  );

  const groups = useMemo(() => {
    const byDay: Record<string, TransactionRow[]> = {};
    for (const tx of filtered) (byDay[tx.date] ??= []).push(tx);
    for (const day of Object.values(byDay)) {
      day.sort((a, b) => (b.time || "00:00").localeCompare(a.time || "00:00") || (b.created_at ?? "").localeCompare(a.created_at ?? ""));
    }
    const list = Object.entries(byDay);
    // no mês atual, "hoje" sempre aparece, mesmo vazio
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    if (selectedMonth === now.getMonth() && selectedYear === now.getFullYear() && !byDay[today]) list.push([today, []]);
    return list.sort(([a], [b]) => b.localeCompare(a));
  }, [filtered, selectedMonth, selectedYear]);

  const dayNet = (txs: TransactionRow[]) =>
    txs.filter((t) => t.status === "pago").reduce((s, t) => s + (t.type === "receita" ? t.amount : -t.amount), 0);

  const open = (tx: TransactionRow) => {
    if (tx.id.startsWith("initial-balance-")) return toast.info("Esse item mostra quando a conta foi criada com saldo inicial.");
    if (tx.id.startsWith("fatura-") && tx.credit_card_id) return router.push({ pathname: "/fatura/[cardId]", params: { cardId: tx.credit_card_id, month: String(selectedMonth), year: String(selectedYear) } });
    router.push({ pathname: "/transacao/[id]", params: { id: tx.id } });
  };

  const edit = (tx: TransactionRow) => {
    if (tx.id.startsWith("initial-balance-")) return toast.info("Esse item mostra quando a conta foi criada com saldo inicial.");
    if (tx.id.startsWith("fatura-")) return open(tx);
    router.push({ pathname: "/nova", params: { edit: tx.id } });
  };

  const remove = async (id: string) => {
    if (id.startsWith("initial-balance-")) return toast.info("O saldo inicial é apenas um registro visual da criação da conta.");
    if (id.startsWith("fatura-")) return toast.info("Para mexer numa fatura, abra-a.");
    const tx = transactions.find((t) => t.id === id);
    // contas fixas têm escolha (só este mês ou todos): ficam no detalhe
    if (tx?.recurrence_type === "fixa") return router.push({ pathname: "/transacao/[id]", params: { id } });
    try {
      await deleteTransaction(id);
      toast.success("Transação removida");
      reload();
    } catch {
      toast.error("Erro ao remover");
    }
  };

  const clearFilters = () => {
    setStatus("todos");
    setAccount("todos");
    setCategory("todos");
    setSearch("");
  };

  return (
    <Screen tabBar onRefresh={reload} refreshing={false}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingTop: 4 }}>
        <Text display weight="extrabold" size={28} style={{ letterSpacing: -0.5 }}>Transações</Text>
        <MonthPicker month={selectedMonth} year={selectedYear} onChange={setMonth} />
      </View>

      <View style={{ marginTop: 16, gap: 12 }}>
        <TransactionsSummary saldoAtual={finance.saldoAtual} saldoPrevisto={finance.saldoPrevisto} receitas={finance.receitas} despesas={finance.despesas} />

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Segmented options={TABS} value={tab} onChange={setTab} />
          </View>
          <Pressable onPress={() => setShowFilters((v) => !v)} accessibilityLabel="Filtros">
            {activeFilters > 0 || showFilters ? (
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}>
                <SlidersHorizontal size={16} color={colors.black} />
              </View>
            ) : (
              <Glass radius={22} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
                <SlidersHorizontal size={16} color={white(0.82)} />
              </Glass>
            )}
            {activeFilters > 0 && !showFilters && (
              <View style={{ position: "absolute", right: -2, top: -2, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4, backgroundColor: colors.green, alignItems: "center", justifyContent: "center" }}>
                <Text size={9} weight="bold" color={colors.black}>{activeFilters}</Text>
              </View>
            )}
          </Pressable>
        </View>

        <Glass radius={22} style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, height: 44 }}>
          <Search size={16} color={white(0.5)} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar transação..."
            placeholderTextColor={white(0.45)}
            selectionColor="#fff"
            style={{ flex: 1, marginLeft: 10, color: "#fff", fontSize: 14, fontFamily: fonts.regular, padding: 0 }}
          />
          {!!search && (
            <Pressable onPress={() => setSearch("")} hitSlop={10}>
              <X size={16} color={white(0.56)} />
            </Pressable>
          )}
        </Glass>

        {showFilters && (
          <Glass radius={22} style={{ padding: 16, gap: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text weight="semibold" size={15}>Filtros</Text>
              {activeFilters > 0 && (
                <Pressable onPress={clearFilters}>
                  <Text size={13} color={white(0.74)}>Limpar</Text>
                </Pressable>
              )}
            </View>
            <View>
              <Text size={12} color={white(0.62)} style={{ marginBottom: 8 }}>Status</Text>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {[["todos", "Todos"], ["pago", "Pago"], ["pendente", "Pendente"]].map(([key, label]) => (
                  <Chip key={key} label={label} on={status === key} onPress={() => setStatus(key)} />
                ))}
              </View>
            </View>
            {accounts.length > 0 && (
              <View>
                <Text size={12} color={white(0.62)} style={{ marginBottom: 8 }}>Conta</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  <Chip label="Todas" on={account === "todos"} onPress={() => setAccount("todos")} />
                  {accounts.map((a) => <Chip key={a.id} label={a.name} on={account === a.id} onPress={() => setAccount(a.id)} />)}
                </View>
              </View>
            )}
            {categories.length > 0 && (
              <View>
                <Text size={12} color={white(0.62)} style={{ marginBottom: 8 }}>Categoria</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  <Chip label="Todas" on={category === "todos"} onPress={() => setCategory("todos")} />
                  {categories.map((c) => <Chip key={c} label={c} on={category === c} onPress={() => setCategory(c)} />)}
                </View>
              </View>
            )}
          </Glass>
        )}
      </View>

      {loading && filtered.length === 0 ? (
        <Text size={14} color={white(0.66)} align="center" style={{ paddingVertical: 64 }}>Carregando...</Text>
      ) : error && filtered.length === 0 ? (
        <Glass radius={22} style={{ marginTop: 20, padding: 32, alignItems: "center" }}>
          <Text size={14} color={white(0.66)} align="center">Não foi possível carregar as transações.</Text>
          <Pressable onPress={reload} style={{ marginTop: 8 }}><Text size={13} weight="semibold" style={{ textDecorationLine: "underline" }}>Tentar de novo</Text></Pressable>
        </Glass>
      ) : filtered.length === 0 && groups.length === 0 ? (
        <Glass radius={22} style={{ marginTop: 20, padding: 32, alignItems: "center" }}>
          <Layers size={24} color={white(0.38)} />
          <Text size={14} color={white(0.66)} style={{ marginTop: 8 }}>Nenhuma transação encontrada</Text>
          {activeFilters > 0 && (
            <Pressable onPress={clearFilters} style={{ marginTop: 8 }}><Text size={13} style={{ textDecorationLine: "underline" }}>Limpar filtros</Text></Pressable>
          )}
        </Glass>
      ) : (
        <View style={{ marginTop: 20 }}>
          {groups.map(([date, txs], gi) => {
            const { label, isToday } = dateHeader(date);
            const net = dayNet(txs);
            return (
              <View key={date} style={{ marginTop: gi > 0 ? 20 : 0 }}>
                <View style={{ marginBottom: 8, paddingHorizontal: 4, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text size={13} weight="semibold" color={isToday ? "#fff" : white(0.66)}>{isToday ? `Hoje, ${label}` : label}</Text>
                  {txs.length > 0 && net !== 0 && (
                    <Text size={12} tabular color={net > 0 ? colors.green : white(0.62)}>{net > 0 ? "+" : "−"}{fmt(Math.abs(net))}</Text>
                  )}
                </View>

                {txs.length === 0 ? (
                  <View style={{ borderRadius: 22, borderWidth: 1, borderStyle: "dashed", borderColor: white(0.12), paddingVertical: 16, alignItems: "center" }}>
                    <Text size={13} color={white(0.5)}>Nada registrado hoje</Text>
                  </View>
                ) : (
                  <Glass radius={22}>
                    {txs.map((tx, i) => (
                      <View key={tx.id} style={i > 0 ? { borderTopWidth: 1, borderTopColor: white(0.06) } : undefined}>
                        <TransactionListItem
                          tx={tx}
                          accountName={tx.account_id ? accountName[tx.account_id] || "Conta" : tx.payment_method === "cartao" ? "Cartão" : "Sem conta"}
                          customCategories={customCategories}
                          creditCards={creditCards}
                          onPress={open}
                          onEdit={edit}
                          onDelete={remove}
                        />
                      </View>
                    ))}
                  </Glass>
                )}
              </View>
            );
          })}
        </View>
      )}

      {!loading && filtered.length > 0 && (
        <Text size={12} color={white(0.45)} align="center" style={{ paddingTop: 16 }}>
          {filtered.length} transaç{filtered.length === 1 ? "ão" : "ões"} · {groups.length} dia{groups.length !== 1 ? "s" : ""}
        </Text>
      )}
    </Screen>
  );
}
