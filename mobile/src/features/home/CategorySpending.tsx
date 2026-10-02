import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { supabase } from "@/integrations/supabase/client";
import { getCategoryColor, getCategoryIcon } from "@/lib/categoryUtils";
import { getCustomCategories, type CustomCategory } from "@/services/categoryService";
import type { CategoryExpense } from "@/types/finance";
import { MONTH_NAMES, useMoney } from "@/components/projecoes/shared";
import { ProgressBar, Surface, Text, toast, white } from "~/ui";
import { hsl } from "~/lib/color";

const INITIAL_COUNT = 5;
const FALLBACK_COLORS = ["330 80% 60%", "250 70% 65%", "35 90% 55%", "200 80% 55%", "0 70% 55%", "60 70% 50%", "280 60% 55%", "180 60% 45%", "15 80% 55%"];

const colorFor = (name: string, fallbackIndex: number, custom?: CustomCategory[]) => {
  const c = getCategoryColor(name, custom);
  return c !== "220 10% 55%" ? c : FALLBACK_COLORS[fallbackIndex % FALLBACK_COLORS.length];
};

interface Props {
  categories: CategoryExpense[];
  month: number;
}

/** Quanto foi para cada categoria no mês: barra empilhada, lista e os limites que você definiu. */
export const CategorySpending = memo(function CategorySpending({ categories, month }: Props) {
  const router = useRouter();
  const { fmt } = useMoney();
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [limits, setLimits] = useState<Record<string, number>>({});
  const notified = useRef<Set<string>>(new Set());

  useEffect(() => {
    getCustomCategories().then(setCustomCategories).catch(() => {});
  }, []);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("category_limits").select("category, limit_amount");
      if (!data) return;
      const map: Record<string, number> = {};
      for (const row of data) map[row.category] = Number(row.limit_amount);
      setLimits(map);
    };
    load();
    (window as any).addEventListener("finance-data-changed", load);
    return () => (window as any).removeEventListener("finance-data-changed", load);
  }, []);

  // Avisa uma vez por categoria que passou do limite
  useEffect(() => {
    if (Object.keys(limits).length === 0) return;
    for (const cat of categories) {
      const limit = limits[cat.name];
      if (limit > 0 && cat.amount > limit && !notified.current.has(cat.name)) {
        notified.current.add(cat.name);
        toast.error(`Limite ultrapassado em ${cat.name}`);
      }
    }
  }, [limits, categories]);

  const sorted = useMemo(() => [...categories].sort((a, b) => b.amount - a.amount), [categories]);
  const total = useMemo(() => sorted.reduce((sum, c) => sum + c.amount, 0), [sorted]);
  const visible = sorted.slice(0, INITIAL_COUNT);
  const visibleTotal = visible.reduce((s, c) => s + c.amount, 0);
  const monthLabel = MONTH_NAMES[month];

  const toggle = (name: string) => setSelected((cur) => (cur === name ? null : name));

  return (
    <Surface>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 }}>
        <View>
          <Text size={11} weight="medium" color={white(0.5)}>Gastos por categoria · {monthLabel}</Text>
          <Text weight="bold" size={20} tabular style={{ marginTop: 2 }}>{fmt(total)}</Text>
        </View>
        <Pressable onPress={() => router.push("/analise-categorias")} style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
          <Text size={11} weight="medium" color={white(0.7)}>Análise completa</Text>
          <ChevronRight size={12} color={white(0.7)} />
        </Pressable>
      </View>

      {sorted.length === 0 && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          <View style={{ height: 10, borderRadius: 5, backgroundColor: white(0.06) }} />
          <Text size={13} color={white(0.56)} style={{ marginTop: 12 }}>Nenhum gasto registrado em {monthLabel}.</Text>
        </View>
      )}

      {sorted.length > 0 && (
        <View style={{ paddingHorizontal: 16 }}>
          <View style={{ flexDirection: "row", height: 10, gap: 3 }}>
            {visible.map((cat) => {
              const pct = visibleTotal > 0 ? (cat.amount / visibleTotal) * 100 : 0;
              if (pct < 0.5) return null;
              const dim = selected !== null && selected !== cat.name;
              return (
                <Pressable
                  key={cat.name}
                  onPress={() => toggle(cat.name)}
                  style={{ flexGrow: pct, flexBasis: 0, minWidth: 6, borderRadius: 5, backgroundColor: hsl(colorFor(cat.name, sorted.indexOf(cat), customCategories)), opacity: dim ? 0.25 : 1 }}
                />
              );
            })}
          </View>

          {selected && (() => {
            const cat = sorted.find((c) => c.name === selected);
            if (!cat) return null;
            const pct = total > 0 ? Math.round((cat.amount / total) * 100) : 0;
            return (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, paddingHorizontal: 4 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: hsl(colorFor(cat.name, sorted.indexOf(cat), customCategories)) }} />
                <Text size={11} weight="semibold">{cat.name}</Text>
                <Text size={11} color={white(0.6)} tabular>{fmt(cat.amount)} · {pct}%</Text>
              </View>
            );
          })()}
        </View>
      )}

      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, gap: 10 }}>
        {visible.map((cat) => {
          const pct = total > 0 ? Math.round((cat.amount / total) * 100) : 0;
          const colorTriplet = colorFor(cat.name, sorted.indexOf(cat), customCategories);
          const Icon: any = getCategoryIcon(cat.name, customCategories);
          const limit = limits[cat.name];
          const hasLimit = limit !== undefined && limit > 0;
          const ratio = hasLimit ? cat.amount / limit : 0;

          let barColor = hsl(colorTriplet);
          let limitLabel = "";
          if (hasLimit && ratio > 1) {
            barColor = hsl("0 70% 55%");
            limitLabel = "Limite ultrapassado";
          } else if (hasLimit && ratio >= 0.8) {
            barColor = hsl("35 90% 55%");
            limitLabel = "Perto do limite";
          }
          const barRatio = hasLimit ? Math.min(cat.amount / limit, 1) : total > 0 ? cat.amount / total : 0;
          const dim = selected !== null && selected !== cat.name;

          return (
            <Pressable key={cat.name} onPress={() => toggle(cat.name)} style={{ flexDirection: "row", alignItems: "center", gap: 12, opacity: dim ? 0.35 : 1 }}>
              <View style={{ width: 20, alignItems: "center" }}>
                <Icon size={16} color={hsl(colorTriplet)} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text size={12} weight="semibold" numberOfLines={1} style={{ flexShrink: 1 }}>{cat.name}</Text>
                  {!!limitLabel && <Text size={9} weight="medium" color={ratio > 1 ? "#F87171" : "#F59E0B"}>{limitLabel}</Text>}
                </View>
                <View style={{ marginTop: 4 }}>
                  <ProgressBar ratio={barRatio} color={barColor} height={6} track={white(0.08)} />
                </View>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text size={12} weight="bold" tabular>{fmt(cat.amount)}</Text>
                <Text size={9} color={white(0.5)} tabular>{hasLimit ? `/ ${fmt(limit)}` : `${pct}%`}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {sorted.length > INITIAL_COUNT && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          <Pressable
            onPress={() => router.push("/analise-categorias")}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderTopWidth: 1, borderTopColor: white(0.06), paddingTop: 12, opacity: pressed ? 0.7 : 1 })}
          >
            <Text size={12.5} weight="medium" color={white(0.7)}>Ver as {sorted.length} categorias</Text>
            <ChevronRight size={14} color={white(0.7)} />
          </Pressable>
        </View>
      )}
    </Surface>
  );
});
