import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Sparkles, Clock, MoreVertical, Pencil, Trash2, ArrowDownLeft, ArrowUpRight, Target, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchGoalById,
  fetchGoalTransactions,
  createGoalDeposit,
  createGoalWithdraw,
  deleteGoal,
  deleteGoalDepositWithRefund,
  computeGoalInsights,
  type Goal,
  type GoalTransaction,
} from "@/services/goalService";
import GoalDepositModal from "@/components/goals/GoalDepositModal";
import GoalWithdrawModal from "@/components/goals/GoalWithdrawModal";
import GoalEditModal from "@/components/goals/GoalEditModal";
import GoalConfirmModal from "@/components/goals/GoalConfirmModal";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

import { getCurrency } from "@/lib/currency";
const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });

const MetaDetalhe = () => {
  const { goalId } = useParams<{ goalId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [transactions, setTransactions] = useState<GoalTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteGoal, setShowDeleteGoal] = useState(false);
  const [deletingGoal, setDeletingGoal] = useState(false);
  const [depositToDelete, setDepositToDelete] = useState<GoalTransaction | null>(null);
  const [deletingDeposit, setDeletingDeposit] = useState(false);
  const [accountNames, setAccountNames] = useState<Record<string, string>>({});
  const [showAllHistory, setShowAllHistory] = useState(false);

  const load = useCallback(async () => {
    if (!goalId) return;
    try {
      const [g, txs] = await Promise.all([
        fetchGoalById(goalId),
        fetchGoalTransactions(goalId),
      ]);
      setGoal(g);
      setTransactions(txs);

      const accountIds = [...new Set(txs.filter(t => t.account_id).map(t => t.account_id!))];
      if (accountIds.length > 0) {
        const { data: accs } = await supabase
          .from("accounts")
          .select("id, name")
          .in("id", accountIds);
        if (accs) {
          const map: Record<string, string> = {};
          accs.forEach(a => { map[a.id] = a.name; });
          setAccountNames(map);
        }
      }
    } catch {
      toast.error("Erro ao carregar meta");
      navigate("/metas");
    } finally {
      setLoading(false);
    }
  }, [goalId, navigate]);

  useEffect(() => { load(); }, [load]);

  const handleDeposit = useCallback(
    async (data: { amount: number; date: string; source?: string; account_id?: string }) => {
      if (!user || !goalId) return;
      try {
        await createGoalDeposit({ goal_id: goalId, amount: data.amount, date: data.date, source: data.source, account_id: data.account_id }, user.id);
        toast.success("Depósito realizado! 💰");
        setShowDeposit(false);
        load();
      } catch { toast.error("Erro ao depositar"); }
    },
    [user, goalId, load]
  );

  const handleWithdraw = useCallback(
    async (data: { amount: number; date: string; account_id?: string; destination?: string }) => {
      if (!user || !goalId) return;
      try {
        await createGoalWithdraw({ goal_id: goalId, amount: data.amount, date: data.date, account_id: data.account_id, destination: data.destination }, user.id);
        toast.success("Saque realizado! 💸");
        setShowWithdraw(false);
        load();
      } catch { toast.error("Erro ao sacar"); }
    },
    [user, goalId, load]
  );

  const handleDeleteGoal = useCallback(async () => {
    if (!goalId) return;
    setDeletingGoal(true);
    try {
      await deleteGoal(goalId);
      toast.success("Meta excluída");
      navigate("/metas");
    } catch { toast.error("Erro ao excluir meta"); }
    finally { setDeletingGoal(false); }
  }, [goalId, navigate]);

  const handleDeleteDeposit = useCallback(async () => {
    if (!depositToDelete || !user || !goal) return;
    setDeletingDeposit(true);
    try {
      await deleteGoalDepositWithRefund(depositToDelete, user.id, goal.name);
      toast.success("Depósito removido");
      setDepositToDelete(null);
      load();
    } catch { toast.error("Erro ao remover depósito"); }
    finally { setDeletingDeposit(false); }
  }, [depositToDelete, user, goal, load]);

  if (loading || !goal) {
    return (
      <div className="pt-2 pb-8 space-y-4">
        <div className="h-52 rounded-2xl bg-card/40 animate-pulse" />
        <div className="h-20 rounded-2xl bg-card/40 animate-pulse" />
        <div className="h-32 rounded-2xl bg-card/40 animate-pulse" />
      </div>
    );
  }

  const progress = Math.min(1, goal.current_amount / goal.target_amount);
  const remaining = goal.target_amount - goal.current_amount;
  const isComplete = progress >= 1;
  const insights = computeGoalInsights(goal, transactions);
  const topInsight = insights.length > 0 ? insights[0] : null;

  let predictionMonths = 0;
  if (!isComplete && goal.monthly_contribution && goal.monthly_contribution > 0) {
    predictionMonths = Math.ceil(remaining / goal.monthly_contribution);
  }

  const getDepositDeleteDescription = (tx: GoalTransaction) => {
    const amt = fmt(Math.abs(Number(tx.amount)));
    if (tx.account_id && accountNames[tx.account_id]) {
      return `O valor de ${amt} será devolvido para a conta "${accountNames[tx.account_id]}".`;
    }
    if (tx.source) {
      return `Este depósito de ${amt} veio de "${tx.source}" (conta externa). O valor será removido da meta.`;
    }
    return `O depósito de ${amt} será removido da meta.`;
  };

  const totalDeposits = transactions.filter(t => Number(t.amount) > 0).reduce((s, t) => s + Number(t.amount), 0);
  const totalWithdrawals = transactions.filter(t => Number(t.amount) < 0).reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const visibleTxs = showAllHistory ? transactions : transactions.slice(0, 5);

  return (
    <div className="pt-2 pb-8 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate("/metas")} className="-ml-2 flex h-9 items-center gap-0.5 text-sm text-white/70 hover:text-white active:opacity-60 transition-colors">
          <ChevronLeft className="w-6 h-6" strokeWidth={2.25} /> Voltar
        </button>
        <div className="relative">
          <button onClick={() => setShowMenu(v => !v)} className="w-8 h-8 rounded-xl bg-muted/20 flex items-center justify-center hover:bg-muted/30 transition-colors">
            <MoreVertical className="w-4 h-4 text-muted-foreground" />
          </button>
          <AnimatePresence>
            {showMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -4 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-10 z-50 w-40 rounded-xl border border-border/30 bg-card shadow-xl overflow-hidden"
              >
                <button onClick={() => { setShowEdit(true); setShowMenu(false); }} className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-sm text-foreground hover:bg-muted/30 transition-colors">
                  <Pencil className="w-3.5 h-3.5 text-muted-foreground" /> Editar
                </button>
                <div className="h-px bg-border/20" />
                <button onClick={() => { setShowDeleteGoal(true); setShowMenu(false); }} className="flex items-center gap-2.5 w-full px-3.5 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" /> Excluir
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {showMenu && <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />}

      {/* ═══ Hero Card — compact with thick ring ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border/10 overflow-hidden"
        style={{ background: "linear-gradient(160deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%)" }}
      >
        <div className="flex items-center gap-4 p-4">
          {/* Thick ring progress */}
          <div className="relative flex-shrink-0" style={{ width: 80, height: 80 }}>
            <svg width={80} height={80} className="-rotate-90">
              <circle cx={40} cy={40} r={32} fill="none" stroke="hsl(var(--secondary))" strokeWidth={10} />
              <motion.circle
                cx={40} cy={40} r={32} fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth={10}
                strokeLinecap="round"
                initial={{ strokeDasharray: `0 ${2 * Math.PI * 32}` }}
                animate={{ strokeDasharray: `${2 * Math.PI * 32 * progress} ${2 * Math.PI * 32 * (1 - progress)}` }}
                transition={{ duration: 1.2, ease: "easeOut" }}
                style={{ filter: "drop-shadow(0 0 8px hsl(var(--primary) / 0.5))" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-sm font-extrabold tabular-nums text-primary">{Math.round(progress * 100)}%</span>
              <span className="text-[7px] text-muted-foreground">{isComplete ? "concluída" : "concluído"}</span>
            </div>
          </div>

          {/* Name + value */}
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-foreground truncate">{goal.name}</h2>
            <p className="text-xl font-extrabold text-primary tabular-nums mt-0.5">{fmt(Number(goal.current_amount))}</p>
            <p className="text-[10px] text-muted-foreground">
              de {fmt(Number(goal.target_amount))}
              {remaining > 0 && !isComplete && <span> · faltam {fmt(remaining)}</span>}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        {!isComplete && (
          <div className="grid grid-cols-2 gap-2 px-4 pb-4">
            <button
              onClick={() => setShowDeposit(true)}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary/10 text-primary text-[11px] font-semibold hover:bg-primary/20 transition-colors border border-primary/20"
            >
              <ArrowDownLeft className="w-3.5 h-3.5" /> Depósito
            </button>
            <button
              onClick={() => setShowWithdraw(true)}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-destructive/10 text-destructive text-[11px] font-semibold hover:bg-destructive/20 transition-colors border border-destructive/20"
            >
              <ArrowUpRight className="w-3.5 h-3.5" /> Saque
            </button>
          </div>
        )}
      </motion.div>

      {/* ═══ Quick stats row ═══ */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} className="grid grid-cols-3 gap-2">
        {[
          { label: "Depósitos", value: fmt(totalDeposits), color: "text-primary" },
          { label: "Saques", value: fmt(totalWithdrawals), color: "text-destructive" },
          { label: predictionMonths > 0 ? "Previsão" : "Contribuição", value: predictionMonths > 0 ? `${predictionMonths} ${predictionMonths === 1 ? "mês" : "meses"}` : goal.monthly_contribution ? fmt(goal.monthly_contribution) + "/mês" : "—", color: "text-foreground" },
        ].map((item, i) => (
          <div key={i} className="rounded-xl border border-border/10 p-2.5 text-center" style={{ background: "linear-gradient(160deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%)" }}>
            <p className="text-[8px] text-muted-foreground uppercase tracking-wider font-medium">{item.label}</p>
            <p className={`text-[11px] font-bold tabular-nums mt-0.5 ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </motion.div>

      {/* ═══ Insight ═══ */}
      {topInsight && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="flex items-start gap-2.5 rounded-xl border border-primary/10 bg-primary/[0.04] p-3">
            <Sparkles className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">{topInsight}</p>
          </div>
        </motion.div>
      )}

      {/* ═══ History ═══ */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
        <div className="rounded-2xl border border-border/10 overflow-hidden" style={{ background: "linear-gradient(160deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%)" }}>
          <div className="px-4 pt-3.5 pb-2">
            <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-medium">Movimentações</p>
          </div>
          {transactions.length === 0 ? (
            <p className="text-[11px] text-muted-foreground text-center py-8 px-4">Nenhuma movimentação ainda</p>
          ) : (
            <div className="px-3 pb-3 space-y-1">
              {visibleTxs.map((tx) => {
                const isWithdraw = Number(tx.amount) < 0;
                const absAmount = Math.abs(Number(tx.amount));
                return (
                  <div key={tx.id} className="flex items-center gap-3 rounded-xl px-2.5 py-2.5 hover:bg-muted/5 transition-colors group">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${isWithdraw ? "bg-destructive/10" : "bg-primary/10"}`}>
                      {isWithdraw ? <ArrowUpRight className="w-3.5 h-3.5 text-destructive" /> : <ArrowDownLeft className="w-3.5 h-3.5 text-primary" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold ${isWithdraw ? "text-destructive" : "text-primary"}`}>
                        {isWithdraw ? "Saque" : "Depósito"}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {format(new Date(tx.date + "T12:00:00"), "dd MMM yyyy", { locale: ptBR })}
                        {tx.source ? ` · ${tx.source}` : ""}
                        {tx.account_id && accountNames[tx.account_id] ? ` · ${accountNames[tx.account_id]}` : ""}
                      </p>
                    </div>
                    <span className={`text-xs font-bold tabular-nums ${isWithdraw ? "text-destructive" : "text-primary"}`}>
                      {isWithdraw ? "-" : "+"}{fmt(absAmount)}
                    </span>
                    {!isWithdraw && (
                      <button
                        onClick={() => setDepositToDelete(tx)}
                        className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-destructive/10 transition-all"
                      >
                        <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                      </button>
                    )}
                  </div>
                );
              })}
              {transactions.length > 5 && (
                <button
                  onClick={() => setShowAllHistory(v => !v)}
                  className="w-full flex items-center justify-center gap-1 py-2 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showAllHistory ? <><ChevronUp className="w-3 h-3" /> Mostrar menos</> : <><ChevronDown className="w-3 h-3" /> Ver todas ({transactions.length})</>}
                </button>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* ═══ Modals ═══ */}
      <GoalDepositModal open={showDeposit} onClose={() => setShowDeposit(false)} onSubmit={handleDeposit} goalName={goal.name} />
      <GoalWithdrawModal open={showWithdraw} onClose={() => setShowWithdraw(false)} onSubmit={handleWithdraw} goalName={goal.name} maxAmount={goal.current_amount} />
      {showEdit && <GoalEditModal open={showEdit} onClose={() => setShowEdit(false)} goal={goal} onUpdated={load} />}
      <GoalConfirmModal open={showDeleteGoal} onClose={() => setShowDeleteGoal(false)} onConfirm={handleDeleteGoal} title="Excluir meta" description={`Tem certeza que deseja excluir a meta "${goal.name}"? Esta ação não pode ser desfeita.`} confirmLabel="Excluir" loading={deletingGoal} />
      <GoalConfirmModal open={!!depositToDelete} onClose={() => setDepositToDelete(null)} onConfirm={handleDeleteDeposit} title="Remover depósito" description={depositToDelete ? getDepositDeleteDescription(depositToDelete) : ""} confirmLabel="Remover" loading={deletingDeposit} />
    </div>
  );
};

export default MetaDetalhe;
