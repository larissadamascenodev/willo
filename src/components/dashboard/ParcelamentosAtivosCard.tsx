import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { CreditCard, Wallet, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getCategoryIcon, getCategoryColor } from "@/lib/categoryUtils";
import { type ActiveInstallmentItem } from "@/lib/installmentProgress";
import { loadActiveInstallments, statsFor } from "@/services/activeInstallments";
import type { CustomCategory } from "@/services/categoryService";
import { StatTile } from "@/components/dashboard/StatTile";

import { getCurrency } from "@/lib/currency";
const ParcelamentosAtivosCard = ({ compact = false }: { compact?: boolean }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<ActiveInstallmentItem[]>([]);
  const [customCats, setCustomCats] = useState<CustomCategory[]>([]);
  const [loading, setLoading] = useState(true);

  /* The four queries and the arithmetic over them moved to a service both apps
     call: what is still being paid off is a fact about a person, not about a card. */
  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [active, categoriesRes] = await Promise.all([
      loadActiveInstallments(user.id),
      supabase.from("custom_categories").select("*").eq("user_id", user.id),
    ]);

    setItems(active.items);
    if (categoriesRes.data) setCustomCats(categoriesRes.data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;

    fetchData();
    const handleFinanceChange = () => {
      void fetchData();
    };

    window.addEventListener("finance-data-changed", handleFinanceChange);
    return () => window.removeEventListener("finance-data-changed", handleFinanceChange);
  }, [user, fetchData]);

  const stats = useMemo(() => statsFor(items), [items]);

  if (loading) {
    return <div className={`${compact ? "h-[138px]" : "h-[120px]"} animate-pulse rounded-[22px] border border-white/[0.08] willo-glass`} />;
  }

  if (items.length === 0) {
    if (compact) {
      return (
        <StatTile
          label="Parcelamentos"
          value="Nenhum"
          caption="Nada parcelado agora"
          accent="#F59E0B"
          empty
          onClick={() => navigate("/parcelamentos")}
        />
      );
    }
    return (
      <button onClick={() => navigate("/parcelamentos")} className="block w-full rounded-[22px] border border-white/[0.08] willo-glass p-4 text-left">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[16px] font-semibold text-white">Parcelamentos</h3>
            <p className="text-[12px] t-soft">Compras parceladas no cartão e na conta</p>
          </div>
          <ChevronRight className="h-4 w-4 t-softer" />
        </div>
        <div className="mt-4 flex items-center gap-3 rounded-[16px] bg-white/[0.04] px-3.5 py-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.06]">
            <CreditCard className="h-4 w-4 text-white/66" />
          </span>
          <p className="flex-1 text-[13px] text-white/66">Nenhum parcelamento ativo.</p>
        </div>
      </button>
    );
  }

  // The card is a summary: the rest lives on the Parcelamentos page
  const visibleItems = items.slice(0, 5);

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });

  const formatMonth = (d: Date) =>
    d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });

  if (compact) {
    return (
      <StatTile
        label="Parcelamentos"
        value={formatCurrency(stats?.totalRestante ?? 0)}
        caption={`${formatCurrency(stats?.totalMensal ?? 0)} por mês`}
        accent="#F59E0B"
        onClick={() => navigate("/parcelamentos")}
      />
    );
  }

  return (
    <div className="rounded-[22px] border border-white/[0.08] willo-glass p-4 select-none">
      {/* Header */}
      <button onClick={() => navigate("/parcelamentos")} className="flex w-full items-center justify-between">
        <div className="text-left">
          <h3 className="text-[16px] font-semibold text-white">Parcelamentos</h3>
          <p className="text-[12px] t-soft">
            {items.length} {items.length === 1 ? "compra parcelada" : "compras parceladas"}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 t-softer" />
      </button>

      {/* Summary */}
      {stats && (
        <div className="mt-3 grid grid-cols-2 rounded-[18px] bg-white/[0.04] py-3">
          <div className="px-3.5">
            <p className="text-[11px] text-white/62">Por mês</p>
            <p className="text-[17px] font-bold text-white tabular-nums">{formatCurrency(stats.totalMensal)}</p>
          </div>
          <div className="border-l border-white/[0.08] px-3.5">
            <p className="text-[11px] text-white/62">Restante</p>
            <p className="text-[17px] font-bold text-white tabular-nums">{formatCurrency(stats.totalRestante)}</p>
          </div>
        </div>
      )}

      {stats && stats.monthsUntilFree > 0 && (
        <p className="mt-2.5 px-1 text-[12px] text-white/62">
          Livre das parcelas em <span className="font-semibold text-white">{stats.monthsUntilFree} {stats.monthsUntilFree === 1 ? "mês" : "meses"}</span>
          {" "}· {formatMonth(stats.lastEndDate)}
        </p>
      )}

      {/* Items */}
      <div className="mt-2 divide-y divide-white/[0.06]">
        <AnimatePresence initial={false}>
          {visibleItems.map((item) => {
            const currentInst = item.installment_current;
            const progress = ((currentInst - 1) / item.installments) * 100;
            const isCard = item.payment_method === "cartao";
            const IconComp = getCategoryIcon(item.category, customCats);
            const catColor = getCategoryColor(item.category, customCats);

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-3 py-3"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ background: `hsl(${catColor} / 0.14)` }}>
                  {IconComp && <IconComp className="h-[18px] w-[18px]" style={{ color: `hsl(${catColor})` }} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[15px] font-medium text-white">{item.name}</span>
                    <span className="shrink-0 text-[15px] font-semibold text-white tabular-nums">{formatCurrency(item.amount)}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
                      <div className={`h-full rounded-full ${item.isOverdue ? "bg-red-400" : "bg-white"}`} style={{ width: `${progress}%` }} />
                    </div>
                    <span className={`flex shrink-0 items-center gap-1 text-[11px] tabular-nums ${item.isOverdue ? "text-red-400" : "text-white/62"}`}>
                      {item.isOverdue ? <AlertTriangle className="h-3 w-3" /> : isCard ? <CreditCard className="h-3 w-3" /> : <Wallet className="h-3 w-3" />}
                      {currentInst}/{item.installments}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {items.length > 5 && (
        <button
          onClick={() => navigate("/parcelamentos")}
          className="mt-1 flex w-full items-center justify-center gap-1 border-t border-white/[0.06] pt-3 text-[13px] font-medium text-white/74"
        >
          Ver os {items.length} parcelamentos
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

export default ParcelamentosAtivosCard;
