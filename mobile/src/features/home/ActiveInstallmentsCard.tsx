import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { AlertTriangle, ChevronRight, CreditCard, Wallet } from "lucide-react-native";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getCategoryColor, getCategoryIcon } from "@/lib/categoryUtils";
import { buildActiveInstallmentItems, type ActiveInstallmentItem, type InstallmentInvoiceRow, type InstallmentTransactionRow } from "@/lib/installmentProgress";
import type { CustomCategory } from "@/services/categoryService";
import { useMoney } from "@/components/projecoes/shared";
import { Glass, ProgressBar, Text, colors, white } from "~/ui";
import { hsl, tint } from "~/lib/color";

/** Parcelamentos no início: quanto pesa por mês, quanto falta e as compras em andamento. */
export const ActiveInstallmentsCard = memo(function ActiveInstallmentsCard() {
  const router = useRouter();
  const { user } = useAuth();
  const { fmt } = useMoney();
  const [items, setItems] = useState<ActiveInstallmentItem[]>([]);
  const [custom, setCustom] = useState<CustomCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const [tx, inv, cats, cards] = await Promise.all([
      supabase.from("transactions").select("id, name, category, amount, installment_current, installments, payment_method, date, credit_card_id, parent_transaction_id, status, type")
        .eq("user_id", user.id).eq("recurrence_type", "parcelado").eq("type", "despesa").not("installments", "is", null),
      supabase.from("invoice_items").select("transaction_id, amount, installment_number, total_installments, invoices!inner(is_paid, user_id, month, year), transactions!inner(id, name, category, payment_method, credit_card_id, parent_transaction_id, date, type)")
        .eq("invoices.user_id", user.id),
      supabase.from("custom_categories").select("*").eq("user_id", user.id),
      supabase.from("credit_cards").select("id, due_day").eq("user_id", user.id),
    ]);
    if (!tx.error && !inv.error) {
      setItems(buildActiveInstallmentItems({
        transactions: (tx.data ?? []) as InstallmentTransactionRow[],
        invoiceItems: (inv.data ?? []) as InstallmentInvoiceRow[],
        creditCardDueDays: Object.fromEntries((cards.data ?? []).map((c) => [c.id, c.due_day])),
      }));
    }
    if (cats.data) setCustom(cats.data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
    const w = window as any;
    w.addEventListener("finance-data-changed", load);
    return () => w.removeEventListener("finance-data-changed", load);
  }, [load]);

  const stats = useMemo(() => {
    if (items.length === 0) return null;
    let monthly = 0, left = 0;
    let last = new Date();
    items.forEach((it) => {
      const unpaid = it.installments - it.installment_current + 1;
      if (unpaid > 0) { monthly += it.amount; left += it.amount * unpaid; }
      const end = new Date(it.date);
      end.setMonth(end.getMonth() + (it.installments - it.installment_current));
      if (end > last) last = end;
    });
    const now = new Date();
    return { monthly, left, monthsUntilFree: Math.max((last.getFullYear() - now.getFullYear()) * 12 + (last.getMonth() - now.getMonth()), 0), last };
  }, [items]);

  const open = () => router.push("/parcelamentos");

  if (loading) return <View style={{ height: 120, borderRadius: 22, backgroundColor: white(0.06) }} />;

  if (items.length === 0 || !stats) {
    return (
      <Pressable onPress={open}>
        <Glass radius={22} style={{ padding: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View>
              <Text weight="semibold" size={16}>Parcelamentos</Text>
              <Text size={12} color={white(0.56)}>Compras parceladas no cartão e na conta</Text>
            </View>
            <ChevronRight size={16} color={white(0.45)} />
          </View>
          <View style={{ marginTop: 16, flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, backgroundColor: white(0.04), paddingHorizontal: 14, paddingVertical: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: white(0.06) }}><CreditCard size={16} color={white(0.66)} /></View>
            <Text size={13} color={white(0.66)}>Nenhum parcelamento ativo.</Text>
          </View>
        </Glass>
      </Pressable>
    );
  }

  const visible = items.slice(0, 5);
  return (
    <Glass radius={22} style={{ padding: 16 }}>
      <Pressable onPress={open} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View>
          <Text weight="semibold" size={16}>Parcelamentos</Text>
          <Text size={12} color={white(0.56)}>{items.length} {items.length === 1 ? "compra parcelada" : "compras parceladas"}</Text>
        </View>
        <ChevronRight size={16} color={white(0.45)} />
      </Pressable>

      <View style={{ marginTop: 12, flexDirection: "row", borderRadius: 18, backgroundColor: white(0.04), paddingVertical: 12 }}>
        <View style={{ flex: 1, paddingHorizontal: 14 }}><Text size={11} color={white(0.62)}>Por mês</Text><Text weight="bold" size={17} tabular>{fmt(stats.monthly)}</Text></View>
        <View style={{ flex: 1, paddingHorizontal: 14, borderLeftWidth: 1, borderLeftColor: white(0.12) }}><Text size={11} color={white(0.62)}>Restante</Text><Text weight="bold" size={17} tabular>{fmt(stats.left)}</Text></View>
      </View>
      {stats.monthsUntilFree > 0 && (
        <Text size={12} color={white(0.62)} style={{ marginTop: 10, paddingHorizontal: 4 }}>
          Livre das parcelas em <Text size={12} weight="semibold">{stats.monthsUntilFree} {stats.monthsUntilFree === 1 ? "mês" : "meses"}</Text> · {stats.last.toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}
        </Text>
      )}

      <View style={{ marginTop: 8 }}>
        {visible.map((it, i) => {
          const Icon = getCategoryIcon(it.category, custom);
          const col = hsl(getCategoryColor(it.category, custom));
          const isCard = it.payment_method === "cartao";
          const tone = it.isOverdue ? colors.red : white(0.62);
          return (
            <View key={it.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: white(0.06) }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: tint(col, 0.14) }}><Icon size={18} color={col} /></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                  <Text weight="medium" size={15} numberOfLines={1} style={{ flex: 1 }}>{it.name}</Text>
                  <Text weight="semibold" size={15} tabular>{fmt(it.amount)}</Text>
                </View>
                <View style={{ marginTop: 6, flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ flex: 1 }}><ProgressBar ratio={(it.installment_current - 1) / it.installments} color={it.isOverdue ? colors.red : "#fff"} height={6} track={white(0.08)} /></View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    {it.isOverdue ? <AlertTriangle size={12} color={tone} /> : isCard ? <CreditCard size={12} color={tone} /> : <Wallet size={12} color={tone} />}
                    <Text size={11} tabular color={tone}>{it.installment_current}/{it.installments}</Text>
                  </View>
                </View>
              </View>
            </View>
          );
        })}
      </View>

      {items.length > 5 && (
        <Pressable onPress={open} style={{ marginTop: 4, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, borderTopWidth: 1, borderTopColor: white(0.06), paddingTop: 12 }}>
          <Text size={13} weight="medium" color={white(0.74)}>Ver os {items.length} parcelamentos</Text>
          <ChevronRight size={16} color={white(0.74)} />
        </Pressable>
      )}
    </Glass>
  );
});
