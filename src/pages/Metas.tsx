import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Target, Plus, Wallet, Clock, MoreVertical, Sparkles, Edit2, Trash2, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { fetchGoals, createGoal, createGoalDeposit, deleteGoal, type Goal } from "@/services/goalService";
import { getGoalPreset } from "@/lib/goalIcons";
import GoalCreateModal from "@/components/goals/GoalCreateModal";
import GoalDepositModal from "@/components/goals/GoalDepositModal";
import GoalEditModal from "@/components/goals/GoalEditModal";
import GoalConfirmModal from "@/components/goals/GoalConfirmModal";
import AIFinancialWizardModal from "@/components/shared/AIFinancialWizardModal";
import BottomSheet from "@/components/shared/BottomSheet";
import { PageHeader, SectionTitle } from "@/components/shared/MobilePage";

import { getCurrency } from "@/lib/currency";
const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: getCurrency() });

const Metas = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAIWizard, setShowAIWizard] = useState(false);
  const [depositGoal, setDepositGoal] = useState<Goal | null>(null);
  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const [menuGoalId, setMenuGoalId] = useState<string | null>(null);
  const [deleteGoalId, setDeleteGoalId] = useState<string | null>(null);
  const [deletingGoal, setDeletingGoal] = useState(false);

  const loadGoals = useCallback(async () => {
    try {
      const data = await fetchGoals();
      setGoals(data);
    } catch {
      toast.error("Erro ao carregar metas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  const handleCreateGoal = useCallback(
    async (data: { name: string; target_amount: number; monthly_contribution?: number | null; deadline?: string | null; cover_image?: string | null }) => {
      if (!user) return;
      try {
        await createGoal(data, user.id);
        toast.success("Meta criada com sucesso! 🎯");
        setShowCreateModal(false);
        loadGoals();
      } catch {
        toast.error("Erro ao criar meta");
      }
    },
    [user, loadGoals]
  );

  const handleDeposit = useCallback(
    async (data: { amount: number; date: string; source?: string; account_id?: string }) => {
      if (!user || !depositGoal) return;
      try {
        await createGoalDeposit(
          { goal_id: depositGoal.id, amount: data.amount, date: data.date, source: data.source, account_id: data.account_id },
          user.id
        );
        toast.success("Depósito realizado! 💰");
        setDepositGoal(null);
        loadGoals();
      } catch {
        toast.error("Erro ao depositar");
      }
    },
    [user, depositGoal, loadGoals]
  );

  const handleDeleteGoal = useCallback(async (goalId: string) => {
    setDeletingGoal(true);
    try {
      await deleteGoal(goalId);
      toast.success("Meta excluída");
      setDeleteGoalId(null);
      setMenuGoalId(null);
      loadGoals();
    } catch {
      toast.error("Erro ao excluir meta");
    } finally {
      setDeletingGoal(false);
    }
  }, [loadGoals]);

  const totalGuardado = goals.reduce((s, g) => s + g.current_amount, 0);
  const totalObjetivo = goals.reduce((s, g) => s + g.target_amount, 0);

  const overallPct = totalObjetivo > 0 ? Math.min(totalGuardado / totalObjetivo, 1) : 0;
  const menuGoal = goals.find((g) => g.id === menuGoalId) ?? null;

  return (
    <div className="mx-auto max-w-lg pb-28 md:max-w-5xl">
      <PageHeader
        title="Metas"
        subtitle="Junte dinheiro para o que importa"
        action={
          <button
            onClick={() => setShowCreateModal(true)}
            aria-label="Nova meta"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#0B0B0B] active:scale-95 transition-transform"
          >
            <Plus className="h-5 w-5" strokeWidth={2.5} />
          </button>
        }
      />

      {/* Summary */}
      {goals.length > 0 && (
        <div className="mt-6">
          <p className="text-[15px] text-white/50">Total guardado</p>
          <p className="text-[40px] font-extrabold leading-tight tracking-tight text-white tabular-nums">{fmt(totalGuardado)}</p>
          <p className="text-[14px] text-white/45 tabular-nums">de {fmt(totalObjetivo)} · {Math.round(overallPct * 100)}%</p>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/[0.08]">
            <motion.div
              className="h-full rounded-full bg-white"
              initial={{ width: 0 }}
              animate={{ width: `${overallPct * 100}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
        </div>
      )}

      {/* AI helper */}
      <button
        onClick={() => setShowAIWizard(true)}
        className="mt-5 flex w-full items-center gap-3 rounded-[22px] border border-white/[0.12] bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-3.5 text-left active:scale-[0.99] transition-transform"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.08]">
          <Sparkles className="h-4 w-4 text-white" />
        </span>
        <span className="flex-1">
          <span className="block text-[15px] font-medium text-white">Planejar com IA</span>
          <span className="block text-[12px] text-white/45">Diga seu objetivo e montamos o plano</span>
        </span>
        <ChevronRight className="h-4 w-4 text-white/30" />
      </button>

      {goals.length > 0 && <SectionTitle>Suas metas</SectionTitle>}

      {loading ? (
        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-56 animate-pulse rounded-[24px] willo-glass" />
          ))}
        </div>
      ) : goals.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-12 flex flex-col items-center px-8 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.05]">
            <Target className="h-8 w-8 text-white/40" />
          </span>
          <p className="mt-5 text-[18px] font-bold text-white">Nenhuma meta ainda</p>
          <p className="mt-1 text-[14px] text-white/45">Crie sua primeira meta e acompanhe quanto falta para chegar lá.</p>
          <button onClick={() => setShowCreateModal(true)} className="mt-5 h-12 rounded-full bg-white px-6 text-[15px] font-semibold text-[#0B0B0B]">
            Criar meta
          </button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <AnimatePresence>
            {goals.map((goal, idx) => {
              const progress = Math.min(1, goal.current_amount / goal.target_amount);
              const remaining = Math.max(goal.target_amount - goal.current_amount, 0);
              const isComplete = progress >= 1;
              const deadline = goal.deadline ? new Date(`${goal.deadline}T12:00:00`) : null;
              const details = [
                `Faltam ${fmt(remaining)}`,
                goal.monthly_contribution ? `${fmt(goal.monthly_contribution)}/mês` : null,
                deadline ? `até ${deadline.toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}` : null,
              ].filter(Boolean).join(" · ");

              const goalPreset = getGoalPreset(goal);
              const GoalIcon = goalPreset.icon;

              return (
                <motion.div
                  key={goal.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => navigate(`/metas/${goal.id}`)}
                  className="cursor-pointer overflow-hidden rounded-[24px] border border-white/[0.12] willo-glass p-4 active:scale-[0.99] transition-transform"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full" style={{ background: `${goalPreset.hex}22` }}>
                        {goal.cover_image ? (
                          <img src={goal.cover_image} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <GoalIcon className="h-5 w-5" style={{ color: goalPreset.hex }} />
                        )}
                      </span>
                      <div className="min-w-0">
                        {isComplete && (
                          <span className="mb-1 inline-block rounded-full bg-willo-green px-2 py-0.5 text-[10px] font-bold text-[#0B0B0B]">Concluída</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setMenuGoalId(goal.id); }}
                      aria-label="Opções"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-white/60"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Body */}
                  <div className="relative mt-3">
                    <p className="truncate text-[17px] font-semibold text-white">{goal.name}</p>
                    <div className="mt-1 flex items-baseline justify-between gap-2">
                      <p className="text-[15px] tabular-nums">
                        <span className="font-bold text-white">{fmt(goal.current_amount)}</span>
                        <span className="text-white/40"> de {fmt(goal.target_amount)}</span>
                      </p>
                      <span className={`text-[13px] font-semibold tabular-nums ${isComplete ? "text-willo-green" : "text-white"}`}>{Math.round(progress * 100)}%</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.08]">
                      <motion.div
                        className={`h-full rounded-full ${isComplete ? "bg-willo-green" : "bg-white"}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${progress * 100}%` }}
                        transition={{ duration: 0.8, ease: "easeOut", delay: idx * 0.06 }}
                      />
                    </div>
                    <p className="mt-2 truncate text-[12px] text-white/45">{isComplete ? "Meta alcançada" : details}</p>

                    {!isComplete && (
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setDepositGoal(goal); }}
                          className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-white text-[14px] font-semibold text-[#0B0B0B] active:scale-[0.98] transition-transform"
                        >
                          <Wallet className="h-4 w-4" /> Guardar dinheiro
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/metas/${goal.id}`); }}
                          aria-label="Histórico"
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-white/70"
                        >
                          <Clock className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Goal actions */}
      <BottomSheet open={!!menuGoal} onClose={() => setMenuGoalId(null)}>
        <div className="px-5 pb-2">
          <p className="truncate text-[20px] font-bold text-white">{menuGoal?.name}</p>
          <div className="mt-4 space-y-2">
            <button
              onClick={() => { if (menuGoal) setEditGoal(menuGoal); setMenuGoalId(null); }}
              className="flex w-full items-center gap-3 rounded-[20px] bg-white/[0.05] px-4 py-3.5 text-left"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#0B0B0B]"><Edit2 className="h-4 w-4" /></span>
              <span className="text-[15px] font-medium text-white">Editar meta</span>
            </button>
            <button
              onClick={() => { if (menuGoal) setDeleteGoalId(menuGoal.id); setMenuGoalId(null); }}
              className="flex w-full items-center gap-3 rounded-[20px] bg-red-500/[0.08] px-4 py-3.5 text-left"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/15"><Trash2 className="h-4 w-4 text-red-400" /></span>
              <span className="text-[15px] font-medium text-red-400">Excluir meta</span>
            </button>
          </div>
        </div>
      </BottomSheet>

      <GoalCreateModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateGoal}
        existingNames={goals.map((g) => g.name)}
      />
      <GoalDepositModal open={!!depositGoal} onClose={() => setDepositGoal(null)} onSubmit={handleDeposit} goalName={depositGoal?.name ?? ""} />
      {editGoal && (
        <GoalEditModal open={!!editGoal} onClose={() => setEditGoal(null)} goal={editGoal} onUpdated={loadGoals} />
      )}

      <GoalConfirmModal
        open={!!deleteGoalId}
        onClose={() => setDeleteGoalId(null)}
        onConfirm={() => deleteGoalId && handleDeleteGoal(deleteGoalId)}
        title="Excluir meta"
        description="Tem certeza que deseja excluir esta meta? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        loading={deletingGoal}
      />

      <AIFinancialWizardModal
        open={showAIWizard}
        onClose={() => setShowAIWizard(false)}
        type="meta"
        onConfirm={async (plan, objective) => {
          if (!user) return;
          try {
            const { createGoal: createGoalFn } = await import("@/services/goalService");
            await createGoalFn({
              name: objective,
              target_amount: plan.monthly_contribution * plan.estimated_months,
              monthly_contribution: plan.monthly_contribution,
            }, user.id);
            toast.success("Meta criada com IA! 🤖🎯");
            loadGoals();
          } catch {
            toast.error("Erro ao criar meta");
          }
        }}
      />
    </div>
  );
};

export default Metas;
