import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown, ChevronRight, ShoppingCart, Home, Car, HeartPulse, Gamepad2, ShoppingBag,
  GraduationCap, Landmark, MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { currencySymbol, getCurrency } from "@/lib/currency";
export interface OverviewCategory {
  name: string;
  amount: number;
  percentage: number;
  hexColor: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });

export const formatCompactBRL = (v: number) =>
  v >= 1000
    ? `${currencySymbol()} ${new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(v)}`
    : fmt(v);

// ── Groups ───────────────────────────────────────────────
interface GroupDef {
  name: string;
  hex: string;
  icon: React.ComponentType<{ className?: string }>;
  categories: string[];
}

const GROUPS: GroupDef[] = [
  { name: "Alimentação", hex: "#F97316", icon: ShoppingCart, categories: ["Alimentação", "Supermercado", "Bebidas", "Delivery", "Cafeteria", "Fast Food", "Restaurantes", "Padaria"] },
  { name: "Moradia", hex: "#6366F1", icon: Home, categories: ["Moradia", "Aluguel", "Condomínio", "Casa", "Contas", "Energia", "Conta de Luz", "Conta de Água", "Conta de Gás", "Internet"] },
  { name: "Transporte", hex: "#3B82F6", icon: Car, categories: ["Transporte", "Combustível", "Viagem"] },
  { name: "Saúde e bem-estar", hex: "#EF4444", icon: HeartPulse, categories: ["Saúde", "Academia", "Beleza", "Pets", "Farmácia"] },
  { name: "Lazer", hex: "#EC4899", icon: Gamepad2, categories: ["Lazer", "Assinaturas", "Presentes", "Streaming"] },
  { name: "Compras", hex: "#F59E0B", icon: ShoppingBag, categories: ["Compras", "Vestuário", "Tecnologia", "Eletrônicos"] },
  { name: "Educação", hex: "#14B8A6", icon: GraduationCap, categories: ["Educação", "Cursos", "Livros"] },
  { name: "Finanças", hex: "#22C55E", icon: Landmark, categories: ["Impostos", "Investimentos", "Transferência", "Cartão de Crédito", "Seguros", "Tarifas", "Empréstimos"] },
];
const OTHER_GROUP: GroupDef = { name: "Outros", hex: "#64748B", icon: MoreHorizontal, categories: [] };

export interface CategoryGroup {
  def: GroupDef;
  amount: number;
  percentage: number;
  categories: OverviewCategory[];
}

export function groupCategories(categories: OverviewCategory[]): CategoryGroup[] {
  const total = categories.reduce((s, c) => s + c.amount, 0);
  const byGroup = new Map<GroupDef, OverviewCategory[]>();
  for (const cat of categories) {
    const def = GROUPS.find((g) => g.categories.some((c) => c.toLowerCase() === cat.name.toLowerCase())) ?? OTHER_GROUP;
    byGroup.set(def, [...(byGroup.get(def) ?? []), cat]);
  }
  return [...byGroup.entries()]
    .map(([def, cats]) => {
      const amount = cats.reduce((s, c) => s + c.amount, 0);
      return { def, amount, percentage: total > 0 ? Math.round((amount / total) * 100) : 0, categories: cats };
    })
    .sort((a, b) => b.amount - a.amount);
}

// ── Segmented control ────────────────────────────────────
export function ViewToggle<T extends string>({ value, options, onChange }: {
  value: T;
  options: { key: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid grid-flow-col auto-cols-fr isolate rounded-full border border-white/[0.08] willo-glass p-1">
      {options.map((o) => (
        <button key={o.key} onClick={() => onChange(o.key)} className="relative h-11 rounded-full text-[15px] font-semibold">
          {value === o.key && (
            <motion.span
              layoutId="category-view-toggle"
              className="pointer-events-none absolute inset-0 z-0 rounded-full bg-white"
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
            />
          )}
          <span className={cn("relative z-10 transform-gpu transition-colors", value === o.key ? "text-[#0B0B0B]" : "text-white")}>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

// ── Segmented spending ring ─────────────────────────────
export interface RingSegment {
  key: string;
  hex: string;
  amount: number;
}

export function SpendRing({ segments, total, caption }: { segments: RingSegment[]; total: number; caption: string }) {
  const SIZE = 264;
  const STROKE = 22;
  const R = (SIZE - STROKE) / 2;
  const C = 2 * Math.PI * R;
  const GAP = segments.length > 1 ? STROKE + 10 : 0;

  let offset = 0;
  const arcs = segments.map((seg) => {
    const len = Math.max((seg.amount / (total || 1)) * C, GAP + 2);
    const arc = { seg, start: offset, dash: Math.max(len - GAP, 0.1) };
    offset += len;
    return arc;
  });
  const fit = offset > 0 ? C / offset : 1;

  return (
    <div className="relative mx-auto" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} className="-rotate-90">
        {segments.length === 0 && (
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={STROKE} />
        )}
        {arcs.map(({ seg, start, dash }, i) => (
          <motion.circle
            key={seg.key}
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke={seg.hex}
            strokeWidth={STROKE}
            strokeLinecap={segments.length > 1 ? "round" : "butt"}
            strokeDashoffset={-(start * fit + GAP / 2)}
            initial={{ strokeDasharray: `0 ${C}` }}
            animate={{ strokeDasharray: `${segments.length > 1 ? dash * fit : C} ${C}` }}
            transition={{ delay: i * 0.06, duration: 0.6, ease: "easeOut" }}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[30px] font-extrabold tracking-tight text-white tabular-nums">{formatCompactBRL(total)}</span>
        <span className="text-[14px] text-white/66">{caption}</span>
      </div>
    </div>
  );
}

// ── Top spend (inline highlight) ────────────────────────
export function TopSpendRow({ category, monthLabel, onOpen }: {
  category: OverviewCategory;
  monthLabel: string;
  onOpen: (name: string) => void;
}) {
  const Icon = category.icon;
  return (
    <button
      onClick={() => onOpen(category.name)}
      className="flex w-full items-center gap-3.5 rounded-[22px] border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-3.5 text-left active:scale-[0.99] transition-transform"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full" style={{ background: `${category.hexColor}26` }}>
        <Icon className="h-5 w-5" style={{ color: category.hexColor }} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] text-white/62">Maior gasto em {monthLabel}</span>
        <span className="block truncate text-[16px] font-semibold text-white">{category.name}</span>
      </span>
      <span className="text-right">
        <span className="block text-[16px] font-semibold text-white tabular-nums">{fmt(category.amount)}</span>
        <span className="block text-[12px] text-white/62 tabular-nums">{category.percentage}% do total</span>
      </span>
    </button>
  );
}

// ── Lists ────────────────────────────────────────────────
export function CategoryRows({ categories, onOpen }: {
  categories: OverviewCategory[];
  onOpen: (name: string) => void;
}) {
  return (
    <div className="space-y-1">
      {categories.map((cat, i) => {
        const Icon = cat.icon;
        return (
          <motion.button
            key={cat.name}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            onClick={() => onOpen(cat.name)}
            className="flex w-full items-center gap-3.5 rounded-2xl px-1 py-2.5 text-left transition-colors active:bg-white/[0.04]"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full willo-glass-inset">
              <Icon className="h-5 w-5" style={{ color: cat.hexColor }} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[16px] font-medium text-white">{cat.name}</span>
              <span className="block text-[15px] text-white/62 tabular-nums">{cat.percentage}%</span>
            </span>
            <span className="text-[16px] font-medium text-white tabular-nums">{fmt(cat.amount)}</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-white/38" />
          </motion.button>
        );
      })}
    </div>
  );
}

/** Groups expand in place to show what was spent in each category — no navigation. */
export function GroupCards({ groups }: { groups: CategoryGroup[] }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="space-y-2.5">
      {groups.map((g, i) => {
        const Icon = g.def.icon;
        const isOpen = open === g.def.name;
        return (
          <motion.div
            key={g.def.name}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="overflow-hidden rounded-[22px] willo-glass-inset"
          >
            <button
              onClick={() => setOpen(isOpen ? null : g.def.name)}
              className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full" style={{ background: g.def.hex }}>
                <Icon className="h-5 w-5 text-white" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-medium text-white">{g.def.name}</span>
                <span className="block text-[15px] text-white/62 tabular-nums">{g.percentage}%</span>
              </span>
              <span className="text-[16px] font-medium text-white tabular-nums">{fmt(g.amount)}</span>
              <ChevronDown className={cn("h-4 w-4 shrink-0 text-white/74 transition-transform", isOpen && "rotate-180")} />
            </button>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                >
                  <div className="mx-4 border-t border-white/[0.08]" />
                  <div className="px-4 pb-3 pt-1">
                    {g.categories.map((cat) => {
                      const CatIcon = cat.icon;
                      const share = g.amount > 0 ? Math.round((cat.amount / g.amount) * 100) : 0;
                      return (
                        <div key={cat.name} className="flex items-center gap-3.5 py-2.5">
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/[0.06]">
                            <CatIcon className="h-5 w-5" style={{ color: cat.hexColor }} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px] text-white">{cat.name}</span>
                            {g.categories.length > 1 && <span className="block text-[13px] text-white/56 tabular-nums">{share}% do grupo</span>}
                          </span>
                          <span className="text-[15px] text-white tabular-nums">{fmt(cat.amount)}</span>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}
