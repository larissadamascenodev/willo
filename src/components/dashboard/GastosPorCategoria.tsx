import { memo, useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, ChevronRight } from "lucide-react";
import type { CategoryExpense } from "@/types/finance";
import { getCategoryIcon, getCategoryColor } from "@/lib/categoryUtils";
import { getCustomCategories, type CustomCategory } from "@/services/categoryService";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { getCurrency } from "@/lib/currency";
interface Props {
  categories: CategoryExpense[];
  selectedMonth?: number;
  onVerAnalise?: () => void;
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });
const INITIAL_COUNT = 5;

const FALLBACK_COLORS = [
  "330 80% 60%", "250 70% 65%", "35 90% 55%", "200 80% 55%",
  "0 70% 55%", "60 70% 50%", "280 60% 55%", "180 60% 45%", "15 80% 55%",
];

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const getCatColor = (name: string, fallbackIdx: number, customCats?: CustomCategory[]): string => {
  const c = getCategoryColor(name, customCats);
  if (c !== "220 10% 55%") return c;
  return FALLBACK_COLORS[fallbackIdx % FALLBACK_COLORS.length];
};

const GastosPorCategoria = memo(({ categories, selectedMonth, onVerAnalise }: Props) => {
  const navigate = useNavigate();
  const [customCats, setCustomCats] = useState<CustomCategory[]>([]);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [limits, setLimits] = useState<Record<string, number>>({});

  useEffect(() => { getCustomCategories().then(setCustomCats).catch(() => {}); }, []);

  // Fetch category limits
  const notifiedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const fetchLimits = async () => {
      const { data } = await supabase
        .from("category_limits")
        .select("category, limit_amount");
      if (data) {
        const map: Record<string, number> = {};
        for (const row of data) {
          map[row.category] = Number(row.limit_amount);
        }
        setLimits(map);
      }
    };
    fetchLimits();

    const handleChange = () => fetchLimits();
    window.addEventListener("finance-data-changed", handleChange);
    return () => window.removeEventListener("finance-data-changed", handleChange);
  }, []);

  // Notify when limits are exceeded
  useEffect(() => {
    if (Object.keys(limits).length === 0 || categories.length === 0) return;
    categories.forEach((cat) => {
      const limit = limits[cat.name];
      if (limit && limit > 0 && cat.amount > limit && !notifiedRef.current.has(cat.name)) {
        notifiedRef.current.add(cat.name);
        toast.error(`Limite ultrapassado em ${cat.name}`, {
          description: `Gasto: ${fmt(cat.amount)} / Limite: ${fmt(limit)}`,
        });
      }
    });
  }, [limits, categories]);

  const sorted = useMemo(() => [...categories].sort((a, b) => b.amount - a.amount), [categories]);
  const totalExpenses = useMemo(() => sorted.reduce((sum, c) => sum + c.amount, 0), [sorted]);
  // A summary card: the full list belongs to the categories page
  const visible = sorted.slice(0, INITIAL_COUNT);

  const monthLabel = selectedMonth !== undefined ? MONTH_NAMES[selectedMonth] : MONTH_NAMES[new Date().getMonth()];

  const handleBarClick = (catName: string) => {
    setSelectedCat(prev => prev === catName ? null : catName);
  };

  return (
    <div
      className="rounded-[22px] border border-white/[0.08] willo-glass overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-[14px] pb-3.5 pt-3.5">
        <div className="min-w-0">
          <p className="text-[12px] text-white/50">Gastos por categoria · {monthLabel}</p>
          <p className="mt-1.5 truncate text-[26px] font-extrabold leading-none tracking-[-0.035em] tabular-nums text-white">
            {fmt(totalExpenses)}
          </p>
        </div>
        <button
          onClick={() => navigate("/analytics/categorias")}
          className="mt-0.5 flex shrink-0 items-center gap-0.5 text-[12px] font-semibold text-white/55 active:opacity-70"
        >
          Análise <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {sorted.length === 0 && (
        <div className="px-4 pb-4">
          <div className="h-2.5 rounded-full bg-white/[0.06]" />
          <p className="mt-3 text-[13px] text-white/56">Nenhum gasto registrado em {monthLabel}.</p>
        </div>
      )}

      {/* Stacked color bar */}
      <div className="px-[14px]">
        <div className="flex h-2 gap-[3px]">
          {visible.map((cat) => {
            const idx = sorted.indexOf(cat);
            const visibleTotal = visible.reduce((s, c) => s + c.amount, 0);
            const pct = visibleTotal > 0 ? (cat.amount / visibleTotal) * 100 : 0;
            if (pct < 0.5) return null;
            const color = getCatColor(cat.name, idx, customCats);
            const isSelected = selectedCat === cat.name;
            const hasSel = selectedCat !== null;

            return (
              <motion.div
                key={cat.name}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ delay: idx * 0.05, duration: 0.5, ease: "easeOut" }}
                className="h-full rounded-full cursor-pointer transition-opacity duration-200"
                style={{
                  backgroundColor: `hsl(${color})`,
                  minWidth: "6px",
                  opacity: hasSel && !isSelected ? 0.25 : 1,
                }}
                onClick={() => handleBarClick(cat.name)}
              />
            );
          })}
        </div>

        {/* Selected category tooltip */}
        {selectedCat && (() => {
          const cat = sorted.find(c => c.name === selectedCat);
          if (!cat) return null;
          const idx = sorted.indexOf(cat);
          const color = getCatColor(cat.name, idx, customCats);
          const pct = totalExpenses > 0 ? Math.round((cat.amount / totalExpenses) * 100) : 0;
          return (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 mt-2 px-1"
            >
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: `hsl(${color})` }} />
              <span className="text-[11px] font-semibold text-foreground">{cat.name}</span>
              <span className="text-[11px] text-muted-foreground/60 tabular-nums">{fmt(cat.amount)} · {pct}%</span>
            </motion.div>
          );
        })()}
      </div>

      {/* Category list */}
      <div className="mt-3.5 px-[14px] pb-[14px]">
        {visible.map((cat, index) => {
          const pct = totalExpenses > 0 ? Math.round((cat.amount / totalExpenses) * 100) : 0;
          const color = getCatColor(cat.name, sorted.indexOf(cat), customCats);
          const IconComponent = getCategoryIcon(cat.name, customCats);
          const isSelected = selectedCat === cat.name;
          const hasSel = selectedCat !== null;
          const limit = limits[cat.name];
          const hasLimit = limit !== undefined && limit > 0;
          const limitRatio = hasLimit ? cat.amount / limit : 0;
          const maxScale = hasLimit ? Math.max(cat.amount, limit) * 1.2 : totalExpenses;
          const barPct = hasLimit ? Math.min((cat.amount / maxScale) * 100, 100) : pct;
          const markerPct = hasLimit ? (limit / maxScale) * 100 : 0;

          // Color based on limit proximity
          let barColor = `hsl(${color})`;
          let limitLabel = "";
          if (hasLimit) {
            if (limitRatio > 1) {
              barColor = "hsl(0 70% 55%)"; // red
              limitLabel = "Limite ultrapassado";
            } else if (limitRatio >= 0.8) {
              barColor = "hsl(35 90% 55%)"; // amber/warning
              limitLabel = "Perto do limite";
            }
          }

          return (
            <motion.div
              key={cat.name}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.03 }}
              className={cn(
                "flex cursor-pointer items-center gap-3 py-2.5 transition-opacity duration-200",
                index > 0 && "border-t border-white/[0.06]",
              )}
              style={{ opacity: hasSel && !isSelected ? 0.35 : 1 }}
              onClick={() => handleBarClick(cat.name)}
            >
              <IconComponent className="h-[17px] w-[17px] shrink-0" style={{ color: `hsl(${color})` }} />

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <p className="truncate text-[13.5px] font-semibold text-white">{cat.name}</p>
                  {hasLimit && limitLabel && (
                    <span className={cn("shrink-0 text-[10px] font-semibold", limitRatio > 1 ? "text-red-400" : "text-amber-400")}>
                      {limitLabel}
                    </span>
                  )}
                </div>
                {/* Only drawn for a category with a limit, where it carries the marker.
                    Without one it would be a third drawing of a share the stacked bar
                    and the percentage already give. */}
                {hasLimit && (
                  <div className="relative mt-1.5 h-1 w-full overflow-visible rounded-full bg-white/[0.08]">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${barPct}%` }}
                      transition={{ delay: 0.1 + index * 0.04, duration: 0.5, ease: "easeOut" }}
                      className="absolute left-0 top-0 h-full rounded-full"
                      style={{ backgroundColor: barColor }}
                    />
                    <div
                      className="absolute top-[-2px] h-[calc(100%+4px)] w-[2px] rounded-full bg-white/60"
                      style={{ left: `${markerPct}%` }}
                      title={`Limite: ${fmt(limit)}`}
                    />
                  </div>
                )}
              </div>

              <div className="shrink-0 text-right">
                <p className="text-[13.5px] font-bold tabular-nums text-white">{fmt(cat.amount)}</p>
                <p className="text-[10.5px] tabular-nums text-white/40">
                  {hasLimit ? `de ${fmt(limit)}` : `${pct}%`}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

    </div>
  );
});

GastosPorCategoria.displayName = "GastosPorCategoria";
export default GastosPorCategoria;