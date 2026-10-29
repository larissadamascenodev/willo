import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { removeInitialBalance } from "@/services/transactionService";
import { loadMonthTransactions, type AccountRow, type TransactionRow as Row } from "@/services/monthTransactions";
import { useMonth } from "@/contexts/MonthContext";
import MonthStrip from "~/components/MonthStrip";
import type { CustomCategory } from "@/services/categoryService";
import { useFinanceData } from "@/hooks/useFinanceData";
import Room from "~/components/Room";
import ConfirmGlass from "~/components/ConfirmGlass";
import { showToast } from "~/lib/toast";
import AnchoredMenu, { MenuHeader, MenuRow, type AnchorRect } from "~/components/AnchoredMenu";
import TransactionRow from "~/components/transactions/TransactionRow";
import TransactionsSummary, { TransactionTabs } from "~/components/transactions/TransactionsSummary";
import TransactionSheet, { removeTransaction } from "~/components/transactions/TransactionSheet";
import { Pencil, Search, Trash2 } from "~/components/icons";
import { money } from "~/lib/money";
import { useAuth } from "~/lib/auth";
import { useNavChrome } from "~/lib/navChrome";
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
 *
 * A tap opens the movement — or, for an invoice line, the invoice. Holding a row is
 * the short way round to editing or deleting it.
 */

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

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
  const router = useRouter();
  const { user } = useAuth();
  const { report } = useNavChrome();
  const today = useMemo(() => new Date(), []);

  /* The month is the app's, not this screen's: chosen here, it is the month the
     dashboard and the analysis screens read too, as on the web. */
  const { selectedMonth: month, selectedYear: year, setMonth } = useMonth();
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
  const [removing, setRemoving] = useState(false);
  const [holdError, setHoldError] = useState<string | null>(null);
  const [detail, setDetail] = useState<Row | null>(null);

  /* The same form it was made with, filled in. */
  const edit = (tx: Row) => router.push({ pathname: "/novo", params: { editar: tx.id } } as never);

  /* Only real movements open or hold: an invoice line opens its invoice, and an
     opening balance is a record of when the account was created. */
  const isOpening = (tx: Row) => tx.id.startsWith("initial-balance-");
  const isReal = (tx: Row) => !tx.id.startsWith("fatura-") && !isOpening(tx);

  /* An opening balance goes like any other income: asked once, then gone from the
     month and from the account's balance. */
  const [opening, setOpening] = useState<Row | null>(null);
  const [removingOpening, setRemovingOpening] = useState(false);
  const removeOpening = async () => {
    if (!opening?.account_id || removingOpening) return;
    setRemovingOpening(true);
    try {
      await removeInitialBalance(opening.account_id);
      window.dispatchEvent(new CustomEvent("transaction-created"));
      setOpening(null);
      showToast("Saldo inicial excluído");
      void load();
    } catch {
      showToast("Não foi possível excluir. Tente de novo.");
    } finally {
      setRemovingOpening(false);
    }
  };

  const removeHeld = async (scope: "month" | "all") => {
    if (!held || removing) return;
    setRemoving(true);
    setHoldError(null);
    try {
      await removeTransaction(held, scope, { month, year, userId: user?.id });
      window.dispatchEvent(new CustomEvent("transaction-created"));
      setHeld(null);
      void load();
    } catch {
      setHoldError("Não foi possível excluir. Tente de novo.");
    } finally {
      setRemoving(false);
    }
  };

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
        onScroll={(e) => report(e.nativeEvent.contentOffset.y)}
        scrollEventThrottle={32}
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
          <MonthStrip month={month} year={year} onChange={setMonth} />
        </View>

        <Animated.View entering={FadeInDown.duration(400)} style={{ marginTop: 18 }}>
          <TransactionsSummary
            saldoAtual={finance.saldoAtual}
            saldoPrevisto={finance.saldoPrevisto}
            receitas={finance.receitas}
            despesas={finance.despesas}
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(70).duration(400)} style={{ marginTop: 22 }}>
          <TransactionTabs value={tab} onChange={setTab} />
        </Animated.View>

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

            {days.map(([date, rows], i) => {
              const { label, isToday } = formatDateHeader(date, today);
              const net = rows.reduce(
                (sum, t) => sum + (t.type === "receita" ? Number(t.amount) : -Number(t.amount)),
                0,
              );
              return (
                <Animated.View key={date} entering={FadeInDown.delay(120 + i * 45).duration(380)}>
                  <DayHeader label={isToday ? `Hoje · ${label}` : label} today={isToday} net={net} />
                  {rows.map((tx) => (
                    <TransactionRow
                      key={tx.id}
                      tx={tx}
                      accountName={tx.account_id ? accountName[tx.account_id] : undefined}
                      customCategories={customCategories}
                      creditCards={creditCards}
                      onPress={() => {
                        if (tx.id.startsWith("fatura-") && tx.credit_card_id) {
                          router.push(`/fatura/${tx.credit_card_id}` as never);
                          return;
                        }
                        if (isOpening(tx)) {
                          setOpening(tx);
                          return;
                        }
                        if (isReal(tx)) setDetail(tx);
                      }}
                      onHold={
                        isOpening(tx)
                          ? () => setOpening(tx)
                          : isReal(tx)
                          ? (rect) => {
                              setHeld(tx);
                              setHeldRect(rect);
                              setAsking(false);
                              setHoldError(null);
                            }
                          : undefined
                      }
                    />
                  ))}
                </Animated.View>
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
          <View style={{ padding: 12, gap: 8 }}>
            <Text style={{ paddingHorizontal: 4, paddingBottom: 4, fontSize: 12.5, lineHeight: 17, color: "rgba(255,255,255,0.78)" }}>
              {held?.recurrence_type === "fixa"
                ? "Ela se repete todo mês. Tirar só deste mês ou dela em diante?"
                : (held?.installments ?? 0) > 1
                  ? "Isso remove a compra inteira, com todas as parcelas."
                  : "Isso não pode ser desfeito."}
            </Text>
            {held?.recurrence_type === "fixa" && (
              <HoldButton label="Só deste mês" onPress={() => void removeHeld("month")} disabled={removing} />
            )}
            <HoldButton
              label={held?.recurrence_type === "fixa" ? "Deste mês em diante" : "Excluir"}
              danger
              loading={removing}
              onPress={() => void removeHeld("all")}
            />
            <HoldButton label="Cancelar" onPress={() => setAsking(false)} disabled={removing} />
            {holdError && <Text style={{ paddingHorizontal: 4, fontSize: 12.5, color: RED }}>{holdError}</Text>}
          </View>
        ) : (
          <>
            <MenuRow
              icon={Pencil}
              label="Editar"
              onPress={() => {
                const tx = held;
                setHeld(null);
                if (tx) edit(tx);
              }}
            />
            <MenuRow icon={Trash2} label="Excluir" danger last onPress={() => setAsking(true)} />
          </>
        )}
      </AnchoredMenu>

      <ConfirmGlass
        open={!!opening}
        title="Excluir saldo inicial?"
        confirmLabel="Excluir"
        busy={removingOpening}
        onConfirm={() => void removeOpening()}
        onClose={() => setOpening(null)}
      >
        {opening
          ? `Os ${money(Number(opening.amount))} que entraram em ${opening.observation?.replace("Saldo inicial da conta ", "") ?? "essa conta"} deixam de contar no saldo dela.`
          : ""}
      </ConfirmGlass>

      <TransactionSheet
        tx={detail}
        accountName={
          detail?.account_id
            ? (accountName[detail.account_id] ?? "Conta")
            : detail?.payment_method === "cartao"
              ? "Cartão"
              : "Sem conta"
        }
        customCategories={customCategories}
        userId={user?.id}
        month={month}
        year={year}
        onClose={() => setDetail(null)}
        onEdit={(tx) => {
          setDetail(null);
          edit(tx);
        }}
        onChanged={() => void load()}
      />
    </Room>
  );
}

/** One of the hold menu's answers. */
function HoldButton({
  label,
  danger,
  loading,
  disabled,
  onPress,
}: {
  label: string;
  danger?: boolean;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => ({
        height: 44,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: danger ? RED : "rgba(255,255,255,0.07)",
        opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
      })}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={{ fontSize: 14.5, fontWeight: danger ? "700" : "600", color: "#fff" }}>{label}</Text>
      )}
    </Pressable>
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
