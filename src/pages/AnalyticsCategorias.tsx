import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Sparkles, TrendingUp, TrendingDown,
  AlertTriangle, Target, Brain, PieChart as PieChartIcon, Info, ShieldCheck,
  Repeat, ChevronLeft, Check, Plus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMonth } from "@/contexts/MonthContext";
import { getRecurringForMonth } from "@/services/recurringService";
import { dayOfMonth } from "@/lib/dateOnly";
import { getCustomCategories, type CustomCategory } from "@/services/categoryService";
import { getCategoryIcon, getCategoryColor, getCategoryHexColor } from "@/lib/categoryUtils";
import MonthSelector from "@/components/dashboard/MonthSelector";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
  Sector,
} from "recharts";
import { toast } from "sonner";
import CategoryLimitSheet from "@/components/dashboard/CategoryLimitSheet";
import {
  SpendRing, TopSpendRow, CategoryRows, GroupCards, ViewToggle, groupCategories,
} from "@/components/analytics/CategoryOverviewViews";

import { currencySymbol, getCurrency } from "@/lib/currency";
// ── Helpers ──────────────────────────────────────────────
const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const SHORT_MONTH_NAMES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

// ── Types ────────────────────────────────────────────────
interface TxRow {
  id: string; name: string; category: string; date: string;
  amount: number; type: string; status: string;
  recurrence_type?: string; installments?: number | null;
  installment_current?: number | null; parent_transaction_id?: string | null;
  payment_method?: string; credit_card_id?: string | null;
}

interface CategorySummary {
  name: string;
  amount: number;
  percentage: number;
  color: string;
  hexColor: string;
  icon: React.ComponentType<any>;
  txCount: number;
  avgPerTx: number;
}

interface AIInsights {
  insights: string[];
  alerts: { category: string; message: string; severity: "info" | "warning" | "danger" }[];
  limitSuggestions: { category: string; suggestedLimit: number; message: string }[];
}

interface HistoricalEntry {
  month: number;
  year: number;
  label: string;
  amount: number;
}


type HistoricalMap = Record<string, HistoricalEntry[]>;

interface InstallmentImpact {
  category: string;
  monthlyAmount: number;
  totalRemaining: number;
  monthsRemaining: number;
  impactPct: number;
  items: { name: string; amount: number; remaining: number; total: number; paidInstallments: number }[];
}

type InstallmentImpactMap = Record<string, InstallmentImpact>;

interface HabitData {
  category: string;
  txCount: number;
  dailyCost: number;
  isHabit: boolean;
  topMerchant: { name: string; count: number } | null;
  amount: number;
}

type CategoryScore = "saudavel" | "atencao" | "exagerado";

interface CategoryScoreData {
  score: CategoryScore;
  percentage: number;
  variation: number | null;
  txCount: number;
}

const SCORE_CONFIG = {
  exagerado: { label: "Exagerado", emoji: "🔴", bg: "bg-destructive/10", text: "text-destructive", border: "border-destructive/20" },
  atencao: { label: "Atenção", emoji: "🟡", bg: "bg-warning/10", text: "text-warning", border: "border-warning/20" },
  saudavel: { label: "Saudável", emoji: "🟢", bg: "bg-success/10", text: "text-success", border: "border-success/20" },
};

function computeCategoryScore(pct: number, variation: number | null, txCount: number): CategoryScore {
  // 🔴 Exagerado: any condition triggers it
  if (pct > 30 || (variation !== null && variation > 25) || txCount >= 10) return "exagerado";
  // 🟡 Atenção
  if ((pct >= 15 && pct <= 30) || (variation !== null && variation >= 10 && variation <= 25) || (txCount >= 6 && txCount <= 9)) return "atencao";
  // 🟢 Saudável
  return "saudavel";
}

// ── Reusable Glass Card ──────────────────────────────────
const GlassCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div
    className={`rounded-[22px] border border-white/[0.12] willo-glass ${className}`}
    
  >
    {children}
  </div>
);

// ── Donut: default center shows total ────────────────────
const DonutDefaultCenter = ({ total }: { total: number }) => (
  <g>
    <text x="50%" y="46%" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize={10} fontWeight={600}>
      Total Despesas
    </text>
    <text x="50%" y="58%" textAnchor="middle" fill="hsl(var(--foreground))" fontSize={16} fontWeight={800}>
      {fmt(total)}
    </text>
  </g>
);

// ── Custom active shape for donut ─────────────────────────
const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent } = props;
  return (
    <g>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 6} startAngle={startAngle} endAngle={endAngle} fill={fill} opacity={0.9} />
      <Sector cx={cx} cy={cy} innerRadius={innerRadius - 3} outerRadius={innerRadius - 1} startAngle={startAngle} endAngle={endAngle} fill={fill} opacity={0.3} />
      <text x={cx} y={cy - 12} textAnchor="middle" fill="hsl(var(--foreground))" fontSize={10} fontWeight={700}>
        {payload.fullName}
      </text>
      <text x={cx} y={cy + 6} textAnchor="middle" fill="hsl(var(--foreground))" fontSize={16} fontWeight={800}>
        {fmt(payload.value)}
      </text>
      <text x={cx} y={cy + 22} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize={10} fontWeight={600}>
        {(percent * 100).toFixed(0)}%
      </text>
    </g>
  );
};

// ── Default (non-active) donut shape ─────────────────────
const renderDefaultShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius} startAngle={startAngle} endAngle={endAngle} fill={fill} />
  );
};

// ── Comparison Insights Section (carousel) ────────────────
const ComparisonInsightsSection = ({ categoryData, prevCategoryData }: {
  categoryData: CategorySummary[];
  prevCategoryData: { name: string; amount: number }[];
}) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const insights = useMemo(() => {
    const results: { message: string; severity: "up" | "down" | "new"; impact: number }[] = [];
    categoryData.forEach((cat) => {
      const prev = prevCategoryData.find((p) => p.name === cat.name);
      const prevAmount = prev?.amount ?? 0;
      if (prevAmount === 0 && cat.amount > 0) { results.push({ message: `Você começou a gastar com ${cat.name} esse mês`, severity: "new", impact: cat.amount }); return; }
      if (prevAmount === 0) return;
      const variation = ((cat.amount - prevAmount) / prevAmount) * 100;
      if (variation > 20) results.push({ message: `Seus gastos com ${cat.name} aumentaram bastante esse mês 👀`, severity: "up", impact: Math.abs(variation) });
      else if (variation >= 5) results.push({ message: `${cat.name} teve um leve aumento esse mês`, severity: "up", impact: Math.abs(variation) });
      else if (variation < -1) results.push({ message: `Boa! Você reduziu seus gastos com ${cat.name} 👏`, severity: "down", impact: Math.abs(variation) });
    });
    return results.sort((a, b) => b.impact - a.impact).slice(0, 5);
  }, [categoryData, prevCategoryData]);

  useEffect(() => {
    if (insights.length <= 1) return;
    timerRef.current = setInterval(() => { setCurrentIdx((p) => (p + 1) % insights.length); }, 4500);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [insights.length]);

  if (insights.length === 0) return null;

  const severityConfig = {
    up: { icon: TrendingUp, bg: "bg-destructive/5", border: "border-destructive/15", text: "text-destructive" },
    down: { icon: TrendingDown, bg: "bg-success/5", border: "border-success/15", text: "text-success" },
    new: { icon: Sparkles, bg: "bg-blue-500/5", border: "border-blue-500/15", text: "text-blue-400" },
  };
  const current = insights[currentIdx];
  const config = severityConfig[current.severity];
  const Icon = config.icon;

  return (
    <GlassCard className="p-4 md:p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm">💡</span>
        <p className="text-[14px] font-semibold text-white">
          Insights Inteligentes
        </p>
      </div>
      <div className="relative overflow-hidden" style={{ minHeight: 48 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIdx}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.35 }}
            className={`flex items-start gap-2.5 p-2.5 rounded-xl ${config.bg} border ${config.border}`}
          >
            <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${config.text}`} />
            <p className="text-xs text-foreground/80 leading-relaxed">{current.message}</p>
          </motion.div>
        </AnimatePresence>
      </div>
      {insights.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-2.5">
          {insights.map((_, i) => (
            <button key={i} onClick={() => setCurrentIdx(i)}
              className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i === currentIdx ? "bg-primary w-4" : "bg-muted-foreground/20"}`} />
          ))}
        </div>
      )}
    </GlassCard>
  );
};

// ── AI Insights Section (carousel) ───────────────────────
const AIInsightsSection = ({ insights, loading }: { insights: AIInsights | null; loading: boolean }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const msgs = insights?.insights ?? [];

  useEffect(() => {
    if (msgs.length <= 1) return;
    timerRef.current = setInterval(() => {
      setCurrentIdx((prev) => (prev + 1) % msgs.length);
    }, 4000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [msgs.length]);

  if (loading) {
    return (
      <GlassCard className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-primary animate-pulse" />
          <p className="text-[10px] text-muted-foreground/60 font-semibold uppercase tracking-wider">
            Analisando seus gastos...
          </p>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-4 bg-muted/30 rounded animate-pulse" style={{ width: `${80 - i * 15}%` }} />
          ))}
        </div>
      </GlassCard>
    );
  }
  if (!insights || msgs.length === 0) return null;
  return (
    <GlassCard className="p-4 md:p-5">
      <div className="flex items-center gap-2 mb-3">
        <Brain className="w-4 h-4 text-primary" />
        <p className="text-[14px] font-semibold text-white">
          Dicas · Huby
        </p>
      </div>
      <div className="relative overflow-hidden" style={{ minHeight: 48 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIdx}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.35 }}
            className="flex items-start gap-2.5 p-2.5 rounded-xl bg-primary/5 border border-primary/10"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-foreground/80 leading-relaxed">{msgs[currentIdx]}</p>
          </motion.div>
        </AnimatePresence>
      </div>
      {msgs.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-2.5">
          {msgs.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIdx(i)}
              className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i === currentIdx ? "bg-primary w-4" : "bg-muted-foreground/20"}`}
            />
          ))}
        </div>
      )}
    </GlassCard>
  );
};

// ── Alerts Section (carousel) ────────────────────────────
const AlertsSection = ({ alerts }: { alerts: AIInsights["alerts"] }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!alerts || alerts.length <= 1) return;
    timerRef.current = setInterval(() => { setCurrentIdx((p) => (p + 1) % alerts.length); }, 5000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [alerts?.length]);

  if (!alerts || alerts.length === 0) return null;

  const severityConfig = {
    info: { icon: Info, borderColor: "border-blue-500/20", bgColor: "bg-blue-500/5", textColor: "text-blue-400" },
    warning: { icon: AlertTriangle, borderColor: "border-warning/20", bgColor: "bg-warning/5", textColor: "text-warning" },
    danger: { icon: AlertTriangle, borderColor: "border-destructive/20", bgColor: "bg-destructive/5", textColor: "text-destructive" },
  };
  const current = alerts[currentIdx];
  const config = severityConfig[current.severity];
  const AlertIcon = config.icon;

  return (
    <GlassCard className="p-4 md:p-5">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-warning" />
        <p className="text-[14px] font-semibold text-white">Alertas</p>
      </div>
      <div className="relative overflow-hidden" style={{ minHeight: 48 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIdx}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.35 }}
            className={`flex items-start gap-2.5 p-2.5 rounded-xl ${config.bgColor} border ${config.borderColor}`}
          >
            <AlertIcon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${config.textColor}`} />
            <div>
              <p className="text-[10px] font-semibold text-foreground/70 uppercase">{current.category}</p>
              <p className="text-xs text-foreground/80 mt-0.5">{current.message}</p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
      {alerts.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-2.5">
          {alerts.map((_, i) => (
            <button key={i} onClick={() => setCurrentIdx(i)}
              className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i === currentIdx ? "bg-warning w-4" : "bg-muted-foreground/20"}`} />
          ))}
        </div>
      )}
    </GlassCard>
  );
};





const LimitSuggestionItem = ({ suggestion, currentAmount, onApplied }: { suggestion: AIInsights["limitSuggestions"][0]; currentAmount: number; onApplied?: () => void }) => {
  const { user } = useAuth();
  const [customLimit, setCustomLimit] = useState(suggestion.suggestedLimit);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const monthlySaving = Math.max(currentAmount - customLimit, 0);
  const saving3m = monthlySaving * 3;
  const saving1y = monthlySaving * 12;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value.replace(/[^\d.,]/g, "").replace(",", "."));
    if (!isNaN(val) && val >= 0) setCustomLimit(val);
  };

  const handleApply = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("category_limits")
        .upsert(
          { user_id: user.id, category: suggestion.category, limit_amount: customLimit },
          { onConflict: "user_id,category" }
        );
      if (error) throw error;
      toast.success(`Limite de ${fmt(customLimit)} definido para ${suggestion.category}`, {
        description: monthlySaving > 0 ? `Economia potencial de ${fmt(saving1y)} por ano.` : undefined,
      });
      onApplied?.();
      window.dispatchEvent(new Event("finance-data-changed"));
    } catch {
      toast.error("Erro ao salvar limite");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="min-w-[260px] max-w-[290px] snap-start p-3 rounded-xl bg-primary/5 border border-primary/10 flex flex-col">
      <p className="text-xs font-semibold text-foreground">{suggestion.category}</p>
      <p className="text-[11px] text-muted-foreground/70 mt-1">{suggestion.message}</p>

      {/* Editable limit */}
      <div className="mt-2.5 flex items-center gap-2">
        <p className="text-[10px] text-muted-foreground/50 shrink-0">Limite:</p>
        {editing ? (
          <div className="flex items-center gap-1.5 flex-1">
            <span className="text-[11px] text-muted-foreground/60">{currencySymbol()}</span>
            <input
              type="number"
              value={customLimit}
              onChange={handleInputChange}
              onBlur={() => setEditing(false)}
              onKeyDown={(e) => e.key === "Enter" && setEditing(false)}
              autoFocus
              className="flex-1 bg-background/50 border border-border/30 rounded-lg px-2 py-1 text-xs font-bold text-foreground tabular-nums outline-none focus:border-primary/40 transition-colors"
              min={0}
              step={50}
            />
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-background/30 border border-border/20 hover:border-primary/30 transition-colors"
          >
            <span className="text-xs font-bold text-foreground tabular-nums">{fmt(customLimit)}</span>
            <span className="text-[9px] text-primary/60">editar</span>
          </button>
        )}
      </div>

      {/* Savings projection */}
      {monthlySaving > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-2 grid grid-cols-3 gap-1.5 text-center py-1.5 rounded-lg bg-success/5 border border-success/10"
        >
          <div>
            <p className="text-[8px] text-muted-foreground/50 uppercase">Por mês</p>
            <p className="text-[11px] font-bold text-success tabular-nums">{fmt(monthlySaving)}</p>
          </div>
          <div>
            <p className="text-[8px] text-muted-foreground/50 uppercase">Em 3 meses</p>
            <p className="text-[11px] font-bold text-success tabular-nums">{fmt(saving3m)}</p>
          </div>
          <div>
            <p className="text-[8px] text-muted-foreground/50 uppercase">Em 1 ano</p>
            <p className="text-[11px] font-bold text-success tabular-nums">{fmt(saving1y)}</p>
          </div>
        </motion.div>
      )}

      <button
        onClick={handleApply}
        disabled={saving}
        className="mt-2.5 w-full px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[11px] font-semibold border border-primary/15 hover:bg-primary/20 transition-colors disabled:opacity-50">
        {saving ? "Salvando..." : `Aplicar limite de ${fmt(customLimit)}`}
      </button>
    </motion.div>
  );
};

const LimitSuggestions = ({ suggestions, categoryData, onApplied }: { suggestions: AIInsights["limitSuggestions"]; categoryData: CategorySummary[]; onApplied?: () => void }) => {
  if (!suggestions || suggestions.length === 0) return null;
  return (
    <GlassCard className="p-4 md:p-5">
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-4 h-4 text-primary" />
        <p className="text-[14px] font-semibold text-white">Sugestões de Limite</p>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory" style={{ WebkitOverflowScrolling: "touch" }}>
        {suggestions.map((s, i) => {
          const cat = categoryData.find((c) => c.name === s.category);
          return <LimitSuggestionItem key={i} suggestion={s} currentAmount={cat?.amount ?? 0} onApplied={onApplied} />;
        })}
      </div>
    </GlassCard>
  );
};

// ── General Installments Overview (Hub) ──────────────────
const INITIAL_INSTALLMENT_COUNT = 3;

const AllInstallmentsOverview = ({ impacts }: { impacts: InstallmentImpact[] }) => {
  const [expanded, setExpanded] = useState(false);
  const allItems = useMemo(() =>
    impacts.flatMap((imp) =>
      imp.items.map((item) => ({ ...item, category: imp.category }))
    ).sort((a, b) => (b.amount * b.remaining) - (a.amount * a.remaining)),
    [impacts]
  );
  if (allItems.length === 0) return null;

  const totalMonthly = impacts.reduce((s, imp) => s + imp.monthlyAmount, 0);
  const totalRemaining = impacts.reduce((s, imp) => s + imp.totalRemaining, 0);
  const maxMonths = Math.max(...impacts.map((imp) => imp.monthsRemaining), 0);
  const isHighImpact = totalRemaining > 2000 || maxMonths >= 6;
  const hasMore = allItems.length > INITIAL_INSTALLMENT_COUNT;
  const visible = expanded ? allItems : allItems.slice(0, INITIAL_INSTALLMENT_COUNT);

  return (
    <div
      className="rounded-[22px] border border-white/[0.12] willo-glass p-3 md:p-4"
    >
      <div className="flex items-center gap-2 mb-2.5">
        <Repeat className="w-4 h-4 text-primary/70" />
        <p className="text-[14px] font-semibold text-white">Parcelamentos Ativos</p>
        <span className="ml-auto text-[9px] text-muted-foreground/40 bg-muted/10 px-1.5 py-0.5 rounded-full">{allItems.length} {allItems.length === 1 ? "item" : "itens"}</span>
      </div>

      {/* Alert banner */}
      <div className={`p-2.5 rounded-xl mb-2.5 ${isHighImpact ? "bg-warning/5 border border-warning/10" : "bg-muted/10 border border-border/10"}`}>
        <p className="text-[11px] text-foreground/80 leading-relaxed">
          {isHighImpact
            ? `⚠️ ${fmt(totalRemaining)} comprometidos nos próximos ${maxMonths} meses.`
            : `${fmt(totalRemaining)} restantes em parcelamentos (${maxMonths} meses). Tudo sob controle 👍`}
        </p>
      </div>

      {/* Stats: only mensal + restante */}
      <div className="grid grid-cols-2 gap-1.5 mb-2.5">
        <div className="text-center p-1.5 rounded-lg bg-muted/5">
          <p className="text-[8px] text-muted-foreground/50 uppercase">Mensal</p>
          <p className="text-xs font-bold text-foreground tabular-nums mt-0.5">{fmt(totalMonthly)}</p>
        </div>
        <div className="text-center p-1.5 rounded-lg bg-muted/5">
          <p className="text-[8px] text-muted-foreground/50 uppercase">Total restante</p>
          <p className="text-xs font-bold text-foreground tabular-nums mt-0.5">{fmt(totalRemaining)}</p>
        </div>
      </div>

      {/* Items list */}
      <div className="space-y-1">
        {visible.map((item, i) => (
          <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-muted/10 transition-colors">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-foreground truncate">{item.name}</p>
              <p className="text-[9px] text-muted-foreground/40">{item.category} · {item.paidInstallments} de {item.total} pagas</p>
            </div>
            <div className="text-right shrink-0 ml-2">
              <p className="text-[11px] font-bold text-foreground tabular-nums">{fmt(item.amount)}/mês</p>
              <p className="text-[9px] text-muted-foreground/40">{item.remaining} restantes</p>
            </div>
          </div>
        ))}
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1 pt-2 mt-1 border-t border-border/10 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors font-medium"
        >
          {expanded ? (
            <><ChevronUp className="w-3 h-3" /> Mostrar menos</>
          ) : (
            <><ChevronDown className="w-3 h-3" /> Ver todos ({allItems.length})</>
          )}
        </button>
      )}
    </div>
  );
};

// ── Installment Insights Section ─────────────────────────
const InstallmentInsightsSection = ({ impacts }: { impacts: InstallmentImpact[] }) => {
  const relevant = impacts
    .filter((imp) => imp.totalRemaining > 300 || imp.monthsRemaining >= 3 || imp.impactPct > 20)
    .sort((a, b) => b.totalRemaining - a.totalRemaining)
    .slice(0, 3);
  if (relevant.length === 0) return null;
  const getSeverity = (imp: InstallmentImpact) => {
    if (imp.impactPct > 50 || imp.totalRemaining > 2000) return "danger";
    if (imp.impactPct > 30 || imp.totalRemaining > 1000) return "warning";
    return "info";
  };
  const getMessage = (imp: InstallmentImpact) => {
    const severity = getSeverity(imp);
    if (severity === "danger") return `⚠️ Parte do seu orçamento futuro já está comprometido com ${imp.category}.`;
    if (severity === "warning") return `Você ainda tem ${fmt(imp.totalRemaining)} comprometidos em ${imp.category}. Próximos ${imp.monthsRemaining} meses 😅`;
    return `Parcelamentos em ${imp.category} estão sob controle 👍`;
  };
  const severityStyles = {
    info: { border: "border-blue-500/15", bg: "bg-blue-500/5" },
    warning: { border: "border-warning/15", bg: "bg-warning/5" },
    danger: { border: "border-destructive/15", bg: "bg-destructive/5" },
  };
  return (
    <GlassCard className="p-4 md:p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">💳</span>
        <p className="text-[14px] font-semibold text-white">Impacto de Parcelamentos</p>
      </div>
      <div className="space-y-2.5">
        {relevant.map((imp, i) => {
          const severity = getSeverity(imp);
          const styles = severityStyles[severity];
          return (
            <motion.div key={imp.category} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className={`p-3 rounded-xl ${styles.bg} border ${styles.border}`}>
              <p className="text-xs font-semibold text-foreground mb-1">{imp.category}</p>
              <p className="text-[11px] text-foreground/70 leading-relaxed mb-2">{getMessage(imp)}</p>
              <div className="grid grid-cols-3 gap-2 text-center py-1.5 rounded-lg bg-background/30">
                <div><p className="text-[8px] text-muted-foreground/50 uppercase">Mensal</p><p className="text-[11px] font-bold text-foreground tabular-nums">{fmt(imp.monthlyAmount)}</p></div>
                <div><p className="text-[8px] text-muted-foreground/50 uppercase">Restante</p><p className="text-[11px] font-bold text-foreground tabular-nums">{fmt(imp.totalRemaining)}</p></div>
                <div><p className="text-[8px] text-muted-foreground/50 uppercase">Meses</p><p className="text-[11px] font-bold text-foreground tabular-nums">⏳ {imp.monthsRemaining}</p></div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </GlassCard>
  );
};

// ── Category Installment Detail ──────────────────────────
const CategoryInstallmentDetail = ({ impact }: { impact: InstallmentImpact | undefined }) => {
  if (!impact || impact.items.length === 0) return null;
  const isHighImpact = impact.impactPct > 30 || impact.totalRemaining > 1000;
  return (
    <div
      className="rounded-[22px] border border-white/[0.12] willo-glass p-3 md:p-4"
    >
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-sm">💳</span>
        <p className="text-[14px] font-semibold text-white">Parcelamentos Ativos</p>
      </div>
      <div className={`p-2.5 rounded-xl mb-2.5 ${isHighImpact ? "bg-warning/5 border border-warning/10" : "bg-muted/10 border border-border/10"}`}>
        <p className="text-[11px] text-foreground/80 leading-relaxed">
          {isHighImpact
            ? `⚠️ ${fmt(impact.totalRemaining)} comprometidos nos próximos ${impact.monthsRemaining} meses.`
            : `${fmt(impact.totalRemaining)} restantes em parcelamentos (${impact.monthsRemaining} meses). Tudo sob controle 👍`}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-1.5 mb-2.5">
        <div className="text-center p-1.5 rounded-lg bg-muted/5">
          <p className="text-[8px] text-muted-foreground/50 uppercase">Mensal</p>
          <p className="text-xs font-bold text-foreground tabular-nums mt-0.5">{fmt(impact.monthlyAmount)}</p>
        </div>
        <div className="text-center p-1.5 rounded-lg bg-muted/5">
          <p className="text-[8px] text-muted-foreground/50 uppercase">Total restante</p>
          <p className="text-xs font-bold text-foreground tabular-nums mt-0.5">{fmt(impact.totalRemaining)}</p>
        </div>
      </div>
      <div className="space-y-1">
        {impact.items.map((item, i) => (
          <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-muted/10">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-foreground truncate">{item.name}</p>
              <p className="text-[9px] text-muted-foreground/40">{item.paidInstallments} de {item.total} parcelas pagas</p>
            </div>
            <div className="text-right shrink-0 ml-2">
              <p className="text-[11px] font-bold text-foreground tabular-nums">{fmt(item.amount)}/mês</p>
              <p className="text-[9px] text-muted-foreground/40">{item.remaining} restantes</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const EvolutionGlowDot = (props: any) => {
  const { cx, cy } = props;
  return (
    <g>
      <circle cx={cx} cy={cy} r={8} fill={props.stroke} opacity={0.15} />
      <circle cx={cx} cy={cy} r={4} fill={props.stroke} stroke="hsl(0 0% 12%)" strokeWidth={2} />
    </g>
  );
};

const EvolutionChartTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as HistoricalEntry;
  return (
    <div className="rounded-full bg-white px-3 py-1 shadow-xl">
      <p className="text-[11px] font-bold tabular-nums text-[#0B0B0B]">{MONTH_NAMES[d.month].slice(0, 3)} · {fmt(d.amount)}</p>
    </div>
  );
};

const EvolutionChart = ({ data, hexColor, currentMonth }: {
  data: HistoricalEntry[];
  hexColor: string;
  currentMonth: number;
}) => {
  if (data.length < 2) return null;

  const gradientId = `evo-gradient-${hexColor.replace("#", "")}`;

  return (
    <GlassCard className="p-4 md:p-5">
      <div className="flex items-center gap-2 mb-3">
        <p className="text-[14px] font-semibold text-white">
          Últimos 6 meses
        </p>
      </div>
      <div style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={hexColor} stopOpacity={0.25} />
                <stop offset="95%" stopColor={hexColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "hsl(0 0% 50%)", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fill: "hsl(0 0% 50%)", fontSize: 9 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => fmt(v)}
              width={72}
            />
            <Tooltip content={<EvolutionChartTooltip />} cursor={{ stroke: "hsl(0 0% 50%)", strokeWidth: 1, strokeDasharray: "4 4" }} />
            <Area
              type="monotone"
              dataKey="amount"
              stroke={hexColor}
              strokeWidth={2.5}
              fill={`url(#${gradientId})`}
              activeDot={<EvolutionGlowDot />}
              dot={{ r: 3, fill: hexColor, stroke: "hsl(0 0% 12%)", strokeWidth: 2 }}
              animationDuration={1200}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
};

// ── Category Detail View ─────────────────────────────────
// ── Page nav: discreet back · right slot ─────────────
const PageNav = ({ onBack, children }: { onBack: () => void; children: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-3">
    <button
      onClick={onBack}
      className="-ml-2 flex h-10 items-center text-white/70 hover:text-white active:opacity-60 transition-colors"
      aria-label="Voltar"
    >
      <ChevronLeft className="h-7 w-7" strokeWidth={2.25} />
    </button>
    <div className="flex min-w-0 justify-end">{children}</div>
  </div>
);

const CategoryDetail = ({
  category, transactions, onBack, monthLabel, isMobile, totalExpenses,
  historicalData, aiInsights, selectedMonth, installmentImpact, scoreData, habitData, limit, onEditLimit,
}: {
  category: CategorySummary;
  transactions: TxRow[];
  onBack: () => void;
  monthLabel: string;
  isMobile: boolean;
  totalExpenses: number;
  historicalData: HistoricalEntry[];
  aiInsights: AIInsights | null;
  selectedMonth: number;
  installmentImpact?: InstallmentImpact;
  scoreData?: CategoryScoreData;
  habitData?: HabitData;
  limit?: number;
  onEditLimit: () => void;
}) => {
  const money = fmt;
  const catTxs = transactions
    .filter((t) => t.category === category.name && t.type === "despesa")
    .sort((a, b) => b.date.localeCompare(a.date));

  const CatIcon = category.icon;
  const annualEstimate = category.amount * 12;

  // Daily cost
  const now = new Date();
  const selectedYear = historicalData.length > 0 ? historicalData[historicalData.length - 1]?.year ?? now.getFullYear() : now.getFullYear();
  const isCurrentMonth = selectedMonth === now.getMonth() && selectedYear === now.getFullYear();
  const daysElapsed = isCurrentMonth ? Math.max(now.getDate(), 1) : new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const dailyCost = daysElapsed > 0 ? category.amount / daysElapsed : 0;
  const projectedMonthly = dailyCost * 30;
  const paidAmount = catTxs.filter((t) => t.status === "pago").reduce((sum, t) => sum + t.amount, 0);
  const pendingAmount = catTxs.filter((t) => t.status !== "pago").reduce((sum, t) => sum + t.amount, 0);

  // Fixed (recurring) expenses repeat every month from here on
  const fixedItems = Array.from(
    catTxs
      .filter((t) => t.recurrence_type === "fixa")
      .reduce((map, t) => map.set(t.name, { name: t.name, amount: t.amount }), new Map<string, { name: string; amount: number }>())
      .values(),
  );
  const fixedMonthly = fixedItems.reduce((sum, f) => sum + f.amount, 0);
  const fixedPaidThisMonth = catTxs
    .filter((t) => t.recurrence_type === "fixa" && t.status === "pago")
    .reduce((sum, t) => sum + t.amount, 0);
  const remainingMonths = Array.from({ length: 12 - selectedMonth }, (_, i) => {
    const month = selectedMonth + i;
    const status: "pago" | "pendente" | "previsto" =
      i > 0 ? "previsto" : fixedPaidThisMonth >= fixedMonthly && fixedMonthly > 0 ? "pago" : "pendente";
    return { month, label: MONTH_NAMES[month], status };
  });
  const [showAllMonths, setShowAllMonths] = useState(false);
  const visibleMonths = showAllMonths ? remainingMonths : remainingMonths.slice(0, 3);
  const projectedAnnual = projectedMonthly * 12;

  // Habit intensity
  const habitIntensity = category.txCount < 6 ? "normal" : category.txCount < 10 ? "frequente" : "forte";
  const habitConfig = {
    normal: { label: "Normal", bg: "bg-success/10", text: "text-success" },
    frequente: { label: "Frequente", bg: "bg-warning/10", text: "text-warning" },
    forte: { label: "Hábito forte", bg: "bg-destructive/10", text: "text-destructive" },
  };

  // Internal distribution by merchant
  const merchantDistribution = useMemo(() => {
    const map = new Map<string, { amount: number; count: number }>();
    catTxs.forEach((t) => {
      const entry = map.get(t.name) || { amount: 0, count: 0 };
      map.set(t.name, { amount: entry.amount + t.amount, count: entry.count + 1 });
    });
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data, pct: category.amount > 0 ? Math.round((data.amount / category.amount) * 100) : 0 }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [catTxs, category.amount]);

  const topMerchant = merchantDistribution[0];

  // Filter AI data for this category
  const categoryAlerts = useMemo(() =>
    aiInsights?.alerts.filter((a) => a.category.toLowerCase() === category.name.toLowerCase()) ?? [],
    [aiInsights, category.name]
  );

  const categoryInsights = useMemo(() => {
    if (!aiInsights?.insights) return [];
    const catLower = category.name.toLowerCase();
    return aiInsights.insights.filter((msg) => msg.toLowerCase().includes(catLower));
  }, [aiInsights, category.name]);

  const categoryLimitSuggestion = useMemo(() =>
    aiInsights?.limitSuggestions.find((s) => s.category.toLowerCase() === category.name.toLowerCase()),
    [aiInsights, category.name]
  );

  // 3-month trend analysis
  const trendAnalysis = useMemo(() => {
    if (historicalData.length < 3) return null;
    const recent3 = historicalData.slice(-3);
    const current = recent3[2]?.amount ?? 0;
    const prev = recent3[1]?.amount ?? 0;
    const older = recent3[0]?.amount ?? 0;
    const momChange = prev > 0 ? Math.round(((current - prev) / prev) * 100) : null;
    const avg3 = (current + prev + older) / 3;
    const risingTrend = current > prev && prev > older && older > 0;
    const totalIncrease = older > 0 ? Math.round(((current - older) / older) * 100) : null;
    return { momChange, avg3, risingTrend, totalIncrease, months: recent3 };
  }, [historicalData]);

  // Smart limit suggestion with economy potential
  const smartSuggestion = useMemo(() => {
    if (categoryLimitSuggestion) {
      const saving = category.amount - categoryLimitSuggestion.suggestedLimit;
      return {
        suggestedLimit: categoryLimitSuggestion.suggestedLimit,
        message: categoryLimitSuggestion.message,
        monthlySaving: saving > 0 ? saving : 0,
        annualSaving: saving > 0 ? saving * 12 : 0,
      };
    }
    if (trendAnalysis && trendAnalysis.avg3 > 0 && category.amount > trendAnalysis.avg3 * 1.1) {
      const suggested = Math.round(trendAnalysis.avg3 / 10) * 10;
      const saving = category.amount - suggested;
      return {
        suggestedLimit: suggested,
        message: `Sua média dos últimos 3 meses é ${fmt(trendAnalysis.avg3)}. Definir um limite de ${fmt(suggested)} ajuda a controlar o crescimento.`,
        monthlySaving: saving > 0 ? saving : 0,
        annualSaving: saving > 0 ? saving * 12 : 0,
      };
    }
    if (category.percentage > 25 && totalExpenses > 0) {
      const suggested = Math.round(category.amount * 0.85 / 10) * 10;
      const saving = category.amount - suggested;
      return {
        suggestedLimit: suggested,
        message: `Essa categoria representa ${category.percentage}% dos seus gastos. Reduzindo para ${fmt(suggested)}/mês você economiza ${fmt(saving > 0 ? saving : 0)}.`,
        monthlySaving: saving > 0 ? saving : 0,
        annualSaving: saving > 0 ? saving * 12 : 0,
      };
    }
    return null;
  }, [category, totalExpenses, categoryLimitSuggestion, trendAnalysis]);

  // Dynamic insights (prioritized)
  const dynamicInsights = useMemo(() => {
    const results: { message: string; priority: number; type: string }[] = [];

    // Score-based
    if (scoreData?.score === "exagerado") {
      results.push({ message: `Huby aqui: seus gastos com ${category.name} tão bem acima da média, vale dar uma segurada`, priority: 100, type: "score" });
    } else if (scoreData?.score === "atencao") {
      results.push({ message: `Huby avisa: ${category.name} tá começando a subir, fica de olho`, priority: 60, type: "score" });
    }

    // Growth
    if (trendAnalysis?.risingTrend) {
      results.push({ message: `Esse gasto vem subindo nos últimos 3 meses seguidos — hora de repensar`, priority: 80, type: "growth" });
    } else if (trendAnalysis?.momChange && trendAnalysis.momChange > 15) {
      results.push({ message: `Aumentou ${trendAnalysis.momChange}% comparado ao mês passado`, priority: 70, type: "growth" });
    }

    // Habit
    if (habitIntensity === "forte") {
      results.push({ message: `${category.txCount} vezes esse mês — isso já virou parte da sua rotina, né?`, priority: 75, type: "habit" });
    } else if (habitIntensity === "frequente") {
      results.push({ message: `Frequência alta: ${category.txCount} gastos nessa categoria esse mês`, priority: 50, type: "habit" });
    }

    // Installment
    if (installmentImpact && installmentImpact.totalRemaining > 300) {
      results.push({ message: `Ainda tem ${fmt(installmentImpact.totalRemaining)} de parcelas pra pagar nos próximos ${installmentImpact.monthsRemaining} meses`, priority: 65, type: "installment" });
    }

    // Daily cost
    if (dailyCost >= 10) {
      results.push({ message: `Dá ${fmt(dailyCost)} por dia nessa categoria — parece pouco mas soma rápido`, priority: 40, type: "daily" });
    }

    // Merchant concentration
    if (topMerchant && topMerchant.pct > 50) {
      results.push({ message: `A maior parte dos gastos aqui vem de ${topMerchant.name} — continua assim vai virar sócio`, priority: 55, type: "merchant" });
    }

    // Healthy
    if (scoreData?.score === "saudavel" && results.length === 0) {
      results.push({ message: `Tudo certo por aqui! Seus gastos com ${category.name} tão sob controle`, priority: 10, type: "healthy" });
    }

    return results.sort((a, b) => b.priority - a.priority).slice(0, 3);
  }, [scoreData, trendAnalysis, habitIntensity, installmentImpact, dailyCost, topMerchant, category]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4"
    >
      {/* Header */}
      <PageNav onBack={onBack}>{null}</PageNav>
      {/* Hero */}
      <div className="px-1 pt-2">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ background: `${category.hexColor}26` }}>
            <CatIcon className="w-5 h-5" style={{ color: category.hexColor }} />
          </div>
          <div className="min-w-0">
            <h2 className="text-[20px] font-bold tracking-tight text-white truncate">{category.name}</h2>
            <p className="text-[13px] text-white/45">{category.percentage}% dos gastos de {monthLabel}</p>
          </div>
        </div>
        <p className="mt-5 text-[13px] text-white/45">Total em {monthLabel}</p>
        <p className="text-[36px] font-extrabold leading-tight tracking-tight text-white tabular-nums">{money(category.amount)}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5 text-[12px] text-white/80 tabular-nums">
            <span className="w-1.5 h-1.5 rounded-full bg-willo-green" /> {money(paidAmount)} pago
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5 text-[12px] text-white/80 tabular-nums">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-300" /> {money(pendingAmount)} pendente
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 divide-x divide-white/[0.06] rounded-[22px] border border-white/[0.12] willo-glass py-3.5">
        {[
          { label: "Transações", value: String(category.txCount) },
          { label: "Por transação", value: money(category.avgPerTx) },
          { label: "Por dia", value: money(dailyCost) },
        ].map((stat) => (
          <div key={stat.label} className="px-3 text-center">
            <p className="text-[11px] text-white/45">{stat.label}</p>
            <p className="mt-0.5 text-[15px] font-semibold text-white tabular-nums truncate">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Monthly limit */}
      <div className="rounded-[22px] border border-white/[0.12] willo-glass p-4">
        {limit ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[14px] font-semibold text-white">Limite mensal</p>
                <p className="text-[12px] text-white/45 tabular-nums">{money(category.amount)} de {money(limit)}</p>
              </div>
              <div className="text-right">
                <p className={`text-[17px] font-bold tabular-nums ${category.amount > limit ? "text-red-400" : "text-white"}`}>
                  {money(Math.abs(limit - category.amount))}
                </p>
                <p className="text-[11px] text-white/45">{category.amount > limit ? "acima do limite" : "ainda pode gastar"}</p>
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.08]">
              <motion.div
                className={`h-full rounded-full ${category.amount > limit ? "bg-red-400" : category.amount / limit >= 0.8 ? "bg-amber-300" : "bg-white"}`}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(category.amount / limit, 1) * 100}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>
            <button onClick={onEditLimit} className="mt-3 text-[13px] font-medium text-white/60 active:opacity-60">
              Editar limite
            </button>
          </>
        ) : (
          <button onClick={onEditLimit} className="flex w-full items-center gap-3 text-left active:opacity-70">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#0B0B0B]">
              <Plus className="h-4 w-4" strokeWidth={2.5} />
            </span>
            <span className="flex-1">
              <span className="block text-[15px] font-medium text-white">Definir limite para {category.name}</span>
              <span className="block text-[12px] text-white/45">Acompanhe quanto ainda pode gastar no mês</span>
            </span>
          </button>
        )}
      </div>

      {/* Fixed expenses in this category → yearly estimate + upcoming months */}
      {fixedItems.length > 0 && (
        <div className="rounded-[22px] border border-white/[0.12] willo-glass p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[14px] font-semibold text-white">Despesa fixa</p>
              <p className="text-[12px] text-white/45">{fixedItems.map((f) => f.name).join(", ")}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-white/45">Até dezembro</p>
              <p className="text-[15px] font-semibold text-white tabular-nums">{money(fixedMonthly * remainingMonths.length)}</p>
              <p className="text-[11px] text-white/35 tabular-nums">{money(fixedMonthly * 12)}/ano</p>
            </div>
          </div>
          <div className="mt-3 divide-y divide-white/[0.06]">
            {visibleMonths.map((m) => (
              <div key={m.month} className="flex items-center gap-3 py-2.5">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    m.status === "pago" ? "bg-willo-green text-[#0B0B0B]" : "border border-white/15"
                  }`}
                >
                  {m.status === "pago" && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`text-[14px] ${m.status === "pago" ? "text-white/55" : "text-white"}`}>{m.label}</p>
                  <p className="text-[12px] text-white/40">
                    {m.status === "pago" ? "Pago" : m.status === "pendente" ? "Pendente este mês" : "Previsto"}
                  </p>
                </div>
                <p className={`text-[14px] font-semibold tabular-nums ${m.status === "pago" ? "text-white/55 line-through decoration-white/30" : "text-white"}`}>
                  {money(fixedMonthly)}
                </p>
              </div>
            ))}
          </div>
          {remainingMonths.length > 3 && (
            <button
              onClick={() => setShowAllMonths((v) => !v)}
              className="mt-1 flex w-full items-center justify-center gap-1 pt-2 text-[13px] font-medium text-white/70 active:opacity-60"
            >
              {showAllMonths ? "Mostrar menos" : `Ver até dezembro (${remainingMonths.length - 3} meses)`}
              {showAllMonths ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}
        </div>
      )}

      {/* Transactions this month */}
      {catTxs.length > 0 && (
        <div className="rounded-[22px] border border-white/[0.12] willo-glass px-4 pt-3.5 pb-1">
          <p className="text-[14px] font-semibold text-white">Transações em {monthLabel}</p>
          <div className="mt-1 divide-y divide-white/[0.06]">
            {catTxs.slice(0, 12).map((t) => (
              <div key={`${t.id}-${t.date}`} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] text-white">{t.name}</p>
                  <p className="text-[12px] text-white/40">
                    {new Date(t.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                    {" · "}
                    {t.status === "pago" ? "Pago" : "Pendente"}
                  </p>
                </div>
                <p className="text-[14px] font-semibold text-white tabular-nums">{money(t.amount)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Evolution Chart (6 months) */}
      <EvolutionChart
        data={historicalData}
        hexColor={category.hexColor}
        currentMonth={selectedMonth}
      />

      {/* 3-month trend */}
      {trendAnalysis && trendAnalysis.momChange != null && (
        <div
          className="rounded-[22px] border border-white/[0.12] willo-glass p-3 md:p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            {trendAnalysis.risingTrend ? (
              <TrendingUp className="w-4 h-4 text-warning" />
            ) : trendAnalysis.momChange < 0 ? (
              <TrendingDown className="w-4 h-4 text-success" />
            ) : (
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
            )}
            <p className="text-[14px] font-semibold text-white">
              Tendência · 3 meses
            </p>
          </div>
          <p className="text-[11px] text-foreground/80 leading-relaxed">
            {trendAnalysis.risingTrend
              ? `${category.name} vem subindo há 3 meses — de ${trendAnalysis.months ? fmt(trendAnalysis.months[0].amount) : "—"} para ${trendAnalysis.months ? fmt(trendAnalysis.months[2].amount) : "—"} (${trendAnalysis.totalIncrease ?? 0}% a mais)`
              : trendAnalysis.momChange > 0
                ? `Aumentou ${trendAnalysis.momChange}% em relação ao mês passado`
                : trendAnalysis.momChange < 0
                  ? `Reduziu ${Math.abs(trendAnalysis.momChange)}% em relação ao mês passado 👏`
                  : `Estável em relação ao mês passado`
            }
          </p>
          {trendAnalysis.months && (
            <div className="grid grid-cols-3 gap-1.5 mt-2">
              {trendAnalysis.months.map((m, i) => (
                <div key={i} className="text-center p-1.5 rounded-lg bg-muted/5">
                  <p className="text-[8px] text-muted-foreground/50 uppercase">{MONTH_NAMES[m.month]?.slice(0, 3)}</p>
                  <p className="text-[11px] font-bold text-foreground tabular-nums mt-0.5">{fmt(m.amount)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Internal distribution */}
      {merchantDistribution.length > 1 && (
        <div
          className="rounded-[22px] border border-white/[0.12] willo-glass p-3 md:p-4"
        >
          <div className="flex items-center gap-2 mb-2.5">
            <PieChartIcon className="w-4 h-4 text-primary" />
            <p className="text-[14px] font-semibold text-white">
              Distribuição interna
            </p>
          </div>
          <div className="space-y-2.5">
            {merchantDistribution.map((m, i) => (
              <div key={m.name} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[11px] font-semibold text-foreground truncate">{m.name}</p>
                    <p className="text-[11px] font-bold text-foreground tabular-nums shrink-0 ml-2">{fmt(m.amount)}</p>
                  </div>
                  <div className="w-full h-1.5 bg-border/15 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${m.pct}%` }}
                      transition={{ delay: i * 0.05, duration: 0.5 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: category.hexColor, opacity: 1 - i * 0.15 }}
                    />
                  </div>
                </div>
                <span className="text-[9px] text-muted-foreground/50 shrink-0 w-7 text-right">{m.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Installment Impact */}




    </motion.div>
  );
};

// ── Main Page ────────────────────────────────────────────
const AnalyticsCategorias = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { selectedMonth, selectedYear, setMonth } = useMonth();
  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [prevMonthTxs, setPrevMonthTxs] = useState<TxRow[]>([]);
  const [historicalMap, setHistoricalMap] = useState<HistoricalMap>({});
  const [customCats, setCustomCats] = useState<CustomCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCategory = searchParams.get("categoria");
  const location = useLocation();
  const openCategory = useCallback((name: string) => {
    setSearchParams({ categoria: name }, { state: { fromOverview: true } });
    window.scrollTo({ top: 0 });
  }, [setSearchParams]);
  // Opened from the overview → pop history; opened via direct link → swap in the overview.
  const closeCategory = useCallback(() => {
    if ((location.state as { fromOverview?: boolean } | null)?.fromOverview) navigate(-1);
    else setSearchParams({}, { replace: true });
  }, [location.state, navigate, setSearchParams]);
  const [view, setView] = useState<"categorias" | "grupos">("categorias");
  const [aiInsights, setAiInsights] = useState<AIInsights | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [installmentImpacts, setInstallmentImpacts] = useState<InstallmentImpactMap>({});
  const [userStartDate, setUserStartDate] = useState<Date | null>(null);
  const [activeLimits, setActiveLimits] = useState<{ category: string; limit_amount: number; id: string }[]>([]);
  const [limitSheet, setLimitSheet] = useState<{ open: boolean; category: string | null }>({ open: false, category: null });

  // Fetch active limits
  const fetchLimits = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("category_limits")
      .select("id, category, limit_amount")
      .eq("user_id", user.id);
    setActiveLimits((data ?? []).map(r => ({ id: r.id, category: r.category, limit_amount: Number(r.limit_amount) })));
  }, [user]);

  useEffect(() => {
    fetchLimits();
    const onChange = () => fetchLimits();
    window.addEventListener("finance-data-changed", onChange);
    return () => window.removeEventListener("finance-data-changed", onChange);
  }, [fetchLimits]);

  // Fetch transactions for current month, previous month, and 6-month history
  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setLoading(true);
      const start = new Date(selectedYear, selectedMonth, 1).toISOString().split("T")[0];
      const end = new Date(selectedYear, selectedMonth + 1, 0).toISOString().split("T")[0];

      // Previous month
      const prevM = selectedMonth === 0 ? 11 : selectedMonth - 1;
      const prevY = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
      const prevStart = new Date(prevY, prevM, 1).toISOString().split("T")[0];
      const prevEnd = new Date(prevY, prevM + 1, 0).toISOString().split("T")[0];

      // 6-month history range (5 months back + current)
      const histStart = new Date(selectedYear, selectedMonth - 5, 1).toISOString().split("T")[0];

      // Compute 6-month history invoice range (1-based months for invoices table)
      const histMonths: { m1: number; y1: number }[] = [];
      for (let i = -5; i <= 0; i++) {
        const d = new Date(selectedYear, selectedMonth + i, 1);
        histMonths.push({ m1: d.getMonth() + 1, y1: d.getFullYear() });
      }
      const histMinM1 = histMonths[0].m1;
      const histMinY = histMonths[0].y1;
      const histMaxM1 = histMonths[histMonths.length - 1].m1;
      const histMaxY = histMonths[histMonths.length - 1].y1;

      const [txRes, prevTxRes, histRes, installmentRes, invoiceItemsRes, prevInvoiceItemsRes, histInvoiceItemsRes, profileRes, recurringTxs, prevRecurring, cats] = await Promise.all([
        supabase.from("transactions").select("*").eq("user_id", user.id)
          .gte("date", start).lte("date", end).order("date", { ascending: false }),
        supabase.from("transactions").select("*").eq("user_id", user.id)
          .gte("date", prevStart).lte("date", prevEnd),
        // Non-credit-card history (date-based is fine)
        supabase.from("transactions").select("id,category,date,amount,type,payment_method,credit_card_id").eq("user_id", user.id)
          .eq("type", "despesa").eq("payment_method", "conta")
          .gte("date", histStart).lte("date", end),
        // Fetch all active installment transactions (future parcels)
        supabase.from("transactions").select("id,name,category,amount,date,installments,installment_current,parent_transaction_id,recurrence_type,payment_method,credit_card_id")
          .eq("user_id", user.id).eq("recurrence_type", "parcelado").eq("type", "despesa")
          .gte("date", start),
        // Fetch invoice items for current month
        supabase.from("invoice_items").select("*, invoices!inner(month, year, user_id, credit_card_id, is_paid), transactions!inner(name, category, amount, type, payment_method, installments, installment_current, parent_transaction_id, recurrence_type)")
          .eq("invoices.user_id", user.id)
          .eq("invoices.month", selectedMonth + 1)
          .eq("invoices.year", selectedYear),
        // Fetch invoice items for previous month
        supabase.from("invoice_items").select("*, invoices!inner(month, year, user_id), transactions!inner(name, category, amount, type)")
          .eq("invoices.user_id", user.id)
          .eq("invoices.month", prevM + 1)
          .eq("invoices.year", prevY),
        // Fetch invoice items for entire 6-month history (credit card history by invoice month)
        supabase.from("invoice_items").select("amount, invoices!inner(month, year, user_id), transactions!inner(category, type)")
          .eq("invoices.user_id", user.id)
          .gte("invoices.year", histMinY)
          .lte("invoices.year", histMaxY),
        // Fetch user profile to get account creation date
        supabase.from("profiles").select("created_at").eq("id", user.id).single(),
        getRecurringForMonth(selectedMonth, selectedYear),
        getRecurringForMonth(prevM, prevY),
        getCustomCategories(),
      ]);

      // User start date for filtering history
      const profileCreatedAt = profileRes.data?.created_at ? new Date(profileRes.data.created_at) : null;
      setUserStartDate(profileCreatedAt);

      const baseTxs = (txRes.data ?? []) as TxRow[];
      const materializedRecurring = recurringTxs.map((t: any) => ({
        ...t,
        date: `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(dayOfMonth(t.date)).padStart(2, "0")}`,
      })) as TxRow[];

      // Build a set of transaction IDs that belong to this month's invoices
      const invoiceItems = (invoiceItemsRes.data ?? []) as any[];
      const invoiceTxIds = new Set(invoiceItems.map((ii: any) => ii.transaction_id));

      // Filter base transactions: for credit card txs, only include if they have an invoice item in this month
      const filteredBaseTxs = baseTxs.filter((tx) => {
        if (tx.payment_method === "cartao" && tx.credit_card_id) {
          return invoiceTxIds.has(tx.id);
        }
        return true;
      });

      // Also add credit card transactions that have invoice items in this month but whose date is in a different month
      const existingTxIds = new Set(filteredBaseTxs.map((t) => t.id));
      const extraCcTxIds = [...invoiceTxIds].filter((id) => !existingTxIds.has(id));
      let extraCcTxs: TxRow[] = [];
      if (extraCcTxIds.length > 0) {
        const { data: extraData } = await supabase.from("transactions").select("*")
          .eq("user_id", user.id)
          .in("id", extraCcTxIds);
        extraCcTxs = (extraData ?? []) as TxRow[];
      }

      const prevBaseTxs = (prevTxRes.data ?? []) as TxRow[];
      const prevMaterialized = prevRecurring.map((t: any) => ({
        ...t,
        date: `${prevY}-${String(prevM + 1).padStart(2, "0")}-${String(dayOfMonth(t.date)).padStart(2, "0")}`,
      })) as TxRow[];

      // Filter previous month credit card txs similarly
      const prevInvoiceItems = (prevInvoiceItemsRes.data ?? []) as any[];
      const prevInvoiceTxIds = new Set(prevInvoiceItems.map((ii: any) => ii.transaction_id));
      const filteredPrevBaseTxs = prevBaseTxs.filter((tx) => {
        if (tx.payment_method === "cartao" && tx.credit_card_id) {
          return prevInvoiceTxIds.has(tx.id);
        }
        return true;
      });

      // Non-credit-card transactions: group by date
      const histTxs = (histRes.data ?? []) as { id: string; category: string; date: string; amount: number; type: string; payment_method: string; credit_card_id: string | null }[];
      const hMap: HistoricalMap = {};
      histTxs.forEach((tx) => {
        const d = new Date(tx.date + "T12:00:00");
        const m = d.getMonth();
        const y = d.getFullYear();
        const key = tx.category;
        if (!hMap[key]) hMap[key] = [];
        const existing = hMap[key].find((e) => e.month === m && e.year === y);
        if (existing) {
          existing.amount += tx.amount;
        } else {
          hMap[key].push({ month: m, year: y, label: SHORT_MONTH_NAMES[m], amount: tx.amount });
        }
      });

      // Credit card transactions: group by invoice month (1-based → 0-based)
      const histIIs = (histInvoiceItemsRes.data ?? []) as any[];
      histIIs.forEach((ii: any) => {
        const tx = ii.transactions;
        const inv = ii.invoices;
        if (!tx || tx.type !== "despesa" || !inv) return;
        const m = inv.month - 1; // convert to 0-based
        const y = inv.year;
        // Only include months within our 6-month window
        const inRange = histMonths.some((hm) => hm.m1 === inv.month && hm.y1 === y);
        if (!inRange) return;
        const key = tx.category;
        if (!hMap[key]) hMap[key] = [];
        const existing = hMap[key].find((e) => e.month === m && e.year === y);
        if (existing) {
          existing.amount += ii.amount;
        } else {
          hMap[key].push({ month: m, year: y, label: SHORT_MONTH_NAMES[m], amount: ii.amount });
        }
      });

      Object.values(hMap).forEach((arr) => arr.sort((a, b) => a.year - b.year || a.month - b.month));

      // Build month slots, filtering out months before user account creation
      const userStartMonth = profileCreatedAt ? profileCreatedAt.getMonth() : 0;
      const userStartYear = profileCreatedAt ? profileCreatedAt.getFullYear() : 2000;

      const allMonths: { month: number; year: number; label: string }[] = [];
      for (let i = -5; i <= 0; i++) {
        const d = new Date(selectedYear, selectedMonth + i, 1);
        const m = d.getMonth();
        const y = d.getFullYear();
        // Skip months before user started using the app
        if (profileCreatedAt && (y < userStartYear || (y === userStartYear && m < userStartMonth))) continue;
        allMonths.push({ month: m, year: y, label: SHORT_MONTH_NAMES[m] });
      }
      Object.keys(hMap).forEach((cat) => {
        const filled = allMonths.map((slot) => {
          const found = hMap[cat].find((e) => e.month === slot.month && e.year === slot.year);
          return found ?? { ...slot, amount: 0 };
        });
        hMap[cat] = filled;
      });

      // Build installment impact map from both regular installments AND invoice items
      const instTxs = (installmentRes.data ?? []) as {
        id: string; name: string; category: string; amount: number; date: string;
        installments: number | null; installment_current: number | null;
        parent_transaction_id: string | null; recurrence_type: string;
        payment_method: string; credit_card_id: string | null;
      }[];

      const groupMap = new Map<string, { name: string; category: string; amount: number; total: number; paidInstallments: number }>();

      // Credit card installments: current invoice only counts as paid when that invoice is paid
      invoiceItems.forEach((ii: any) => {
        const tx = ii.transactions;
        const invoice = ii.invoices;
        if (!tx || tx.type !== "despesa") return;
        if (ii.total_installments <= 1) return;
        const groupId = tx.parent_transaction_id ?? ii.transaction_id;
        if (groupMap.has(groupId)) return;

        const paidInstallments = Math.max(
          0,
          Math.min(
            ii.total_installments,
            (invoice?.is_paid ? ii.installment_number : ii.installment_number - 1) ?? 0,
          ),
        );

        groupMap.set(groupId, {
          name: tx.name,
          category: tx.category,
          amount: ii.amount,
          total: ii.total_installments,
          paidInstallments,
        });
      });

      // Non-credit-card installments keep the month-based transaction mapping
      instTxs.forEach((tx) => {
        if (!tx.installments || tx.installments <= 1) return;
        if (tx.payment_method === "cartao" && tx.credit_card_id) return;
        const groupId = tx.parent_transaction_id ?? tx.id;
        if (groupMap.has(groupId)) return;
        const txDate = new Date(tx.date + "T12:00:00");
        if (txDate.getMonth() !== selectedMonth || txDate.getFullYear() !== selectedYear) return;
        groupMap.set(groupId, {
          name: tx.name,
          category: tx.category,
          amount: tx.amount,
          total: tx.installments,
          paidInstallments: Math.max(0, Math.min(tx.installments, tx.installment_current ?? 1)),
        });
      });

      const iMap: InstallmentImpactMap = {};
      groupMap.forEach(({ name, category, amount, total, paidInstallments }) => {
        const remaining = Math.max(total - paidInstallments, 0);
        if (remaining <= 0) return;
        if (!iMap[category]) {
          iMap[category] = { category, monthlyAmount: 0, totalRemaining: 0, monthsRemaining: 0, impactPct: 0, items: [] };
        }
        iMap[category].monthlyAmount += amount;
        iMap[category].totalRemaining += amount * remaining;
        iMap[category].monthsRemaining = Math.max(iMap[category].monthsRemaining, remaining);
        iMap[category].items.push({ name, amount, remaining, total, paidInstallments });
      });

      setTransactions([...filteredBaseTxs, ...extraCcTxs, ...materializedRecurring]);
      setPrevMonthTxs([...filteredPrevBaseTxs, ...prevMaterialized]);
      setHistoricalMap(hMap);
      setInstallmentImpacts(iMap);
      setCustomCats(cats);
      setLoading(false);
    };
    fetchData();
  }, [user, selectedMonth, selectedYear]);

  // Build category data
  const categoryData: CategorySummary[] = useMemo(() => {
    const map = new Map<string, { amount: number; count: number }>();
    transactions.filter((t) => t.type === "despesa").forEach((t) => {
      const existing = map.get(t.category) || { amount: 0, count: 0 };
      map.set(t.category, { amount: existing.amount + t.amount, count: existing.count + 1 });
    });
    const total = Array.from(map.values()).reduce((s, v) => s + v.amount, 0);
    return Array.from(map.entries())
      .sort((a, b) => b[1].amount - a[1].amount)
      .map(([name, { amount, count }]) => ({
        name,
        amount,
        percentage: total > 0 ? Math.round((amount / total) * 100) : 0,
        color: `hsl(${getCategoryColor(name, customCats)})`,
        hexColor: getCategoryHexColor(name, customCats),
        icon: getCategoryIcon(name, customCats),
        txCount: count,
        avgPerTx: count > 0 ? amount / count : 0,
      }));
  }, [transactions, customCats]);

  // Build habit data
  const habitMap: Record<string, HabitData> = useMemo(() => {
    const now = new Date();
    const isCurrentMonth = selectedMonth === now.getMonth() && selectedYear === now.getFullYear();
    const daysElapsed = isCurrentMonth ? Math.max(now.getDate(), 1) : new Date(selectedYear, selectedMonth + 1, 0).getDate();

    const expenseTxs = transactions.filter((t) => t.type === "despesa");
    const catMap = new Map<string, { amount: number; txCount: number; names: Map<string, number> }>();

    expenseTxs.forEach((t) => {
      const entry = catMap.get(t.category) || { amount: 0, txCount: 0, names: new Map() };
      entry.amount += t.amount;
      entry.txCount += 1;
      entry.names.set(t.name, (entry.names.get(t.name) || 0) + 1);
      catMap.set(t.category, entry);
    });

    const result: Record<string, HabitData> = {};
    catMap.forEach((data, category) => {
      let topMerchant: { name: string; count: number } | null = null;
      let maxCount = 0;
      data.names.forEach((count, name) => {
        if (count > maxCount) { maxCount = count; topMerchant = { name, count }; }
      });

      const isHabit = data.txCount >= 8 || (topMerchant !== null && topMerchant.count >= 4);
      result[category] = {
        category,
        txCount: data.txCount,
        dailyCost: data.amount / daysElapsed,
        isHabit,
        topMerchant: topMerchant && topMerchant.count >= 2 ? topMerchant : null,
        amount: data.amount,
      };
    });
    return result;
  }, [transactions, selectedMonth, selectedYear]);

  const prevCategoryData = useMemo(() => {
    const map = new Map<string, { amount: number; count: number }>();
    prevMonthTxs.filter((t) => t.type === "despesa").forEach((t) => {
      const existing = map.get(t.category) || { amount: 0, count: 0 };
      map.set(t.category, { amount: existing.amount + t.amount, count: existing.count + 1 });
    });
    const total = Array.from(map.values()).reduce((s, v) => s + v.amount, 0);
    return Array.from(map.entries()).map(([name, { amount, count }]) => ({
      name,
      amount,
      percentage: total > 0 ? Math.round((amount / total) * 100) : 0,
      txCount: count,
    }));
  }, [prevMonthTxs]);

  const totalExpenses = useMemo(() => categoryData.reduce((s, c) => s + c.amount, 0), [categoryData]);
  const topCategory = categoryData[0];
  const groups = useMemo(() => groupCategories(categoryData), [categoryData]);

  // Compute score map
  const scoreMap: Record<string, CategoryScoreData> = useMemo(() => {
    const result: Record<string, CategoryScoreData> = {};
    categoryData.forEach((cat) => {
      const prev = prevCategoryData.find((p) => p.name === cat.name);
      const prevAmount = prev?.amount ?? 0;
      const variation = prevAmount > 0 ? Math.round(((cat.amount - prevAmount) / prevAmount) * 100) : null;
      const score = computeCategoryScore(cat.percentage, variation, cat.txCount);
      result[cat.name] = { score, percentage: cat.percentage, variation, txCount: cat.txCount };
    });
    return result;
  }, [categoryData, prevCategoryData]);
  const selectedCatData = categoryData.find((c) => c.name === selectedCategory);
  const monthLabel = MONTH_NAMES[selectedMonth];

  // Compute impactPct for installment impacts
  const enrichedInstallmentImpacts = useMemo(() => {
    const result: InstallmentImpact[] = [];
    Object.values(installmentImpacts).forEach((imp) => {
      const catData = categoryData.find((c) => c.name === imp.category);
      const catAmount = catData?.amount ?? 0;
      result.push({
        ...imp,
        impactPct: catAmount > 0 ? Math.round((imp.monthlyAmount / catAmount) * 100) : 0,
      });
    });
    return result;
  }, [installmentImpacts, categoryData]);

  // Fetch AI insights with debounce to prevent 429
  const insightsCacheRef = useRef<{ key: string; data: AIInsights } | null>(null);
  const insightsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchInsights = useCallback(async () => {
    if (categoryData.length === 0 || totalExpenses === 0) {
      setAiInsights(null);
      return;
    }

    // Cache key based on month + total + category count
    const cacheKey = `${selectedMonth}-${selectedYear}-${categoryData.length}-${Math.round(totalExpenses)}`;
    if (insightsCacheRef.current?.key === cacheKey) {
      setAiInsights(insightsCacheRef.current.data);
      return;
    }

    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("category-insights", {
        body: {
          categories: categoryData.map((c) => ({
            name: c.name, amount: c.amount, percentage: c.percentage, txCount: c.txCount,
          })),
          totalExpenses,
          monthLabel,
          previousMonthCategories: prevCategoryData,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const result = data as AIInsights;
      insightsCacheRef.current = { key: cacheKey, data: result };
      setAiInsights(result);
    } catch (e: any) {
      console.error("AI insights error:", e);
      setAiInsights({ insights: ["Não foi possível gerar insights no momento."], alerts: [], limitSuggestions: [] });
    } finally {
      setAiLoading(false);
    }
  }, [categoryData, totalExpenses, monthLabel, prevCategoryData, selectedMonth, selectedYear]);

  useEffect(() => {
    if (!loading && categoryData.length > 0) {
      // Debounce to avoid rapid consecutive calls
      if (insightsTimerRef.current) clearTimeout(insightsTimerRef.current);
      insightsTimerRef.current = setTimeout(() => {
        fetchInsights();
      }, 800);
      return () => {
        if (insightsTimerRef.current) clearTimeout(insightsTimerRef.current);
      };
    }
  }, [loading, selectedMonth, selectedYear, fetchInsights]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-primary text-sm">Carregando...</div>
      </div>
    );
  }

  return (
    <div className={`pb-28 ${isMobile ? "max-w-lg mx-auto" : "max-w-5xl mx-auto"}`}>
      {/* Header — hidden when viewing category detail */}
      {!selectedCategory && (
        <div className="mb-5 pt-1">
          <PageNav onBack={() => navigate(-1)}>
            <div className="rounded-full border border-white/[0.12] willo-glass p-1">
              <MonthSelector
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
                onMonthChange={(m, y) => { setMonth(m, y); setAiInsights(null); }}
              />
            </div>
          </PageNav>
        </div>
      )}

      <AnimatePresence mode="wait">
        {selectedCategory && selectedCatData ? (
          <CategoryDetail
            key={selectedCategory}
            category={selectedCatData}
            transactions={transactions}
            onBack={closeCategory}
            monthLabel={monthLabel}
            isMobile={isMobile}
            totalExpenses={totalExpenses}
            historicalData={historicalMap[selectedCategory] ?? []}
            aiInsights={aiInsights}
            selectedMonth={selectedMonth}
            installmentImpact={enrichedInstallmentImpacts.find((i) => i.category === selectedCategory)}
            scoreData={scoreMap[selectedCategory]}
            habitData={habitMap[selectedCategory]}
            limit={activeLimits.find((l) => l.category === selectedCategory)?.limit_amount}
            onEditLimit={() => setLimitSheet({ open: true, category: selectedCategory })}
          />
        ) : (
          <motion.div
            key="overview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {categoryData.length > 0 ? (
              <>
                {/* Ring: categories or groups, total in the center */}
                <div className="pt-1">
                  <SpendRing
                    total={totalExpenses}
                    caption={`gastos em ${monthLabel.toLowerCase()}`}
                    segments={
                      view === "categorias"
                        ? categoryData.map((c) => ({ key: c.name, hex: c.hexColor, amount: c.amount }))
                        : groups.map((g) => ({ key: g.def.name, hex: g.def.hex, amount: g.amount }))
                    }
                  />
                </div>

                {topCategory && <TopSpendRow category={topCategory} monthLabel={monthLabel} onOpen={openCategory} />}

                <ViewToggle<"categorias" | "grupos">
                  value={view}
                  onChange={setView}
                  options={[
                    { key: "categorias", label: "Categorias" },
                    { key: "grupos", label: "Grupos" },
                  ]}
                />

                {view === "categorias" ? (
                  <CategoryRows categories={categoryData} onOpen={openCategory} />
                ) : (
                  <GroupCards groups={groups} />
                )}

                {/* Category limits */}
                <div className="rounded-[22px] border border-white/[0.12] willo-glass p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[16px] font-semibold text-white">Limites por categoria</p>
                      <p className="text-[12px] text-white/45">Quanto você ainda pode gastar em cada uma</p>
                    </div>
                    <button
                      onClick={() => setLimitSheet({ open: true, category: null })}
                      className="flex h-9 items-center gap-1 rounded-full bg-white px-3.5 text-[13px] font-semibold text-[#0B0B0B] active:scale-95 transition-transform"
                    >
                      <Plus className="h-4 w-4" strokeWidth={2.5} /> Criar
                    </button>
                  </div>
                  {activeLimits.length === 0 ? (
                    <p className="mt-4 rounded-[16px] bg-white/[0.04] px-3.5 py-3 text-[13px] text-white/50">
                      Nenhum limite ainda. Crie um para acompanhar quanto falta em cada categoria.
                    </p>
                  ) : (
                    <div className="mt-4 space-y-3.5">
                      {activeLimits.map((lim) => {
                        const spent = categoryData.find((c) => c.name === lim.category)?.amount ?? 0;
                        const ratio = lim.limit_amount > 0 ? spent / lim.limit_amount : 0;
                        const left = lim.limit_amount - spent;
                        const Icon = getCategoryIcon(lim.category, customCats);
                        const hex = getCategoryHexColor(lim.category, customCats);
                        const tone = left < 0 ? "text-red-400" : ratio >= 0.8 ? "text-amber-300" : "text-white/60";
                        const bar = left < 0 ? "bg-red-400" : ratio >= 0.8 ? "bg-amber-300" : "bg-white";
                        return (
                          <button key={lim.id} onClick={() => setLimitSheet({ open: true, category: lim.category })} className="block w-full text-left active:opacity-70">
                            <div className="flex items-center gap-2.5">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: `${hex}22` }}>
                                <Icon className="h-4 w-4" style={{ color: hex }} />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[14px] text-white">{lim.category}</span>
                                <span className="block text-[11px] text-white/40 tabular-nums">{fmt(spent)} de {fmt(lim.limit_amount)}</span>
                              </span>
                              <span className={`text-right text-[13px] font-semibold tabular-nums ${tone}`}>
                                {left < 0 ? `${fmt(-left)} acima` : `${fmt(left)} livre`}
                              </span>
                            </div>
                            <div className="ml-[46px] mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                              <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.min(ratio, 1) * 100}%` }} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Limit Suggestions from AI */}
                {aiInsights?.limitSuggestions && aiInsights.limitSuggestions.length > 0 && (
                  <LimitSuggestions
                    suggestions={aiInsights.limitSuggestions.filter(s => !activeLimits.some(l => l.category === s.category))}
                    categoryData={categoryData}
                    onApplied={fetchLimits}
                  />
                )}

              </>
            ) : (
              <GlassCard className="p-8 text-center">
                <PieChartIcon className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground/50">Sem despesas em {monthLabel}</p>
              </GlassCard>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <CategoryLimitSheet
        open={limitSheet.open}
        onClose={() => setLimitSheet({ open: false, category: null })}
        initialCategory={limitSheet.category}
        spentByCategory={Object.fromEntries(categoryData.map((c) => [c.name, c.amount]))}
        currentLimits={Object.fromEntries(activeLimits.map((l) => [l.category, l.limit_amount]))}
      />
    </div>
  );
};

export default AnalyticsCategorias;
