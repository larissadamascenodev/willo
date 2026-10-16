import { memo, useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { StatTileWide } from "@/components/dashboard/StatTile";
import { Check, ChevronDown, ChevronUp, Home, Pencil, Repeat, Trash2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useMonth } from "@/contexts/MonthContext";
import { getCategoryIcon } from "@/lib/categoryUtils";
import { getCustomCategories, type CustomCategory } from "@/services/categoryService";
import { deleteTransaction, getTransactionById } from "@/services/transactionService";
import { toast } from "sonner";

import { getCurrency } from "@/lib/currency";
import { useRecorrentes, daysUntil, type RecurringItem, type RecurringType } from "@/hooks/useRecorrentes";
import { getBrand, isSubscription, type BrandInfo } from "@/lib/subscriptionBrands";
/** The shape now lives with the query that produces it. */
type Subscription = RecurringItem;

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });

const BrandIcon = ({ name, category, brand, customCategories }: { name: string; category: string; brand: BrandInfo & { matched: boolean }; customCategories?: CustomCategory[] }) => {
  const [imgError, setImgError] = useState(false);

  if (brand.matched && brand.logo && !imgError) {
    return (
      <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 overflow-hidden border border-white/[0.06]" style={{ background: brand.bg }}>
        <img src={brand.logo} alt={name} className="w-6 h-6 object-contain" onError={() => setImgError(true)} loading="lazy" />
      </div>
    );
  }

  if (brand.matched) {
    return (
      <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 border border-white/[0.06]" style={{ background: brand.bg, color: brand.fg }}>
        <span className="text-[11px] font-black leading-none">{brand.icon || name.charAt(0).toUpperCase()}</span>
      </div>
    );
  }

  const IconComponent = getCategoryIcon(category, customCategories);
  return (
    <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 bg-white/[0.06]">
      <IconComponent className="w-5 h-5 text-white/80" />
    </div>
  );
};

const GastosFixosCard = memo(({ compact = false }: { compact?: boolean }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { selectedMonth, selectedYear } = useMonth();
  // The same query the Assinaturas tile runs, run once for both of them.
  const { items: subscriptions, loading, refetch: fetchSubs } = useRecorrentes();
  const [customCats, setCustomCats] = useState<CustomCategory[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<RecurringType>("despesa");

  const [selectedSub, setSelectedSub] = useState<Subscription | null>(null);
  const [showActions, setShowActions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    getCustomCategories().then(setCustomCats).catch(() => {});
  }, []);

  const handleEdit = useCallback(async (sub: Subscription) => {
    setShowActions(false);
    try {
      const tx = await getTransactionById(sub.sourceId);
      window.dispatchEvent(new CustomEvent("edit-transaction", {
        detail: {
          id: tx.id,
          name: tx.name,
          type: tx.type,
          amount: Number(tx.amount),
          category: tx.category,
          date: tx.date,
          status: tx.status,
          payment_method: tx.payment_method,
          account_id: tx.account_id,
          credit_card_id: tx.credit_card_id,
          recurrence_type: tx.recurrence_type,
          installments: tx.installments,
          installment_current: tx.installment_current,
          observation: tx.observation,
        },
      }));
    } catch {
      toast.error("Erro ao carregar transação");
    }
  }, []);

  const handleDelete = useCallback(async () => {
    if (!selectedSub) return;
    setDeleting(true);
    try {
      await deleteTransaction(selectedSub.sourceId);
      toast.success(`"${selectedSub.name}" removida com sucesso`);
      setShowDeleteConfirm(false);
      setShowActions(false);
      setSelectedSub(null);
      fetchSubs();
    } catch {
      toast.error("Erro ao excluir recorrência");
    } finally {
      setDeleting(false);
    }
  }, [selectedSub, fetchSubs]);

  const filtered = useMemo(() => subscriptions.filter((s) => s.txType === activeTab), [subscriptions, activeTab]);
  const total = useMemo(() => filtered.reduce((s, x) => s + x.amount, 0), [filtered]);
  const despesaCount = useMemo(() => subscriptions.filter((s) => s.txType === "despesa").length, [subscriptions]);
  const receitaCount = useMemo(() => subscriptions.filter((s) => s.txType === "receita").length, [subscriptions]);

  if (loading) {
    return <div className={`${compact ? "h-[132px]" : "h-[200px]"} animate-pulse rounded-[22px] border border-white/[0.08] willo-glass`} />;
  }

  if (subscriptions.length === 0) {
    if (compact) {
      return (
        <StatTileWide
          label="Gastos e receitas fixas"
          accent="#818CF8"
          empty
          columns={[
            { label: "Gastos fixos", value: fmt(0), caption: "Nenhum ainda" },
            { label: "Receitas fixas", value: fmt(0), caption: "Nenhuma ainda" },
          ]}
          onClick={() => navigate("/transacoes?filtro=recorrentes")}
        />
      );
    }
    return (
      <div className="rounded-[22px] border border-white/[0.08] willo-glass p-4">
        <h2 className="text-[16px] font-semibold text-white">Gastos e receitas fixas</h2>
        <p className="text-[12px] t-soft">Contas fixas e assinaturas do mês</p>
        <div className="mt-4 flex items-center gap-3 rounded-[16px] bg-white/[0.04] px-3.5 py-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.06]">
            <Repeat className="h-4 w-4 text-white/66" />
          </span>
          <p className="flex-1 text-[13px] text-white/66">Nenhuma despesa ou receita recorrente ainda.</p>
        </div>
      </div>
    );
  }

  if (compact) {
    const totalOf = (t: RecurringType) =>
      subscriptions.filter((s) => s.txType === t).reduce((acc, x) => acc + x.amount, 0);
    const porMes = (n: number, one: string, many: string) =>
      `${n} ${n === 1 ? one : many} por mês`;
    return (
      <StatTileWide
        label="Gastos e receitas fixas"
        accent="#818CF8"
        columns={[
          { label: "Gastos fixos", value: fmt(totalOf("despesa")), caption: porMes(despesaCount, "gasto", "gastos"), tone: "out" },
          { label: "Receitas fixas", value: fmt(totalOf("receita")), caption: porMes(receitaCount, "receita", "receitas"), tone: "in" },
        ]}
        onClick={() => navigate("/transacoes?filtro=recorrentes")}
      />
    );
  }

  const displaySubs = expanded ? filtered : filtered.slice(0, 3);
  const hasMore = filtered.length > 3;
  const paidCount = filtered.filter((sub) => sub.isPaidThisMonth).length;

  return (
    <>
      <div className="rounded-[22px] border border-white/[0.08] willo-glass overflow-hidden">
        {/* Header with total */}
        <div className="flex items-start justify-between gap-3 px-4 pt-4">
          <div>
            <h2 className="text-[16px] font-semibold text-white">Gastos e receitas fixas</h2>
            <p className="text-[12px] t-soft">
              {paidCount} de {filtered.length} {activeTab === "receita" ? "recebidas" : "pagas"} este mês
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] t-soft">Total/mês</p>
            <p className={`text-[17px] font-bold tabular-nums ${activeTab === "receita" ? "text-willo-green-ink" : "text-white"}`}>{fmt(total)}</p>
          </div>
        </div>

        {/* Progress of the month */}
        {filtered.length > 0 && (
          <div className="mx-4 mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
            <motion.div
              className={`h-full rounded-full ${activeTab === "receita" ? "bg-willo-green" : "bg-white"}`}
              initial={{ width: 0 }}
              animate={{ width: `${(paidCount / filtered.length) * 100}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
        )}

        {/* Tabs */}
        <div className="px-4 mt-3">
          <div className="grid grid-cols-2 isolate rounded-full bg-white/[0.06] p-1">
            {(["despesa", "receita"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setExpanded(false); }}
                className="relative h-8 rounded-full text-[12px] font-semibold"
              >
                {activeTab === tab && (
                  <motion.span
                    layoutId="recorrentes-tab"
                    className="pointer-events-none absolute inset-0 z-0 rounded-full willo-invert"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <span className={`relative z-10 transition-colors ${activeTab === tab ? "willo-on-invert" : "text-white/70"}`}>
                  {tab === "despesa" ? "Despesas" : "Receitas"} ({tab === "despesa" ? despesaCount : receitaCount})
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="px-4 pt-1 divide-y divide-white/[0.06]">
          <AnimatePresence mode="popLayout" initial={false}>
            {displaySubs.length > 0 ? displaySubs.map((sub, idx) => {
              const brand = getBrand(sub.name);
              const days = daysUntil(sub.dueDay);
              const dueSoon = !sub.isPaidThisMonth && days <= 3;

              return (
                <motion.button
                  key={sub.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="flex w-full items-center gap-3 py-3 text-left active:opacity-70"
                  onClick={() => { setSelectedSub(sub); setShowActions(true); }}
                >
                  <BrandIcon name={sub.name} category={sub.category} brand={brand} customCategories={customCats} />
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-[15px] font-medium ${sub.isPaidThisMonth ? "text-white/70" : "text-white"}`}>{sub.name}</p>
                    <p className={`text-[12px] ${dueSoon ? "text-amber-300/90" : "t-soft"}`}>
                      {sub.isPaidThisMonth
                        ? activeTab === "receita" ? "Recebido este mês" : "Pago este mês"
                        : `Dia ${sub.dueDay} · ${days === 0 ? "hoje" : days === 1 ? "amanhã" : `em ${days} dias`}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <p className={`text-[15px] font-semibold tabular-nums ${sub.isPaidThisMonth ? "text-white/70" : "text-white"}`}>{fmt(sub.amount)}</p>
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full ${
                        sub.isPaidThisMonth ? "bg-willo-green willo-on-invert" : "border border-white/15"
                      }`}
                    >
                      {sub.isPaidThisMonth && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                  </div>
                </motion.button>
              );
            }) : (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-6 text-center text-[13px] t-soft">
                Nenhuma {activeTab === "receita" ? "receita recorrente" : "despesa recorrente"}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Ver todos / Recolher */}
        {hasMore ? (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex w-full items-center justify-center gap-1 border-t border-white/[0.06] py-3 text-[13px] font-medium text-white/74 active:opacity-60"
          >
            {expanded ? <>Mostrar menos <ChevronUp className="h-4 w-4" /></> : <>Ver todas ({filtered.length}) <ChevronDown className="h-4 w-4" /></>}
          </button>
        ) : (
          <div className="h-1" />
        )}
      </div>

      {/* Action Sheet Modal */}
      <AnimatePresence>
        {showActions && selectedSub && !showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center"
            onClick={() => { setShowActions(false); setSelectedSub(null); }}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-sm rounded-t-[28px] sm:rounded-[28px] willo-glass border border-white/[0.08] shadow-2xl p-5 pb-24 sm:pb-5"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-foreground">{selectedSub.name}</h3>
                <button onClick={() => { setShowActions(false); setSelectedSub(null); }} className="text-muted-foreground/50 hover:text-foreground transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleEdit(selectedSub)}
                  className="w-full flex items-center gap-3 rounded-[20px] bg-white/[0.05] hover:bg-white/[0.08] px-4 py-3.5 text-left transition-colors"
                >
                  <div className="w-10 h-10 rounded-full willo-invert flex items-center justify-center shrink-0">
                    <Pencil className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-foreground">Editar</p>
                    <p className="text-[11px] text-muted-foreground">Alterar valor, nome ou categoria</p>
                  </div>
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full flex items-center gap-3 rounded-[20px] bg-red-500/[0.08] hover:bg-red-500/[0.12] px-4 py-3.5 text-left transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">
                    <Trash2 className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-red-400">Cancelar recorrência</p>
                    <p className="text-[11px] text-muted-foreground">Remove esta e todas as futuras</p>
                  </div>
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && selectedSub && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center px-4"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-[28px] willo-glass border border-white/[0.08] shadow-2xl p-5"
            >
              <h3 className="text-sm font-bold text-foreground mb-1">Cancelar recorrência</h3>
              <p className="text-[12px] text-muted-foreground mb-5">
                Tem certeza que deseja cancelar <span className="font-semibold text-foreground">"{selectedSub.name}"</span>? Isso removerá esta transação e todas as futuras ocorrências.
              </p>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 text-[13px] font-semibold h-11 rounded-full bg-white/[0.08] hover:bg-white/[0.12] text-white transition-colors"
                >
                  Voltar
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 text-[13px] font-semibold h-11 rounded-full bg-red-500 text-white transition-opacity disabled:opacity-50"
                >
                  {deleting ? "Removendo..." : "Confirmar"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});

GastosFixosCard.displayName = "GastosFixosCard";
export default GastosFixosCard;
