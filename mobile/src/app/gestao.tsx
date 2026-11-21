import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, Pressable, Text, View, type TextStyle } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { getAccounts } from "@/services/transactionService";
import { useFinanceData } from "@/hooks/useFinanceData";
import { setHiddenValues, useHiddenValues } from "@/hooks/useHiddenValues";
import { loadMonthTransactions, type TransactionRow as Row } from "@/services/monthTransactions";
import type { CustomCategory } from "@/services/categoryService";
import { ensureWallet } from "~/lib/ensureWallet";
import { showToast } from "~/lib/toast";
import { colorFor } from "@/lib/banks";
import AccountSheet from "~/components/accounts/AccountSheet";
import TransferSheet from "~/components/accounts/TransferSheet";
import Room from "~/components/Room";
import RaisedButton from "~/components/RaisedButton";
import Surface from "~/components/Surface";
import BankMark from "~/components/BankMark";
import RecentEntries from "~/components/transactions/RecentEntries";
import { banksById, type EntryBank } from "~/components/transactions/WithBank";
import { FlexBar } from "~/components/Bar";
import { ArrowDownUp, ChevronLeft, Eye, EyeOff, Landmark, Plus } from "~/components/icons";
import { money } from "~/lib/money";
import { useAuth } from "~/lib/auth";
import { INK, RED } from "~/theme/tokens";
import { th, useThemeRedraw } from "~/theme/theme";

/**
 * Contas: where the money is.
 *
 * Drawn as every detail page is, in the app's quiet colours. What is in all the accounts, large,
 * with the eye beside its name and where the month should end under it; one bar split the way the
 * money is split, each share in its bank's colour; then a line per account — its mark, its name,
 * its share and what it holds — a touch opening it. Then the way to move money from one to
 * another and the way to add one, and the latest entries with the way to all of them.
 *
 * The caixinhas have a page of their own now, and the fixed entries live on the home's card; a
 * link that still asks for the caixinhas here is sent on to them.
 */

const nums: TextStyle = Platform.select({ ios: { fontVariant: ["tabular-nums"] }, default: {} }) as TextStyle;
const LATEST = 5;
const TYPE_LABEL: Record<string, string> = {
  checking: "Conta corrente",
  savings: "Poupança",
  cash: "Dinheiro",
  investment: "Investimento",
};

interface Account {
  id: string;
  name: string;
  type: string;
  current_balance: number;
  color: string | null;
  is_default: boolean;
}

export default function Contas() {
  useThemeRedraw();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const hidden = useHiddenValues();
  const show = (v: number) => (hidden ? "R$ •••" : money(v));

  /* The caixinhas moved to a page of their own. */
  const { ver } = useLocalSearchParams<{ ver?: string }>();
  useEffect(() => {
    if (ver === "caixinhas") router.replace("/caixinhas" as never);
  }, [ver, router]);

  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [moving, setMoving] = useState(false);
  const announce = () => window.dispatchEvent(new CustomEvent("finance-data-changed"));

  const load = useCallback(async () => {
    if (!user) {
      setAccounts([]);
      return;
    }
    try {
      const read = (await getAccounts()) as unknown as Account[];
      setAccounts(read);
      /* The wallet is made once for anyone with accounts; the change it announces brings the
         list back with it in. */
      if (await ensureWallet(user.id, read)) announce();
    } catch {
      setAccounts([]);
    }
  }, [user]);

  useEffect(() => {
    void load();
    const onChange = () => void load();
    window.addEventListener("finance-data-changed", onChange);
    return () => window.removeEventListener("finance-data-changed", onChange);
  }, [load]);

  const rows = useMemo(
    () =>
      (accounts ?? [])
        .map((a) => ({ account: a, balance: Number(a.current_balance) || 0, hex: colorFor(a.name, a.color, "#6B7280"), typeLabel: TYPE_LABEL[a.type] ?? TYPE_LABEL.checking }))
        .sort((a, b) => b.balance - a.balance),
    [accounts],
  );
  const saldo = rows.reduce((s, r) => s + r.balance, 0);
  /* Only what is actually in hand takes room on the share rule; an account in the red still
     gets its line, so the list stays the whole truth. */
  const positive = rows.reduce((s, r) => s + Math.max(r.balance, 0), 0);

  /* Where the month lands: the figure the home card shows, read the same way. */
  const now = useMemo(() => new Date(), []);
  const { data: month } = useFinanceData(now.getMonth(), now.getFullYear(), { includeHistorical: false });

  /* The month's latest entries, as Transações lists them. */
  const [latest, setLatest] = useState<Row[]>([]);
  const [customCats, setCustomCats] = useState<CustomCategory[]>([]);
  const [banks, setBanks] = useState<Record<string, EntryBank>>({});
  useEffect(() => {
    if (!user) return;
    let alive = true;
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const read = () =>
      loadMonthTransactions(now.getMonth(), now.getFullYear())
        .then((m) => {
          if (!alive) return;
          setLatest(
            m.transactions
              .filter((t) => t.date <= todayKey)
              .sort((a, b) => b.date.localeCompare(a.date) || (b.created_at ?? "").localeCompare(a.created_at ?? ""))
              .slice(0, LATEST),
          );
          setCustomCats(m.customCategories);
          setBanks(banksById(m.accounts, m.creditCards as { id: string; name: string; color?: string | null }[]));
        })
        .catch(() => undefined);
    void read();
    window.addEventListener("finance-data-changed", read);
    window.addEventListener("transaction-created", read);
    return () => {
      alive = false;
      window.removeEventListener("finance-data-changed", read);
      window.removeEventListener("transaction-created", read);
    };
  }, [user, now]);

  return (
    <Room lit sky>
      <Animated.ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 74, paddingBottom: insets.bottom + 60, paddingHorizontal: 16 }}>
        {accounts !== null && rows.length === 0 ? (
          <Surface radius={26} style={{ marginTop: 6, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20, alignItems: "center" }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: th(INK.edge, "line"), backgroundColor: th("rgba(255,255,255,0.04)", "bg") }}>
              <Landmark size={22} color={th("rgba(255,255,255,0.7)")} strokeWidth={2} />
            </View>
            <Text style={{ marginTop: 14, fontSize: 17, fontWeight: "700", color: th("#fff") }}>Nenhuma conta cadastrada</Text>
            <Text style={{ marginTop: 6, maxWidth: 256, textAlign: "center", fontSize: 13.5, lineHeight: 18, color: th(INK.soft) }}>Cadastre uma conta para acompanhar o saldo e o que entra e sai dela.</Text>
          </Surface>
        ) : (
          <>
            {/* What is in all the accounts. */}
            <Animated.View entering={FadeInDown.duration(380)} style={{ paddingHorizontal: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <Text style={{ fontSize: 17, color: th(INK.soft) }}>{rows.length > 0 ? `Saldo em ${rows.length} ${rows.length === 1 ? "conta" : "contas"}` : "Saldo em contas"}</Text>
                <Pressable onPress={() => setHiddenValues(!hidden)} hitSlop={12} accessibilityRole="button" accessibilityLabel={hidden ? "Mostrar valores" : "Esconder valores"} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
                  {hidden ? <EyeOff size={19} color={th(INK.soft)} strokeWidth={2} /> : <Eye size={19} color={th(INK.soft)} strokeWidth={2} />}
                </Pressable>
              </View>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[nums, { marginTop: 4, fontSize: 44, fontWeight: "700", letterSpacing: -1.6, color: th(saldo < 0 ? RED : "#fff"), opacity: accounts ? 1 : 0.4 }]}>
                {show(saldo)}
              </Text>
              {month?.saldoPrevisto !== undefined && (
                <Text style={[nums, { marginTop: 4, fontSize: 14.5, color: th(INK.soft) }]}>
                  Previsto no final do mês: <Text style={{ fontWeight: "700", color: th(month.saldoPrevisto < 0 ? RED : "#fff") }}>{show(month.saldoPrevisto)}</Text>
                </Text>
              )}
            </Animated.View>

            {/* One bar split the way the money is, each share in its bank's colour. */}
            <View style={{ marginTop: 18, flexDirection: "row", height: 8, gap: 3, paddingHorizontal: 4 }}>
              {positive > 0 ? (
                rows.filter((r) => r.balance > 0).map((r, i) => <FlexBar key={r.account.id} share={r.balance / positive} color={r.hex} delay={0.05 * i} />)
              ) : (
                <View style={{ flex: 1, borderRadius: 999, backgroundColor: th("rgba(255,255,255,0.08)", "bg") }} />
              )}
            </View>

            {/* A line per account. */}
            <View style={{ marginTop: 8 }}>
              {rows.map((r, i) => {
                const share = positive > 0 ? Math.max(r.balance, 0) / positive : 0;
                return (
                  <Animated.View key={r.account.id} entering={FadeInDown.delay(40 + i * 50).duration(350)}>
                    <Pressable
                      onPress={() => router.push(`/conta/${r.account.id}` as never)}
                      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 4, paddingVertical: 14, opacity: pressed ? 0.6 : 1 })}
                    >
                      <BankMark name={r.account.name} hex={r.hex} size={48} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 17, fontWeight: "600", color: th("#fff") }}>
                            {r.account.name}
                          </Text>
                          {r.account.is_default && (
                            <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: th("rgba(255,255,255,0.08)", "bg") }}>
                              <Text style={{ fontSize: 10.5, fontWeight: "700", color: th(INK.soft) }}>Principal</Text>
                            </View>
                          )}
                        </View>
                        <Text numberOfLines={1} style={[nums, { marginTop: 3, fontSize: 14, color: th(INK.soft) }]}>
                          {`${Math.round(share * 100)}% · ${r.typeLabel}`}
                        </Text>
                      </View>
                      <Text style={[nums, { fontSize: 17, fontWeight: "700", color: th(r.balance < 0 ? RED : r.balance > 0 ? "#fff" : INK.softer) }]}>{show(r.balance)}</Text>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>
          </>
        )}

        {/* Adding one: a line like an account's, its mark a dashed circle. */}
        <Pressable
          onPress={() => setAdding(true)}
          accessibilityRole="button"
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 4, paddingVertical: 12, opacity: pressed ? 0.6 : 1 })}
        >
          <View style={{ width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderStyle: "dashed", borderColor: th("rgba(255,255,255,0.28)", "line") }}>
            <Plus size={20} color={th("rgba(255,255,255,0.75)")} strokeWidth={2.2} />
          </View>
          <Text style={{ fontSize: 16, fontWeight: "600", color: th(INK.soft) }}>Adicionar conta</Text>
        </Pressable>

        {/* The latest entries, as the card's statement lists them. */}
        {latest.length > 0 && (
          <View style={{ marginTop: 32 }}>
            <RecentEntries items={latest} banks={banks} customCats={customCats} hidden={hidden} onOpen={() => router.push("/transacoes" as never)} onSeeAll={() => router.push("/transacoes" as never)} />
          </View>
        )}
      </Animated.ScrollView>

      {/* The top row: back, and the page's name. */}
      <View pointerEvents="box-none" style={{ position: "absolute", top: 0, left: 0, right: 0, paddingTop: insets.top + 10, paddingHorizontal: 16, flexDirection: "row", alignItems: "center" }}>
        <RaisedButton label="Voltar" onPress={() => (router.canGoBack() ? router.back() : router.replace("/" as never))} size={50}>
          <ChevronLeft size={24} color={th("#fff")} strokeWidth={2.4} />
        </RaisedButton>
        <Text numberOfLines={1} style={{ flex: 1, marginHorizontal: 10, textAlign: "center", fontSize: 19, fontWeight: "700", letterSpacing: -0.3, color: th("#fff") }}>
          Contas
        </Text>
        {/* Moving money between them, once there are two. */}
        {rows.length >= 2 ? (
          <RaisedButton label="Transferir entre contas" onPress={() => setMoving(true)} size={50}>
            <ArrowDownUp size={21} color={th("#fff")} strokeWidth={2.4} />
          </RaisedButton>
        ) : (
          <View style={{ width: 50 }} />
        )}
      </View>

      <TransferSheet open={moving} onClose={() => setMoving(false)} />

      <AccountSheet
        open={adding}
        onClose={() => setAdding(false)}
        existingNames={rows.map((r) => r.account.name)}
        onCreated={() => {
          setAdding(false);
          void load();
          announce();
          showToast("Conta adicionada");
        }}
      />
    </Room>
  );
}

