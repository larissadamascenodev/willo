import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, Text, View, type TextStyle } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn } from "react-native-reanimated";
import type { AnalyticsTransaction } from "@/services/categoryAnalytics";
import { getAccounts, getCreditCards } from "@/services/transactionService";
import { supabase } from "~/supabase/client";
import { colorFor } from "@/lib/banks";
import { setHiddenValues, useHiddenValues } from "@/hooks/useHiddenValues";
import Room from "~/components/Room";
import RaisedButton from "~/components/RaisedButton";
import BankMark from "~/components/BankMark";
import CountUp from "~/components/CountUp";
import TransactionSheet from "~/components/transactions/TransactionSheet";
import { catColor } from "~/components/home/GastosPorCategoria";
import { inkOn } from "@/lib/tone";
import { ChevronLeft, Eye, EyeOff } from "~/components/icons";
import { categoryIcon } from "~/lib/categoryIcon";
import { useAuth } from "~/lib/auth";
import { money } from "~/lib/money";
import { useCategoryAnalytics } from "~/lib/warmStart";
import { INK } from "~/theme/tokens";
import { type as T } from "~/theme/type";
import { th, useThemeRedraw } from "~/theme/theme";

/**
 * One place money went to, up close — opened from Gastos' "Principais estabelecimentos".
 *
 * Drawn as every detail page is, in the app's quiet colours. What was spent there in the
 * period, large, how many times and the average; then every time, newest first: the day, how it
 * was paid (débito, crédito, Pix…) and from which account or card, its category, and the amount.
 * A touch opens the entry itself.
 */

const nums: TextStyle = Platform.select({ ios: { fontVariant: ["tabular-nums"] }, default: {} }) as TextStyle;
const WEEK = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const PAID: Record<string, string> = { debito: "Débito", pix: "Pix", dinheiro: "Dinheiro", transferencia: "Transferência", boleto: "Boleto", cartao: "Crédito" };

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dayOf = (t: AnalyticsTransaction) => (t.date ?? "").slice(0, 10);

export default function Estabelecimento() {
  useThemeRedraw();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const hidden = useHiddenValues();
  const { nome = "", periodo = "1m" } = useLocalSearchParams<{ nome?: string; periodo?: string }>();
  const now = useMemo(() => new Date(), []);
  const month = now.getMonth();
  const year = now.getFullYear();
  const data = useCategoryAnalytics(user?.id, month, year);
  const custom = useMemo(() => data?.customCats ?? [], [data]);
  const show = (v: number) => (hidden ? "R$ •••" : money(v));

  /* Every time in the period, newest first. */
  const visits = useMemo(() => {
    const key = nome.trim().toLowerCase();
    const all = [...(data?.transactions ?? []), ...(data?.prevTransactions ?? [])].filter((t) => t.type === "despesa" && (t.name || t.category || "").trim().toLowerCase() === key);
    let list = all;
    if (periodo === "1s") {
      const from = iso(new Date(year, month, now.getDate() - 6));
      const to = iso(now);
      list = all.filter((t) => dayOf(t) >= from && dayOf(t) <= to);
    } else {
      const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
      list = all.filter((t) => dayOf(t).startsWith(prefix));
    }
    return list.sort((a, b) => dayOf(b).localeCompare(dayOf(a)));
  }, [data, nome, periodo, now, month, year]);
  const total = visits.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const category = visits[0]?.category ?? "Outros";
  const color = catColor(category, 0, custom);
  const Icon = categoryIcon(category, custom);

  /* Where each was paid from, by name. */
  const [names, setNames] = useState<{ accounts: Record<string, string>; cards: Record<string, { name: string; color: string | null }> }>({ accounts: {}, cards: {} });
  useEffect(() => {
    if (!user) return;
    let alive = true;
    void Promise.all([getAccounts(true).catch(() => []), getCreditCards().catch(() => [])]).then(([a, c]) => {
      if (!alive) return;
      setNames({
        accounts: Object.fromEntries((a as unknown as { id: string; name: string }[]).map((r) => [r.id, r.name])),
        cards: Object.fromEntries((c as unknown as { id: string; name: string; color: string | null }[]).map((r) => [r.id, { name: r.name, color: r.color }])),
      });
    });
    return () => {
      alive = false;
    };
  }, [user]);
  const onCard = (t: AnalyticsTransaction) => t.payment_method === "cartao" && !!t.credit_card_id;
  const source = (t: AnalyticsTransaction) => {
    if (onCard(t)) return names.cards[t.credit_card_id!]?.name ?? "Cartão";
    const acc = (t as AnalyticsTransaction & { account_id?: string | null }).account_id;
    return (acc && names.accounts[acc]) || "Conta";
  };
  const [opened, setOpened] = useState<AnalyticsTransaction | null>(null);

  /* An instalment carries its own month's date; the day it was bought is on the purchase
     it came from — read once, so each line says when it was really bought. */
  const [bought, setBought] = useState<Record<string, string>>({});
  useEffect(() => {
    const ids = [...new Set(visits.map((t) => t.parent_transaction_id).filter((x): x is string => !!x && !bought[x]))];
    if (!user || ids.length === 0) return;
    let alive = true;
    void supabase
      .from("transactions")
      .select("id,date")
      .in("id", ids)
      .then(({ data: rows }) => {
        if (!alive || !rows) return;
        setBought((had) => ({ ...had, ...Object.fromEntries((rows as { id: string; date: string }[]).map((r) => [r.id, r.date.slice(0, 10)])) }));
      });
    return () => {
      alive = false;
    };
    // bought only fills in what is missing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visits, user]);

  const dateOf = (t: AnalyticsTransaction) => {
    const raw = (t.parent_transaction_id && bought[t.parent_transaction_id]) || dayOf(t);
    const [y, m, d] = raw.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return `${WEEK[date.getDay()]}, ${d} de ${SHORT[date.getMonth()]}${y !== year ? ` de ${y}` : ""}`;
  };

  return (
    <Room lit sky>
      <Animated.ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 74, paddingBottom: insets.bottom + 60, paddingHorizontal: 16 }}>
        {/* What was spent there. */}
        <View style={{ paddingHorizontal: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 17, color: th(INK.soft) }}>
              {periodo === "1s" ? "Gasto nos últimos 7 dias" : `Gasto em ${MONTHS[month]}`}
            </Text>
            <Pressable onPress={() => setHiddenValues(!hidden)} hitSlop={12} accessibilityRole="button" accessibilityLabel={hidden ? "Mostrar valores" : "Esconder valores"} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
              {hidden ? <EyeOff size={19} color={th(INK.soft)} strokeWidth={2} /> : <Eye size={19} color={th(INK.soft)} strokeWidth={2} />}
            </Pressable>
          </View>
          {hidden ? (
            <Text style={[nums, { marginTop: 4, fontSize: 44, fontWeight: "700", letterSpacing: -1.6, color: th("#fff") }]}>R$ •••</Text>
          ) : (
            <CountUp value={total} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[nums, { marginTop: 4, fontSize: 44, fontWeight: "700", letterSpacing: -1.6, color: th("#fff") }]} />
          )}
          <Text style={[nums, { marginTop: 4, fontSize: 14.5, color: th(INK.soft) }]}>
            {visits.length === 1 ? "1 vez" : `${visits.length} vezes`}
            {visits.length > 1 ? ` · média de ${show(total / visits.length)}` : ""}
          </Text>
          <View style={{ marginTop: 12, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, height: 32, paddingLeft: 4, paddingRight: 12, borderRadius: 16, borderWidth: 1, borderColor: th("rgba(255,255,255,0.10)", "line"), backgroundColor: th("rgba(255,255,255,0.05)", "bg") }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: th(color, "bg") }}>
              <Icon size={13} color={inkOn(color)} strokeWidth={2.4} />
            </View>
            <Text style={{ fontSize: 13.5, fontWeight: "600", color: th("#fff") }}>{category}</Text>
          </View>
        </View>

        {/* Every time, newest first. */}
        <Text style={[T.eyebrow, { marginTop: 28, paddingHorizontal: 4 }]}>Cada compra</Text>
        {visits.length === 0 ? (
          <Text style={{ marginTop: 14, marginLeft: 4, fontSize: 15, color: th(INK.soft) }}>{data ? "Nada neste período." : "Carregando…"}</Text>
        ) : (
          <Animated.View entering={FadeIn.duration(260)}>
            <View style={{ marginTop: 6 }}>
              {visits.map((t) => {
                const where = source(t);
                const card = onCard(t);
                const how = PAID[t.payment_method ?? ""] ?? (card ? "Crédito" : "Débito");
                const parts = t.installments && t.installments > 1 && t.installment_current ? ` · parcela ${t.installment_current}/${t.installments}` : "";
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => setOpened(t)}
                    style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12, opacity: pressed ? 0.7 : 1 })}
                  >
                    <View style={{ width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: th("rgba(255,255,255,0.07)", "bg") }}>
                      <BankMark name={where} hex={colorFor(where, card ? names.cards[t.credit_card_id!]?.color : null)} size={46} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{ fontSize: 15.5, fontWeight: "600", color: th("#fff") }}>
                        {dateOf(t)}
                      </Text>
                      <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12.5, color: th(INK.soft) }}>
                        {`${how} · ${where}${parts}`}
                      </Text>
                    </View>
                    <Text style={[nums, { fontSize: 15, fontWeight: "600", color: th("#fff") }]}>{show(Number(t.amount))}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        )}
      </Animated.ScrollView>

      {/* The top row: back, and the place's name. */}
      <View pointerEvents="box-none" style={{ position: "absolute", top: 0, left: 0, right: 0, paddingTop: insets.top + 10, paddingHorizontal: 16, flexDirection: "row", alignItems: "center" }}>
        <RaisedButton label="Voltar" onPress={() => (router.canGoBack() ? router.back() : router.replace("/gastos" as never))} size={50}>
          <ChevronLeft size={24} color={th("#fff")} strokeWidth={2.4} />
        </RaisedButton>
        <Text numberOfLines={1} style={{ flex: 1, marginHorizontal: 10, textAlign: "center", fontSize: 19, fontWeight: "700", letterSpacing: -0.3, color: th("#fff") }}>
          {nome}
        </Text>
        <View style={{ width: 50 }} />
      </View>

      <TransactionSheet
        tx={opened as never}
        accountName={opened ? source(opened) : ""}
        customCategories={custom as never}
        userId={user?.id}
        month={month}
        year={year}
        onClose={() => setOpened(null)}
        onEdit={(t) => {
          setOpened(null);
          router.push({ pathname: "/manual", params: { editar: t.id, mes: String(month), ano: String(year) } } as never);
        }}
        onChanged={() => window.dispatchEvent(new CustomEvent("finance-data-changed"))}
      />
    </Room>
  );
}
