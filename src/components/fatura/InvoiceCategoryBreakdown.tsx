import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { formatCurrency } from "@/pages/FaturaCartao";
import { getCategoryIcon, getCategoryColor } from "@/lib/categoryUtils";
import { getCustomCategories, type CustomCategory } from "@/services/categoryService";

interface CategoryData {
  category: string;
  total: number;
  count: number;
  percentage: number;
}

interface Props {
  categories: CategoryData[];
  total: number;
}

const PREVIEW = 5;

export default function InvoiceCategoryBreakdown({ categories, total }: Props) {
  const [customCats, setCustomCats] = useState<CustomCategory[]>([]);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => { getCustomCategories().then(setCustomCats).catch(() => {}); }, []);

  const sorted = [...categories].sort((a, b) => b.total - a.total);
  const shown = showAll ? sorted : sorted.slice(0, PREVIEW);
  const biggest = sorted[0];

  return (
    <div className="mt-4 rounded-[22px] border border-white/[0.08] willo-glass p-5">
      <div className="flex items-baseline justify-between">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-white/50">Gastos por categoria</p>
        <p className="text-[13px] font-semibold text-white tabular-nums">{formatCurrency(total)}</p>
      </div>

      {/* The whole statement as one bar, so the split reads at a glance */}
      <div className="mt-3 flex h-2 w-full gap-[2px] overflow-hidden rounded-full">
        {sorted.map((cat) => (
          <span
            key={cat.category}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{ width: `${Math.max(cat.percentage, 1)}%`, background: `hsl(${getCategoryColor(cat.category, customCats)})` }}
          />
        ))}
      </div>

      {biggest && (
        <p className="mt-2.5 text-[12.5px] text-white/62">
          <span className="font-semibold text-white">{biggest.category}</span> lidera com {biggest.percentage.toFixed(0)}% do total
        </p>
      )}

      <div className="mt-4 space-y-3">
        <AnimatePresence initial={false}>
          {shown.map((cat, index) => {
            const color = getCategoryColor(cat.category, customCats);
            const IconComponent = getCategoryIcon(cat.category, customCats);
            return (
              <motion.div
                key={cat.category}
                layout
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: index * 0.03 }}
                className="flex items-center gap-3"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                  style={{ background: `hsl(${color} / 0.15)` }}
                >
                  <IconComponent className="h-4 w-4" style={{ color: `hsl(${color})` }} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-[14px] text-white">{cat.category}</p>
                    <p className="shrink-0 text-[14px] font-semibold text-white tabular-nums">{formatCurrency(cat.total)}</p>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                      <motion.span
                        className="block h-full rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${cat.percentage}%` }}
                        transition={{ delay: 0.1 + index * 0.04, duration: 0.5, ease: "easeOut" }}
                        style={{ background: `hsl(${color})` }}
                      />
                    </span>
                    <span className="shrink-0 text-[11px] tabular-nums text-white/50">
                      {cat.percentage.toFixed(0)}% · {cat.count} {cat.count === 1 ? "compra" : "compras"}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {sorted.length > PREVIEW && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-4 flex h-10 w-full items-center justify-center gap-1.5 rounded-full bg-white/[0.05] text-[13px] font-medium text-white/82 active:opacity-70"
        >
          {showAll ? "Mostrar menos" : `Ver todas as ${sorted.length} categorias`}
          <ChevronDown className={`h-4 w-4 transition-transform ${showAll ? "rotate-180" : ""}`} />
        </button>
      )}
    </div>
  );
}
