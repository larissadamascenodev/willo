import { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { CalendarClock } from "lucide-react";
import BackButton from "@/components/shared/BackButton";
import { useAuth } from "@/contexts/AuthContext";
import { getCategoryIcon, getCategoryColor } from "@/lib/categoryUtils";
import type { ActiveInstallmentItem } from "@/lib/installmentProgress";
import {
  loadActiveInstallments,
  installmentTotals,
  installmentProjection,
  installmentByCategory,
  type CardBadge,
} from "@/services/activeInstallments";
import { getCustomCategories, type CustomCategory } from "@/services/categoryService";
import { useSwipeBack } from "@/hooks/useSwipeBack";
import InstallmentPurchaseCard from "@/components/installments/InstallmentPurchaseCard";

import { getCurrency } from "@/lib/currency";
const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });


const ParcelamentosDetalhe = () => {
  const { user } = useAuth();
  useSwipeBack(true);
  const [items, setItems] = useState<ActiveInstallmentItem[]>([]);
  const [customCats, setCustomCats] = useState<CustomCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [cardsById, setCardsById] = useState<Record<string, CardBadge>>({});

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [active, cats] = await Promise.all([
      loadActiveInstallments(user.id),
      getCustomCategories(),
    ]);
    setItems(active.items);
    setCardsById(active.cardsById);
    setCustomCats(cats);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchData();
    const handler = () => { void fetchData(); };
    window.addEventListener("finance-data-changed", handler);
    return () => window.removeEventListener("finance-data-changed", handler);
  }, [user, fetchData]);

  const stats = useMemo(() => installmentTotals(items), [items]);

  /* The monthly figure, month by month, until the last instalment clears. The
     colour is this app's to decide: the browser wants an HSL triplet. */
  const projectionData = useMemo(
    () =>
      installmentProjection(items, stats?.monthsUntilFree ?? 12).map((m) => {
        const date = new Date(m.year, m.month);
        return {
          ...m,
          month: date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
          fullLabel: date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
          parts: m.parts.map((part) => ({
            ...part,
            color: `hsl(${getCategoryColor(part.category, customCats)})`,
          })),
        };
      }),
    [items, stats, customCats],
  );

  const categoryData = useMemo(() => installmentByCategory(items), [items]);

  const [methodFilter, setMethodFilter] = useState<"todos" | "cartao" | "conta">("todos");
  const visibleItems = useMemo(
    () => (methodFilter === "todos" ? items : items.filter((i) => (methodFilter === "cartao" ? i.payment_method === "cartao" : i.payment_method !== "cartao"))),
    [items, methodFilter],
  );
  const maxProjection = Math.max(...projectionData.map((p) => p.value), 1);

  const backControl = <BackButton />;

  if (loading) {
    return (
      <div className="mx-auto max-w-lg space-y-4 pb-28">
        {backControl}
        <div className="h-40 animate-pulse rounded-[24px] willo-glass" />
        <div className="h-56 animate-pulse rounded-[24px] willo-glass" />
      </div>
    );
  }

  if (items.length === 0 || !stats) {
    return (
      <div className="mx-auto max-w-lg pb-28">
        {backControl}
        <h1 className="mt-2 text-[28px] font-extrabold tracking-tight text-white">Parcelamentos</h1>
        <div className="mt-8 flex flex-col items-center px-8 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.05]">
            <CalendarClock className="h-8 w-8 t-soft" />
          </span>
          <p className="mt-5 text-[18px] font-bold text-white">Nenhum parcelamento ativo</p>
          <p className="mt-1 text-[14px] text-white/62">Compras parceladas aparecem aqui com o progresso de cada uma.</p>
        </div>
      </div>
    );
  }

  const paidPct = stats.totalGeral > 0 ? (stats.totalJaPago / stats.totalGeral) * 100 : 0;

  return (
    <div className="mx-auto max-w-lg select-none pb-28">
      {backControl}

      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-2">
        <h1 className="text-[28px] font-extrabold tracking-tight text-white">Parcelamentos</h1>
        <p className="text-[14px] text-white/62">
          {items.length} {items.length === 1 ? "compra parcelada" : "compras parceladas"} · cartão e conta
        </p>

        <p className="mt-6 text-[15px] text-white/66">Comprometido por mês</p>
        <p className="text-[38px] font-extrabold leading-tight tracking-tight text-white tabular-nums">{formatCurrency(stats.totalMensal)}</p>
        <p className="text-[14px] text-white/66">
          {stats.monthsUntilFree > 0
            ? `Livre em ${stats.monthsUntilFree} ${stats.monthsUntilFree === 1 ? "mês" : "meses"} · ${stats.lastEndDate.toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}`
            : "Última parcela este mês"}
        </p>
      </motion.div>

      {/* Paid vs remaining */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="mt-6 rounded-[24px] border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-4"
      >
        <div className="flex items-baseline justify-between">
          <p className="text-[14px] text-white/74">Progresso geral</p>
          <p className="text-[14px] font-semibold text-white tabular-nums">{Math.round(paidPct)}% pago</p>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/[0.08]">
          <motion.div
            className="h-full rounded-full bg-white"
            initial={{ width: 0 }}
            animate={{ width: `${paidPct}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
        <div className="mt-4 grid grid-cols-2 border-t border-white/[0.08] pt-3.5">
          <div className="pr-3">
            <p className="text-[12px] text-white/62">Já pago</p>
            <p className="text-[17px] font-bold text-white tabular-nums">{formatCurrency(stats.totalJaPago)}</p>
          </div>
          <div className="border-l border-white/[0.08] pl-4">
            <p className="text-[12px] text-white/62">Falta pagar</p>
            <p className="text-[17px] font-bold text-white tabular-nums">{formatCurrency(stats.totalRestante)}</p>
          </div>
        </div>
      </motion.div>

      {/* Monthly commitment */}
      {projectionData.length > 1 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="mt-3 rounded-[24px] border border-white/[0.08] willo-glass p-4">
          <p className="text-[16px] font-semibold text-white">Próximos meses</p>
          <p className="text-[12px] t-soft">O valor cai conforme as parcelas terminam</p>
          <div className="-mx-4 mt-4 overflow-x-auto px-4 scrollbar-hide">
            <div className="flex items-end gap-2.5" style={{ minWidth: projectionData.length * 52 }}>
              {projectionData.map((p, i) => (
                <div key={p.key} className="flex w-[44px] shrink-0 flex-col items-center">
                  <span className={`mb-1.5 text-[10px] tabular-nums ${i === 0 ? "text-white" : "t-soft"}`}>
                    {p.value >= 1000 ? `${(p.value / 1000).toFixed(1)}k` : p.value.toFixed(0)}
                  </span>
                  <div className="flex h-[110px] items-end">
                    <motion.span
                      className={`block w-8 rounded-full ${i === 0 ? "bg-white" : "bg-white/25"}`}
                      initial={{ height: 0 }}
                      animate={{ height: Math.max((p.value / maxProjection) * 110, p.value > 0 ? 8 : 3) }}
                      transition={{ delay: i * 0.03, duration: 0.45, ease: "easeOut" }}
                    />
                  </div>
                  <span className={`mt-2 text-[12px] capitalize ${i === 0 ? "font-semibold text-white" : "text-white/62"}`}>{p.month}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Category breakdown */}
      {categoryData.length > 1 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="mt-3 rounded-[24px] border border-white/[0.08] willo-glass p-4">
          <p className="text-[16px] font-semibold text-white">Por categoria</p>
          <div className="mt-3 flex h-2.5 gap-1 overflow-hidden rounded-full">
            {categoryData.map((cat) => (
              <span
                key={cat.category}
                className="h-full rounded-full"
                style={{ width: `${(cat.amount / stats.totalMensal) * 100}%`, background: `hsl(${getCategoryColor(cat.category, customCats)})` }}
              />
            ))}
          </div>
          <div className="mt-3 space-y-2.5">
            {categoryData.map((cat) => {
              const IconComp = getCategoryIcon(cat.category, customCats);
              const catColor = getCategoryColor(cat.category, customCats);
              return (
                <div key={cat.category} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: `hsl(${catColor} / 0.14)` }}>
                    {IconComp && <IconComp className="h-4 w-4" style={{ color: `hsl(${catColor})` }} />}
                  </span>
                  <span className="flex-1 truncate text-[14px] text-white">{cat.category}</span>
                  <span className="text-[13px] text-white/62 tabular-nums">{Math.round((cat.amount / stats.totalMensal) * 100)}%</span>
                  <span className="w-[92px] text-right text-[14px] font-semibold text-white tabular-nums">{formatCurrency(cat.amount)}</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* List */}
      <div className="mt-7 flex items-center justify-between px-1">
        <p className="text-[18px] font-bold text-white">Compras</p>
        <div className="flex isolate rounded-full border border-white/[0.08] willo-glass p-0.5">
          {([["todos", "Todos"], ["cartao", "Cartão"], ["conta", "Conta"]] as const).map(([key, label]) => (
            <button key={key} onClick={() => setMethodFilter(key)} className="relative h-8 rounded-full px-3 text-[12px] font-semibold">
              {methodFilter === key && (
                <motion.span layoutId="parcelas-filter" className="pointer-events-none absolute inset-0 z-0 rounded-full willo-invert" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
              )}
              <span className={`relative z-10 transform-gpu ${methodFilter === key ? "willo-on-invert" : "text-white/70"}`}>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {visibleItems.length === 0 && <p className="py-6 text-center text-[14px] t-soft">Nenhuma compra neste filtro</p>}
        {visibleItems.map((item, i) => (
          <InstallmentPurchaseCard
            key={item.id}
            item={item}
            index={i}
            customCats={customCats}
            card={item.credit_card_id ? cardsById[item.credit_card_id] : undefined}
          />
        ))}
      </div>
    </div>
  );
};

export default ParcelamentosDetalhe;
