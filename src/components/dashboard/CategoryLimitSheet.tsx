import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import BottomSheet from "@/components/shared/BottomSheet";
import { getCategoryIcon, getCategoryHexColor } from "@/lib/categoryUtils";
import { DEFAULT_EXPENSE_CATEGORIES } from "@/lib/categoryIcons";
import { cn } from "@/lib/utils";

import { currencySymbol, getCurrency } from "@/lib/currency";
const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });

/** Notifies every card that reads category limits. */
export const notifyLimitsChanged = () => window.dispatchEvent(new CustomEvent("finance-data-changed"));

interface Props {
  open: boolean;
  onClose: () => void;
  /** Category preselected when opened from a specific category. */
  initialCategory?: string | null;
  /** Spending this month per category, used to show context and order the picker. */
  spentByCategory?: Record<string, number>;
  currentLimits?: Record<string, number>;
}

/** Create, change or remove a monthly spending limit for a category. */
const CategoryLimitSheet = ({ open, onClose, initialCategory, spentByCategory = {}, currentLimits = {} }: Props) => {
  const { user } = useAuth();
  const [category, setCategory] = useState<string | null>(initialCategory ?? null);
  const [cents, setCents] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const cat = initialCategory ?? null;
    setCategory(cat);
    setCents(cat && currentLimits[cat] ? Math.round(currentLimits[cat] * 100) : 0);
  }, [open, initialCategory, currentLimits]);

  const options = useMemo(() => {
    const names = new Set([...Object.keys(spentByCategory), ...DEFAULT_EXPENSE_CATEGORIES]);
    return [...names].sort((a, b) => (spentByCategory[b] ?? 0) - (spentByCategory[a] ?? 0));
  }, [spentByCategory]);

  const pick = (cat: string) => {
    setCategory(cat);
    setCents(currentLimits[cat] ? Math.round(currentLimits[cat] * 100) : 0);
  };

  const spent = category ? spentByCategory[category] ?? 0 : 0;
  const amount = cents / 100;
  const existing = category ? currentLimits[category] : undefined;

  const save = async () => {
    if (!user || !category || amount <= 0) return;
    setSaving(true);
    try {
      const { data: row } = await supabase
        .from("category_limits")
        .select("id")
        .eq("user_id", user.id)
        .eq("category", category)
        .maybeSingle();
      const { error } = row
        ? await supabase.from("category_limits").update({ limit_amount: amount }).eq("id", row.id)
        : await supabase.from("category_limits").insert({ user_id: user.id, category, limit_amount: amount });
      if (error) throw error;
      toast.success(`Limite de ${category} definido`);
      notifyLimitsChanged();
      onClose();
    } catch {
      toast.error("Não foi possível salvar o limite");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!user || !category) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("category_limits").delete().eq("user_id", user.id).eq("category", category);
      if (error) throw error;
      toast.success("Limite removido");
      notifyLimitsChanged();
      onClose();
    } catch {
      toast.error("Não foi possível remover o limite");
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      size="full"
      zIndex={70}
      footer={
        <div className="flex gap-2">
          {existing !== undefined && (
            <button
              onClick={remove}
              disabled={saving}
              aria-label="Remover limite"
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-400 disabled:opacity-40"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          )}
          <button
            onClick={save}
            disabled={saving || !category || amount <= 0}
            className="h-14 flex-1 rounded-full bg-white text-[16px] font-bold text-[#0B0B0B] disabled:opacity-35"
          >
            {saving ? "Salvando..." : existing !== undefined ? "Atualizar limite" : "Definir limite"}
          </button>
        </div>
      }
    >
      <div className="px-5 pb-4">
        <p className="text-[22px] font-bold text-white">Limite por categoria</p>
        <p className="text-[14px] text-white/45">Defina quanto quer gastar por mês e acompanhe quanto ainda pode usar.</p>

        {/* Amount */}
        <div className="mt-6 flex flex-col items-center">
          <span className="text-[13px] text-white/45">{category ? `Limite mensal para ${category}` : "Escolha uma categoria"}</span>
          <label className="relative mt-1 flex items-baseline gap-1.5">
            <span className="text-[22px] font-bold text-white/40">{currencySymbol()}</span>
            <span className={cn("text-[44px] font-extrabold leading-none tracking-tight tabular-nums", cents === 0 ? "text-white/30" : "text-white")}>
              {amount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <input
              inputMode="numeric"
              value={cents === 0 ? "" : String(cents)}
              onChange={(e) => setCents(Math.min(Number(e.target.value.replace(/\D/g, "").slice(0, 9) || "0"), 999999999))}
              aria-label="Valor do limite"
              className="absolute inset-0 w-full opacity-0"
            />
          </label>
          {category && (
            <span className="mt-2 text-[12px] text-white/45 tabular-nums">
              Gasto este mês: {fmt(spent)}
              {amount > 0 && (
                <span className={spent > amount ? "text-red-400" : "text-willo-green"}>
                  {" "}· {spent > amount ? `${fmt(spent - amount)} acima` : `${fmt(amount - spent)} livre`}
                </span>
              )}
            </span>
          )}
        </div>

        {/* Category picker */}
        <p className="mb-2 mt-7 px-1 text-[13px] font-semibold text-white/45">Categoria</p>
        <div className="grid grid-cols-3 gap-2">
          {options.map((cat) => {
            const Icon = getCategoryIcon(cat);
            const hex = getCategoryHexColor(cat);
            const selected = cat === category;
            const hasLimit = currentLimits[cat] !== undefined;
            return (
              <button
                key={cat}
                onClick={() => pick(cat)}
                className={cn(
                  "relative flex flex-col items-center gap-1.5 rounded-[18px] border px-2 py-3",
                  selected ? "border-white bg-white/[0.08]" : "border-white/[0.06] bg-[#1A1A1A]",
                )}
              >
                {hasLimit && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-willo-green" />}
                <span className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: `${hex}22` }}>
                  <Icon className="h-[18px] w-[18px]" style={{ color: hex }} />
                </span>
                <span className="line-clamp-1 text-[12px] text-white/85">{cat}</span>
              </button>
            );
          })}
        </div>
      </div>
    </BottomSheet>
  );
};

export default CategoryLimitSheet;
