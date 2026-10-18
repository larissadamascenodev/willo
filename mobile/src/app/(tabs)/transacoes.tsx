import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { loadMonthTransactions, type AccountRow, type TransactionRow as Row } from "@/services/monthTransactions";
import type { CustomCategory } from "@/services/categoryService";
import { useFinanceData } from "@/hooks/useFinanceData";
import Room from "~/components/Room";
import AnchoredMenu, { MenuHeader, MenuRow, type AnchorRect } from "~/components/AnchoredMenu";
import TransactionRow from "~/components/transactions/TransactionRow";
import TransactionsSummary, { TransactionTabs } from "~/components/transactions/TransactionsSummary";
import { Pencil, Search, Trash2 } from "~/components/icons";
import { money } from "~/lib/money";
import { useAuth } from "~/lib/auth";
import { GREEN, INK, RED } from "~/theme/tokens";
import { type as T } from "~/theme/type";

/**
 * The month's movements.
 *
 * Carried over whole: the balance loose at the top with the two flows on one scale
 * under it, the three tabs, the search, and the days written out with their own
 * running total. The rows sit on the page rather than inside a card, which is how
 * this screen was rebuilt on the web and why the ground here is the dimmed one.
 *
 * The list itself is assembled by the shared service, so a fixed entry appears in
 * the month it belongs to and a card's purchases arrive as one invoice line, exactly
 * as they do in the browser.
 */

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MONTHS_TAB = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const formatDateHeader = (dateStr: string, today = new Date()) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return {
    label: `${WEEKDAYS[date.getDay()]}, ${d} de ${MONTHS_SHORT[date.getMonth()]}`,
    isToday: date.toDateString() === today.toDateString(),
  };
};

export default function Transacoes() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const today = useMemo(() => new Date(), []);

  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [tab, setTab] = useState<"todos" | "receita" | "despesa">("todos");
  const [search, setSearch] = useState("");

  const [transactions, setTransactions] = useState<Row[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [creditCards, setCreditCards] = useState<any[]>([]);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [held, setHeld] = useState<Row | null>(null);
  const [heldRect, setHeldRect] = useState<AnchorRect | null>(null);
  const [asking, setAsking] = useState(false);

  const { data: finance } = useFinanceData(month, year);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const m = await loadMonthTransactions(month, year);
      setTransactions(m.transactions);
      setAccounts(m.accounts);
      setCreditCards(m.creditCards);
      setCustomCategories(m.customCategories);
    } catch {
      /* the empty state says it better than a toast would */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, month, year]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onChange = () => void load();
    window.addEventListener("finance-data-changed", onChange);
    window.addEventListener("transaction-created", onChange);
    return () => {
      window.removeEventListener("finance-data-changed", onChange);
      window.removeEventListener("transaction-created", onChange);
    };
  }, [load]);

  const accountName = useMemo(() => {
    const map: Record<string, string> = {};
    for (const a of accounts) map[a.id] = a.name;
    return map;
  }, [accounts]);

  const filtered = useMemo(
    () =>
      transactions.filter((tx) => {
        if (tab !== "todos" && tx.type !== tab) return false;
        if (search && !tx.name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      }),
    [transactions, tab, search],
  );

  /* Grouped by day, newest first, each day carrying what it did to the balance. */
  const days = useMemo(() => {
    const groups: Record<string, Row[]> = {};
    for (const tx of filtered) (groups[tx.date] ??= []).push(tx);
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const isThisMonth = month === today.getMonth() && year === today.getFullYear();

  return (
    <Room>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: 120,
          paddingHorizontal: 16,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={INK.softer}
          />
        }
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <Text style={T.title}>Transações</Text>
          <View style={{ flexDirection: "row", gap: 4 }}>
            {[-1, 0, 1].map((offset) => {
              const d = new Date(today.getFullYear(), today.getMonth() + offset, 1);
              const on = d.getMonth() === month && d.getFullYear() === year;
              return (
                <Text
                  key={offset}
                  onPress={() => {
                    setMonth(d.getMonth());
                    setYear(d.getFullYear());
                  }}
                  style={{
                    paddingHorizontal: 11,
                    paddingVertical: 6,
                    borderRadius: 999,
                    fontSize: 12.5,
                    fontWeight: "600",
                    overflow: "hidden",
                    backgroundColor: on ? "#fff" : "transparent",
                    color: on ? "#0B0B0B" : INK.softer,
                  }}
                >
                  {MONTHS_TAB[d.getMonth()]}
                </Text>
              );
            })}
          </View>
        </View>

        <View style={{ marginTop: 18 }}>
          <TransactionsSummary
            saldoAtual={finance.saldoAtual}
            saldoPrevisto={finance.saldoPrevisto}
            receitas={finance.receitas}
            despesas={finance.despesas}
          />
        </View>

        <View style={{ marginTop: 22 }}>
          <TransactionTabs value={tab} onChange={setTab} />
        </View>

        <View
          style={{
            marginTop: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            height: 44,
            borderRadius: 999,
            paddingHorizontal: 16,
            backgroundColor: "rgba(255,255,255,0.05)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.06)",
          }}
        >
          <Search size={15} color={INK.softer} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar transação..."
            placeholderTextColor={INK.faint}
            style={{ flex: 1, fontSize: 14.5, color: "#fff" }}
          />
        </View>

        {loading && transactions.length === 0 ? (
          <ActivityIndicator color={GREEN} style={{ marginTop: 40 }} />
        ) : (
          <View style={{ marginTop: 22, gap: 18 }}>
            {isThisMonth && !days.some(([date]) => date === todayKey) && (
              <View>
                <DayHeader label={`Hoje · ${formatDateHeader(todayKey).label}`} today />
                <Text style={{ paddingVertical: 20, textAlign: "center", fontSize: 13.5, color: INK.softer }}>
                  Nada registrado hoje
                </Text>
              </View>
            )}

            {days.map(([date, rows]) => {
              const { label, isToday } = formatDateHeader(date, today);
              const net = rows.reduce(
                (sum, t) => sum + (t.type === "receita" ? Number(t.amount) : -Number(t.amount)),
                0,
              );
              return (
                <View key={date}>
                  <DayHeader label={isToday ? `Hoje · ${label}` : label} today={isToday} net={net} />
                  {rows.map((tx) => (
                    <TransactionRow
                      key={tx.id}
                      tx={tx}
                      accountName={tx.account_id ? accountName[tx.account_id] : undefined}
                      customCategories={customCategories}
                      creditCards={creditCards}
                      onHold={(rect) => {
                        setHeld(tx);
                        setHeldRect(rect);
                        setAsking(false);
                      }}
                    />
                  ))}
                </View>
              );
            })}

            {days.length === 0 && !loading && (
              <Text style={{ marginTop: 30, textAlign: "center", fontSize: 14, color: INK.softer }}>
                {user ? "Nada encontrado neste mês." : "Entre na sua conta para ver os seus lançamentos."}
              </Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* Holding a row is the short way round: both answers act at once. */}
      <AnchoredMenu open={!!held} anchor={heldRect} onClose={() => setHeld(null)}>
        <MenuHeader
          title={held?.name ?? ""}
          subtitle={asking ? "Excluir este lançamento?" : held?.category}
        />
        {asking ? (
          <View style={{ padding: 12 }}>
            <Text style={{ paddingHorizontal: 4, paddingBottom: 12, fontSize: 12.5, lineHeight: 17, color: "rgba(255,255,255,0.78)" }}>
              {(held?.installments ?? 0) > 1
                ? "Isso remove a compra inteira, com todas as parcelas."
                : "Isso não pode ser desfeito."}
            </Text>
            <Text
              onPress={() => setHeld(null)}
              style={{
                height: 44,
                lineHeight: 44,
                textAlign: "center",
                borderRadius: 14,
                overflow: "hidden",
                backgroundColor: RED,
                color: "#fff",
                fontSize: 14.5,
                fontWeight: "700",
              }}
            >
              Excluir
            </Text>
            <Text
              onPress={() => setAsking(false)}
              style={{
                marginTop: 8,
                height: 44,
                lineHeight: 44,
                textAlign: "center",
                borderRadius: 14,
                overflow: "hidden",
                backgroundColor: "rgba(255,255,255,0.07)",
                color: "#fff",
                fontSize: 14.5,
                fontWeight: "600",
              }}
            >
              Cancelar
            </Text>
          </View>
        ) : (
          <>
            <MenuRow icon={Pencil} label="Editar" onPress={() => setHeld(null)} />
            <MenuRow icon={Trash2} label="Excluir" danger last onPress={() => setAsking(true)} />
          </>
        )}
      </AnchoredMenu>
    </Room>
  );
}

/** A day, with what it did to the balance. */
function DayHeader({ label, today, net }: { label: string; today?: boolean; net?: number }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 12,
        paddingHorizontal: 4,
        marginBottom: 4,
      }}
    >
      <Text
        style={{
          fontSize: 10.5,
          fontWeight: "600",
          letterSpacing: 1.4,
          textTransform: "uppercase",
          color: today ? "#fff" : INK.softer,
        }}
      >
        {label}
      </Text>
      {net !== undefined && (
        <Text style={{ fontSize: 12, fontWeight: "600", color: net >= 0 ? GREEN : INK.softer }}>
          {net >= 0 ? "+" : "−"}
          {money(Math.abs(net))}
        </Text>
      )}
    </View>
  );
}
