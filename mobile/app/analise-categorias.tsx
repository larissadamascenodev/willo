import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowDownRight, ArrowUpRight, ChevronRight, Gauge, Trash2 } from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useMonth } from "@/contexts/MonthContext";
import { useFinanceData } from "@/hooks/useFinanceData";
import { supabase } from "@/integrations/supabase/client";
import { getCategoryColor, getCategoryIcon } from "@/lib/categoryUtils";
import { getCustomCategories, type CustomCategory } from "@/services/categoryService";
import { notifyFinanceDataChanged } from "@/services/transactionService";
import { MONTH_NAMES, useMoney } from "@/components/projecoes/shared";
import { MonthPicker } from "~/features/nav/MonthPicker";
import { MoneyField } from "~/features/wallet/sheetParts";
import { useMonthTransactions } from "~/features/transactions/useMonthTransactions";
import { BottomSheet, Button, Glass, PageHeader, ProgressBar, Screen, SectionTitle, Text, colors, toast, white } from "~/ui";
import { hsl, tint } from "~/lib/color";

/** Para onde o dinheiro do mês foi, categoria por categoria, comparado com o mês passado. */
export default function AnaliseCategorias() {
  const router = useRouter();
  const { user } = useAuth();
  const { fmt } = useMoney();
  const { categoria } = useLocalSearchParams<{ categoria?: string }>();
  const { selectedMonth, selectedYear, setMonth } = useMonth();
  const prev = new Date(selectedYear, selectedMonth - 1, 1);
  const { data, refetch } = useFinanceData(selectedMonth, selectedYear, { includeHistorical: false });
  const { data: before } = useFinanceData(prev.getMonth(), prev.getFullYear(), { includeHistorical: false });
  const month = useMonthTransactions(selectedMonth, selectedYear);
  const [custom, setCustom] = useState<CustomCategory[]>([]);
  const [limits, setLimits] = useState<Record<string, number>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [limitCents, setLimitCents] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => { getCustomCategories().then(setCustom).catch(() => {}); }, []);
  useEffect(() => { if (categoria) setOpen(categoria); }, [categoria]);

  const loadLimits = useCallback(async () => {
    if (!user) return;
    const { data: rows } = await supabase.from("category_limits").select("category, limit_amount").eq("user_id", user.id);
    setLimits(Object.fromEntries((rows ?? []).map((r) => [r.category, Number(r.limit_amount)])));
  }, [user]);
  useEffect(() => {
    loadLimits();
    const w = window as any;
    w.addEventListener("finance-data-changed", loadLimits);
    return () => w.removeEventListener("finance-data-changed", loadLimits);
  }, [loadLimits]);

  const cats = useMemo(() => [...data.categories].sort((a, b) => b.amount - a.amount), [data.categories]);
  const prevByName = useMemo(() => new Map(before.categories.map((c) => [c.name, c.amount])), [before.categories]);
  const total = cats.reduce((s, c) => s + c.amount, 0);
  const prevTotal = before.categories.reduce((s, c) => s + c.amount, 0);
  const totalDelta = prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;

  const current = cats.find((c) => c.name === open) ?? null;
  const txs = useMemo(
    () => (open ? month.transactions.filter((t) => t.type === "despesa" && t.category === open).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")) : []),
    [month.transactions, open],
  );

  useEffect(() => { if (open) setLimitCents(Math.round((limits[open] ?? 0) * 100)); }, [open, limits]);

  const saveLimit = async () => {
    if (!user || !open) return;
    setSaving(true);
    try {
      const amount = limitCents / 100;
      const { data: row } = await supabase.from("category_limits").select("id").eq("user_id", user.id).eq("category", open).maybeSingle();
      const { error } = row
        ? await supabase.from("category_limits").update({ limit_amount: amount }).eq("id", row.id)
        : await supabase.from("category_limits").insert({ user_id: user.id, category: open, limit_amount: amount });
      if (error) throw error;
      toast.success(`Limite de ${open} definido`);
      notifyFinanceDataChanged();
    } catch { toast.error("Não foi possível salvar o limite"); } finally { setSaving(false); }
  };

  const removeLimit = async () => {
    if (!user || !open) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("category_limits").delete().eq("user_id", user.id).eq("category", open);
      if (error) throw error;
      toast.success("Limite removido");
      notifyFinanceDataChanged();
    } catch { toast.error("Não foi possível remover o limite"); } finally { setSaving(false); }
  };

  return (
    <Screen onRefresh={async () => { await refetch(); await loadLimits(); }}>
      <PageHeader title="Categorias" subtitle={`Gastos de ${MONTH_NAMES[selectedMonth].toLowerCase()}`} action={<MonthPicker month={selectedMonth} year={selectedYear} onChange={setMonth} />} />

      <Text size={15} color={white(0.66)} style={{ marginTop: 24 }}>Total gasto</Text>
      <Text weight="extrabold" size={38} tabular style={{ letterSpacing: -1 }}>{fmt(total)}</Text>
      {totalDelta !== null && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
          {totalDelta > 0 ? <ArrowUpRight size={14} color={colors.red} /> : <ArrowDownRight size={14} color={colors.green} />}
          <Text size={13} color={totalDelta > 0 ? colors.red : colors.green} tabular>{Math.abs(totalDelta)}% {totalDelta > 0 ? "a mais" : "a menos"} que no mês passado</Text>
        </View>
      )}

      {total > 0 && (
        <View style={{ marginTop: 16, height: 10, flexDirection: "row", gap: 2, borderRadius: 5, overflow: "hidden" }}>
          {cats.map((c) => <View key={c.name} style={{ width: `${Math.max((c.amount / total) * 100, 1)}%`, backgroundColor: hsl(getCategoryColor(c.name, custom)) }} />)}
        </View>
      )}

      <SectionTitle>Por categoria</SectionTitle>
      {cats.length === 0 ? (
        <Text size={14} color={white(0.56)} align="center" style={{ paddingVertical: 40 }}>Nenhuma despesa neste mês</Text>
      ) : (
        <Glass radius={22} style={{ paddingHorizontal: 16 }}>
          {cats.map((c, i) => {
            const Icon = getCategoryIcon(c.name, custom);
            const col = hsl(getCategoryColor(c.name, custom));
            const was = prevByName.get(c.name) ?? 0;
            const delta = was > 0 ? Math.round(((c.amount - was) / was) * 100) : null;
            const limit = limits[c.name];
            const over = limit > 0 && c.amount > limit;
            return (
              <Pressable key={c.name} onPress={() => setOpen(c.name)} style={{ paddingVertical: 14, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: white(0.06) }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: tint(col, 0.15) }}><Icon size={18} color={col} /></View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text weight="semibold" size={15} numberOfLines={1}>{c.name}</Text>
                    <Text size={12} color={white(0.56)} tabular>{total > 0 ? Math.round((c.amount / total) * 100) : 0}% do total{delta !== null ? ` · ${delta > 0 ? "+" : ""}${delta}% vs mês passado` : ""}</Text>
                  </View>
                  <Text weight="bold" size={15} tabular color={over ? colors.red : "#fff"}>{fmt(c.amount)}</Text>
                  <ChevronRight size={16} color={white(0.38)} />
                </View>
                {limit > 0 && (
                  <View style={{ marginTop: 10 }}>
                    <ProgressBar ratio={c.amount / limit} color={over ? colors.red : col} height={5} track={white(0.08)} />
                    <Text size={11} color={over ? colors.red : white(0.56)} tabular style={{ marginTop: 4 }}>{over ? `Passou ${fmt(c.amount - limit)} do limite` : `Limite ${fmt(limit)} · resta ${fmt(limit - c.amount)}`}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </Glass>
      )}

      <BottomSheet open={!!open} onClose={() => setOpen(null)} size="full">
        {open && (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}>
            <Text display weight="bold" size={22}>{open}</Text>
            <Text weight="extrabold" size={30} tabular style={{ letterSpacing: -0.6 }}>{fmt(current?.amount ?? 0)}</Text>
            {current && (prevByName.get(open) ?? 0) > 0 && <Text size={13} color={white(0.62)} tabular>Mês passado: {fmt(prevByName.get(open)!)}</Text>}

            <View style={{ marginTop: 20, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Gauge size={16} color={white(0.74)} />
              <Text weight="semibold" size={15}>Limite do mês</Text>
            </View>
            <View style={{ marginTop: 10 }}><MoneyField cents={limitCents} onChange={setLimitCents} chips={[100, 300, 500, 1000]} /></View>
            <View style={{ marginTop: 12, flexDirection: "row", gap: 10 }}>
              <Button label={saving ? "Salvando…" : "Definir limite"} height={48} disabled={limitCents <= 0 || saving} style={{ flex: 1 }} onPress={saveLimit} />
              {limits[open] > 0 && <Button label="Remover" variant="danger" height={48} icon={<Trash2 size={15} color={colors.red} />} disabled={saving} onPress={removeLimit} />}
            </View>

            <Text weight="semibold" size={15} style={{ marginTop: 24, marginBottom: 6 }}>Lançamentos</Text>
            {txs.length === 0 ? (
              <Text size={13} color={white(0.56)}>Nada lançado nesta categoria no mês.</Text>
            ) : (
              txs.map((t) => (
                <Pressable key={t.id} onPress={() => { setOpen(null); router.push({ pathname: "/transacao/[id]", params: { id: t.id } }); }} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, borderTopWidth: 1, borderTopColor: white(0.06) }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text weight="medium" size={14.5} numberOfLines={1}>{t.name}</Text>
                    <Text size={12} color={white(0.56)}>{t.date ? `${t.date.slice(8, 10)}/${t.date.slice(5, 7)}` : ""}</Text>
                  </View>
                  <Text weight="semibold" size={14.5} tabular>{fmt(Number(t.amount))}</Text>
                </Pressable>
              ))
            )}
          </ScrollView>
        )}
      </BottomSheet>
    </Screen>
  );
}
