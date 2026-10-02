import { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CheckCircle2, ChevronDown, ChevronUp, Clock, CreditCard, Receipt, TrendingDown, TrendingUp, Wallet } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useMonth } from "@/contexts/MonthContext";
import { useAuth } from "@/contexts/AuthContext";
import { useFinanceData } from "@/hooks/useFinanceData";
import { supabase } from "@/integrations/supabase/client";
import { getCategoryColor, getCategoryIcon } from "@/lib/categoryUtils";
import { getCustomCategories, type CustomCategory } from "@/services/categoryService";
import { getRecurringForMonth } from "@/services/recurringService";
import { dayOfMonth } from "@/lib/dateOnly";
import { MONTH_NAMES, useMoney } from "@/components/projecoes/shared";
import { cardHex } from "@/hooks/useCardsOverview";
import { Glass, PageHeader, ProgressBar, Screen, SectionTitle, Text, colors, white } from "~/ui";
import { MonthPicker } from "~/features/nav/MonthPicker";
import { hsl, tint } from "~/lib/color";

const SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface TxRow { id: string; name: string; category: string; date: string; amount: number; status: string; type: string; credit_card_id: string | null }
interface InvoiceRow { id: string; credit_card_id: string; total_amount: number; is_paid: boolean; month: number; year: number; card_name?: string; card_color?: string | null }
type Item = { kind: "tx"; tx: TxRow } | { kind: "invoice"; inv: InvoiceRow };

/** Receitas ou despesas do mês: o total, o que já foi, a evolução e cada lançamento. */
export default function Detalhe() {
  const { tipo } = useLocalSearchParams<{ tipo: string }>();
  const isReceita = tipo === "receitas";
  const type = isReceita ? "receita" : "despesa";
  const router = useRouter();
  const { user } = useAuth();
  const { fmt, compact } = useMoney();
  const { selectedMonth, selectedYear, setMonth } = useMonth();
  const { data, refetch } = useFinanceData(selectedMonth, selectedYear, { includeHistorical: false });

  const [txs, setTxs] = useState<TxRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [custom, setCustom] = useState<CustomCategory[]>([]);
  const [history, setHistory] = useState<{ month: string; value: number }[]>([]);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!user) return;
    const start = new Date(selectedYear, selectedMonth, 1).toISOString().split("T")[0];
    const end = new Date(selectedYear, selectedMonth + 1, 0).toISOString().split("T")[0];
    const run = async () => {
      let q = supabase.from("transactions").select("id, name, category, date, amount, status, type, credit_card_id")
        .eq("user_id", user.id).eq("type", type).gte("date", start).lte("date", end)
        .order("date", { ascending: false }).order("created_at", { ascending: true });
      if (!isReceita) q = q.is("credit_card_id", null);
      const [{ data: rows }, cats, recurring] = await Promise.all([q, getCustomCategories(), getRecurringForMonth(selectedMonth, selectedYear)]);

      // uma conta fixa se repete no mês sem linha própria; os totais já a contam, então a lista também
      const base = (rows as TxRow[]) ?? [];
      const seen = new Set(base.map((t) => t.id));
      const extra = (recurring as any[])
        .filter((r) => r.type === type && !seen.has(r.id))
        .filter((r) => (isReceita ? true : !r.credit_card_id))
        .map((r) => ({ ...r, date: `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(dayOfMonth(r.date)).padStart(2, "0")}`, status: "pendente" })) as TxRow[];
      setTxs([...base, ...extra].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")));
      setCustom(cats);

      if (!isReceita) {
        const { data: inv } = await supabase.from("invoices").select("id, credit_card_id, total_amount, is_paid, month, year")
          .eq("user_id", user.id).eq("month", selectedMonth + 1).eq("year", selectedYear).gt("total_amount", 0);
        if (inv && inv.length > 0) {
          const ids = [...new Set(inv.map((i) => i.credit_card_id))];
          const { data: cards } = await supabase.from("credit_cards").select("id, name, color").in("id", ids);
          const map = new Map((cards ?? []).map((c) => [c.id, c]));
          setInvoices(inv.map((i) => ({ ...i, card_name: map.get(i.credit_card_id)?.name ?? "Cartão", card_color: map.get(i.credit_card_id)?.color ?? null })));
        } else setInvoices([]);
      }
    };
    run();
  }, [user, selectedMonth, selectedYear, type, isReceita, data]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const out: { month: string; value: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(selectedYear, selectedMonth - i, 1);
        const s = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
        const e = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split("T")[0];
        const { data: rows } = await supabase.from("transactions").select("amount").eq("user_id", user.id).eq("type", type).gte("date", s).lte("date", e);
        out.push({ month: SHORT[d.getMonth()], value: (rows ?? []).reduce((sum: number, t: any) => sum + Number(t.amount), 0) });
      }
      setHistory(out);
    })();
  }, [user, selectedMonth, selectedYear, type]);

  const total = isReceita ? data.receitas : data.despesas;
  const paid = isReceita ? data.receitasRecebidas : data.despesasPagas;
  const pending = isReceita ? data.receitasPendentes : data.despesasPendentes;
  const paidPct = total > 0 ? paid / total : 0;
  const accent = isReceita ? colors.green : colors.red;
  const HeroIcon = isReceita ? Wallet : Receipt;

  const trend = useMemo(() => {
    if (history.length < 2) return 0;
    const prev = history[history.length - 2].value;
    const cur = history[history.length - 1].value;
    return prev === 0 ? 0 : Math.round(((cur - prev) / prev) * 100);
  }, [history]);
  const trendGood = isReceita ? trend > 0 : trend < 0;

  const pendingItems = useMemo<Item[]>(() => [
    ...txs.filter((t) => t.status !== "pago").map((tx) => ({ kind: "tx" as const, tx })),
    ...(isReceita ? [] : invoices.filter((i) => !i.is_paid).map((inv) => ({ kind: "invoice" as const, inv }))),
  ], [txs, invoices, isReceita]);
  const paidItems = useMemo<Item[]>(() => [
    ...txs.filter((t) => t.status === "pago").map((tx) => ({ kind: "tx" as const, tx })),
    ...(isReceita ? [] : invoices.filter((i) => i.is_paid).map((inv) => ({ kind: "invoice" as const, inv }))),
  ], [txs, invoices, isReceita]);
  const maxHistory = Math.max(...history.map((h) => h.value), 1);
  const hasMore = pendingItems.length > 5 || paidItems.length > 5;

  const openTx = (id: string) => router.push({ pathname: "/transacao/[id]", params: { id } });
  const openInvoice = (cardId: string, m: number, y: number) => router.push({ pathname: "/fatura/[cardId]", params: { cardId, month: String(m), year: String(y) } });

  const renderList = (items: Item[], isPending: boolean) => (
    <Glass radius={22} style={{ paddingHorizontal: 12 }}>
      {(showAll ? items : items.slice(0, 5)).map((it, i) => {
        const border = { borderTopWidth: i === 0 ? 0 : 1, borderTopColor: white(0.06) };
        if (it.kind === "invoice") {
          const c = it.inv.card_color ? cardHex(it.inv.card_color) : white(0.5);
          const sc = isPending ? colors.amber : colors.red;
          return (
            <Pressable key={it.inv.id} onPress={() => openInvoice(it.inv.credit_card_id, it.inv.month, it.inv.year)} style={[{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 }, border]}>
              <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: tint(c, 0.13) }}><CreditCard size={18} color={c} /></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text weight="semibold" size={14.5} numberOfLines={1}>Fatura {it.inv.card_name}</Text>
                <Text size={12} color={white(0.56)}>{SHORT[it.inv.month - 1]}/{it.inv.year}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text weight="bold" size={14} tabular color={sc}>−{fmt(Number(it.inv.total_amount))}</Text>
                <Text size={10.5} color={sc} style={{ opacity: 0.65 }}>{isPending ? "Pendente" : "Paga"}</Text>
              </View>
            </Pressable>
          );
        }
        const t = it.tx;
        const col = hsl(getCategoryColor(t.category, custom));
        const Icon = getCategoryIcon(t.category, custom);
        const sc = isPending ? colors.amber : accent;
        const d = new Date(`${t.date}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
        return (
          <Pressable key={t.id} onPress={() => openTx(t.id)} style={[{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 }, border]}>
            <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: tint(col, 0.15) }}><Icon size={18} color={col} /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text weight="semibold" size={14.5} numberOfLines={1}>{t.name}</Text>
              <Text size={12} color={white(0.56)} numberOfLines={1}>{t.category} · {d}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text weight="bold" size={14} tabular color={sc}>{isReceita ? "+" : "−"}{fmt(Number(t.amount))}</Text>
              <Text size={10.5} color={sc} style={{ opacity: 0.65 }}>{isPending ? (isReceita ? "A receber" : "Pendente") : isReceita ? "Recebido" : "Pago"}</Text>
            </View>
          </Pressable>
        );
      })}
    </Glass>
  );

  return (
    <Screen onRefresh={async () => { await refetch(); }}>
      <PageHeader title={isReceita ? "Receitas" : "Despesas"} subtitle={MONTH_NAMES[selectedMonth]} action={<MonthPicker month={selectedMonth} year={selectedYear} onChange={setMonth} />} />

      <View style={{ marginTop: 20, borderRadius: 28, overflow: "hidden", borderWidth: 1, borderColor: white(0.12), padding: 20 }}>
        <LinearGradient colors={[tint(accent, 0.11), "rgba(20,20,20,0.96)", "#0E0E0E"]} locations={[0, 0.55, 1]} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: tint(accent, 0.13) }}><HeroIcon size={18} color={accent} /></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text size={13} color={white(0.7)}>Total {isReceita ? "de receitas" : "de despesas"}</Text>
            <Text weight="extrabold" size={30} tabular numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ letterSpacing: -0.6 }}>{fmt(total)}</Text>
          </View>
          {trend !== 0 && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, backgroundColor: white(0.08), paddingHorizontal: 10, paddingVertical: 6 }}>
              {trendGood ? <TrendingUp size={14} color={colors.green} /> : <TrendingDown size={14} color={colors.red} />}
              <Text size={12} weight="semibold" tabular color={trendGood ? colors.green : colors.red}>{trend > 0 ? "+" : ""}{trend}%</Text>
            </View>
          )}
        </View>
        <View style={{ marginTop: 16 }}><ProgressBar ratio={paidPct} color={accent} height={8} track={white(0.07)} /></View>
        <View style={{ marginTop: 12, flexDirection: "row", gap: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <CheckCircle2 size={14} color={accent} />
            <Text size={13} color={white(0.74)}>{isReceita ? "Recebido" : "Pago"} <Text size={13} weight="semibold" tabular>{fmt(paid)}</Text></Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Clock size={14} color={colors.amber} />
            <Text size={13} color={white(0.74)}>Pendente <Text size={13} weight="semibold" tabular>{fmt(pending)}</Text></Text>
          </View>
        </View>
      </View>

      {history.length > 0 && (
        <>
          <SectionTitle>Evolução mensal</SectionTitle>
          <Glass radius={22} style={{ padding: 16, flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
            {history.map((h, i) => {
              const cur = i === history.length - 1;
              return (
                <View key={h.month + i} style={{ flex: 1, alignItems: "center", gap: 6 }}>
                  <Text size={10} weight="bold" tabular color={cur ? "#fff" : white(0.56)} numberOfLines={1}>{h.value > 0 ? compact(h.value) : "—"}</Text>
                  <View style={{ width: 28, maxWidth: "100%", borderRadius: 8, height: Math.max((h.value / maxHistory) * 84, 6), backgroundColor: cur ? accent : tint(accent, 0.27) }} />
                  <Text size={11} weight={cur ? "semibold" : "regular"} color={cur ? "#fff" : white(0.56)}>{h.month}</Text>
                </View>
              );
            })}
          </Glass>
        </>
      )}

      {pendingItems.length > 0 && (
        <>
          <SectionTitle action={<Text size={12} weight="bold" tabular color={tint(colors.amber, 0.7)}>{pendingItems.length}</Text>}>{isReceita ? "A receber" : "Pendentes"}</SectionTitle>
          {renderList(pendingItems, true)}
        </>
      )}
      {paidItems.length > 0 && (
        <>
          <SectionTitle action={<Text size={12} weight="bold" tabular color={tint(accent, 0.7)}>{paidItems.length}</Text>}>{isReceita ? "Recebidas" : "Pagas"}</SectionTitle>
          {renderList(paidItems, false)}
        </>
      )}
      {pendingItems.length + paidItems.length === 0 && <Text size={14} color={white(0.56)} align="center" style={{ paddingVertical: 40 }}>Nenhum lançamento neste mês</Text>}

      {hasMore && (
        <Pressable onPress={() => setShowAll((v) => !v)} style={{ marginTop: 12, height: 44, borderRadius: 22, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: white(0.06) }}>
          {showAll ? <ChevronUp size={16} color="#fff" /> : <ChevronDown size={16} color="#fff" />}
          <Text size={13} weight="semibold">{showAll ? "Ver menos" : "Ver todos"}</Text>
        </Pressable>
      )}
    </Screen>
  );
}
