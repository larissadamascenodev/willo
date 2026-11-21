import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { removeInitialBalance } from "@/services/transactionService";
import { loadMonthTransactions, type AccountRow, type TransactionRow as Row } from "@/services/monthTransactions";
import MonthSelect from "~/components/transactions/MonthSelect";
import RaisedButton from "~/components/RaisedButton";
import type { CustomCategory } from "@/services/categoryService";
import { useFinanceData } from "@/hooks/useFinanceData";
import Room from "~/components/Room";
import SwipeHome from "~/components/SwipeHome";
import ConfirmGlass from "~/components/ConfirmGlass";
import { showToast } from "~/lib/toast";
import { behind, listenOptimistic, overlay, showNow, type OptimisticChange } from "~/lib/optimistic";
import AnchoredMenu, { MenuHeader, MenuRow, type AnchorRect } from "~/components/AnchoredMenu";
import TransactionRow from "~/components/transactions/TransactionRow";
import { bankOf, banksById } from "~/components/transactions/WithBank";
import { TransactionTabs, type TxTab } from "~/components/transactions/TransactionsSummary";
import MonthFlows from "~/components/transactions/MonthFlows";
import { useHiddenValues } from "@/hooks/useHiddenValues";
import TransactionSheet, { removeTransaction } from "~/components/transactions/TransactionSheet";
import { CalendarClock, CheckCheck, ChevronLeft, Clock, Pencil, Search, SlidersHorizontal, Trash2, X } from "~/components/icons";
import { money } from "~/lib/money";
import { useAuth } from "~/lib/auth";
import { useNavChrome } from "~/lib/navChrome";
import { GREEN, INK, RED } from "~/theme/tokens";

import { th, useThemeRedraw } from "~/theme/theme";
/**
 * The month's movements.
 *
 * On top, the screen's name centred, the month as a small pill of glass in the corner. Then what
 * came in, what went out and what is still pending (MonthFlows), loose on the page with lit
 * bars — no balance and no forecast, this screen is the movements. Then three tabs (Todas,
 * Receitas, Despesas) with a filter beside them for the rest (Pendentes, Agendadas, Pagas),
 * the search, and the list: what is scheduled ahead first, soonest first, then the days that
 * have happened, newest first — Hoje, Ontem, the week's days by name — each with what it did
 * to the balance. The rows sit on the page rather than inside a card.
 *
 * The month chosen here is this screen's own: leaving it on a month ahead does not move any
 * other screen, and the screen opens on the current month.
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

type Only = "pendente" | "agendada" | "paga" | null;
const ONLY_LABEL: Record<Exclude<Only, null>, string> = { pendente: "Pendentes", agendada: "Agendadas", paga: "Pagas e recebidas" };

const WEEKDAYS_LONG = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

/** A day as a person says it: Hoje, Ontem, Amanhã, the week's days by name, else the date. */
const formatDateHeader = (dateStr: string, today = new Date()) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const n = Math.round((date.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000);
  const full = `${WEEKDAYS[date.getDay()]}, ${d} de ${MONTHS_SHORT[date.getMonth()]}`;
  const label = n === 0 ? "Hoje" : n === -1 ? "Ontem" : n === 1 ? "Amanhã" : n < 0 && n > -7 ? WEEKDAYS_LONG[date.getDay()] : full;
  return { label, full, isToday: n === 0 };
};

export default function Transacoes() {
  /* Drawn again in place when the theme changes. */
  useThemeRedraw();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { report } = useNavChrome();
  const goHome = useCallback(() => router.navigate("/" as never), [router]);
  const today = useMemo(() => new Date(), []);

  /* The month is this screen's own: it opens on the current one, and one chosen here moves
     nothing else in the app. */
  const [{ month, year }, setShown] = useState(() => ({ month: today.getMonth(), year: today.getFullYear() }));
  const setMonth = useCallback((m: number, y: number) => setShown({ month: m, year: y }), []);
  const hidden = useHiddenValues();
  const [tab, setTab] = useState<TxTab>("todos");
  /* The filter beside the tabs: what is still pending, what is scheduled ahead, what is paid. */
  const [only, setOnly] = useState<Only>(null);
  const [filterAt, setFilterAt] = useState<AnchorRect | null>(null);
  const filterRef = useRef<ComponentRef<typeof View>>(null);
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

  /* Arriving to open one transaction (from a notification's Ver conta): its month is
     put on screen, and once that month has loaded its sheet opens — where it can be
     marked as paid. The request is then dropped, so coming back does not reopen it. */
  const params = useLocalSearchParams<{ abrir?: string; mes?: string; ano?: string }>();
  useEffect(() => {
    if (!params.abrir) return;
    const m = Number(params.mes);
    const y = Number(params.ano);
    if (Number.isFinite(m) && Number.isFinite(y) && (m !== month || y !== year)) setMonth(m, y);
  }, [params.abrir, params.mes, params.ano, month, year, setMonth]);
  useEffect(() => {
    if (!params.abrir || loading) return;
    const tx = transactions.find((t) => t.id === params.abrir);
    if (!tx) return;
    setDetail(tx);
    router.setParams({ abrir: undefined, mes: undefined, ano: undefined } as never);
  }, [params.abrir, transactions, loading, router]);

  /* The check it was made with, filled in — for a recurring one, in the month on screen. */
  const edit = (tx: Row) => router.push({ pathname: "/manual", params: { editar: tx.id, mes: String(month), ano: String(year) } } as never);

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

  /* Gone from the list at once; the database catches up behind. */
  const removeHeld = (scope: "month" | "all") => {
    if (!held) return;
    const tx = held;
    setHoldError(null);
    setHeld(null);
    showNow({ id: tx.id, removed: true });
    showToast(`“${tx.name}” excluído`);
    void behind(
      tx.id,
      () => removeTransaction(tx, scope, { month, year, userId: user?.id }),
      () => showToast("Não foi possível excluir. Tente de novo."),
    );
  };

  const { data: finance } = useFinanceData(month, year);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      /* What is on a card lives on the card; its invoice's line here carries it. */
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

  /* Changes already shown, while the database is still writing them. */
  const [changes, setChanges] = useState<Map<string, OptimisticChange>>(new Map());
  useEffect(
    () =>
      listenOptimistic(
        (c) => setChanges((prev) => new Map(prev).set(c.id, c)),
        (id) => {
          window.dispatchEvent(new CustomEvent("transaction-created"));
          void load().then(() =>
            setChanges((prev) => {
              const next = new Map(prev);
              next.delete(id);
              return next;
            }),
          );
        },
      ),
    [load],
  );
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const shownRows = useMemo(() => overlay(transactions, changes, (d) => d.startsWith(monthPrefix)), [transactions, changes, monthPrefix]);

  const accountName = useMemo(() => {
    const map: Record<string, string> = {};
    for (const a of accounts) map[a.id] = a.name;
    return map;
  }, [accounts]);
  const banks = useMemo(() => banksById(accounts, creditCards), [accounts, creditCards]);

  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const filtered = useMemo(
    () =>
      shownRows.filter((tx) => {
        if (tab !== "todos" && tx.type !== tab) return false;
        if (only === "pendente" && tx.status === "pago") return false;
        if (only === "agendada" && (tx.status === "pago" || tx.date <= todayKey)) return false;
        if (only === "paga" && tx.status !== "pago") return false;
        if (search && !tx.name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      }),
    [shownRows, tab, only, search, todayKey],
  );

  /* What is scheduled ahead (a day still to come), soonest first, apart from the rest. */
  const ahead = useMemo(() => filtered.filter((tx) => tx.date > todayKey).sort((a, b) => a.date.localeCompare(b.date)), [filtered, todayKey]);

  /* The rest grouped by day, newest first, each day carrying what it did to the balance — and
     within a day by the hour it was written down, the latest on top. */
  const days = useMemo(() => {
    const groups: Record<string, Row[]> = {};
    for (const tx of filtered) if (tx.date <= todayKey) (groups[tx.date] ??= []).push(tx);
    for (const rows of Object.values(groups)) rows.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered, todayKey]);

  const rowOf = (tx: Row) => (
    <TransactionRow
      key={tx.id}
      tx={tx}
      accountName={tx.account_id ? accountName[tx.account_id] : undefined}
      bank={bankOf(tx, banks)}
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
  );
  const isThisMonth = month === today.getMonth() && year === today.getFullYear();

  return (
    <Room>
      {/* Pulled from the left edge, back to the start. */}
      <SwipeHome from="left" onLeave={goHome}>
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
            tintColor={th(INK.softer)}
          />
        }
      >
        {/* The top row: back to the start, and the month in full in the corner (no name). */}
        <View style={{ height: 50, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <RaisedButton label="Voltar" onPress={goHome} size={50}>
            <ChevronLeft size={24} color={th("#fff")} strokeWidth={2.4} />
          </RaisedButton>
          <MonthSelect month={month} year={year} onChange={setMonth} />
        </View>
        <Animated.View entering={FadeInDown.duration(400)} style={{ marginTop: 14 }}>
          <MonthFlows receitas={finance.receitas} recebido={finance.receitasRecebidas} despesas={finance.despesas} pago={finance.despesasPagas} hidden={hidden} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(70).duration(400)} style={{ marginTop: 20, flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <TransactionTabs value={tab} onChange={setTab} />
          </View>
          <View ref={filterRef} collapsable={false}>
            <RaisedButton
              label={only ? `Filtro: ${ONLY_LABEL[only]}` : "Mais filtros"}
              size={44}
              onPress={() =>
                filterRef.current?.measureInWindow((x, y, w, h) => setFilterAt({ top: y, bottom: y + h, left: x, width: w }))
              }
            >
              <SlidersHorizontal size={19} color={th(only ? GREEN : "#fff")} strokeWidth={2.2} />
            </RaisedButton>
          </View>
        </Animated.View>
        {only && (
          <Pressable
            onPress={() => setOnly(null)}
            accessibilityRole="button"
            accessibilityLabel={`Tirar o filtro ${ONLY_LABEL[only]}`}
            style={({ pressed }) => ({ marginTop: 10, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, height: 30, paddingHorizontal: 12, borderRadius: 15, backgroundColor: th("rgba(103,205,103,0.16)", "bg"), opacity: pressed ? 0.6 : 1 })}
          >
            <Text style={{ fontSize: 13, fontWeight: "700", color: th(GREEN) }}>{ONLY_LABEL[only]}</Text>
            <X size={13} color={th(GREEN)} strokeWidth={2.6} />
          </Pressable>
        )}

        <View
          style={{
            marginTop: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            height: 44,
            borderRadius: 999,
            paddingHorizontal: 16,
            backgroundColor: th("rgba(255,255,255,0.05)", "bg"),
            borderWidth: 1,
            borderColor: th("rgba(255,255,255,0.06)", "line"),
          }}
        >
          <Search size={15} color={th(INK.softer)} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar transação..."
            placeholderTextColor={th(INK.faint)}
            style={{ flex: 1, fontSize: 14.5, color: th("#fff") }}
          />
        </View>

        {loading && transactions.length === 0 ? (
          <ActivityIndicator color={th(GREEN)} style={{ marginTop: 40 }} />
        ) : (
          <View style={{ marginTop: 22, gap: 18 }}>
            {/* Scheduled ahead: not done yet, so apart, soonest first. */}
            {ahead.length > 0 && (
              <Animated.View entering={FadeInDown.delay(100).duration(380)}>
                <DayHeader label="Agendadas" note={`${ahead.length} ${ahead.length === 1 ? "lançamento" : "lançamentos"}`} />
                {ahead.map(rowOf)}
              </Animated.View>
            )}

            {isThisMonth && !days.some(([date]) => date === todayKey) && (
              <View>
                <DayHeader label="Hoje" today />
                <Text style={{ paddingVertical: 20, textAlign: "center", fontSize: 13.5, color: th(INK.softer) }}>
                  Nada registrado hoje
                </Text>
              </View>
            )}

            {days.map(([date, rows], i) => {
              const { label, isToday } = formatDateHeader(date, today);
              const net = rows.reduce((sum, t) => sum + (t.type === "receita" ? Number(t.amount) : -Number(t.amount)), 0);
              return (
                <Animated.View key={date} entering={FadeInDown.delay(120 + i * 45).duration(380)}>
                  <DayHeader label={label} today={isToday} net={hidden ? undefined : net} />
                  {rows.map(rowOf)}
                </Animated.View>
              );
            })}

            {days.length === 0 && ahead.length === 0 && !loading && (
              <Text style={{ marginTop: 30, textAlign: "center", fontSize: 14, color: th(INK.softer) }}>
                {user ? "Nada encontrado neste mês." : "Entre na sua conta para ver os seus lançamentos."}
              </Text>
            )}
          </View>
        )}
      </ScrollView>
      </SwipeHome>

      {/* The filter beside the tabs. */}
      <AnchoredMenu open={!!filterAt} anchor={filterAt} onClose={() => setFilterAt(null)}>
        <MenuHeader title="Mostrar só" />
        <MenuRow icon={Clock} label="Pendentes" onPress={() => { setOnly("pendente"); setFilterAt(null); }} />
        <MenuRow icon={CalendarClock} label="Agendadas" onPress={() => { setOnly("agendada"); setFilterAt(null); }} />
        <MenuRow icon={CheckCheck} label="Pagas e recebidas" last={!only} onPress={() => { setOnly("paga"); setFilterAt(null); }} />
        {only && <MenuRow icon={X} label="Tirar filtro" last onPress={() => { setOnly(null); setFilterAt(null); }} />}
      </AnchoredMenu>

      {/* Holding a row is the short way round: both answers act at once. */}
      <AnchoredMenu open={!!held} anchor={heldRect} onClose={() => setHeld(null)}>
        <MenuHeader
          title={held?.name ?? ""}
          subtitle={asking ? "Excluir este lançamento?" : held?.category}
        />
        {asking ? (
          <View style={{ padding: 12, gap: 8 }}>
            <Text style={{ paddingHorizontal: 4, paddingBottom: 4, fontSize: 12.5, lineHeight: 17, color: th("rgba(255,255,255,0.78)") }}>
              {held?.recurrence_type === "fixa"
                ? "Ela se repete todo mês. Tirar só deste mês ou dela em diante?"
                : (held?.installments ?? 0) > 1
                  ? `É a parcela ${held?.installment_current ?? 1} de ${held?.installments}. Tirar só esta ou esta e as próximas?`
                  : "Isso não pode ser desfeito."}
            </Text>
            {(held?.recurrence_type === "fixa" || (held?.installments ?? 0) > 1) && (
              <HoldButton
                label={held?.recurrence_type === "fixa" ? "Só deste mês" : "Só esta parcela"}
                onPress={() => void removeHeld("month")}
                disabled={removing}
              />
            )}
            <HoldButton
              label={held?.recurrence_type === "fixa" ? "Deste mês em diante" : (held?.installments ?? 0) > 1 ? "Esta e as próximas" : "Excluir"}
              danger
              loading={removing}
              onPress={() => void removeHeld("all")}
            />
            <HoldButton label="Cancelar" onPress={() => setAsking(false)} disabled={removing} />
            {holdError && <Text style={{ paddingHorizontal: 4, fontSize: 12.5, color: th(RED) }}>{holdError}</Text>}
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
        backgroundColor: th(danger ? RED : "rgba(255,255,255,0.07)", "bg"),
        opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
      })}
    >
      {loading ? (
        <ActivityIndicator color={th("#fff")} />
      ) : (
        <Text style={{ fontSize: 14.5, fontWeight: danger ? "700" : "600", color: th("#fff") }}>{label}</Text>
      )}
    </Pressable>
  );
}

/** A day, with what it did to the balance (or, for what is scheduled, how many). */
function DayHeader({ label, today, net, note }: { label: string; today?: boolean; net?: number; note?: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 12,
        paddingHorizontal: 4,
        marginBottom: 6,
      }}
    >
      <Text style={{ fontSize: 17, fontWeight: "700", letterSpacing: -0.3, color: th(today ? "#fff" : "rgba(255,255,255,0.92)") }}>{label}</Text>
      {note !== undefined && <Text style={{ fontSize: 12.5, fontWeight: "600", color: th(INK.softer) }}>{note}</Text>}
      {net !== undefined && (
        <Text style={{ fontSize: 12, fontWeight: "600", color: th(net >= 0 ? GREEN : INK.softer) }}>
          {net >= 0 ? "+" : "−"}
          {money(Math.abs(net))}
        </Text>
      )}
    </View>
  );
}
