import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { CalendarClock } from "lucide-react-native";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getCategoryColor, getCategoryIcon } from "@/lib/categoryUtils";
import { buildActiveInstallmentItems, type ActiveInstallmentItem, type InstallmentInvoiceRow, type InstallmentTransactionRow } from "@/lib/installmentProgress";
import type { CustomCategory } from "@/services/categoryService";
import { useMoney } from "@/components/projecoes/shared";
import { InstallmentPurchaseCard } from "~/features/installments/InstallmentPurchaseCard";
import { Glass, PageHeader, ProgressBar, Screen, Segmented, Text, white } from "~/ui";
import { hsl, tint } from "~/lib/color";

/** Parcelamentos: quanto está comprometido por mês, o que já foi pago e cada compra. */
export default function Parcelamentos() {
  const { user } = useAuth();
  const { fmt } = useMoney();
  const [items, setItems] = useState<ActiveInstallmentItem[]>([]);
  const [custom, setCustom] = useState<CustomCategory[]>([]);
  const [cardsById, setCardsById] = useState<Record<string, { name: string; color: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"todos" | "cartao" | "conta">("todos");

  const load = useCallback(async () => {
    if (!user) return;
    const [txRes, invRes, catRes, cardRes] = await Promise.all([
      supabase.from("transactions").select("id, name, category, amount, installment_current, installments, payment_method, date, credit_card_id, parent_transaction_id, status, type")
        .eq("user_id", user.id).eq("recurrence_type", "parcelado").eq("type", "despesa").not("installments", "is", null),
      supabase.from("invoice_items").select("transaction_id, amount, installment_number, total_installments, invoices!inner(is_paid, user_id, month, year), transactions!inner(id, name, category, payment_method, credit_card_id, parent_transaction_id, date, type)")
        .eq("invoices.user_id", user.id),
      supabase.from("custom_categories").select("*").eq("user_id", user.id),
      supabase.from("credit_cards").select("id, due_day, name, color").eq("user_id", user.id),
    ]);
    if (!txRes.error && !invRes.error) {
      const cards = cardRes.data ?? [];
      setCardsById(Object.fromEntries(cards.map((c) => [c.id, { name: c.name, color: c.color }])));
      setItems(buildActiveInstallmentItems({
        transactions: (txRes.data ?? []) as InstallmentTransactionRow[],
        invoiceItems: (invRes.data ?? []) as InstallmentInvoiceRow[],
        creditCardDueDays: Object.fromEntries(cards.map((c) => [c.id, c.due_day])),
      }));
    }
    if (catRes.data) setCustom(catRes.data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
    const w = window as any;
    w.addEventListener("finance-data-changed", load);
    return () => w.removeEventListener("finance-data-changed", load);
  }, [load]);

  const now = new Date();
  const stats = useMemo(() => {
    if (items.length === 0) return null;
    let monthly = 0, left = 0, paid = 0, all = 0;
    let last = new Date();
    items.forEach((it) => {
      const paidCount = it.installment_current - 1;
      const unpaid = it.installments - paidCount;
      all += it.amount * it.installments;
      paid += it.amount * paidCount;
      if (unpaid > 0) { monthly += it.amount; left += it.amount * unpaid; }
      const end = new Date(it.date);
      end.setMonth(end.getMonth() + (it.installments - 1));
      if (end > last) last = end;
    });
    const monthsUntilFree = Math.max((last.getFullYear() - now.getFullYear()) * 12 + (last.getMonth() - now.getMonth()), 0);
    return { monthly, left, paid, all, last, monthsUntilFree };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const projection = useMemo(() => {
    if (!stats) return [];
    const out: { key: string; label: string; value: number }[] = [];
    for (let off = 0; off <= stats.monthsUntilFree; off++) {
      const d = new Date(now.getFullYear(), now.getMonth() + off, 1);
      let value = 0;
      items.forEach((it) => {
        const base = new Date(it.date);
        const startIdx = base.getFullYear() * 12 + base.getMonth() + (it.installment_current - 1);
        const diff = d.getFullYear() * 12 + d.getMonth() - startIdx;
        if (diff >= 0 && diff < it.installments - (it.installment_current - 1)) value += it.amount;
      });
      out.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""), value });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, stats]);

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((it) => map.set(it.category, (map.get(it.category) ?? 0) + it.amount));
    return [...map.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
  }, [items]);

  const visible = filter === "todos" ? items : items.filter((i) => (filter === "cartao" ? i.payment_method === "cartao" : i.payment_method !== "cartao"));
  const maxProj = Math.max(...projection.map((p) => p.value), 1);

  if (loading) {
    return (
      <Screen><PageHeader title="Parcelamentos" />
        <View style={{ marginTop: 24, gap: 12 }}><View style={{ height: 160, borderRadius: 24, backgroundColor: white(0.06) }} /><View style={{ height: 220, borderRadius: 24, backgroundColor: white(0.06) }} /></View>
      </Screen>
    );
  }

  if (!stats) {
    return (
      <Screen><PageHeader title="Parcelamentos" />
        <View style={{ marginTop: 32, alignItems: "center", paddingHorizontal: 32 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: white(0.12), backgroundColor: white(0.05) }}><CalendarClock size={32} color={white(0.56)} /></View>
          <Text weight="bold" size={18} style={{ marginTop: 20 }}>Nenhum parcelamento ativo</Text>
          <Text size={14} color={white(0.62)} align="center" style={{ marginTop: 4 }}>Compras parceladas aparecem aqui com o progresso de cada uma.</Text>
        </View>
      </Screen>
    );
  }

  const paidPct = stats.all > 0 ? (stats.paid / stats.all) * 100 : 0;

  return (
    <Screen onRefresh={load}>
      <PageHeader title="Parcelamentos" subtitle={`${items.length} ${items.length === 1 ? "compra parcelada" : "compras parceladas"} · cartão e conta`} />

      <Text size={15} color={white(0.66)} style={{ marginTop: 24 }}>Comprometido por mês</Text>
      <Text weight="extrabold" size={38} tabular style={{ letterSpacing: -1 }}>{fmt(stats.monthly)}</Text>
      <Text size={14} color={white(0.66)}>
        {stats.monthsUntilFree > 0 ? `Livre em ${stats.monthsUntilFree} ${stats.monthsUntilFree === 1 ? "mês" : "meses"} · ${stats.last.toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}` : "Última parcela este mês"}
      </Text>

      <Glass radius={24} style={{ marginTop: 24, padding: 16 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
          <Text size={14} color={white(0.74)}>Progresso geral</Text>
          <Text size={14} weight="semibold" tabular>{Math.round(paidPct)}% pago</Text>
        </View>
        <View style={{ marginTop: 12 }}><ProgressBar ratio={paidPct / 100} color="#fff" height={12} track={white(0.08)} /></View>
        <View style={{ marginTop: 16, flexDirection: "row", borderTopWidth: 1, borderTopColor: white(0.12), paddingTop: 14 }}>
          <View style={{ flex: 1 }}><Text size={12} color={white(0.62)}>Já pago</Text><Text weight="bold" size={17} tabular>{fmt(stats.paid)}</Text></View>
          <View style={{ flex: 1, borderLeftWidth: 1, borderLeftColor: white(0.12), paddingLeft: 16 }}><Text size={12} color={white(0.62)}>Falta pagar</Text><Text weight="bold" size={17} tabular>{fmt(stats.left)}</Text></View>
        </View>
      </Glass>

      {projection.length > 1 && (
        <Glass radius={24} style={{ marginTop: 12, padding: 16 }}>
          <Text weight="semibold" size={16}>Próximos meses</Text>
          <Text size={12} color={white(0.56)}>O valor cai conforme as parcelas terminam</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 16 }} contentContainerStyle={{ gap: 10, alignItems: "flex-end" }}>
            {projection.map((p, i) => (
              <View key={p.key} style={{ width: 44, alignItems: "center" }}>
                <Text size={10} tabular color={i === 0 ? "#fff" : white(0.56)} style={{ marginBottom: 6 }}>{p.value >= 1000 ? `${(p.value / 1000).toFixed(1)}k` : p.value.toFixed(0)}</Text>
                <View style={{ height: 110, justifyContent: "flex-end" }}>
                  <View style={{ width: 32, borderRadius: 16, height: Math.max((p.value / maxProj) * 110, p.value > 0 ? 8 : 3), backgroundColor: i === 0 ? "#fff" : white(0.25) }} />
                </View>
                <Text size={12} weight={i === 0 ? "semibold" : "regular"} color={i === 0 ? "#fff" : white(0.62)} style={{ marginTop: 8, textTransform: "capitalize" }}>{p.label}</Text>
              </View>
            ))}
          </ScrollView>
        </Glass>
      )}

      {categories.length > 1 && (
        <Glass radius={24} style={{ marginTop: 12, padding: 16 }}>
          <Text weight="semibold" size={16}>Por categoria</Text>
          <View style={{ marginTop: 12, height: 10, flexDirection: "row", gap: 4, borderRadius: 5, overflow: "hidden" }}>
            {categories.map((c) => <View key={c.category} style={{ width: `${(c.amount / stats.monthly) * 100}%`, backgroundColor: hsl(getCategoryColor(c.category, custom)) }} />)}
          </View>
          <View style={{ marginTop: 12, gap: 10 }}>
            {categories.map((c) => {
              const Icon = getCategoryIcon(c.category, custom);
              const col = hsl(getCategoryColor(c.category, custom));
              return (
                <View key={c.category} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: tint(col, 0.14) }}><Icon size={16} color={col} /></View>
                  <Text size={14} style={{ flex: 1 }} numberOfLines={1}>{c.category}</Text>
                  <Text size={13} color={white(0.62)} tabular>{Math.round((c.amount / stats.monthly) * 100)}%</Text>
                  <Text size={14} weight="semibold" tabular style={{ minWidth: 88, textAlign: "right" }}>{fmt(c.amount)}</Text>
                </View>
              );
            })}
          </View>
        </Glass>
      )}

      <View style={{ marginTop: 28, marginBottom: 12, paddingHorizontal: 4, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text display weight="bold" size={18}>Compras</Text>
        <View style={{ width: 210 }}>
          <Segmented<"todos" | "cartao" | "conta"> options={[{ key: "todos", label: "Todos" }, { key: "cartao", label: "Cartão" }, { key: "conta", label: "Conta" }]} value={filter} onChange={setFilter} />
        </View>
      </View>

      <View style={{ gap: 8 }}>
        {visible.length === 0 && <Text size={14} color={white(0.56)} align="center" style={{ paddingVertical: 24 }}>Nenhuma compra neste filtro</Text>}
        {visible.map((it) => <InstallmentPurchaseCard key={it.id} item={it} customCats={custom} card={it.credit_card_id ? cardsById[it.credit_card_id] : undefined} />)}
      </View>
    </Screen>
  );
}
